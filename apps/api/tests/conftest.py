import os
import time

import jwt
import pytest

os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-test-secret-test-secret-123")
os.environ.setdefault("LLM_PROVIDER", "fake")
os.environ.setdefault("WORKER_SECRET", "test-worker-secret")


def make_token(sub: str = "11111111-1111-1111-1111-111111111111", **extra) -> str:
    payload = {"sub": sub, "aud": "authenticated", "role": "authenticated", "exp": int(time.time()) + 600, **extra}
    return jwt.encode(payload, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")


@pytest.fixture
def token() -> str:
    return make_token()


@pytest.fixture
def client(monkeypatch):
    from fastapi.testclient import TestClient

    from app import auth, ratelimit
    from app.main import app

    monkeypatch.setattr(auth, "load_role", lambda uid: "editor")
    monkeypatch.setattr(ratelimit, "check", lambda uid, limit=None: True)
    return TestClient(app)
