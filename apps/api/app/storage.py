"""Supabase Storage via its REST API (service role, server-side only)."""
from __future__ import annotations

from urllib.parse import quote

import httpx

from .config import get_settings

_client: httpx.Client | None = None


def client() -> httpx.Client:
    global _client
    if _client is None:
        s = get_settings()
        _client = httpx.Client(
            base_url=f"{s.supabase_url}/storage/v1",
            headers={"Authorization": f"Bearer {s.supabase_service_role_key}", "apikey": s.supabase_service_role_key},
            timeout=60,
        )
    return _client


def create_signed_upload_url(path: str) -> tuple[str, str]:
    """Returns (absolute signed URL, token). The browser PUTs the file there directly — not through Vercel."""
    s = get_settings()
    r = client().post(f"/object/upload/sign/{s.storage_bucket}/{quote(path)}")
    r.raise_for_status()
    rel = r.json()["url"]  # "/object/upload/sign/<bucket>/<path>?token=..."
    token = rel.split("token=", 1)[1] if "token=" in rel else ""
    return f"{s.supabase_url}/storage/v1{rel}", token


def object_exists(path: str) -> bool:
    s = get_settings()
    r = client().head(f"/object/{s.storage_bucket}/{quote(path)}")
    return r.status_code == 200


def download(path: str) -> bytes:
    s = get_settings()
    r = client().get(f"/object/{s.storage_bucket}/{quote(path)}")
    r.raise_for_status()
    return r.content


def remove(paths: list[str]) -> None:
    if not paths:
        return
    s = get_settings()
    r = client().request("DELETE", f"/object/{s.storage_bucket}", json={"prefixes": paths})
    if r.status_code not in (200, 404):
        r.raise_for_status()
