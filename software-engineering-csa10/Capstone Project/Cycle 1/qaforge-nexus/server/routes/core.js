'use strict';
/** Auth, users, departments, organisation summary, notifications, audit log, metadata, demo lab. */
const { all, get, run, now } = require('../db');
const { HttpError } = require('../lib/http');
const A = require('../auth');
const { audit, needStr, optStr, oneOf, toInt, page } = require('../util');
const L = require('../lifecycle');
const E = require('../engine');
const demo = require('../demo-sut');

const auth = A.requireAuth;
const attempts = new Map(); // login throttling: key -> [timestamps]

function throttle(key, max, windowMs) {
  const t = Date.now();
  const list = (attempts.get(key) || []).filter((x) => t - x < windowMs);
  if (list.length >= max) throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.');
  list.push(t);
  attempts.set(key, list);
  if (attempts.size > 5000) for (const [k, v] of attempts) if (!v.some((x) => t - x < windowMs)) attempts.delete(k);
}

const publicUser = (u) => ({
  id: u.id, emp_code: u.emp_code, name: u.name, email: u.email, role: u.role,
  department_id: u.department_id, designation: u.designation, must_change_password: !!u.must_change_password,
  department: u.department_id ? (get('SELECT name FROM departments WHERE id = ?', u.department_id) || {}).name : null,
});

