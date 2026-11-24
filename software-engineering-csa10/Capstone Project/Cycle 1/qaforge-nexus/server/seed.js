'use strict';
/**
 * Seeds the demo organisation: 150 employees in 12 departments, 5 projects,
 * requirements, test cases and (optionally) 75 days of synthetic execution + defect history.
 *
 *   node server/seed.js --reset      wipe the database and seed everything
 *   node server/seed.js --minimal    wipe and seed organisation + demo project only (no history)
 */
const fs = require('node:fs');
const { db, all, get, run, tx, now, nextCode, initSchema, DB_FILE } = require('./db');
const A = require('./auth');
const L = require('./lifecycle');
const S = require('./seed-data');

function rng(seed) { // mulberry32 - deterministic demo data
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function seedOrganisation(rand) {
  const hash = A.hashPassword(S.DEMO_PASSWORD);
  const deptIds = {};
  for (const d of S.DEPARTMENTS) deptIds[d.code] = Number(run('INSERT INTO departments(code, name) VALUES (?,?)', d.code, d.name).lastInsertRowid);

  const used = new Set(S.DEMO_USERS.map((u) => u.email));
  const usedNames = new Set(S.DEMO_USERS.map((u) => u.name));
  const demoPending = [...S.DEMO_USERS];
  const slugify = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  let counter = 0;
  const created = [];

  for (const d of S.DEPARTMENTS) {
    for (const [role, n] of d.roles) {
      for (let i = 0; i < n; i++) {
        counter++;
        let u;
        const di = demoPending.findIndex((x) => x.role === role && x.dept === d.code);
        if (di >= 0) u = demoPending.splice(di, 1)[0];
        else {
          let name; let tries = 0;
          do { name = `${pick(S.FIRST)} ${pick(S.LAST)}`; tries++; } while (usedNames.has(name) && tries < 50);
          usedNames.add(name);
          let email = `${slugify(name.split(' ')[0])}.${slugify(name.split(' ')[1])}@${S.DOMAIN}`;
          let k = 1; while (used.has(email)) email = `${slugify(name.split(' ')[0])}.${slugify(name.split(' ')[1])}${++k}@${S.DOMAIN}`;
          used.add(email);
          const pool = d.desig[role];
          u = { email, name, role, dept: d.code, desig: pool[i % pool.length] };
        }
        const isDemo = S.DEMO_USERS.some((x) => x.email === u.email);
        const joined = new Date(Date.now() - (30 + Math.floor(rand() * 1400)) * 86400e3).toISOString();
        const r = run(`INSERT INTO users(emp_code, name, email, password_hash, role, department_id, designation, must_change_password, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?)`,
          `NX-${String(counter).padStart(4, '0')}`, u.name, u.email, hash, u.role, deptIds[d.code], u.desig, isDemo ? 0 : 1, joined);
        created.push({ id: Number(r.lastInsertRowid), role: u.role, dept: d.code, email: u.email, name: u.name });
      }
    }
  }
  return created;
}

function sample(rand, arr, n) {
  const a = [...arr]; const out = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(rand() * a.length), 1)[0]);
  return out;
}

