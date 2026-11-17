import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
from app import app


def client():
    return app.test_client()


def test_home():
    r = client().get("/")
    assert r.status_code == 200
    assert "Flask API" in r.get_json()["message"]


def test_health():
    r = client().get("/health")
    assert r.status_code == 200 and r.get_json()["status"] == "UP"


def test_list_students():
    r = client().get("/api/students")
    assert r.status_code == 200 and len(r.get_json()) >= 2


def test_add_and_delete_student():
    c = client()
    r = c.post("/api/students", json={"name": "Meena", "department": "IT"})
    assert r.status_code == 201
    sid = r.get_json()["id"]
    assert c.get(f"/api/students/{sid}").status_code == 200
    assert c.delete(f"/api/students/{sid}").status_code == 200
    assert c.get(f"/api/students/{sid}").status_code == 404


def test_validation():
    assert client().post("/api/students", json={"name": "NoDept"}).status_code == 400
