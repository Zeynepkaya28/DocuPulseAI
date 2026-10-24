"""Postgres access. One pool per function instance, reused across invocations (module level).

In production SUPABASE_DB_URL is the Supabase pooler (Supavisor, transaction mode), so prepared
statements are disabled (prepare_threshold=None).
"""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import get_settings

_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            get_settings().supabase_db_url,
            min_size=0,
            max_size=5,
            kwargs={"autocommit": True, "prepare_threshold": None, "row_factory": dict_row},
            open=True,
            timeout=10,
        )
    return _pool


@contextmanager
def conn() -> Iterator[Connection[dict[str, Any]]]:
    with pool().connection() as c:
        yield c


def fetch_all(sql: str, params: dict[str, Any] | tuple | None = None) -> list[dict[str, Any]]:
    with conn() as c:
        return list(c.execute(sql, params).fetchall())


def fetch_one(sql: str, params: dict[str, Any] | tuple | None = None) -> dict[str, Any] | None:
    with conn() as c:
        return c.execute(sql, params).fetchone()


def execute(sql: str, params: dict[str, Any] | tuple | None = None) -> None:
    with conn() as c:
        c.execute(sql, params)
