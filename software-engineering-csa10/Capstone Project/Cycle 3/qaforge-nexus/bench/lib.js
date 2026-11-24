'use strict';
/** Shared benchmark helpers: statistics, HTTP client, and a schema-neutral bulk loader used identically for v2.0 and v3.0. */
const { performance } = require('node:perf_hooks');

const stats = (xs) => {
  const a = [...xs].sort((x, y) => x - y); const n = a.length;
  if (!n) return { n: 0 };
  const q = (p) => a[Math.min(n - 1, Math.floor(p * n))];
  return { n, mean: a.reduce((s, x) => s + x, 0) / n, p50: q(0.5), p95: q(0.95), p99: q(0.99), min: a[0], max: a[n - 1] };
};

function http(base) {
  let token = null;
  const call = async (method, path, body, timeout = 130000) => {
    const t0 = performance.now();
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
    const text = await r.text(); const ms = performance.now() - t0;
    let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, json, ms, bytes: text.length };
  };
  return { call, login: async (email, password = 'Nexus@123') => { const r = await call('POST', '/api/auth/login', { email, password }); token = r.json.token; return r; } };
}

/** Run fn repeatedly: `iters` times or until budgetMs is spent (at least 1). Returns latency stats (ms) and failure info. */
async function measure(fn, { iters = 100, budgetMs = 60000, warmup = 3 } = {}) {
  let last;
  for (let i = 0; i < warmup; i++) { last = await fn().catch((e) => ({ status: 0, err: String(e) })); if (last.ms > budgetMs / 3) break; }
  const lat = []; const t0 = performance.now(); let bad = 0; let status = null; let bytes = 0;
  for (let i = 0; i < iters && (i === 0 || performance.now() - t0 < budgetMs); i++) {
    try { const r = await fn(); status = r.status; bytes = r.bytes || 0; if (r.status >= 400 || r.status === 0) bad++; else lat.push(r.ms); } catch (e) { bad++; status = 'timeout/err'; }
  }
  return { ...stats(lat), failures: bad, status, bytes };
}

/** Throughput with `conc` parallel workers for `ms` milliseconds. */
async function throughput(fn, { conc = 16, ms = 5000 } = {}) {
  const end = performance.now() + ms; let done = 0; let bad = 0; const lat = [];
  await Promise.all(Array.from({ length: conc }, async () => {
    while (performance.now() < end) { try { const r = await fn(); if (r.status >= 400) bad++; else { done++; lat.push(r.ms); } } catch { bad++; } }
  }));
  return { rps: done / (ms / 1000), failures: bad, p95: stats(lat).p95, conc };
}

const lit = (arr) => `ARRAY[${arr.map((s) => `'${String(s).replace(/'/g, "''")}'`).join(',')}]::text[]`;

/**
 * Top-up the SCALE project so it holds `defects` defects, defects/2 test cases (each with 2 historical results),
 * defects/50 requirements. Works on any version's schema (only columns present since v2.0 are used).
 */
