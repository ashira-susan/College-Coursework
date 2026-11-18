"""Experiment 21 - Flask To-Do application (SQLite) containerized with Docker."""
import os
import sqlite3
from flask import Flask, render_template, request, redirect, url_for, jsonify

app = Flask(__name__)
DB_PATH = os.getenv("TODO_DB", "todo.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    with get_db() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS tasks (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   title TEXT NOT NULL,
                   done INTEGER NOT NULL DEFAULT 0,
                   created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"""
        )


@app.route("/")
def index():
    with get_db() as conn:
        tasks = conn.execute("SELECT * FROM tasks ORDER BY done, id DESC").fetchall()
    pending = sum(1 for t in tasks if not t["done"])
    return render_template("index.html", tasks=tasks, pending=pending)


@app.route("/add", methods=["POST"])
def add():
    title = request.form.get("title", "").strip()
    if title:
        with get_db() as conn:
            conn.execute("INSERT INTO tasks (title) VALUES (?)", (title,))
    return redirect(url_for("index"))


@app.route("/toggle/<int:task_id>", methods=["POST"])
def toggle(task_id):
    with get_db() as conn:
        conn.execute("UPDATE tasks SET done = 1 - done WHERE id = ?", (task_id,))
    return redirect(url_for("index"))


@app.route("/delete/<int:task_id>", methods=["POST"])
def delete(task_id):
    with get_db() as conn:
        conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    return redirect(url_for("index"))


@app.route("/api/tasks")
def api_tasks():
    with get_db() as conn:
        rows = conn.execute("SELECT id, title, done FROM tasks ORDER BY id").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/health")
def health():
    return jsonify(status="UP")


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
