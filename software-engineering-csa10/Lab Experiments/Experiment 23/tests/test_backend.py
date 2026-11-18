import os, sys, tempfile
os.environ.pop("DB_HOST", None)                       # use the SQLite fallback
os.environ["SQLITE_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app import app


def test_health():
    assert app.test_client().get("/api/health").get_json()["status"] == "UP"


def test_ready_and_info():
    c = app.test_client()
    assert c.get("/api/ready").get_json()["status"] == "READY"
    assert "pod" in c.get("/api/info").get_json()


def test_add_and_list_messages():
    c = app.test_client()
    assert c.get("/api/messages").get_json() == []
    r = c.post("/api/messages", json={"text": "hello k8s"})
    assert r.status_code == 201
    rows = c.get("/api/messages").get_json()
    assert rows[0]["text"] == "hello k8s" and rows[0]["served_by"]


def test_empty_text_rejected():
    assert app.test_client().post("/api/messages", json={"text": " "}).status_code == 400
