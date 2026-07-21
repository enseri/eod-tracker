#!/usr/bin/env node
/**
 * Local dev server for the EOD tracker — no Vercel, no cloud, no deps.
 *
 *   npm run dev      →  http://localhost:3000
 *
 * What it gives you for testing everything before you commit/push/deploy:
 *   • Serves the same static HTML/JS Vercel serves, with the same URL rewrites
 *     (/experiences/:id → member app, /dashboard/:id → admin panel).
 *   • Runs the real /api/* serverless handlers in-process against FILE storage
 *     (data/eod-store.json) — no Blob/Redis needed.
 *   • DEV_ADMIN=1 so the admin panel unlocks on localhost (client adds ?admin=1).
 *   • Captures every accountability-chat webhook post to an in-app feed at
 *     /__feed so you can read the exact chat messages (EOD, streak, income
 *     records) without a live Whop webhook. Feed persists to data/dev-feed.json.
 *
 * Simulate members: open /?tier=pro (Pro) or /?tier=basic (Basic). Each browser
 * profile gets its own anon user id, so use a few profiles/incognito windows to
 * populate the admin panel — or seed data with `npm run seed`.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const FEED_FILE = path.join(DATA_DIR, 'dev-feed.json');
const PORT = Number(process.env.PORT || 3000);

// --- Environment: local/open mode + file storage + captured webhook ----------
process.env.DEV_ADMIN = '1';
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
// Ensure open mode (no business lock) and file storage locally.
['BLOB_READ_WRITE_TOKEN', 'BLOB_STORE_ID', 'KV_REST_API_URL', 'KV_REST_API_TOKEN',
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'WHOP_COMPANY_ID',
  'WHOP_API_KEY', 'WHOP_APP_ID'].forEach((k) => { if (!process.env['KEEP_' + k]) delete process.env[k]; });
process.env.WHOP_ACCOUNTABILITY_WEBHOOK_URL = `http://127.0.0.1:${PORT}/__webhook`;

const API_ROUTES = {
  '/api/version': '../api/version.js',
  '/api/config': '../api/config.js',
  '/api/me': '../api/me.js',
  '/api/entries': '../api/entries.js',
  '/api/storage-status': '../api/storage-status.js',
  '/api/admin/users': '../api/admin/users.js',
  '/api/admin/user': '../api/admin/user.js',
  '/api/admin/seed': '../api/admin/seed.js',
  '/api/admin/reset-user': '../api/admin/reset-user.js',
};

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// --- Webhook capture ----------------------------------------------------------
function readFeed() {
  try {
    return JSON.parse(fs.readFileSync(FEED_FILE, 'utf8'));
  } catch {
    return [];
  }
}
function writeFeed(feed) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FEED_FILE, JSON.stringify(feed.slice(-200), null, 2));
}

function shimRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end(buf);
  });
}

function feedPageHtml() {
  const feed = readFeed().slice().reverse();
  const items = feed.map((m) => `
    <div class="msg">
      <div class="who">${escapeHtml(m.username)} <span class="at">${escapeHtml(m.at)}</span></div>
      <pre>${escapeHtml(m.content)}</pre>
    </div>`).join('') || '<p class="empty">No messages captured yet. Submit an EOD with "Publish to channel" on, or verify income in the admin panel.</p>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Accountability chat feed (local)</title>
  <meta http-equiv="refresh" content="4">
  <style>
    body{background:#1a1330;color:#e8e3f5;font:14px/1.5 -apple-system,Segoe UI,Inter,sans-serif;margin:0;padding:24px;}
    h1{font-size:16px;color:#f5c842;} .sub{color:#a99fc7;margin-bottom:18px;font-size:12px;}
    .msg{background:#241a3e;border:1px solid #3a2d5c;border-radius:12px;padding:12px 14px;margin-bottom:12px;max-width:640px;}
    .who{font-weight:700;color:#c9b6ff;font-size:12px;margin-bottom:6px;} .at{color:#7c6f9c;font-weight:400;float:right;}
    pre{white-space:pre-wrap;margin:0;font:13px/1.5 inherit;} .empty{color:#a99fc7;}
    a{color:#f5c842;}
  </style></head><body>
  <h1>💬 Accountability chat — captured locally</h1>
  <div class="sub">Auto-refreshes every 4s · <a href="/__dev">dev home</a> · <a href="/__reset-feed">clear feed</a></div>
  ${items}</body></html>`;
}

function devHomeHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>EOD Tracker — local dev</title>
  <style>
    body{background:#1a1330;color:#e8e3f5;font:15px/1.6 -apple-system,Segoe UI,Inter,sans-serif;margin:0;padding:32px;}
    h1{color:#f5c842;font-size:20px;} a{color:#c9b6ff;} .card{background:#241a3e;border:1px solid #3a2d5c;border-radius:12px;padding:16px 20px;margin:12px 0;max-width:620px;}
    code{background:#120c24;padding:2px 6px;border-radius:5px;color:#f5c842;}
    ul{margin:8px 0;} li{margin:4px 0;}
  </style></head><body>
  <h1>VIP EOD Tracker — local test harness</h1>
  <div class="card"><b>Member app</b><ul>
    <li><a href="/?tier=pro">Open as Pro member</a></li>
    <li><a href="/?tier=basic">Open as Basic member</a></li>
  </ul>Submit an EOD with <i>Publish to channel</i> checked, then watch the feed.</div>
  <div class="card"><b>Admin panel</b><ul>
    <li><a href="/dashboard/global">Open admin dashboard</a> (admin unlocks automatically on localhost)</li>
  </ul>Toggle <i>Income verified</i> on a member to fire the gated income-record broadcasts.</div>
  <div class="card"><b>Accountability chat feed</b><ul>
    <li><a href="/__feed">View captured chat messages</a> — EOD posts, streaks, income records</li>
  </ul></div>
  <div class="card"><b>Tips</b><ul>
    <li>Storage is a local file: <code>data/eod-store.json</code></li>
    <li>Use separate browser profiles / incognito windows to create multiple members</li>
    <li>Restart the server after editing <code>api/</code> or <code>lib/</code> files</li>
    <li>Run unit checks: <code>npm test</code></li>
  </ul></div>
  </body></html>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Server -------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(u.pathname);
  req.query = Object.fromEntries(u.searchParams.entries());

  // Webhook capture (accountability chat)
  if (pathname === '/__webhook') {
    const raw = await readBody(req);
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }
    const feed = readFeed();
    feed.push({
      username: payload.username || 'bot',
      content: payload.content || '',
      at: new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }),
    });
    writeFeed(feed);
    console.log(`\n📨 [chat] ${payload.username}\n${String(payload.content || '').split('\n').map((l) => '   ' + l).join('\n')}`);
    shimRes(res).status(200).json({ ok: true });
    return;
  }
  if (pathname === '/__feed.json') { shimRes(res).status(200).json(readFeed()); return; }
  if (pathname === '/__feed') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(feedPageHtml()); return; }
  if (pathname === '/__reset-feed') { writeFeed([]); res.statusCode = 302; res.setHeader('Location', '/__feed'); res.end(); return; }
  if (pathname === '/__dev') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(devHomeHtml()); return; }

  // API routes
  if (API_ROUTES[pathname]) {
    try {
      const handler = require(API_ROUTES[pathname]);
      shimRes(res);
      await handler(req, res);
    } catch (err) {
      console.error(`API error ${pathname}:`, err);
      if (!res.headersSent) shimRes(res).status(500).json({ error: err.message || 'Dev server error' });
    }
    return;
  }

  // Rewrites (mirror vercel.json)
  if (pathname === '/' || pathname.startsWith('/experiences/')) { serveStatic(res, path.join(ROOT, 'eod-tracker.html')); return; }
  if (pathname === '/admin' || pathname.startsWith('/dashboard/')) { serveStatic(res, path.join(ROOT, 'admin.html')); return; }

  // Static files (restricted to project root)
  const rel = pathname.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) { res.statusCode = 403; res.end('Forbidden'); return; }
  serveStatic(res, filePath);
});

server.listen(PORT, () => {
  console.log(`\n  VIP EOD Tracker — local dev server`);
  console.log(`  ▸ Home / links:  http://localhost:${PORT}/__dev`);
  console.log(`  ▸ Member app:    http://localhost:${PORT}/?tier=pro`);
  console.log(`  ▸ Admin panel:   http://localhost:${PORT}/dashboard/global`);
  console.log(`  ▸ Chat feed:     http://localhost:${PORT}/__feed`);
  console.log(`  ▸ Storage file:  data/eod-store.json  (file mode)\n`);
});