function seedProjects(rand, users) {
  const byRole = (r) => users.filter((u) => u.role === r);
  const qm = byRole('qa_manager'); const qe = byRole('qa_engineer'); const dev = byRole('developer'); const po = byRole('product_owner');
  const viewerDemo = users.find((u) => u.email.startsWith('viewer@'));
  const adminDemo = users.find((u) => u.email.startsWith('admin@'));
  const out = [];

  S.PROJECTS.forEach((pd, i) => {
    const owner = qm[i % qm.length];
    const pid = Number(run('INSERT INTO projects(key, name, description, base_url, owner_id, created_at) VALUES (?,?,?,?,?,?)',
      pd.key, pd.name, pd.description, pd.base_url, owner.id, new Date(Date.now() - (120 - i * 10) * 86400e3).toISOString()).lastInsertRowid);
    const demoQe = qe.find((u) => u.email.startsWith('qa.engineer@'));
    const demoDev = dev.find((u) => u.email.startsWith('developer@'));
    const demoPo = po.find((u) => u.email.startsWith('product.owner@'));
    const members = new Set([owner.id, qm[0].id, viewerDemo.id, adminDemo.id, demoQe.id, demoDev.id, demoPo.id]);
    sample(rand, qe, 5).forEach((u) => members.add(u.id));
    sample(rand, dev, 11).forEach((u) => members.add(u.id));
    sample(rand, po, 1).forEach((u) => members.add(u.id));
    members.forEach((uid) => run('INSERT OR IGNORE INTO project_members(project_id, user_id) VALUES (?,?)', pid, uid));
    out.push({ id: pid, key: pd.key, def: pd, owner, members: [...members] });
  });
  return out;
}

function insertCase(p, suiteId, reqId, order, c) {
  const code = nextCode(p.id, 'testcase', 'TC');
  const t = new Date(Date.now() - 100 * 86400e3).toISOString();
  const r = run(
    `INSERT INTO test_cases(project_id, suite_id, requirement_id, code, title, description, type, priority, preconditions, steps_text,
       expected_text, method, endpoint, headers, body, assertions, extract, timeout_ms, automated, is_setup, depends_on_previous, status,
       sort_order, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'ready', ?, ?, ?, ?)`,
    p.id, suiteId, reqId, code, c.title, null, c.type, c.priority, null, c.steps, c.expected, c.method || null, c.endpoint || null,
    c.headers ? JSON.stringify(c.headers) : null, c.body || null, c.assertions ? JSON.stringify(c.assertions) : null,
    c.extract ? JSON.stringify(c.extract) : null, 10000, c.automated ? 1 : 0, c.setup ? 1 : 0, c.dep ? 1 : 0, order, p.owner.id, t, t);
  return Number(r.lastInsertRowid);
}

function seedTestAssets(projects) {
  for (const p of projects) {
    const t = new Date(Date.now() - 100 * 86400e3).toISOString();
    if (p.def.live) {
      const reqIds = S.SHOP_REQS.map((title, i) => Number(run(
        'INSERT INTO requirements(project_id, code, title, priority, status, created_by, created_at) VALUES (?,?,?,?,?,?,?)',
        p.id, nextCode(p.id, 'requirement', 'REQ', 3), title, i < 3 || i === 7 ? 'P1' : 'P2', 'approved', p.owner.id, t).lastInsertRowid));
      const suiteIds = S.SHOP_SUITES.map((name, i) => Number(run('INSERT INTO suites(project_id, name, sort_order, created_at) VALUES (?,?,?,?)', p.id, name, i + 1, t).lastInsertRowid));
      S.SHOP_CASES.forEach((c, i) => {
        const [suite, req, title, type, priority, method, endpoint, headers, body, assertions, extract, flags, steps, expected] = c;
        insertCase(p, suiteIds[suite - 1], reqIds[req - 1], i + 1, {
          title, type, priority, method, endpoint, headers, body, assertions, extract, steps, expected,
          automated: true, setup: flags.setup, dep: flags.dep,
        });
      });
    } else {
      const m = S.MANUAL[p.key];
      const reqIds = m.reqs.map((title, i) => Number(run(
        'INSERT INTO requirements(project_id, code, title, priority, status, created_by, created_at) VALUES (?,?,?,?,?,?,?)',
        p.id, nextCode(p.id, 'requirement', 'REQ', 3), title, i < 2 ? 'P1' : 'P2', 'approved', p.owner.id, t).lastInsertRowid));
      const suiteId = Number(run('INSERT INTO suites(project_id, name, sort_order, created_at) VALUES (?,?,?,?)', p.id, 'Functional regression pack', 1, t).lastInsertRowid);
      m.cases.forEach((c, i) => insertCase(p, suiteId, reqIds[c[3] - 1], i + 1, { title: c[0], type: c[1], priority: c[2], steps: c[4], expected: c[5] }));
    }
  }
}

