import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
from app import app


def test_home():
    r = app.test_client().get("/")
    assert r.status_code == 200
    assert "CI/CD" in r.get_json()["message"]


def test_health():
    r = app.test_client().get("/health")
    assert r.status_code == 200 and r.get_json() == {"status": "UP"}


def test_add():
    assert app.test_client().get("/add/2/3").get_json()["result"] == 5
