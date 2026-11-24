'use strict';
const { run, now } = require('./db');
const { HttpError } = require('./lib/http');

function audit(req, actorId, action, entity, entityId, detail) {
  run(
    'INSERT INTO audit_log(actor_id, action, entity, entity_id, detail, ip, created_at) VALUES(?,?,?,?,?,?,?)',
    actorId || null, action, entity || null, entityId == null ? null : String(entityId),
    detail == null ? null : typeof detail === 'string' ? detail : JSON.stringify(detail),
    (req && req.ip) || null, now()
  );
}

function notify(userId, message, link) {
  if (!userId) return;
  run('INSERT INTO notifications(user_id, message, link, created_at) VALUES(?,?,?,?)', userId, message, link || null, now());
}

const pj = (s, d = null) => {
  if (s == null || s === '') return d;
  try { return JSON.parse(s); } catch { return d; }
};

/* ---- validation helpers ---- */
function needStr(v, name, { min = 1, max = 500 } = {}) {
  if (typeof v !== 'string' || v.trim().length < min) throw new HttpError(400, `${name} is required`);
  if (v.length > max) throw new HttpError(400, `${name} is too long (max ${max} characters)`);
  return v.trim();
}
function optStr(v, name, max = 5000) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw new HttpError(400, `${name} must be text`);
  if (v.length > max) throw new HttpError(400, `${name} is too long (max ${max} characters)`);
  return v.trim();
}
function oneOf(v, name, list, def) {
  if (v == null || v === '') {
    if (def !== undefined) return def;
    throw new HttpError(400, `${name} is required`);
  }
  if (!list.includes(v)) throw new HttpError(400, `${name} must be one of: ${list.join(', ')}`);
  return v;
}
function toInt(v, name, { required = false, min = -Infinity, max = Infinity } = {}) {
  if (v == null || v === '') {
    if (required) throw new HttpError(400, `${name} is required`);
    return null;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${name} must be an integer${min > -Infinity ? ` >= ${min}` : ''}`);
  return n;
}
function page(q, defLimit = 25, maxLimit = 200) {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || defLimit, 1), maxLimit);
  const pg = Math.max(parseInt(q.page, 10) || 1, 1);
  return { limit, page: pg, offset: (pg - 1) * limit };
}

/* ---- CSV (with spreadsheet formula-injection protection) ---- */
function csvCell(v) {
  if (v == null) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCsv(rows, cols) {
  const head = cols.map((c) => csvCell(c.label || c.key)).join(',');
  const body = rows.map((r) => cols.map((c) => csvCell(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','));
  return [head, ...body].join('\r\n') + '\r\n';
}

module.exports = { audit, notify, pj, needStr, optStr, oneOf, toInt, page, toCsv };