/* ---------------- synthetic history ---------------- */
function seedRuns(rand, projects) {
  const DAY = 86400e3;
  for (const p of projects) {
    const cases = all(`SELECT id, priority FROM test_cases WHERE project_id = ? ORDER BY id`, p.id);
    const qaMembers = all(`SELECT u.id FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = ? AND u.role IN ('qa_engineer','qa_manager')`, p.id).map((x) => x.id);
    const count = p.def.live ? 26 : 15;
    for (let i = 0; i < count; i++) {
      const daysAgo = 75 - (i * 72) / (count - 1) + rand() * 1.5;
      const start = Date.now() - Math.max(daysAgo, 0.4) * DAY + Math.floor(rand() * 6) * 3600e3;
      const progress = i / (count - 1);
      const passP = 0.66 + 0.27 * progress + (rand() - 0.5) * 0.08;
      const code = nextCode(p.id, 'run', 'RUN');
      const auto = !!p.def.live;
      const runId = Number(run(
        `INSERT INTO test_runs(project_id, code, name, environment, trigger_type, status, started_by, started_at, finished_at, total, retries)
         VALUES (?,?,?,?,?,'completed',?,?,?,?,?)`,
        p.id, code, auto ? `Nightly regression #${i + 1}` : `Regression cycle ${i + 1}`, ['staging', 'qa', 'uat'][i % 3], auto ? 'automated' : 'manual',
        qaMembers[Math.floor(rand() * qaMembers.length)], new Date(start).toISOString(), new Date(start + 4 * 60e3).toISOString(), cases.length, auto ? 1 : 0).lastInsertRowid);
      let passed = 0; let failed = 0; let blocked = 0; let flaky = 0; let dur = 0;
      for (const c of cases) {
        const roll = rand();
        const status = roll < passP ? 'passed' : roll < passP + (1 - passP) * 0.85 ? 'failed' : 'blocked';
        const fl = status === 'passed' && auto && rand() < 0.03 ? 1 : 0;
        const ms = auto ? Math.round(20 + rand() * 260) : 0;
        run(`INSERT INTO test_results(run_id, test_case_id, status, attempts, flaky, duration_ms, failure_reason, executed_by, executed_at)
             VALUES (?,?,?,?,?,?,?,?,?)`, runId, c.id, status, fl ? 2 : 1, fl, ms, status === 'failed' ? 'Expected result not met' : status === 'blocked' ? 'Blocked by environment issue' : null,
          qaMembers[0], new Date(start + 60e3).toISOString());
        if (status === 'passed') passed++; else if (status === 'failed') failed++; else blocked++;
        flaky += fl; dur += ms;
      }
      run('UPDATE test_runs SET passed=?, failed=?, blocked=?, flaky=?, duration_ms=? WHERE id=?', passed, failed, blocked, flaky, dur, runId);
    }
  }
}

