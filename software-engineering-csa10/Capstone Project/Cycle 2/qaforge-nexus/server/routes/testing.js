'use strict';
/** Test cases, test execution (automated black-box + manual) and run results. */
const { all, get, run, tx, now, nextCode } = require('../db');
const { HttpError } = require('../lib/http');
const A = require('../auth');
const { audit, needStr, optStr, oneOf, toInt, pj, toCsv } = require('../util');
const E = require('../engine');
const L = require('../lifecycle');

const auth = A.requireAuth;
const guard = A.projectGuard;
const TYPES = ['functional', 'smoke', 'regression', 'negative', 'boundary', 'security', 'performance', 'integration', 'usability'];
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];
const OPEN_SQL = L.OPEN.map((s) => `'${s}'`).join(',');

function validateAssertions(list) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > 30) throw new HttpError(400, 'assertions must be an array (max 30)');
  return list.map((a, i) => {
    if (!a || typeof a !== 'object') throw new HttpError(400, `assertion #${i + 1} is invalid`);
    const type = oneOf(a.type, `assertion #${i + 1} type`, E.ASSERT_TYPES);
    const op = oneOf(a.op, `assertion #${i + 1} op`, E.OPS);
    if ((type === 'body' || type === 'header') && !String(a.path || '').trim()) throw new HttpError(400, `assertion #${i + 1} needs a path`);
    if (!['exists', 'not_exists'].includes(op) && a.value === undefined) throw new HttpError(400, `assertion #${i + 1} needs a value`);
    if (op === 'in' && !Array.isArray(a.value)) throw new HttpError(400, `assertion #${i + 1}: "in" needs an array value`);
    return { type, op, path: a.path ? String(a.path).slice(0, 200) : undefined, value: a.value, desc: a.desc ? String(a.desc).slice(0, 200) : undefined };
  });
}
function validateExtract(list) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > 10) throw new HttpError(400, 'extract must be an array (max 10)');
  return list.map((x, i) => {
    if (!x || !/^[A-Za-z_]\w{0,40}$/.test(String(x.var || ''))) throw new HttpError(400, `extract #${i + 1}: var must be an identifier`);
    return { var: x.var, path: String(x.path || '').slice(0, 200), from: x.from === 'header' ? 'header' : 'body' };
  });
}

/** Validates the body of a create/update call and returns column values. */
async function parseCase(b, project, existing = {}) {
  const has = (k) => b[k] !== undefined;
  const out = {};
  out.title = has('title') || !existing.id ? needStr(b.title, 'title', { max: 250 }) : existing.title;
  out.type = has('type') ? oneOf(b.type, 'type', TYPES) : existing.type || 'functional';
  out.priority = has('priority') ? oneOf(b.priority, 'priority', ['P1', 'P2', 'P3', 'P4']) : existing.priority || 'P2';
  out.status = has('status') ? oneOf(b.status, 'status', ['draft', 'ready', 'deprecated']) : existing.status || 'ready';
  for (const k of ['description', 'preconditions', 'steps_text', 'expected_text']) out[k] = has(k) ? optStr(b[k], k) : existing[k] ?? null;
  const suite = has('suite_id') ? toInt(b.suite_id, 'suite_id') : existing.suite_id ?? null;
  if (suite && !await get('SELECT 1 AS x FROM suites WHERE id = ? AND project_id = ?', suite, project.id)) throw new HttpError(400, 'suite does not belong to this project');
  out.suite_id = suite;
  const reqId = has('requirement_id') ? toInt(b.requirement_id, 'requirement_id') : existing.requirement_id ?? null;
  if (reqId && !await get('SELECT 1 AS x FROM requirements WHERE id = ? AND project_id = ?', reqId, project.id)) throw new HttpError(400, 'requirement does not belong to this project');
  out.requirement_id = reqId;
  out.automated = has('automated') ? (b.automated ? 1 : 0) : existing.automated || 0;
  out.is_setup = has('is_setup') ? (b.is_setup ? 1 : 0) : existing.is_setup || 0;
  out.depends_on_previous = has('depends_on_previous') ? (b.depends_on_previous ? 1 : 0) : existing.depends_on_previous || 0;
  out.timeout_ms = has('timeout_ms') ? toInt(b.timeout_ms, 'timeout_ms', { min: 500, max: 60000 }) || 10000 : existing.timeout_ms || 10000;

  const methodSrc = has('method') ? b.method : existing.method;
  out.method = methodSrc ? oneOf(String(methodSrc).toUpperCase(), 'method', METHODS) : null;
  out.endpoint = has('endpoint') ? optStr(b.endpoint, 'endpoint', 500) : existing.endpoint ?? null;
  const headers = has('headers') ? b.headers : pj(existing.headers, {});
  if (headers != null && (typeof headers !== 'object' || Array.isArray(headers))) throw new HttpError(400, 'headers must be an object');
  out.headers = headers && Object.keys(headers).length ? JSON.stringify(headers) : null;
  let body = has('body') ? b.body : existing.body;
  if (body != null && typeof body === 'object') body = JSON.stringify(body);
  out.body = body == null || body === '' ? null : String(body).slice(0, 20000);
  out.assertions = JSON.stringify(has('assertions') ? validateAssertions(b.assertions) : pj(existing.assertions, []));
  out.extract = JSON.stringify(has('extract') ? validateExtract(b.extract) : pj(existing.extract, []));
  if (out.automated) {
    if (!out.method || !out.endpoint) throw new HttpError(400, 'Automated test cases need an HTTP method and endpoint');
    if (!pj(out.assertions, []).length) throw new HttpError(400, 'Automated test cases need at least one assertion');
  }
  return out;
}

