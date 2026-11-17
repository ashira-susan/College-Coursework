"""Experiment 17 - Simple Flask REST API (student records) for Docker + Kubernetes."""
import os
import socket
from flask import Flask, jsonify, request

app = Flask(__name__)

# in-memory store (fine for the lab; each pod keeps its own copy)
students = [
    {"id": 1, "name": "Asha", "department": "AI & Data Science"},
    {"id": 2, "name": "Ravi", "department": "Computer Science"},
]


@app.route("/")
def home():
    return jsonify(
        message="Flask API running in Docker / Kubernetes",
        version=os.getenv("APP_VERSION", "1.0"),
        served_by=socket.gethostname(),   # pod / container name
    )


@app.route("/health")
def health():
    return jsonify(status="UP"), 200


@app.route("/api/students", methods=["GET"])
def list_students():
    return jsonify(students)


@app.route("/api/students/<int:sid>", methods=["GET"])
def get_student(sid):
    for s in students:
        if s["id"] == sid:
            return jsonify(s)
    return jsonify(error="student not found"), 404


@app.route("/api/students", methods=["POST"])
def add_student():
    data = request.get_json(silent=True) or {}
    if "name" not in data or "department" not in data:
        return jsonify(error="name and department are required"), 400
    new_id = max((s["id"] for s in students), default=0) + 1
    student = {"id": new_id, "name": data["name"], "department": data["department"]}
    students.append(student)
    return jsonify(student), 201


@app.route("/api/students/<int:sid>", methods=["DELETE"])
def delete_student(sid):
    for s in students:
        if s["id"] == sid:
            students.remove(s)
            return jsonify(message="deleted"), 200
    return jsonify(error="student not found"), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
