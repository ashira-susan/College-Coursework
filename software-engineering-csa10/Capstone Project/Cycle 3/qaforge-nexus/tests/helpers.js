'use strict';
/** Shared helpers: throw-away PostgreSQL database + real server process per test file. */
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool, parseUrl } = require('../server/pgclient');

const ROOT = path.join(__dirname, '..');
const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL || 'postgres://qaforge:qaforge@127.0.0.1:5432/postgres';

async function createDatabase() {
  const name = `qaf_test_${crypto.randomBytes(4).toString('hex')}`;
  const admin = new Pool(ADMIN_URL, { max: 1 });
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const cfg = parseUrl(ADMIN_URL);
  const url = `postgres://${encodeURIComponent(cfg.user)}:${encodeURIComponent(cfg.password)}@${cfg.host}:${cfg.port}/${name}`;
  return { name, url };
}
async function dropDatabase(name) {
  const admin = new Pool(ADMIN_URL, { max: 1 });
  try { await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`); } finally { await admin.end(); }
}

async function startPlatform({ minimal }) {
  const db = await createDatabase();
  const port = 4500 + Math.floor(Math.random() * 400);
  const env = { ...process.env, DATABASE_URL: db.url, PORT: String(port), HOST: '127.0.0.1', QAF_SECRET: 'test-secret', QAF_DATA_DIR: require('node:os').tmpdir() };
  const s = spawnSync(process.execPath, [path.join(ROOT, 'server/seed.js'), minimal ? '--minimal' : '--reset'], { env, encoding: 'utf8' });
  if (s.status !== 0) throw new Error(`seed failed: ${s.stderr || s.stdout}`);
  const server = spawn(process.execPath, [path.join(ROOT, 'server/index.js')], { env, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 200));
    if (i === 79) throw new Error('server did not start');
  }
  return { base, db, stop: async () => { server.kill(); await new Promise((r) => setTimeout(r, 300)); await dropDatabase(db.name); }, url: db.url };
}

function client(base) {
  async function api(method, url, { token, body, raw } = {}) {
    const res = await fetch(base + url, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (raw) return res;
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text };
  }
  const D = 'nexora-tech.example';
  async function login(email, password = 'Nexus@123') {
    const r = await api('POST', '/api/auth/login', { body: { email, password } });
    if (r.status !== 200) throw new Error(`login ${email}: ${r.text}`);
    return { token: r.json.token, user: r.json.user };
  }
  return { api, login, D };
}
module.exports = { startPlatform, client, createDatabase, dropDatabase };
