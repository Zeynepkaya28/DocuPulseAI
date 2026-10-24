"""Documents. Files never pass through this API (Vercel's 4.5 MB body limit): the browser uploads
straight to Supabase Storage with a signed URL (or TUS for >6 MB), then calls /complete."""
from __future__ import annotations

import os
import re
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from .. import db, graph, storage
from ..auth import User, current_user, require_writer
from ..contracts import ACCEPTED_EXT, Document, UploadUrlRequest, UploadUrlResponse
from ..ratelimit import rate_limited

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_BYTES = 50 * 1024 * 1024
EXT_MIME = {".pdf": "application/pdf", ".md": "text/markdown", ".markdown": "text/markdown",
            ".csv": "text/csv", ".txt": "text/plain"}

_DOC_COLS = """d.id::text, d.owner::text, d.collection_id::text, d.title, d.author, d.published_at::text,
  d.mime, d.size_bytes, d.storage_path, d.status, d.summary, d.entity_count, d.created_at::text"""


def safe_filename(name: str) -> str:
    base = os.path.basename(name.replace("\\", "/"))
    base = re.sub(r"[^\w.\-]+", "_", base, flags=re.UNICODE).strip("._") or "dosya"
    return base[:120]


def validate_upload(req: UploadUrlRequest) -> str:
    """Returns the canonical mime type or raises 422 with a human-readable reason."""
    ext = os.path.splitext(req.filename.lower())[1]
    if ext not in ACCEPTED_EXT:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Bu dosya türü desteklenmiyor")
    if req.size_bytes <= 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Dosya boş")
    if req.size_bytes > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Dosya 50 MB sınırını aşıyor")
    return EXT_MIME[ext]


def get_owned(doc_id: str, user: User) -> dict[str, Any]:
    row = db.fetch_one(f"select {_DOC_COLS} from public.documents d where d.id = %s", (doc_id,))
    if not row or row["owner"] != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doküman bulunamadı")
    return row


@router.post("/upload-url", response_model=UploadUrlResponse)
def create_upload_url(req: UploadUrlRequest, user: User = Depends(require_writer), _: User = Depends(rate_limited)):
    mime = validate_upload(req)
    doc_id = str(uuid.uuid4())
    path = f"{user.id}/{doc_id}/{safe_filename(req.filename)}"
    title = os.path.splitext(os.path.basename(req.filename))[0][:200]
    db.execute(
        """insert into public.documents (id, owner, collection_id, title, mime, size_bytes, storage_path, status)
           values (%s, %s, %s, %s, %s, %s, %s, 'pending')""",
        (doc_id, user.id, req.collection_id, title, mime, req.size_bytes, path),
    )
    signed_url, token = storage.create_signed_upload_url(path)
    return UploadUrlResponse(document_id=doc_id, bucket="documents", storage_path=path, signed_url=signed_url,
                             token=token)


@router.post("/{doc_id}/complete", response_model=Document)
def complete_upload(doc_id: str, user: User = Depends(require_writer)):
    doc = get_owned(doc_id, user)
    if doc["status"] != "pending":
        return Document(**doc)  # idempotent
    if not storage.object_exists(doc["storage_path"]):
        raise HTTPException(status.HTTP_409_CONFLICT, "Dosya depolamada bulunamadı; yüklemeyi tekrar deneyin")
    # status → uploaded fires the trigger that creates the job and enqueues document_ingest.
    db.execute("update public.documents set status = 'uploaded' where id = %s", (doc_id,))
    return Document(**{**doc, "status": "uploaded"})


@router.post("/{doc_id}/cancel", response_model=Document)
def cancel(doc_id: str, user: User = Depends(require_writer)):
    """Undo (before processing) or cancel (during processing). Workers skip canceled documents."""
    doc = get_owned(doc_id, user)
    if doc["status"] in ("ready", "canceled"):
        return Document(**doc)
    db.execute("update public.documents set status = 'canceled' where id = %s", (doc_id,))
    db.execute("update public.jobs set status = 'canceled' where document_id = %s", (doc_id,))
    db.execute("delete from public.chunks where document_id = %s", (doc_id,))
    storage.remove([doc["storage_path"]] if doc["storage_path"] else [])
    graph.delete_document(doc_id)
    return Document(**{**doc, "status": "canceled"})


