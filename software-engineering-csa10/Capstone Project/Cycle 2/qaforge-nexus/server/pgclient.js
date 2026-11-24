'use strict';
/**
 * QAForge Nexus - minimal PostgreSQL client (zero dependencies).
 *
 * Implements the PostgreSQL v3 frontend/backend protocol over node:net / node:tls:
 *   - authentication: trust, cleartext, md5, SCRAM-SHA-256
 *   - optional TLS (sslmode=require|prefer in the connection URL)
 *   - extended query protocol with bind parameters (SQL injection safe), simple protocol for DDL scripts
 *   - text result decoding by type OID (int, bigint, numeric, float, bool, json/jsonb as raw text, timestamps as ISO strings)
 *   - a small connection pool with dedicated connections for transactions
 *
 * The public surface (Pool#query, Pool#connect -> client.query / client.release) intentionally mirrors the
 * popular `pg` package, so it can be swapped for `pg` in environments that allow npm installs.
 */
const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');

const OID = { BOOL: 16, INT8: 20, INT2: 21, INT4: 23, OID: 26, FLOAT4: 700, FLOAT8: 701, NUMERIC: 1700, DATE: 1082, TIMESTAMP: 1114, TIMESTAMPTZ: 1184 };

function parseValue(oid, text) {
  switch (oid) {
    case OID.BOOL: return text === 't';
    case OID.INT2: case OID.INT4: case OID.OID: case OID.INT8: case OID.FLOAT4: case OID.FLOAT8: case OID.NUMERIC: return Number(text);
    case OID.TIMESTAMPTZ: { const d = new Date(text.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')); return Number.isNaN(d.getTime()) ? text : d.toISOString(); }
    case OID.TIMESTAMP: { const d = new Date(text.replace(' ', 'T') + 'Z'); return Number.isNaN(d.getTime()) ? text : d.toISOString(); }
    default: return text; // text, varchar, json, jsonb (raw string), date ...
  }
}

class PgError extends Error {
  constructor(fields) {
    super(fields.M || 'PostgreSQL error');
    this.name = 'PgError';
    this.code = fields.C; this.severity = fields.S; this.detail = fields.D; this.hint = fields.H;
    this.constraint = fields.n; this.table = fields.t; this.column = fields.c; this.position = fields.P;
  }
}

function parseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname || '127.0.0.1', port: Number(u.port || 5432), user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''), database: decodeURIComponent(u.pathname.replace(/^\//, '') || u.username || 'postgres'),
    sslmode: u.searchParams.get('sslmode') || process.env.PGSSLMODE || 'disable',
  };
}

const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; };
const i16 = (n) => { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; };
const cstr = (s) => Buffer.concat([Buffer.from(String(s), 'utf8'), Buffer.from([0])]);
const msg = (type, ...parts) => { const body = Buffer.concat(parts); return Buffer.concat([Buffer.from(type), i32(body.length + 4), body]); };

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256 = (data) => crypto.createHash('sha256').update(data).digest();

class Connection {
  constructor(cfg) {
    this.cfg = cfg; this.buf = Buffer.alloc(0); this.queue = []; this.current = null; this.ready = false; this.closed = false;
    this.params = {}; this.inTx = false;
  }

