import json

from app import db, rag
from app.contracts import GraphNode, Passage, PathEdge, RelationPath
from app.routers import chat as chat_router


def _events(body: str) -> list[dict]:
    return [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]


def _fake_db(monkeypatch):
    monkeypatch.setattr(db, "execute", lambda *a, **k: None)
    monkeypatch.setattr(db, "fetch_all", lambda *a, **k: [])
    monkeypatch.setattr(db, "fetch_one", lambda sql, params=None: {"id": "00000000-0000-0000-0000-0000000000aa"})


def test_sse_event_order(client, monkeypatch, token):
    _fake_db(monkeypatch)
    ctx = rag.Context(
        passages=[Passage(chunk_id="c1", document_id="d1", document_title="Rapor", page=3, snippet="Acme Roket X'i geliştirdi.", score=0.03)],
        paths=[RelationPath(nodes=[GraphNode(id="acme", name="Acme", type="organization"), GraphNode(id="roket x", name="Roket X", type="product")],
                            edges=[PathEdge(source="acme", target="roket x", type="geliştirdi", document_id="d1", chunk_id="c1")])],
    )
    monkeypatch.setattr(rag, "retrieve", lambda *a, **k: ctx)
    r = client.post("/chat", json={"question": "Roket X'i kim geliştirdi?"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    ev = _events(r.text)
    types = [e["type"] for e in ev]
    assert types[:2] == ["status", "status"]
    assert ev[0]["stage"] == "searching_graph" and ev[1]["stage"] == "writing"
    assert "token" in types
    assert types[-2:] == ["sources", "done"]
    src = ev[-2]
    assert src["passages"][0]["page"] == 3
    assert src["paths"][0]["edges"][0]["type"] == "geliştirdi"


def test_empty_context_says_so(client, monkeypatch, token):
    _fake_db(monkeypatch)
    monkeypatch.setattr(rag, "retrieve", lambda *a, **k: rag.Context())
    ev = _events(client.post("/chat", json={"question": "x?"}, headers={"Authorization": f"Bearer {token}"}).text)
    text = "".join(e["text"] for e in ev if e["type"] == "token")
    assert "bulamadım" in text


def test_retrieval_failure_emits_error_event(client, monkeypatch, token):
    _fake_db(monkeypatch)

    def boom(*a, **k):
        raise RuntimeError("db down")

    monkeypatch.setattr(rag, "retrieve", boom)
    ev = _events(client.post("/chat", json={"question": "x?"}, headers={"Authorization": f"Bearer {token}"}).text)
    assert ev[-1]["type"] == "error"


def test_context_text_cites_passages_paths_and_conflicts():
    from app.contracts import Conflict

    ctx = rag.Context(
        passages=[Passage(chunk_id="c", document_id="d", document_title="Doc", page=None, snippet="metin", score=1)],
        paths=[RelationPath(nodes=[GraphNode(id="a", name="A", type="concept"), GraphNode(id="b", name="B", type="concept")],
                            edges=[PathEdge(source="a", target="b", type="yan etkisi", document_id="d")])],
        conflicts=[Conflict(subject="Acme", relation="kuruluş tarihi", values=["2009", "2011"])],
        doc_titles={"d": "Doc"},
    )
    text = rag.build_context_text(ctx)
    assert "[P1] (Doc) metin" in text
    assert "[R1] A —yan etkisi→ B" in text
    assert "2009 vs. 2011" in text


def test_chat_rejects_blank_question(client, token):
    assert client.post("/chat", json={"question": "  "}, headers={"Authorization": f"Bearer {token}"}).status_code == 422


def test_router_registered():
    assert chat_router.router.prefix == "/chat"