async function topUp(pool, defects, vocab) {
  const q = async (sql) => (await pool.query(sql)).rows;
  let p = (await q(`SELECT id FROM projects WHERE key = 'SCALE'`))[0];
  if (!p) p = (await q(`INSERT INTO projects(key, name, description, base_url, owner_id, created_at) VALUES ('SCALE','Scale test','Synthetic load for benchmarking','http://127.0.0.1:1',1, now()) RETURNING id`))[0];
  const pid = p.id; const t0 = performance.now();
  const have = (await q(`SELECT (SELECT COUNT(*) FROM defects WHERE project_id=${pid})::int AS d, (SELECT COUNT(*) FROM test_cases WHERE project_id=${pid})::int AS c, (SELECT COUNT(*) FROM requirements WHERE project_id=${pid})::int AS r`))[0];
  const C = Math.floor(defects / 2); const R = Math.max(20, Math.floor(defects / 50));
  const CL = lit(vocab.classes); const EX = lit(vocab.exceptions); const MS = lit(vocab.messages); const ST = lit(['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Verified', 'Closed', 'Closed', 'Reopened', 'Rejected', 'Deferred']);
  const SEV = lit(['Critical', 'High', 'Medium', 'Medium', 'Medium', 'Low', 'Low']);
  if (have.r < R) await q(`INSERT INTO requirements(project_id, code, title, priority, status, created_at)
      SELECT ${pid}, 'REQ-' || n, 'Requirement ' || n || ' ' || (${CL})[1 + (n*7) % ${vocab.classes.length}], 'P' || (1 + n % 4), 'approved', now() FROM generate_series(${have.r + 1}, ${R}) n`);
  if (have.c < C) {
    await q(`INSERT INTO test_cases(project_id, requirement_id, code, title, type, priority, automated, status, sort_order, created_at, updated_at)
      SELECT ${pid}, (SELECT id FROM requirements WHERE project_id=${pid} AND code='REQ-' || (1 + (n*31) % ${R})), 'TC-' || n, (${CL})[1 + (n*11) % ${vocab.classes.length}] || 'Test.test' || n,
             'functional', 'P' || (1 + n % 4), 0, 'ready', n, now(), now() FROM generate_series(${have.c + 1}, ${C}) n`);
  }
  if (have.d < defects) {
    await q(`INSERT INTO defects(project_id, code, title, description, severity, priority, status, type, source, test_case_id, requirement_id, reporter_id, actual, created_at, updated_at, resolved_at, sla_due)
      SELECT ${pid}, 'DEF-' || n, 'SCALE-' || n || ': ' || (${CL})[1 + (n*13) % ${vocab.classes.length}] || ' - ' || (${EX})[1 + (n*17) % ${vocab.exceptions.length}] || ': ' || (${MS})[1 + (n*19) % ${vocab.messages.length}],
             'Synthetic defect ' || n, (${SEV})[1 + (n*3) % 7], 'P3', (${ST})[1 + (n*5) % 11], 'functional', 'manual',
             (SELECT id FROM test_cases WHERE project_id=${pid} AND code='TC-' || (1 + n % ${C})), NULL, 1,
             (${MS})[1 + (n*23) % ${vocab.messages.length}],
             date_trunc('milliseconds', now() - ((n::bigint * 7919) % (90*86400)) * interval '1 second'), date_trunc('milliseconds', now() - ((n::bigint * 104729) % (90*86400)) * interval '1 second'),
             CASE WHEN n % 3 = 0 THEN now() - ((n::bigint * 31) % (80*86400)) * interval '1 second' END, now() + interval '3 days'
        FROM generate_series(${have.d + 1}, ${defects}) n`);
  }
  // two historical runs with one result per case (idempotent: only when missing)
  const runs = await q(`SELECT id FROM test_runs WHERE project_id=${pid} ORDER BY id`);
  if (runs.length < 2) for (const k of [1, 2]) await q(`INSERT INTO test_runs(project_id, code, name, status, started_at, total) VALUES (${pid}, 'RUN-${k}', 'Scale run ${k}', 'completed', now() - interval '${3 - k} days', 0)`);
  const rids = (await q(`SELECT id FROM test_runs WHERE project_id=${pid} ORDER BY id LIMIT 2`)).map((r) => r.id);
  const cur = (await q(`SELECT COUNT(DISTINCT test_case_id)::int AS n FROM test_results WHERE run_id = ${rids[0]}`))[0].n;
  if (cur < C) for (const [k, rid] of rids.entries()) {
    await q(`INSERT INTO test_results(run_id, test_case_id, status, executed_at)
      SELECT ${rid}, tc.id, CASE WHEN (tc.sort_order * ${k + 3}) % 11 = 0 THEN 'failed' ELSE 'passed' END, now() - interval '${2 - k} days'
        FROM test_cases tc WHERE tc.project_id = ${pid} AND tc.sort_order > ${cur}`);
  }
  await q('ANALYZE');
  return { ms: performance.now() - t0 };
}

module.exports = { stats, http, measure, throughput, topUp, lit };