@router.post("/{doc_id}/retry", response_model=Document)
def retry(doc_id: str, user: User = Depends(require_writer)):
    """Re-run a failed job, or one that has stalled (no update for 90 s). Workers are idempotent."""
    doc = get_owned(doc_id, user)
    stalled = db.fetch_one(
        "select 1 as x from public.jobs where document_id = %s and status in ('queued','running') "
        "and updated_at < now() - interval '90 seconds'",
        (doc_id,),
    )
    if doc["status"] != "failed" and not stalled:
        raise HTTPException(status.HTTP_409_CONFLICT, "Yalnızca başarısız veya duraksamış işlemler tekrar denenebilir")
    # pending → uploaded re-fires the ingest trigger.
    db.execute("update public.documents set status = 'pending' where id = %s", (doc_id,))
    db.execute("update public.documents set status = 'uploaded' where id = %s", (doc_id,))
    return Document(**{**doc, "status": "uploaded"})


@router.get("", response_model=list[Document])
def list_documents(collection: str | None = None, user: User = Depends(current_user),
                   limit: int = Query(200, le=500)):
    rows = db.fetch_all(
        f"""select {_DOC_COLS} from public.documents d
            where public.can_read_document(d.owner, d.collection_id, %(u)s::uuid)
              and d.status <> 'canceled'
              and (%(c)s::uuid is null or d.collection_id = %(c)s::uuid)
            order by d.created_at desc limit %(l)s""",
        {"u": user.id, "c": collection, "l": limit},
    )
    return [Document(**r) for r in rows]


class DocumentDetail(Document):
    entities: list[dict[str, Any]] = []
    chunk_count: int = 0


@router.get("/{doc_id}", response_model=DocumentDetail)
def get_document(doc_id: str, user: User = Depends(current_user)):
    row = db.fetch_one(
        f"""select {_DOC_COLS}, (select count(*) from public.chunks c where c.document_id = d.id) as chunk_count
            from public.documents d
            where d.id = %s and public.can_read_document(d.owner, d.collection_id, %s::uuid)""",
        (doc_id, user.id),
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doküman bulunamadı")
    entities: list[dict[str, Any]] = []
    try:
        entities = graph.run(
            """MATCH (:Document {id: $doc})-[:MENTIONS]->(n:Entity)
               OPTIONAL MATCH (n)-[r:REL {doc_id: $doc}]-()
               RETURN n.key AS id, n.name AS name, n.type AS type, count(r) AS degree
               ORDER BY degree DESC LIMIT 40""",
            doc=doc_id,
        )
    except Exception:  # graph unavailable must not break the detail view
        entities = []
    return DocumentDetail(**row, entities=entities)


class DocumentPatch(BaseModel):
    title: str | None = None
    collection_id: str | None = None
    author: str | None = None


@router.patch("/{doc_id}", response_model=Document)
def update_document(doc_id: str, patch: DocumentPatch, user: User = Depends(require_writer)):
    doc = get_owned(doc_id, user)
    fields = patch.model_dump(exclude_unset=True)
    if not fields:
        return Document(**doc)
    sets = ", ".join(f"{k} = %({k})s" for k in fields)
    db.execute(f"update public.documents set {sets} where id = %(id)s", {**fields, "id": doc_id})
    return Document(**{**doc, **fields})


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(doc_id: str, user: User = Depends(require_writer)):
    doc = get_owned(doc_id, user)
    storage.remove([doc["storage_path"]] if doc["storage_path"] else [])
    graph.delete_document(doc_id)
    db.execute("delete from public.documents where id = %s", (doc_id,))  # chunks + job cascade