  async open() {
    const { host, port, sslmode } = this.cfg;
    let socket = await new Promise((resolve, reject) => {
      const s = net.connect({ host, port }); s.setNoDelay(true);
      s.once('connect', () => resolve(s)); s.once('error', reject);
    });
    if (sslmode === 'require' || sslmode === 'prefer' || sslmode === 'verify-full') {
      socket.write(Buffer.concat([i32(8), i32(80877103)]));
      const ans = await new Promise((resolve) => socket.once('data', (d) => resolve(d.toString('latin1', 0, 1))));
      if (ans === 'S') {
        socket = tls.connect({ socket, servername: host, rejectUnauthorized: sslmode === 'verify-full' });
        await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); });
      } else if (sslmode !== 'prefer') throw new Error('PostgreSQL server does not support TLS');
    }
    this.socket = socket;
    socket.on('data', (d) => this._onData(d));
    socket.on('error', (e) => this._fail(e));
    socket.on('close', () => { this.closed = true; this._fail(new Error('PostgreSQL connection closed')); });
    await new Promise((resolve, reject) => { this._startup = { resolve, reject }; this._sendStartup(); });
    return this;
  }

  _sendStartup() {
    const { user, database } = this.cfg;
    const body = Buffer.concat([i32(196608), cstr('user'), cstr(user), cstr('database'), cstr(database), cstr('client_encoding'), cstr('UTF8'),
      cstr('application_name'), cstr('qaforge-nexus'), Buffer.from([0])]);
    this.socket.write(Buffer.concat([i32(body.length + 4), body]));
  }

  _fail(err) {
    if (this._startup) { const s = this._startup; this._startup = null; s.reject(err); }
    if (this.current) { const c = this.current; this.current = null; c.reject(err); }
    for (const j of this.queue.splice(0)) j.reject(err);
  }

  _onData(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 5) {
      const len = this.buf.readInt32BE(1);
      if (this.buf.length < len + 1) break;
      const type = String.fromCharCode(this.buf[0]);
      const body = this.buf.subarray(5, len + 1);
      this.buf = this.buf.subarray(len + 1);
      try { this._onMessage(type, body); } catch (e) { this._fail(e); }
    }
  }

  _onMessage(type, b) {
    switch (type) {
      case 'R': return this._onAuth(b);
      case 'S': { const [k, v] = b.toString('utf8').split('\0'); this.params[k] = v; return undefined; }
      case 'K': return undefined;
      case 'Z': {
        this.inTx = String.fromCharCode(b[0]) !== 'I';
        if (this._startup) { const s = this._startup; this._startup = null; this.ready = true; s.resolve(); return undefined; }
        const c = this.current; this.current = null;
        if (c) { if (c.error) c.reject(c.error); else c.resolve(c.result); }
        return this._next();
      }
      case 'E': {
        const fields = {};
        let i = 0;
        while (i < b.length && b[i] !== 0) { const code = String.fromCharCode(b[i]); const end = b.indexOf(0, i + 1); fields[code] = b.toString('utf8', i + 1, end); i = end + 1; }
        const err = new PgError(fields);
        if (this._startup) { const s = this._startup; this._startup = null; s.reject(err); return undefined; }
        if (this.current && !this.current.error) this.current.error = err;
        return undefined;
      }
      case 'T': {
        const n = b.readInt16BE(0); let o = 2; const fields = [];
        for (let k = 0; k < n; k++) { const end = b.indexOf(0, o); const name = b.toString('utf8', o, end); o = end + 1; fields.push({ name, oid: b.readInt32BE(o + 6) }); o += 18; }
        if (this.current) this.current.fields = fields;
        return undefined;
      }
      case 'D': {
        const c = this.current; if (!c || !c.fields) return undefined;
        const n = b.readInt16BE(0); let o = 2; const row = {};
        for (let k = 0; k < n; k++) {
          const l = b.readInt32BE(o); o += 4;
          if (l === -1) row[c.fields[k].name] = null;
          else { row[c.fields[k].name] = parseValue(c.fields[k].oid, b.toString('utf8', o, o + l)); o += l; }
        }
        c.result.rows.push(row);
        return undefined;
      }
      case 'C': {
        if (this.current) { const tag = b.toString('utf8', 0, b.length - 1); const m = tag.match(/(\d+)$/); this.current.result.command = tag.split(' ')[0]; this.current.result.rowCount = m ? Number(m[1]) : 0; }
        return undefined;
      }
      default: return undefined; // '1','2','3','n','t','N','I','s' - nothing to do
    }
  }

  _onAuth(b) {
    const code = b.readInt32BE(0);
    const { user, password } = this.cfg;
    if (code === 0) return undefined;
    if (code === 3) { this.socket.write(msg('p', cstr(password))); return undefined; }
    if (code === 5) {
      const inner = crypto.createHash('md5').update(password + user).digest('hex');
      const outer = crypto.createHash('md5').update(Buffer.concat([Buffer.from(inner), b.subarray(4, 8)])).digest('hex');
      this.socket.write(msg('p', cstr('md5' + outer))); return undefined;
    }
    if (code === 10) { // SASL: choose SCRAM-SHA-256
      this._nonce = crypto.randomBytes(18).toString('base64');
      this._clientFirstBare = `n=*,r=${this._nonce}`;
      const first = Buffer.from(`n,,${this._clientFirstBare}`);
      this.socket.write(msg('p', cstr('SCRAM-SHA-256'), i32(first.length), first)); return undefined;
    }
    if (code === 11) {
      const serverFirst = b.toString('utf8', 4);
      const kv = Object.fromEntries(serverFirst.split(',').map((p) => [p[0], p.slice(2)]));
      if (!kv.r.startsWith(this._nonce)) throw new Error('SCRAM: server nonce mismatch');
      const salted = crypto.pbkdf2Sync(password, Buffer.from(kv.s, 'base64'), Number(kv.i), 32, 'sha256');
      const clientKey = hmac(salted, 'Client Key');
      const withoutProof = `c=biws,r=${kv.r}`;
      const authMessage = `${this._clientFirstBare},${serverFirst},${withoutProof}`;
      const sig = hmac(sha256(clientKey), authMessage);
      const proof = Buffer.from(clientKey.map((v, i) => v ^ sig[i])).toString('base64');
      this._serverSig = hmac(hmac(salted, 'Server Key'), authMessage).toString('base64');
      this.socket.write(msg('p', Buffer.from(`${withoutProof},p=${proof}`))); return undefined;
    }
    if (code === 12) {
      const v = b.toString('utf8', 4);
      if (v !== `v=${this._serverSig}`) throw new Error('SCRAM: server signature mismatch');
      return undefined;
    }
    throw new Error(`Unsupported PostgreSQL authentication method (${code})`);
  }

  _next() {
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift();
    this.current = { ...job, result: { rows: [], rowCount: 0, command: null }, fields: null, error: null };
    this.socket.write(job.packet);
  }

  _enqueue(packet) {
    if (this.closed) return Promise.reject(new Error('PostgreSQL connection is closed'));
    return new Promise((resolve, reject) => { this.queue.push({ packet, resolve, reject }); this._next(); });
  }

  /** Parameterised query (extended protocol). */
  query(sql, params = []) {
    const enc = params.map((p) => {
      if (p === null || p === undefined) return i32(-1);
      const v = p instanceof Date ? p.toISOString() : typeof p === 'object' ? JSON.stringify(p) : String(p);
      const bytes = Buffer.from(v, 'utf8'); return Buffer.concat([i32(bytes.length), bytes]);
    });
    const packet = Buffer.concat([
      msg('P', cstr(''), cstr(sql), i16(0)),
      msg('B', cstr(''), cstr(''), i16(0), i16(params.length), ...enc, i16(0)),
      msg('D', Buffer.from('P'), cstr('')),
      msg('E', cstr(''), i32(0)),
      msg('S'),
    ]);
    return this._enqueue(packet);
  }

  /** Simple protocol - may contain several statements (used for schema scripts). */
  exec(sql) { return this._enqueue(msg('Q', cstr(sql))); }

  close() { this.closed = true; try { this.socket.write(msg('X')); this.socket.end(); } catch (_) { /* ignore */ } }
}

class Pool {
  constructor(url, { max = 10 } = {}) {
    this.cfg = typeof url === 'string' ? parseUrl(url) : url; this.max = max;
    this.idle = []; this.total = 0; this.waiters = [];
  }

  async _create() { this.total++; try { return await new Connection(this.cfg).open(); } catch (e) { this.total--; throw e; } }

  async connect() {
    let c = this.idle.pop();
    while (c && c.closed) { this.total--; c = this.idle.pop(); }
    if (!c) {
      if (this.total < this.max) c = await this._create();
      else c = await new Promise((resolve) => this.waiters.push(resolve));
    }
    c.release = () => {
      if (c.closed) { this.total--; return; }
      const w = this.waiters.shift();
      if (w) w(c); else this.idle.push(c);
    };
    return c;
  }

  async query(sql, params) {
    const c = await this.connect();
    try { return await c.query(sql, params); } finally { c.release(); }
  }

  async exec(sql) {
    const c = await this.connect();
    try { return await c.exec(sql); } finally { c.release(); }
  }

  async end() { for (const c of this.idle.splice(0)) c.close(); this.total = 0; }
}

module.exports = { Pool, Connection, PgError, parseUrl };
