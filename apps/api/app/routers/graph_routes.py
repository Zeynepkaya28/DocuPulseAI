from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import access, graph
from ..auth import User, current_user
from ..contracts import GraphResponse

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("", response_model=GraphResponse)
def get_graph(
    center: str | None = None,
    depth: int = Query(1, ge=1, le=3),
    limit: int = Query(50, ge=1, le=500),
    collection: str | None = None,
    document: str | None = None,
    user: User = Depends(current_user),
):
    """Subgraph from Neo4j, scoped to the caller's readable documents (optionally one document)."""
    docs = access.visible_document_ids(user.id, collection)
    if document:
        docs = [d for d in docs if d == document]
    return graph.subgraph(docs, center=center, depth=depth, limit=limit)


@router.get("/entities/{key}")
def get_entity(key: str, user: User = Depends(current_user)) -> dict[str, Any]:
    docs = access.visible_document_ids(user.id)
    detail = graph.entity_detail(key, docs)
    if not detail or not detail["documents"]:
        raise HTTPException(404, "Varlık bulunamadı")
    return detail
