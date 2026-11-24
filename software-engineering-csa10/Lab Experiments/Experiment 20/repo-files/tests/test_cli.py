from taskboard.cli import main


def test_add_list_done_flow(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("TASKBOARD_FILE", str(tmp_path / "tasks.json"))
    assert main(["add", "write report"]) == 0
    assert main(["add", "review code"]) == 0
    assert main(["done", "1"]) == 0
    capsys.readouterr()
    assert main(["list"]) == 0
    out = capsys.readouterr().out
    assert "[x] 1  write report" in out
    assert "[ ] 2  review code" in out


def test_unknown_task_returns_error(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("TASKBOARD_FILE", str(tmp_path / "tasks.json"))
    assert main(["done", "5"]) == 1
    assert "Error" in capsys.readouterr().out
