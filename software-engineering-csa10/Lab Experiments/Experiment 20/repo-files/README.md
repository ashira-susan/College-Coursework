# TaskBoard

[![CI](https://github.com/<owner>/<repo>/actions/workflows/ci.yml/badge.svg)](https://github.com/<owner>/<repo>/actions)

A tiny command-line task board built by a three-person team to practise **Git branches, pull requests and README documentation**.

## Features
- Add tasks from the terminal
- Mark tasks as done
- List all tasks (`[x]` done, `[ ]` pending)
- Tasks are stored in a local `tasks.json` file
- Automated tests run on every pull request (GitHub Actions)

## Tech stack
Python 3.9+, `argparse`, `pytest`, GitHub Actions.

## Project structure
```
taskboard/
├── src/taskboard/
│   ├── tasks.py        Task model and TaskBoard logic
│   ├── storage.py      JSON load / save
│   ├── cli.py          command line interface
│   └── __main__.py     python -m taskboard entry point
├── tests/              pytest test suite
├── docs/BRANCHING.md   branching strategy
├── .github/            PR template, issue templates, CI workflow
├── CONTRIBUTING.md     how to contribute
└── LICENSE
```

## Getting started
```bash
git clone https://github.com/<owner>/<repo>.git
cd <repo>
python -m venv .venv && source .venv/bin/activate
pip install pytest
```

## Usage
```bash
$ PYTHONPATH=src python -m taskboard add "Write project report"
Added task 1: Write project report
$ PYTHONPATH=src python -m taskboard add "Review pull requests"
Added task 2: Review pull requests
$ PYTHONPATH=src python -m taskboard done 1
Completed task 1
$ PYTHONPATH=src python -m taskboard list
[x] 1  Write project report
[ ] 2  Review pull requests
```

## Running the tests
```bash
python -m pytest -v
```

## Team
| Member | GitHub | Role | Contribution |
|--------|--------|------|--------------|
| Susan | @<username-1> | Team lead | Repository setup, templates, `feature/task-model` |
| Member Two | @<username-2> | Developer | `feature/cli` (storage + command line) |
| Member Three | @<username-3> | Documentation / DevOps | README, CI workflow (`docs/readme-and-ci`) |

## Collaboration workflow
We use **GitHub Flow**: every change is made on a branch, reviewed in a pull request and merged into the protected `main` branch. Details: [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/BRANCHING.md](docs/BRANCHING.md).

```
issue -> branch -> commits -> push -> pull request -> review -> CI passes -> merge -> delete branch
```

## Roadmap
- [ ] Delete and edit tasks
- [ ] Due dates and priorities
- [ ] Export to CSV

## License
Released under the [MIT License](LICENSE).
