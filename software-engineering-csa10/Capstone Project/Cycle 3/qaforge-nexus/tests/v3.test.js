'use strict';
/** v3.0 algorithm tests: similarity engine, duplicate detection, prioritisation, fuzzy search, cursor pagination, set-based traceability. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startPlatform, client } = require('./helpers');
const { Pool } = require('../server/pgclient');
const { tokenize, SimilarityIndex } = require('../server/similarity');
const { riskScore, apfd } = require('../server/prioritize');

let platform; let api; let login; let D; let mgr; let sql;
test.before(async () => {
  platform = await startPlatform({ minimal: false });
  ({ api, login, D } = client(platform.base));
  mgr = await login(`qa.manager@${D}`);
  sql = new Pool(platform.url, { max: 2 });
});
test.after(async () => { if (sql) await sql.end(); if (platform) await platform.stop(); });

test('tokenizer splits identifiers and removes label-leaking ids', () => {
  const t = tokenize('LANG-857: CharSequenceTranslator - StringIndexOutOfBoundsException 52bcd9b8e82d4d1d287b0d75df1e161aff8c65ab');
  assert.deepEqual(t.slice(0, 3), ['char', 'sequence', 'translator']);
  assert.ok(!t.includes('lang') && !t.some((x) => x.startsWith('52bcd')));
});

test('inverted-index and LSH find the same neighbours as brute force for near-duplicates and are deterministic', () => {
  const docs = [
    { id: 1, text: 'NullPointerException in StrBuilder append when appending null object' },
    { id: 2, text: 'StrBuilder append throws NullPointerException appending a null object' },
    { id: 3, text: 'Joda DateTimeZone offset rounding wrong during daylight transition' },
    { id: 4, text: 'CSV parser fails on embedded quote in header' },
  ];
  const a = new SimilarityIndex().build(docs); const b = new SimilarityIndex().build(docs);
  const lsh = a.query(docs[0].text, { k: 1, excludeId: 1, mode: 'lsh' }); const brute = a.query(docs[0].text, { k: 1, excludeId: 1, mode: 'brute' });
  const inv = a.query(docs[0].text, { k: 1, excludeId: 1 });
  assert.equal(brute[0].id, 2); assert.equal(lsh[0].id, 2); assert.equal(inv[0].id, 2); assert.equal(inv[0].score, brute[0].score); assert.equal(lsh[0].score, brute[0].score);
  assert.deepEqual(a.sigs, b.sigs);
  const { clusters } = a.clusters(0.5); assert.deepEqual(clusters.map((c) => c.sort()), [[1, 2]]);
});

test('APFD matches the textbook value and risk score is monotonic in failure history', () => {
  assert.ok(Math.abs(apfd([1, 2, 3, 4, 5], new Set([1])) - 0.9) < 1e-9); // 1 - 1/5 + 1/10
  assert.ok(Math.abs(apfd([5, 4, 3, 2, 1], new Set([1])) - 0.1) < 1e-9);
  const never = riskScore({ hist: ['passed', 'passed', 'passed'] }); const recent = riskScore({ hist: ['failed', 'passed', 'passed'] }); const always = riskScore({ hist: ['failed', 'failed', 'failed'] });
  assert.ok(never < recent && recent < always);
  assert.ok(riskScore({ hist: ['failed'], openSeverity: 'Critical' }) > riskScore({ hist: ['failed'], openSeverity: 'Low' }));
});

test('duplicate API groups defects that share an upstream report and keeps unrelated ones apart', async () => {
  const sameReport = await sql.query(`SELECT d.id, d.project_id, d.external_ref FROM defects d WHERE d.external_ref IN
      (SELECT external_ref FROM defects WHERE external_ref NOT LIKE '%-D4J-%' GROUP BY project_id, external_ref HAVING COUNT(*) > 1) ORDER BY d.project_id, d.external_ref`);
  assert.ok(sameReport.rows.length >= 2);
  const r = await api('GET', '/api/projects/LANG/duplicates?threshold=0.5', { token: mgr.token });
  assert.equal(r.status, 200); assert.ok(r.json.defects >= 61); assert.ok(Array.isArray(r.json.clusters));
  assert.ok(r.json.clusters.every((c) => c.length >= 2 && c.length < r.json.defects / 2)); // no giant "everything is a duplicate" cluster
  const brute = await api('GET', '/api/projects/LANG/duplicates?threshold=0.5&mode=brute', { token: mgr.token });
  assert.ok(r.json.pairs <= brute.json.pairs); // LSH is a subset (recall <= 1) of the exact result
});

test('similar-defects endpoint returns ranked neighbours without the defect itself', async () => {
  const d = (await sql.query(`SELECT id, code FROM defects WHERE project_id = (SELECT id FROM projects WHERE key = 'LANG') ORDER BY id LIMIT 1`)).rows[0];
  const r = await api('GET', `/api/defects/${d.id}/similar?k=5&min=0.05`, { token: mgr.token });
  assert.equal(r.status, 200); assert.ok(r.json.items.every((x) => x.code !== d.code));
  for (let i = 1; i < r.json.items.length; i++) assert.ok(r.json.items[i - 1].score >= r.json.items[i].score);
});

test('prioritised cases are sorted by descending risk and cover every active case', async () => {
  const r = await api('GET', '/api/projects/CLI/prioritized-cases?limit=1000', { token: mgr.token });
  assert.equal(r.status, 200);
  const n = (await sql.query(`SELECT COUNT(*)::int AS n FROM test_cases WHERE project_id = (SELECT id FROM projects WHERE key='CLI') AND status != 'deprecated'`)).rows[0].n;
  assert.equal(r.json.items.length, n);
  for (let i = 1; i < r.json.items.length; i++) assert.ok(r.json.items[i - 1].risk >= r.json.items[i].risk);
});

test('fuzzy search tolerates typos and case, exact matches first', async () => {
  const exact = await api('GET', '/api/projects/LANG/defects?q=NumberUtils', { token: mgr.token });
  const lower = await api('GET', '/api/projects/LANG/defects?q=numberutils', { token: mgr.token });
  const typo = await api('GET', '/api/projects/LANG/defects?q=NumberUtlis', { token: mgr.token });
  assert.ok(exact.json.items.length > 0); assert.equal(lower.json.items[0].id, exact.json.items[0].id);
  assert.ok(typo.json.items.length > 0 && /NumberUtils/i.test(typo.json.items[0].title));
});

test('cursor pagination walks every defect exactly once', async () => {
  const seen = new Set(); let cursor = null; let pages = 0;
  do {
    const r = await api('GET', `/api/defects?limit=40${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { token: mgr.token });
    assert.equal(r.status, 200);
    for (const d of r.json.items) { assert.ok(!seen.has(d.id)); seen.add(d.id); }
    cursor = r.json.items.length ? r.json.next_cursor : null; pages++;
  } while (cursor && pages < 50);
  assert.equal(seen.size, (await api('GET', '/api/defects?limit=1', { token: mgr.token })).json.total);
  assert.equal((await api('GET', '/api/defects?cursor=bogus', { token: mgr.token })).status, 400);
});

test('set-based traceability agrees with direct SQL counts', async () => {
  const t = await api('GET', '/api/projects/TIME/traceability', { token: mgr.token });
  assert.equal(t.status, 200);
  const reqs = (await sql.query(`SELECT COUNT(*)::int AS n FROM requirements WHERE project_id = (SELECT id FROM projects WHERE key='TIME')`)).rows[0].n;
  assert.equal(t.json.summary.requirements, reqs);
  const cases = t.json.rows.reduce((a, r) => a + r.cases.length, 0);
  const sqlCases = (await sql.query(`SELECT COUNT(*)::int AS n FROM test_cases WHERE project_id = (SELECT id FROM projects WHERE key='TIME') AND requirement_id IS NOT NULL AND status != 'deprecated'`)).rows[0].n;
  assert.equal(cases, sqlCases);
  assert.equal(t.json.summary.passing + t.json.summary.failing + t.json.summary.notRun + t.json.summary.notCovered, reqs);
});
