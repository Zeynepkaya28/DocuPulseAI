"""Vector-only vs GraphRAG on 20 questions (1–3 hops).

Run from apps/api against the LOCAL stack:
    .venv/Scripts/python -m eval.run_eval [--k 3] [--keep]

Metric — context recall: share of each question's expected facts present in the retrieved context
(passages for vector-only; passages + relation chains for GraphRAG). If an LLM is configured
(LLM_PROVIDER=openai with a key, or ollama) answers are generated too and scored by expected-fact hits.

The corpus is ingested for a throwaway eval user through the real pipeline and removed afterwards.
Results are written to docs/eval-results.md.
"""
from __future__ import annotations

import argparse
import json
import os
import uuid
from pathlib import Path

# Paragraph-sized chunks so each fact lives in its own chunk and multi-hop questions need several.
os.environ.setdefault("CHUNK_MAX_CHARS", "220")

from app import db, graph, queue, rag, storage, workers
from app.config import get_settings
from app.llm import FakeProvider, provider

HERE = Path(__file__).parent
EVAL_USER = "eeeeeeee-0000-0000-0000-00000000e7a1"


def norm(s: str) -> str:
    return graph.normalize(s)


def recall(expected: list[str], text: str) -> float:
    t = norm(text)
    return sum(1 for e in expected if norm(e) in t) / len(expected)


def setup_user() -> None:
    db.execute(
        """insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
             raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
           values ('00000000-0000-0000-0000-000000000000', %s, 'authenticated', 'authenticated',
                   'eval@docupulse.test', '', now(), '{}', '{}', now(), now())
           on conflict (id) do nothing""",
        (EVAL_USER,),
    )


def ingest() -> list[str]:
    ids = []
    for f in sorted((HERE / "corpus").glob("*.md")):
        doc_id = str(uuid.uuid4())
        path = f"{EVAL_USER}/{doc_id}/{f.name}"
        storage.client().post(f"/object/{get_settings().storage_bucket}/{path}", content=f.read_bytes(),
                              headers={"Content-Type": "text/markdown", "x-upsert": "true"}).raise_for_status()
        db.execute("insert into public.documents (id, owner, title, mime, storage_path, status) "
                   "values (%s, %s, %s, 'text/markdown', %s, 'pending')", (doc_id, EVAL_USER, f.stem, path))
        db.execute("update public.documents set status = 'uploaded' where id = %s", (doc_id,))
        ids.append(doc_id)
    for _ in range(30):
        if sum(sum(workers.run_queue(q, budget_s=60).values()) for q in queue.QUEUES) == 0:
            break
    return ids


def cleanup(ids: list[str]) -> None:
    for d in ids:
        graph.delete_document(d)
    paths = [r["storage_path"] for r in db.fetch_all("select storage_path from public.documents where owner = %s", (EVAL_USER,))]
    storage.remove(paths)
    db.execute("delete from auth.users where id = %s", (EVAL_USER,))  # cascades profile, documents, chunks


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=3, help="passages per question (small k makes multi-hop harder)")
    ap.add_argument("--keep", action="store_true", help="keep the eval corpus after the run")
    args = ap.parse_args()

    questions = [json.loads(line) for line in (HERE / "questions.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    gen_answers = not isinstance(provider(), FakeProvider)

    setup_user()
    ids = ingest()
    try:
        rows = []
        for q in questions:
            res = {}
            for mode in ("vector", "graphrag"):
                ctx = rag.retrieve(q["question"], EVAL_USER, mode=mode, k=args.k)
                text = rag.build_context_text(ctx)
                r = {"recall": recall(q["expected"], text), "paths": len(ctx.paths), "conflicts": len(ctx.conflicts)}
                if gen_answers:
                    answer = "".join(provider().stream(rag.build_messages(q["question"], ctx)))
                    r["answer_hit"] = recall(q["expected"][-1:], answer)
                res[mode] = r
            rows.append((q, res))
            print(f"Q{q['id']:>2} hops={q['hops']} vector={res['vector']['recall']:.2f} graphrag={res['graphrag']['recall']:.2f}")
    finally:
        if not args.keep:
            cleanup(ids)

    write_report(rows, args.k, gen_answers)


def write_report(rows, k: int, gen_answers: bool) -> None:
    def avg(mode: str, metric: str, hops: int | None = None) -> str:
        vals = [r[mode][metric] for q, r in rows if (hops is None or q["hops"] == hops) and metric in r[mode]]
        return f"{sum(vals) / len(vals):.2f}" if vals else "—"

    s = get_settings()
    lines = [
        "# GraphRAG Eval Sonuçları",
        "",
        f"20 soru · k={k} pasaj · parça boyutu ≤{s.chunk_max_chars} karakter · sağlayıcı: `{type(provider()).__name__}` · embedding: "
        f"`{s.openai_embed_model if s.llm_provider == 'openai' and s.openai_api_key else 'fake (hashing)'}`",
        "",
        "Metrik: **bağlam hatırlama** = beklenen olguların getirilen bağlamda bulunma oranı.",
        "",
        "| Soru grubu | Yalnız vektör | GraphRAG |",
        "|---|---|---|",
        f"| 1 adım | {avg('vector', 'recall', 1)} | {avg('graphrag', 'recall', 1)} |",
        f"| 2 adım | {avg('vector', 'recall', 2)} | {avg('graphrag', 'recall', 2)} |",
        f"| 3 adım | {avg('vector', 'recall', 3)} | {avg('graphrag', 'recall', 3)} |",
        f"| **Tümü** | **{avg('vector', 'recall')}** | **{avg('graphrag', 'recall')}** |",
    ]
    if gen_answers:
        lines += ["", f"Yanıt isabeti (son beklenen olgu yanıtta): vektör {avg('vector', 'answer_hit')} · "
                  f"GraphRAG {avg('graphrag', 'answer_hit')}"]
    lines += ["", "## Soru bazında", "", "| # | Adım | Soru | Vektör | GraphRAG | Zincir | Çelişki |", "|---|---|---|---|---|---|---|"]
    for q, r in rows:
        lines.append(f"| {q['id']} | {q['hops']} | {q['question']} | {r['vector']['recall']:.2f} | "
                     f"{r['graphrag']['recall']:.2f} | {r['graphrag']['paths']} | {r['graphrag']['conflicts']} |")
    lines += [
        "",
        "Not: Fake sağlayıcı ile varlık çıkarımı büyük harfli ifadelere dayalı kaba bir yaklaşımdır ve ilişki "
        "türleri 'ilişkili' olur. Gerçek sonuçlar için `LLM_PROVIDER=openai` ve `OPENAI_API_KEY` ile yeniden çalıştırın.",
    ]
    out = HERE.parents[2] / "docs" / "eval-results.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
