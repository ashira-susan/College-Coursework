"""Task model and in-memory task board."""
from dataclasses import dataclass
from typing import List


@dataclass
class Task:
    id: int
    title: str
    done: bool = False


class TaskBoard:
    def __init__(self, tasks=None):
        self._tasks: List[Task] = list(tasks or [])

    def add(self, title: str) -> Task:
        title = title.strip()
        if not title:
            raise ValueError("title must not be empty")
        next_id = max((t.id for t in self._tasks), default=0) + 1
        task = Task(next_id, title)
        self._tasks.append(task)
        return task

    def complete(self, task_id: int) -> Task:
        for task in self._tasks:
            if task.id == task_id:
                task.done = True
                return task
        raise KeyError(f"no task with id {task_id}")

    def list(self, include_done: bool = True) -> List[Task]:
        return [t for t in self._tasks if include_done or not t.done]
