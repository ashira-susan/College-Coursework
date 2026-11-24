'use strict';
/** v3.0 analytics endpoints: duplicate detection (TF-IDF + MinHash-LSH) and risk-based test prioritisation. */
const { all, get } = require('../db');
const { HttpError } = require('../lib/http');
const A = require('../auth');
const { SimilarityIndex, defectText } = require('../similarity');
const { riskScore } = require('../prioritize');
const L = require('../lifecycle');

const auth = A.requireAuth;
const guard = A.projectGuard;
const cache = new Map(); // projectId -> { stamp, index, byId }

async function indexFor(projectId) {
  const st = await get('SELECT COUNT(*) AS n, MAX(updated_at) AS m FROM defects WHERE project_id = ?', projectId);
  const stamp = `${st.n}|${st.m}`;
  const hit = cache.get(projectId);
  if (hit && hit.stamp === stamp) return hit;
  const rows = await all('SELECT id, code, title, description, actual, status, severity FROM defects WHERE project_id = ?', projectId);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const index = new SimilarityIndex({ k: 64, bands: 16 }).build(rows.map((r) => ({ id: r.id, text: defectText(r) })));
  const entry = { stamp, index, byId }; cache.set(projectId, entry); return entry;
}
const brief = (d) => ({ id: d.id, code: d.code, title: d.title, status: d.status, severity: d.severity });

module.exports = function (app) {
  /** Defects most similar to this one (possible duplicates). */
  app.get('/api/defects/:id/similar', auth, async (req, res) => {
    const d = await get('SELECT * FROM defects WHERE id = ?', Number(req.params.id));
    if (!d) throw new HttpError(404, 'Defect not found');
    if (!await A.projectAccess(req.user, d.project_id)) throw new HttpError(403, 'You are not a member of this project');
    const k = Math.min(20, Math.max(1, Number(req.query.k) || 5)); const min = Math.max(0, Math.min(1, Number(req.query.min) || 0.3));
    const { index, byId } = await indexFor(d.project_id);
    const hits = index.query(defectText(d), { k, minScore: min, excludeId: d.id, mode: ['brute', 'lsh'].includes(req.query.mode) ? req.query.mode : 'inv' });
    res.json({ defect: d.code, items: hits.map((h) => ({ ...brief(byId.get(h.id)), score: h.score })) });
  });

  /** Duplicate clusters of a project (connected components over pairs with cosine >= threshold). */
  app.get('/api/projects/:pid/duplicates', auth, guard, async (req, res) => {
    const th = Math.max(0.2, Math.min(0.99, Number(req.query.threshold) || 0.6));
    const { index, byId } = await indexFor(req.project.id);
    const { clusters, pairs } = index.clusters(th, { mode: ['brute', 'lsh'].includes(req.query.mode) ? req.query.mode : 'inv' });
    res.json({ threshold: th, defects: byId.size, pairs: pairs.length, clusters: clusters.map((c) => c.map((id) => brief(byId.get(id)))) });
  });

  /** Test cases ordered by failure risk (highest first). */
  app.get('/api/projects/:pid/prioritized-cases', auth, guard, async (req, res) => {
    const pid = req.project.id; const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 100));
    const cases = await all(`SELECT id, code, title, priority, automated FROM test_cases WHERE project_id = ? AND status != 'deprecated' ORDER BY sort_order, id`, pid);
    const hist = await all(
      `SELECT test_case_id, status FROM (
         SELECT tr.test_case_id, tr.status, ROW_NUMBER() OVER (PARTITION BY tr.test_case_id ORDER BY tr.executed_at DESC, tr.id DESC) AS rn
           FROM test_results tr JOIN test_cases tc ON tc.id = tr.test_case_id WHERE tc.project_id = ? AND tr.prereq = 0) x
        WHERE rn <= 8 ORDER BY test_case_id, rn`, pid);
    const open = await all(
      `SELECT test_case_id, MIN(CASE severity WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END) AS s FROM defects
        WHERE project_id = ? AND test_case_id IS NOT NULL AND status IN (${L.OPEN.map((x) => `'${x}'`).join(',')}) GROUP BY test_case_id`, pid);
    const H = new Map(); for (const h of hist) { if (!H.has(h.test_case_id)) H.set(h.test_case_id, []); H.get(h.test_case_id).push(h.status); }
    const O = new Map(open.map((o) => [o.test_case_id, ['Critical', 'High', 'Medium', 'Low'][o.s]]));
    const scored = cases.map((c, i) => ({ ...c, pos: i, risk: Math.round(riskScore({ hist: H.get(c.id) || [], openSeverity: O.get(c.id) || null, priority: c.priority }) * 1e4) / 1e4 }));
    scored.sort((a, b) => b.risk - a.risk || a.pos - b.pos);
    res.json({ total: scored.length, items: scored.slice(0, limit).map((c, i) => ({ rank: i + 1, id: c.id, code: c.code, title: c.title, priority: c.priority, risk: c.risk })) });
  });
};
module.exports.indexFor = indexFor;
