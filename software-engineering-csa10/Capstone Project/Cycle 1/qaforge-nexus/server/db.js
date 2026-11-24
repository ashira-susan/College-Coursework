'use strict';
/**
 * QAForge Nexus - database layer (Node built-in SQLite, zero dependencies).
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.QAF_DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = process.env.QAF_DB || path.join(DATA_DIR, 'qaforge.db');

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

const clean = (p) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
const cache = new Map();
function stmt(sql) {
  let s = cache.get(sql);
  if (!s) { s = db.prepare(sql); cache.set(sql, s); }
  return s;
}
const all = (sql, ...p) => stmt(sql).all(...clean(p)).map((r) => ({ ...r }));
const get = (sql, ...p) => { const r = stmt(sql).get(...clean(p)); return r ? { ...r } : undefined; };
const run = (sql, ...p) => stmt(sql).run(...clean(p));

let depth = 0;
function tx(fn) {
  if (depth > 0) return fn(); // re-entrant
  db.exec('BEGIN IMMEDIATE');
  depth++;
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) { /* ignore */ }
    throw e;
  } finally { depth--; }
}

const now = () => new Date().toISOString();

function nextCode(projectId, kind, prefix, pad = 4) {
  const row = get(
    `INSERT INTO counters(project_id, kind, value) VALUES(?, ?, 1)
     ON CONFLICT(project_id, kind) DO UPDATE SET value = value + 1 RETURNING value`,
    projectId, kind
  );
  return `${prefix}-${String(row.value).padStart(pad, '0')}`;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS departments(
  id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, emp_code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','qa_manager','qa_engineer','developer','product_owner','viewer')),
  department_id INTEGER REFERENCES departments(id), designation TEXT,
  active INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_logins INTEGER NOT NULL DEFAULT 0, locked_until TEXT, last_login TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects(
  id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT,
  base_url TEXT, owner_id INTEGER REFERENCES users(id), status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_members(
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY(project_id, user_id)
);
CREATE TABLE IF NOT EXISTS counters(
  project_id INTEGER NOT NULL, kind TEXT NOT NULL, value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(project_id, kind)
);
CREATE TABLE IF NOT EXISTS requirements(
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
  priority TEXT NOT NULL DEFAULT 'P2', status TEXT NOT NULL DEFAULT 'approved',
  created_by INTEGER, created_at TEXT NOT NULL, UNIQUE(project_id, code)
);
CREATE TABLE IF NOT EXISTS suites(
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS test_cases(
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id INTEGER REFERENCES suites(id), requirement_id INTEGER REFERENCES requirements(id),
  code TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
  type TEXT NOT NULL DEFAULT 'functional', priority TEXT NOT NULL DEFAULT 'P2',
  preconditions TEXT, steps_text TEXT, expected_text TEXT,
  method TEXT, endpoint TEXT, headers TEXT, body TEXT, assertions TEXT, extract TEXT,
  timeout_ms INTEGER NOT NULL DEFAULT 10000,
  automated INTEGER NOT NULL DEFAULT 0, is_setup INTEGER NOT NULL DEFAULT 0,
  depends_on_previous INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready', sort_order INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(project_id, code)
);
CREATE TABLE IF NOT EXISTS test_runs(
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL, name TEXT NOT NULL, environment TEXT, trigger_type TEXT NOT NULL DEFAULT 'automated',
  status TEXT NOT NULL DEFAULT 'queued', started_by INTEGER, started_at TEXT NOT NULL, finished_at TEXT,
  total INTEGER NOT NULL DEFAULT 0, passed INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0,
  errored INTEGER NOT NULL DEFAULT 0, blocked INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0,
  flaky INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER NOT NULL DEFAULT 0, retries INTEGER NOT NULL DEFAULT 0,
  notes TEXT, UNIQUE(project_id, code)
);
CREATE TABLE IF NOT EXISTS test_results(
  id INTEGER PRIMARY KEY, run_id INTEGER NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id),
  status TEXT NOT NULL CHECK(status IN ('passed','failed','error','blocked','skipped')),
  prereq INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 1, flaky INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0, request_snapshot TEXT, response_status INTEGER,
  response_excerpt TEXT, failure_reason TEXT, assertion_log TEXT, defect_id INTEGER,
  executed_by INTEGER, executed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS defects(
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
  severity TEXT NOT NULL DEFAULT 'Medium', priority TEXT NOT NULL DEFAULT 'P3',
  status TEXT NOT NULL DEFAULT 'New', type TEXT NOT NULL DEFAULT 'functional',
  source TEXT NOT NULL DEFAULT 'manual', test_case_id INTEGER REFERENCES test_cases(id),
  run_id INTEGER REFERENCES test_runs(id), requirement_id INTEGER REFERENCES requirements(id),
  reporter_id INTEGER REFERENCES users(id), assignee_id INTEGER REFERENCES users(id),
  steps TEXT, expected TEXT, actual TEXT, evidence TEXT, environment TEXT,
  occurrences INTEGER NOT NULL DEFAULT 1, reopen_count INTEGER NOT NULL DEFAULT 0,
  duplicate_of INTEGER REFERENCES defects(id), resolution TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT, closed_at TEXT, sla_due TEXT,
  UNIQUE(project_id, code)
);
CREATE TABLE IF NOT EXISTS defect_history(
  id INTEGER PRIMARY KEY, defect_id INTEGER NOT NULL REFERENCES defects(id) ON DELETE CASCADE,
  actor_id INTEGER, action TEXT NOT NULL, from_status TEXT, to_status TEXT, note TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS defect_comments(
  id INTEGER PRIMARY KEY, defect_id INTEGER NOT NULL REFERENCES defects(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log(
  id INTEGER PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL, entity TEXT, entity_id TEXT,
  detail TEXT, ip TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, message TEXT NOT NULL, link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tc_project ON test_cases(project_id, suite_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_res_run ON test_results(run_id);
CREATE INDEX IF NOT EXISTS ix_res_tc ON test_results(test_case_id, executed_at);
CREATE INDEX IF NOT EXISTS ix_def_project ON defects(project_id, status);
CREATE INDEX IF NOT EXISTS ix_def_tc ON defects(test_case_id);
CREATE INDEX IF NOT EXISTS ix_def_assignee ON defects(assignee_id, status);
CREATE INDEX IF NOT EXISTS ix_hist_def ON defect_history(defect_id);
CREATE INDEX IF NOT EXISTS ix_runs_project ON test_runs(project_id, started_at);
CREATE INDEX IF NOT EXISTS ix_notif_user ON notifications(user_id, is_read);
`;

function initSchema() { db.exec(SCHEMA); }

module.exports = { db, all, get, run, tx, now, nextCode, initSchema, DB_FILE, DATA_DIR };
