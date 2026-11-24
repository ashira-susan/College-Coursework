'use strict';
/** Dashboards, quality metrics and traceability. */
const { all, get, now } = require('../db');
const { HttpError } = require('../lib/http');
const A = require('../auth');
const { toCsv } = require('../util');
const L = require('../lifecycle');

const auth = A.requireAuth;
const guard = A.projectGuard;
const inList = (arr) => (arr.length ? arr.map(() => '?').join(',') : 'NULL');
const q = (arr) => arr.map((s) => `'${s}'`).join(',');
const DAY = 86400e3;

async function dashboard(ids) {
  const IN = inList(ids);
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();
  const one = async (sql, ...a) => (await get(sql, ...a)) || {};

  const tcs = await one(`SELECT COUNT(*) AS total, COALESCE(SUM(automated),0) AS automated FROM test_cases WHERE project_id IN (${IN}) AND status != 'deprecated'`, ...ids);
  const runs = await one(`SELECT COUNT(*) AS n, COALESCE(SUM(passed),0) AS p, COALESCE(SUM(total),0) AS t, COALESCE(SUM(flaky),0) AS flaky
                      FROM test_runs WHERE project_id IN (${IN}) AND status = 'completed' AND started_at >= ?`, ...ids, since30);
  const def = await one(`SELECT COUNT(*) AS total,
                          COALESCE(SUM(CASE WHEN status IN (${q(L.OPEN)}) THEN 1 ELSE 0 END),0) AS open_count,
                          COALESCE(SUM(CASE WHEN status IN (${q(L.OPEN)}) AND severity = 'Critical' THEN 1 ELSE 0 END),0) AS critical_open,
                          COALESCE(SUM(CASE WHEN status IN (${q(L.ACTIVE_WORK)}) AND sla_due < ? THEN 1 ELSE 0 END),0) AS sla_breached,
                          COALESCE(SUM(CASE WHEN source = 'auto' THEN 1 ELSE 0 END),0) AS auto_count,
                          COALESCE(SUM(CASE WHEN resolved_at IS NOT NULL OR reopen_count > 0 THEN 1 ELSE 0 END),0) AS ever_fixed,
                          COALESCE(SUM(CASE WHEN reopen_count > 0 THEN 1 ELSE 0 END),0) AS reopened
                     FROM defects WHERE project_id IN (${IN})`, now(), ...ids);
  const mttr = (await one(`SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0) AS h FROM defects
                     WHERE project_id IN (${IN}) AND resolved_at IS NOT NULL`, ...ids)).h;

  const trend = (await all(
    `SELECT to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, SUM(passed) AS passed, SUM(failed + errored) AS failed, SUM(total) AS total
       FROM test_runs WHERE project_id IN (${IN}) AND status = 'completed' AND started_at >= ? AND total > 0
      GROUP BY day ORDER BY day`, ...ids, since30))
    .map((r) => ({ ...r, rate: r.total ? Math.round((r.passed * 1000) / r.total) / 10 : null }));

  const byStatus = L.STATUSES.map((s) => ({ status: s, n: 0 }));
  (await all(`SELECT status, COUNT(*) AS n FROM defects WHERE project_id IN (${IN}) GROUP BY status`, ...ids)).forEach((r) => { byStatus.find((x) => x.status === r.status).n = r.n; });
  const bySeverity = L.SEVERITIES.map((s) => ({ severity: s, n: 0 }));
  (await all(`SELECT severity, COUNT(*) AS n FROM defects WHERE project_id IN (${IN}) AND status IN (${q(L.OPEN)}) GROUP BY severity`, ...ids)).forEach((r) => { bySeverity.find((x) => x.severity === r.severity).n = r.n; });
  const byProject = await all(`SELECT p.key, p.name, COUNT(d.id) AS n FROM projects p LEFT JOIN defects d ON d.project_id = p.id AND d.status IN (${q(L.OPEN)})
                          WHERE p.id IN (${IN}) GROUP BY p.id ORDER BY n DESC`, ...ids);
  const byType = await all(`SELECT type, COUNT(*) AS n FROM defects WHERE project_id IN (${IN}) GROUP BY type ORDER BY n DESC`, ...ids);

  // weekly opened vs resolved (last 8 weeks): aggregated in SQL (v2.0 transferred every defect row to Node and bucketed there)
  const t0 = Date.now() - 8 * 7 * DAY; const iso0 = new Date(t0).toISOString();
  const opened = await all(`SELECT FLOOR((EXTRACT(EPOCH FROM created_at) * 1000 - ?) / ?)::int AS w, COUNT(*)::int AS n FROM defects
                            WHERE project_id IN (${IN}) AND created_at >= ?::timestamptz GROUP BY 1`, t0, 7 * DAY, ...ids, iso0);
  const resolved = await all(`SELECT FLOOR((EXTRACT(EPOCH FROM resolved_at) * 1000 - ?) / ?)::int AS w, COUNT(*)::int AS n FROM defects
                              WHERE project_id IN (${IN}) AND resolved_at >= ?::timestamptz GROUP BY 1`, t0, 7 * DAY, ...ids, iso0);
  const flow = Array.from({ length: 8 }, (_, i) => ({
    week: new Date(t0 + i * 7 * DAY).toISOString().slice(5, 10),
    opened: (opened.find((r) => r.w === i) || {}).n || 0, resolved: (resolved.find((r) => r.w === i) || {}).n || 0,
  }));

  const topFailing = await all(
    `SELECT tc.id, tc.code, tc.title, p.key AS project_key, COUNT(*) AS failures
       FROM test_results tr JOIN test_cases tc ON tc.id = tr.test_case_id JOIN projects p ON p.id = tc.project_id
       JOIN test_runs ru ON ru.id = tr.run_id
      WHERE tr.status = 'failed' AND tr.prereq = 0 AND ru.started_at >= ? AND tc.project_id IN (${IN})
      GROUP BY tc.id, p.key ORDER BY failures DESC LIMIT 8`, since30, ...ids);
  const workload = await all(
    `SELECT u.id, u.name, COUNT(*) AS n FROM defects d JOIN users u ON u.id = d.assignee_id
      WHERE d.status IN ('Assigned','In Progress','Reopened') AND d.project_id IN (${IN}) GROUP BY u.id ORDER BY n DESC, u.name LIMIT 8`, ...ids);
  const recentRuns = await all(`SELECT ru.id, ru.code, ru.name, ru.status, ru.total, ru.passed, ru.failed, ru.errored, ru.started_at, p.key AS project_key
                            FROM test_runs ru JOIN projects p ON p.id = ru.project_id WHERE ru.project_id IN (${IN}) ORDER BY ru.started_at DESC, ru.id DESC LIMIT 6`, ...ids);
  const recentDefects = await all(`SELECT d.id, d.code, d.title, d.status, d.severity, d.created_at, p.key AS project_key
                               FROM defects d JOIN projects p ON p.id = d.project_id WHERE d.project_id IN (${IN}) ORDER BY d.created_at DESC LIMIT 8`, ...ids);

  return {
    kpis: {
      projects: ids.length, testCases: tcs.total, automatedPct: tcs.total ? Math.round((tcs.automated * 100) / tcs.total) : 0,
      runs30: runs.n, passRate30: runs.t ? Math.round((runs.p * 1000) / runs.t) / 10 : null, flaky30: runs.flaky,
      openDefects: def.open_count, criticalOpen: def.critical_open, slaBreached: def.sla_breached, totalDefects: def.total,
      autoDetectedPct: def.total ? Math.round((def.auto_count * 100) / def.total) : 0,
      mttrHours: mttr == null ? null : Math.round(mttr * 10) / 10,
      reopenRatePct: def.ever_fixed ? Math.round((def.reopened * 1000) / def.ever_fixed) / 10 : 0,
    },
    trend, byStatus, bySeverity, byProject, byType, flow, topFailing, workload, recentRuns, recentDefects,
  };
}

