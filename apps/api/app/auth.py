"""Supabase JWT verification. We never mint our own tokens.

Supports both legacy HS256 projects (SUPABASE_JWT_SECRET) and asymmetric signing keys (JWKS).
The role comes from public.profiles, not from the token.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

import jwt
from fastapi import Depends, HTTPException, Request, status

from . import db
from .config import get_settings

Role = Literal["admin", "editor", "viewer"]


@dataclass(frozen=True)
class User:
    id: str
    email: str | None
    role: Role

    @property
    def can_write(self) -> bool:
        return self.role in ("admin", "editor")


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{get_settings().supabase_url}/auth/v1/.well-known/jwks.json", cache_keys=True)


def verify_token(token: str) -> dict:
    settings = get_settings()
    try:
        alg = jwt.get_unverified_header(token).get("alg", "HS256")
        if alg == "HS256":
            key: object = settings.supabase_jwt_secret
        else:
            key = _jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(token, key, algorithms=[alg], audience="authenticated")
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Oturum geçersiz veya süresi dolmuş") from exc


def load_role(user_id: str) -> Role:
    row = db.fetch_one("select role from public.profiles where id = %s", (user_id,))
    return (row or {}).get("role", "viewer")  # type: ignore[return-value]


def current_user(request: Request) -> User:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Giriş gerekli")
    claims = verify_token(header[7:])
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Oturum geçersiz")
    return User(id=user_id, email=claims.get("email"), role=load_role(user_id))


def require_writer(user: User = Depends(current_user)) -> User:
    if not user.can_write:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu işlem için yazma yetkisi gerekli")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu işlem için yönetici yetkisi gerekli")
    return user
