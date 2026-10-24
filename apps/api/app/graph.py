"""Neo4j access: one driver per function instance (module level).

Model:
  (:Document {id, title})-[:MENTIONS {chunk_id}]->(:Entity {key, name, type, aliases})
  (:Entity)-[:REL {type, doc_id, chunk_id, conflict}]->(:Entity)
Access control: every query is scoped to the document ids the caller may read (from Postgres RLS rules).
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any

from neo4j import Driver, GraphDatabase

from .config import get_settings

_driver: Driver | None = None

# Relations that should have ONE value per subject; different values across documents are conflict candidates.
FUNCTIONAL_RELATIONS = {
    "kuruluş tarihi", "doğum tarihi", "ölüm tarihi", "tarih", "merkez", "merkezi", "ceo", "genel müdür",
    "kurucu", "fiyat", "değer", "nüfus", "sürüm", "yayın tarihi", "founded", "born", "headquartered in",
    "price", "release date", "version",
}


def driver() -> Driver:
    global _driver
    if _driver is None:
        s = get_settings()
        _driver = GraphDatabase.driver(s.neo4j_uri, auth=(s.neo4j_user, s.neo4j_password), max_connection_pool_size=5)
    return _driver


def run(cypher: str, **params: Any) -> list[dict[str, Any]]:
    records, _, _ = driver().execute_query(cypher, params, database_="neo4j")
    return [r.data() for r in records]


def ensure_constraints() -> None:
    run("CREATE CONSTRAINT entity_key IF NOT EXISTS FOR (e:Entity) REQUIRE e.key IS UNIQUE")
    run("CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE")
    run("CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name)")


# ─────────────────────────── Normalization ───────────────────────────
def normalize(name: str) -> str:
    """Entity key: casefold where Turkish ı/İ/I/i all fold to "i" (works for Turkish and English names)."""
    s = name.replace("İ", "i").lower().replace("ı", "i").replace("i̇", "i")
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[\"'`´’‘“”().,;:!?\[\]{}]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    for suffix in (" a.ş", " aş", " ltd şti", " inc", " ltd", " llc", " gmbh"):
        if s.endswith(suffix):
            s = s[: -len(suffix)].strip()
    return s


def normalize_relation(rel: str) -> str:
    return re.sub(r"[_\s]+", " ", rel.strip().lower())


def is_functional(rel: str) -> bool:
    r = normalize_relation(rel)
    return r in FUNCTIONAL_RELATIONS or r.endswith(" tarihi") or r.endswith(" date")


# ─────────────────────────── Writes (graph_write worker) ───────────────────────────
def write_extraction(document_id: str, title: str, entities: list[dict], relations: list[dict]) -> int:
    """Idempotent MERGE of entities + relations. Returns number of relations written."""
    key_of: dict[str, str] = {}
    ents: dict[str, dict] = {}
    for e in entities:
        k = normalize(e["name"])
        if not k:
            continue
        key_of[normalize(e["name"])] = k
        for a in e.get("aliases") or []:
            key_of[normalize(a)] = k
        cur = ents.setdefault(k, {"key": k, "name": e["name"].strip(), "type": e["type"], "aliases": set()})
        cur["aliases"].update(a.strip() for a in e.get("aliases") or [])

    rels = []
    for r in relations:
        sk = key_of.get(normalize(r["source"]), normalize(r["source"]))
        tk = key_of.get(normalize(r["target"]), normalize(r["target"]))
        if not sk or not tk or sk == tk:
            continue
        for k, nm in ((sk, r["source"]), (tk, r["target"])):
            ents.setdefault(k, {"key": k, "name": nm.strip(), "type": "concept", "aliases": set()})
        rels.append({
            "s": sk, "t": tk, "type": normalize_relation(r["type"]),
            "chunk_id": r["evidence_chunk_id"], "functional": is_functional(r["type"]),
        })

    ent_rows = [{**e, "aliases": sorted(e["aliases"])} for e in ents.values()]
    mention_chunks = {r["chunk_id"] for r in rels}
    run(
        """
        MERGE (d:Document {id: $doc}) SET d.title = $title
        WITH d
        UNWIND $ents AS e
        MERGE (n:Entity {key: e.key})
          ON CREATE SET n.name = e.name, n.type = e.type, n.aliases = e.aliases
          ON MATCH SET n.aliases = [x IN coalesce(n.aliases, []) + e.aliases WHERE x IS NOT NULL | x]
        MERGE (d)-[m:MENTIONS]->(n)
          ON CREATE SET m.chunk_ids = $chunks
        """,
        doc=document_id, title=title, ents=ent_rows, chunks=sorted(mention_chunks),
    )
    if rels:
        run(
            """
            UNWIND $rels AS r
            MATCH (a:Entity {key: r.s}), (b:Entity {key: r.t})
            MERGE (a)-[x:REL {type: r.type, doc_id: $doc, chunk_id: r.chunk_id}]->(b)
            WITH a, b, x, r
            WHERE r.functional
            OPTIONAL MATCH (a)-[y:REL {type: r.type}]->(c:Entity)
              WHERE c <> b AND y.doc_id <> $doc
            WITH x, collect(y) AS others
            WHERE size(others) > 0
            SET x.conflict = true
            FOREACH (o IN others | SET o.conflict = true)
            """,
            rels=rels, doc=document_id,
        )
    return len(rels)


def entity_count(document_id: str) -> int:
    rows = run("MATCH (:Document {id: $doc})-[:MENTIONS]->(e) RETURN count(DISTINCT e) AS n", doc=document_id)
    return rows[0]["n"] if rows else 0


def delete_document(document_id: str) -> None:
    run("MATCH ()-[r:REL {doc_id: $doc}]->() DELETE r", doc=document_id)
    run("MATCH (d:Document {id: $doc}) DETACH DELETE d", doc=document_id)
    run("MATCH (e:Entity) WHERE NOT (e)--() DELETE e")


# ─────────────────────────── Reads ───────────────────────────
_NODE = "{id: n.key, name: n.name, type: n.type}"


def subgraph(doc_ids: list[str], center: str | None = None, depth: int = 1, limit: int = 50) -> dict[str, Any]:
    """Visible subgraph. Without a center: the `limit` most-connected entities (progressive disclosure)."""
    if not doc_ids:
        return {"nodes": [], "edges": [], "truncated": False}
    depth = max(1, min(depth, 3))
    if center:
        nodes = run(
            f"""
            MATCH (c:Entity {{key: $center}})
            OPTIONAL MATCH p = (c)-[:REL*1..{depth}]-(m:Entity)
              WHERE all(r IN relationships(p) WHERE r.doc_id IN $docs)
            WITH c, collect(DISTINCT m)[..$limit] AS ns
            UNWIND ns + [c] AS n
            OPTIONAL MATCH (n)-[r:REL]-() WHERE r.doc_id IN $docs
            WITH n, count(r) AS degree
            OPTIONAL MATCH (d:Document)-[:MENTIONS]->(n) WHERE d.id IN $docs
            RETURN n.key AS id, n.name AS name, n.type AS type, degree, collect(DISTINCT d.id) AS document_ids
            """,
            center=center, docs=doc_ids, limit=limit,
        )
    else:
        nodes = run(
            """
            MATCH (n:Entity)-[r:REL]-() WHERE r.doc_id IN $docs
            WITH n, count(r) AS degree ORDER BY degree DESC LIMIT $limit
            OPTIONAL MATCH (d:Document)-[:MENTIONS]->(n) WHERE d.id IN $docs
            RETURN n.key AS id, n.name AS name, n.type AS type, degree, collect(DISTINCT d.id) AS document_ids
            """,
            docs=doc_ids, limit=limit,
        )
    keys = [n["id"] for n in nodes]
    edges = run(
        """
        MATCH (a:Entity)-[r:REL]->(b:Entity)
        WHERE a.key IN $keys AND b.key IN $keys AND r.doc_id IN $docs
        RETURN elementId(r) AS id, a.key AS source, b.key AS target, r.type AS type,
               coalesce(r.conflict, false) AS conflict, r.doc_id AS document_id
        """,
        keys=keys, docs=doc_ids,
    )
    total = run(
        "MATCH (n:Entity)-[r:REL]-() WHERE r.doc_id IN $docs RETURN count(DISTINCT n) AS n", docs=doc_ids
    )
    return {"nodes": nodes, "edges": edges, "truncated": bool(total and total[0]["n"] > len(nodes))}


def find_entities(names: list[str], doc_ids: list[str], limit: int = 8) -> list[dict[str, Any]]:
    """Entities whose name/alias matches any of the given strings (case-insensitive contains)."""
    keys = [normalize(n) for n in names if normalize(n)]
    if not keys or not doc_ids:
        return []
    return run(
        """
        MATCH (d:Document)-[:MENTIONS]->(n:Entity) WHERE d.id IN $docs
        WITH DISTINCT n
        WHERE any(k IN $keys WHERE n.key = k OR n.key CONTAINS k OR k CONTAINS n.key)
        RETURN n.key AS id, n.name AS name, n.type AS type LIMIT $limit
        """,
        keys=keys, docs=doc_ids, limit=limit,
    )


def search_entities(query: str, doc_ids: list[str], limit: int = 10) -> list[dict[str, Any]]:
    q = normalize(query)
    if not q or not doc_ids:
        return []
    return run(
        """
        MATCH (d:Document)-[:MENTIONS]->(n:Entity) WHERE d.id IN $docs AND n.key CONTAINS $q
        WITH n, count(DISTINCT d) AS docs
        RETURN n.key AS id, n.name AS name, n.type AS type, docs
        ORDER BY CASE WHEN n.key STARTS WITH $q THEN 0 ELSE 1 END, docs DESC LIMIT $limit
        """,
        q=q, docs=doc_ids, limit=limit,
    )


def paths_from(entity_keys: list[str], doc_ids: list[str], hops: int = 2, limit: int = 12) -> list[dict[str, Any]]:
    """1–2 hop relation chains starting at the question's entities, with evidence ids."""
    if not entity_keys or not doc_ids:
        return []
    hops = max(1, min(hops, 2))
    return run(
        f"""
        MATCH p = (s:Entity)-[:REL*1..{hops}]-(t:Entity)
        WHERE s.key IN $keys AND all(r IN relationships(p) WHERE r.doc_id IN $docs)
        WITH p LIMIT $limit
        RETURN [n IN nodes(p) | {_NODE}] AS nodes,
               [r IN relationships(p) | {{source: startNode(r).key, target: endNode(r).key, type: r.type,
                                          document_id: r.doc_id, chunk_id: r.chunk_id,
                                          conflict: coalesce(r.conflict, false)}}] AS edges
        """,
        keys=entity_keys, docs=doc_ids, limit=limit,
    )


def entity_detail(key: str, doc_ids: list[str]) -> dict[str, Any] | None:
    rows = run(
        """
        MATCH (n:Entity {key: $key})
        OPTIONAL MATCH (d:Document)-[:MENTIONS]->(n) WHERE d.id IN $docs
        WITH n, collect(DISTINCT {id: d.id, title: d.title}) AS documents
        OPTIONAL MATCH (n)-[r:REL]-(m:Entity) WHERE r.doc_id IN $docs
        RETURN n.key AS id, n.name AS name, n.type AS type, coalesce(n.aliases, []) AS aliases, documents,
               collect(DISTINCT {direction: CASE WHEN startNode(r) = n THEN 'out' ELSE 'in' END,
                                 type: r.type, other_id: m.key, other_name: m.name,
                                 conflict: coalesce(r.conflict, false)})[..50] AS relations
        """,
        key=key, docs=doc_ids,
    )
    if not rows:
        return None
    row = rows[0]
    row["documents"] = [d for d in row["documents"] if d["id"]]
    row["relations"] = [r for r in row["relations"] if r["other_id"]]
    return row
