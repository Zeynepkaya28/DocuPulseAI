"""POST /chat — GraphRAG answer as Server-Sent Events.

Event order (Faz A4 contract):
  {type:"status", stage:"searching_graph"} → {type:"status", stage:"writing"} → {type:"token"}… →
  {type:"sources", passages, paths, conflicts} → {type:"done", message_id}
"""
from __future__ import annotations

import json
import logging
from collections.abc import Iterator
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .. import db, rag
from ..auth import User, current_user
from ..contracts import (
    ChatDoneEvent,
    ChatErrorEvent,
    ChatRequest,
    ChatSourcesEvent,
    ChatStatusEvent,
    ChatTokenEvent,
)
from ..llm import provider
from ..ratelimit import rate_limited

router = APIRouter(prefix="/chat", tags=["chat"])
log = logging.getLogger("docupulse.chat")


def sse(event: BaseModel) -> str:
    return f"data: {event.model_dump_json()}\n\n"


def _session(req: ChatRequest, user: User) -> str:
    if req.session_id:
        row = db.fetch_one("select id::text from public.chat_sessions where id = %s and owner = %s", (req.session_id, user.id))
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Sohbet bulunamadı")
        return row["id"]
    row = db.fetch_one(
        "insert into public.chat_sessions (owner, title, collection_id) values (%s, %s, %s) returning id::text",
        (user.id, req.question.strip()[:80], req.collection_id),
    )
    return row["id"]  # type: ignore[index]


def _history(session_id: str) -> list[dict[str, str]]:
    rows = db.fetch_all(
        "select role, content from public.chat_messages where session_id = %s order by created_at desc limit 6",
        (session_id,),
    )
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def answer_stream(req: ChatRequest, user: User, session_id: str) -> Iterator[str]:
    history = _history(session_id)
    db.execute(
        "insert into public.chat_messages (session_id, owner, role, content) values (%s, %s, 'user', %s)",
        (session_id, user.id, req.question),
    )
    try:
        yield sse(ChatStatusEvent(stage="searching_graph", session_id=session_id))
        ctx = rag.retrieve(req.question, user.id, req.collection_id)
        yield sse(ChatStatusEvent(stage="writing", session_id=session_id))

        answer = ""
        if ctx.empty:
            answer = "Dokümanlarınızda bu soruyu yanıtlayacak bilgi bulamadım."
            yield sse(ChatTokenEvent(text=answer))
        else:
            for token in provider().stream(rag.build_messages(req.question, ctx, history)):
                answer += token
                yield sse(ChatTokenEvent(text=token))

        sources = ChatSourcesEvent(passages=ctx.passages, paths=ctx.paths, conflicts=ctx.conflicts)
        yield sse(sources)
        row = db.fetch_one(
            """insert into public.chat_messages (session_id, owner, role, content, sources)
               values (%s, %s, 'assistant', %s, %s::jsonb) returning id::text""",
            (session_id, user.id, answer, sources.model_dump_json(exclude={"type"})),
        )
        yield sse(ChatDoneEvent(message_id=row["id"]))  # type: ignore[index]
    except Exception:
        log.exception("chat failed")
        yield sse(ChatErrorEvent(message="Yanıt oluşturulamadı. Lütfen tekrar deneyin."))


@router.post("")
def chat(req: ChatRequest, user: User = Depends(rate_limited)) -> StreamingResponse:
    if not req.question.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Soru boş olamaz")
    session_id = _session(req, user)
    return StreamingResponse(
        answer_stream(req, user, session_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/sessions")
def sessions(user: User = Depends(current_user)) -> list[dict[str, Any]]:
    return db.fetch_all(
        "select id::text, title, collection_id::text, created_at::text from public.chat_sessions "
        "where owner = %s order by created_at desc limit 50",
        (user.id,),
    )


@router.get("/sessions/{session_id}/messages")
def messages(session_id: str, user: User = Depends(current_user)) -> list[dict[str, Any]]:
    rows = db.fetch_all(
        "select id::text, role, content, sources, created_at::text from public.chat_messages "
        "where session_id = %s and owner = %s order by created_at",
        (session_id, user.id),
    )
    for r in rows:
        if isinstance(r["sources"], str):
            r["sources"] = json.loads(r["sources"])
    return rows


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str, user: User = Depends(current_user)):
    db.execute("delete from public.chat_sessions where id = %s and owner = %s", (session_id, user.id))
