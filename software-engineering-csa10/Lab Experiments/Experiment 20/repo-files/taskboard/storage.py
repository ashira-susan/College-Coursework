"""Save and load the task board as JSON."""
import json
import os

from .tasks import Task, TaskBoard


def data_file() -> str:
    return os.environ.get("TASKBOARD_FILE", "tasks.json")


def load() -> TaskBoard:
    path = data_file()
    if not os.path.exists(path):
        return TaskBoard()
    with open(path) as fh:
        return TaskBoard([Task(**item) for item in json.load(fh)])


def save(board: TaskBoard) -> None:
    with open(data_file(), "w") as fh:
        json.dump([t.__dict__ for t in board.list()], fh, indent=2)
