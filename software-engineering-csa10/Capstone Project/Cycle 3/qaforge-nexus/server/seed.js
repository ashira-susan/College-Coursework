'use strict';
/**
 * Seeds QAForge Nexus.
 *
 *  - Organisation: 150 synthetic employees in 12 departments (people are never real data).
 *  - SHOP: the built-in Nexora Storefront target with 35 executable black-box cases (no pre-made history - run it yourself).
 *  - LANG, CLI, CSV, CHART, TIME: REAL data from the public Defects4J dataset (168 reproducible bugs, 376 trigger tests):
 *      every defect carries its real bug-report id and URL, buggy/fixed revision hashes, modified classes, trigger test and
 *      stack trace; the real upstream fix patch is stored as the resolution. Requirements = modified classes, test cases = trigger tests.
 *    The *workflow state* inside Nexus (who is assigned, status, timestamps, run history) is simulated with a seeded random
 *    generator because the dataset records faults, not our internal triage.
 *
 *   node server/seed.js --reset      drop all tables and seed everything
 *   node server/seed.js --minimal    drop and seed organisation + projects + test assets (no defects / run history)
 *   node server/seed.js              seed only if the database is empty
 */
const { all, get, run, tx, nextCode, initSchema, resetSchema, close } = require('./db');
const A = require('./auth');
const L = require('./lifecycle');
const S = require('./seed-data');
const DATASET = require('./datasets/defects4j-subset.json');

const DAY = 86400e3;
function rng(seed) { // mulberry32 - deterministic data
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function sample(rand, arr, n) {
  const a = [...arr]; const out = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(rand() * a.length), 1)[0]);
  return out;
}
function weighted(rand, pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0); let r = rand() * total;
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[0][0];
}

/* ------------------------------------------------------------------ organisation */
async function seedOrganisation(rand) {
  const hash = A.hashPassword(S.DEMO_PASSWORD);
  const deptIds = {};
  for (const d of S.DEPARTMENTS) deptIds[d.code] = Number((await run('INSERT INTO departments(code, name) VALUES (?,?)', d.code, d.name)).lastInsertRowid);

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
        const joined = new Date(Date.now() - (30 + Math.floor(rand() * 1400)) * DAY).toISOString();
        const r = await run(`INSERT INTO users(emp_code, name, email, password_hash, role, department_id, designation, must_change_password, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?)`,
          `NX-${String(counter).padStart(4, '0')}`, u.name, u.email, hash, u.role, deptIds[d.code], u.desig, isDemo ? 0 : 1, joined);
        created.push({ id: Number(r.lastInsertRowid), role: u.role, dept: d.code, email: u.email, name: u.name });
      }
    }
  }
  return created;
}

/* ------------------------------------------------------------------ projects */
async function seedProjects(rand, users) {
  const byRole = (r) => users.filter((u) => u.role === r);
  const qm = byRole('qa_manager'); const qe = byRole('qa_engineer'); const dev = byRole('developer'); const po = byRole('product_owner');
  const viewerDemo = users.find((u) => u.email.startsWith('viewer@'));
  const adminDemo = users.find((u) => u.email.startsWith('admin@'));
  const demoQe = qe.find((u) => u.email.startsWith('qa.engineer@'));
  const demoDev = dev.find((u) => u.email.startsWith('developer@'));
  const demoPo = po.find((u) => u.email.startsWith('product.owner@'));
  const defs = [
    ...S.PROJECTS.map((p) => ({ ...p, dataset: null })),
    ...DATASET.projects.map((p) => ({
      key: p.key, name: p.name, base_url: null, live: false, dataset: p,
      description: `Real defects from the public ${DATASET.dataset} dataset: ${p.bugs.length} reproducible bugs of ${p.name} reported in the ${p.tracker}. Each defect keeps its real report id, URL, trigger test, stack trace and upstream fix.`,
    })),
  ];
  const out = [];
  let i = 0;
  for (const pd of defs) {
    const owner = qm[i % qm.length];
    const r = await run('INSERT INTO projects(key, name, description, base_url, owner_id, source_dataset, source_url, created_at) VALUES (?,?,?,?,?,?,?,?)',
      pd.key, pd.name, pd.description, pd.base_url, owner.id, pd.dataset ? DATASET.dataset : null, pd.dataset ? pd.dataset.repo : null,
      new Date(Date.now() - (120 - i * 8) * DAY).toISOString());
    const pid = Number(r.lastInsertRowid);
    const members = new Set([owner.id, qm[0].id, viewerDemo.id, adminDemo.id, demoQe.id, demoDev.id, demoPo.id]);
    sample(rand, qe, 5).forEach((u) => members.add(u.id));
    sample(rand, dev, 11).forEach((u) => members.add(u.id));
    sample(rand, po, 1).forEach((u) => members.add(u.id));
    for (const uid of members) await run('INSERT OR IGNORE INTO project_members(project_id, user_id) VALUES (?,?)', pid, uid);
    out.push({ id: pid, key: pd.key, def: pd, owner, members: [...members] });
    i++;
  }
  return out;
}

