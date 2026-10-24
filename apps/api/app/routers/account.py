"""Account & admin settings (Faz A6)."""
from __future__ import annotations

from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from .. import db, graph, storage
from ..auth import User, current_user, require_admin
from ..config import get_settings

router = APIRouter(tags=["account"])


@router.get("/me/settings")
def my_settings(user: User = Depends(current_user)) -> dict[str, Any]:
    s = get_settings()
    usage = db.fetch_one(
        """select count(*)::int as documents, coalesce(sum(size_bytes), 0)::bigint as bytes,
                  (select count(*)::int from public.chunks c join public.documents d on d.id = c.document_id
                    where d.owner = %(u)s) as chunks
           from public.documents where owner = %(u)s and status <> 'canceled'""",
        {"u": user.id},
    )
    profile = db.fetch_one("select display_name, email from public.profiles where id = %s", (user.id,)) or {}
    return {
        "id": user.id,
        "email": profile.get("email") or user.email,
        "display_name": profile.get("display_name"),
        "role": user.role,
        "llm_provider": s.llm_provider if (s.llm_provider != "openai" or s.openai_api_key) else "fake",
        "openai_configured": bool(s.openai_api_key),
        "usage": usage,
        "storage_limit_bytes": 1024 * 1024 * 1024,
    }


class ProfilePatch(BaseModel):
    display_name: str


@router.patch("/me")
def update_me(body: ProfilePatch, user: User = Depends(current_user)) -> dict[str, str]:
    name = body.display_name.strip()[:80]
    db.execute("update public.profiles set display_name = %s where id = %s", (name, user.id))
    return {"display_name": name}


@router.get("/admin/users")
def list_users(_: User = Depends(require_admin)) -> list[dict[str, Any]]:
    return db.fetch_all(
        """select p.id::text, coalesce(p.display_name, p.email) as name, p.email, p.role,
                  u.last_sign_in_at::text as last_sign_in_at
           from public.profiles p join auth.users u on u.id = p.id
           order by p.created_at"""
    )


class RolePatch(BaseModel):
    role: Literal["admin", "editor", "viewer"]


@router.patch("/admin/users/{user_id}")
def set_role(user_id: str, body: RolePatch, admin: User = Depends(require_admin)) -> dict[str, str]:
    if user_id == admin.id and body.role != "admin":
        others = db.fetch_one("select count(*)::int as n from public.profiles where role = 'admin' and id <> %s", (admin.id,))
        if not others or others["n"] == 0:
            raise HTTPException(status.HTTP_409_CONFLICT, "Son yönetici kendi rolünü düşüremez")
    db.execute("update public.profiles set role = %s where id = %s", (body.role, user_id))
    return {"id": user_id, "role": body.role}


def _owned_documents(user_id: str) -> list[dict[str, Any]]:
    return db.fetch_all("select id::text, storage_path from public.documents where owner = %s", (user_id,))


@router.post("/me/graph/reset")
def reset_graph(user: User = Depends(current_user)) -> dict[str, int]:
    """Removes the user's graph data. Documents and passages stay; extraction can be re-run with retry."""
    docs = _owned_documents(user.id)
    for d in docs:
        graph.delete_document(d["id"])
    db.execute(
        "update public.chunks set extracted_at = null, graph_at = null where document_id in "
        "(select id from public.documents where owner = %s)",
        (user.id,),
    )
    db.execute("update public.documents set entity_count = 0 where owner = %s", (user.id,))
    return {"documents": len(docs)}


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(user: User = Depends(current_user)):
    s = get_settings()
    docs = _owned_documents(user.id)
    for d in docs:
        graph.delete_document(d["id"])
    storage.remove([d["storage_path"] for d in docs if d["storage_path"]])
    r = httpx.delete(
        f"{s.supabase_url}/auth/v1/admin/users/{user.id}",
        headers={"Authorization": f"Bearer {s.supabase_service_role_key}", "apikey": s.supabase_service_role_key},
        timeout=15,
    )
    if r.status_code not in (200, 204, 404):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Hesap silinemedi; lütfen tekrar deneyin")
    # auth.users delete cascades to profiles → documents → chunks/jobs/chat.
