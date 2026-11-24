'use strict';
/**
 * "Nexora Storefront API" - a self-contained demo System Under Test (SUT).
 * It contains DELIBERATE, individually switchable defects so the platform's black-box
 * execution -> defect identification -> fix -> retest lifecycle can be demonstrated end to end.
 * It is served under /demo-sut and is independent from the platform's own API/auth.
 */
const crypto = require('node:crypto');
const { HttpError } = require('./lib/http');

const BUGS = [
  { id: 'B01', title: 'Login accepts an empty password', area: 'Authentication' },
  { id: 'B02', title: 'Pagination skips the first item of page 2+', area: 'Catalogue' },
  { id: 'B03', title: 'Unknown product id returns 200 instead of 404', area: 'Catalogue' },
  { id: 'B04', title: 'Cart accepts negative quantities', area: 'Cart' },
  { id: 'B05', title: 'SAVE20 code applies only 2% discount', area: 'Discounts' },
  { id: 'B06', title: 'Bulk order (10+ units) total is under-calculated', area: 'Orders' },
  { id: 'B07', title: 'Any user can read another user\'s order (broken access control)', area: 'Orders' },
  { id: 'B08', title: 'Product search is case-sensitive', area: 'Catalogue' },
  { id: 'B09', title: 'Sales report endpoint is very slow (>1.4 s)', area: 'Reports' },
  { id: 'B10', title: 'Registration accepts malformed e-mail addresses', area: 'Authentication' },
  { id: 'F01', title: 'Status endpoint is intermittently unavailable (flaky)', area: 'Reliability' },
];

const PRODUCTS = [
  [1, 'Wireless Mouse', 799, 'Accessories'], [2, 'Mechanical Keyboard', 3499, 'Accessories'],
  [3, 'USB-C Hub', 1999, 'Accessories'], [4, 'Laptop Stand', 1299, 'Accessories'],
  [5, 'Noise-Cancelling Headphones', 7999, 'Audio'], [6, 'Webcam HD', 2499, 'Video'],
  [7, 'Monitor 24"', 10999, 'Displays'], [8, 'Desk Lamp', 899, 'Home Office'],
  [9, 'Phone Charger', 599, 'Accessories'], [10, 'Backpack', 1799, 'Travel'],
  [11, 'Bluetooth Speaker', 2999, 'Audio'], [12, 'Smart Watch', 5999, 'Wearables'],
].map(([id, name, price, category]) => ({ id, name, price, category, stock: 100 }));

const DISCOUNTS = { SAVE10: 10, SAVE20: 20 };