async function insertCase(p, suiteId, reqId, order, c, createdAt) {
  const code = await nextCode(p.id, 'testcase', 'TC');
  const t = createdAt || new Date(Date.now() - 100 * DAY).toISOString();
  const r = await run(
    `INSERT INTO test_cases(project_id, suite_id, requirement_id, code, title, description, type, priority, preconditions, steps_text,
       expected_text, method, endpoint, headers, body, assertions, extract, timeout_ms, automated, is_setup, depends_on_previous, status,
       sort_order, external_ref, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'ready', ?, ?, ?, ?, ?)`,
    p.id, suiteId, reqId, code, c.title, c.description || null, c.type, c.priority, null, c.steps, c.expected, c.method || null, c.endpoint || null,
    c.headers ? JSON.stringify(c.headers) : null, c.body || null, c.assertions ? JSON.stringify(c.assertions) : null,
    c.extract ? JSON.stringify(c.extract) : null, 10000, c.automated ? 1 : 0, c.setup ? 1 : 0, c.dep ? 1 : 0, order, c.external_ref || null, p.owner.id, t, t);
  return Number(r.lastInsertRowid);
}

/* ------------------------------------------------------------------ SHOP (executable) assets */
async function seedShopAssets(p) {
  const t = new Date(Date.now() - 100 * DAY).toISOString();
  const reqIds = [];
  for (let i = 0; i < S.SHOP_REQS.length; i++) {
    reqIds.push(Number((await run('INSERT INTO requirements(project_id, code, title, priority, status, created_by, created_at) VALUES (?,?,?,?,?,?,?)',
      p.id, await nextCode(p.id, 'requirement', 'REQ', 3), S.SHOP_REQS[i], i < 3 || i === 7 ? 'P1' : 'P2', 'approved', p.owner.id, t)).lastInsertRowid));
  }
  const suiteIds = [];
  for (let i = 0; i < S.SHOP_SUITES.length; i++) {
    suiteIds.push(Number((await run('INSERT INTO suites(project_id, name, sort_order, created_at) VALUES (?,?,?,?)', p.id, S.SHOP_SUITES[i], i + 1, t)).lastInsertRowid));
  }
  for (let i = 0; i < S.SHOP_CASES.length; i++) {
    const [suite, req, title, type, priority, method, endpoint, headers, body, assertions, extract, flags, steps, expected] = S.SHOP_CASES[i];
    await insertCase(p, suiteIds[suite - 1], reqIds[req - 1], i + 1, { title, type, priority, method, endpoint, headers, body, assertions, extract, steps, expected, automated: true, setup: flags.setup, dep: flags.dep }, t);
  }
}

