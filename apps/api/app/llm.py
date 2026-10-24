"""Model provider abstraction.

openai — production (Vercel). ollama — local development only (no local models on Vercel).
fake   — deterministic, offline; used by tests and when no API key is configured.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from collections.abc import Iterator
from functools import lru_cache
from typing import Any, Protocol

import httpx

from .config import get_settings

Message = dict[str, str]


class Provider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...
    def complete_json(self, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]: ...
    def stream(self, messages: list[Message]) -> Iterator[str]: ...


def _fit(vec: list[float], dim: int) -> list[float]:
    """Pad/truncate to the column dimension (vector(1536)). Zero padding keeps cosine similarity intact."""
    return (vec + [0.0] * dim)[:dim]


class OpenAIProvider:
    def __init__(self) -> None:
        from openai import OpenAI

        s = get_settings()
        self.s = s
        self.client = OpenAI(api_key=s.openai_api_key, timeout=60, max_retries=2)

    def embed(self, texts: list[str]) -> list[list[float]]:
        r = self.client.embeddings.create(model=self.s.openai_embed_model, input=texts)
        return [_fit(d.embedding, self.s.embed_dim) for d in r.data]

    def complete_json(self, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]:
        r = self.client.chat.completions.create(
            model=self.s.openai_chat_model,
            temperature=0,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format={"type": "json_schema", "json_schema": {"name": "result", "schema": schema, "strict": True}},
        )
        return json.loads(r.choices[0].message.content or "{}")

    def stream(self, messages: list[Message]) -> Iterator[str]:
        r = self.client.chat.completions.create(
            model=self.s.openai_chat_model, temperature=0.2, messages=messages, stream=True  # type: ignore[arg-type]
        )
        for chunk in r:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class OllamaProvider:
    def __init__(self) -> None:
        self.s = get_settings()
        self.http = httpx.Client(base_url=self.s.ollama_base_url, timeout=120)

    def embed(self, texts: list[str]) -> list[list[float]]:
        r = self.http.post("/api/embed", json={"model": self.s.ollama_embed_model, "input": texts})
        r.raise_for_status()
        return [_fit(v, self.s.embed_dim) for v in r.json()["embeddings"]]

    def complete_json(self, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]:
        r = self.http.post("/api/chat", json={
            "model": self.s.ollama_chat_model, "stream": False, "format": schema, "options": {"temperature": 0},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        })
        r.raise_for_status()
        return json.loads(r.json()["message"]["content"] or "{}")

    def stream(self, messages: list[Message]) -> Iterator[str]:
        with self.http.stream("POST", "/api/chat", json={"model": self.s.ollama_chat_model, "messages": messages}) as r:
            for line in r.iter_lines():
                if line:
                    part = json.loads(line)
                    if part.get("message", {}).get("content"):
                        yield part["message"]["content"]


_WORD = re.compile(r"\w+", re.UNICODE)
_PROPER = re.compile(r"\b([A-ZÇĞİÖŞÜ][\wçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][\wçğıöşü]+)*)")


class FakeProvider:
    """Offline provider: hashing-trick embeddings, capitalised-phrase entities, extractive answers."""

    dim = 1536

    def embed(self, texts: list[str]) -> list[list[float]]:
        out = []
        for t in texts:
            v = [0.0] * self.dim
            for w in _WORD.findall(t.lower()):
                h = int(hashlib.md5(w.encode()).hexdigest(), 16)
                v[h % self.dim] += 1.0 if (h >> 8) % 2 else -1.0
            n = math.sqrt(sum(x * x for x in v)) or 1.0
            out.append([x / n for x in v])
        return out

    def complete_json(self, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]:
        if "entities" not in json.dumps(schema):
            return {}
        entities: dict[str, dict] = {}
        relations = []
        for m in re.finditer(r"\[chunk:([\w-]+)\]\n(.*?)(?=\n\[chunk:|\Z)", user, re.S):
            cid, text = m.group(1), m.group(2)
            names = [n for n in dict.fromkeys(_PROPER.findall(text)) if len(n) > 2][:6]
            for n in names:
                entities.setdefault(n, {"name": n, "type": "concept", "aliases": []})
            for a, b in zip(names, names[1:], strict=False):
                relations.append({"source": a, "target": b, "type": "ilişkili", "evidence_chunk_id": cid})
        return {"entities": list(entities.values()), "relations": relations}

    def stream(self, messages: list[Message]) -> Iterator[str]:
        ctx = messages[-1]["content"]
        lines = [ln for ln in ctx.splitlines() if ln.startswith("[P")][:2]
        answer = "Kaynaklara göre: " + (" ".join(ln.split("] ", 1)[-1][:200] for ln in lines) or "bağlamda yanıt yok.")
        for word in answer.split(" "):
            yield word + " "


@lru_cache
def provider() -> Provider:
    s = get_settings()
    if s.llm_provider == "fake" or (s.llm_provider == "openai" and not s.openai_api_key):
        return FakeProvider()
    if s.llm_provider == "ollama":
        return OllamaProvider()
    return OpenAIProvider()
