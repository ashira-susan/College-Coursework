"""Test suite for MiniCC.  Run from the backend folder:

    python3 tests/run_tests.py

Each case compiles a snippet with the real Flex/Bison binary and checks the
diagnostics, the generated three-address code and (for valid programs) the
output produced by running that code.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.interpreter import run_quads  # noqa: E402
from app.runner import build_compiler, compile_source  # noqa: E402

EXAMPLES = Path(__file__).resolve().parent.parent / "examples"

# (name, source, expected dict)
#   errors / warnings : exact counts
#   kinds             : set of error kinds that must appear
#   tac               : exact three-address code (list of strings)
#   output            : exact printed lines after running the code
#   contains          : substrings that must appear in some diagnostic message
CASES = [
    ("simple assignment",
     "int a; a = 5;",
     {"errors": 0, "tac": ["a = 5"]}),

    ("operator precedence",
     "int a = 2 + 3 * 4; print(a);",
     {"errors": 0,
      "tac": ["t1 = 3 * 4", "t2 = 2 + t1", "a = t2", "print a"],
      "output": ["14"]}),

    ("parentheses override precedence",
     "int a = (2 + 3) * 4; print(a);",
     {"errors": 0, "output": ["20"]}),

    ("left associativity",
     "print(20 - 5 - 3);",
     {"errors": 0, "tac": ["t1 = 20 - 5", "t2 = t1 - 3", "print t2"], "output": ["12"]}),

    ("unary minus and not",
     "int a = 4; print(-a); print(!a); print(!0);",
     {"errors": 0, "output": ["-4", "0", "1"]}),

    ("integer vs float division",
     "print(7 / 2); print(7 / 2.0); print(-7 / 2);",
     {"errors": 0, "output": ["3", "3.5", "-3"]}),

    ("modulo",
     "print(17 % 5);",
     {"errors": 0, "output": ["2"]}),

    ("relational and logical",
     "print(3 < 5 && 5 <= 5); print(1 == 2 || 2 != 2); print(!(1 > 2));",
     {"errors": 0, "output": ["1", "0", "1"]}),

    ("if without else",
     "int x = 3; if (x > 1) print(1);",
     {"errors": 0,
      "tac": ["x = 3", "t1 = x > 1", "ifFalse t1 goto L1", "print 1", "L1:"],
      "output": ["1"]}),

    ("if / else jumps",
     "int a = 1, b = 2, m; if (a > b) m = a; else m = b; print(m);",
     {"errors": 0,
      "tac": ["a = 1", "b = 2", "t1 = a > b", "ifFalse t1 goto L1", "m = a",
              "goto L2", "L1:", "m = b", "L2:", "print m"],
      "output": ["2"]}),

    ("dangling else binds to nearest if",
     "int x = 3; if (x > 1) if (x > 5) print(1); else print(2);",
     {"errors": 0, "output": ["2"]}),

    ("while loop",
     "int i = 0, s = 0; while (i < 4) { s = s + i; i = i + 1; } print(s);",
     {"errors": 0,
      "tac": ["i = 0", "s = 0", "L1:", "t1 = i < 4", "ifFalse t1 goto L2",
              "t2 = s + i", "s = t2", "t3 = i + 1", "i = t3", "goto L1", "L2:", "print s"],
      "output": ["6"]}),

    ("nested loops and ifs",
     "int i = 1; while (i <= 5) { if (i % 2 == 1) print(i); i = i + 1; }",
     {"errors": 0, "output": ["1", "3", "5"]}),

    ("comments are ignored",
     "// line\nint a = 1; /* block\ncomment */ print(a);",
     {"errors": 0, "output": ["1"]}),

    ("empty program",
     "",
     {"errors": 0, "tac": []}),

    ("float assigned to int truncates and warns",
     "int n = 2.9; print(n);",
     {"errors": 0, "warnings": 1, "output": ["2"]}),

    ("division by zero constant warns",
     "print(1 / 0);",
     {"errors": 0, "warnings": 1}),

    # ---------- lexical errors ----------
    ("invalid character",
     "int a = 5 $ 3;",
     {"kinds": {"lexical"}, "contains": ["Invalid character '$'"]}),

    ("identifier starting with digit",
     "int 2abc = 1;",
     {"kinds": {"lexical"}, "contains": ["cannot start with a digit"]}),

    ("single ampersand",
     "int a = 1 & 2;",
     {"kinds": {"lexical"}, "contains": ["did you mean '&&'"]}),

    ("unterminated comment",
     "int a; /* oops",
     {"errors": 1, "kinds": {"lexical"}, "contains": ["Unterminated comment"]}),

    ("smart quotes",
     "int a = \u201c5\u201d;",
     {"kinds": {"lexical"}, "contains": ["non-ASCII"]}),

    # ---------- syntax errors ----------
    ("missing semicolon",
     "int a = 5\nint b = 6;",
     {"errors": 1, "kinds": {"syntax"}}),

    ("missing closing parenthesis",
     "int a = (1 + 2;",
     {"kinds": {"syntax"}}),

    ("bad if condition recovers at ')'",
     "int a = 1;\nif (a > ) { print(a); }\nprint(a);",
     {"errors": 1, "kinds": {"syntax"}}),

    ("while without parentheses",
     "int a = 1; while a < 3 { a = a + 1; }",
     {"kinds": {"syntax"}}),

    ("unclosed block",
     "int a; { a = 1;",
     {"errors": 1, "contains": ["missing '}'"]}),

    ("stray closing brace",
     "int a = 1; }",
     {"errors": 1, "contains": ["Unmatched '}'"]}),

    ("several syntax errors in one run",
     "int a = ;\nint b = 2 +;\nint c = 3;",
     {"errors": 2, "kinds": {"syntax"}}),

    ("error positions are reported",
     "int a = 1;\nint b = ;",
     {"errors": 1, "at": (2, 9)}),

    # ---------- semantic errors ----------
    ("undeclared variable in expression",
     "int a = b + 1;",
     {"errors": 1, "kinds": {"semantic"}, "contains": ["Undeclared variable 'b'"]}),

    ("undeclared variable in assignment",
     "x = 5;",
     {"errors": 1, "kinds": {"semantic"}}),

    ("redeclaration",
     "int a; int a;",
     {"errors": 1, "kinds": {"semantic"}, "contains": ["already declared"]}),

    ("modulo needs integers",
     "float f = 1.5; print(f % 2);",
     {"errors": 1, "kinds": {"semantic"}}),

    ("no code generated when there are errors",
     "int a = 1; a = ;",
     {"errors": 1, "tac": []}),
]


def check(name: str, source: str, expect: dict) -> list[str]:
    problems: list[str] = []
    report = compile_source(source)
    diags = report["diagnostics"]
    errors = [d for d in diags if d["severity"] == "error"]
    warnings = [d for d in diags if d["severity"] == "warning"]

    if "errors" in expect and len(errors) != expect["errors"]:
        problems.append(f"expected {expect['errors']} errors, got {len(errors)}: {[d['message'] for d in errors]}")
    if "errors" not in expect and "kinds" in expect and not errors:
        problems.append("expected at least one error, got none")
    if "warnings" in expect and len(warnings) != expect["warnings"]:
        problems.append(f"expected {expect['warnings']} warnings, got {len(warnings)}")
    if "kinds" in expect:
        got = {d["kind"] for d in errors}
        missing = expect["kinds"] - got
        if missing:
            problems.append(f"missing error kinds {missing}, got {got}")
    for text in expect.get("contains", []):
        if not any(text in d["message"] for d in diags):
            problems.append(f"no diagnostic contains {text!r}: {[d['message'] for d in diags]}")
    if "at" in expect:
        line, col = expect["at"]
        if not any(d["line"] == line and d["col"] == col for d in errors):
            problems.append(f"no error at {line}:{col}: {[(d['line'], d['col']) for d in errors]}")
    if "tac" in expect and report["tac"] != expect["tac"]:
        problems.append(f"TAC mismatch:\n      got      {report['tac']}\n      expected {expect['tac']}")
    if "output" in expect:
        result = run_quads(report["quads"], report["symbols"])
        if result["output"] != expect["output"] or result["error"]:
            problems.append(f"output {result['output']} (error={result['error']}), expected {expect['output']}")
    return problems


def check_examples() -> list[str]:
    """Valid examples must compile cleanly; error examples must report the right kinds."""
    problems = []
    want = {
        "01_arithmetic": {"errors": 0},
        "02_if_else": {"errors": 0},
        "03_while_loop": {"errors": 0},
        "04_nested_control": {"errors": 0},
        "05_syntax_errors": {"kinds": {"syntax"}},
        "06_lexical_errors": {"kinds": {"lexical"}},
        "07_semantic_errors": {"kinds": {"semantic"}},
    }
    for stem, expect in want.items():
        text = (EXAMPLES / f"{stem}.mc").read_text(encoding="utf-8")
        problems += [f"{stem}: {p}" for p in check(stem, text, expect)]
    return problems


def main() -> int:
    build_compiler()
    failed = 0
    total = 0
    for name, source, expect in CASES:
        total += 1
        problems = check(name, source, expect)
        if problems:
            failed += 1
            print(f"FAIL  {name}")
            for p in problems:
                print(f"      {p}")
        else:
            print(f"ok    {name}")

    ex = check_examples()
    if ex:
        failed += len(ex)
        for p in ex:
            print(f"FAIL  example {p}")
    else:
        print("ok    bundled examples")

    total += 1
    print(f"\n{total - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
