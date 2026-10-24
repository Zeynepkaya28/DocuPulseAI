"""Hybrid retrieval (GraphRAG): pgvector + full-text passages AND Neo4j relation chains, fused into one context."""
from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Literal

from . import access, db, graph
from .contracts import Conflict, GraphNode, Passage, PathEdge, RelationPath
from .llm import Message, provider

Mode = Literal["graphrag", "vector"]

SYSTEM_PROMPT = (
    "Sen DocuPulse AI'sın. YALNIZCA aşağıdaki bağlamdaki pasajlara [P#] ve ilişki zincirlerine [R#] dayanarak yanıt ver.\n"
    "- Her iddianın sonunda kaynağını köşeli parantezle göster, örn. [P2] veya [R1].\n"
    "- Bağlam soruyu yanıtlamaya yetmiyorsa bunu açıkça söyle; tahmin yürütme, bilgi uydurma.\n"
    "- 'ÇELİŞKİLER' bölümü varsa farklı kaynakların farklı değerler verdiğini belirt.\n"
    "- Sorunun dilinde, kısa ve net yanıt ver."
)

_executor = ThreadPoolExecutor(max_workers=4)


@dataclass
class Context:
    passages: list[Passage] = field(default_factory=list)
    paths: list[RelationPath] = field(default_factory=list)
    conflicts: list[Conflict] = field(default_factory=list)
    doc_titles: dict[str, str] = field(default_factory=dict)

    @property
    def empty(self) -> bool:
        return not self.passages and not self.paths


def search_passages(question: str, user_id: str, collection: str | None, k: int = 8) -> list[Passage]:
    emb = provider().embed([question])[0]
    rows = db.fetch_all(
        "select * from public.match_chunks(%s::extensions.vector, %s, %s, %s::uuid, %s::uuid)",
        (str(emb), question, k, user_id, collection),
    )
    return [
        Passage(chunk_id=str(r["chunk_id"]), document_id=str(r["document_id"]), document_title=r["document_title"],
                page=r["page"], snippet=r["content"], score=float(r["score"]))
        for r in rows
    ]


_SUFFIX = re.compile(r"['’`]\w+", re.UNICODE)


def strip_suffixes(text: str) -> str:
    """Turkish case suffixes follow an apostrophe after proper names: "Uydu Z'yi" → "Uydu Z"."""
    return _SUFFIX.sub("", text)


def question_entities(question: str, doc_ids: list[str]) -> list[dict[str, Any]]:
    """Entities named in the question: any visible entity whose key occurs in the normalized question."""
    clean = strip_suffixes(question)
    found = graph.find_entities([clean], doc_ids, limit=12)
    q = graph.normalize(clean)
    # Very short keys match by accident ("ai", "x"); require a whole-word hit.
    return [e for e in found if len(e["id"]) >= 3 and f" {e['id']} " in f" {q} "]


def search_paths(question: str, doc_ids: list[str], hops: int = 2, one_hop: int = 4, two_hop: int = 6) -> list[RelationPath]:
    """Direct (1-hop) facts about the question's entities plus 2-hop chains, with separate quotas so
    multi-hop evidence is not crowded out by the many short paths."""
    ents = question_entities(question, doc_ids)
    if not ents:
        return []
    asked = {e["id"] for e in ents}
    raw = graph.paths_from(list(asked), doc_ids, hops=hops, limit=200)
    seen: set[tuple] = set()
    buckets: dict[int, list[RelationPath]] = {1: [], 2: []}
    quota = {1: one_hop, 2: two_hop}
    # Prefer chains that lead AWAY from the question's own entities (new information).
    for p in sorted(raw, key=lambda p: (len(p["edges"]), p["nodes"][-1]["id"] in asked)):
        n = min(len(p["edges"]), 2)
        key = tuple(sorted((e["source"], e["type"], e["target"]) for e in p["edges"]))
        if key in seen or len(buckets[n]) >= quota[n]:
            continue
        seen.add(key)
        buckets[n].append(RelationPath(
            nodes=[GraphNode(**node) for node in p["nodes"]],
            edges=[PathEdge(**{k: v for k, v in e.items() if k != "conflict"}) for e in p["edges"]],
        ))
    return buckets[1] + buckets[2]


def find_conflicts(paths: list[RelationPath], doc_ids: list[str]) -> list[Conflict]:
    """Functional relations (one value per subject) whose values differ across documents."""
    subjects = {n.id for p in paths for n in p.nodes}
    if not subjects:
        return []
    rows = graph.run(
        """
        MATCH (a:Entity)-[r:REL]->(b:Entity)
        WHERE a.key IN $keys AND r.doc_id IN $docs AND coalesce(r.conflict, false)
        RETURN a.name AS subject, r.type AS relation, collect(DISTINCT b.name) AS vals, collect(DISTINCT r.doc_id) AS docs
        """,
        keys=list(subjects), docs=doc_ids,
    )
    return [Conflict(subject=r["subject"], relation=r["relation"], values=r["vals"], document_ids=r["docs"])
            for r in rows if len(r["vals"]) > 1]


def retrieve(question: str, user_id: str, collection: str | None = None, mode: Mode = "graphrag", k: int = 8) -> Context:
    doc_ids = access.visible_document_ids(user_id, collection)
    if not doc_ids:
        return Context()
    passages_f = _executor.submit(search_passages, question, user_id, collection, k)
    paths: list[RelationPath] = []
    if mode == "graphrag":
        try:
            paths = search_paths(question, doc_ids)
        except Exception:  # Neo4j down → degrade to vector-only rather than fail the chat
            paths = []
    passages = passages_f.result()
    conflicts = find_conflicts(paths, doc_ids) if paths else []
    titles = {p.document_id: p.document_title for p in passages}
    missing = {e.document_id for p in paths for e in p.edges if e.document_id and e.document_id not in titles}
    if missing:
        for r in db.fetch_all("select id::text, title from public.documents where id = any(%s::uuid[])", (list(missing),)):
            titles[r["id"]] = r["title"]
    return Context(passages=passages, paths=paths, conflicts=conflicts, doc_titles=titles)


def format_path(p: RelationPath) -> str:
    names = {n.id: n.name for n in p.nodes}
    return " ; ".join(f"{names.get(e.source, e.source)} —{e.type}→ {names.get(e.target, e.target)}" for e in p.edges)


def build_context_text(ctx: Context) -> str:
    parts = ["PASAJLAR:"]
    for i, p in enumerate(ctx.passages, 1):
        page = f", s. {p.page}" if p.page else ""
        parts.append(f"[P{i}] ({p.document_title}{page}) {p.snippet.strip()}")
    if ctx.paths:
        parts.append("\nİLİŞKİ ZİNCİRLERİ (bilgi grafiği):")
        for i, p in enumerate(ctx.paths, 1):
            docs = sorted({ctx.doc_titles.get(e.document_id or "", "?") for e in p.edges})
            parts.append(f"[R{i}] {format_path(p)}  (kaynak: {', '.join(docs)})")
    if ctx.conflicts:
        parts.append("\nÇELİŞKİLER:")
        for c in ctx.conflicts:
            parts.append(f"- {c.subject} / {c.relation}: {' vs. '.join(c.values)}")
    return "\n".join(parts)


def build_messages(question: str, ctx: Context, history: list[Message] | None = None) -> list[Message]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        *(history or [])[-6:],
        {"role": "user", "content": f"{build_context_text(ctx)}\n\nSORU: {question}"},
    ]
