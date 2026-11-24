'use strict';
/** usage: node bench/latency.js <label> <baseUrl> <databaseUrl> <serverPid> <out.json> [scales]
 *  Measures API latency / throughput / storage at dataset scale and at synthetic scales, identically for v2.0 and v3.0. */
const fs = require('node:fs');
const { Pool } = require('../server/pgclient');
const { http, measure, throughput, topUp } = require('./lib');

const [label, base, dburl, pid, out, scalesArg] = process.argv.slice(2);
const SCALES = (scalesArg || '0,1000,10000,100000').split(',').map(Number);
const rss = () => { try { return Number(/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${pid}/status`, 'utf8'))[1]) / 1024; } catch { return null; } };

(async () => {
  const vocab = { classes: [], exceptions: [], messages: [] };
  const seen = { c: new Set(), e: new Set(), m: new Set() };
  const pool0 = new Pool(dburl, { max: 1 });
  for (const { title } of (await pool0.query(`SELECT title FROM defects WHERE title NOT LIKE 'SCALE-%'`)).rows) {
    const m = /^\S+:\s*(\S+)\s+-\s+(\w+)(?::\s*(.*))?$/.exec(title);
    if (m) { if (!seen.c.has(m[1])) { seen.c.add(m[1]); vocab.classes.push(m[1]); } if (!seen.e.has(m[2])) { seen.e.add(m[2]); vocab.exceptions.push(m[2]); } if (m[3] && !seen.m.has(m[3]) && vocab.messages.length < 60) { seen.m.add(m[3]); vocab.messages.push(m[3].slice(0, 60)); } }
  }
  await pool0.end();
  if (vocab.classes.length < 5) { vocab.classes = ['NumberUtils', 'StringUtils', 'DateTimeZone', 'CSVParser', 'ChartPanel', 'CommandLine', 'FastDateFormat', 'Period']; vocab.exceptions = ['NullPointerException', 'IllegalArgumentException', 'NumberFormatException', 'ArrayIndexOutOfBoundsException']; vocab.messages = ['null', 'index out of range', 'invalid format', 'unexpected token']; }
  const pool = new Pool(dburl, { max: 4 });
  const api = http(base); await api.login('qa.manager@nexora-tech.example');
  const res = { label, scales: [] };

  for (const N of SCALES) {
    const row = { scale: N };
    if (N > 0) { row.load = await topUp(pool, N, vocab); }
    const total = (await pool.query('SELECT COUNT(*)::int AS n FROM defects')).rows[0].n; row.total_defects = total;
    const mid = Math.floor(total / 2);
    const cur = (await pool.query(`SELECT updated_at, id FROM defects ORDER BY updated_at DESC, id DESC OFFSET ${mid} LIMIT 1`)).rows[0];
    const cursor = encodeURIComponent(`${cur.updated_at}|${cur.id}`);
    const trProj = N > 0 ? 'SCALE' : 'LANG';
    const E = {
      dashboard: ['GET', '/api/reports/dashboard'], list_first_page: ['GET', '/api/defects?limit=25'],
      list_filtered: ['GET', '/api/defects?severity=High&open=1&limit=25'], search_exact: ['GET', '/api/defects?q=NumberUtils&limit=25'],
      search_typo: ['GET', '/api/defects?q=NumberUtlis&limit=25'], page_mid_offset: ['GET', `/api/defects?limit=25&offset=${mid}`],
      traceability: ['GET', `/api/projects/${trProj}/traceability`],
    };
    if (label.startsWith('v3')) { E.page_mid_cursor = ['GET', `/api/defects?limit=25&cursor=${cursor}`]; E.prioritized_cases = ['GET', `/api/projects/${trProj}/prioritized-cases?limit=100`]; }
    row.endpoints = {};
    for (const [k, [m, p]] of Object.entries(E)) {
      const heavy = k === 'traceability' || k === 'dashboard';
      row.endpoints[k] = await measure(() => api.call(m, p), { iters: heavy ? 30 : 60, budgetMs: heavy ? 90000 : 30000, warmup: 2 });
      row.endpoints[k].result_count = ((await api.call(m, p)).json || {}).total ?? null;
    }
    row.throughput = {
      list_first_page: await throughput(() => api.call('GET', '/api/defects?limit=25'), { conc: 16, ms: 4000 }),
      dashboard: await throughput(() => api.call('GET', '/api/reports/dashboard'), { conc: 16, ms: 4000 }),
    };
    row.server_rss_mb = rss();
    const sz = (await pool.query(`SELECT pg_total_relation_size('defects')::bigint AS t, pg_relation_size('defects')::bigint AS h, pg_database_size(current_database())::bigint AS db`)).rows[0];
    row.defects_table_mb = Number(sz.h) / 1048576; row.defects_with_indexes_mb = Number(sz.t) / 1048576; row.database_mb = Number(sz.db) / 1048576;
    res.scales.push(row); fs.writeFileSync(out, JSON.stringify(res, null, 1));
    console.log(label, 'scale', N, 'done', JSON.stringify({ dash: row.endpoints.dashboard.p50, list: row.endpoints.list_first_page.p50, trace: row.endpoints.traceability.p50 }));
  }
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
