"""Runs the Flex/Bison-built `minicc` binary and returns its JSON report."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

COMPILER_DIR = Path(__file__).resolve().parent.parent / "compiler"
BINARY = COMPILER_DIR / "minicc"

MAX_SOURCE_BYTES = 50_000
TIMEOUT_SECONDS = 5


class CompilerUnavailable(RuntimeError):
    """The minicc binary is missing and could not be built."""


def _sources_newer_than_binary() -> bool:
    if not BINARY.exists():
        return True
    built = BINARY.stat().st_mtime
    return any(
        (COMPILER_DIR / name).stat().st_mtime > built
        for name in ("lexer.l", "parser.y", "common.c", "common.h")
    )


def build_compiler() -> None:
    """(Re)build minicc with make if the binary is missing or out of date."""
    if not _sources_newer_than_binary():
        return
    if shutil.which("make") is None or shutil.which("flex") is None or shutil.which("bison") is None:
        raise CompilerUnavailable(
            "flex, bison or make is not installed. Run: "
            "sudo apt install -y flex bison build-essential"
        )
    result = subprocess.run(
        ["make", "-C", str(COMPILER_DIR)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0 or not BINARY.exists():
        raise CompilerUnavailable("Building the compiler failed:\n" + result.stderr[-2000:])


def tool_versions() -> dict[str, str | None]:
    def first_line(cmd: list[str]) -> str | None:
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=5).stdout
            return out.splitlines()[0].strip() if out else None
        except (OSError, subprocess.SubprocessError):
            return None

    return {"flex": first_line(["flex", "--version"]), "bison": first_line(["bison", "--version"])}


def compile_source(source: str) -> dict:
    """Compile `source` and return the parsed JSON report from minicc."""
    if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise ValueError(f"Source is too large (limit {MAX_SOURCE_BYTES // 1000} KB).")

    build_compiler()

    try:
        proc = subprocess.run(
            [str(BINARY)],
            input=source.encode("utf-8"),
            capture_output=True,
            timeout=TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("The compiler took too long and was stopped.") from exc

    if proc.returncode != 0:
        raise RuntimeError(f"Compiler crashed (exit code {proc.returncode}).")

    # Invalid UTF-8 can only come from odd bytes echoed in error messages.
    return json.loads(proc.stdout.decode("utf-8", errors="replace"))
