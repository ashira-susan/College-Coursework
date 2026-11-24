'use strict';
/**
 * QAForge Nexus - server entry point.
 *   DATABASE_URL (postgres://user:pass@host:5432/db), PORT (default 4000), HOST (default 0.0.0.0), QAF_DATA_DIR, QAF_SECRET
 */
const path = require('node:path');
const { createApp, HttpError } = require('./lib/http');
const { initSchema, get, close } = require('./db');
const { seed } = require('./seed');
const demo = require('./demo-sut');

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
  if (b.n > Number(process.env.QAF_RATE_LIMIT || 1200)) throw new HttpError(429, 'Rate limit exceeded');
  if (buckets.size > 10000) buckets.clear();
});

demo.register(app);
require('./routes/core')(app);
require('./routes/projects')(app);
require('./routes/testing')(app);
require('./routes/defects')(app);
require('./routes/reports')(app);
require('./routes/intel')(app);

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  await initSchema();
  if ((await get('SELECT COUNT(*) AS n FROM users')).n === 0) {
    console.log('[nexus] empty database - seeding 150 employees and the Defects4J dataset (168 real bugs)...');
    await seed({ history: true });
  }
  const server = app.listen(PORT, HOST, () => console.log(`[nexus] QAForge Nexus listening on http://localhost:${PORT}  (PostgreSQL)`));
  server.requestTimeout = 120000;
  const stop = () => server.close(async () => { await close(); process.exit(0); });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  return server;
}
main().catch((e) => { console.error('[nexus] startup failed:', e.message); process.exit(1); });

module.exports = { app };
