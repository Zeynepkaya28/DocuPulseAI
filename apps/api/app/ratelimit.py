"""Per-user rate limit: Upstash Redis REST when configured, else a Postgres per-minute counter."""
from __future__ import annotations

import time

import httpx
from fastapi import Depends, HTTPException, status

from . import db
from .auth import User, current_user
from .config import get_settings


def _upstash_hit(user_id: str, limit: int) -> bool:
    s = get_settings()
    window = int(time.time() // 60)
    key = f"rl:{user_id}:{window}"
    r = httpx.post(
        f"{s.upstash_redis_rest_url}/pipeline",
        headers={"Authorization": f"Bearer {s.upstash_redis_rest_token}"},
        json=[["INCR", key], ["EXPIRE", key, "120"]],
        timeout=3,
    )
    r.raise_for_status()
    return int(r.json()[0]["result"]) <= limit


def _postgres_hit(user_id: str, limit: int) -> bool:
    row = db.fetch_one("select public.hit_rate_limit(%s, %s) as ok", (user_id, limit))
    return bool(row and row["ok"])


def check(user_id: str, limit: int | None = None) -> bool:
    s = get_settings()
    limit = limit or s.rate_limit_per_minute
    if s.upstash_redis_rest_url and s.upstash_redis_rest_token:
        try:
            return _upstash_hit(user_id, limit)
        except httpx.HTTPError:
            pass  # fall back rather than block users when Redis is down
    return _postgres_hit(user_id, limit)


def rate_limited(user: User = Depends(current_user)) -> User:
    if not check(user.id):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Çok fazla istek. Bir dakika sonra tekrar deneyin.")
    return user
