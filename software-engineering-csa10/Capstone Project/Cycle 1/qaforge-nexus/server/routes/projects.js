'use strict';
/** Projects, membership, requirements and suites. */
const { all, get, run, now, nextCode } = require('../db');
const { HttpError } = require('../lib/http');
const A = require('../auth');
const { audit, needStr, optStr, oneOf, toInt } = require('../util');
const { OPEN } = require('../lifecycle');

const auth = A.requireAuth;
const guard = A.projectGuard;
const inList = (arr) => (arr.length ? arr.map(() => '?').join(',') : 'NULL');
const OPEN_SQL = OPEN.map((s) => `'${s}'`).join(',');

function validBaseUrl(v) {
  const s = optStr(v, 'base_url', 300);
  if (!s) return null;
  if (!/^\/[\w\-./]*$/.test(s) && !/^https?:\/\/[^\s]+$/i.test(s)) throw new HttpError(400, 'base_url must start with http://, https:// or / (for the built-in demo target)');
  return s;
}

function projectRows(ids) {
  return all(
    `SELECT p.*, o.name AS owner_name,
       (SELECT COUNT(*) FROM test_cases t WHERE t.project_id = p.id AND t.status != 'deprecated') AS test_cases,
       (SELECT COUNT(*) FROM test_cases t WHERE t.project_id = p.id AND t.status != 'deprecated' AND t.automated = 1) AS automated_cases,
       (SELECT COUNT(*) FROM requirements r WHERE r.project_id = p.id) AS requirements,
       (SELECT COUNT(*) FROM defects d WHERE d.project_id = p.id AND d.status IN (${OPEN_SQL})) AS open_defects,
       (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS members,
       (SELECT ROUND(tr.passed * 100.0 / NULLIF(tr.total, 0), 1) FROM test_runs tr
         WHERE tr.project_id = p.id AND tr.status = 'completed' ORDER BY tr.started_at DESC, tr.id DESC LIMIT 1) AS last_pass_rate,
       (SELECT MAX(started_at) FROM test_runs tr WHERE tr.project_id = p.id) AS last_run_at
     FROM projects p LEFT JOIN users o ON o.id = p.owner_id
     WHERE p.id IN (${inList(ids)}) ORDER BY p.name`, ...ids);
}

