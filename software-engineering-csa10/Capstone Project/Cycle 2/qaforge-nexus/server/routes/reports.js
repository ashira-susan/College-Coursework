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

  // weekly opened vs resolved (last 8 weeks)
  const weeks = Array.from({ length: 8 }, (_, i) => ({ start: Date.now() - (8 - i) * 7 * DAY, opened: 0, resolved: 0 }));
  const bucket = (t) => { const i = Math.floor((t - weeks[0].start) / (7 * DAY)); return i >= 0 && i < 8 ? weeks[i] : null; };
  (await all(`SELECT created_at, resolved_at FROM defects WHERE project_id IN (${IN})`, ...ids)).forEach((r) => {
    const o = bucket(Date.parse(r.created_at)); if (o) o.opened++;
    if (r.resolved_at) { const c = bucket(Date.parse(r.resolved_at)); if (c) c.resolved++; }
  });
  const flow = weeks.map((w) => ({ week: new Date(w.start).toISOString().slice(5, 10), opened: w.opened, resolved: w.resolved }));

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
  const reqs = await all('SELECT id, code, title, priority, status FROM requirements WHERE project_id = ? ORDER BY code', projectId);
  const rows = await Promise.all(reqs.map(async (r) => {
    const cases = await all(
      `SELECT tc.id, tc.code, tc.title, tc.automated,
              (SELECT tr.status FROM test_results tr WHERE tr.test_case_id = tc.id AND tr.prereq = 0 ORDER BY tr.executed_at DESC, tr.id DESC LIMIT 1) AS last_status
         FROM test_cases tc WHERE tc.requirement_id = ? AND tc.status != 'deprecated' ORDER BY tc.code`, r.id);
    const openDefects = (await get(`SELECT COUNT(*) AS n FROM defects WHERE project_id = ? AND status IN (${q(L.OPEN)})
                              AND (requirement_id = ? OR test_case_id IN (SELECT id FROM test_cases WHERE requirement_id = ?))`, projectId, r.id, r.id)).n;
    let coverage = 'Not covered';
    if (cases.length) {
      if (cases.some((c) => c.last_status === 'failed' || c.last_status === 'error')) coverage = 'Failing';
      else if (cases.every((c) => c.last_status === 'passed')) coverage = 'Passing';
      else coverage = 'Not run';
    }
    return { ...r, cases, open_defects: openDefects, coverage };
  }));
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
