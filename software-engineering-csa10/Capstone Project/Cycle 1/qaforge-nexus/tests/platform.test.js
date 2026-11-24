'use strict';
/**
 * QAForge Nexus - end-to-end integration tests (Node built-in test runner).
 * Spawns a real server on a throw-away database and drives it over HTTP, exactly like a browser would.
 *   npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PORT = 4500 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'qaf-test-'));
const ENV = { ...process.env, QAF_DATA_DIR: DATA, PORT: String(PORT), HOST: '127.0.0.1', QAF_SECRET: 'test-secret' };
const NODE = ['--disable-warning=ExperimentalWarning'];
const PASSWORD = 'Nexus@123';
let server;

async function api(method, url, { token, body, raw } = {}) {
  const res = await fetch(BASE + url, {
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
async function login(email) {
  const r = await api('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  assert.equal(r.status, 200, `login ${email}: ${r.text}`);
  return { token: r.json.token, user: r.json.user };
}
const D = 'nexora-tech.example';
const waitRun = async (token, id) => {
  for (let i = 0; i < 120; i++) {
    const r = await api('GET', `/api/runs/${id}`, { token });
    if (['completed', 'failed', 'passed', 'finished'].includes(r.json.run.status) || r.json.run.finished_at) return r.json;
    await new Promise((s) => setTimeout(s, 250));
  }
  throw new Error('run did not finish');
};

test.before(async () => {
  const s = spawnSync(process.execPath, [...NODE, path.join(ROOT, 'server/seed.js'), '--minimal'], { env: ENV, encoding: 'utf8' });
  assert.equal(s.status, 0, s.stderr);
  server = spawn(process.execPath, [...NODE, path.join(ROOT, 'server/index.js')], { env: ENV, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
});
test.after(() => { if (server) server.kill(); fs.rmSync(DATA, { recursive: true, force: true }); });

/* ------------------------------------------------------------------ */
test('health endpoint and static front-end are served', async () => {
  const h = await api('GET', '/api/health');
  assert.equal(h.status, 200);
  assert.equal(h.json.status, 'ok');
  const page = await api('GET', '/');
  assert.equal(page.status, 200);
  assert.match(page.text, /QAForge/i);
});

test('authentication: valid login, invalid login and missing token', async () => {
  const bad = await api('POST', '/api/auth/login', { body: { email: `admin@${D}`, password: 'wrong' } });
  assert.equal(bad.status, 401);
  const none = await api('GET', '/api/projects');
  assert.equal(none.status, 401);
  const { token, user } = await login(`admin@${D}`);
  assert.equal(user.role, 'admin');
  const me = await api('GET', '/api/auth/me', { token });
  assert.equal(me.json.user.email, `admin@${D}`);
  const forged = await api('GET', '/api/projects', { token: token.slice(0, -3) + 'abc' });
  assert.equal(forged.status, 401);
});

test('organisation is sized for 100-200 employees', async () => {
  const { token } = await login(`admin@${D}`);
  const users = await api('GET', '/api/users?limit=500', { token });
  const n = users.json.total ?? users.json.items.length;
  assert.ok(n >= 100 && n <= 200, `employee count ${n}`);
});

test('role-based access control', async () => {
  const viewer = await login(`viewer@${D}`);
  const qe = await login(`qa.engineer@${D}`);
  const admin = await login(`admin@${D}`);
  assert.equal((await api('GET', '/api/audit', { token: qe.token })).status, 403);
  assert.equal((await api('GET', '/api/audit', { token: admin.token })).status, 200);
  assert.equal((await api('POST', '/api/users', { token: qe.token, body: {} })).status, 403);
  const projects = (await api('GET', '/api/projects', { token: admin.token })).json;
  const list = projects.items || projects.projects || projects;
  const shop = list.find((p) => p.key === 'SHOP');
  assert.ok(shop, 'SHOP project exists');
  const r = await api('POST', `/api/projects/SHOP/runs`, { token: viewer.token, body: {} });
  assert.ok([403].includes(r.status), `viewer must not start runs (got ${r.status})`);
});

test('password policy is enforced on change', async () => {
  const { token } = await login(`viewer@${D}`);
  const weak = await api('POST', '/api/auth/change-password', { token, body: { current_password: PASSWORD, new_password: 'abc' } });
  assert.equal(weak.status, 400);
  const wrongCur = await api('POST', '/api/auth/change-password', { token, body: { current_password: 'nope', new_password: 'Str0ngPass1' } });
  assert.equal(wrongCur.status, 400);
});

