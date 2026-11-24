# QAForge Nexus

A Web-Based Functional Testing and Software Validation Platform Utilizing Automated Black-Box Test Case Execution and Defect Identification Lifecycles.
Built for an organisation of 100-200 employees (demo seed: Nexora Technologies, 150 employees, 12 departments).

## Run
Requires Node.js 22.13+. No `npm install` needed (zero dependencies).

    npm start        # http://localhost:4000 (auto-seeds on first start)
    npm test         # 13 end-to-end tests
    npm run seed     # reset to full demo data

Demo logins (password `Nexus@123`): admin@, qa.manager@, qa.engineer@, developer@, product.owner@, viewer@ `nexora-tech.example`.
Change these before any real deployment; set `QAF_SECRET` for a fixed token secret, `PORT`, `HOST`, `QAF_DATA_DIR`.

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
| 04_Test_Cases_and_RTM.xlsx | Test cases, demo suite, RTM, defect log, RBAC matrix, summary formulas |
| 05_User_Manual.docx | End-user manual with screenshots |
| 06_Presentation.pptx | 14-slide defence deck |
| API.md, schema.sql | REST reference, database DDL |
| diagrams/*.mmd (+png) | Editable Mermaid sources: architecture, use cases, ER, state, sequence, DFD |
| screenshots/ | UI screenshots |
| tools/ | Python scripts that regenerate every document (`python3 build_report.py`, `build_other.py`, `build_xlsx.py`, `build_pptx.py`) |
