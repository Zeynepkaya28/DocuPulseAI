"""End-to-end pipeline against the LOCAL stack (npx supabase start + docker compose up neo4j).
Skipped automatically when either service is unreachable. Uses the offline fake LLM provider."""
import uuid

import pytest

from app import db, graph, queue, storage, workers
from app.config import get_settings

ALICE = "11111111-1111-1111-1111-111111111111"
BOB = "22222222-2222-2222-2222-222222222222"

TEXT = """# Roket Raporu

Acme Uzay şirketi Roket X aracını geliştirdi. Roket X ilk uçuşunu Kennedy Üssü üzerinden yaptı.

Ayşe Yılmaz Acme Uzay şirketinin baş mühendisidir. Ayşe Yılmaz daha önce Orbit Labs ekibinde çalıştı.
"""


def _services_up() -> bool:
    try:
        db.fetch_one("select 1")
        graph.run("RETURN 1")
        return bool(get_settings().supabase_service_role_key)
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _services_up(), reason="local Supabase/Neo4j not running")


def _drain():
    for _ in range(20):
        work = sum(sum(workers.run_queue(q, budget_s=30).values()) for q in queue.QUEUES)
        if work == 0:
            return


@pytest.fixture
def uploaded_doc():
    doc_id = str(uuid.uuid4())
    path = f"{ALICE}/{doc_id}/rapor.md"
    r = storage.client().post(
        f"/object/{get_settings().storage_bucket}/{path}", content=TEXT.encode(),
        headers={"Content-Type": "text/markdown", "x-upsert": "true"},
    )
    r.raise_for_status()
    db.execute(
        "insert into public.documents (id, owner, title, mime, storage_path, status) values (%s,%s,'Roket Raporu','text/markdown',%s,'pending')",
        (doc_id, ALICE, path),
    )
    db.execute("update public.documents set status = 'uploaded' where id = %s", (doc_id,))
    yield doc_id
    graph.delete_document(doc_id)
    storage.remove([path])
    db.execute("delete from public.documents where id = %s", (doc_id,))


def test_full_pipeline(uploaded_doc):
    job = db.fetch_one("select status, stage from public.jobs where document_id = %s", (uploaded_doc,))
    assert job == {"status": "queued", "stage": 1}, "trigger should create the job"

    _drain()

    job = db.fetch_one("select status, stage, progress, total from public.jobs where document_id = %s", (uploaded_doc,))
    assert job["status"] == "done", job
    assert job["stage"] == 5 and job["progress"] == job["total"]
    doc = db.fetch_one("select status, entity_count, summary from public.documents where id = %s", (uploaded_doc,))
    assert doc["status"] == "ready"
    assert doc["entity_count"] > 0
    assert doc["summary"]
    counts = db.fetch_one(
        "select count(*) n, count(embedding) e, count(extracted_at) x, count(graph_at) g from public.chunks where document_id = %s",
        (uploaded_doc,),
    )
    assert counts["n"] > 0 and counts["n"] == counts["e"] == counts["x"] == counts["g"]

    # Graph is scoped to readable documents
    sub = graph.subgraph([uploaded_doc])
    assert sub["nodes"] and sub["edges"]
    assert graph.subgraph([]) == {"nodes": [], "edges": [], "truncated": False}


def test_idempotent_redelivery(uploaded_doc):
    _drain()
    before = db.fetch_one("select count(*) n from public.chunks where document_id = %s", (uploaded_doc,))["n"]
    rels_before = graph.run("MATCH ()-[r:REL {doc_id: $d}]->() RETURN count(r) AS n", d=uploaded_doc)[0]["n"]
    # Same event delivered again
    path = db.fetch_one("select storage_path from public.documents where id = %s", (uploaded_doc,))["storage_path"]
    workers.handle_document_ingest({"document_id": uploaded_doc, "owner_id": ALICE, "storage_path": path, "mime": "text/markdown"})
    _drain()
    after = db.fetch_one("select count(*) n from public.chunks where document_id = %s", (uploaded_doc,))["n"]
    rels_after = graph.run("MATCH ()-[r:REL {doc_id: $d}]->() RETURN count(r) AS n", d=uploaded_doc)[0]["n"]
    assert before == after
    assert rels_before == rels_after


def test_graphrag_retrieval_finds_chain_and_hides_from_bob(uploaded_doc):
    from app import rag

    _drain()
    ctx = rag.retrieve("Roket X kimin aracı?", ALICE)
    assert ctx.passages
    assert ctx.paths, "question entity 'Roket X' should yield relation chains"
    assert rag.retrieve("Roket X kimin aracı?", BOB).empty


def test_hybrid_search_respects_visibility(uploaded_doc):
    _drain()
    from app.llm import provider

    emb = provider().embed(["Roket X kim geliştirdi"])[0]
    q = "select * from public.match_chunks(%s::extensions.vector, %s, 5, %s::uuid)"
    alice = db.fetch_all(q, (str(emb), "Roket geliştirdi", ALICE))
    bob = db.fetch_all(q, (str(emb), "Roket geliştirdi", BOB))
    assert alice and alice[0]["document_id"] is not None
    assert all(str(r["document_id"]) != uploaded_doc for r in bob)