const PATHS = {
  New: ['New'], Assigned: ['New', 'Assigned'], 'In Progress': ['New', 'Assigned', 'In Progress'], Fixed: ['New', 'Assigned', 'In Progress', 'Fixed'],
  Retesting: ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting'], Verified: ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Verified'],
  Closed: ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Verified', 'Closed'],
  ClosedAfterReopen: ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Reopened', 'In Progress', 'Fixed', 'Retesting', 'Verified', 'Closed'],
  Reopened: ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Reopened'],
  Rejected: ['New', 'Assigned', 'Rejected'], Deferred: ['New', 'Assigned', 'Deferred'], Duplicate: ['New', 'Duplicate'],
};
const STATUS_WEIGHTS = [['Closed', 30], ['ClosedAfterReopen', 7], ['Verified', 4], ['Retesting', 3], ['Fixed', 6], ['In Progress', 10], ['Assigned', 9], ['New', 5], ['Reopened', 5], ['Rejected', 5], ['Deferred', 4], ['Duplicate', 3]];
const SEV_WEIGHTS = [['Critical', 8], ['High', 22], ['Medium', 45], ['Low', 25]];
const TYPE_WEIGHTS = [['functional', 60], ['ui', 10], ['performance', 8], ['security', 12], ['data', 6], ['usability', 4]];
const FIX_NOTES = ['Corrected validation logic and added a unit test', 'Fixed off-by-one in the query; regression test added', 'Patched null handling in the service layer', 'Updated configuration and redeployed to staging', 'Rewrote the faulty calculation; verified against the spec'];
const REOPEN_NOTES = ['Still reproducible on build 2.4.1', 'Fix works for the happy path but fails with boundary values', 'Retest failed in the QA environment'];
const COMMENTS = ['Able to reproduce on the latest build.', 'Looks related to the recent refactor - checking logs.', 'Attached the request/response trace to the defect.', 'Need clarification on expected behaviour from product.', 'Fix is in the release branch, waiting for the next deployment.', 'Could not reproduce on staging; retrying with production data.'];

function weighted(rand, pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0); let r = rand() * total;
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[0][0];
}

function seedDefects(rand, projects) {
  const DAY = 86400e3;
  for (const p of projects) {
    const members = all(`SELECT u.id, u.role FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = ?`, p.id);
    const devs = members.filter((m) => m.role === 'developer'); const qas = members.filter((m) => ['qa_engineer', 'qa_manager'].includes(m.role));
    const cases = all('SELECT id, requirement_id FROM test_cases WHERE project_id = ? ORDER BY id', p.id);
    const jobs = [];
    if (p.def.live) {
      S.SHOP_OLD_DEFECTS.forEach(([n, title], i) => jobs.push({ title, tcId: cases[n - 1].id, reqId: cases[n - 1].requirement_id, status: i % 3 === 2 ? 'ClosedAfterReopen' : 'Closed', old: true }));
    } else {
      const titles = S.MANUAL[p.key].defects;
      titles.forEach((title) => { const c = cases[Math.floor(rand() * cases.length)]; jobs.push({ title, tcId: c.id, reqId: c.requirement_id, status: weighted(rand, STATUS_WEIGHTS) }); });
    }
    const created = [];
    for (const j of jobs) {
      const path = PATHS[j.status];
      const activeWork = ['New', 'Assigned', 'In Progress', 'Reopened'].includes(j.status);
      const ageDays = j.old ? 40 + rand() * 40 : activeWork ? 1 + rand() * 19 : 4 + rand() * 80;
      const createdAt = Date.now() - ageDays * DAY;
      const budget = (Date.now() - createdAt) * 0.8;
      const gaps = path.map(() => 0.3 + rand());
      const sum = gaps.reduce((a, b) => a + b, 0);
      let t = createdAt;
      const stamp = () => new Date(t).toISOString();
      const severity = weighted(rand, SEV_WEIGHTS);
      const assignee = devs[Math.floor(rand() * devs.length)];
      const reporter = qas[Math.floor(rand() * qas.length)];
      const wantsAssignee = path.length > 1 && path[1] === 'Assigned';
      const d = L.createDefect(p.id, {
        title: j.title, description: `Observed during regression testing of ${p.def.name}.`, severity, type: weighted(rand, TYPE_WEIGHTS), source: 'manual',
        test_case_id: j.tcId, requirement_id: j.reqId, steps: '1. Follow the steps of the linked test case\n2. Compare actual and expected behaviour',
        expected: 'Behaviour matches the requirement', actual: 'Behaviour deviates from the requirement', environment: ['staging', 'qa', 'uat'][Math.floor(rand() * 3)],
        assignee_id: wantsAssignee ? assignee.id : null,
      }, reporter.id, { createdAt: stamp(), autoAssign: false });
      let cur = d;
      for (let k = (wantsAssignee ? 2 : 1); k < path.length; k++) {
        t += (gaps[k] / sum) * budget;
        const to = path[k]; const f = { note: '' };
        if (to === 'Fixed') f.resolution = FIX_NOTES[Math.floor(rand() * FIX_NOTES.length)];
        if (to === 'Reopened') f.note = REOPEN_NOTES[Math.floor(rand() * REOPEN_NOTES.length)];
        if (to === 'Rejected') f.note = 'Working as designed per the approved requirement';
        if (to === 'Deferred') f.note = 'Deferred to the next release by product owner';
        if (to === 'Duplicate') {
          const other = created.filter((c) => c.status !== 'Duplicate').pop();
          if (!other) { f.note = 'Cannot reproduce'; L.applyTransition(cur, 'Rejected', reporter.id, f, stamp()); cur = get('SELECT * FROM defects WHERE id = ?', d.id); continue; }
          f.duplicate_of = other.id; f.note = `Duplicate of ${other.code}`;
        }
        if (to === 'Reopened' && !cur.assignee_id) f.assignee_id = assignee.id;
        L.applyTransition(cur, to, ['In Progress', 'Fixed', 'Rejected'].includes(to) ? assignee.id : reporter.id, f, stamp());
        cur = get('SELECT * FROM defects WHERE id = ?', d.id);
      }
      if (rand() < 0.4) {
        for (let c = 0; c < 1 + Math.floor(rand() * 2); c++) {
          const who = rand() < 0.5 ? assignee : reporter;
          const at = new Date(createdAt + rand() * (t - createdAt + 3600e3)).toISOString();
          run('INSERT INTO defect_comments(defect_id, author_id, body, created_at) VALUES (?,?,?,?)', d.id, who.id, COMMENTS[Math.floor(rand() * COMMENTS.length)], at);
        }
      }
      created.push(get('SELECT * FROM defects WHERE id = ?', d.id));
    }
  }
}

