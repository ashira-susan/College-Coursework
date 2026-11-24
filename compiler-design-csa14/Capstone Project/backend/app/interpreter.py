"""Executes the generated quadruples so students can verify the intermediate code.

This is an extra on top of the three required modules: it proves the three-address
code is correct by running it and showing the output of `print` statements.
"""
from __future__ import annotations

import math

MAX_STEPS = 20_000
MAX_OUTPUT_LINES = 200


def _num(text: str) -> int | float:
    try:
        return int(text)
    except ValueError:
        return float(text)


def _fmt(value: int | float) -> str:
    if isinstance(value, float):
        return format(value, ".10g")
    return str(value)


def run_quads(quads: list[dict], symbols: list[dict]) -> dict:
    types = {s["name"]: s["type"] for s in symbols}
    labels = {q["result"]: q["index"] for q in quads if q["op"] == "label"}
    env: dict[str, int | float] = {name: 0 for name in types}  # uninitialised variables read as 0
    output: list[str] = []

    def val(operand: str) -> int | float:
        if operand in env:
            return env[operand]
        return _num(operand)

    def store(name: str, value: int | float) -> None:
        if types.get(name) == "int" and isinstance(value, float):
            value = int(value)  # truncates toward zero, like C
        env[name] = value

    pc = 0
    steps = 0
    error = None

    while pc < len(quads):
        steps += 1
        if steps > MAX_STEPS:
            error = f"Execution stopped after {MAX_STEPS} steps (possible infinite loop)."
            break

        q = quads[pc]
        op, a1, a2, res = q["op"], q["arg1"], q["arg2"], q["result"]
        pc += 1

        if op == "label":
            continue
        if op == "goto":
            pc = labels[res]
            continue
        if op == "ifFalse":
            if val(a1) == 0:
                pc = labels[res]
            continue
        if op == "print":
            output.append(_fmt(val(a1)))
            if len(output) >= MAX_OUTPUT_LINES:
                error = f"Output limited to {MAX_OUTPUT_LINES} lines."
                break
            continue
        if op == "=":
            store(res, val(a1))
            continue
        if op == "uminus":
            env[res] = -val(a1)
            continue
        if op == "!":
            env[res] = 1 if val(a1) == 0 else 0
            continue

        left, right = val(a1), val(a2)
        if op in ("/", "%") and right == 0:
            error = f"Runtime error: division by zero (instruction {q['index']})."
            break

        if op == "+":
            env[res] = left + right
        elif op == "-":
            env[res] = left - right
        elif op == "*":
            env[res] = left * right
        elif op == "/":
            if isinstance(left, int) and isinstance(right, int):
                env[res] = int(left / right)  # integer division truncates toward zero
            else:
                env[res] = left / right
        elif op == "%":
            env[res] = int(math.fmod(left, right))
        elif op == "<":
            env[res] = int(left < right)
        elif op == ">":
            env[res] = int(left > right)
        elif op == "<=":
            env[res] = int(left <= right)
        elif op == ">=":
            env[res] = int(left >= right)
        elif op == "==":
            env[res] = int(left == right)
        elif op == "!=":
            env[res] = int(left != right)
        elif op == "&&":
            env[res] = int(left != 0 and right != 0)
        elif op == "||":
            env[res] = int(left != 0 or right != 0)

    variables = {name: _fmt(env[name]) for name in types}
    return {"output": output, "variables": variables, "steps": steps, "error": error}
