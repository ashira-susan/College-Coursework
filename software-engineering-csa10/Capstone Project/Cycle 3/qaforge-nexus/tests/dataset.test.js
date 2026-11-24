'use strict';
/**
 * Dataset + PostgreSQL integrity tests: the full seed (150 employees + 168 real Defects4J bugs) is loaded into a throw-away
 * PostgreSQL database and verified through the public API and directly in SQL.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startPlatform, client } = require('./helpers');
const { Pool } = require('../server/pgclient');
const DATASET = require('../server/datasets/defects4j-subset.json');

let platform; let api; let login; let D; let mgr; let sql;

test.before(async () => {
  platform = await startPlatform({ minimal: false });
  ({ api, login, D } = client(platform.base));
  mgr = await login(`qa.manager@${D}`);
  sql = new Pool(platform.url, { max: 2 });
});
test.after(async () => { if (sql) await sql.end(); if (platform) await platform.stop(); });

test('dataset size: 100-200 real defects across the five Defects4J projects', async () => {
  const r = await sql.query(`SELECT COUNT(*) AS n FROM defects WHERE external_ref IS NOT NULL`);
  assert.ok(r.rows[0].n >= 100 && r.rows[0].n <= 200, `defects ${r.rows[0].n}`);
  assert.equal(r.rows[0].n, DATASET.total);
  const p = await sql.query(`SELECT key, source_dataset FROM projects WHERE source_dataset IS NOT NULL ORDER BY key`);
  assert.deepEqual(p.rows.map((x) => x.key), ['CHART', 'CLI', 'CSV', 'LANG', 'TIME']);
});

test('every dataset defect keeps its real report id, URL and revisions', async () => {
  const r = await sql.query(`SELECT code, title, external_ref, external_url, description FROM defects WHERE external_ref IS NOT NULL`);
  // several upstream bugs share one report (e.g. CLI-1 covers five Defects4J bugs) - that is real data; (project, bug) pairs stay unique
  assert.equal(new Set(r.rows.map((x) => x.description.match(/\(([^,]+), bug #(\d+)\)/).slice(1).join('#'))).size, r.rows.length);
  assert.ok(r.rows.every((x) => x.external_ref === x.external_ref.toUpperCase()), 'report ids are normalised');
  for (const d of r.rows) {
    if (d.external_url) assert.match(d.external_url, /^https:\/\/(issues\.apache\.org|sourceforge\.net|github\.com)\//);
    else assert.match(d.external_ref, /^CHART-D4J-\d+$/, 'only JFreeChart bugs lack a report url');
    assert.ok(d.title.startsWith(d.external_ref + ':'), d.title);
    assert.match(d.description, /Buggy revision: ([0-9a-f]{40}|\d+)\n/);
    assert.match(d.description, /Fixed revision: ([0-9a-f]{40}|\d+)\n/);
  }
  const lang = DATASET.projects.find((p) => p.key === 'LANG').bugs.find((b) => b.reportId === 'LANG-747');
  const row = r.rows.find((x) => x.external_ref === 'LANG-747');
  assert.ok(row && row.description.includes(lang.buggyRevision), 'LANG-747 matches the source dataset');
});

test('trigger tests became traceable test cases with requirements', async () => {
  const tcs = await sql.query(`SELECT COUNT(*) AS n, COUNT(requirement_id) AS linked, COUNT(external_ref) AS refd FROM test_cases t JOIN projects p ON p.id = t.project_id WHERE p.source_dataset IS NOT NULL`);
  assert.ok(tcs.rows[0].n >= 300);
  assert.equal(tcs.rows[0].n, tcs.rows[0].linked, 'every dataset test case has a requirement');
  assert.equal(tcs.rows[0].n, tcs.rows[0].refd, 'every dataset test case keeps its Java test name');
  const trace = await api('GET', '/api/projects/LANG/traceability', { token: mgr.token });
  assert.equal(trace.status, 200);
  assert.equal(trace.json.summary.notCovered, 0, 'all requirements covered by trigger tests');
});

test('defect workflow state is consistent with its history (PostgreSQL constraints and data)', async () => {
  const bad = await sql.query(`SELECT d.code FROM defects d WHERE d.status IN ('Closed','Verified') AND NOT EXISTS
      (SELECT 1 FROM defect_history h WHERE h.defect_id = d.id AND h.to_status = 'Fixed')`);
  assert.equal(bad.rows.length, 0, 'closed/verified defects were fixed first');
  const res = await sql.query(`SELECT COUNT(*) AS n FROM defects WHERE status IN ('Fixed','Retesting','Verified','Closed') AND resolution NOT LIKE 'Upstream fix %'`);
  assert.equal(res.rows[0].n, 0, 'resolutions carry the real upstream patch summary');
  const order = await sql.query(`SELECT COUNT(*) AS n FROM defects WHERE updated_at < created_at OR sla_due IS NULL`);
  assert.equal(order.rows[0].n, 0);
  await assert.rejects(sql.query(`UPDATE defects SET status = 'Bogus' WHERE id = 1`), /check|violates/i, 'invalid status rejected by PostgreSQL');
  await assert.rejects(sql.query(`UPDATE defects SET severity = 'Catastrophic' WHERE id = 1`), /check|violates/i);
  await assert.rejects(sql.query(`INSERT INTO users(emp_code,name,email,password_hash,role,created_at) VALUES ('X','x','x@x','h','hacker', now())`), /check|violates/i);
});

test('run history is derived from defect timelines: failures drop as defects are fixed', async () => {
  const r = await sql.query(`SELECT r.code, r.total, r.failed, r.passed FROM test_runs r JOIN projects p ON p.id = r.project_id WHERE p.key = 'LANG' ORDER BY r.started_at`);
  assert.ok(r.rows.length >= 6);
  for (const x of r.rows) assert.equal(x.total, x.failed + x.passed);
  const chk = await sql.query(`SELECT COUNT(*) AS n FROM test_results WHERE status = 'failed' AND defect_id IS NULL`);
  assert.equal(chk.rows[0].n, 0, 'every failed result links to a defect');
});

test('API serves the dataset: filtering, search, pagination, CSV and dashboard', async () => {
  const all = await api('GET', '/api/defects?limit=200', { token: mgr.token });
  assert.equal(all.status, 200);
  assert.ok(all.json.total >= 168);
  const page2 = await api('GET', '/api/defects?limit=50&offset=50', { token: mgr.token });
  assert.equal(page2.json.items.length, 50);
  const search = await api('GET', '/api/projects/LANG/defects?q=NumberUtils', { token: mgr.token });
  const hit = (d) => /NumberUtils/i.test(d.title + d.code);
  assert.ok(search.json.items.length >= 1 && hit(search.json.items[0]));
  const firstMiss = search.json.items.findIndex((d) => !hit(d)); // v3.0: fuzzy matches allowed, but exact matches must be ranked first
  assert.ok(firstMiss === -1 || search.json.items.slice(firstMiss).every((d) => !hit(d)));
  const sev = await api('GET', '/api/defects?severity=High&limit=200', { token: mgr.token });
  assert.ok(sev.json.items.length > 0 && sev.json.items.every((d) => d.severity === 'High'));
  const csv = await (await api('GET', '/api/projects/MATH/defects.csv', { token: mgr.token, raw: true })).text().catch(() => '');
  const lcsv = await (await api('GET', '/api/projects/LANG/defects.csv', { token: mgr.token, raw: true })).text();
  assert.match(lcsv, /LANG-747/);
  assert.equal(csv.includes('MATH-'), false);
  const dash = await api('GET', '/api/reports/dashboard', { token: mgr.token });
  assert.equal(dash.json.kpis.totalDefects, DATASET.total);
  assert.ok(dash.json.kpis.openDefects > 0 && dash.json.kpis.openDefects < DATASET.total);
});

test('SQL injection attempts are neutralised by bind parameters', async () => {
  const evil = encodeURIComponent("'; DROP TABLE defects; --");
  const r = await api('GET', `/api/defects?q=${evil}`, { token: mgr.token });
  assert.equal(r.status, 200);
  assert.equal(r.json.items.length, 0);
  const still = await sql.query('SELECT COUNT(*) AS n FROM defects');
  assert.equal(still.rows[0].n, DATASET.total);
  const login = await api('POST', '/api/auth/login', { body: { email: "admin@nexora-tech.example' OR '1'='1", password: "x' OR '1'='1" } });
  assert.ok([400, 401].includes(login.status));
});

test('connection pool handles concurrent requests', async () => {
  const rs = await Promise.all(Array.from({ length: 40 }, (_, i) => api('GET', i % 2 ? '/api/reports/dashboard' : '/api/defects?limit=20', { token: mgr.token })));
  assert.ok(rs.every((r) => r.status === 200));
});

test('lifecycle works on real dataset defects (assign, fix, retest-free verify, close)', async () => {
  const list = await api('GET', '/api/projects/CLI/defects?status=Assigned&limit=5', { token: mgr.token });
  const d = list.json.items[0];
  assert.ok(d, 'an assigned CLI defect exists');
  const devs = (await api('GET', '/api/users?role=developer&limit=200', { token: mgr.token })).json.items;
  const asg = devs.find((u) => u.id === d.assignee_id);
  const dev = await login(asg.email);
  assert.equal((await api('POST', `/api/defects/${d.id}/transition`, { token: dev.token, body: { to: 'In Progress' } })).status, 200);
  assert.equal((await api('POST', `/api/defects/${d.id}/transition`, { token: dev.token, body: { to: 'Fixed', resolution: 'Applied upstream patch' } })).status, 200);
  const qe = await login(`qa.engineer@${D}`);
  assert.equal((await api('POST', `/api/defects/${d.id}/transition`, { token: qe.token, body: { to: 'Retesting' } })).status, 200);
  assert.equal((await api('POST', `/api/defects/${d.id}/transition`, { token: qe.token, body: { to: 'Verified' } })).status, 200);
  assert.equal((await api('POST', `/api/defects/${d.id}/transition`, { token: qe.token, body: { to: 'Closed' } })).status, 200);
  const fin = await api('GET', `/api/defects/${d.id}`, { token: mgr.token });
  assert.equal(fin.json.defect.status, 'Closed');
  assert.ok(fin.json.history.length >= 6);
});
