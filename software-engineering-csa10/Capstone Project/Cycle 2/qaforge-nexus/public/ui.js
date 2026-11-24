'use strict';
/* QAForge Nexus - UI helpers: DOM builder, API client, modal, toast, badges, SVG charts. No dependencies. */
(function () {
  const NX = (window.NX = { token: null, user: null, meta: null });
  try { NX.token = sessionStorage.getItem('nx_token'); } catch (_) { /* storage unavailable */ }

  /* ---------- DOM builder (text is always inserted as text nodes -> XSS safe) ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    add(el, kids);
    return el;
  }
  function add(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    }
  }
  NX.h = h;
  NX.svg = (tag, attrs, ...kids) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
    add(el, kids);
    return el;
  };
  NX.clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---------- formatting ---------- */
  NX.fmtDate = (s) => (s ? new Date(s).toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');
  NX.fmtDay = (s) => (s ? new Date(s).toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' }) : '-');
  NX.ago = (s) => {
    if (!s) return '-';
    const m = Math.round((Date.now() - Date.parse(s)) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
    const hr = Math.round(m / 60); if (hr < 48) return `${hr}h ago`;
    return `${Math.round(hr / 24)}d ago`;
  };
  NX.dur = (ms) => (ms == null ? '-' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
  NX.pct = (v) => (v == null ? '-' : `${v}%`);
  NX.badge = (text, kind) => h('span', { class: `badge b-${String(kind || text).replace(/\s+/g, '-')}` }, text);
  NX.roleName = (r) => ({ admin: 'Administrator', qa_manager: 'QA Manager', qa_engineer: 'QA Engineer', developer: 'Developer', product_owner: 'Product Owner', viewer: 'Viewer' }[r] || r);
  NX.can = (p) => !!(NX.meta && NX.meta.permissions.includes(p));

  /* ---------- toast & modal ---------- */
  NX.toast = (msg, bad) => {
    const t = h('div', { class: `toast${bad ? ' bad' : ''}`, role: 'status' }, msg);
    document.getElementById('toasts').append(t);
    setTimeout(() => t.remove(), bad ? 6000 : 3500);
  };
  NX.modal = (title, body, { wide = false, onClose } = {}) => {
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc); if (onClose) onClose(); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    const ov = h('div', { class: 'overlay', onclick: (e) => { if (e.target === ov) close(); } },
      h('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'row' }, h('h2', null, title), h('button', { class: 'btn ghost sm right', 'aria-label': 'Close', onclick: close }, '✕')), body));
    document.addEventListener('keydown', esc);
    document.body.append(ov);
    const first = ov.querySelector('input,select,textarea'); if (first) first.focus();
    return { close, el: ov };
  };
  NX.confirm = (msg, okLabel = 'Confirm') => new Promise((resolve) => {
    let done = false;
    const m = NX.modal('Please confirm', h('div', null, h('p', null, msg),
      h('div', { class: 'foot' },
        h('button', { class: 'btn', onclick: () => { done = true; m.close(); resolve(false); } }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: () => { done = true; m.close(); resolve(true); } }, okLabel))), { onClose: () => { if (!done) resolve(false); } });
  });

  /* ---------- API ---------- */
  NX.api = async (method, url, body, opts = {}) => {
    const res = await fetch(url, {
      method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(NX.token ? { Authorization: `Bearer ${NX.token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (opts.raw) return res;
    let data = null; try { data = await res.json(); } catch (_) { /* empty */ }
    if (!res.ok) {
      if (res.status === 401 && NX.token && !opts.noAuthRedirect) { NX.logout(); }
      const e = new Error((data && data.error) || `Request failed (${res.status})`); e.status = res.status; e.data = data; throw e;
    }
    return data;
  };
  NX.get = (u) => NX.api('GET', u); NX.post = (u, b) => NX.api('POST', u, b === undefined ? {} : b);
  NX.patch = (u, b) => NX.api('PATCH', u, b); NX.del = (u) => NX.api('DELETE', u, {});
  NX.download = async (url, name) => {
    const res = await NX.api('GET', url, undefined, { raw: true });
    if (!res.ok) return NX.toast('Download failed', true);
    const a = h('a', { href: URL.createObjectURL(await res.blob()), download: name }); document.body.append(a); a.click(); a.remove();
  };
  NX.setToken = (t) => { NX.token = t; try { t ? sessionStorage.setItem('nx_token', t) : sessionStorage.removeItem('nx_token'); } catch (_) { /* ignore */ } };
  NX.logout = () => { NX.setToken(null); NX.user = null; location.hash = '#/login'; if (NX.render) NX.render(); };

  /* ---------- form helpers ---------- */
  NX.field = (label, input, hint) => h('div', { class: 'field' }, h('label', { class: 'f' }, label), input, hint ? h('div', { class: 'small muted' }, hint) : null);
  NX.select = (opts, value, attrs) => h('select', attrs, opts.map((o) => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return h('option', { value: v, selected: String(v) === String(value) }, l);
  }));
  NX.errBox = () => h('div', { class: 'alert bad', hidden: true, role: 'alert' });
  NX.showErr = (box, e) => { box.textContent = e.message || String(e); box.hidden = false; box.scrollIntoView({ block: 'nearest' }); };

  NX.table = (cols, rows, { onRow, empty = 'Nothing to show yet.' } = {}) => {
    if (!rows.length) return h('div', { class: 'empty' }, empty);
    return h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, cols.map((c) => h('th', null, c.label)))),
      h('tbody', null, rows.map((r) => h('tr', { class: onRow ? 'click' : null, onclick: onRow ? (e) => { if (!e.target.closest('a,button,input,select')) onRow(r); } : null },
        cols.map((c) => h('td', { class: c.class }, c.render ? c.render(r) : r[c.key] ?? '-')))))));
  };

  /* ---------- SVG charts ---------- */
  const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
  NX.colors = COLORS;
  NX.legend = (items) => h('div', { class: 'legend' }, items.map(([c, l]) => h('span', null, h('i', { style: `background:${c}` }), l)));

  NX.lineChart = (labels, series, { height = 190, max, suffix = '' } = {}) => {
    const W = 600; const H = height; const P = { l: 36, r: 10, t: 10, b: 24 };
    const svg = NX.svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Line chart' });
    const top = max != null ? max : Math.max(1, ...series.flatMap((s) => s.data.filter((v) => v != null)));
    const x = (i) => P.l + (labels.length <= 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (labels.length - 1));
    const y = (v) => P.t + (H - P.t - P.b) * (1 - v / top);
    for (let i = 0; i <= 4; i++) {
      const v = (top * i) / 4; const yy = y(v);
      svg.append(NX.svg('line', { x1: P.l, x2: W - P.r, y1: yy, y2: yy, stroke: 'var(--border)' }), NX.svg('text', { x: P.l - 6, y: yy + 4, 'text-anchor': 'end' }, `${Math.round(v)}${suffix}`));
    }
    const step = Math.ceil(labels.length / 8);
    labels.forEach((l, i) => { if (i % step === 0 || i === labels.length - 1) svg.append(NX.svg('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, l)); });
    series.forEach((s, si) => {
      const pts = s.data.map((v, i) => (v == null ? null : [x(i), y(v)]));
      const segs = []; let cur = [];
      pts.forEach((p) => { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } }); if (cur.length) segs.push(cur);
      const color = s.color || COLORS[si];
      segs.forEach((sg) => svg.append(NX.svg('path', { d: sg.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linejoin': 'round' })));
      pts.forEach((p, i) => { if (p) svg.append(NX.svg('circle', { cx: p[0], cy: p[1], r: 3, fill: color }, NX.svg('title', null, `${labels[i]}: ${s.data[i]}${suffix} (${s.name})`))); });
    });
    return svg;
  };

  NX.groupedBars = (labels, series, { height = 190 } = {}) => {
    const W = 600; const H = height; const P = { l: 30, r: 10, t: 10, b: 24 };
    const svg = NX.svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Bar chart' });
    const top = Math.max(1, ...series.flatMap((s) => s.data));
    const gw = (W - P.l - P.r) / labels.length; const bw = Math.min(22, (gw * 0.8) / series.length);
    const y = (v) => P.t + (H - P.t - P.b) * (1 - v / top);
    for (let i = 0; i <= 4; i++) { const v = (top * i) / 4; svg.append(NX.svg('line', { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), stroke: 'var(--border)' }), NX.svg('text', { x: P.l - 5, y: y(v) + 4, 'text-anchor': 'end' }, Math.round(v))); }
    labels.forEach((l, i) => {
      const gx = P.l + i * gw + (gw - bw * series.length) / 2;
      series.forEach((s, si) => {
        const v = s.data[i]; const yy = y(v);
        svg.append(NX.svg('rect', { x: gx + si * bw, y: yy, width: bw - 2, height: Math.max(H - P.b - yy, 0), rx: 3, fill: s.color || COLORS[si] }, NX.svg('title', null, `${l} - ${s.name}: ${v}`)));
      });
      svg.append(NX.svg('text', { x: P.l + i * gw + gw / 2, y: H - 6, 'text-anchor': 'middle' }, l));
    });
    return svg;
  };

  NX.hbars = (rows, { color } = {}) => {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return h('div', null, rows.map((r, i) => h('div', { style: 'margin-bottom:8px' },
      h('div', { class: 'row small' }, h('span', null, r.label), h('b', { class: 'right' }, r.value)),
      h('div', { class: 'bar', role: 'img', 'aria-label': `${r.label}: ${r.value}` }, h('span', { style: `width:${(r.value * 100) / max}%;background:${r.color || color || COLORS[i % COLORS.length]}` })))));
  };

  NX.stackBar = (parts) => {
    const total = parts.reduce((s, p) => s + p.value, 0) || 1;
    return h('div', { class: 'bar', role: 'img', 'aria-label': parts.map((p) => `${p.label} ${p.value}`).join(', ') },
      parts.filter((p) => p.value).map((p) => h('span', { style: `width:${(p.value * 100) / total}%;background:${p.color}`, title: `${p.label}: ${p.value}` })));
  };
})();
