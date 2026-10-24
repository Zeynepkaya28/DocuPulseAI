"""Queue workers (Kafka + Celery replaced by pgmq + short Vercel invocations).

Each handler does ONE small job so it fits the Hobby 300 s limit, and is idempotent:
chunks are keyed by (document_id, ord), embeddings/extraction only touch rows still missing them,
and graph writes use MERGE. Job progress is recomputed from data by public.refresh_job().
"""
from __future__ import annotations

import logging
import math
import time
from collections.abc import Callable
from typing import Any

from . import db, graph, queue, storage
from .chunking import PAGES_PER_PART, parse, pdf_page_count
from .config import get_settings
from .contracts import ChunkBatchMessage, DocumentUploadedEvent, GraphWriteMessage
from .llm import provider

log = logging.getLogger("docupulse.workers")

EMBED_BATCH = 64
EXTRACT_BATCH = 6

ENTITY_TYPES = ["person", "organization", "concept", "product", "event"]
EXTRACTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["entities", "relations"],
    "properties": {
        "entities": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "type", "aliases"],
                "properties": {
                    "name": {"type": "string"},
                    "type": {"type": "string", "enum": ENTITY_TYPES},
                    "aliases": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "relations": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["source", "target", "type", "evidence_chunk_id"],
                "properties": {
                    "source": {"type": "string"},
                    "target": {"type": "string"},
                    "type": {"type": "string"},
                    "evidence_chunk_id": {"type": "string"},
                },
            },
        },
    },
}

EXTRACTION_SYSTEM = (
    "You extract a knowledge graph from document passages. Return ONLY facts stated in the text.\n"
    "- entities: people, organizations, concepts, products, events/dates. Use the most complete name; "
    "put abbreviations and other spellings in aliases.\n"
    "- relations: source and target must be entity names you returned. type is a short lowercase verb phrase "
    "in the passage's language (e.g. 'geliştirdi', 'yan etkisi', 'kuruluş tarihi', 'acquired').\n"
    "- evidence_chunk_id: the id inside [chunk:<id>] of the passage that states the relation.\n"
    "Never invent facts. If nothing is found return empty arrays."
)

SUMMARY_SCHEMA = {
    "type": "object", "additionalProperties": False, "required": ["summary"],
    "properties": {"summary": {"type": "string"}},
}


def _doc(document_id: str) -> dict[str, Any] | None:
    return db.fetch_one(
        "select id::text, owner::text, title, mime, storage_path, status, summary, author from public.documents where id = %s",
        (document_id,),
    )


def _live(doc: dict[str, Any] | None) -> bool:
    return bool(doc) and doc["status"] not in ("canceled", "failed")  # type: ignore[index]


def refresh(document_id: str) -> str:
    row = db.fetch_one("select public.refresh_job(%s) as s", (document_id,))
    return (row or {}).get("s", "")


# ─────────────────────────── 1. document_ingest ───────────────────────────
def handle_document_ingest(body: dict[str, Any]) -> None:
    ev = DocumentUploadedEvent(**body)
    doc = _doc(ev.document_id)
    if not _live(doc):
        return
    data = storage.download(ev.storage_path)

    if ev.page_from is None:
        # First message for the document: decide how to split.
        parts = 1
        if ev.mime == "application/pdf":
            pages = pdf_page_count(data)
            parts = max(1, math.ceil(pages / PAGES_PER_PART))
            db.execute(
                "update public.jobs set meta = meta || jsonb_build_object('parts_total', %s::int, 'pages_total', %s::int), "
                "status = 'running' where document_id = %s",
                (parts, pages, ev.document_id),
            )
            if parts > 1:
                queue.send_batch("document_ingest", [
                    {**body, "page_from": i * PAGES_PER_PART + 1, "page_to": min(pages, (i + 1) * PAGES_PER_PART)}
                    for i in range(parts)
                ])
                refresh(ev.document_id)
                return
        else:
            db.execute(
                "update public.jobs set meta = meta || '{\"parts_total\": 1}'::jsonb, status = 'running' "
                "where document_id = %s",
                (ev.document_id,),
            )
        _ingest_part(doc, ev, data, part=0, page_from=1, page_to=None)  # type: ignore[arg-type]
    else:
        part = (ev.page_from - 1) // PAGES_PER_PART
        _ingest_part(doc, ev, data, part=part, page_from=ev.page_from, page_to=ev.page_to)  # type: ignore[arg-type]


