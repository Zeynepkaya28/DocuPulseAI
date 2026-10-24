from app import auth, db


def test_admin_routes_require_admin(client, token):
    r = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_last_admin_cannot_demote_self(client, monkeypatch, token):
    monkeypatch.setattr(auth, "load_role", lambda uid: "admin")
    monkeypatch.setattr(db, "fetch_one", lambda sql, params=None: {"n": 0})
    executed = []
    monkeypatch.setattr(db, "execute", lambda sql, params=None: executed.append(sql))
    r = client.patch(
        "/admin/users/11111111-1111-1111-1111-111111111111",
        json={"role": "viewer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 409
    assert executed == []


def test_admin_can_change_other_role(client, monkeypatch, token):
    monkeypatch.setattr(auth, "load_role", lambda uid: "admin")
    executed = []
    monkeypatch.setattr(db, "execute", lambda sql, params=None: executed.append(params))
    r = client.patch(
        "/admin/users/22222222-2222-2222-2222-222222222222",
        json={"role": "viewer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert executed == [("viewer", "22222222-2222-2222-2222-222222222222")]


def test_invalid_role_rejected(client, monkeypatch, token):
    monkeypatch.setattr(auth, "load_role", lambda uid: "admin")
    r = client.patch("/admin/users/x", json={"role": "owner"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 422
