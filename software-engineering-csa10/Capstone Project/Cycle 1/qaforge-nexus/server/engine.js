'use strict';
/**
 * Automated black-box test case execution engine.
 *
 * Each test case is an HTTP request against the system under test (SUT) plus a list of
 * assertions on status, body (JSON path), raw text, headers and response time. Values can be
 * captured with `extract` and re-used in later cases as {{variables}} (e.g. login token).
 * The engine knows nothing about the SUT's source code - only its externally visible behaviour.
 */
const { performance } = require('node:perf_hooks');
const { all, get, run, tx, now, nextCode } = require('./db');
const { pj } = require('./util');
const { autoDefectFromResult } = require('./lifecycle');
const { HttpError } = require('./lib/http');

const OPS = ['eq', 'neq', 'contains', 'not_contains', 'exists', 'not_exists', 'gt', 'gte', 'lt', 'lte', 'matches', 'in', 'type'];
const ASSERT_TYPES = ['status', 'body', 'text', 'header', 'time'];
const BLOCKED_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal', 'metadata.azure.com', '100.100.100.200']);
const MAX_PARALLEL_RUNS = 4;
let activeRuns = 0;

/* ---------------- JSON path ---------------- */
function getJsonPath(obj, p) {
  if (p == null || p === '' || p === '$') return obj;
  const toks = [];
  String(p).replace(/^\$/, '').replace(/([^.\[\]]+)|\[(\d+)\]/g, (_, name, idx) => { toks.push(name !== undefined ? name : Number(idx)); return ''; });
  let cur = obj;
  for (const t of toks) {
    if (cur == null) return undefined;
    if (t === 'length' && (Array.isArray(cur) || typeof cur === 'string')) { cur = cur.length; continue; }
    if (typeof t === 'number') { if (!Array.isArray(cur)) return undefined; cur = cur[t]; continue; }
    if (typeof cur !== 'object') return undefined;
    cur = Object.prototype.hasOwnProperty.call(cur, t) ? cur[t] : undefined;
  }
  return cur;
}

/* ---------------- assertions ---------------- */
const numLike = (v) => (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));
function looseEq(a, b) {
  if (a === b) return true;
  if (numLike(a) && numLike(b)) return Math.abs(Number(a) - Number(b)) < 1e-9;
  if (a && b && typeof a === 'object' && typeof b === 'object') { try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; } }
  return String(a) === String(b) && a != null && b != null;
}
function typeOf(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; }

function compare(op, actual, expected) {
  switch (op) {
    case 'eq': return looseEq(actual, expected);
    case 'neq': return !looseEq(actual, expected);
    case 'contains':
      if (Array.isArray(actual)) return actual.some((x) => looseEq(x, expected));
      return actual != null && String(actual).includes(String(expected));
    case 'not_contains':
      if (Array.isArray(actual)) return !actual.some((x) => looseEq(x, expected));
      return actual == null || !String(actual).includes(String(expected));
    case 'exists': return actual !== undefined && actual !== null;
    case 'not_exists': return actual === undefined || actual === null;
    case 'gt': return numLike(actual) && Number(actual) > Number(expected);
    case 'gte': return numLike(actual) && Number(actual) >= Number(expected);
    case 'lt': return numLike(actual) && Number(actual) < Number(expected);
    case 'lte': return numLike(actual) && Number(actual) <= Number(expected);
    case 'matches': {
      const pat = String(expected);
      if (pat.length > 200) return false;
      try { return new RegExp(pat).test(String(actual)); } catch { return false; }
    }
    case 'in': return Array.isArray(expected) && expected.some((x) => looseEq(actual, x));
    case 'type': return typeOf(actual) === expected;
    default: return false;
  }
}

function describe(a) {
  const target = a.type === 'status' ? 'status' : a.type === 'time' ? 'response time (ms)'
    : a.type === 'header' ? `header ${a.path}` : a.type === 'text' ? 'response text' : `body ${a.path || '$'}`;
  const val = ['exists', 'not_exists'].includes(a.op) ? '' : ` ${JSON.stringify(a.value)}`;
  return a.desc || `${target} ${a.op}${val}`;
}

