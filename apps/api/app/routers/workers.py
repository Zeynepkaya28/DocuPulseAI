"""Internal worker endpoints, called every minute by Supabase Cron (pg_cron + pg_net)."""
from __future__ import annotations

import hmac

from fastapi import APIRouter, Header, HTTPException, status

from .. import workers
from ..config import get_settings

router = APIRouter(prefix="/internal/workers", tags=["internal"], include_in_schema=False)


@router.post("/{queue_name}")
def run_worker(queue_name: str, x_worker_secret: str = Header(default="")) -> dict[str, int]:
    if not hmac.compare_digest(x_worker_secret, get_settings().worker_secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid worker secret")
    if queue_name not in workers.HANDLERS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown queue")
    return workers.run_queue(queue_name)