/* ------------------------------------------------------------------ Defects4J helpers */
const simple = (fqn) => fqn.split('.').pop();
const pkgOf = (fqn) => fqn.split('.').slice(0, -1).join('.');
function parseTest(name) { const [cls, method] = name.split('::'); return { cls, method: method || '', key: name }; }
function firstLine(bug) { return (bug.triggerTests[0].trace[0] || '').trim(); }
function excSummary(line) {
  const m = /^([\w.$]+?)(?::\s*(.*))?$/.exec(line);
  if (!m) return line.slice(0, 120);
  const name = m[1].split('.').pop();
  return (m[2] ? `${name}: ${m[2]}` : name).replace(/\s+/g, ' ').slice(0, 120);
}
function severityOf(bug) {
  const exc = (firstLine(bug).split(':')[0] || '');
  const size = bug.patch.added + bug.patch.removed;
  if (/StackOverflow|OutOfMemory/.test(exc)) return 'Critical';
  if (/NullPointer|IndexOutOfBounds|ClassCast|ConcurrentModification|Arithmetic|IllegalState/.test(exc)) return 'High';
  if (/Assertion|ComparisonFailure/.test(exc)) return size <= 4 ? 'Low' : 'Medium';
  return 'Medium';
}
function typeOf(bug) {
  const exc = (firstLine(bug).split(':')[0] || '');
  if (/StackOverflow|OutOfMemory|Timeout/.test(exc)) return 'performance';
  if (/NumberFormat|Parse|Format|Encoding|Charset/.test(exc)) return 'data';
  return 'functional';
}
function defectText(proj, bug) {
  const tests = bug.triggerTests.map((t) => `  - ${t.name}`).join('\n');
  const first = bug.triggerTests[0];
  return {
    title: `${bug.reportId}: ${simple(bug.modifiedClasses[0])} - ${excSummary(firstLine(bug))}`.slice(0, 200),
    description: `Real defect from the ${DATASET.dataset} dataset (${proj.name}, bug #${bug.bugId}).\n\nBug report: ${bug.reportUrl ? `${bug.reportUrl} (${proj.tracker})` : 'no upstream report recorded in the dataset'}\nBuggy revision: ${bug.buggyRevision}\nFixed revision: ${bug.fixedRevision}\nModified classes:\n${bug.modifiedClasses.map((c) => `  - ${c}`).join('\n')}\nTrigger tests:\n${tests}\n\nSource: ${DATASET.source} (${DATASET.licence}).`,
    steps: `1. Check out ${proj.name} at buggy revision ${bug.buggyRevision.slice(0, 10)}\n2. Run the trigger test ${first.name}\n3. Observe the failure below`,
    expected: `Trigger test passes (as on the fixed revision ${bug.fixedRevision.slice(0, 10)})`,
    actual: first.trace.slice(0, 3).join('\n'),
    evidence: bug.triggerTests.map((t) => `--- ${t.name}\n${t.trace.join('\n')}`).join('\n\n'),
    resolution: `Upstream fix ${bug.fixedRevision.slice(0, 10)}: modified ${bug.patch.files.length} file(s) (+${bug.patch.added}/-${bug.patch.removed} lines): ${bug.patch.files.map((f) => f.split('/').pop()).join(', ')}.\n${bug.patch.excerpt.slice(0, 8).join('\n')}`,
  };
}

const PATHS = {
  New: ['New'], Assigned: ['New', 'Assigned'], 'In Progress': ['New', 'Assigned', 'In Progress'], Fixed: ['New', 'Assigned', 'In Progress', 'Fixed'],
  Retesting: ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting'], Verified: ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Verified'],
  Closed: ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Verified', 'Closed'],
  ClosedAfterReopen: ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Reopened', 'In Progress', 'Fixed', 'Retesting', 'Verified', 'Closed'],
  Reopened: ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Reopened'], Deferred: ['New', 'Assigned', 'Deferred'],
};
const STATUS_WEIGHTS = [['Closed', 38], ['ClosedAfterReopen', 8], ['Verified', 8], ['Retesting', 5], ['Fixed', 10], ['In Progress', 10], ['Assigned', 8], ['New', 5], ['Reopened', 4], ['Deferred', 2]];
const REOPEN_NOTES = ['Retest failed: the trigger test still fails on the fixed branch', 'Fix only covers the first trigger test; second one still fails', 'Regression observed in the nightly build'];
const COMMENTS = ['Reproduced with the trigger test on the buggy revision.', 'Root cause is in the modified class listed in the description - patch drafted.', 'Linked the upstream report; the fix diff is attached in the resolution.', 'Checked neighbouring classes for the same pattern.', 'Retest scheduled for the next build.', 'Need a second reviewer for the fix.'];