module.exports = function (app) {
  app.get('/api/health', (req, res) => res.json({ status: 'ok', time: now(), version: '1.0.0' }));

  /* ---------------- auth ---------------- */
  app.post('/api/auth/login', (req, res) => {
    const email = String((req.body || {}).email || '').trim().toLowerCase().slice(0, 200);
    const password = String((req.body || {}).password || '').slice(0, 200);
    if (!email || !password) throw new HttpError(400, 'Email and password are required');
    throttle(`${req.ip}|${email}`, 10, 10 * 60e3);
    const u = get('SELECT * FROM users WHERE email = ?', email);
    const generic = new HttpError(401, 'Invalid email or password');
    if (!u || !u.active) { audit(req, null, 'login.failed', 'user', email, 'unknown or inactive'); throw generic; }
    if (u.locked_until && u.locked_until > now()) throw new HttpError(423, 'Account temporarily locked after repeated failures. Try again in a few minutes.');
    if (!A.verifyPassword(password, u.password_hash)) {
      const fails = u.failed_logins + 1;
      if (fails >= 5) run('UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?', new Date(Date.now() + 15 * 60e3).toISOString(), u.id);
      else run('UPDATE users SET failed_logins = ? WHERE id = ?', fails, u.id);
      audit(req, u.id, 'login.failed', 'user', u.id, `attempt ${fails}`);
      throw generic;
    }
    run('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login = ? WHERE id = ?', now(), u.id);
    audit(req, u.id, 'login.success', 'user', u.id);
    res.json({ token: A.signToken({ sub: u.id }), user: publicUser(u) });
  });

  app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(get('SELECT * FROM users WHERE id = ?', req.user.id)) }));

  app.post('/api/auth/change-password', auth, (req, res) => {
    const { current_password: cur, new_password: nw } = req.body || {};
    const u = get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!A.verifyPassword(String(cur || ''), u.password_hash)) throw new HttpError(400, 'Current password is incorrect');
    const bad = A.validatePassword(nw);
    if (bad) throw new HttpError(400, bad);
    if (nw === cur) throw new HttpError(400, 'New password must differ from the current one');
    run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', A.hashPassword(nw), u.id);
    audit(req, u.id, 'password.changed', 'user', u.id);
    res.json({ ok: true });
  });

  /* ---------------- metadata ---------------- */
  app.get('/api/meta', auth, (req, res) => res.json({
    roles: A.ROLES,
    permissions: Object.keys(A.PERMS).filter((p) => A.can(req.user, p)),
    permissionMatrix: A.PERMS,
    statuses: L.STATUSES, severities: L.SEVERITIES, defectTypes: L.DEFECT_TYPES, slaHours: L.SLA_HOURS,
    flow: L.FLOW, rules: L.RULES,
    testTypes: ['functional', 'smoke', 'regression', 'negative', 'boundary', 'security', 'performance', 'integration', 'usability'],
    priorities: ['P1', 'P2', 'P3', 'P4'], methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'],
    assertionOps: E.OPS, assertionTypes: E.ASSERT_TYPES,
  }));

  /* ---------------- departments / org ---------------- */
  app.get('/api/departments', auth, (req, res) => res.json({
    items: all(`SELECT d.id, d.code, d.name, COUNT(u.id) AS headcount
                  FROM departments d LEFT JOIN users u ON u.department_id = d.id AND u.active = 1
                 GROUP BY d.id ORDER BY d.name`),
  }));

  app.get('/api/org/summary', auth, (req, res) => {
    res.json({
      headcount: get('SELECT COUNT(*) AS n FROM users WHERE active = 1').n,
      byDepartment: all(`SELECT d.name, COUNT(u.id) AS n FROM departments d LEFT JOIN users u ON u.department_id = d.id AND u.active = 1 GROUP BY d.id ORDER BY n DESC`),
      byRole: all(`SELECT role, COUNT(*) AS n FROM users WHERE active = 1 GROUP BY role ORDER BY n DESC`),
    });
  });

  /* ---------------- users ---------------- */
  app.get('/api/users', auth, (req, res) => {
    const pg = page(req.query, 25, 200);
    const where = []; const args = [];
    if (req.query.q) { where.push('(u.name LIKE ? OR u.email LIKE ? OR u.emp_code LIKE ?)'); const q = `%${String(req.query.q).slice(0, 60)}%`; args.push(q, q, q); }
    if (req.query.department_id) { where.push('u.department_id = ?'); args.push(Number(req.query.department_id)); }
    if (req.query.role && A.ROLES.includes(req.query.role)) { where.push('u.role = ?'); args.push(req.query.role); }
    if (req.query.active === '0' || req.query.active === '1') { where.push('u.active = ?'); args.push(Number(req.query.active)); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = get(`SELECT COUNT(*) AS n FROM users u ${w}`, ...args).n;
    const items = all(
      `SELECT u.id, u.emp_code, u.name, u.email, u.role, u.designation, u.active, u.last_login, u.department_id, d.name AS department
         FROM users u LEFT JOIN departments d ON d.id = u.department_id ${w}
        ORDER BY u.name LIMIT ? OFFSET ?`, ...args, pg.limit, pg.offset);
    res.json({ items, total, page: pg.page, limit: pg.limit });
  });

  app.post('/api/users', auth, A.perm('user.manage'), (req, res) => {
    const b = req.body || {};
    const name = needStr(b.name, 'name', { max: 100 });
    const email = needStr(b.email, 'email', { max: 200 }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'email is not valid');
    const role = oneOf(b.role, 'role', A.ROLES);
    const dept = toInt(b.department_id, 'department_id');
    if (dept && !get('SELECT 1 AS x FROM departments WHERE id = ?', dept)) throw new HttpError(400, 'Unknown department');
    if (get('SELECT 1 AS x FROM users WHERE email = ?', email)) throw new HttpError(409, 'A user with this email already exists');
    const temp = A.tempPassword();
    const n = get('SELECT COALESCE(MAX(id),0) + 1 AS n FROM users').n;
    const empCode = `NX-${String(n).padStart(4, '0')}`;
    const r = run(`INSERT INTO users(emp_code, name, email, password_hash, role, department_id, designation, must_change_password, created_at)
                   VALUES (?,?,?,?,?,?,?,1,?)`, empCode, name, email, A.hashPassword(temp), role, dept, optStr(b.designation, 'designation', 100), now());
    audit(req, req.user.id, 'user.created', 'user', r.lastInsertRowid, { email, role });
    res.json({ id: Number(r.lastInsertRowid), emp_code: empCode, temp_password: temp }, 201);
  });

  app.patch('/api/users/:id', auth, A.perm('user.manage'), (req, res) => {
    const id = Number(req.params.id);
    const u = get('SELECT * FROM users WHERE id = ?', id);
    if (!u) throw new HttpError(404, 'User not found');
    const b = req.body || {};
    const role = b.role !== undefined ? oneOf(b.role, 'role', A.ROLES) : u.role;
    const active = b.active !== undefined ? (b.active ? 1 : 0) : u.active;
    if (id === req.user.id && (!active || role !== 'admin')) throw new HttpError(400, 'You cannot deactivate or demote your own account');
    if (u.role === 'admin' && (role !== 'admin' || !active) &&
        get(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1`).n <= 1) throw new HttpError(400, 'At least one active administrator is required');
    const dept = b.department_id !== undefined ? toInt(b.department_id, 'department_id') : u.department_id;
    run('UPDATE users SET name=?, role=?, active=?, department_id=?, designation=? WHERE id=?',
      b.name !== undefined ? needStr(b.name, 'name', { max: 100 }) : u.name, role, active, dept,
      b.designation !== undefined ? optStr(b.designation, 'designation', 100) : u.designation, id);
    audit(req, req.user.id, 'user.updated', 'user', id, { role, active });
    res.json({ ok: true });
  });

  app.post('/api/users/:id/reset-password', auth, A.perm('user.manage'), (req, res) => {
    const id = Number(req.params.id);
    if (!get('SELECT 1 AS x FROM users WHERE id = ?', id)) throw new HttpError(404, 'User not found');
    const temp = A.tempPassword();
    run('UPDATE users SET password_hash = ?, must_change_password = 1, failed_logins = 0, locked_until = NULL WHERE id = ?', A.hashPassword(temp), id);
    audit(req, req.user.id, 'password.reset', 'user', id);
    res.json({ temp_password: temp });
  });

  /* ---------------- notifications ---------------- */
  app.get('/api/notifications', auth, (req, res) => res.json({
    unread: get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', req.user.id).n,
    items: all('SELECT id, message, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30', req.user.id),
  }));
  app.post('/api/notifications/read', auth, (req, res) => {
    run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', req.user.id);
    res.json({ ok: true });
  });

  /* ---------------- audit ---------------- */
  app.get('/api/audit', auth, A.perm('audit.view'), (req, res) => {
    const pg = page(req.query, 50, 200);
    const where = []; const args = [];
    if (req.query.action) { where.push('a.action LIKE ?'); args.push(`%${String(req.query.action).slice(0, 40)}%`); }
    if (req.query.q) { where.push('(u.name LIKE ? OR a.detail LIKE ? OR a.entity_id LIKE ?)'); const q = `%${String(req.query.q).slice(0, 60)}%`; args.push(q, q, q); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = get(`SELECT COUNT(*) AS n FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ${w}`, ...args).n;
    const items = all(`SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ${w}
                        ORDER BY a.id DESC LIMIT ? OFFSET ?`, ...args, pg.limit, pg.offset);
    res.json({ items, total, page: pg.page, limit: pg.limit });
  });

  /* ---------------- demo lab (switchable defects in the demo SUT) ---------------- */
  app.get('/api/demo/bugs', auth, A.perm('demo.lab'), (req, res) => {
    res.json({ bugs: demo.BUGS.map((b) => ({ ...b, fixed: demo.isFixed(b.id) })) });
  });
  app.post('/api/demo/bugs', auth, A.perm('demo.lab'), (req, res) => {
    const { id, fixed } = req.body || {};
    if (!demo.setFixed(String(id), !!fixed)) throw new HttpError(400, 'Unknown demo defect id');
    audit(req, req.user.id, fixed ? 'demo.fix_deployed' : 'demo.fix_reverted', 'demo-sut', id);
    res.json({ id, fixed: !!fixed });
  });
  app.post('/api/demo/reset', auth, A.perm('demo.lab'), (req, res) => {
    demo.reset(false);
    audit(req, req.user.id, 'demo.reset', 'demo-sut', null);
    res.json({ ok: true });
  });
};
