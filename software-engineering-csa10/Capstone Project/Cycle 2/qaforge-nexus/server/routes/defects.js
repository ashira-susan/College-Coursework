'use strict';
/** Defect tracking: listing, manual reporting, lifecycle transitions, comments, automated retest. */
const { all, get, run, now } = require('../db');
const { HttpError } = require('../lib/http');
const A = require('../auth');
const { audit, needStr, optStr, oneOf, toInt, page, toCsv, notify } = require('../util');
const L = require('../lifecycle');
const E = require('../engine');

const auth = A.requireAuth;
const guard = A.projectGuard;
const inList = (arr) => (arr.length ? arr.map(() => '?').join(',') : 'NULL');

const decorate = (d) => {
  const nowIso = now();
  return {
    ...d,
    sla_breached: L.ACTIVE_WORK.includes(d.status) && !!d.sla_due && d.sla_due < nowIso,
    age_hours: Math.round((Date.now() - Date.parse(d.created_at)) / 3600e3),
  };
};

const SELECT = `SELECT d.*, p.key AS project_key, p.name AS project_name, ru.name AS reporter_name, au.name AS assignee_name,
                       tc.code AS test_case_code
                  FROM defects d JOIN projects p ON p.id = d.project_id
                  LEFT JOIN users ru ON ru.id = d.reporter_id LEFT JOIN users au ON au.id = d.assignee_id
                  LEFT JOIN test_cases tc ON tc.id = d.test_case_id`;

function filters(q, projectIds) {
  const where = [`d.project_id IN (${inList(projectIds)})`]; const args = [...projectIds];
  if (q.status) { const s = String(q.status).split(',').filter((x) => L.STATUSES.includes(x)); if (s.length) { where.push(`d.status IN (${inList(s)})`); args.push(...s); } }
  if (q.open === '1') where.push(`d.status IN (${L.OPEN.map((s) => `'${s}'`).join(',')})`);
  if (q.severity && L.SEVERITIES.includes(q.severity)) { where.push('d.severity = ?'); args.push(q.severity); }
  if (q.assignee_id === 'me') { where.push('d.assignee_id = ?'); args.push(q.__me); }
  else if (q.assignee_id) { where.push('d.assignee_id = ?'); args.push(Number(q.assignee_id)); }
  if (q.reporter_id) { where.push('d.reporter_id = ?'); args.push(Number(q.reporter_id)); }
  if (q.source === 'auto' || q.source === 'manual') { where.push('d.source = ?'); args.push(q.source); }
  if (q.type && L.DEFECT_TYPES.includes(q.type)) { where.push('d.type = ?'); args.push(q.type); }
  if (q.sla === 'breached') {
    where.push(`d.status IN (${L.ACTIVE_WORK.map((s) => `'${s}'`).join(',')}) AND d.sla_due < ?`); args.push(now());
  }
  if (q.q) { where.push('(d.title LIKE ? OR d.code LIKE ?)'); const s = `%${String(q.q).slice(0, 80)}%`; args.push(s, s); }
  return { where: where.join(' AND '), args };
}
const SORTS = {
  updated: 'd.updated_at DESC', created: 'd.created_at DESC', oldest: 'd.created_at ASC',
  severity: `CASE d.severity WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, d.created_at DESC`,
};

async function loadDefect(req) {
  const d = await get('SELECT * FROM defects WHERE id = ?', Number(req.params.id));
  if (!d) throw new HttpError(404, 'Defect not found');
  if (!await A.projectAccess(req.user, d.project_id)) throw new HttpError(403, 'You are not a member of this project');
  req.defect = d; req.project = await get('SELECT * FROM projects WHERE id = ?', d.project_id);
}

async function list(req, res, projectIds) {
  const pg = page(req.query, 25, 200);
  const f = filters({ ...req.query, __me: req.user.id }, projectIds);
  const total = (await get(`SELECT COUNT(*) AS n FROM defects d WHERE ${f.where}`, ...f.args)).n;
  const items = (await all(`${SELECT} WHERE ${f.where} ORDER BY ${SORTS[req.query.sort] || SORTS.updated} LIMIT ? OFFSET ?`, ...f.args, pg.limit, pg.offset)).map(decorate);
  res.json({ items, total, page: pg.page, limit: pg.limit });
}

