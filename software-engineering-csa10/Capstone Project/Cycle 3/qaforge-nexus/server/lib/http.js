'use strict';
/**
 * Minimal zero-dependency HTTP framework: router, JSON body parsing,
 * static file serving, security headers and error handling.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

const MAX_BODY = 2 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'Request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function createApp() {
  const routes = [];
  const middleware = [];
  let staticDir = null;

  const add = (method, p, handlers) => {
    const keys = [];
    const src = p.replace(/\/:([A-Za-z_]\w*)/g, (_, k) => { keys.push(k); return '/([^/]+)'; });
    routes.push({ method, re: new RegExp('^' + src + '/?$'), keys, handlers });
  };

  const app = { use: (fn) => middleware.push(fn), static: (dir) => { staticDir = dir; } };
  for (const m of ['get', 'post', 'patch', 'put', 'delete']) {
    app[m] = (p, ...h) => add(m.toUpperCase(), p, h.flat());
  }

  function decorate(req, res) {
    res.json = (obj, status = 200) => {
      const body = JSON.stringify(obj);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(body);
    };
    res.send = (body, type = 'text/plain; charset=utf-8', status = 200, extra = {}) => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
      res.end(body);
    };
  }

  function serveStatic(req, res, pathname) {
    if (!staticDir || (req.method !== 'GET' && req.method !== 'HEAD')) return false;
    let rel = pathname === '/' ? '/index.html' : pathname;
    let file = path.normalize(path.join(staticDir, rel));
    if (!file.startsWith(staticDir)) throw new HttpError(403, 'Forbidden');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (path.extname(rel)) return false;           // missing asset -> 404
      file = path.join(staticDir, 'index.html');     // SPA fallback
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
    return true;
  }

  app.handle = async (req, res) => {
    decorate(req, res);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;
      req.path = pathname;
      req.query = Object.fromEntries(url.searchParams);
      req.ip = req.socket.remoteAddress;
      req.params = {};

      let matched = null; let pathMatched = false;
      for (const r of routes) {
        const m = r.re.exec(pathname);
        if (!m) continue;
        pathMatched = true;
        if (r.method !== req.method) continue;
        matched = r;
        r.keys.forEach((k, i) => {
          try { req.params[k] = decodeURIComponent(m[i + 1]); } catch { throw new HttpError(400, 'Bad URL encoding'); }
        });
        break;
      }

      if (!matched) {
        if (pathMatched) throw new HttpError(405, 'Method not allowed');
        if (!pathname.startsWith('/api/') && !pathname.startsWith('/demo-sut/') && serveStatic(req, res, pathname)) return;
        throw new HttpError(404, 'Not found');
      }

      req.body = {};
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
        const raw = await readBody(req);
        if (raw && /json/i.test(req.headers['content-type'] || '')) {
          try { req.body = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid JSON body'); }
        } else if (raw) { req.rawBody = raw; }
      }

      for (const mw of middleware) { await mw(req, res); if (res.writableEnded) return; }
      for (const h of matched.handlers) { await h(req, res); if (res.writableEnded) return; }
      if (!res.writableEnded) res.json({ ok: true });
    } catch (e) {
      if (res.headersSent) { try { res.end(); } catch (_) { /* ignore */ } return; }
      if (e instanceof HttpError) return res.json({ error: e.message, ...(e.extra || {}) }, e.status);
      console.error('[error]', req.method, req.url, e);
      res.json({ error: 'Internal server error' }, 500);
    }
  };

  app.listen = (port, host, cb) => http.createServer(app.handle).listen(port, host, cb);
  return app;
}

module.exports = { createApp, HttpError };
