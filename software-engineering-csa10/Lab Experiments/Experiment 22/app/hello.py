"""Experiment 22 - tiny app used to demonstrate push/pull with Docker Hub."""
import os
import platform
import socket
from datetime import datetime, timezone

print("=" * 44)
print(" Hello from a container pulled from Docker Hub!")
print("=" * 44)
print(f"Container hostname : {socket.gethostname()}")
print(f"Python version     : {platform.python_version()}")
print(f"OS / architecture  : {platform.system()} {platform.machine()}")
print(f"Image version      : {os.getenv('IMAGE_VERSION', 'dev')}")
print(f"Time (UTC)         : {datetime.now(timezone.utc):%Y-%m-%d %H:%M:%S}")