module.exports = function (app) {
  app.get('/api/defects', auth, async (req, res) => {
    let ids = await A.accessibleProjectIds(req.user);
    if (req.query.project_id) ids = ids.filter((i) => i === Number(req.query.project_id));
    await list(req, res, ids);
  });
  app.get('/api/projects/:pid/defects', auth, guard, async (req, res) => await list(req, res, [req.project.id]));

  app.get('/api/projects/:pid/defects.csv', auth, guard, async (req, res) => {
    const rows = (await all(`${SELECT} WHERE d.project_id = ? ORDER BY d.id`, req.project.id)).map(decorate);
    const csv = toCsv(rows, ['code', 'title', 'status', 'severity', 'priority', 'type', 'source', 'test_case_code', 'reporter_name', 'assignee_name',
      'occurrences', 'reopen_count', 'created_at', 'resolved_at', 'closed_at', 'sla_due', 'sla_breached'].map((key) => ({ key })));
    res.send(csv, 'text/csv; charset=utf-8', 200, { 'Content-Disposition': `attachment; filename="${req.project.key}-defects.csv"` });
  });

  app.post('/api/projects/:pid/defects', auth, guard, A.perm('defect.create'), async (req, res) => {
    const b = req.body || {};
    const tcId = toInt(b.test_case_id, 'test_case_id');
    const tc = tcId ? await get('SELECT * FROM test_cases WHERE id = ? AND project_id = ?', tcId, req.project.id) : null;
    if (tcId && !tc) throw new HttpError(400, 'test case does not belong to this project');
    let assignee = toInt(b.assignee_id, 'assignee_id');
    if (assignee && !await get('SELECT 1 AS x FROM project_members WHERE project_id = ? AND user_id = ?', req.project.id, assignee)) throw new HttpError(400, 'assignee must be a project member');
    if (assignee && !['admin', 'qa_manager'].includes(req.user.role)) assignee = null; // only managers choose assignees; others are auto-assigned
    const d = await L.createDefect(req.project.id, {
      title: needStr(b.title, 'title', { max: 200 }), description: optStr(b.description, 'description'),
      severity: oneOf(b.severity, 'severity', L.SEVERITIES, 'Medium'), type: oneOf(b.type, 'type', L.DEFECT_TYPES, 'functional'),
      source: 'manual', test_case_id: tc ? tc.id : null, requirement_id: tc ? tc.requirement_id : toInt(b.requirement_id, 'requirement_id'),
      steps: optStr(b.steps, 'steps'), expected: optStr(b.expected, 'expected'), actual: optStr(b.actual, 'actual'),
      environment: optStr(b.environment, 'environment', 100), assignee_id: assignee,
    }, req.user.id);
    await audit(req, req.user.id, 'defect.created', 'defect', d.id, { code: d.code });
    res.json({ id: d.id, code: d.code }, 201);
  });

  app.get('/api/defects/:id', auth, loadDefect, async (req, res) => {
    const d = req.defect;
    const full = decorate((await all(`${SELECT} WHERE d.id = ?`, d.id))[0]);
    const history = await all(`SELECT h.*, u.name AS actor_name FROM defect_history h LEFT JOIN users u ON u.id = h.actor_id WHERE h.defect_id = ? ORDER BY h.id`, d.id);
    const comments = await all(`SELECT c.*, u.name AS author_name, u.role AS author_role FROM defect_comments c JOIN users u ON u.id = c.author_id WHERE c.defect_id = ? ORDER BY c.id`, d.id);
    const developers = await all(`SELECT u.id, u.name, u.role FROM project_members m JOIN users u ON u.id = m.user_id
                             WHERE m.project_id = ? AND u.active = 1 AND u.role IN ('developer','qa_engineer','qa_manager') ORDER BY u.role DESC, u.name`, d.project_id);
    const testcase = d.test_case_id ? await get('SELECT id, code, title, automated FROM test_cases WHERE id = ?', d.test_case_id) : null;
    const dupes = await all('SELECT id, code, title FROM defects WHERE duplicate_of = ?', d.id);
    res.json({
      defect: full, history, comments, testcase, duplicates: dupes, assignable: developers,
      transitions: L.allowedTransitions(d, req.user),
      canRetest: A.can(req.user, 'defect.retest') && d.status === 'Fixed' && !!(testcase && testcase.automated),
    });
  });

  app.patch('/api/defects/:id', auth, loadDefect, async (req, res) => {
    const d = req.defect;
    const isOwner = d.reporter_id === req.user.id;
    if (!A.can(req.user, 'defect.edit') && !isOwner) throw new HttpError(403, 'You cannot edit this defect');
    const b = req.body || {};
    const sev = b.severity !== undefined ? oneOf(b.severity, 'severity', L.SEVERITIES) : d.severity;
    await run(`UPDATE defects SET title=?, description=?, severity=?, priority=?, type=?, steps=?, expected=?, actual=?, environment=?, sla_due=?, updated_at=? WHERE id=?`,
      b.title !== undefined ? needStr(b.title, 'title', { max: 200 }) : d.title,
      b.description !== undefined ? optStr(b.description, 'description') : d.description,
      sev, L.PRIO_BY_SEV[sev], b.type !== undefined ? oneOf(b.type, 'type', L.DEFECT_TYPES) : d.type,
      b.steps !== undefined ? optStr(b.steps, 'steps') : d.steps, b.expected !== undefined ? optStr(b.expected, 'expected') : d.expected,
      b.actual !== undefined ? optStr(b.actual, 'actual') : d.actual, b.environment !== undefined ? optStr(b.environment, 'environment', 100) : d.environment,
      sev !== d.severity ? L.slaDue(d.created_at, sev) : d.sla_due, now(), d.id);
    if (sev !== d.severity) await L.history(d.id, req.user.id, 'severity', d.status, d.status, `Severity changed ${d.severity} -> ${sev}`);
    await audit(req, req.user.id, 'defect.updated', 'defect', d.id);
    res.json({ ok: true });
  });

  app.post('/api/defects/:id/transition', auth, loadDefect, async (req, res) => {
    const to = oneOf((req.body || {}).to, 'to', L.STATUSES);
    const d = await L.transitionDefect(req.defect.id, to, req.user, req.body || {});
    await audit(req, req.user.id, 'defect.transition', 'defect', d.id, { from: req.defect.status, to });
    res.json({ defect: decorate(d) });
  });

  app.post('/api/defects/:id/comments', auth, loadDefect, A.perm('defect.comment'), async (req, res) => {
    const body = needStr((req.body || {}).body, 'comment', { max: 3000 });
    await run('INSERT INTO defect_comments(defect_id, author_id, body, created_at) VALUES (?,?,?,?)', req.defect.id, req.user.id, body, now());
    await run('UPDATE defects SET updated_at = ? WHERE id = ?', now(), req.defect.id);
    for (const uid of new Set([req.defect.reporter_id, req.defect.assignee_id])) {
      if (uid && uid !== req.user.id) await notify(uid, `${req.user.name} commented on ${req.defect.code}`, `#/defects/${req.defect.id}`);
    }
    res.json({ ok: true }, 201);
  });

  /**
   * Automated retest: Fixed -> Retesting, re-run the linked black-box test, then Verified (pass) or Reopened (fail).
   */
  app.post('/api/defects/:id/retest', auth, loadDefect, A.perm('defect.retest'), async (req, res) => {
    const d = req.defect;
    if (d.status !== 'Fixed') throw new HttpError(409, 'Only defects in "Fixed" status can be retested');
    const tc = d.test_case_id ? await get('SELECT * FROM test_cases WHERE id = ?', d.test_case_id) : null;
    if (!tc || !tc.automated) throw new HttpError(400, 'Automated retest needs a linked automated test case - verify manually instead');
    await L.transitionDefect(d.id, 'Retesting', req.user, { note: 'Automated retest started' });
    const cases = await E.orderedCases(req.project.id);
    const plan = E.buildPlan(cases, [tc.id]);
    const runRow = await E.createRunRow(req.project, req.user.id, { name: `Retest ${d.code}`, trigger: 'retest', retries: 1, total: 1 });
    await E.executeRun(runRow.id, req.project, plan, { retries: 1, userId: req.user.id });
    const result = await get('SELECT status, failure_reason FROM test_results WHERE run_id = ? AND test_case_id = ? AND prereq = 0', runRow.id, tc.id);
    let outcome = 'inconclusive';
    if (result && result.status === 'passed') {
      await L.transitionDefect(d.id, 'Verified', req.user, { note: `Automated retest ${runRow.code} passed` });
      outcome = 'verified';
    } else if (result && result.status === 'failed') outcome = 'reopened'; // lifecycle engine already reopened it
    await audit(req, req.user.id, 'defect.retest', 'defect', d.id, { run: runRow.code, outcome });
    res.json({
      outcome, run: await get('SELECT * FROM test_runs WHERE id = ?', runRow.id), result,
      defect: decorate((await all(`${SELECT} WHERE d.id = ?`, d.id))[0]),
    });
  });
};
