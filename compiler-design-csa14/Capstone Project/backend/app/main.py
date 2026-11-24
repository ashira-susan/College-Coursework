"""FastAPI server for the MiniCC web app.

Endpoints
  GET  /api/health    compiler status and tool versions
  GET  /api/examples  bundled example programs
  POST /api/compile   compile source code; optionally run the generated code
"""
from __future__ import annotations

import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import runner
from .interpreter import run_quads

EXAMPLES_DIR = Path(__file__).resolve().parent.parent / "examples"

@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        runner.build_compiler()
    except runner.CompilerUnavailable as exc:
        print(f"[warning] {exc}")
    yield


app = FastAPI(title="MiniCC API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CompileRequest(BaseModel):
    source: str
    run: bool = True


@app.get("/api/health")
def health() -> dict:
    try:
        runner.build_compiler()
        ready, problem = True, None
    except runner.CompilerUnavailable as exc:
        ready, problem = False, str(exc)
    return {"status": "ok" if ready else "degraded", "compilerReady": ready,
            "problem": problem, "tools": runner.tool_versions()}


@app.get("/api/examples")
def examples() -> list[dict]:
    items = []
    for path in sorted(EXAMPLES_DIR.glob("*.mc")):
        title = re.sub(r"^\d+_", "", path.stem).replace("_", " ").capitalize()
        items.append({"id": path.stem, "title": title, "source": path.read_text(encoding="utf-8")})
    return items


@app.post("/api/compile")
def compile_program(req: CompileRequest) -> dict:
    try:
        report = runner.compile_source(req.source)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except runner.CompilerUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    report["execution"] = None
    if req.run and report["codeGenerated"] and report["quads"]:
        report["execution"] = run_quads(report["quads"], report["symbols"])
    return report
