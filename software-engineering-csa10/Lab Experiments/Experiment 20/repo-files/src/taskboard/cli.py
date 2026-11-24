"""Command line interface:  python -m taskboard add|list|done"""
import argparse

from . import storage


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="taskboard", description="Tiny team task board")
    sub = parser.add_subparsers(dest="command", required=True)
    p_add = sub.add_parser("add", help="add a task")
    p_add.add_argument("title")
    sub.add_parser("list", help="list tasks")
    p_done = sub.add_parser("done", help="mark a task as done")
    p_done.add_argument("id", type=int)
    args = parser.parse_args(argv)

    board = storage.load()
    try:
        if args.command == "add":
            task = board.add(args.title)
            print(f"Added task {task.id}: {task.title}")
        elif args.command == "done":
            task = board.complete(args.id)
            print(f"Completed task {task.id}")
        else:
            for task in board.list():
                print(f"[{'x' if task.done else ' '}] {task.id}  {task.title}")
    except (KeyError, ValueError) as exc:
        print(f"Error: {exc.args[0]}")
        return 1
    storage.save(board)
    return 0