function evalAssertion(a, ctx) {
  let actual;
  switch (a.type) {
    case 'status': actual = ctx.status; break;
    case 'time': actual = Math.round(ctx.ms); break;
    case 'header': actual = ctx.headers[String(a.path || '').toLowerCase()]; break;
    case 'text': actual = ctx.text; break;
    default: actual = getJsonPath(ctx.json, a.path);
  }
  return { ok: compare(a.op, actual, a.value), desc: describe(a), actual };
}

/* ---------------- redaction ---------------- */
function redactBody(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/("(?:password|new_password|current_password|secret)"\s*:\s*)"[^"]*"/gi, '$1"***"')
    .replace(/("(?:token|access_token|refresh_token|api_key)"\s*:\s*)"[^"]*"/gi, '$1"***"');
}
function redactHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) out[k] = /^(authorization|cookie|x-api-key)$/i.test(k) ? String(v).replace(/^(\w+\s+).+$/, '$1***') : v;
  return out;
}

/* ---------------- URL handling ---------------- */
function resolveBase(project) {
  const b = (project.base_url || '').trim();
  if (b.startsWith('/')) return `${process.env.QAF_SELF_URL || `http://127.0.0.1:${process.env.PORT || 4000}`}${b}`;
  return b;
}
function buildUrl(base, endpoint) {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${String(base).replace(/\/+$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
}
function guardUrl(u) {
  let parsed;
  try { parsed = new URL(u); } catch { throw new Error(`Invalid URL: ${u}`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http and https targets are allowed');
  if (BLOCKED_HOSTS.has(parsed.hostname.toLowerCase()) || /^169\.254\./.test(parsed.hostname)) throw new Error('Target host is blocked by policy');
  return parsed;
}

/* ---------------- single case ---------------- */
async function executeCase(baseUrl, tc, vars) {
  const t0 = performance.now();
  const base = { durationMs: 0, requestSnapshot: null, responseStatus: null, responseExcerpt: null, assertionLog: [], failureReason: null };
  const local = { ...vars, timestamp: String(Date.now()), random: Math.random().toString(36).slice(2, 8) };
  const missing = new Set();
  const interp = (s) => (typeof s !== 'string' ? s : s.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => {
    if (k in local) return String(local[k]);
    missing.add(k); return m;
  }));

  const method = (tc.method || 'GET').toUpperCase();
  const endpoint = interp(tc.endpoint || '/');
  const headers = {};
  for (const [k, v] of Object.entries(pj(tc.headers, {}) || {})) headers[k] = interp(String(v));
  let body = tc.body ? interp(tc.body) : null;
  let assertions = (pj(tc.assertions, []) || []).map((a) => (typeof a.value === 'string' ? { ...a, value: interp(a.value) } : a));
  if (missing.size) {
    return { ...base, status: 'blocked', failureReason: `Depends on variable(s) not produced by an earlier step: ${[...missing].join(', ')}` };
  }
  let url;
  try { url = buildUrl(baseUrl, endpoint); guardUrl(url); } catch (e) {
    return { ...base, status: 'error', failureReason: e.message };
  }
  if (body && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = /^\s*[\[{]/.test(body) ? 'application/json' : 'text/plain';
  }
  const snapshot = { method, url, headers: redactHeaders(headers), body: redactBody(body) };

  const ctrl = new AbortController();
  const timeout = Math.min(Math.max(Number(tc.timeout_ms) || 10000, 500), 60000);
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res; let text = '';
  try {
    res = await fetch(url, {
      method, headers, redirect: 'manual', signal: ctrl.signal,
      body: ['GET', 'HEAD'].includes(method) ? undefined : body || undefined,
    });
    text = (await res.text()).slice(0, 1024 * 1024);
  } catch (e) {
    clearTimeout(timer);
    const aborted = e && (e.name === 'AbortError' || /aborted/i.test(String(e.message)));
    const cause = e && e.cause && (e.cause.code || e.cause.message);
    return {
      ...base, status: 'error', durationMs: performance.now() - t0, requestSnapshot: snapshot,
      failureReason: aborted ? `Timed out after ${timeout} ms` : `Could not reach target: ${cause || e.message}`,
    };
  }
  clearTimeout(timer);
  const ms = performance.now() - t0;

  const resHeaders = {};
  res.headers.forEach((v, k) => { resHeaders[k.toLowerCase()] = v; });
  let json;
  if (/json/i.test(resHeaders['content-type'] || '') || /^\s*[\[{]/.test(text)) { try { json = JSON.parse(text); } catch { json = undefined; } }

  const ctx = { status: res.status, ms, headers: resHeaders, text, json };
  if (!assertions.length) assertions = [{ type: 'status', op: 'in', value: [200, 201, 202, 204], desc: 'status is 2xx' }];
  const log = assertions.map((a) => evalAssertion(a, ctx));

  for (const ex of pj(tc.extract, []) || []) {
    if (!ex || !ex.var) continue;
    const v = ex.from === 'header' ? resHeaders[String(ex.path || '').toLowerCase()] : getJsonPath(json, ex.path);
    if (v !== undefined && v !== null) vars[ex.var] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  }

  const ok = log.every((l) => l.ok);
  return {
    status: ok ? 'passed' : 'failed', durationMs: ms, requestSnapshot: snapshot,
    responseStatus: res.status, responseExcerpt: redactBody(text.slice(0, 1500)), assertionLog: log,
    failureReason: ok ? null : `${log.filter((l) => !l.ok).length} of ${log.length} assertion(s) failed`,
  };
}

/* ---------------- planning ---------------- */
function orderedCases(projectId) {
  return all(
    `SELECT tc.*, COALESCE(s.sort_order, 0) AS suite_order
       FROM test_cases tc LEFT JOIN suites s ON s.id = tc.suite_id
      WHERE tc.project_id = ? AND tc.automated = 1 AND tc.status = 'ready'
      ORDER BY COALESCE(s.sort_order, 0), tc.suite_id, tc.sort_order, tc.id`, projectId);
}

/** Selected cases + the prerequisite (setup / chained) cases they rely on, in execution order. */
function buildPlan(cases, selectedIds) {
  const sel = new Set(selectedIds);
  const idx = new Map(cases.map((c, i) => [c.id, i]));
  const include = new Set();
  for (const tc of cases) {
    if (!sel.has(tc.id)) continue;
    include.add(tc.id);
    for (const c of cases) if (c.is_setup && idx.get(c.id) < idx.get(tc.id)) include.add(c.id);
    if (tc.depends_on_previous) {
      const inSuite = cases.filter((c) => c.suite_id === tc.suite_id);
      let j = inSuite.findIndex((c) => c.id === tc.id) - 1;
      while (j >= 0) { include.add(inSuite[j].id); if (!inSuite[j].depends_on_previous) break; j--; }
    }
  }
  return cases.filter((c) => include.has(c.id)).map((c) => ({ tc: c, prereq: !sel.has(c.id) }));
}

function recalcRun(runId) {
  const r = all(`SELECT status, flaky FROM test_results WHERE run_id = ? AND prereq = 0`, runId);
  const count = (s) => r.filter((x) => x.status === s).length;
  const dur = get('SELECT COALESCE(SUM(duration_ms),0) AS d FROM test_results WHERE run_id = ?', runId).d;
  run(`UPDATE test_runs SET passed=?, failed=?, errored=?, blocked=?, flaky=?, duration_ms=? WHERE id=?`,
    count('passed'), count('failed'), count('error'), count('blocked'), r.filter((x) => x.flaky).length, Math.round(dur), runId);
}

function insertResult(runId, tc, r, { prereq = false, attempts = 1, flaky = false, defectId = null, userId = null, at } = {}) {
  const res = run(
    `INSERT INTO test_results(run_id, test_case_id, status, prereq, attempts, flaky, duration_ms, request_snapshot,
       response_status, response_excerpt, failure_reason, assertion_log, defect_id, executed_by, executed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    runId, tc.id, r.status, prereq ? 1 : 0, attempts, flaky ? 1 : 0, Math.round(r.durationMs || 0),
    r.requestSnapshot ? JSON.stringify(r.requestSnapshot) : null, r.responseStatus, r.responseExcerpt,
    r.failureReason, JSON.stringify(r.assertionLog || []), defectId, userId, at || now());
  return Number(res.lastInsertRowid);
}

/** Executes a planned run. Awaitable; startRun() fires it in the background. */
async function executeRun(runId, project, plan, { retries = 0, userId = null } = {}) {
  activeRuns++;
  const started = Date.now();
  const vars = { baseUrl: resolveBase(project) };
  try {
    run(`UPDATE test_runs SET status = 'running' WHERE id = ?`, runId);
    const runRow = get('SELECT * FROM test_runs WHERE id = ?', runId);
    for (const { tc, prereq } of plan) {
      let attempts = 0; let r;
      do {
        attempts++;
        r = await executeCase(resolveBase(project), tc, vars);
        if (r.status === 'passed' || r.status === 'blocked') break;
      } while (attempts <= retries);
      const flaky = r.status === 'passed' && attempts > 1;
      let defectId = null; let defectAction = null;
      if (r.status === 'failed' && !prereq) {
        const out = autoDefectFromResult({ project, tc, run: runRow, result: r, actorId: userId });
        defectId = out.defect.id; defectAction = out.action;
      }
      const resultId = insertResult(runId, tc, r, { prereq, attempts, flaky, defectId, userId });
      if (defectAction) run('UPDATE test_results SET failure_reason = COALESCE(failure_reason, \'\') || ? WHERE id = ?', ` | defect ${defectAction}`, resultId);
      recalcRun(runId);
    }
    const t = get('SELECT passed, failed, errored, blocked FROM test_runs WHERE id = ?', runId);
    const total = plan.filter((p) => !p.prereq).length;
    run(`UPDATE test_runs SET status='completed', finished_at=?, total=?, skipped=?, duration_ms=? WHERE id=?`,
      now(), total, Math.max(total - (t.passed + t.failed + t.errored + t.blocked), 0), Date.now() - started, runId);
  } catch (e) {
    console.error('[engine] run aborted', e);
    run(`UPDATE test_runs SET status='aborted', finished_at=?, notes=? WHERE id=?`, now(), String(e.message).slice(0, 500), runId);
  } finally { activeRuns--; }
}

function createRunRow(project, userId, { name, environment, trigger, retries, total, status = 'queued' }) {
  const code = nextCode(project.id, 'run', 'RUN');
  const r = run(
    `INSERT INTO test_runs(project_id, code, name, environment, trigger_type, status, started_by, started_at, total, retries)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    project.id, code, name, environment || null, trigger, status, userId, now(), total, retries || 0);
  return get('SELECT * FROM test_runs WHERE id = ?', Number(r.lastInsertRowid));
}

function startRun(project, userId, opts = {}) {
  if (activeRuns >= MAX_PARALLEL_RUNS) throw new HttpError(429, 'Too many test runs are executing right now - try again shortly');
  if (!project.base_url) throw new HttpError(400, 'Set a base URL for this project before running automated tests');
  const cases = orderedCases(project.id);
  let selected = cases.map((c) => c.id);
  if (opts.suiteIds && opts.suiteIds.length) selected = cases.filter((c) => opts.suiteIds.includes(c.suite_id)).map((c) => c.id);
  if (opts.caseIds && opts.caseIds.length) selected = cases.filter((c) => opts.caseIds.includes(c.id)).map((c) => c.id);
  if (!selected.length) throw new HttpError(400, 'No automated, ready test cases match the selection');
  const plan = buildPlan(cases, selected);
  const retries = Math.min(Math.max(parseInt(opts.retries, 10) || 0, 0), 3);
  const runRow = createRunRow(project, userId, {
    name: opts.name || `Automated run ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    environment: opts.environment, trigger: opts.trigger || 'automated', retries, total: selected.length,
  });
  const done = executeRun(runRow.id, project, plan, { retries, userId });
  if (opts.wait) return done.then(() => get('SELECT * FROM test_runs WHERE id = ?', runRow.id));
  done.catch((e) => console.error(e));
  return runRow;
}

module.exports = {
  OPS, ASSERT_TYPES, getJsonPath, compare, executeCase, orderedCases, buildPlan, startRun, executeRun,
  createRunRow, insertResult, recalcRun, resolveBase,
};