module.exports = function (app) {
  /* ---------------- projects ---------------- */
  app.get('/api/projects', auth, (req, res) => res.json({ items: projectRows(A.accessibleProjectIds(req.user)) }));

  app.post('/api/projects', auth, A.perm('project.create'), (req, res) => {
    const b = req.body || {};
    const key = needStr(b.key, 'key', { max: 8 }).toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,7}$/.test(key)) throw new HttpError(400, 'key must be 2-8 upper-case letters/digits');
    if (get('SELECT 1 AS x FROM projects WHERE key = ?', key)) throw new HttpError(409, 'A project with this key already exists');
    const r = run('INSERT INTO projects(key, name, description, base_url, owner_id, created_at) VALUES (?,?,?,?,?,?)',
      key, needStr(b.name, 'name', { max: 120 }), optStr(b.description, 'description', 2000), validBaseUrl(b.base_url), req.user.id, now());
    const id = Number(r.lastInsertRowid);
    run('INSERT OR IGNORE INTO project_members(project_id, user_id) VALUES (?,?)', id, req.user.id);
    audit(req, req.user.id, 'project.created', 'project', id, { key });
    res.json({ id, key }, 201);
  });

  app.get('/api/projects/:pid', auth, guard, (req, res) => {
    const p = projectRows([req.project.id])[0];
    const members = all(
      `SELECT u.id, u.name, u.email, u.role, u.designation, d.name AS department
         FROM project_members m JOIN users u ON u.id = m.user_id LEFT JOIN departments d ON d.id = u.department_id
        WHERE m.project_id = ? ORDER BY u.role, u.name`, req.project.id);
    res.json({ project: p, members });
  });

  app.patch('/api/projects/:pid', auth, guard, A.perm('project.edit'), (req, res) => {
    const b = req.body || {}; const p = req.project;
    run('UPDATE projects SET name=?, description=?, base_url=?, status=? WHERE id=?',
      b.name !== undefined ? needStr(b.name, 'name', { max: 120 }) : p.name,
      b.description !== undefined ? optStr(b.description, 'description', 2000) : p.description,
      b.base_url !== undefined ? validBaseUrl(b.base_url) : p.base_url,
      b.status !== undefined ? oneOf(b.status, 'status', ['active', 'archived']) : p.status, p.id);
    audit(req, req.user.id, 'project.updated', 'project', p.id);
    res.json({ ok: true });
  });

  /* ---------------- members ---------------- */
  app.post('/api/projects/:pid/members', auth, guard, A.perm('member.manage'), (req, res) => {
    const uid = toInt((req.body || {}).user_id, 'user_id', { required: true });
    const u = get('SELECT id, active FROM users WHERE id = ?', uid);
    if (!u || !u.active) throw new HttpError(400, 'User not found or inactive');
    run('INSERT OR IGNORE INTO project_members(project_id, user_id) VALUES (?,?)', req.project.id, uid);
    audit(req, req.user.id, 'member.added', 'project', req.project.id, { user_id: uid });
    res.json({ ok: true }, 201);
  });
  app.delete('/api/projects/:pid/members/:uid', auth, guard, A.perm('member.manage'), (req, res) => {
    run('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', req.project.id, Number(req.params.uid));
    audit(req, req.user.id, 'member.removed', 'project', req.project.id, { user_id: Number(req.params.uid) });
    res.json({ ok: true });
  });

  /* ---------------- requirements ---------------- */
  app.get('/api/projects/:pid/requirements', auth, guard, (req, res) => res.json({
    items: all(`SELECT r.*, (SELECT COUNT(*) FROM test_cases t WHERE t.requirement_id = r.id AND t.status != 'deprecated') AS cases
                  FROM requirements r WHERE r.project_id = ? ORDER BY r.code`, req.project.id),
  }));
  app.post('/api/projects/:pid/requirements', auth, guard, A.perm('requirement.write'), (req, res) => {
    const b = req.body || {};
    const code = nextCode(req.project.id, 'requirement', 'REQ', 3);
    const r = run('INSERT INTO requirements(project_id, code, title, description, priority, status, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)',
      req.project.id, code, needStr(b.title, 'title', { max: 200 }), optStr(b.description, 'description'),
      oneOf(b.priority, 'priority', ['P1', 'P2', 'P3', 'P4'], 'P2'), oneOf(b.status, 'status', ['draft', 'approved', 'retired'], 'approved'), req.user.id, now());
    audit(req, req.user.id, 'requirement.created', 'requirement', r.lastInsertRowid, { code });
    res.json({ id: Number(r.lastInsertRowid), code }, 201);
  });
  app.patch('/api/requirements/:id', auth, A.perm('requirement.write'), (req, res) => {
    const r = get('SELECT * FROM requirements WHERE id = ?', Number(req.params.id));
    if (!r) throw new HttpError(404, 'Requirement not found');
    if (!A.projectAccess(req.user, r.project_id)) throw new HttpError(403, 'You are not a member of this project');
    const b = req.body || {};
    run('UPDATE requirements SET title=?, description=?, priority=?, status=? WHERE id=?',
      b.title !== undefined ? needStr(b.title, 'title', { max: 200 }) : r.title,
      b.description !== undefined ? optStr(b.description, 'description') : r.description,
      b.priority !== undefined ? oneOf(b.priority, 'priority', ['P1', 'P2', 'P3', 'P4']) : r.priority,
      b.status !== undefined ? oneOf(b.status, 'status', ['draft', 'approved', 'retired']) : r.status, r.id);
    audit(req, req.user.id, 'requirement.updated', 'requirement', r.id);
    res.json({ ok: true });
  });

  /* ---------------- suites ---------------- */
  app.get('/api/projects/:pid/suites', auth, guard, (req, res) => res.json({
    items: all(`SELECT s.*, (SELECT COUNT(*) FROM test_cases t WHERE t.suite_id = s.id AND t.status != 'deprecated') AS cases
                  FROM suites s WHERE s.project_id = ? ORDER BY s.sort_order, s.id`, req.project.id),
  }));
  app.post('/api/projects/:pid/suites', auth, guard, A.perm('testcase.write'), (req, res) => {
    const b = req.body || {};
    const order = get('SELECT COALESCE(MAX(sort_order),0) + 1 AS n FROM suites WHERE project_id = ?', req.project.id).n;
    const r = run('INSERT INTO suites(project_id, name, description, sort_order, created_at) VALUES (?,?,?,?,?)',
      req.project.id, needStr(b.name, 'name', { max: 120 }), optStr(b.description, 'description', 1000), order, now());
    audit(req, req.user.id, 'suite.created', 'suite', r.lastInsertRowid);
    res.json({ id: Number(r.lastInsertRowid) }, 201);
  });
  app.patch('/api/suites/:id', auth, A.perm('testcase.write'), (req, res) => {
    const s = get('SELECT * FROM suites WHERE id = ?', Number(req.params.id));
    if (!s) throw new HttpError(404, 'Suite not found');
    if (!A.projectAccess(req.user, s.project_id)) throw new HttpError(403, 'You are not a member of this project');
    const b = req.body || {};
    run('UPDATE suites SET name=?, description=? WHERE id=?',
      b.name !== undefined ? needStr(b.name, 'name', { max: 120 }) : s.name,
      b.description !== undefined ? optStr(b.description, 'description', 1000) : s.description, s.id);
    res.json({ ok: true });
  });
};
