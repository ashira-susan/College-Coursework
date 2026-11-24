# QAForge Nexus

A Web-Based Functional Testing and Software Validation Platform Utilizing Automated Black-Box Test Case Execution and Defect Identification Lifecycles.
Built for an organisation of 100-200 employees (demo seed: Nexora Technologies, 150 employees, 12 departments).

## Data
The platform ships loaded with a **public dataset: Defects4J** (github.com/rjust/defects4j, MIT) - 168 real bugs from Commons Lang (61), Commons CLI (39), Commons CSV (16), JFreeChart (26) and Joda-Time (26). Each bug is a defect with its upstream report link and revisions; each trigger test is a test case (369) linked to a requirement. Plus the SHOP demo project (35 black-box cases, 11 switchable faults).
Citation: Just, Jalali, Ernst, *Defects4J: A Database of Existing Faults to Enable Controlled Testing Studies for Java Programs*, ISSTA 2014.
**Disclosure:** employees, assignees/workflow progress and run history are simulated. Defect titles are derived from report id, class and exception (upstream JIRA text could not be downloaded); 18 JFreeChart bugs have no upstream report; several bugs share one report.

## Run
Requires Node.js 22.13+ and PostgreSQL 14+ (16 tested). No `npm install` needed (zero dependencies; the PostgreSQL wire-protocol client is in `server/pgclient.js` and mirrors the `pg` API).

    docker compose up -d      # or scripts/start-local-postgres.sh (user/password/db: qaforge)
    export DATABASE_URL=postgres://qaforge:qaforge@127.0.0.1:5432/qaforge
    npm start                 # http://localhost:4000 (creates schema, auto-seeds on first start)
    npm test                  # 31 tests (13 platform + 9 dataset + 9 v3 algorithm); needs CREATE DATABASE rights
    npm run seed              # reset to full data (org + SHOP + Defects4J)
    npm run seed:minimal      # org and projects only
    npm run dataset:extract   # regenerate server/datasets/defects4j-subset.json

Demo logins (password `Nexus@123`): admin@, qa.manager@, qa.engineer@, developer@, product.owner@, viewer@ `nexora-tech.example`.
Change these before any real deployment; set `QAF_SECRET` for a fixed token secret, `PORT`, `HOST`, `DATABASE_URL`.

## 5-minute demo
1. Sign in as qa.manager -> Projects -> SHOP -> Test runs -> "Run automated tests".
2. See 10 failures become 10 auto-assigned defects. Run again: no duplicates.
3. Demo Lab -> "Deploy fix" (all) -> as the assigned developer move a defect to In Progress -> Fixed.
4. As QA open the defect -> "Automated retest" -> Verified -> Close.
5. Demo Lab -> "Revert fix" -> re-run: the closed defect is Reopened.

## Deliverables (`docs/`)
| File | Content |
|---|---|
| 01_Project_Report.docx | Full project report (analysis, design, implementation, testing, results) |
| 02_SRS.docx | IEEE 830 software requirements specification |
| 03_Test_Plan_and_Report.docx | Test plan, execution summary, defects found |
| 04_Test_Cases_and_RTM.xlsx | Test cases, demo suite, 369 dataset cases, RTM, defect log, RBAC matrix, summary formulas |
| 05_User_Manual.docx | End-user manual with screenshots |
| 06_Presentation.pptx | 14-slide defence deck |
| API.md, schema.sql | REST reference, PostgreSQL DDL |
| diagrams/*.mmd (+png) | Editable Mermaid sources: architecture, use cases, ER, state, sequence, DFD |
| screenshots/ | UI screenshots |
| tools/ | Python scripts that regenerate every document (`python3 build_report.py`, `build_other.py`, `build_xlsx.py`, `build_pptx.py`) |


## v3.0 - accuracy and data-handling enhancements
Compared with v2.0 (see `docs/07_Performance_and_Algorithm_Report.docx` for method, complexity analysis and measured results):
- **Duplicate detection** (`server/similarity.js`): TF-IDF cosine over title, modified classes, trigger tests and failure text; inverted-index candidates (MinHash-LSH and exhaustive modes available via `?mode=lsh|brute`); union-find clusters. `GET /api/defects/:id/similar`, `GET /api/projects/:pid/duplicates?threshold=0.6`. Auto-created defects get an advisory "possible duplicate" history note.
- **Risk-based test ordering** (`server/prioritize.js`): `GET /api/projects/:pid/prioritized-cases` (EWMA failure rate, flip rate, open-defect severity, priority; APFD evaluation in `bench/accuracy.js`).
- **Search**: case-insensitive trigram-indexed match first; typo-tolerant ranked fallback when nothing matches (needs the `pg_trgm` extension, created automatically; falls back to ILIKE if unavailable).
- **Data access**: set-based traceability (3 queries instead of 2 per requirement), SQL-aggregated dashboard flow, 8 new indexes, keyset pagination (`?cursor=` / `next_cursor`).
- **Benchmarks**: `bench/run-version.sh`, `bench/accuracy.js`, `bench/make_charts.py`; raw results in `docs/perf/`. The v2.0 baseline is a copy of the previous release (only change: configurable rate limit).
