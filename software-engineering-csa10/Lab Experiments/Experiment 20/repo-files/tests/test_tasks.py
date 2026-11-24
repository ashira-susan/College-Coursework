import pytest
from taskboard.tasks import TaskBoard


def test_add_assigns_incrementing_ids():
    board = TaskBoard()
    assert board.add("write report").id == 1
    assert board.add("review code").id == 2


def test_add_rejects_empty_title():
    with pytest.raises(ValueError):
        TaskBoard().add("   ")


def test_complete_marks_task_done():
    board = TaskBoard()
    task = board.add("write report")
    board.complete(task.id)
    assert board.list()[0].done is True


def test_complete_unknown_id_raises():
    with pytest.raises(KeyError):
        TaskBoard().complete(99)


def test_list_can_hide_done_tasks():
    board = TaskBoard()
    board.add("a"); b = board.add("b"); board.complete(b.id)
    assert [t.title for t in board.list(include_done=False)] == ["a"]