def _ingest_part(doc: dict[str, Any], ev: DocumentUploadedEvent, data: bytes, part: int, page_from: int,
                 page_to: int | None) -> None:
    pieces, meta = parse(ev.mime, data, page_from, page_to)
    base = part * 100_000
    with db.conn() as c:
        with c.cursor() as cur:
            cur.executemany(
                """insert into public.chunks (document_id, ord, page, content) values (%s, %s, %s, %s)
                   on conflict (document_id, ord) do nothing""",
                [(ev.document_id, base + i, p.page, p.content) for i, p in enumerate(pieces) if p.content.strip()],
            )
    if part == 0:
        db.execute(
            """update public.documents set author = coalesce(author, %s),
                      published_at = coalesce(published_at, %s::date) where id = %s""",
            (meta.author, meta.published_at, ev.document_id),
        )
        if not doc.get("summary") and pieces:
            _summarize(ev.document_id, "\n\n".join(p.content for p in pieces[:6])[:6000])

    db.execute("select public.job_part_done(%s, %s)", (ev.document_id, part))
    ids = [r["id"] for r in db.fetch_all(
        "select id::text from public.chunks where document_id = %s and ord >= %s and ord < %s order by ord",
        (ev.document_id, base, base + 100_000),
    )]
    queue.send_batch("chunk_embed", [
        {"document_id": ev.document_id, "chunk_ids": ids[i : i + EMBED_BATCH]} for i in range(0, len(ids), EMBED_BATCH)
    ])
    queue.send_batch("chunk_extract", [
        {"document_id": ev.document_id, "chunk_ids": ids[i : i + EXTRACT_BATCH]}
        for i in range(0, len(ids), EXTRACT_BATCH)
    ])

    job = db.fetch_one("select meta from public.jobs where document_id = %s", (ev.document_id,))
    meta_j = (job or {}).get("meta") or {}
    all_parts = len(meta_j.get("parts_done", [])) >= int(meta_j.get("parts_total", 1))
    total = db.fetch_one("select count(*) as n from public.chunks where document_id = %s", (ev.document_id,))
    if all_parts and total and total["n"] == 0:
        db.execute("select public.fail_job(%s, %s)", (ev.document_id, "Dokümanda okunabilir metin bulunamadı (taranmış PDF olabilir)"))
        return
    refresh(ev.document_id)


def _summarize(document_id: str, text: str) -> None:
    try:
        out = provider().complete_json(
            "Summarize the document in 2-3 sentences, in the document's language. Plain text.",
            text, SUMMARY_SCHEMA,
        )
        summary = (out.get("summary") or "").strip() or text[:280].strip()
    except Exception:  # summary is optional; never fail ingestion for it
        summary = text[:280].strip()
    db.execute("update public.documents set summary = %s where id = %s and summary is null", (summary, document_id))


# ─────────────────────────── 2. chunk_embed ───────────────────────────
def handle_chunk_embed(body: dict[str, Any]) -> None:
    msg = ChunkBatchMessage(**body)
    if not _live(_doc(msg.document_id)):
        return
    rows = db.fetch_all(
        "select id::text, content from public.chunks where id = any(%s::uuid[]) and embedding is null",
        (msg.chunk_ids,),
    )
    if rows:
        vectors = provider().embed([r["content"] for r in rows])
        with db.conn() as c, c.cursor() as cur:
            cur.executemany(
                "update public.chunks set embedding = %s::extensions.vector where id = %s",
                [(str(v), r["id"]) for r, v in zip(rows, vectors, strict=True)],
            )
    refresh(msg.document_id)


# ─────────────────────────── 3. chunk_extract ───────────────────────────
def extraction_prompt(rows: list[dict[str, Any]]) -> str:
    return "\n\n".join(f"[chunk:{r['id']}]\n{r['content']}" for r in rows)


