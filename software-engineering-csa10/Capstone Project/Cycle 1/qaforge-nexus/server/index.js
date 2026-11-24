'use strict';
/**
 * QAForge Nexus - server entry point.
 *   PORT (default 4000), HOST (default 0.0.0.0), QAF_DATA_DIR, QAF_SECRET
 */
const path = require('node:path');
const { createApp, HttpError } = require('./lib/http');
const { initSchema, get } = require('./db');
const { seed } = require('./seed');
const demo = require('./demo-sut');

initSchema();
if (get('SELECT COUNT(*) AS n FROM users').n === 0) {
  console.log('[nexus] empty database - seeding demo organisation (150 employees)...');
  seed({ history: true });
}

const app = createApp();
app.static(path.join(__dirname, '..', 'public'));

// coarse per-IP rate limit for the platform API (the demo target is exempt so test runs are not throttled)
const buckets = new Map();
app.use((req) => {
  if (!req.path.startsWith('/api/')) return;
  const t = Date.now();
  const b = buckets.get(req.ip) || { start: t, n: 0 };
  if (t - b.start > 60e3) { b.start = t; b.n = 0; }
  b.n++;
  buckets.set(req.ip, b);
  if (b.n > 1200) throw new HttpError(429, 'Rate limit exceeded');
  if (buckets.size > 10000) buckets.clear();
});

demo.register(app);
require('./routes/core')(app);
require('./routes/projects')(app);
require('./routes/testing')(app);
require('./routes/defects')(app);
require('./routes/reports')(app);

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`[nexus] QAForge Nexus listening on http://localhost:${PORT}`);
});
server.requestTimeout = 120000;
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

module.exports = { app, server };
