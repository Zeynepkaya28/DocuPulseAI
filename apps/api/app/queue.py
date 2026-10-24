"""Supabase Queues (pgmq) helpers. Delivery is at-least-once; handlers must be idempotent."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from . import db

QUEUES = ("document_ingest", "chunk_embed", "chunk_extract", "graph_write")


@dataclass
class Message:
    msg_id: int
    read_ct: int
    body: dict[str, Any]


def send(queue: str, body: dict[str, Any]) -> None:
    db.execute("select pgmq.send(%s, %s::jsonb)", (queue, json.dumps(body)))


def send_batch(queue: str, bodies: list[dict[str, Any]]) -> None:
    if bodies:
        db.execute("select pgmq.send_batch(%s, %s::jsonb[])", (queue, [json.dumps(b) for b in bodies]))


def read(queue: str, n: int, visibility_timeout: int) -> list[Message]:
    rows = db.fetch_all("select msg_id, read_ct, message from pgmq.read(%s, %s, %s)", (queue, visibility_timeout, n))
    return [Message(r["msg_id"], r["read_ct"], r["message"]) for r in rows]


def delete(queue: str, msg_id: int) -> None:
    db.execute("select pgmq.delete(%s, %s::bigint)", (queue, msg_id))


def dead_letter(queue: str, msg: Message, error: str) -> None:
    send(f"{queue}_dlq", {**msg.body, "_error": error[:500], "_attempts": msg.read_ct})
    delete(queue, msg.msg_id)
