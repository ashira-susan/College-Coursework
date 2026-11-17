import os, sys, tempfile
os.environ["TODO_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
from app import app


def test_empty_list():
    assert app.test_client().get("/api/tasks").get_json() == []


def test_add_toggle_delete():
    c = app.test_client()
    c.post("/add", data={"title": "Learn Docker"})
    tasks = c.get("/api/tasks").get_json()
    assert tasks[0]["title"] == "Learn Docker" and tasks[0]["done"] == 0
    tid = tasks[0]["id"]
    c.post(f"/toggle/{tid}")
    assert c.get("/api/tasks").get_json()[0]["done"] == 1
    c.post(f"/delete/{tid}")
    assert c.get("/api/tasks").get_json() == []


def test_blank_title_ignored():
    c = app.test_client()
    c.post("/add", data={"title": "   "})
    assert c.get("/api/tasks").get_json() == []


def test_home_and_health():
    c = app.test_client()
    assert c.get("/").status_code == 200
    assert c.get("/health").get_json()["status"] == "UP"
