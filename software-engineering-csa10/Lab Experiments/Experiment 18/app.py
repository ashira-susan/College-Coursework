"""Small Flask app used for the CI/CD experiments."""
import os
import socket
from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/")
def home():
    return jsonify(
        message="Hello from the CI/CD pipeline!",
        version=os.getenv("APP_VERSION", "dev"),
        container=socket.gethostname(),
    )


@app.route("/health")
def health():
    return jsonify(status="UP"), 200


@app.route("/add/<int:a>/<int:b>")
def add(a, b):
    return jsonify(result=a + b)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