async function insertCase(project, user, c) {
  const code = await nextCode(project.id, 'testcase', 'TC');
  const order = (await get('SELECT COALESCE(MAX(sort_order),0) + 1 AS n FROM test_cases WHERE project_id = ?', project.id)).n;
  const t = now();
  const r = await run(
    `INSERT INTO test_cases(project_id, suite_id, requirement_id, code, title, description, type, priority, preconditions,
       steps_text, expected_text, method, endpoint, headers, body, assertions, extract, timeout_ms, automated, is_setup,
       depends_on_previous, status, sort_order, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    project.id, c.suite_id, c.requirement_id, code, c.title, c.description, c.type, c.priority, c.preconditions,
    c.steps_text, c.expected_text, c.method, c.endpoint, c.headers, c.body, c.assertions, c.extract, c.timeout_ms,
    c.automated, c.is_setup, c.depends_on_previous, c.status, order, user.id, t, t);
  return { id: Number(r.lastInsertRowid), code };
}

const hydrate = (tc) => ({ ...tc, headers: pj(tc.headers, {}), assertions: pj(tc.assertions, []), extract: pj(tc.extract, []) });

async function loadCase(req) {
  const tc = await get('SELECT * FROM test_cases WHERE id = ?', Number(req.params.id));
  if (!tc) throw new HttpError(404, 'Test case not found');
  if (!await A.projectAccess(req.user, tc.project_id)) throw new HttpError(403, 'You are not a member of this project');
  req.tc = tc; req.project = await get('SELECT * FROM projects WHERE id = ?', tc.project_id);
}
async function loadRun(req) {
  const r = await get('SELECT * FROM test_runs WHERE id = ?', Number(req.params.id));
  if (!r) throw new HttpError(404, 'Test run not found');
  if (!await A.projectAccess(req.user, r.project_id)) throw new HttpError(403, 'You are not a member of this project');
  req.run = r; req.project = await get('SELECT * FROM projects WHERE id = ?', r.project_id);
}

module.exports = function (app) {
  /* ---------------- test cases ---------------- */
  app.get('/api/projects/:pid/testcases', auth, guard, async (req, res) => {
    const where = ['tc.project_id = ?']; const args = [req.project.id];
    const q = req.query;
    if (q.suite_id) { where.push('tc.suite_id = ?'); args.push(Number(q.suite_id)); }
    if (q.requirement_id) { where.push('tc.requirement_id = ?'); args.push(Number(q.requirement_id)); }
    if (q.type && TYPES.includes(q.type)) { where.push('tc.type = ?'); args.push(q.type); }
    if (q.priority) { where.push('tc.priority = ?'); args.push(q.priority); }
    if (q.automated === '0' || q.automated === '1') { where.push('tc.automated = ?'); args.push(Number(q.automated)); }
    if (q.status) { where.push('tc.status = ?'); args.push(q.status); } else where.push(`tc.status != 'deprecated'`);
    if (q.q) { where.push('(tc.title LIKE ? OR tc.code LIKE ?)'); const s = `%${String(q.q).slice(0, 60)}%`; args.push(s, s); }
    let items = await all(
      `SELECT tc.id, tc.code, tc.title, tc.type, tc.priority, tc.status, tc.automated, tc.is_setup, tc.suite_id, tc.requirement_id,
              tc.method, tc.endpoint, s.name AS suite_name, r.code AS requirement_code,
              (SELECT tr.status FROM test_results tr WHERE tr.test_case_id = tc.id AND tr.prereq = 0 ORDER BY tr.executed_at DESC, tr.id DESC LIMIT 1) AS last_status,
              (SELECT COUNT(*) FROM defects d WHERE d.test_case_id = tc.id AND d.status IN (${OPEN_SQL})) AS open_defects
         FROM test_cases tc LEFT JOIN suites s ON s.id = tc.suite_id LEFT JOIN requirements r ON r.id = tc.requirement_id
        WHERE ${where.join(' AND ')} ORDER BY COALESCE(s.sort_order,0), tc.suite_id, tc.sort_order, tc.id`, ...args);
    if (q.last_status) items = items.filter((i) => (q.last_status === 'none' ? !i.last_status : i.last_status === q.last_status));
    res.json({ items, total: items.length });
  });

  app.post('/api/projects/:pid/testcases', auth, guard, A.perm('testcase.write'), async (req, res) => {
    const c = await parseCase(req.body || {}, req.project);
    const out = await insertCase(req.project, req.user, c);
    await audit(req, req.user.id, 'testcase.created', 'testcase', out.id, { code: out.code });
    res.json(out, 201);
  });

  app.post('/api/projects/:pid/testcases/import', auth, guard, A.perm('testcase.write'), async (req, res) => {
    const list = (req.body || {}).cases;
    if (!Array.isArray(list) || !list.length || list.length > 500) throw new HttpError(400, 'cases must be an array of 1-500 test cases');
    const parsed = [];
    for (let i = 0; i < list.length; i++) {
      try { parsed.push(await parseCase(list[i], req.project)); } catch (e) { throw new HttpError(400, `Case #${i + 1}: ${e.message}`); }
    }
    const created = await tx(async () => { const ids = []; for (const c of parsed) ids.push(await insertCase(req.project, req.user, c)); return ids; });
    await audit(req, req.user.id, 'testcase.imported', 'project', req.project.id, { count: created.length });
    res.json({ created }, 201);
  });

  app.get('/api/projects/:pid/testcases.csv', auth, guard, async (req, res) => {
    const rows = await all(`SELECT tc.*, s.name AS suite_name, r.code AS requirement_code FROM test_cases tc
                        LEFT JOIN suites s ON s.id = tc.suite_id LEFT JOIN requirements r ON r.id = tc.requirement_id
                       WHERE tc.project_id = ? ORDER BY tc.code`, req.project.id);
    const csv = toCsv(rows, ['code', 'title', 'suite_name', 'requirement_code', 'type', 'priority', 'status', 'automated', 'method', 'endpoint', 'steps_text', 'expected_text'].map((key) => ({ key })));
    res.send(csv, 'text/csv; charset=utf-8', 200, { 'Content-Disposition': `attachment; filename="${req.project.key}-testcases.csv"` });
  });

  app.get('/api/testcases/:id', auth, loadCase, async (req, res) => {
    const history = await all(
      `SELECT tr.id, tr.run_id, ru.code AS run_code, tr.status, tr.flaky, tr.duration_ms, tr.executed_at
         FROM test_results tr JOIN test_runs ru ON ru.id = tr.run_id
        WHERE tr.test_case_id = ? AND tr.prereq = 0 ORDER BY tr.executed_at DESC, tr.id DESC LIMIT 15`, req.tc.id);
    const defects = await all('SELECT id, code, title, status, severity FROM defects WHERE test_case_id = ? ORDER BY id DESC', req.tc.id);
    res.json({ testcase: hydrate(req.tc), history, defects, project: { id: req.project.id, key: req.project.key } });
  });

  app.patch('/api/testcases/:id', auth, loadCase, A.perm('testcase.write'), async (req, res) => {
    const c = await parseCase(req.body || {}, req.project, req.tc);
    await run(`UPDATE test_cases SET suite_id=?, requirement_id=?, title=?, description=?, type=?, priority=?, preconditions=?,
           steps_text=?, expected_text=?, method=?, endpoint=?, headers=?, body=?, assertions=?, extract=?, timeout_ms=?,
           automated=?, is_setup=?, depends_on_previous=?, status=?, updated_at=? WHERE id=?`,
      c.suite_id, c.requirement_id, c.title, c.description, c.type, c.priority, c.preconditions, c.steps_text, c.expected_text,
      c.method, c.endpoint, c.headers, c.body, c.assertions, c.extract, c.timeout_ms, c.automated, c.is_setup,
      c.depends_on_previous, c.status, now(), req.tc.id);
    await audit(req, req.user.id, 'testcase.updated', 'testcase', req.tc.id);
    res.json({ ok: true });
  });

  app.delete('/api/testcases/:id', auth, loadCase, A.perm('testcase.write'), async (req, res) => {
    await run(`UPDATE test_cases SET status = 'deprecated', updated_at = ? WHERE id = ?`, now(), req.tc.id);
    await audit(req, req.user.id, 'testcase.deprecated', 'testcase', req.tc.id);
    res.json({ ok: true });
  });

  /* quick run of one case (prerequisite setup/chained cases run first, results not counted) */
  app.post('/api/testcases/:id/execute', auth, loadCase, A.perm('run.execute'), async (req, res) => {
    if (!req.tc.automated) throw new HttpError(400, 'Only automated test cases can be executed here - record manual results from a manual run');
    const r = await E.startRun(req.project, req.user.id, {
      caseIds: [req.tc.id], name: `Quick run: ${req.tc.code}`, trigger: 'adhoc',
      retries: (req.body || {}).retries, environment: (req.body || {}).environment,
    });
    await audit(req, req.user.id, 'run.started', 'run', r.id, { code: r.code, scope: req.tc.code });
    res.json({ run: r }, 202);
  });

  /* ---------------- runs ---------------- */
  app.get('/api/projects/:pid/runs', auth, guard, async (req, res) => res.json({
    items: await all(`SELECT ru.*, u.name AS started_by_name FROM test_runs ru LEFT JOIN users u ON u.id = ru.started_by
                 WHERE ru.project_id = ? ORDER BY ru.started_at DESC, ru.id DESC LIMIT ?`, req.project.id, Math.min(Number(req.query.limit) || 50, 200)),
  }));

  app.post('/api/projects/:pid/runs', auth, guard, A.perm('run.execute'), async (req, res) => {
    const b = req.body || {};
    const ids = (a) => (Array.isArray(a) ? a.map(Number).filter(Number.isInteger) : []);
    if (b.mode === 'manual') {
      const caseIds = ids(b.case_ids);
      if (!caseIds.length) throw new HttpError(400, 'Select at least one test case for a manual run');
      const valid = await all(`SELECT id FROM test_cases WHERE project_id = ? AND status != 'deprecated' AND id IN (${caseIds.map(() => '?').join(',')})`, req.project.id, ...caseIds);
      if (!valid.length) throw new HttpError(400, 'No valid test cases selected');
      const r = await E.createRunRow(req.project, req.user.id, {
        name: optStr(b.name, 'name', 150) || `Manual run ${new Date().toISOString().slice(0, 10)}`,
        environment: optStr(b.environment, 'environment', 80), trigger: 'manual', retries: 0, total: valid.length, status: 'running' });
      await audit(req, req.user.id, 'run.started', 'run', r.id, { code: r.code, mode: 'manual' });
      return res.json({ run: r, case_ids: valid.map((v) => v.id) }, 201);
    }
    const r = await E.startRun(req.project, req.user.id, {
      suiteIds: ids(b.suite_ids), caseIds: ids(b.case_ids), retries: b.retries,
      name: optStr(b.name, 'name', 150), environment: optStr(b.environment, 'environment', 80), trigger: 'automated',
    });
    await audit(req, req.user.id, 'run.started', 'run', r.id, { code: r.code, mode: 'automated' });
    res.json({ run: r }, 202);
  });

  app.get('/api/runs/:id', auth, loadRun, async (req, res) => {
    const results = (await all(
      `SELECT tr.*, tc.code AS case_code, tc.title AS case_title, tc.type AS case_type, tc.priority AS case_priority,
              d.code AS defect_code, d.status AS defect_status
         FROM test_results tr JOIN test_cases tc ON tc.id = tr.test_case_id LEFT JOIN defects d ON d.id = tr.defect_id
        WHERE tr.run_id = ? ORDER BY tr.id`, req.run.id))
      .map((r) => ({ ...r, request_snapshot: pj(r.request_snapshot), assertion_log: pj(r.assertion_log, []) }));
    const starter = req.run.started_by ? (await get('SELECT name FROM users WHERE id = ?', req.run.started_by) || {}).name : null;
    res.json({ run: { ...req.run, started_by_name: starter, project_key: req.project.key }, results });
  });

  app.post('/api/runs/:id/results', auth, loadRun, A.perm('run.execute'), async (req, res) => {
    const r = req.run;
    if (r.trigger_type !== 'manual' || r.status !== 'running') throw new HttpError(409, 'Results can only be recorded on an open manual run');
    const b = req.body || {};
    const tc = await get('SELECT * FROM test_cases WHERE id = ? AND project_id = ?', toInt(b.test_case_id, 'test_case_id', { required: true }), r.project_id);
    if (!tc) throw new HttpError(404, 'Test case not found in this project');
    const status = oneOf(b.status, 'status', ['passed', 'failed', 'blocked', 'skipped']);
    const notes = optStr(b.notes, 'notes', 2000);
    if (status === 'failed' && (!notes || notes.length < 3)) throw new HttpError(400, 'Describe what went wrong (notes) when failing a test');
    await run('DELETE FROM test_results WHERE run_id = ? AND test_case_id = ?', r.id, tc.id);
    const result = {
      status, durationMs: 0, requestSnapshot: { method: 'MANUAL', url: tc.title }, responseStatus: null, responseExcerpt: null,
      assertionLog: status === 'failed' ? [{ ok: false, desc: 'Manual verification of expected result', actual: notes }] : [],
      failureReason: notes,
    };
    let defectId = null; let action = null;
    if (status === 'failed') {
      const out = await L.autoDefectFromResult({ project: req.project, tc, run: r, result, actorId: req.user.id });
      defectId = out.defect.id; action = out.action;
    }
    await E.insertResult(r.id, tc, result, { defectId, userId: req.user.id });
    await E.recalcRun(r.id);
    res.json({ ok: true, defect_action: action, defect_id: defectId });
  });

  app.post('/api/runs/:id/complete', auth, loadRun, A.perm('run.execute'), async (req, res) => {
    const r = req.run;
    if (r.status !== 'running') throw new HttpError(409, 'Run is not open');
    await E.recalcRun(r.id);
    const t = await get('SELECT passed, failed, errored, blocked, total FROM test_runs WHERE id = ?', r.id);
    await run(`UPDATE test_runs SET status='completed', finished_at=?, skipped=? WHERE id=?`, now(), Math.max(t.total - (t.passed + t.failed + t.errored + t.blocked), 0), r.id);
    await audit(req, req.user.id, 'run.completed', 'run', r.id);
    res.json({ ok: true });
  });

  app.get('/api/runs/:id/results.csv', auth, loadRun, async (req, res) => {
    const rows = await all(`SELECT tc.code, tc.title, tr.status, tr.flaky, tr.attempts, tr.duration_ms, tr.response_status, tr.failure_reason, tr.executed_at
                        FROM test_results tr JOIN test_cases tc ON tc.id = tr.test_case_id WHERE tr.run_id = ? AND tr.prereq = 0 ORDER BY tr.id`, req.run.id);
    const csv = toCsv(rows, ['code', 'title', 'status', 'flaky', 'attempts', 'duration_ms', 'response_status', 'failure_reason', 'executed_at'].map((key) => ({ key })));
    res.send(csv, 'text/csv; charset=utf-8', 200, { 'Content-Disposition': `attachment; filename="${req.run.code}-results.csv"` });
  });
};