function seedAudit(rand, users) {
  const actions = ['login.success', 'login.success', 'login.success', 'project.updated', 'testcase.updated', 'run.started'];
  for (let i = 0; i < 80; i++) {
    const u = users[Math.floor(rand() * users.length)];
    const a = actions[Math.floor(rand() * actions.length)];
    run('INSERT INTO audit_log(actor_id, action, entity, entity_id, detail, ip, created_at) VALUES (?,?,?,?,?,?,?)',
      u.id, a, a.startsWith('login') ? 'user' : 'project', String(u.id), null, `10.20.${Math.floor(rand() * 8)}.${1 + Math.floor(rand() * 250)}`,
      new Date(Date.now() - rand() * 20 * 86400e3).toISOString());
  }
}

function seed({ history = true } = {}) {
  initSchema();
  if (get('SELECT COUNT(*) AS n FROM users').n > 0) return false;
  const rand = rng(20261103);
  tx(() => {
    const users = seedOrganisation(rand);
    const projects = seedProjects(rand, users);
    seedTestAssets(projects);
    if (history) {
      seedRuns(rand, projects);
      seedDefects(rand, projects);
      seedAudit(rand, users);
    }
    run('DELETE FROM notifications');
  });
  return true;
}

function reset() {
  db.close();
  for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) { try { fs.unlinkSync(f); } catch (_) { /* absent */ } }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--reset') || args.includes('--minimal')) {
    reset();
    // re-open in a fresh process so the module-level connection points at a new file
    const { spawnSync } = require('node:child_process');
    const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', __filename, args.includes('--minimal') ? '--run-minimal' : '--run'], { stdio: 'inherit' });
    process.exit(r.status);
  }
  const ok = seed({ history: !process.argv.includes('--run-minimal') });
  const c = (t) => get(`SELECT COUNT(*) AS n FROM ${t}`).n;
  console.log(ok ? 'Seeded' : 'Database already contains data (use --reset to start over)',
    { users: c('users'), departments: c('departments'), projects: c('projects'), testCases: c('test_cases'), runs: c('test_runs'), defects: c('defects') });
}

module.exports = { seed };
