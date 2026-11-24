# MiniCC — Mini Compiler Using LEX and YACC

A mini compiler for a small C-like language, built with **Flex** (LEX) and **Bison** (YACC),
with a **FastAPI** backend and a **React** interface.

| Module | File | What it does |
|---|---|---|
| 1. Lexical analysis | `backend/compiler/lexer.l` | Tokens: keywords, identifiers, constants, operators, separators. Skips whitespace and comments. Reports invalid tokens. |
| 2. Syntax analysis and error detection | `backend/compiler/parser.y` | Grammar for declarations, assignments, expressions, `if`/`else`, `while`, `print`. Reports syntax and semantic errors with line and column, and recovers to find several errors per run. |
| 3. Intermediate code generation | `backend/compiler/parser.y`, `common.c` | Three-address code with temporaries (`t1`, `t2`) and labels / jumps (`L1`, `goto`, `ifFalse`), also as quadruples. |

Extras: symbol table, semantic checks (undeclared / redeclared variables, `%` on floats, division by zero,
float to int narrowing), a small interpreter that runs the generated code, and 7 example programs.

## Quick start (WSL Ubuntu + VS Code)

Keep the project in the Linux filesystem (for example `~/mini-compiler`), not under `/mnt/c`.

```bash
unzip mini-compiler.zip -d ~
cd ~/mini-compiler
code .                       # opens VS Code in WSL

chmod +x scripts/*.sh
./scripts/setup.sh           # installs flex/bison, builds, installs deps, runs tests
./scripts/dev.sh             # starts backend + frontend
```

Open **http://localhost:5173**. Press **Ctrl + Enter** to compile.

## Use the compiler without the web app

```bash
cd backend/compiler
make
./minicc --text ../examples/03_while_loop.mc     # readable report
./minicc < ../examples/01_arithmetic.mc          # JSON report (what the API uses)
```

## Run the tests

```bash
cd backend
.venv/bin/python tests/run_tests.py
```

## Project layout

```
mini-compiler/
├── backend/
│   ├── compiler/        lexer.l  parser.y  common.c  common.h  Makefile
│   ├── app/             main.py (FastAPI)  runner.py  interpreter.py
│   ├── examples/        7 sample programs (valid, lexical, syntax and semantic errors)
│   └── tests/           run_tests.py
├── frontend/            React + Vite (src/App.jsx, components/, styles.css)
├── scripts/             setup.sh  dev.sh
└── docs/PROJECT_NOTES.md   grammar, test plan, report outline, viva questions
```

## The language

```c
// comments: // line   and   /* block */
int a = 12, b = 5;
float avg = (a + b) / 2.0;

if (a > b) { print(a - b); } else { print(b - a); }

int i = 1;
while (i <= 3) { print(i * i); i = i + 1; }
```

Types `int` and `float`; operators `+ - * / %`, `< > <= >= == !=`, `&& || !`; one global scope;
variables must be declared before use. Full grammar: **Language** tab in the app, or `docs/PROJECT_NOTES.md`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `flex: command not found` | `sudo apt install -y flex bison build-essential` |
| Page loads but shows "Cannot reach the backend" | The backend is not running. Use `./scripts/dev.sh` and look for errors in its output. |
| `npm install` is slow or fails | Make sure the project is under `~/`, not `/mnt/c/...`. Node must be 18 or newer. |
| Port already in use | Stop the old process, or change the ports in `scripts/dev.sh` and `frontend/vite.config.js`. |
| Changed `lexer.l` or `parser.y` | Run `make -C backend/compiler`. The backend also rebuilds automatically when it sees newer sources. |
| `Permission denied` on scripts | `chmod +x scripts/*.sh` |