async function traceability(projectId) {
  // v3.0: set-based. 3 queries regardless of the number of requirements (v2.0 issued 2 queries per requirement).
  const reqs = await all('SELECT id, code, title, priority, status FROM requirements WHERE project_id = ? ORDER BY code', projectId);
  const cases = await all(
    `SELECT tc.id, tc.requirement_id, tc.code, tc.title, tc.automated, lr.status AS last_status
       FROM test_cases tc
       LEFT JOIN LATERAL (SELECT tr.status FROM test_results tr WHERE tr.test_case_id = tc.id AND tr.prereq = 0
                           ORDER BY tr.executed_at DESC, tr.id DESC LIMIT 1) lr ON TRUE
      WHERE tc.project_id = ? AND tc.requirement_id IS NOT NULL AND tc.status != 'deprecated' ORDER BY tc.code`, projectId);
  const openRows = await all(
    `SELECT COALESCE(d.requirement_id, tc.requirement_id) AS rid, COUNT(*) AS n
       FROM defects d LEFT JOIN test_cases tc ON tc.id = d.test_case_id
      WHERE d.project_id = ? AND d.status IN (${q(L.OPEN)}) AND COALESCE(d.requirement_id, tc.requirement_id) IS NOT NULL GROUP BY 1`, projectId);
  const byReq = new Map(); for (const c of cases) { if (!byReq.has(c.requirement_id)) byReq.set(c.requirement_id, []); byReq.get(c.requirement_id).push(c); }
  const open = new Map(openRows.map((o) => [o.rid, Number(o.n)]));
  const rows = reqs.map((r) => {
    const cs = (byReq.get(r.id) || []).map(({ requirement_id, ...c }) => c);
    let coverage = 'Not covered';
    if (cs.length) {
      if (cs.some((c) => c.last_status === 'failed' || c.last_status === 'error')) coverage = 'Failing';
      else if (cs.every((c) => c.last_status === 'passed')) coverage = 'Passing';
      else coverage = 'Not run';
    }
    return { ...r, cases: cs, open_defects: open.get(r.id) || 0, coverage };
  });
  const covered = rows.filter((r) => r.cases.length).length;
  return {
    rows,
    summary: {
      requirements: rows.length, covered, coveragePct: rows.length ? Math.round((covered * 100) / rows.length) : 0,
      passing: rows.filter((r) => r.coverage === 'Passing').length, failing: rows.filter((r) => r.coverage === 'Failing').length,
      notRun: rows.filter((r) => r.coverage === 'Not run').length, notCovered: rows.filter((r) => r.coverage === 'Not covered').length,
    },
  };
}

module.exports = function (app) {
  app.get('/api/reports/dashboard', auth, async (req, res) => {
    let ids = await A.accessibleProjectIds(req.user);
    if (req.query.project_id) {
      ids = ids.filter((i) => i === Number(req.query.project_id));
      if (!ids.length) throw new HttpError(403, 'No access to this project');
    }
    res.json(await dashboard(ids));
  });

  app.get('/api/projects/:pid/traceability', auth, guard, async (req, res) => res.json(await traceability(req.project.id)));

  app.get('/api/projects/:pid/traceability.csv', auth, guard, async (req, res) => {
    const t = await traceability(req.project.id);
    const csv = toCsv(t.rows, [
      { label: 'Requirement', get: (r) => r.code }, { label: 'Title', get: (r) => r.title }, { label: 'Priority', get: (r) => r.priority },
      { label: 'Test cases', get: (r) => r.cases.map((c) => c.code).join(' ') }, { label: 'Coverage', get: (r) => r.coverage },
      { label: 'Open defects', get: (r) => r.open_defects },
    ]);
    res.send(csv, 'text/csv; charset=utf-8', 200, { 'Content-Disposition': `attachment; filename="${req.project.key}-traceability.csv"` });
  });
};
