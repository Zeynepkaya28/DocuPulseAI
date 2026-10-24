"""Live search across documents, entities and passages (scope bar: all | documents | entities | passages)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from .. import access, db, graph
from ..auth import User, current_user
from ..contracts import SearchHit
from ..llm import provider

router = APIRouter(prefix="/search", tags=["search"])

TYPE_MIME = {"pdf": "application/pdf", "md": "text/markdown", "markdown": "text/markdown", "csv": "text/csv",
             "txt": "text/plain"}


@router.get("", response_model=list[SearchHit])
def search(
    q: str = Query("", max_length=200),
    scope: str = Query("all", pattern="^(all|documents|entities|passages)$"),
    type: str | None = None,
    author: str | None = None,
    limit: int = Query(20, le=50),
    user: User = Depends(current_user),
) -> list[SearchHit]:
    q = q.strip()
    hits: list[SearchHit] = []
    mime = TYPE_MIME.get((type or "").lower())

    if scope in ("all", "documents"):
        rows = db.fetch_all(
            """select d.id::text, d.title, d.author, d.mime,
                      greatest(similarity(lower(d.title), lower(%(q)s)),
                               case when d.title ilike '%%' || %(q)s || '%%' then 0.6 else 0 end) as score
               from public.documents d
               where public.can_read_document(d.owner, d.collection_id, %(u)s::uuid) and d.status <> 'canceled'
                 and (%(q)s = '' or d.title ilike '%%' || %(q)s || '%%' or d.author ilike '%%' || %(q)s || '%%'
                      or similarity(lower(d.title), lower(%(q)s)) > 0.2)
                 and (%(mime)s::text is null or d.mime = %(mime)s)
                 and (%(author)s::text is null or d.author ilike '%%' || %(author)s || '%%')
               order by score desc, d.created_at desc limit %(l)s""",
            {"q": q, "u": user.id, "mime": mime, "author": author, "l": limit},
        )
        hits += [SearchHit(kind="document", id=r["id"], title=r["title"], subtitle=r["author"], document_id=r["id"],
                           score=float(r["score"] or 0.5)) for r in rows]

    if q and scope in ("all", "entities"):
        docs = access.visible_document_ids(user.id)
        try:
            ents = graph.search_entities(q, docs, limit)
        except Exception:
            ents = []
        hits += [SearchHit(kind="entity", id=e["id"], title=e["name"], subtitle=f"{e['docs']} dokümanda",
                           score=0.9 if e["id"].startswith(graph.normalize(q)) else 0.55) for e in ents]

    if q and len(q) >= 3 and scope in ("all", "passages"):
        emb = provider().embed([q])[0]
        rows = db.fetch_all(
            "select * from public.match_chunks(%s::extensions.vector, %s, %s, %s::uuid)",
            (str(emb), q, min(limit, 10), user.id),
        )
        hits += [SearchHit(kind="passage", id=str(r["chunk_id"]), title=r["content"][:160],
                           subtitle=f"{r['document_title']}" + (f" · s. {r['page']}" if r["page"] else ""),
                           document_id=str(r["document_id"]), score=min(1.0, float(r["score"]) * 30)) for r in rows]

    # Most relevant first. // HIG: search-fields
    hits.sort(key=lambda h: h.score, reverse=True)
    return hits[:limit]
