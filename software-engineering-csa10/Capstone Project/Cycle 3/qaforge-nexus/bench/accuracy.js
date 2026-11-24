'use strict';
/**
 * Accuracy and algorithm-scaling experiments (v2.0 behaviour vs v3.0 algorithms) on the Defects4J-backed database.
 * usage: node bench/accuracy.js [out.json]      env DATABASE_URL (default: local qaforge DB, which holds the seeded dataset)
 * All randomness is seeded; every number printed is measured, none is typed in.
 */
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const { Pool } = require('../server/pgclient');
const { SimilarityIndex, defectText, tokenize } = require('../server/similarity');
const { riskScore, apfd } = require('../server/prioritize');

const OUT = process.argv[2] || 'bench/results/accuracy.json';
const URL = process.env.DATABASE_URL || 'postgres://qaforge:qaforge@127.0.0.1:5432/qaforge';
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const prf = (tp, fp, fn) => { const p = tp + fp ? tp / (tp + fp) : 0; const r = tp + fn ? tp / (tp + fn) : 0; return { precision: p, recall: r, f1: p + r ? (2 * p * r) / (p + r) : 0, tp, fp, fn }; };
const pairKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

(async () => {
  const pool = new Pool(URL, { max: 2 }); const out = {};

  /* ---------- 1. Duplicate detection: real ground truth = bugs filed against the same upstream report ---------- */
  const defects = (await pool.query(`SELECT d.id, d.project_id, p.key AS pk, d.title, d.description, d.actual, d.external_ref, d.test_case_id
       FROM defects d JOIN projects p ON p.id = d.project_id WHERE d.external_ref IS NOT NULL AND d.external_ref NOT LIKE '%-D4J-%' ORDER BY d.id`)).rows;
  const byProj = new Map(); for (const d of defects) { if (!byProj.has(d.project_id)) byProj.set(d.project_id, []); byProj.get(d.project_id).push(d); }
  const truth = new Set(); let universe = 0;
  for (const ds of byProj.values()) {
    universe += (ds.length * (ds.length - 1)) / 2;
    for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) if (ds[i].external_ref === ds[j].external_ref) truth.add(pairKey(ds[i].id, ds[j].id));
  }
  const idx = new Map(); // project -> index
  for (const [pid, ds] of byProj) idx.set(pid, new SimilarityIndex().build(ds.map((d) => ({ id: d.id, text: defectText(d) }))));
  const predicted = (fn) => { const s = new Set(); for (const [pid, ix] of idx) for (const [a, b] of fn(pid, ix, byProj.get(pid))) s.add(pairKey(a, b)); return s; };
  const score = (pred) => { let tp = 0; for (const k of pred) if (truth.has(k)) tp++; return prf(tp, pred.size - tp, truth.size - tp); };
  const v2 = predicted((pid, ix, ds) => { const m = new Map(); const r = []; for (const d of ds) { if (d.test_case_id == null) continue; if (m.has(d.test_case_id)) r.push([m.get(d.test_case_id), d.id]); else m.set(d.test_case_id, d.id); } return r; });
  const norm = (t) => String(t).toLowerCase().replace(/^\S+:\s*/, '').replace(/\s+/g, ' ').trim();
  const titleExact = predicted((pid, ix, ds) => { const m = new Map(); const r = []; for (const d of ds) { const k = norm(d.title); if (m.has(k)) r.push([m.get(k), d.id]); else m.set(k, d.id); } return r; });
  const sweep = [];
  for (const th of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
    const brute = score(predicted((pid, ix) => ix.pairs(th, { mode: 'brute' }).map((p) => [p[0], p[1]])));
    const lsh = score(predicted((pid, ix) => ix.pairs(th, { mode: 'lsh' }).map((p) => [p[0], p[1]])));
    const inv = score(predicted((pid, ix) => ix.pairs(th, { mode: 'inv' }).map((p) => [p[0], p[1]])));
    sweep.push({ threshold: th, brute, lsh, inv });
  }
  // retrieval view: for each defect that has a true duplicate, where does a true partner rank among all others of the project?
  let q = 0; let h1 = 0; let h5 = 0; let mrr = 0;
  for (const [pid, ds] of byProj) for (const d of ds) {
    const partners = new Set(ds.filter((x) => x.id !== d.id && truth.has(pairKey(x.id, d.id))).map((x) => x.id)); if (!partners.size) continue;
    const ranked = idx.get(pid).query(defectText(d), { k: ds.length, excludeId: d.id, mode: 'brute' }); const r = ranked.findIndex((x) => partners.has(x.id));
    q++; if (r === 0) h1++; if (r >= 0 && r < 5) h5++; if (r >= 0) mrr += 1 / (r + 1);
  }
  out.dedup_real = {
    note: 'ground truth = bugs filed against the same upstream report within a project (real Defects4J metadata); report keys are scrubbed from the compared text',
    defects: defects.length, pair_universe: universe, true_duplicate_pairs: truth.size,
    v2_same_test_case: score(v2), naive_exact_title: score(titleExact), v3_sweep: sweep,
    v3_retrieval: { queries: q, hit_at_1: h1 / q, hit_at_5: h5 / q, mrr: mrr / q },
  };

  /* ---------- 2. Re-report retrieval with injected noise (synthetic perturbation of real defects) ---------- */
  const R = rng(20261117); const typo = (w) => { if (w.length < 4) return w; const i = 1 + Math.floor(R() * (w.length - 2)); return w.slice(0, i) + w.slice(i + 1); };
  const noisy = (text) => { let t = tokenize(text, { scrubIds: true }).filter(() => R() > 0.25).map((w) => (R() < 0.1 ? typo(w) : w)); for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t.join(' '); };
  const all = (await pool.query(`SELECT id, project_id, title, description, actual FROM defects WHERE external_ref IS NOT NULL ORDER BY id`)).rows;
  const gix = new SimilarityIndex().build(all.map((d) => ({ id: d.id, text: defectText(d) })));
  const m = { v2_exact_title: [0, 0, 0], v3_brute: [0, 0, 0], v3_lsh: [0, 0, 0], v3_inverted: [0, 0, 0] }; let lshEmpty = 0;
  const rank = (res, id) => { const r = res.findIndex((x) => x.id === id); return r; };
  const add = (k, r) => { if (r === 0) m[k][0]++; if (r >= 0 && r < 5) m[k][1]++; if (r >= 0) m[k][2] += 1 / (r + 1); };
  const titles = new Map(all.map((d) => [norm(d.title), d.id]));
  for (const d of all) {
    const nt = noisy(defectText(d));
    add('v2_exact_title', titles.get(nt) === d.id ? 0 : -1);
    add('v3_brute', rank(gix.query(nt, { k: 5, mode: 'brute' }), d.id));
    add('v3_inverted', rank(gix.query(nt, { k: 5, mode: 'inv' }), d.id));
    const l = gix.query(nt, { k: 5, mode: 'lsh' }); if (!l.length) lshEmpty++; add('v3_lsh', rank(l, d.id));
  }
  const nq = all.length;
  out.dedup_noisy = { note: 'each defect re-reported with 25% tokens dropped, 10% typos, shuffled word order; success = original defect in top-k of the index', queries: nq,
    ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { hit_at_1: v[0] / nq, hit_at_5: v[1] / nq, mrr: v[2] / nq }])), lsh_no_candidates: lshEmpty / nq };

  /* ---------- 3. Search quality: v2 (case-sensitive LIKE) vs v3 (ILIKE + trigram word similarity, ranked) ---------- */
  const titlesAll = (await pool.query(`SELECT id, title FROM defects WHERE external_ref IS NOT NULL`)).rows;
  const classOf = (t) => (/^\S+:\s*(\S+)\s+-/.exec(t) || [])[1];
  const tokens = [...new Set(titlesAll.map((r) => classOf(r.title)).filter((c) => c && c.length >= 6))];
  const mkTypo = (w) => (w.length > 7 ? w.slice(0, 3) + w.slice(4) : w.slice(0, 2) + w[3] + w[2] + w.slice(4)); // delete one char / swap two
  const variants = { exact_case: (w) => w, lowercase: (w) => w.toLowerCase(), one_typo: (w) => mkTypo(w), lowercase_typo: (w) => mkTypo(w).toLowerCase() };
  const run = async (sql, args) => (await pool.query(sql, args)).rows.map((r) => r.id);
  await pool.query('SET pg_trgm.word_similarity_threshold = 0.45');
  const res3 = {};
  for (const [vname, f] of Object.entries(variants)) {
    const acc = { v2: { rec: 0, prec: 0, mrr: 0, zero: 0 }, v3: { rec: 0, prec: 0, mrr: 0, zero: 0 } };
    for (const tok of tokens) {
      const rel = new Set((await run(`SELECT id FROM defects WHERE external_ref IS NOT NULL AND title ILIKE $1`, [`%${tok}%`])));
      const qv = f(tok);
      const r2 = await run(`SELECT id FROM defects WHERE external_ref IS NOT NULL AND (title LIKE $1 OR code LIKE $1) ORDER BY updated_at DESC, id DESC LIMIT 20`, [`%${qv}%`]);
      // v3.0 two-phase search: exact/case-insensitive first, typo-tolerant word-similarity fallback only when nothing matches
      let r3 = await run(`SELECT id FROM defects WHERE external_ref IS NOT NULL AND (title ILIKE $1 OR code ILIKE $1) ORDER BY updated_at DESC, id DESC LIMIT 20`, [`%${qv}%`]);
      if (!r3.length) r3 = await run(`SELECT id FROM defects WHERE external_ref IS NOT NULL AND (title ILIKE $1 OR code ILIKE $1 OR $2 <% title) ORDER BY word_similarity($2, title) DESC, updated_at DESC, id DESC LIMIT 20`, [`%${qv}%`, qv]);
      for (const [k, r] of [['v2', r2], ['v3', r3]]) {
        const hit = r.filter((id) => rel.has(id)); const a = acc[k];
        a.rec += hit.length / Math.min(rel.size, 20); a.prec += r.slice(0, 10).length ? r.slice(0, 10).filter((id) => rel.has(id)).length / r.slice(0, 10).length : 0;
        const fr = r.findIndex((id) => rel.has(id)); a.mrr += fr >= 0 ? 1 / (fr + 1) : 0; if (!r.length) a.zero++;
      }
    }
    const n = tokens.length; res3[vname] = Object.fromEntries(['v2', 'v3'].map((k) => [k, { recall_at_20: acc[k].rec / n, precision_at_10: acc[k].prec / n, mrr: acc[k].mrr / n, zero_result_rate: acc[k].zero / n }]));
  }
  out.search = { note: 'query = class-name token of a defect title; relevant = titles containing the exact token (case-insensitive)', queries: tokens.length, variants: res3 };

  /* ---------- 4. Test prioritisation: APFD on recorded run history (history is simulated for the dataset projects) ---------- */
  const projects = (await pool.query(`SELECT id, key FROM projects WHERE key != 'SCALE' ORDER BY id`)).rows; const R2 = rng(7); const perProject = []; const wins = { v3_vs_v2: 0, v3_vs_random: 0, total: 0 };
  const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(R2() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  for (const p of projects) {
    const cases = (await pool.query(`SELECT id, priority, sort_order FROM test_cases WHERE project_id = $1 ORDER BY sort_order, id`, [p.id])).rows; const prio = new Map(cases.map((c) => [c.id, c.priority]));
    const runs = (await pool.query(`SELECT id FROM test_runs WHERE project_id = $1 ORDER BY id`, [p.id])).rows;
    const results = new Map(); for (const r of runs) results.set(r.id, new Map((await pool.query(`SELECT test_case_id, status FROM test_results WHERE run_id = $1 AND prereq = 0`, [r.id])).rows.map((x) => [x.test_case_id, x.status])));
    const rows = [];
    for (let k = 1; k < runs.length; k++) {
      const cur = results.get(runs[k].id); const ids = cases.map((c) => c.id).filter((id) => cur.has(id)); const failing = new Set(ids.filter((id) => cur.get(id) !== 'passed'));
      if (!failing.size || ids.length < 10) continue;
      const hist = (id) => { const h = []; for (let j = k - 1; j >= Math.max(0, k - 8); j--) { const s = results.get(runs[j].id).get(id); if (s) h.push(s); } return h; };
      const t0 = performance.now();
      const scored = ids.map((id, pos) => ({ id, pos, r: riskScore({ hist: hist(id), priority: prio.get(id) }) })).sort((a, b) => b.r - a.r || a.pos - b.pos);
      const ms = performance.now() - t0;
      const lastFail = ids.map((id, pos) => ({ id, pos, f: hist(id)[0] && hist(id)[0] !== 'passed' ? 1 : 0 })).sort((a, b) => b.f - a.f || a.pos - b.pos);
      const a2 = apfd(ids, failing); const a3 = apfd(scored.map((x) => x.id), failing); const alf = apfd(lastFail.map((x) => x.id), failing);
      let ar = 0; for (let i = 0; i < 200; i++) ar += apfd(shuffle(ids), failing); ar /= 200;
      const opt = apfd([...failing, ...ids.filter((id) => !failing.has(id))], failing);
      rows.push({ run: k + 1, cases: ids.length, failing: failing.size, v2_suite_order: a2, random_mean: ar, last_failed_first: alf, v3_risk: a3, optimal: opt, v3_ms: ms }); wins.total++; if (a3 > a2) wins.v3_vs_v2++; if (a3 > ar) wins.v3_vs_random++;
    }
    if (rows.length) { const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length; perProject.push({ project: p.key, runs_evaluated: rows.length, mean: { v2_suite_order: mean('v2_suite_order'), random_mean: mean('random_mean'), last_failed_first: mean('last_failed_first'), v3_risk: mean('v3_risk'), optimal: mean('optimal') }, rows }); }
  }
  const allRows = perProject.flatMap((p) => p.rows); const am = (k) => allRows.reduce((s, r) => s + r[k], 0) / allRows.length;
  out.apfd = { note: 'faults = failing test cases; run k is ordered using only runs < k; open-defect signal is excluded to avoid look-ahead; history of dataset projects is simulated', runs_evaluated: allRows.length, projects: perProject, overall: { v2_suite_order: am('v2_suite_order'), random_mean: am('random_mean'), last_failed_first: am('last_failed_first'), v3_risk: am('v3_risk'), optimal: am('optimal') }, wins };

  /* ---------- 5. Algorithm scaling (synthetic corpora built from real defect text) ---------- */
  const base = all.map((d) => defectText(d)); const R3 = rng(99); const scaling = [];
  const corpus = (n) => Array.from({ length: n }, (_, i) => ({ id: i, text: noisy2(base[Math.floor(R3() * base.length)], R3) }));
  function noisy2(t, r) { return tokenize(t).filter(() => r() > 0.3).concat(Array.from({ length: 4 }, () => `w${Math.floor(r() * 5000)}`)).join(' '); }
  for (const n of [250, 500, 1000, 2000, 4000, 8000, 16000]) {
    const docs = corpus(n); const row = { n };
    const reps = n <= 2000 ? 3 : 1; const bt = []; for (let r = 0; r < reps; r++) { const t0 = performance.now(); var ix = new SimilarityIndex().build(docs); bt.push(performance.now() - t0); } row.build_ms = median(bt);
    let t0 = performance.now(); const lp = ix.pairs(0.6, { mode: 'lsh' }); row.lsh_pairs_ms = performance.now() - t0; row.lsh_pairs = lp.length;
    t0 = performance.now(); const ip = ix.pairs(0.6, { mode: 'inv' }); row.inv_pairs_ms = performance.now() - t0; row.inv_pairs = ip.length;
    let cand = 0; for (const arr of ix.buckets.values()) cand += (arr.length * (arr.length - 1)) / 2; row.lsh_candidate_pairs_upper = cand; row.all_pairs = (n * (n - 1)) / 2;
    if (n <= 4000) { t0 = performance.now(); const bp = ix.pairs(0.6, { mode: 'brute' }); row.brute_pairs_ms = performance.now() - t0; row.brute_pairs = bp.length; row.lsh_recall_vs_brute = bp.length ? lp.length / bp.length : 1; row.inv_recall_vs_brute = bp.length ? ip.length / bp.length : 1; }
    const qs = docs.slice(0, 50).map((d) => d.text); t0 = performance.now(); for (const t of qs) ix.query(t, { k: 5, mode: 'lsh' }); row.query_lsh_ms = (performance.now() - t0) / qs.length;
    t0 = performance.now(); for (const t of qs) ix.query(t, { k: 5, mode: 'inv' }); row.query_inv_ms = (performance.now() - t0) / qs.length;
    t0 = performance.now(); for (const t of qs) ix.query(t, { k: 5, mode: 'brute' }); row.query_brute_ms = (performance.now() - t0) / qs.length;
    scaling.push(row); console.log('scaling', n, JSON.stringify({ build: Math.round(row.build_ms), lsh: Math.round(row.lsh_pairs_ms), inv: Math.round(row.inv_pairs_ms), brute: row.brute_pairs_ms && Math.round(row.brute_pairs_ms) }));
  }
  const slope = (xs, ys) => { const lx = xs.map(Math.log), ly = ys.map(Math.log); const mx = lx.reduce((a, b) => a + b) / lx.length, my = ly.reduce((a, b) => a + b) / ly.length; return lx.reduce((s, x, i) => s + (x - mx) * (ly[i] - my), 0) / lx.reduce((s, x) => s + (x - mx) ** 2, 0); };
  const sb = scaling.filter((r) => r.brute_pairs_ms);
  out.scaling = { rows: scaling, loglog_slope: { build: slope(scaling.map((r) => r.n), scaling.map((r) => r.build_ms)), lsh_pairs: slope(scaling.map((r) => r.n), scaling.map((r) => r.lsh_pairs_ms)), brute_pairs: slope(sb.map((r) => r.n), sb.map((r) => r.brute_pairs_ms)), inv_pairs: slope(scaling.map((r) => r.n), scaling.map((r) => r.inv_pairs_ms)), query_lsh: slope(scaling.map((r) => r.n), scaling.map((r) => r.query_lsh_ms)), query_inv: slope(scaling.map((r) => r.n), scaling.map((r) => r.query_inv_ms)), query_brute: slope(scaling.map((r) => r.n), scaling.map((r) => r.query_brute_ms)) } };

  const pr = []; for (const n of [1000, 10000, 100000, 1000000]) {
    const hist = ['failed', 'passed', 'passed', 'failed', 'passed']; const items = Array.from({ length: n }, (_, i) => ({ i, h: hist.slice(i % 3), p: ['P1', 'P2', 'P3', 'P4'][i % 4] }));
    const ts = []; for (let r = 0; r < 3; r++) { const t0 = performance.now(); items.map((x) => ({ i: x.i, r: riskScore({ hist: x.h, priority: x.p }) })).sort((a, b) => b.r - a.r || a.i - b.i); ts.push(performance.now() - t0); }
    pr.push({ n, ms: median(ts) });
  }
  out.scaling.prioritisation = pr; out.scaling.prioritisation_slope = slope(pr.map((r) => r.n), pr.map((r) => r.ms));

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log('written', OUT); await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
