"""Which documents a user may read. Mirrors the RLS rule (public.can_read_document) for service-side queries."""
from __future__ import annotations

from . import db


def visible_document_ids(user_id: str, collection_id: str | None = None) -> list[str]:
    rows = db.fetch_all(
        """
        select id::text from public.documents d
        where public.can_read_document(d.owner, d.collection_id, %(u)s::uuid)
          and (%(c)s::uuid is null or d.collection_id = %(c)s::uuid)
          and d.status in ('processing', 'ready')
        """,
        {"u": user_id, "c": collection_id},
    )
    return [r["id"] for r in rows]


def can_read(user_id: str, document_id: str) -> bool:
    row = db.fetch_one(
        "select public.can_read_document(owner, collection_id, %s::uuid) as ok from public.documents where id = %s",
        (user_id, document_id),
    )
    return bool(row and row["ok"])
