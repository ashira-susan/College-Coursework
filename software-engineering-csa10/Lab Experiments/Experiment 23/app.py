"""Experiment 23 - Backend API (Flask) talking to PostgreSQL.

If DB_HOST is not set (local tests) it falls back to SQLite so the tests can run anywhere.
"""
import os
import socket
import time
from flask import Flask, jsonify, request

app = Flask(__name__)

DB_HOST = os.getenv("DB_HOST")

if DB_HOST:
    import psycopg2
    PH = "%s"

    def get_conn():
        return psycopg2.connect(
            host=DB_HOST,
            port=os.getenv("DB_PORT", "5432"),
            dbname=os.getenv("DB_NAME", "appdb"),
            user=os.getenv("DB_USER", "appuser"),
            password=os.getenv("DB_PASSWORD", "apppass"),
            connect_timeout=3,
        )
    ID_COL = "SERIAL PRIMARY KEY"
else:
    import sqlite3
    PH = "?"

    def get_conn():
        return sqlite3.connect(os.getenv("SQLITE_PATH", "/tmp/messages.db"))
    ID_COL = "INTEGER PRIMARY KEY AUTOINCREMENT"

_ready = False


def ensure_table(retries=1, delay=2):
    """Create the table once. Retries while the database is still starting."""
    global _ready
    if _ready:
        return
    last = None
    for _ in range(retries):
        try:
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(
                f"CREATE TABLE IF NOT EXISTS messages ("
                f"id {ID_COL}, text TEXT NOT NULL, served_by TEXT NOT NULL)"
            )
            conn.commit()
            conn.close()
            _ready = True
            return
        except Exception as exc:          # database not ready yet
            last = exc
            time.sleep(delay)
    raise last


@app.route("/api/health")
def health():
    """Liveness: the process is up (does not touch the database)."""
    return jsonify(status="UP")


@app.route("/api/ready")
def ready():
    """Readiness: the database is reachable."""
    try:
        ensure_table()
        return jsonify(status="READY", database="postgres" if DB_HOST else "sqlite")
    except Exception as exc:
        return jsonify(status="NOT_READY", error=str(exc)), 503


@app.route("/api/info")
def info():
    """Shows WHICH pod answered - used to demonstrate scaling / load balancing."""
    return jsonify(pod=socket.gethostname(), database="postgres" if DB_HOST else "sqlite")


@app.route("/api/messages", methods=["GET"])
def list_messages():
    ensure_table(retries=5)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, text, served_by FROM messages ORDER BY id DESC LIMIT 20")
    rows = [{"id": r[0], "text": r[1], "served_by": r[2]} for r in cur.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route("/api/messages", methods=["POST"])
def add_message():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify(error="text is required"), 400
    ensure_table(retries=5)
    pod = socket.gethostname()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"INSERT INTO messages (text, served_by) VALUES ({PH}, {PH})", (text, pod))
    conn.commit()
    conn.close()
    return jsonify(text=text, served_by=pod), 201


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
