import pytest
from fastapi import HTTPException

from app import auth, db, storage
from app.contracts import UploadUrlRequest
from app.routers import documents
from tests.conftest import make_token


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_requires_bearer(client):
    assert client.get("/me").status_code == 401


def test_rejects_bad_signature(client):
    import jwt

    bad = jwt.encode({"sub": "x", "aud": "authenticated"}, "wrong-secret-wrong-secret-wrong-123", algorithm="HS256")
    assert client.get("/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_rejects_expired(client):
    expired = make_token(exp=1)
    assert client.get("/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_me_reads_role_from_profiles(client, token):
    r = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["role"] == "editor"


def test_viewer_cannot_upload(client, monkeypatch, token):
    monkeypatch.setattr(auth, "load_role", lambda uid: "viewer")
    body = {"filename": "a.pdf", "mime": "application/pdf", "size_bytes": 10}
    r = client.post("/documents/upload-url", json=body, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


@pytest.mark.parametrize(
    "filename,size,code",
    [("x.exe", 10, 422), ("x.pdf", 0, 422), ("x.pdf", 60 * 1024 * 1024, 413)],
)
def test_upload_validation(filename, size, code):
    with pytest.raises(HTTPException) as e:
        documents.validate_upload(UploadUrlRequest(filename=filename, mime="", size_bytes=size))
    assert e.value.status_code == code


def test_upload_mime_is_canonical():
    req = UploadUrlRequest(filename="Notlar.MD", mime="application/octet-stream", size_bytes=5)
    assert documents.validate_upload(req) == "text/markdown"


def test_safe_filename():
    assert documents.safe_filename("../../etc/passwd") == "passwd"
    assert documents.safe_filename("Yıllık Rapor 2024 (v3).pdf") == "Yıllık_Rapor_2024_v3_.pdf"


def test_upload_url_creates_pending_doc(client, monkeypatch, token):
    calls = []
    monkeypatch.setattr(db, "execute", lambda sql, params=None: calls.append(params))
    monkeypatch.setattr(storage, "create_signed_upload_url", lambda path: (f"https://s/{path}?token=t", "t"))
    body = {"filename": "Rapor.pdf", "mime": "application/pdf", "size_bytes": 2048}
    r = client.post("/documents/upload-url", json=body, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["storage_path"].startswith("11111111-1111-1111-1111-111111111111/")
    assert data["storage_path"].endswith("/Rapor.pdf")
    assert calls and calls[0][-1] == data["storage_path"]


def test_openapi_schema_lists_routes(client):
    paths = client.get("/openapi.json").json()["paths"]
    for p in ("/documents/upload-url", "/documents/{doc_id}/complete", "/documents", "/graph"):
        assert p in paths