/* ------------------------------------------------------------------ */
let ctx = {};

test('automated black-box run detects the seeded defects and auto-raises them', async () => {
  const mgr = await login(`qa.manager@${D}`);
  ctx.mgr = mgr;
  const start = await api('POST', '/api/projects/SHOP/runs', { token: mgr.token, body: { name: 'Baseline', environment: 'QA', retries: 1 } });
  assert.ok([200, 202].includes(start.status), start.text);
  const out = await waitRun(mgr.token, start.json.run.id);
  assert.ok(out.run.total >= 20, `expected a real suite, got ${out.run.total}`);
  assert.ok(out.run.failed >= 5, `expected failures from the buggy SUT, got ${out.run.failed}`);
  assert.ok(out.run.passed > out.run.failed, 'most cases pass');
  const failed = out.results.filter((r) => r.status === 'failed');
  assert.ok(failed.every((r) => r.defect_code), 'every failed result is linked to a defect');
  const defects = await api('GET', '/api/projects/SHOP/defects?limit=200', { token: mgr.token });
  const autos = defects.json.items.filter((d) => d.source === 'auto');
  assert.ok(autos.length >= 5);
  assert.ok(autos.every((d) => d.assignee_id), 'auto defects are auto-assigned');
  ctx.autoCount = autos.length;
  ctx.firstRun = out.run;
});

test('re-running does not create duplicate defects (identification de-duplication)', async () => {
  const { token } = ctx.mgr;
  const start = await api('POST', '/api/projects/SHOP/runs', { token, body: { name: 'Second pass', retries: 2 } });
  await waitRun(token, start.json.run.id);
  const defects = await api('GET', '/api/projects/SHOP/defects?limit=200', { token });
  const autos = defects.json.items.filter((d) => d.source === 'auto');
  assert.equal(autos.length, ctx.autoCount, 'no new defects for the same failing cases');
  assert.ok(autos.some((d) => d.occurrences >= 2), 'occurrence counter increments');
});

test('defect lifecycle: assign -> fix -> automated retest -> verify -> close, with guards', async () => {
  const mgr = ctx.mgr;
  const list = await api('GET', '/api/projects/SHOP/defects?limit=200', { token: mgr.token });
  const target = list.json.items.find((d) => d.source === 'auto' && d.status === 'Assigned' && !/flaky|stable/i.test(d.title));
  assert.ok(target, 'an assigned auto-defect exists');
  const detail = await api('GET', `/api/defects/${target.id}`, { token: mgr.token });
  assert.ok(Array.isArray(detail.json.history || detail.json.defect.history || []));

  // illegal jump is rejected with 409
  const illegal = await api('POST', `/api/defects/${target.id}/transition`, { token: mgr.token, body: { to: 'Closed' } });
  assert.equal(illegal.status, 409);

  // a developer who is NOT the assignee cannot start work
  const devs = (await api('GET', '/api/users?role=developer&limit=200', { token: mgr.token })).json.items;
  const other = devs.find((u) => u.id !== target.assignee_id && u.email !== `developer@${D}`) || devs.find((u) => u.id !== target.assignee_id);
  // log in as the real assignee (all seeded accounts share the demo password but may need a password change)
  const assignee = devs.find((u) => u.id === target.assignee_id);
  const asg = await api('POST', '/api/auth/login', { body: { email: assignee.email, password: PASSWORD } });
  assert.equal(asg.status, 200);
  if (other) {
    const oth = await api('POST', '/api/auth/login', { body: { email: other.email, password: PASSWORD } });
    const deny = await api('POST', `/api/defects/${target.id}/transition`, { token: oth.json.token, body: { to: 'In Progress' } });
    assert.equal(deny.status, 403);
  }
  const t = asg.json.token;
  assert.equal((await api('POST', `/api/defects/${target.id}/transition`, { token: t, body: { to: 'In Progress' } })).status, 200);
  const noRes = await api('POST', `/api/defects/${target.id}/transition`, { token: t, body: { to: 'Fixed' } });
  assert.equal(noRes.status, 400, 'a resolution note is mandatory');

  // deploy the "fix" in the demo target, then mark Fixed and retest automatically
  const admin = await login(`admin@${D}`);
  const bugs = (await api('GET', '/api/demo/bugs', { token: admin.token })).json.bugs;
  for (const b of bugs) await api('POST', '/api/demo/bugs', { token: admin.token, body: { id: b.id, fixed: true } });
  assert.equal((await api('POST', `/api/defects/${target.id}/transition`, { token: t, body: { to: 'Fixed', resolution: 'Corrected server-side validation' } })).status, 200);

  const qe = await login(`qa.engineer@${D}`);
  const retest = await api('POST', `/api/defects/${target.id}/retest`, { token: qe.token, body: {} });
  assert.equal(retest.status, 200, retest.text);
  assert.equal(retest.json.outcome, 'verified');
  assert.equal((await api('POST', `/api/defects/${target.id}/transition`, { token: qe.token, body: { to: 'Closed' } })).status, 200);

  const final = await api('GET', `/api/defects/${target.id}`, { token: mgr.token });
  const d = final.json.defect || final.json;
  assert.equal(d.status, 'Closed');
  const hist = final.json.history || d.history;
  assert.ok(hist.length >= 6, 'complete audit trail kept');
  ctx.closedId = target.id;
});