/* ------------------------------------------------------------------ dataset project */
async function seedDatasetProject(rand, p, { history }) {
  const proj = p.def.dataset;
  const t0 = Date.now();
  // requirements: one per primary modified class
  const classes = [...new Set(proj.bugs.map((b) => b.modifiedClasses[0]))].sort();
  const reqId = {};
  for (let i = 0; i < classes.length; i++) {
    reqId[classes[i]] = Number((await run(
      'INSERT INTO requirements(project_id, code, title, description, priority, status, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)',
      p.id, await nextCode(p.id, 'requirement', 'REQ', 3), `${simple(classes[i])} behaves as specified`,
      `Functional behaviour of ${classes[i]} (derived from the modified-class metadata of ${DATASET.dataset}).`, i % 4 === 0 ? 'P1' : 'P2', 'approved', p.owner.id,
      new Date(t0 - 100 * DAY).toISOString())).lastInsertRowid);
  }
  // bug timeline (chronological by bug id)
  const bugs = [...proj.bugs].sort((a, b) => a.bugId - b.bugId);
  const span = 82; // days
  const createdAt = new Map(bugs.map((b, i) => [b.bugId, t0 - (span - (i * (span - 6)) / Math.max(bugs.length - 1, 1) + rand() * 1.2) * DAY]));
  // suites per test package + test cases per unique trigger test
  const suiteId = {}; const tcId = {}; const tcFirstBug = {};
  let order = 0;
  for (const b of bugs) {
    for (const tt of b.triggerTests) {
      const t = parseTest(tt.name);
      if (tcId[t.key]) continue;
      const pkg = pkgOf(t.cls);
      if (!suiteId[pkg]) suiteId[pkg] = Number((await run('INSERT INTO suites(project_id, name, sort_order, created_at) VALUES (?,?,?,?)', p.id, pkg, Object.keys(suiteId).length + 1, new Date(t0 - 100 * DAY).toISOString())).lastInsertRowid);
      const when = new Date(createdAt.get(b.bugId) - 2 * 3600e3).toISOString();
      tcId[t.key] = await insertCase(p, suiteId[pkg], reqId[b.modifiedClasses[0]], ++order, {
        title: `${simple(t.cls)}.${t.method}`, type: 'regression', priority: severityOf(b) === 'Critical' ? 'P1' : severityOf(b) === 'High' ? 'P2' : 'P3',
        steps: `Check out ${proj.name} at the buggy revision and run ${t.cls}#${t.method}`, expected: 'Test passes on the fixed revision', external_ref: t.key, automated: false,
        description: `JUnit trigger test from ${DATASET.dataset} bug #${b.bugId} (${b.reportId}).`,
      }, when);
      tcFirstBug[t.key] = b.bugId;
    }
  }
  if (!history) return { defects: 0, tests: order, requirements: classes.length };

  // defects with simulated workflow
  const members = await all('SELECT u.id, u.role FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = ?', p.id);
  const devs = members.filter((m) => m.role === 'developer'); const qas = members.filter((m) => ['qa_engineer', 'qa_manager'].includes(m.role));
  const defectOf = {}; // bugId -> defect id
  const created = [];
  for (const b of bugs) {
    const txt = defectText(proj, b);
    const statusKey = weighted(rand, STATUS_WEIGHTS);
    const path = PATHS[statusKey];
    const cAt = createdAt.get(b.bugId);
    const budget = (Date.now() - cAt) * 0.85;
    const gaps = path.map(() => 0.3 + rand()); const sum = gaps.reduce((x, y) => x + y, 0);
    let t = cAt; const stamp = () => new Date(t).toISOString();
    const assignee = devs[Math.floor(rand() * devs.length)]; const reporter = qas[Math.floor(rand() * qas.length)];
    const sev = severityOf(b);
    const first = parseTest(b.triggerTests[0].name);
    const d = await L.createDefect(p.id, {
      title: txt.title, description: txt.description, severity: sev, type: typeOf(b), source: 'manual',
      test_case_id: tcId[first.key], requirement_id: reqId[b.modifiedClasses[0]], steps: txt.steps, expected: txt.expected, actual: txt.actual,
      evidence: txt.evidence, environment: `${proj.name} @ ${b.buggyRevision.slice(0, 10)}`, assignee_id: assignee.id,
    }, reporter.id, { createdAt: stamp(), autoAssign: false });
    await run('UPDATE defects SET external_ref = ?, external_url = ? WHERE id = ?', b.reportId, b.reportUrl, d.id);
    let cur = d;
    for (let k = 2; k < path.length; k++) {
      t += (gaps[k] / sum) * budget;
      const to = path[k]; const f = { note: '' };
      if (to === 'Fixed') f.resolution = txt.resolution;
      if (to === 'Reopened') f.note = REOPEN_NOTES[Math.floor(rand() * REOPEN_NOTES.length)];
      if (to === 'Deferred') f.note = 'Deferred to a later release by the product owner';
      await L.applyTransition(cur, to, ['In Progress', 'Fixed'].includes(to) ? assignee.id : reporter.id, f, stamp());
      cur = await get('SELECT * FROM defects WHERE id = ?', d.id);
    }
    if (rand() < 0.35) {
      for (let c = 0; c < 1 + Math.floor(rand() * 2); c++) {
        const who = rand() < 0.5 ? assignee : reporter;
        await run('INSERT INTO defect_comments(defect_id, author_id, body, created_at) VALUES (?,?,?,?)', d.id, who.id, COMMENTS[Math.floor(rand() * COMMENTS.length)],
          new Date(cAt + rand() * (t - cAt + 3600e3)).toISOString());
      }
    }
    defectOf[b.bugId] = d.id;
    created.push({ bug: b, id: d.id });
  }

  // run history derived from the defect timelines
  const hist = await all(`SELECT h.defect_id, h.to_status, h.created_at FROM defect_history h JOIN defects d ON d.id = h.defect_id
                          WHERE d.project_id = ? AND h.to_status IS NOT NULL ORDER BY h.created_at, h.id`, p.id);
  const timeline = {};
  for (const h of hist) (timeline[h.defect_id] ||= []).push([Date.parse(h.created_at), h.to_status]);
  const RESOLVED = new Set(['Fixed', 'Retesting', 'Verified', 'Closed', 'Rejected', 'Duplicate']);
  const statusAt = (id, t) => { let s = null; for (const [ts, st] of timeline[id] || []) { if (ts <= t) s = st; else break; } return s; };
  const tcBugs = {}; // test key -> [defect ids]
  for (const { bug, id } of created) for (const tt of bug.triggerTests) (tcBugs[tt.name] ||= []).push({ id, at: createdAt.get(bug.bugId), trace: tt.trace });
  const qaIds = qas.map((q) => q.id);
  const firstAt = Math.min(...created.map((c) => createdAt.get(c.bug.bugId)));
  const RUNS = 8;
  for (let r = 0; r < RUNS; r++) {
    const t = firstAt + 3 * 3600e3 + (r * (Date.now() - firstAt - 6 * 3600e3)) / (RUNS - 1);
    const rows = [];
    for (const [key, id] of Object.entries(tcId)) {
      const linked = tcBugs[key] || [];
      const born = Math.min(...linked.map((x) => x.at)) - 2 * 3600e3;
      if (born > t) continue;
      const open = linked.filter((x) => x.at <= t && !RESOLVED.has(statusAt(x.id, t)));
      rows.push({ id, key, open: open.length ? open[open.length - 1] : null });
    }
    if (!rows.length) continue;
    const runCode = await nextCode(p.id, 'run', 'RUN');
    const failed = rows.filter((x) => x.open).length;
    const runId = Number((await run(
      `INSERT INTO test_runs(project_id, code, name, environment, trigger_type, status, started_by, started_at, finished_at, total, passed, failed, retries)
       VALUES (?,?,?,?,?,'completed',?,?,?,?,?,?,0)`,
      p.id, runCode, `Regression cycle ${r + 1}`, 'qa', 'manual', qaIds[r % qaIds.length], new Date(t).toISOString(), new Date(t + 20 * 60e3).toISOString(),
      rows.length, rows.length - failed, failed)).lastInsertRowid);
    for (const x of rows) {
      await run(`INSERT INTO test_results(run_id, test_case_id, status, attempts, flaky, duration_ms, response_excerpt, failure_reason, defect_id, executed_by, executed_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        runId, x.id, x.open ? 'failed' : 'passed', 1, 0, 40 + Math.floor(rand() * 900), x.open ? x.open.trace.join('\n').slice(0, 1500) : null,
        x.open ? x.open.trace[0].slice(0, 300) : null, x.open ? x.open.id : null, qaIds[(r + x.id) % qaIds.length], new Date(t + 60e3).toISOString());
    }
  }
  return { defects: created.length, tests: order, requirements: classes.length };
}

async function seed({ history = true } = {}) {
  await initSchema();
  if ((await get('SELECT COUNT(*) AS n FROM users')).n > 0) return false;
  const rand = rng(20261116);
  await tx(async () => {
    const users = await seedOrganisation(rand);
    const projects = await seedProjects(rand, users);
    const admin = users.find((u) => u.email.startsWith('admin@'));
    const summary = {};
    for (const p of projects) {
      if (p.def.live) await seedShopAssets(p);
      else summary[p.key] = await seedDatasetProject(rand, p, { history });
    }
    await run('INSERT INTO audit_log(actor_id, action, entity, entity_id, detail, ip, created_at) VALUES (?,?,?,?,?,?,?)',
      admin.id, 'dataset.imported', 'dataset', DATASET.dataset, JSON.stringify({ source: DATASET.source, licence: DATASET.licence, history, ...summary }), 'seed', new Date().toISOString());
    await run('DELETE FROM notifications');
  });
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--reset') || args.includes('--minimal')) await resetSchema();
  const ok = await seed({ history: !args.includes('--minimal') });
  const c = async (t) => (await get(`SELECT COUNT(*) AS n FROM ${t}`)).n;
  console.log(ok ? 'Seeded' : 'Database already contains data (use --reset to start over)',
    { users: await c('users'), departments: await c('departments'), projects: await c('projects'), requirements: await c('requirements'),
      testCases: await c('test_cases'), runs: await c('test_runs'), results: await c('test_results'), defects: await c('defects') });
  await close();
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { seed };
