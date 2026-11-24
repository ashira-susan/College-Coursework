'use strict';
/**
 * Authentication (scrypt password hashing + HMAC-signed JWT) and role-based access control.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { get, DATA_DIR } = require('./db');
const { HttpError } = require('./lib/http');

/* ---------- secret ---------- */
function loadSecret() {
  if (process.env.QAF_SECRET) return process.env.QAF_SECRET;
  const file = path.join(DATA_DIR, '.secret');
  try { return fs.readFileSync(file, 'utf8').trim(); } catch (_) { /* create */ }
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();

/* ---------- passwords ---------- */
const SCRYPT_N = 16384;
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: SCRYPT_N, r: 8, p: 1 });
  return `scrypt$${SCRYPT_N}$${salt.toString('hex')}$${key.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [alg, n, saltHex, keyHex] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(keyHex, 'hex');
    const key = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length, { N: Number(n), r: 8, p: 1 });
    return crypto.timingSafeEqual(key, expected);
  } catch { return false; }
}
function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters';
  if (pw.length > 128) return 'Password is too long';
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return 'Password needs upper-case, lower-case and a digit';
  return null;
}
function tempPassword() {
  const a = crypto.randomBytes(9).toString('base64url');
  return `Tmp-${a}9aZ`;
}

/* ---------- tokens ---------- */
const b64u = (x) => Buffer.from(x).toString('base64url');
function signToken(payload, ttlSec = 8 * 3600) {
  const iat = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, iat, exp: iat + ttlSec }));
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(`${parts[0]}.${parts[1]}`).digest();
  let given;
  try { given = Buffer.from(parts[2], 'base64url'); } catch { return null; }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch { return null; }
}

/* ---------- RBAC ---------- */
const ROLES = ['admin', 'qa_manager', 'qa_engineer', 'developer', 'product_owner', 'viewer'];
const PERMS = {
  'user.manage': ['admin'],
  'audit.view': ['admin', 'qa_manager'],
  'project.create': ['admin', 'qa_manager'],
  'project.edit': ['admin', 'qa_manager'],
  'member.manage': ['admin', 'qa_manager'],
  'requirement.write': ['admin', 'qa_manager', 'qa_engineer', 'product_owner'],
  'testcase.write': ['admin', 'qa_manager', 'qa_engineer'],
  'run.execute': ['admin', 'qa_manager', 'qa_engineer'],
  'defect.create': ['admin', 'qa_manager', 'qa_engineer', 'developer', 'product_owner'],
  'defect.edit': ['admin', 'qa_manager', 'qa_engineer'],
  'defect.comment': ['admin', 'qa_manager', 'qa_engineer', 'developer', 'product_owner'],
  'defect.retest': ['admin', 'qa_manager', 'qa_engineer'],
  'demo.lab': ['admin', 'qa_manager', 'qa_engineer', 'developer'],
};
const can = (user, action) => !!user && (PERMS[action] || []).includes(user.role);

function requireAuth(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer (.+)$/.exec(h);
  const payload = m && verifyToken(m[1]);
  if (!payload) throw new HttpError(401, 'Authentication required');
  const u = get('SELECT id, emp_code, name, email, role, department_id, designation, active, must_change_password FROM users WHERE id = ?', payload.sub);
  if (!u || !u.active) throw new HttpError(401, 'Account is inactive or no longer exists');
  req.user = u;
}
const perm = (action) => (req) => {
  if (!can(req.user, action)) throw new HttpError(403, 'You do not have permission to perform this action');
};

/* project scoping: admins and QA managers see every project; others only their own */
function projectAccess(user, projectId) {
  if (user.role === 'admin' || user.role === 'qa_manager') return true;
  return !!get('SELECT 1 AS x FROM project_members WHERE project_id = ? AND user_id = ?', projectId, user.id);
}
function accessibleProjectIds(user) {
  const { all } = require('./db');
  if (user.role === 'admin' || user.role === 'qa_manager') return all('SELECT id FROM projects').map((r) => r.id);
  return all('SELECT project_id AS id FROM project_members WHERE user_id = ?', user.id).map((r) => r.id);
}
function projectGuard(req) {
  const ref = req.params.pid;
  const p = /^\d+$/.test(ref)
    ? get('SELECT * FROM projects WHERE id = ?', Number(ref))
    : get('SELECT * FROM projects WHERE key = ?', String(ref).toUpperCase());
  if (!p) throw new HttpError(404, 'Project not found');
  if (!projectAccess(req.user, p.id)) throw new HttpError(403, 'You are not a member of this project');
  req.project = p;
}

module.exports = {
  hashPassword, verifyPassword, validatePassword, tempPassword, signToken, verifyToken,
  ROLES, PERMS, can, requireAuth, perm, projectAccess, accessibleProjectIds, projectGuard,
};
