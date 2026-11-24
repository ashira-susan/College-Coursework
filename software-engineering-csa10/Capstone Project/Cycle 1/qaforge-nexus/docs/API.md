# QAForge Nexus REST API (v1.0)

Base: `http://localhost:4000`. JSON in/out. Authenticate with `Authorization: Bearer <token>` from `POST /api/auth/login`.
Errors: `{"error": "message"}` with 400 (validation), 401, 403 (role/membership), 404, 409 (illegal lifecycle transition), 423 (locked), 429 (rate limit).

| Method | Path | Purpose | Roles |
|---|---|---|---|
| GET | /api/health | Liveness | public |
| POST | /api/auth/login | `{email,password}` -> `{token,user}` | public |
| GET | /api/auth/me | Current user | any |
| POST | /api/auth/change-password | `{current_password,new_password}` | any |
| GET | /api/meta, /api/departments, /api/org/summary | Reference data | any |
| GET/POST/PATCH | /api/users, /api/users/:id | Directory / create / edit | list: any; write: admin |
| POST | /api/users/:id/reset-password | Temporary password | admin |
| GET/POST | /api/notifications, /api/notifications/read | In-app alerts | any |
| GET | /api/audit | Audit log | admin, qa_manager |
| GET/POST | /api/projects | List / create | create: admin, qa_manager |
| GET/PATCH | /api/projects/:pid | Project by id or key | members |
| POST/DELETE | /api/projects/:pid/members(/:uid) | Team | admin, qa_manager |
| GET/POST | /api/projects/:pid/requirements | Requirements | write: +qa_engineer, product_owner |
| GET/POST | /api/projects/:pid/suites | Suites | write: qa |
| GET/POST | /api/projects/:pid/testcases | Cases (`?q&suite_id&type&automated&last_status`) | write: qa |
| POST | /api/projects/:pid/testcases/import | Bulk JSON import | qa |
| GET | /api/projects/:pid/testcases.csv | CSV export | members |
| GET/PATCH/DELETE | /api/testcases/:id | Case detail / edit / deprecate | write: qa |
| POST | /api/testcases/:id/execute | Run one case immediately | qa |
| GET/POST | /api/projects/:pid/runs | History / start run `{suite_ids,case_ids,retries,name,environment}` or `{mode:"manual",case_ids}` | start: qa |
| GET | /api/runs/:id | Run + results (+defect links) | members |
| POST | /api/runs/:id/results, /api/runs/:id/complete | Record manual results / finish | qa |
| GET | /api/runs/:id/results.csv | CSV | members |
| GET | /api/defects, /api/projects/:pid/defects | Filtered register | members |
| POST | /api/projects/:pid/defects | Report defect | not viewer |
| GET/PATCH | /api/defects/:id | Detail (history, comments, allowed transitions) / edit | edit: qa |
| POST | /api/defects/:id/transition | `{to, note?, assignee_id?, resolution?, duplicate_of?}` | per lifecycle rules |
| POST | /api/defects/:id/comments | Comment | not viewer |
| POST | /api/defects/:id/retest | Automated retest of a Fixed defect | qa |
| GET | /api/reports/dashboard | Metrics (`?project=`) | any |
| GET | /api/projects/:pid/traceability(.csv) | RTM | members |
| GET/POST | /api/demo/bugs, /api/demo/reset | Demo target controls | admin, qa, developer |

Assertion object: `{"type":"status|body|header|text|time","path":"a.b[0]","op":"eq|neq|contains|not_contains|exists|not_exists|gt|gte|lt|lte|matches|in|type","value":...,"desc":"optional"}`