def clean_extraction(out: dict[str, Any], chunk_ids: list[str]) -> tuple[list[dict], list[dict]]:
    """Drop relations without valid evidence or with unknown endpoints; dedupe."""
    valid = set(chunk_ids)
    entities = [e for e in out.get("entities", []) if e.get("name", "").strip()]
    for e in entities:
        if e.get("type") not in ENTITY_TYPES:
            e["type"] = "concept"
        e.setdefault("aliases", [])
    names = {graph.normalize(e["name"]) for e in entities} | {
        graph.normalize(a) for e in entities for a in e["aliases"]
    }
    seen, relations = set(), []
    for r in out.get("relations", []):
        if r.get("evidence_chunk_id") not in valid:
            continue
        if graph.normalize(r.get("source", "")) not in names or graph.normalize(r.get("target", "")) not in names:
            continue
        key = (graph.normalize(r["source"]), graph.normalize(r["target"]), graph.normalize_relation(r["type"]))
        if key in seen:
            continue
        seen.add(key)
        relations.append(r)
    return entities, relations


def handle_chunk_extract(body: dict[str, Any]) -> None:
    msg = ChunkBatchMessage(**body)
    if not _live(_doc(msg.document_id)):
        return
    rows = db.fetch_all(
        "select id::text, content from public.chunks where id = any(%s::uuid[]) and extracted_at is null order by ord",
        (msg.chunk_ids,),
    )
    if rows:
        ids = [r["id"] for r in rows]
        out = provider().complete_json(EXTRACTION_SYSTEM, extraction_prompt(rows), EXTRACTION_SCHEMA)
        entities, relations = clean_extraction(out, ids)
        queue.send("graph_write", GraphWriteMessage(
            document_id=msg.document_id, chunk_ids=ids, entities=entities, relations=relations,  # type: ignore[arg-type]
        ).model_dump())
        db.execute("update public.chunks set extracted_at = now() where id = any(%s::uuid[])", (ids,))
    refresh(msg.document_id)


# ─────────────────────────── 4. graph_write ───────────────────────────
def handle_graph_write(body: dict[str, Any]) -> None:
    msg = GraphWriteMessage(**body)
    doc = _doc(msg.document_id)
    if not _live(doc):
        return
    graph.write_extraction(
        msg.document_id, doc["title"],  # type: ignore[index]
        [e.model_dump() for e in msg.entities], [r.model_dump() for r in msg.relations],
    )
    db.execute("update public.chunks set graph_at = now() where id = any(%s::uuid[])", (msg.chunk_ids,))
    db.execute("update public.documents set entity_count = %s where id = %s",
               (graph.entity_count(msg.document_id), msg.document_id))
    refresh(msg.document_id)


HANDLERS: dict[str, Callable[[dict[str, Any]], None]] = {
    "document_ingest": handle_document_ingest,
    "chunk_embed": handle_chunk_embed,
    "chunk_extract": handle_chunk_extract,
    "graph_write": handle_graph_write,
}


def run_queue(name: str, budget_s: float = 240.0) -> dict[str, int]:
    """Read → handle → delete. Failures stay invisible for the visibility timeout and are retried;
    after `worker_max_attempts` they move to <queue>_dlq and the job is marked failed."""
    s = get_settings()
    handler = HANDLERS[name]
    started = time.monotonic()
    stats = {"processed": 0, "failed": 0, "dead": 0}
    if name == "graph_write":
        graph.ensure_constraints()
    while time.monotonic() - started < budget_s:
        msgs = queue.read(name, s.worker_batch_size, s.worker_visibility_timeout)
        if not msgs:
            break
        for m in msgs:
            try:
                handler(m.body)
                queue.delete(name, m.msg_id)
                stats["processed"] += 1
            except Exception as exc:  # noqa: BLE001 — every failure is retried or dead-lettered
                log.exception("worker %s failed on msg %s", name, m.msg_id)
                stats["failed"] += 1
                if m.read_ct >= s.worker_max_attempts:
                    queue.dead_letter(name, m, repr(exc))
                    stats["dead"] += 1
                    if doc_id := m.body.get("document_id"):
                        db.execute("select public.fail_job(%s, %s)", (doc_id, _human_error(name)))
    return stats


def _human_error(queue_name: str) -> str:
    return {
        "document_ingest": "Dosya okunamadı veya parçalara bölünemedi",
        "chunk_embed": "Embedding servisine ulaşılamadı",
        "chunk_extract": "Varlık çıkarımı başarısız oldu",
        "graph_write": "Grafa yazılamadı",
    }[queue_name]
