'use strict';
/* QAForge Nexus - single-page application (hash router). Depends on ui.js (window.NX). */
(function () {
  const { h, api, get, post, patch, del, badge, table, field, select, toast, modal } = Object.assign({}, window.NX, {});
  const NX = window.NX;
  const root = document.getElementById('app');
  const pages = {}; // filled by pages.js sections below
  let pollTimer = null;

  /* ============================== router & shell ============================== */
  const parse = () => {
    const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    return { parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs || '')) };
  };
  const go = (hash) => { if (location.hash === hash) NX.render(); else location.hash = hash; };
  NX.go = go;

  NX.render = async function render() {
    clearInterval(pollTimer); pollTimer = null;
    const route = parse();
    if (!NX.token) { if (route.parts[0] !== 'login') { location.replace('#/login'); return; } return pages.login(); }
    if (!NX.user) {
      try { NX.user = (await get('/api/auth/me')).user; NX.meta = await get('/api/meta'); } catch (e) { return NX.logout(); }
    }
    if (route.parts[0] === 'login') return go('#/dashboard');
    if (NX.user.must_change_password && route.parts[0] !== 'password') return go('#/password');
    const shell = buildShell(route);
    try {
      const name = route.parts[0] || 'dashboard';
      const fn = pages[name];
      if (!fn) shell.content.append(h('div', { class: 'empty' }, 'Page not found.'));
      else await fn(shell.content, route, shell);
    } catch (e) {
      NX.clear(shell.content).append(h('div', { class: 'alert bad' }, e.message || 'Something went wrong'));
    }
  };
  window.addEventListener('hashchange', () => NX.render());

  const NAV = [
    ['#/dashboard', 'Dashboard', 'dashboard'], ['#/projects', 'Projects', 'projects', 'p'], ['#/defects', 'Defects', 'defects'],
    ['#/lab', 'Demo Lab', 'lab', null, 'demo.lab'], ['#/org', 'Organisation', 'org'],
    ['#/admin/users', 'Users', 'admin', null, 'user.manage', 'Administration'], ['#/audit', 'Audit log', 'audit', null, 'audit.view', 'Administration'],
  ];
  function buildShell(route) {
    const content = h('div', { class: 'content', id: 'content' });
    const title = h('div', { class: 'muted small' });
    const bell = h('button', { class: 'btn ghost sm', 'aria-label': 'Notifications', onclick: openNotifications }, '🔔 ', h('span', { id: 'nbadge' }));
    const side = h('aside', { class: 'side' },
      h('div', { class: 'brand' }, h('div', { class: 'logo' }, NX.svg('svg', { width: 18, height: 18, viewBox: '0 0 32 32' }, NX.svg('path', { d: 'M8 17l6 6 11-14', stroke: '#fff', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))), 'QAForge Nexus'),
      h('nav', { class: 'nav', 'aria-label': 'Main' }, (() => {
        const out = []; let lastSec = null;
        for (const [href, label, key, alias, perm, sec] of NAV) {
          if (perm && !NX.can(perm)) continue;
          if (sec && sec !== lastSec) { out.push(h('div', { class: 'sec' }, sec)); lastSec = sec; }
          const cur = route.parts[0] || 'dashboard';
          const active = cur === key || (alias && cur === alias) || (key === 'admin' && cur === 'admin') || (key === 'defects' && cur === 'defects');
          out.push(h('a', { href, class: active ? 'active' : null, onclick: () => side.classList.remove('open') }, label));
        }
        return out;
      })()),
      h('div', { class: 'me' },
        h('div', null, h('b', null, NX.user.name)), h('div', { class: 'small muted' }, NX.roleName(NX.user.role), ' · ', NX.user.department || ''),
        h('div', { class: 'row', style: 'margin-top:10px' },
          h('a', { href: '#/password', class: 'small' }, 'Password'),
          h('button', { class: 'btn sm right', onclick: NX.logout }, 'Sign out'))));
    const main = h('div', { class: 'main' },
      h('div', { class: 'topbar' }, h('button', { class: 'btn sm menu-btn', 'aria-label': 'Menu', onclick: () => side.classList.toggle('open') }, '☰'), title,
        h('span', { class: 'right' }), h('button', { class: 'btn ghost sm', onclick: toggleTheme, 'aria-label': 'Toggle theme' }, 'Theme'), bell), content);
    NX.clear(root).append(h('div', { class: 'shell' }, side, main));
    refreshBell();
    return { content, title };
  }
  function toggleTheme() {
    const el = document.documentElement; const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const cur = el.dataset.theme || (dark ? 'dark' : 'light');
    el.dataset.theme = cur === 'dark' ? 'light' : 'dark';
  }
  async function refreshBell() {
    try { const n = await get('/api/notifications'); const b = document.getElementById('nbadge'); if (b) b.textContent = n.unread ? `${n.unread}` : ''; NX._notifs = n; } catch (_) { /* ignore */ }
  }
  async function openNotifications() {
    const n = await get('/api/notifications');
    const m = modal('Notifications', h('div', null,
      n.items.length ? n.items.map((i) => h('div', { class: 'comment' }, i.link ? h('a', { href: i.link, onclick: () => m.close() }, i.message) : i.message,
        h('div', { class: 'small muted' }, NX.ago(i.created_at), i.is_read ? '' : ' · new'))) : h('div', { class: 'empty' }, 'No notifications.'),
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: async () => { await post('/api/notifications/read'); m.close(); refreshBell(); } }, 'Mark all as read'))));
  }

  const head = (title, sub, ...actions) => h('div', { class: 'pagehead' }, h('div', null, h('h1', null, title), sub ? h('div', { class: 'muted' }, sub) : null), h('div', { class: 'actions' }, actions));
  const busy = (btn, fn) => async (...a) => { btn.disabled = true; try { await fn(...a); } finally { btn.disabled = false; } };

  /* ============================== login / password ============================== */
  pages.login = function () {
    const err = NX.errBox();
    const email = h('input', { type: 'email', autocomplete: 'username', value: '', required: true });
    const pw = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Sign in');
    const demo = [['Administrator', 'admin'], ['QA Manager', 'qa.manager'], ['QA Engineer', 'qa.engineer'], ['Developer', 'developer'], ['Product Owner', 'product.owner'], ['Viewer', 'viewer']];
    NX.clear(root).append(h('div', { class: 'login' }, h('div', { class: 'box' },
      h('div', { class: 'card' },
        h('div', { class: 'brand', style: 'padding-left:0' }, h('div', { class: 'logo' }, NX.svg('svg', { width: 18, height: 18, viewBox: '0 0 32 32' }, NX.svg('path', { d: 'M8 17l6 6 11-14', stroke: '#fff', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))), 'QAForge Nexus'),
        h('p', { class: 'muted' }, 'Functional testing & software validation platform'),
        err,
        h('form', { onsubmit: async (e) => {
          e.preventDefault(); err.hidden = true; submit.disabled = true;
          try { const r = await api('POST', '/api/auth/login', { email: email.value, password: pw.value }, { noAuthRedirect: true }); NX.setToken(r.token); NX.user = null; location.hash = '#/dashboard'; NX.render(); }
          catch (ex) { NX.showErr(err, ex); } finally { submit.disabled = false; }
        } }, field('Work email', email), field('Password', pw), submit),
        h('div', { class: 'demo muted' }, 'Demo accounts (password ', h('span', { class: 'mono' }, 'Nexus@123'), '):', h('br'),
          demo.map(([l, u]) => h('button', { type: 'button', class: 'btn sm', onclick: () => { email.value = `${u}@nexora-tech.example`; pw.value = 'Nexus@123'; } }, l)))))));
  };

  pages.password = function (c) {
    const err = NX.errBox(); const cur = h('input', { type: 'password', autocomplete: 'current-password' }); const nw = h('input', { type: 'password', autocomplete: 'new-password' });
    c.append(head('Change password', NX.user.must_change_password ? 'You must set a new password before continuing.' : null),
      h('div', { class: 'card', style: 'max-width:460px' }, err, field('Current password', cur), field('New password', nw, 'At least 8 characters with upper-case, lower-case and a digit.'),
        h('button', { class: 'btn primary', onclick: async () => {
          try { await post('/api/auth/change-password', { current_password: cur.value, new_password: nw.value }); NX.user.must_change_password = false; toast('Password updated'); go('#/dashboard'); }
          catch (e) { NX.showErr(err, e); }
        } }, 'Update password')));
  };

  /* ============================== dashboard ============================== */
  pages.dashboard = async function (c, route) {
    const projects = (await get('/api/projects')).items;
    const pid = route.query.project || '';
    const d = await get(`/api/reports/dashboard${pid ? `?project_id=${pid}` : ''}`);
    const k = d.kpis;
    const kpi = (v, l, cls) => h('div', { class: `card kpi ${cls || ''}` }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l));
    const sel = select([['', 'All projects'], ...projects.map((p) => [p.id, `${p.key} - ${p.name}`])], pid, { onchange: (e) => go(`#/dashboard${e.target.value ? `?project=${e.target.value}` : ''}`), 'aria-label': 'Project filter', style: 'width:auto' });
    c.append(head('Quality dashboard', 'Live view of test health and defect flow', sel));
    c.append(h('div', { class: 'grid g6' },
      kpi(k.testCases, `Test cases (${k.automatedPct}% automated)`), kpi(NX.pct(k.passRate30), 'Pass rate, last 30 days', k.passRate30 >= 90 ? 'ok' : ''),
      kpi(k.openDefects, 'Open defects'), kpi(k.criticalOpen, 'Critical open', k.criticalOpen ? 'bad' : 'ok'),
      kpi(k.slaBreached, 'SLA breached', k.slaBreached ? 'bad' : 'ok'), kpi(k.mttrHours == null ? '-' : `${k.mttrHours}h`, 'Mean time to resolve')));
    c.append(h('div', { class: 'grid g2', style: 'margin-top:16px' },
      h('div', { class: 'card' }, h('h2', null, 'Pass rate trend (daily)'),
        d.trend.length ? [NX.lineChart(d.trend.map((t) => t.day.slice(5)), [{ name: 'Pass rate', data: d.trend.map((t) => t.rate) }], { max: 100, suffix: '%' })] : h('div', { class: 'empty' }, 'No completed runs yet.')),
      h('div', { class: 'card' }, h('h2', null, 'Defects opened vs resolved (weekly)'),
        NX.groupedBars(d.flow.map((f) => f.week), [{ name: 'Opened', data: d.flow.map((f) => f.opened), color: 'var(--c4)' }, { name: 'Resolved', data: d.flow.map((f) => f.resolved), color: 'var(--c2)' }]),
        NX.legend([['var(--c4)', 'Opened'], ['var(--c2)', 'Resolved']]))));
    const sevColor = { Critical: 'var(--c4)', High: 'var(--c3)', Medium: 'var(--c1)', Low: 'var(--c6)' };
    c.append(h('div', { class: 'grid g3', style: 'margin-top:16px' },
      h('div', { class: 'card' }, h('h2', null, 'Open defects by severity'), NX.hbars(d.bySeverity.map((s) => ({ label: s.severity, value: s.n, color: sevColor[s.severity] })))),
      h('div', { class: 'card' }, h('h2', null, 'Defects by lifecycle stage'), NX.hbars(d.byStatus.filter((s) => s.n).map((s) => ({ label: s.status, value: s.n })))),
      h('div', { class: 'card' }, h('h2', null, 'Developer workload (active)'), d.workload.length ? NX.hbars(d.workload.map((w) => ({ label: w.name, value: w.n })), { color: 'var(--c5)' }) : h('div', { class: 'empty' }, 'No assigned work.'))));
    c.append(h('div', { class: 'grid g2', style: 'margin-top:16px' },
      h('div', { class: 'card' }, h('h2', null, 'Most failing test cases (30 days)'),
        table([{ label: 'Case', render: (r) => h('a', { href: `#/p/${r.project_key}/cases?open=${r.id}` }, r.code) }, { label: 'Title', key: 'title' }, { label: 'Fails', key: 'failures' }], d.topFailing, { empty: 'No failures recorded.' })),
      h('div', { class: 'card' }, h('h2', null, 'Recent test runs'),
        table([{ label: 'Run', render: (r) => h('a', { href: `#/runs/${r.id}` }, `${r.project_key}/${r.code}`) }, { label: 'Name', key: 'name' }, { label: 'Result', render: (r) => `${r.passed}/${r.total} passed` }, { label: 'When', render: (r) => NX.ago(r.started_at) }], d.recentRuns))));
    c.append(h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', null, 'Latest defects'),
      table([{ label: 'ID', render: (r) => h('a', { href: `#/defects/${r.id}` }, `${r.project_key}-${r.code}`) }, { label: 'Title', key: 'title' }, { label: 'Severity', render: (r) => badge(r.severity) }, { label: 'Status', render: (r) => badge(r.status) }, { label: 'Opened', render: (r) => NX.ago(r.created_at) }], d.recentDefects)));
  };

  /* ============================== projects ============================== */
  pages.projects = async function (c) { return pages.p(c, { parts: ['p'], query: {} }); };
  pages.p = async function (c, route, shell) {
    const key = route.parts[1];
    if (!key) {
      const items = (await get('/api/projects')).items;
      c.append(head('Projects', `${items.length} project(s) you can access`, NX.can('project.create') ? h('button', { class: 'btn primary', onclick: newProject }, '+ New project') : null));
      c.append(h('div', { class: 'grid g3' }, items.map((p) => h('div', { class: 'card' },
        h('div', { class: 'row' }, h('b', null, h('a', { href: `#/p/${p.key}` }, p.name)), badge(p.key, 'auto')),
        h('p', { class: 'muted small', style: 'min-height:34px' }, p.description || ''),
        h('div', { class: 'row small' }, h('span', null, `${p.test_cases} cases`), h('span', null, `${p.open_defects} open defects`), h('span', null, `Pass ${NX.pct(p.last_pass_rate)}`)),
        h('div', { class: 'small muted', style: 'margin-top:6px' }, `Owner: ${p.owner_name || '-'} · ${p.members} members · ${p.base_url ? 'Automation enabled' : (p.source_dataset ? `Real ${p.source_dataset} data` : 'Manual only')}`)))));
      return;
    }
    const { project, members } = await get(`/api/projects/${key}`);
    const tab = route.parts[2] || 'overview';
    const tabs = [['overview', 'Overview'], ['cases', 'Test cases'], ['runs', 'Test runs'], ['defects', 'Defects'], ['trace', 'Traceability'], ['reqs', 'Requirements'], ['members', 'Team']];
    c.append(head(`${project.key} · ${project.name}`, project.description),
      h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([t, l]) => h('a', { href: `#/p/${project.key}${t === 'overview' ? '' : `/${t}`}`, class: tab === t ? 'active' : null, role: 'tab' }, l))));
    const body = h('div'); c.append(body);
    const fn = projectTabs[tab]; if (!fn) body.append(h('div', { class: 'empty' }, 'Unknown tab'));
    else await fn(body, project, members, route);
  };

  function newProject() {
    const err = NX.errBox(); const f = { key: h('input', { maxlength: 8, placeholder: 'e.g. SHOP' }), name: h('input'), desc: h('textarea'), url: h('input', { placeholder: 'https://staging.example.com  (optional)' }) };
    const m = modal('New project', h('div', null, err, h('div', { class: 'row' }, field('Key', f.key), field('Name', f.name)), field('Description', f.desc),
      field('Base URL of the system under test', f.url, 'Needed for automated black-box execution. Leave empty for manual testing only.'),
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
        try { const r = await post('/api/projects', { key: f.key.value, name: f.name.value, description: f.desc.value, base_url: f.url.value }); m.close(); go(`#/p/${r.key}`); } catch (e) { NX.showErr(err, e); }
      } }, 'Create'))));
  }

  const projectTabs = {};
  projectTabs.overview = async (b, project, members) => {
    const [runs, defs, trace] = await Promise.all([get(`/api/projects/${project.id}/runs?limit=8`), get(`/api/projects/${project.id}/defects?open=1&sort=severity&limit=8`), get(`/api/projects/${project.id}/traceability`)]);
    const s = trace.summary;
    b.append(h('div', { class: 'grid g4' },
      h('div', { class: 'card kpi' }, h('div', { class: 'v' }, project.test_cases), h('div', { class: 'l' }, `Test cases · ${project.automated_cases} automated`)),
      h('div', { class: 'card kpi' }, h('div', { class: 'v' }, NX.pct(project.last_pass_rate)), h('div', { class: 'l' }, 'Last run pass rate')),
      h('div', { class: 'card kpi' }, h('div', { class: 'v' }, project.open_defects), h('div', { class: 'l' }, 'Open defects')),
      h('div', { class: 'card kpi' }, h('div', { class: 'v' }, `${s.coveragePct}%`), h('div', { class: 'l' }, `Requirement coverage (${s.covered}/${s.requirements})`))));
    b.append(h('div', { class: 'grid g2', style: 'margin-top:16px' },
      h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', null, 'Recent runs'), h('a', { class: 'right small', href: `#/p/${project.key}/runs` }, 'All runs')),
        table([{ label: 'Run', render: (r) => h('a', { href: `#/runs/${r.id}` }, r.code) }, { label: 'Name', key: 'name' }, { label: 'Status', render: (r) => badge(r.status) }, { label: 'Passed', render: (r) => `${r.passed}/${r.total}` }], runs.items)),
      h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', null, 'Top open defects'), h('a', { class: 'right small', href: `#/p/${project.key}/defects` }, 'All defects')),
        table([{ label: 'ID', render: (r) => h('a', { href: `#/defects/${r.id}` }, r.code) }, { label: 'Title', key: 'title' }, { label: 'Sev.', render: (r) => badge(r.severity) }, { label: 'Status', render: (r) => badge(r.status) }], defs.items, { empty: 'No open defects.' }))));
    b.append(h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', null, 'Details'), h('dl', { class: 'kv' },
      h('dt', null, 'Owner'), h('dd', null, project.owner_name || '-'), h('dt', null, 'System under test'), h('dd', { class: 'mono' }, project.base_url || 'Not configured (manual testing only)'), project.source_dataset ? h('dt', null, 'Real dataset') : null, project.source_dataset ? h('dd', null, `${project.source_dataset} - real bugs, trigger tests and fixes (`, h('a', { href: project.source_url, target: '_blank', rel: 'noopener noreferrer' }, 'source repository ↗'), ')') : null,
      h('dt', null, 'Team size'), h('dd', null, `${members.length} members`), h('dt', null, 'Status'), h('dd', null, badge(project.status)),
      h('dt', null, 'Created'), h('dd', null, NX.fmtDay(project.created_at))),
      NX.can('project.edit') ? h('div', { style: 'margin-top:10px' }, h('button', { class: 'btn sm', onclick: () => editProject(project) }, 'Edit project')) : null));
  };
  function editProject(p) {
    const err = NX.errBox(); const name = h('input', { value: p.name }); const desc = h('textarea', null, p.description || ''); const url = h('input', { value: p.base_url || '' });
    const m = modal('Edit project', h('div', null, err, field('Name', name), field('Description', desc), field('Base URL', url, 'Use /demo-sut for the built-in demo target.'),
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
        try { await patch(`/api/projects/${p.id}`, { name: name.value, description: desc.value, base_url: url.value }); m.close(); toast('Saved'); NX.render(); } catch (e) { NX.showErr(err, e); }
      } }, 'Save'))));
  }

  /* ---------- requirements ---------- */
  projectTabs.reqs = async (b, project) => {
    const items = (await get(`/api/projects/${project.id}/requirements`)).items;
    b.append(h('div', { class: 'row', style: 'margin-bottom:12px' }, h('span', { class: 'muted' }, `${items.length} requirements`), NX.can('requirement.write') ? h('button', { class: 'btn primary right', onclick: () => reqForm(project) }, '+ Requirement') : null));
    b.append(h('div', { class: 'card' }, table([{ label: 'ID', key: 'code' }, { label: 'Title', key: 'title' }, { label: 'Priority', render: (r) => badge(r.priority, 'auto') }, { label: 'Status', render: (r) => badge(r.status) }, { label: 'Cases', key: 'cases' }],
      items, { onRow: NX.can('requirement.write') ? (r) => reqForm(project, r) : null, empty: 'No requirements yet.' })));
  };
  function reqForm(project, r) {
    const err = NX.errBox(); const title = h('input', { value: r ? r.title : '' }); const desc = h('textarea', null, r ? r.description || '' : '');
    const pr = select(NX.meta.priorities, r ? r.priority : 'P2'); const st = select(['draft', 'approved', 'retired'], r ? r.status : 'approved');
    const m = modal(r ? `Edit ${r.code}` : 'New requirement', h('div', null, err, field('Title', title), field('Description', desc), h('div', { class: 'row' }, field('Priority', pr), field('Status', st)),
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
        const body = { title: title.value, description: desc.value, priority: pr.value, status: st.value };
        try { r ? await patch(`/api/requirements/${r.id}`, body) : await post(`/api/projects/${project.id}/requirements`, body); m.close(); NX.render(); } catch (e) { NX.showErr(err, e); }
      } }, 'Save'))));
  }

  /* ---------- members ---------- */
  projectTabs.members = async (b, project, members) => {
    if (NX.can('member.manage')) {
      const users = (await get('/api/users?limit=200&active=1')).items.filter((u) => !members.some((m) => m.id === u.id) && ['qa_engineer', 'developer', 'product_owner', 'qa_manager'].includes(u.role));
      const sel = select([['', 'Add a member...'], ...users.map((u) => [u.id, `${u.name} (${NX.roleName(u.role)})`])], '', { style: 'width:auto;min-width:260px' });
      b.append(h('div', { class: 'row', style: 'margin-bottom:12px' }, sel, h('button', { class: 'btn', onclick: async () => { if (!sel.value) return; try { await post(`/api/projects/${project.id}/members`, { user_id: Number(sel.value) }); NX.render(); } catch (e) { toast(e.message, true); } } }, 'Add')));
    }
    b.append(h('div', { class: 'card' }, table([{ label: 'Name', key: 'name' }, { label: 'Role', render: (r) => NX.roleName(r.role) }, { label: 'Designation', key: 'designation' }, { label: 'Department', key: 'department' }, { label: '', render: (r) => (NX.can('member.manage') ? h('button', { class: 'btn sm danger', onclick: async () => { if (await NX.confirm(`Remove ${r.name} from this project?`, 'Remove')) { await del(`/api/projects/${project.id}/members/${r.id}`); NX.render(); } } }, 'Remove') : null) }], members)));
  };

  /* ---------- traceability ---------- */
  projectTabs.trace = async (b, project) => {
    const t = await get(`/api/projects/${project.id}/traceability`); const s = t.summary;
    b.append(h('div', { class: 'row', style: 'margin-bottom:12px' },
      h('span', null, `Coverage ${s.coveragePct}% — ${s.passing} passing, ${s.failing} failing, ${s.notRun} not run, ${s.notCovered} not covered`),
      h('button', { class: 'btn right', onclick: () => NX.download(`/api/projects/${project.id}/traceability.csv`, `${project.key}-traceability.csv`) }, 'Export CSV')));
    b.append(h('div', { class: 'card' }, table([{ label: 'Requirement', render: (r) => h('span', null, h('b', null, r.code), ' ', r.title) }, { label: 'Priority', key: 'priority' },
      { label: 'Test cases', render: (r) => (r.cases.length ? h('span', { class: 'flow' }, r.cases.map((c) => h('a', { href: `#/p/${project.key}/cases?open=${c.id}`, title: c.title }, c.code))) : '-') },
      { label: 'Coverage', render: (r) => badge(r.coverage) }, { label: 'Open defects', key: 'open_defects' }], t.rows)));
  };

  /* ---------- test cases ---------- */
  projectTabs.cases = async (b, project, members, route) => {
    const [suites, reqs] = await Promise.all([get(`/api/projects/${project.id}/suites`), get(`/api/projects/${project.id}/requirements`)]);
    const f = { q: route.query.q || '', suite_id: route.query.suite_id || '', type: route.query.type || '', automated: route.query.automated || '', last_status: route.query.last_status || '' };
    const qs = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const data = await get(`/api/projects/${project.id}/testcases?${qs}`);
    const apply = (k, v) => { f[k] = v; go(`#/p/${project.key}/cases?${Object.entries(f).filter(([, x]) => x).map(([a, x]) => `${a}=${encodeURIComponent(x)}`).join('&')}`); };
    const q = h('input', { type: 'search', placeholder: 'Search code or title', value: f.q, 'aria-label': 'Search', onkeydown: (e) => { if (e.key === 'Enter') apply('q', e.target.value); } });
    b.append(h('div', { class: 'filters' }, q,
      select([['', 'All suites'], ...suites.items.map((s) => [s.id, s.name])], f.suite_id, { onchange: (e) => apply('suite_id', e.target.value), 'aria-label': 'Suite' }),
      select([['', 'All types'], ...NX.meta.testTypes], f.type, { onchange: (e) => apply('type', e.target.value), 'aria-label': 'Type' }),
      select([['', 'Manual + automated'], ['1', 'Automated'], ['0', 'Manual']], f.automated, { onchange: (e) => apply('automated', e.target.value), 'aria-label': 'Automation' }),
      select([['', 'Any last result'], ['passed', 'Passed'], ['failed', 'Failed'], ['error', 'Error'], ['none', 'Never run']], f.last_status, { onchange: (e) => apply('last_status', e.target.value), 'aria-label': 'Last result' }),
      h('span', { class: 'right row' }, h('span', { class: 'muted small' }, `${data.total} cases`),
        h('button', { class: 'btn', onclick: () => NX.download(`/api/projects/${project.id}/testcases.csv`, `${project.key}-testcases.csv`) }, 'Export CSV'),
        NX.can('testcase.write') ? [h('button', { class: 'btn', onclick: () => importCases(project) }, 'Import JSON'), h('button', { class: 'btn', onclick: () => suiteForm(project) }, '+ Suite'), h('button', { class: 'btn primary', onclick: () => caseForm(project, suites.items, reqs.items) }, '+ Test case')] : null)));
    b.append(h('div', { class: 'card' }, table([{ label: 'ID', render: (r) => h('b', null, r.code) }, { label: 'Title', render: (r) => h('span', null, r.title, r.is_setup ? ' ' : '', r.is_setup ? badge('setup', 'draft') : null) }, { label: 'Suite', key: 'suite_name' }, { label: 'Req.', key: 'requirement_code' },
      { label: 'Type', key: 'type' }, { label: 'Pri.', key: 'priority' }, { label: 'Mode', render: (r) => (r.automated ? badge('automated', 'auto') : badge('manual', 'draft')) },
      { label: 'Last result', render: (r) => (r.last_status ? badge(r.last_status) : h('span', { class: 'muted' }, '-')) }, { label: 'Defects', render: (r) => (r.open_defects ? badge(r.open_defects, 'Critical') : '') }],
      data.items, { onRow: (r) => caseDetail(project, r.id, suites.items, reqs.items), empty: 'No test cases match your filters.' })));
    if (route.query.open) caseDetail(project, Number(route.query.open), suites.items, reqs.items);
  };
  function suiteForm(project) {
    const err = NX.errBox(); const name = h('input'); const desc = h('input');
    const m = modal('New test suite', h('div', null, err, field('Name', name), field('Description', desc), h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn primary', onclick: async () => { try { await post(`/api/projects/${project.id}/suites`, { name: name.value, description: desc.value }); m.close(); NX.render(); } catch (e) { NX.showErr(err, e); } } }, 'Create'))));
  }
  function importCases(project) {
    const err = NX.errBox();
    const ta = h('textarea', { class: 'code', style: 'min-height:220px', placeholder: '{ "cases": [ { "title": "...", "automated": true, "method": "GET", "endpoint": "/health", "assertions": [ { "type": "status", "op": "eq", "value": 200 } ] } ] }' });
    const m = modal('Import test cases (JSON)', h('div', null, err, ta, h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn primary', onclick: async () => { try { let j = JSON.parse(ta.value); if (Array.isArray(j)) j = { cases: j }; const r = await post(`/api/projects/${project.id}/testcases/import`, j); m.close(); toast(`${r.created.length} test cases imported`); NX.render(); } catch (e) { NX.showErr(err, e); } } }, 'Import'))), { wide: true });
  }

  async function caseDetail(project, id, suites, reqs) {
    const d = await get(`/api/testcases/${id}`); const t = d.testcase;
    const run = async (btn) => {
      btn.disabled = true;
      try { const r = await post(`/api/testcases/${t.id}/execute`, { retries: 1 }); toast(`Started ${r.run.code}`); go(`#/runs/${r.run.id}`); } catch (e) { toast(e.message, true); btn.disabled = false; }
    };
    const runBtn = h('button', { class: 'btn primary', onclick: (e) => run(e.target) }, 'Run now');
    const m = modal(`${t.code} · ${t.title}`, h('div', null,
      h('div', { class: 'flow', style: 'margin-bottom:10px' }, badge(t.type, 'draft'), badge(t.priority, 'auto'), t.automated ? badge('automated', 'auto') : badge('manual', 'draft'), badge(t.status)),
      t.automated ? h('div', { class: 'card', style: 'margin-bottom:12px' }, h('div', { class: 'mono' }, `${t.method} ${t.endpoint}`),
        t.body ? h('pre', { class: 'block', style: 'margin-top:8px' }, t.body) : null,
        h('h3', { style: 'margin-top:10px' }, 'Assertions'), h('ul', { style: 'margin:0;padding-left:18px' }, t.assertions.map((a) => h('li', { class: 'mono' }, a.desc || assertText(a))))) : null,
      t.steps_text ? [h('h3', null, 'Steps'), h('pre', { class: 'block' }, t.steps_text)] : null,
      t.expected_text ? [h('h3', { style: 'margin-top:10px' }, 'Expected result'), h('pre', { class: 'block' }, t.expected_text)] : null,
      h('h3', { style: 'margin-top:12px' }, 'Execution history'),
      table([{ label: 'Run', render: (r) => h('a', { href: `#/runs/${r.run_id}`, onclick: () => m.close() }, r.run_code) }, { label: 'Result', render: (r) => h('span', null, badge(r.status), r.flaky ? ' ' : '', r.flaky ? badge('flaky', 'flaky') : null) }, { label: 'Time', render: (r) => NX.dur(r.duration_ms) }, { label: 'When', render: (r) => NX.ago(r.executed_at) }], d.history, { empty: 'Never executed.' }),
      d.defects.length ? [h('h3', { style: 'margin-top:12px' }, 'Linked defects'), table([{ label: 'ID', render: (r) => h('a', { href: `#/defects/${r.id}`, onclick: () => m.close() }, r.code) }, { label: 'Title', key: 'title' }, { label: 'Severity', render: (r) => badge(r.severity) }, { label: 'Status', render: (r) => badge(r.status) }], d.defects)] : null,
      h('div', { class: 'foot' }, NX.can('testcase.write') ? [h('button', { class: 'btn danger', onclick: async () => { if (await NX.confirm(`Deprecate ${t.code}? It will no longer run.`, 'Deprecate')) { await del(`/api/testcases/${t.id}`); m.close(); NX.render(); } } }, 'Deprecate'), h('button', { class: 'btn', onclick: () => { m.close(); caseForm(project, suites, reqs, t); } }, 'Edit')] : null,
        t.automated && NX.can('run.execute') ? runBtn : null)), { wide: true });
  }
  const assertText = (a) => `${a.type}${a.path ? ` ${a.path}` : ''} ${a.op}${a.value !== undefined ? ` ${JSON.stringify(a.value)}` : ''}`;

  function caseForm(project, suites, reqs, tc) {
    const t = tc || { type: 'functional', priority: 'P2', status: 'ready', automated: 0, method: 'GET', timeout_ms: 10000, assertions: [], extract: [], headers: {} };
    const err = NX.errBox();
    const F = {
      title: h('input', { value: t.title || '' }), suite: select([['', '(none)'], ...suites.map((s) => [s.id, s.name])], t.suite_id || ''), req: select([['', '(none)'], ...reqs.map((r) => [r.id, `${r.code} ${r.title}`])], t.requirement_id || ''),
      type: select(NX.meta.testTypes, t.type), pri: select(NX.meta.priorities, t.priority), status: select(['draft', 'ready'], t.status === 'deprecated' ? 'draft' : t.status),
      pre: h('textarea', null, t.preconditions || ''), steps: h('textarea', null, t.steps_text || ''), exp: h('textarea', null, t.expected_text || ''),
      auto: h('input', { type: 'checkbox', checked: !!t.automated }), setup: h('input', { type: 'checkbox', checked: !!t.is_setup }), dep: h('input', { type: 'checkbox', checked: !!t.depends_on_previous }),
      method: select(NX.meta.methods, t.method || 'GET', { style: 'width:110px' }), endpoint: h('input', { value: t.endpoint || '', placeholder: '/products?limit=10' }),
      headers: h('textarea', { class: 'code', placeholder: '{ "Authorization": "Bearer {{token}}" }' }, t.headers && Object.keys(t.headers).length ? JSON.stringify(t.headers, null, 2) : ''),
      body: h('textarea', { class: 'code', placeholder: '{ "email": "user{{random}}@store.test" }' }, t.body || ''), timeout: h('input', { type: 'number', value: t.timeout_ms || 10000, min: 500, max: 60000 }),
    };
    const aBox = h('div'); const xBox = h('div');
    const parseVal = (s) => { const x = s.trim(); if (x === '') return ''; try { return JSON.parse(x); } catch (_) { return s; } };
    const showVal = (v) => (v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v));
    function addAssert(a) {
      const row = h('div', { class: 'assert-row' },
        select(NX.meta.assertionTypes, a.type || 'status', { 'aria-label': 'Assertion type' }), h('input', { placeholder: 'JSON path / header name', value: a.path || '', 'aria-label': 'Path' }),
        select(NX.meta.assertionOps, a.op || 'eq', { 'aria-label': 'Operator' }), h('input', { placeholder: 'expected value (JSON or text)', value: showVal(a.value), 'aria-label': 'Expected value' }),
        h('button', { class: 'btn sm danger', type: 'button', 'aria-label': 'Remove assertion', onclick: () => row.remove() }, '✕'));
      row.read = () => { const [ty, pa, op, va] = row.querySelectorAll('select,input'); const o = { type: ty.value, op: op.value }; if (pa.value.trim()) o.path = pa.value.trim(); if (!['exists', 'not_exists'].includes(op.value)) o.value = parseVal(va.value); return o; };
      aBox.append(row);
    }
    function addExtract(x) {
      const row = h('div', { class: 'row', style: 'margin-bottom:6px' }, h('input', { placeholder: 'variable name', value: x.var || '', style: 'max-width:160px' }), h('input', { placeholder: 'JSON path (e.g. $.token)', value: x.path || '' }), select(['body', 'header'], x.from || 'body', { style: 'max-width:100px' }), h('button', { class: 'btn sm danger', type: 'button', onclick: () => row.remove() }, '✕'));
      row.read = () => { const [v, p, f] = row.querySelectorAll('input,select'); return { var: v.value.trim(), path: p.value.trim(), from: f.value }; };
      xBox.append(row);
    }
    (t.assertions.length ? t.assertions : [{ type: 'status', op: 'eq', value: 200 }]).forEach(addAssert); t.extract.forEach(addExtract);
    const autoPane = h('div', { class: 'card', style: 'margin-bottom:12px' },
      h('div', { class: 'row' }, h('div', { class: 'field', style: 'flex:0 0 auto' }, h('label', { class: 'f' }, 'Method'), F.method), field('Endpoint (relative to project base URL)', F.endpoint), h('div', { class: 'field', style: 'flex:0 0 120px' }, h('label', { class: 'f' }, 'Timeout (ms)'), F.timeout)),
      h('div', { class: 'row', style: 'margin-top:10px' }, field('Headers (JSON)', F.headers), field('Body', F.body)),
      h('h3', { style: 'margin-top:12px' }, 'Assertions'), aBox, h('button', { class: 'btn sm', type: 'button', onclick: () => addAssert({}) }, '+ Assertion'),
      h('h3', { style: 'margin-top:12px' }, 'Capture variables (optional)'), h('div', { class: 'small muted' }, 'Capture values (e.g. a login token) and use them in later cases as {{name}}. {{random}} is replaced by a unique number.'), xBox, h('button', { class: 'btn sm', type: 'button', onclick: () => addExtract({}) }, '+ Variable'));
    const sync = () => { autoPane.hidden = !F.auto.checked; }; F.auto.addEventListener('change', sync); sync();
    const m = modal(tc ? `Edit ${tc.code}` : 'New test case', h('div', null, err, field('Title', F.title),
      h('div', { class: 'row' }, field('Suite', F.suite), field('Requirement', F.req)), h('div', { class: 'row' }, field('Type', F.type), field('Priority', F.pri), field('Status', F.status)),
      field('Preconditions', F.pre), field('Steps', F.steps), field('Expected result', F.exp),
      h('div', { class: 'row', style: 'margin-bottom:12px' }, h('label', { class: 'chk' }, F.auto, 'Automated (black-box HTTP)'), h('label', { class: 'chk' }, F.setup, 'Setup case (runs before others)'), h('label', { class: 'chk' }, F.dep, 'Depends on previous case in suite')),
      autoPane,
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
        try {
          let headers = {}; if (F.headers.value.trim()) { try { headers = JSON.parse(F.headers.value); } catch (_) { throw new Error('Headers must be valid JSON'); } }
          const body = { title: F.title.value, suite_id: F.suite.value || null, requirement_id: F.req.value || null, type: F.type.value, priority: F.pri.value, status: F.status.value, preconditions: F.pre.value, steps_text: F.steps.value, expected_text: F.exp.value,
            automated: F.auto.checked, is_setup: F.setup.checked, depends_on_previous: F.dep.checked };
          if (F.auto.checked) Object.assign(body, { method: F.method.value, endpoint: F.endpoint.value, headers, body: F.body.value, timeout_ms: Number(F.timeout.value), assertions: [...aBox.children].map((r) => r.read()), extract: [...xBox.children].map((r) => r.read()).filter((x) => x.var) });
          tc ? await patch(`/api/testcases/${tc.id}`, body) : await post(`/api/projects/${project.id}/testcases`, body);
          m.close(); toast('Test case saved'); NX.render();
        } catch (e) { NX.showErr(err, e); }
      } }, 'Save'))), { wide: true });
  }

  /* ---------- runs ---------- */
  projectTabs.runs = async (b, project, members, route) => {
    const [runs, suites] = await Promise.all([get(`/api/projects/${project.id}/runs`), get(`/api/projects/${project.id}/suites`)]);
    b.append(h('div', { class: 'row', style: 'margin-bottom:12px' }, h('span', { class: 'muted' }, `${runs.items.length} recent runs`),
      NX.can('run.execute') ? h('span', { class: 'right row' }, h('button', { class: 'btn', onclick: () => manualRunForm(project) }, 'Start manual run'), h('button', { class: 'btn primary', onclick: () => autoRunForm(project, suites.items) }, '▶ Run automated tests')) : null));
    b.append(h('div', { class: 'card' }, table([{ label: 'Run', render: (r) => h('a', { href: `#/runs/${r.id}` }, r.code) }, { label: 'Name', key: 'name' }, { label: 'Type', key: 'trigger_type' }, { label: 'Status', render: (r) => badge(r.status) },
      { label: 'Result', render: (r) => h('div', { style: 'min-width:120px' }, NX.stackBar([{ label: 'Passed', value: r.passed, color: 'var(--c2)' }, { label: 'Failed', value: r.failed + r.errored, color: 'var(--c4)' }, { label: 'Blocked', value: r.blocked + r.skipped, color: 'var(--c3)' }]), h('div', { class: 'small muted' }, `${r.passed}/${r.total} passed`)) },
      { label: 'Flaky', render: (r) => r.flaky || '' }, { label: 'Duration', render: (r) => NX.dur(r.duration_ms) }, { label: 'By', key: 'started_by_name' }, { label: 'Started', render: (r) => NX.ago(r.started_at) }], runs.items, { empty: 'No runs yet. Start one above.' })));
  };
  function autoRunForm(project, suites) {
    const err = NX.errBox(); const name = h('input', { placeholder: 'Automated run' }); const env = h('input', { placeholder: 'e.g. Staging', value: 'Staging' }); const retries = select([['0', 'No retries'], ['1', '1 retry (detect flaky tests)'], ['2', '2 retries']], '1');
    const checks = suites.map((s) => [s, h('input', { type: 'checkbox', checked: true })]);
    const m = modal('Run automated black-box tests', h('div', null, err, project.base_url ? null : h('div', { class: 'alert warn' }, 'This project has no base URL yet. Edit the project first.'),
      h('div', { class: 'row' }, field('Run name', name), field('Environment', env), field('Retries', retries)),
      h('label', { class: 'f' }, 'Suites'), h('div', { style: 'margin-bottom:8px' }, checks.map(([s, c]) => h('div', null, h('label', { class: 'chk' }, c, `${s.name} (${s.cases} cases)`)))),
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async (e) => {
        e.target.disabled = true;
        try { const r = await post(`/api/projects/${project.id}/runs`, { name: name.value, environment: env.value, retries: Number(retries.value), suite_ids: checks.filter(([, c]) => c.checked).map(([s]) => s.id) }); m.close(); go(`#/runs/${r.run.id}`); } catch (ex) { NX.showErr(err, ex); e.target.disabled = false; }
      } }, 'Start run'))));
  }
  async function manualRunForm(project) {
    const cases = (await get(`/api/projects/${project.id}/testcases?status=ready`)).items;
    const err = NX.errBox(); const name = h('input', { placeholder: 'Manual regression pass' }); const env = h('input', { value: 'Staging' });
    const checks = cases.map((c) => [c, h('input', { type: 'checkbox', checked: !c.automated })]);
    const m = modal('Start manual run', h('div', null, err, h('div', { class: 'row' }, field('Run name', name), field('Environment', env)), h('label', { class: 'f' }, 'Test cases to execute'),
      h('div', { style: 'max-height:280px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:8px' }, checks.map(([c, k]) => h('div', null, h('label', { class: 'chk' }, k, `${c.code} — ${c.title}`)))),
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
        try { const r = await post(`/api/projects/${project.id}/runs`, { mode: 'manual', name: name.value, environment: env.value, case_ids: checks.filter(([, k]) => k.checked).map(([c]) => c.id) }); m.close(); go(`#/runs/${r.run.id}`); } catch (e) { NX.showErr(err, e); }
      } }, 'Start'))), { wide: true });
  }

  pages.runs = async function (c, route) {
    const id = route.parts[1];
    const load = async () => get(`/api/runs/${id}`);
    let d = await load();
    const draw = async () => {
      const r = d.run; const live = ['queued', 'running'].includes(r.status);
      NX.clear(c);
      c.append(head(`${r.project_key} / ${r.code}`, r.name, h('a', { class: 'btn', href: `#/p/${r.project_key}/runs` }, 'All runs'), h('button', { class: 'btn', onclick: () => NX.download(`/api/runs/${r.id}/results.csv`, `${r.code}-results.csv`) }, 'Export CSV'),
        r.trigger_type === 'manual' && r.status === 'running' && NX.can('run.execute') ? h('button', { class: 'btn primary', onclick: async () => { await post(`/api/runs/${r.id}/complete`); toast('Run completed'); d = await load(); draw(); } }, 'Complete run') : null));
      c.append(h('div', { class: 'grid g6' }, [['Status', badge(r.status)], ['Passed', r.passed], ['Failed', r.failed + r.errored], ['Blocked/Skipped', r.blocked + r.skipped], ['Flaky', r.flaky], ['Duration', NX.dur(r.duration_ms)]].map(([l, v]) => h('div', { class: 'card kpi' }, h('div', { class: 'v', style: 'font-size:22px' }, v), h('div', { class: 'l' }, l)))));
      c.append(h('div', { class: 'card', style: 'margin-top:16px' }, NX.stackBar([{ label: 'Passed', value: r.passed, color: 'var(--c2)' }, { label: 'Failed', value: r.failed + r.errored, color: 'var(--c4)' }, { label: 'Blocked', value: r.blocked, color: 'var(--c3)' }, { label: 'Skipped', value: r.skipped, color: 'var(--c6)' }]),
        h('div', { class: 'small muted', style: 'margin-top:6px' }, `${r.trigger_type} · ${r.environment || 'no environment'} · started ${NX.fmtDate(r.started_at)} by ${r.started_by_name || '-'}${r.retries ? ` · ${r.retries} retries allowed` : ''}`, live ? ' · executing…' : '')));
      if (r.trigger_type === 'manual' && r.status === 'running') await manualPane(c, d, async () => { d = await load(); draw(); });
      const rows = d.results.filter((x) => !x.prereq);
      c.append(h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', null, `Results (${rows.length}${live ? ` of ${r.total}` : ''})`),
        table([{ label: 'Case', render: (x) => h('a', { href: `#/p/${r.project_key}/cases?open=${x.test_case_id}` }, x.case_code) }, { label: 'Title', key: 'case_title' }, { label: 'Result', render: (x) => h('span', null, badge(x.status), x.flaky ? ' ' : '', x.flaky ? badge('flaky', 'flaky') : null) },
          { label: 'HTTP', render: (x) => x.response_status ?? '-' }, { label: 'Time', render: (x) => NX.dur(x.duration_ms) }, { label: 'Defect', render: (x) => (x.defect_id ? h('a', { href: `#/defects/${x.defect_id}` }, x.defect_code) : '') }],
          rows, { onRow: (x) => resultDetail(x), empty: live ? 'Waiting for results…' : 'No results.' })));
      if (live) pollTimer = setTimeout(async () => { try { d = await load(); await draw(); } catch (_) { /* ignore */ } }, 1500);
    };
    await draw();
  };
  async function manualPane(c, d, refresh) {
    const done = new Map(d.results.map((x) => [x.test_case_id, x]));
    const cases = (await get(`/api/projects/${d.run.project_id}/testcases?status=ready`)).items;
    // manual runs only know their case ids through results; show every ready manual case not yet recorded + recorded ones
    const pane = h('div', { class: 'card', style: 'margin-top:16px' }, h('h2', null, 'Record manual results'), h('div', { class: 'small muted', style: 'margin-bottom:8px' }, 'Mark each case you executed. A failure requires a note and raises (or re-observes) a defect automatically.'));
    const record = (tc, status) => {
      const notes = h('textarea', { placeholder: status === 'failed' ? 'What went wrong? (required)' : 'Notes (optional)' });
      const m = modal(`${tc.code}: mark as ${status}`, h('div', null, field('Notes', notes), h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
        try { const r = await post(`/api/runs/${d.run.id}/results`, { test_case_id: tc.id, status, notes: notes.value }); m.close(); toast(r.defect_id ? `Defect ${r.defect_action}` : 'Result recorded'); refresh(); } catch (e) { toast(e.message, true); }
      } }, 'Save'))));
    };
    pane.append(table([{ label: 'Case', key: 'code' }, { label: 'Title', key: 'title' }, { label: 'Recorded', render: (tc) => (done.has(tc.id) ? badge(done.get(tc.id).status) : '-') },
      { label: 'Record', render: (tc) => h('div', { class: 'flow' }, ['passed', 'failed', 'blocked', 'skipped'].map((s) => h('button', { class: `btn sm${s === 'failed' ? ' danger' : ''}`, onclick: () => record(tc, s) }, s))) }], cases.filter((x) => !x.automated || done.has(x.id))));
    c.append(pane);
  }
  function resultDetail(x) {
    const snap = x.request_snapshot || {};
    modal(`${x.case_code}: ${x.status}`, h('div', null,
      h('dl', { class: 'kv' }, h('dt', null, 'Request'), h('dd', { class: 'mono' }, `${snap.method || ''} ${snap.url || ''}`), h('dt', null, 'HTTP status'), h('dd', null, x.response_status ?? '-'), h('dt', null, 'Duration'), h('dd', null, NX.dur(x.duration_ms)), h('dt', null, 'Attempts'), h('dd', null, x.attempts), x.failure_reason ? [h('dt', null, 'Reason'), h('dd', null, x.failure_reason)] : null),
      snap.body ? [h('h3', { style: 'margin-top:12px' }, 'Request body'), h('pre', { class: 'block' }, snap.body)] : null,
      h('h3', { style: 'margin-top:12px' }, 'Assertions'), h('ul', { style: 'padding-left:18px;margin:0' }, (x.assertion_log || []).map((a) => h('li', null, badge(a.ok ? 'pass' : 'fail', a.ok ? 'passed' : 'failed'), ' ', a.desc, a.ok ? '' : h('span', { class: 'mono' }, ` → actual ${a.actual === undefined ? 'n/a' : JSON.stringify(a.actual)}`)))),
      x.response_excerpt ? [h('h3', { style: 'margin-top:12px' }, 'Response excerpt'), h('pre', { class: 'block' }, x.response_excerpt)] : null), { wide: true });
  }

  /* ============================== defects ============================== */
  const DEFECT_FILTERS = ['q', 'status', 'severity', 'assignee_id', 'source', 'sla', 'open', 'project_id', 'sort', 'page'];
  async function defectList(b, route, projectId, baseHash) {
    const f = {}; DEFECT_FILTERS.forEach((k) => { if (route.query[k]) f[k] = route.query[k]; });
    if (!('open' in f) && !f.status) f.open = '1';
    if (f.open === '0') delete f.open;
    const url = projectId ? `/api/projects/${projectId}/defects` : '/api/defects';
    const qs = new URLSearchParams({ ...f, limit: 25 }).toString();
    const data = await get(`${url}?${qs}`);
    const apply = (k, v) => { const n = { ...f, page: '' }; if (v) n[k] = v; else delete n[k]; if (k === 'status') delete n.open; if (k === 'open' && !v) n.open = '0'; go(`${baseHash}?${new URLSearchParams(Object.fromEntries(Object.entries(n).filter(([, x]) => x))).toString()}`); };
    const q = h('input', { type: 'search', value: f.q || '', placeholder: 'Search code or title', 'aria-label': 'Search', onkeydown: (e) => { if (e.key === 'Enter') apply('q', e.target.value); } });
    b.append(h('div', { class: 'filters' }, q,
      select([['', 'Any status'], ...NX.meta.statuses], f.status || '', { onchange: (e) => apply('status', e.target.value), 'aria-label': 'Status' }),
      select([['', 'Any severity'], ...NX.meta.severities], f.severity || '', { onchange: (e) => apply('severity', e.target.value), 'aria-label': 'Severity' }),
      select([['', 'Anyone'], ['me', 'Assigned to me']], f.assignee_id || '', { onchange: (e) => apply('assignee_id', e.target.value), 'aria-label': 'Assignee' }),
      select([['', 'Any source'], ['auto', 'Auto-detected'], ['manual', 'Manually reported']], f.source || '', { onchange: (e) => apply('source', e.target.value), 'aria-label': 'Source' }),
      select([['', 'Any SLA'], ['breached', 'SLA breached']], f.sla || '', { onchange: (e) => apply('sla', e.target.value), 'aria-label': 'SLA' }),
      select([['severity', 'Sort: severity'], ['updated', 'Sort: recently updated'], ['created', 'Sort: newest'], ['oldest', 'Sort: oldest']], f.sort || 'severity', { onchange: (e) => apply('sort', e.target.value), 'aria-label': 'Sort' }),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: f.open === '1', onchange: (e) => apply('open', e.target.checked ? '1' : ''), }), 'Open only')));
    b.append(h('div', { class: 'card' }, table([{ label: 'ID', render: (r) => h('b', null, projectId ? r.code : `${r.project_key}-${r.code}`) }, { label: 'Title', render: (r) => h('span', null, r.title, r.source === 'auto' ? ' ' : '', r.source === 'auto' ? badge('auto', 'auto') : null) },
      { label: 'Severity', render: (r) => badge(r.severity) }, { label: 'Status', render: (r) => h('span', null, badge(r.status), r.sla_breached ? ' ' : '', r.sla_breached ? badge('SLA', 'Critical') : null) }, { label: 'Assignee', render: (r) => r.assignee_name || '-' }, { label: 'Seen', key: 'occurrences' }, { label: 'Updated', render: (r) => NX.ago(r.updated_at) }],
      data.items, { onRow: (r) => go(`#/defects/${r.id}`), empty: 'No defects match your filters.' })));
    const pages_ = Math.max(1, Math.ceil(data.total / data.limit));
    b.append(h('div', { class: 'pager' }, h('span', { class: 'muted small' }, `${data.total} defects · page ${data.page}/${pages_}`),
      h('button', { class: 'btn sm', disabled: data.page <= 1, onclick: () => go(`${baseHash}?${new URLSearchParams({ ...f, page: data.page - 1 })}`) }, 'Prev'),
      h('button', { class: 'btn sm', disabled: data.page >= pages_, onclick: () => go(`${baseHash}?${new URLSearchParams({ ...f, page: data.page + 1 })}`) }, 'Next')));
  }
  projectTabs.defects = async (b, project, members, route) => {
    if (NX.can('defect.create')) b.append(h('div', { class: 'row', style: 'margin-bottom:12px' }, h('button', { class: 'btn primary right', onclick: () => defectForm(project, members) }, '+ Report defect')));
    await defectList(b, route, project.id, `#/p/${project.key}/defects`);
  };
  async function defectForm(project, members) {
    const cases = (await get(`/api/projects/${project.id}/testcases`)).items;
    const err = NX.errBox(); const F = { title: h('input'), sev: select(NX.meta.severities, 'Medium'), type: select(NX.meta.defectTypes, 'functional'), tc: select([['', '(none)'], ...cases.map((c) => [c.id, `${c.code} ${c.title}`])], ''),
      desc: h('textarea'), steps: h('textarea'), exp: h('textarea'), act: h('textarea'), env: h('input', { placeholder: 'Staging / Chrome 120' }) };
    const devs = members.filter((m) => ['developer', 'qa_engineer'].includes(m.role));
    const assignee = NX.user.role === 'admin' || NX.user.role === 'qa_manager' ? select([['', 'Auto-assign'], ...devs.map((u) => [u.id, u.name])], '') : null;
    const m = modal('Report defect', h('div', null, err, field('Title', F.title), h('div', { class: 'row' }, field('Severity', F.sev), field('Type', F.type), field('Related test case', F.tc)), assignee ? field('Assignee', assignee) : null,
      field('Description', F.desc), field('Steps to reproduce', F.steps), h('div', { class: 'row' }, field('Expected', F.exp), field('Actual', F.act)), field('Environment', F.env),
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
        try { const r = await post(`/api/projects/${project.id}/defects`, { title: F.title.value, severity: F.sev.value, type: F.type.value, test_case_id: F.tc.value || null, description: F.desc.value, steps: F.steps.value, expected: F.exp.value, actual: F.act.value, environment: F.env.value, assignee_id: assignee && assignee.value ? Number(assignee.value) : null }); m.close(); toast(`${r.code} created`); go(`#/defects/${r.id}`); } catch (e) { NX.showErr(err, e); }
      } }, 'Submit'))), { wide: true });
  }

  pages.defects = async function (c, route) {
    const id = route.parts[1];
    if (!id) { c.append(head('Defects', 'Across all projects you can access')); return defectList(c, route, null, '#/defects'); }
    const d = await get(`/api/defects/${id}`); const x = d.defect;
    const flow = h('div', { class: 'flow' }, ['New', 'Assigned', 'In Progress', 'Fixed', 'Retesting', 'Verified', 'Closed'].flatMap((s, i, a) => [h('span', { class: `badge${x.status === s ? ` b-${s.replace(/ /g, '-')}` : ''}`, style: x.status === s ? 'outline:2px solid currentColor' : 'opacity:.7' }, s), i < a.length - 1 ? h('span', { class: 'muted' }, '›') : null]));
    const trBtns = d.transitions.map((t) => h('button', { class: `btn${['Reopened', 'Rejected'].includes(t.to) ? ' danger' : ' primary'}`, onclick: () => transitionForm(x, t, d) }, `→ ${t.to}`));
    const retest = d.canRetest ? h('button', { class: 'btn primary', onclick: async (e) => {
      e.target.disabled = true; e.target.textContent = 'Retesting…';
      try { const r = await post(`/api/defects/${x.id}/retest`); toast(`Automated retest: ${r.outcome}`, r.outcome !== 'verified'); NX.render(); } catch (ex) { toast(ex.message, true); NX.render(); }
    } }, '↻ Automated retest') : null;
    c.append(head(`${x.project_key}-${x.code}`, x.title, h('a', { class: 'btn', href: `#/p/${x.project_key}/defects` }, 'Project defects')));
    c.append(h('div', { class: 'card' }, h('div', { class: 'row' }, badge(x.severity), badge(x.status), x.source === 'auto' ? badge('auto-detected', 'auto') : badge('manual', 'draft'), x.sla_breached ? badge('SLA breached', 'Critical') : null, h('span', { class: 'muted small' }, `Seen ${x.occurrences}× · reopened ${x.reopen_count}×`)), h('div', { style: 'margin:12px 0' }, flow),
      h('div', { class: 'row' }, trBtns, retest, !trBtns.length && !retest ? h('span', { class: 'muted small' }, 'No lifecycle actions available to your role in this status.') : null)));
    c.append(h('div', { class: 'grid g-2-1', style: 'margin-top:16px' },
      h('div', null,
        h('div', { class: 'card' }, h('h2', null, 'Details'), x.description ? h('p', { style: 'white-space:pre-wrap' }, x.description) : null,
          x.steps ? [h('h3', null, 'Steps to reproduce'), h('pre', { class: 'block' }, x.steps)] : null,
          h('div', { class: 'grid g2', style: 'margin-top:10px' }, x.expected ? h('div', null, h('h3', null, 'Expected'), h('pre', { class: 'block' }, x.expected)) : null, x.actual ? h('div', null, h('h3', null, 'Actual'), h('pre', { class: 'block' }, x.actual)) : null),
          x.evidence ? [h('h3', { style: 'margin-top:10px' }, 'Evidence (captured by the execution engine)'), h('pre', { class: 'block' }, x.evidence)] : null,
          x.resolution ? [h('h3', { style: 'margin-top:10px' }, 'Resolution'), h('pre', { class: 'block' }, x.resolution)] : null),
        h('div', { class: 'card' }, h('h2', null, `Comments (${d.comments.length})`), d.comments.map((cm) => h('div', { class: 'comment' }, h('b', null, cm.author_name), h('span', { class: 'small muted' }, ` · ${NX.roleName(cm.author_role)} · ${NX.ago(cm.created_at)}`), h('div', null, cm.body))),
          NX.can('defect.comment') ? (() => { const ta = h('textarea', { placeholder: 'Add a comment…' }); return h('div', null, ta, h('button', { class: 'btn', style: 'margin-top:8px', onclick: async () => { if (!ta.value.trim()) return; try { await post(`/api/defects/${x.id}/comments`, { body: ta.value }); NX.render(); } catch (e) { toast(e.message, true); } } }, 'Comment')); })() : null)),
      h('div', null,
        h('div', { class: 'card' }, h('h2', null, 'Properties'), h('dl', { class: 'kv' }, h('dt', null, 'Assignee'), h('dd', null, x.assignee_name || 'Unassigned'), h('dt', null, 'Reporter'), h('dd', null, x.reporter_name || 'Automation'), h('dt', null, 'Type'), h('dd', null, x.type), h('dt', null, 'Priority'), h('dd', null, x.priority),
          h('dt', null, 'Test case'), h('dd', null, d.testcase ? h('a', { href: `#/p/${x.project_key}/cases?open=${d.testcase.id}` }, d.testcase.code) : '-'), h('dt', null, 'Environment'), h('dd', null, x.environment || '-'), x.external_ref ? h('dt', null, 'Upstream report') : null, x.external_ref ? h('dd', null, x.external_url ? h('a', { href: x.external_url, target: '_blank', rel: 'noopener noreferrer' }, x.external_ref + ' ↗') : `${x.external_ref} (no upstream report recorded)`) : null, h('dt', null, 'Created'), h('dd', null, NX.fmtDate(x.created_at)),
          h('dt', null, 'SLA due'), h('dd', null, NX.fmtDate(x.sla_due)), h('dt', null, 'Resolved'), h('dd', null, NX.fmtDate(x.resolved_at)), h('dt', null, 'Closed'), h('dd', null, NX.fmtDate(x.closed_at))),
          NX.can('defect.edit') ? h('button', { class: 'btn sm', style: 'margin-top:10px', onclick: () => editSeverity(x) }, 'Change severity') : null),
        h('div', { class: 'card' }, h('h2', null, 'History'), h('ul', { class: 'timeline' }, d.history.map((e) => h('li', null, h('div', null, e.action === 'transition' ? h('span', null, badge(e.from_status || '-'), ' → ', badge(e.to_status)) : h('b', null, e.action)), e.note ? h('div', { class: 'small' }, e.note) : null, h('div', { class: 'small muted' }, `${e.actor_name || 'System'} · ${NX.fmtDate(e.created_at)}`))))))));
  };
  function editSeverity(x) {
    const sev = select(NX.meta.severities, x.severity);
    const m = modal('Change severity', h('div', null, field('Severity', sev, 'The SLA deadline is recalculated from the creation time.'), h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => { try { await patch(`/api/defects/${x.id}`, { severity: sev.value }); m.close(); NX.render(); } catch (e) { toast(e.message, true); } } }, 'Save'))));
  }
  function transitionForm(x, t, d) {
    const err = NX.errBox(); const needs = t.needs; const F = {};
    const parts = [err, h('p', { class: 'muted' }, `${x.status} → ${t.to}`)];
    if (needs.includes('assignee_id') || (t.to === 'Reopened')) { F.assignee = select([['', t.to === 'Reopened' ? 'Keep / auto-assign' : 'Choose assignee'], ...d.assignable.map((u) => [u.id, `${u.name} (${NX.roleName(u.role)})`])], ''); parts.push(field('Assignee', F.assignee)); }
    if (needs.includes('resolution')) { F.resolution = h('textarea', { placeholder: 'Describe the fix (root cause, change made)' }); parts.push(field('Resolution', F.resolution)); }
    if (needs.includes('duplicate_of')) { F.dup = h('input', { placeholder: 'e.g. DEF-0004' }); parts.push(field('Duplicate of (defect ID)', F.dup)); }
    F.note = h('textarea', { placeholder: needs.includes('note') ? 'Reason (required)' : 'Note (optional)' }); parts.push(field('Note', F.note));
    const m = modal(`Move ${x.code} to ${t.to}`, h('div', null, parts, h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
      const body = { to: t.to, note: F.note.value }; if (F.assignee && F.assignee.value) body.assignee_id = Number(F.assignee.value); if (F.resolution) body.resolution = F.resolution.value; if (F.dup) body.duplicate_of = F.dup.value;
      try { await post(`/api/defects/${x.id}/transition`, body); m.close(); toast(`Moved to ${t.to}`); NX.render(); } catch (e) { NX.showErr(err, e); }
    } }, 'Apply'))));
  }

  /* ============================== demo lab ============================== */
  pages.lab = async function (c) {
    const [bugs, projects] = await Promise.all([get('/api/demo/bugs'), get('/api/projects')]);
    const shop = projects.items.find((p) => p.base_url === '/demo-sut');
    c.append(head('Demo lab — Nexora Storefront (system under test)', 'A built-in web API with deliberate defects. Run the SHOP automated suite, watch defects get raised, "deploy a fix" here and use automated retest to verify it.',
      shop ? h('a', { class: 'btn primary', href: `#/p/${shop.key}/runs` }, 'Go to SHOP runs') : null,
      h('button', { class: 'btn', onclick: async () => { if (await NX.confirm('Reset all demo defects to the broken state and clear the demo shop data?', 'Reset')) { await post('/api/demo/reset'); toast('Demo target reset'); NX.render(); } } }, 'Reset target')));
    c.append(h('div', { class: 'card' }, table([{ label: 'ID', render: (b) => h('b', null, b.id) }, { label: 'Planted defect', key: 'title' }, { label: 'Area', key: 'area' }, { label: 'State', render: (b) => badge(b.fixed ? 'fixed' : 'present', b.fixed ? 'passed' : 'failed') },
      { label: 'Developer action', render: (b) => h('button', { class: 'btn sm', onclick: async () => { await post('/api/demo/bugs', { id: b.id, fixed: !b.fixed }); NX.render(); } }, b.fixed ? 'Revert fix' : 'Deploy fix') }], bugs.bugs)));
  };

  /* ============================== organisation & admin ============================== */
  pages.org = async function (c) {
    const [o, depts] = await Promise.all([get('/api/org/summary'), get('/api/departments')]);
    c.append(head('Organisation — Nexora Technologies', `${o.headcount} active employees across ${depts.items.length} departments`));
    c.append(h('div', { class: 'grid g2' }, h('div', { class: 'card' }, h('h2', null, 'Headcount by department'), NX.hbars(o.byDepartment.map((d) => ({ label: d.name, value: d.n })))),
      h('div', { class: 'card' }, h('h2', null, 'Platform roles'), NX.hbars(o.byRole.map((r) => ({ label: NX.roleName(r.role), value: r.n })), { color: 'var(--c5)' }),
        h('h3', { style: 'margin-top:14px' }, 'Permission matrix'), permissionMatrix())));
    if (NX.can('user.manage')) c.append(h('div', { class: 'card', style: 'margin-top:16px' }, h('p', { class: 'muted' }, 'Manage individual accounts under Administration → Users.')));
  };
  function permissionMatrix() {
    const m = NX.meta.permissionMatrix; const roles = NX.meta.roles;
    return h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Permission'), roles.map((r) => h('th', { title: NX.roleName(r) }, NX.roleName(r).split(' ').map((w) => w[0]).join(''))))),
      h('tbody', null, Object.entries(m).map(([p, rs]) => h('tr', null, h('td', { class: 'mono' }, p), roles.map((r) => h('td', null, rs.includes(r) ? '✓' : '')))))));
  }

  pages.admin = async function (c, route) {
    const f = { q: route.query.q || '', role: route.query.role || '', department_id: route.query.department_id || '', page: Number(route.query.page) || 1 };
    const [depts, data] = await Promise.all([get('/api/departments'), get(`/api/users?${new URLSearchParams({ ...f, limit: 25 })}`)]);
    const apply = (k, v) => go(`#/admin/users?${new URLSearchParams(Object.fromEntries(Object.entries({ ...f, [k]: v, page: k === 'page' ? v : 1 }).filter(([, x]) => x)))}`);
    c.append(head('User administration', `${data.total} accounts`, h('button', { class: 'btn primary', onclick: () => userForm(depts.items) }, '+ New user')));
    c.append(h('div', { class: 'filters' }, h('input', { type: 'search', value: f.q, placeholder: 'Search name, email or ID', 'aria-label': 'Search users', onkeydown: (e) => { if (e.key === 'Enter') apply('q', e.target.value); } }),
      select([['', 'All roles'], ...NX.meta.roles.map((r) => [r, NX.roleName(r)])], f.role, { onchange: (e) => apply('role', e.target.value), 'aria-label': 'Role' }),
      select([['', 'All departments'], ...depts.items.map((d) => [d.id, d.name])], f.department_id, { onchange: (e) => apply('department_id', e.target.value), 'aria-label': 'Department' })));
    c.append(h('div', { class: 'card' }, table([{ label: 'ID', key: 'emp_code' }, { label: 'Name', key: 'name' }, { label: 'Email', render: (u) => h('span', { class: 'small' }, u.email) }, { label: 'Role', render: (u) => NX.roleName(u.role) }, { label: 'Department', key: 'department' }, { label: 'Status', render: (u) => badge(u.active ? 'active' : 'disabled', u.active ? 'passed' : 'failed') },
      { label: 'Last login', render: (u) => (u.last_login ? NX.ago(u.last_login) : 'never') }], data.items, { onRow: (u) => userEdit(u, depts.items) })));
    const total = Math.max(1, Math.ceil(data.total / data.limit));
    c.append(h('div', { class: 'pager' }, h('span', { class: 'muted small' }, `page ${data.page}/${total}`), h('button', { class: 'btn sm', disabled: data.page <= 1, onclick: () => apply('page', data.page - 1) }, 'Prev'), h('button', { class: 'btn sm', disabled: data.page >= total, onclick: () => apply('page', data.page + 1) }, 'Next')));
  };
  function userForm(depts) {
    const err = NX.errBox(); const F = { name: h('input'), email: h('input', { type: 'email' }), role: select(NX.meta.roles.map((r) => [r, NX.roleName(r)]), 'qa_engineer'), dept: select([['', '(none)'], ...depts.map((d) => [d.id, d.name])], ''), desig: h('input') };
    const m = modal('New user', h('div', null, err, field('Full name', F.name), field('Work email', F.email), h('div', { class: 'row' }, field('Role', F.role), field('Department', F.dept)), field('Designation', F.desig),
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
        try { const r = await post('/api/users', { name: F.name.value, email: F.email.value, role: F.role.value, department_id: F.dept.value || null, designation: F.desig.value }); m.close(); showTemp(r.emp_code, r.temp_password); NX.render(); } catch (e) { NX.showErr(err, e); }
      } }, 'Create'))));
  }
  const showTemp = (code, pw) => modal('Temporary password', h('div', null, h('p', null, `Share this with ${code} through a secure channel. It is shown only once and must be changed at first sign-in.`), h('pre', { class: 'block mono', style: 'user-select:all' }, pw), h('div', { class: 'foot' }, h('button', { class: 'btn primary', onclick: (e) => e.target.closest('.overlay').remove() }, 'Done'))));
  function userEdit(u, depts) {
    const role = select(NX.meta.roles.map((r) => [r, NX.roleName(r)]), u.role); const dept = select([['', '(none)'], ...depts.map((d) => [d.id, d.name])], u.department_id || ''); const name = h('input', { value: u.name }); const desig = h('input', { value: u.designation || '' });
    const act = h('input', { type: 'checkbox', checked: !!u.active });
    const m = modal(`${u.emp_code} · ${u.email}`, h('div', null, field('Name', name), h('div', { class: 'row' }, field('Role', role), field('Department', dept)), field('Designation', desig), h('label', { class: 'chk' }, act, 'Account active'),
      h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: async () => { if (await NX.confirm(`Reset the password for ${u.name}?`, 'Reset')) { const r = await post(`/api/users/${u.id}/reset-password`); m.close(); showTemp(u.emp_code, r.temp_password); } } }, 'Reset password'),
        h('button', { class: 'btn primary', onclick: async () => { try { await patch(`/api/users/${u.id}`, { name: name.value, role: role.value, department_id: dept.value || null, designation: desig.value, active: act.checked }); m.close(); toast('User updated'); NX.render(); } catch (e) { toast(e.message, true); } } }, 'Save'))));
  }

  pages.audit = async function (c, route) {
    const page = Number(route.query.page) || 1; const q = route.query.q || '';
    const d = await get(`/api/audit?${new URLSearchParams({ q, page, limit: 50 })}`);
    c.append(head('Audit log', 'Security- and change-relevant events'));
    c.append(h('div', { class: 'filters' }, h('input', { type: 'search', value: q, placeholder: 'Search actor, entity or detail', onkeydown: (e) => { if (e.key === 'Enter') go(`#/audit?q=${encodeURIComponent(e.target.value)}`); } })));
    c.append(h('div', { class: 'card' }, table([{ label: 'When', render: (r) => NX.fmtDate(r.created_at), class: 'nowrap' }, { label: 'Actor', render: (r) => r.actor_name || '-' }, { label: 'Action', render: (r) => h('span', { class: 'mono' }, r.action) }, { label: 'Entity', render: (r) => `${r.entity || ''} ${r.entity_id || ''}` }, { label: 'Detail', render: (r) => h('span', { class: 'small muted' }, r.detail || '') }, { label: 'IP', render: (r) => h('span', { class: 'small muted' }, r.ip || '') }], d.items)));
    const total = Math.max(1, Math.ceil(d.total / d.limit));
    c.append(h('div', { class: 'pager' }, h('span', { class: 'muted small' }, `page ${d.page}/${total}`), h('button', { class: 'btn sm', disabled: d.page <= 1, onclick: () => go(`#/audit?q=${encodeURIComponent(q)}&page=${page - 1}`) }, 'Prev'), h('button', { class: 'btn sm', disabled: d.page >= total, onclick: () => go(`#/audit?q=${encodeURIComponent(q)}&page=${page + 1}`) }, 'Next')));
  };

  NX.render();
})();