let fixed; let users; let tokens; let carts; let orders; let nextOrder; let flakyCount;
function reset(keepBugs = false) {
  if (!keepBugs || !fixed) fixed = new Set();
  users = new Map([
    ['demo@store.test', { id: 1, email: 'demo@store.test', name: 'Demo Shopper', password: 'Store@123' }],
    ['other@store.test', { id: 2, email: 'other@store.test', name: 'Other Shopper', password: 'Store@123' }],
  ]);
  tokens = new Map(); carts = new Map(); orders = new Map(); nextOrder = 1001; flakyCount = 0;
}
reset();
const bug = (id) => !fixed.has(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round2 = (n) => Math.round(n * 100) / 100;

function authUser(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  const uid = m && tokens.get(m[1]);
  if (!uid) throw new HttpError(401, 'Authentication required');
  return [...users.values()].find((u) => u.id === uid);
}
const cartOf = (u) => { if (!carts.has(u.id)) carts.set(u.id, { items: [], percent: 0, code: null }); return carts.get(u.id); };
function cartView(c) {
  const items = c.items.map((i) => { const p = PRODUCTS.find((x) => x.id === i.productId); return { productId: i.productId, name: p.name, price: p.price, quantity: i.quantity }; });
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return { items, subtotal, discountPercent: c.percent, total: round2(subtotal * (1 - c.percent / 100)) };
}

function register(app) {
  const P = '/demo-sut';

  app.get(`${P}/health`, (req, res) => res.json({ status: 'ok', service: 'nexora-storefront', version: '1.0.0' }));

  app.post(`${P}/auth/register`, (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') throw new HttpError(400, 'email and password are required');
    if (!bug('B10') ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : email.length < 3) throw new HttpError(400, 'Invalid e-mail address');
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    if (users.has(email.toLowerCase())) throw new HttpError(409, 'E-mail already registered');
    const u = { id: users.size + 1, email: email.toLowerCase(), name: email.split('@')[0], password };
    users.set(u.email, u);
    res.json({ id: u.id, email: u.email }, 201);
  });

  app.post(`${P}/auth/login`, (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') throw new HttpError(400, 'email and password are required');
    const u = users.get(email.toLowerCase());
    const emptyOk = bug('B01') && u && password === '';
    if (!u || (u.password !== password && !emptyOk)) throw new HttpError(401, 'Invalid credentials');
    if (!bug('B01') && password === '') throw new HttpError(400, 'Password must not be empty');
    const token = crypto.randomBytes(16).toString('hex');
    tokens.set(token, u.id);
    res.json({ token, user: { id: u.id, email: u.email, name: u.name } });
  });

  app.get(`${P}/products`, (req, res) => {
    const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new HttpError(400, 'limit must be between 1 and 50');
    if (!Number.isInteger(page) || page < 1) throw new HttpError(400, 'page must be >= 1');
    let list = PRODUCTS;
    if (req.query.q) {
      const q = String(req.query.q);
      list = bug('B08') ? list.filter((p) => p.name.includes(q)) : list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    }
    const offset = (page - 1) * limit + (bug('B02') && page > 1 ? 1 : 0);
    res.json({ items: list.slice(offset, offset + limit), total: list.length, page, limit });
  });

  app.get(`${P}/products/:id`, (req, res) => {
    const p = PRODUCTS.find((x) => x.id === Number(req.params.id));
    if (!p) { if (bug('B03')) return res.json({ product: null }); throw new HttpError(404, 'Product not found'); }
    res.json(p);
  });

  app.get(`${P}/cart`, (req, res) => res.json(cartView(cartOf(authUser(req)))));
  app.delete(`${P}/cart`, (req, res) => { carts.delete(authUser(req).id); res.json({ cleared: true }); });
  app.post(`${P}/cart/items`, (req, res) => {
    const u = authUser(req);
    const { productId, quantity } = req.body || {};
    if (!Number.isInteger(productId) || !Number.isInteger(quantity)) throw new HttpError(400, 'productId and quantity must be integers');
    if (!PRODUCTS.some((p) => p.id === productId)) throw new HttpError(404, 'Product not found');
    if (quantity === 0 || (quantity < 0 && !bug('B04'))) throw new HttpError(400, 'quantity must be a positive integer');
    const c = cartOf(u);
    const line = c.items.find((i) => i.productId === productId);
    if (line) line.quantity += quantity; else c.items.push({ productId, quantity });
    res.json({ productId, quantity: (line || c.items[c.items.length - 1]).quantity }, 201);
  });
  app.post(`${P}/cart/discount`, (req, res) => {
    const c = cartOf(authUser(req));
    const code = String((req.body || {}).code || '').toUpperCase();
    if (!(code in DISCOUNTS)) throw new HttpError(400, 'Invalid discount code');
    c.percent = code === 'SAVE20' && bug('B05') ? 2 : DISCOUNTS[code]; c.code = code;
    res.json({ code, percent: c.percent, total: cartView(c).total });
  });

  app.post(`${P}/orders`, (req, res) => {
    const u = authUser(req);
    const c = cartOf(u);
    if (!c.items.length) throw new HttpError(400, 'Cart is empty');
    const view = cartView(c);
    let total = view.total;
    if (bug('B06')) {
      const bulk = c.items.find((i) => i.quantity >= 10);
      if (bulk) total = round2(total - PRODUCTS.find((p) => p.id === bulk.productId).price);
    }
    const order = { id: nextOrder++, userId: u.id, status: 'PLACED', items: view.items, total };
    orders.set(order.id, order);
    carts.delete(u.id);
    res.json({ id: order.id, status: order.status, total: order.total, items: order.items }, 201);
  });
  app.get(`${P}/orders/:id`, (req, res) => {
    const u = authUser(req);
    const o = orders.get(Number(req.params.id));
    if (!o) throw new HttpError(404, 'Order not found');
    if (o.userId !== u.id && !bug('B07')) throw new HttpError(403, 'Forbidden');
    res.json({ id: o.id, status: o.status, total: o.total, items: o.items });
  });

  app.get(`${P}/reports/sales`, async (req, res) => {
    authUser(req);
    if (bug('B09')) await sleep(1400);
    res.json({ orders: orders.size, revenue: round2([...orders.values()].reduce((s, o) => s + o.total, 0)) });
  });

  app.get(`${P}/status/flaky`, (req, res) => {
    flakyCount++;
    if (bug('F01') && flakyCount % 2 === 1) throw new HttpError(503, 'Service temporarily unavailable');
    res.json({ status: 'up' });
  });

  /* "developer deploys a fix" controls used by the Demo Lab page and self-tests */
  app.get(`${P}/_admin/bugs`, (req, res) => res.json({ bugs: BUGS.map((b) => ({ ...b, fixed: fixed.has(b.id) })) }));
}

module.exports = { register, BUGS, setFixed: (id, v) => { if (!BUGS.some((b) => b.id === id)) return false; if (v) fixed.add(id); else fixed.delete(id); return true; }, reset, isFixed: (id) => fixed.has(id) };