test('after all fixes are deployed a full regression run is green', async () => {
  const { token } = ctx.mgr;
  const start = await api('POST', '/api/projects/SHOP/runs', { token, body: { name: 'Regression after fixes', retries: 2 } });
  const out = await waitRun(token, start.json.run.id);
  assert.equal(out.run.failed, 0, `unexpected failures: ${out.results.filter((r) => r.status === 'failed').map((r) => r.case_code)}`);
});

test('a regression re-opens a closed defect instead of duplicating it', async () => {
  const admin = await login(`admin@${D}`);
  const { token } = ctx.mgr;
  const defect = (await api('GET', `/api/defects/${ctx.closedId}`, { token })).json;
  const d = defect.defect || defect;
  const bugs = (await api('GET', '/api/demo/bugs', { token: admin.token })).json.bugs;
  for (const b of bugs) await api('POST', '/api/demo/bugs', { token: admin.token, body: { id: b.id, fixed: false } }); // regress
  const start = await api('POST', '/api/projects/SHOP/runs', { token, body: { name: 'Regression check' } });
  await waitRun(token, start.json.run.id);
  const again = (await api('GET', `/api/defects/${ctx.closedId}`, { token })).json;
  const a = again.defect || again;
  assert.equal(a.status, 'Reopened');
  assert.ok(a.reopen_count >= 1);
  assert.equal(d.id, a.id);
});

test('test case management, validation and CSV export', async () => {
  const { token } = ctx.mgr;
  const bad = await api('POST', '/api/projects/SHOP/testcases', { token, body: { title: '' } });
  assert.equal(bad.status, 400);
  const ok = await api('POST', '/api/projects/SHOP/testcases', { token, body: {
    title: 'Health endpoint reports ok', type: 'functional', priority: 'P3', automated: true, method: 'GET', endpoint: '/health',
    assertions: [{ type: 'status', op: 'eq', value: 200, desc: 'HTTP 200' }, { type: 'body', path: 'status', op: 'eq', value: 'ok', desc: 'status is ok' }],
  } });
  assert.ok([200, 201].includes(ok.status), ok.text);
  const csv = await api('GET', '/api/projects/SHOP/testcases.csv', { token, raw: true });
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /Health endpoint reports ok/);
  const dcsv = await api('GET', '/api/projects/SHOP/defects.csv', { token, raw: true });
  assert.match(dcsv.headers.get('content-type'), /csv/);
});

test('dashboard, traceability and notifications endpoints respond with data', async () => {
  const { token } = ctx.mgr;
  const dash = await api('GET', '/api/reports/dashboard', { token });
  assert.equal(dash.status, 200);
  assert.ok(Object.keys(dash.json).length > 2);
  const trace = await api('GET', '/api/projects/SHOP/traceability', { token });
  assert.equal(trace.status, 200);
  const n = await api('GET', '/api/notifications', { token });
  assert.equal(n.status, 200);
});

test('security: SSRF guard blocks non-project targets and input is not trusted', async () => {
  const { token } = ctx.mgr;
  const r = await api('POST', '/api/projects/SHOP/testcases', { token, body: {
    title: 'SSRF probe', automated: true, method: 'GET', endpoint: 'http://169.254.169.254/latest/meta-data',
    assertions: [{ type: 'status', op: 'eq', value: 200 }] } });
  if (r.status === 400) return; // rejected at creation - good
  const id = r.json.id || (r.json.testcase && r.json.testcase.id);
  const ex = await api('POST', `/api/testcases/${id}/execute`, { token, body: {} });
  const res = JSON.stringify(ex.json);
  assert.ok(ex.status >= 400 || /error|blocked|not allowed|refus/i.test(res), 'metadata address must not be fetched');
});
