'use strict';
/**
 * Levi Builds — tiny zero-dependency production server (Railway-ready).
 *
 *   - Serves ./public only (server files are never exposed)
 *   - Brotli / gzip compression with an in-memory cache
 *   - ETag revalidation (cheap 304s) + security headers / CSP
 *   - GET  /healthz     → "ok" (Railway health check)
 *   - POST /api/quote   → forwards quote requests to QUOTE_WEBHOOK_URL
 *                         (Discord, Slack, ntfy.sh or any webhook). When it's
 *                         not set, responds 503 and the page falls back to email.
 *
 * Railway injects PORT; locally it defaults to 5173.
 */
const http = require('node:http');
const fsp = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 5173;
const WEBHOOK_URL = (process.env.QUOTE_WEBHOOK_URL || '').trim();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.txt', '.xml']);
const ALWAYS_REVALIDATE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest']);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': CSP,
};

/* ------------------------------------------------------------------ files */
const cache = new Map(); // abs path -> { key, type, ext, raw, br, gz, etag }

async function getFile(abs) {
  let st;
  try { st = await fsp.stat(abs); } catch { return null; }
  if (!st.isFile()) return null;
  const key = `${st.size.toString(16)}-${Math.round(st.mtimeMs).toString(16)}`;
  const hit = cache.get(abs);
  if (hit && hit.key === key) return hit;

  const raw = await fsp.readFile(abs);
  const ext = path.extname(abs).toLowerCase();
  const entry = { key, ext, type: TYPES[ext] || 'application/octet-stream', raw, br: null, gz: null, etag: `W/"${key}"` };
  if (COMPRESSIBLE.has(ext) && raw.length > 600) {
    entry.br = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 10 } });
    entry.gz = zlib.gzipSync(raw, { level: 9 });
  }
  cache.set(abs, entry);
  return entry;
}

function resolvePath(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return null; }
  if (p.includes('\0')) return null;
  if (p.endsWith('/')) p += 'index.html';
  if (p.split('/').some((seg) => seg.startsWith('.'))) return null; // no dotfiles / traversal
  const abs = path.resolve(ROOT, '.' + p);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  return abs;
}

const stripWeak = (t) => t.trim().replace(/^W\//, '');
function isFresh(req, etag) {
  const inm = req.headers['if-none-match'];
  if (!inm) return false;
  return inm === '*' || inm.split(',').some((t) => stripWeak(t) === stripWeak(etag));
}

function sendFile(req, res, file, status = 200) {
  const headers = {
    ...BASE_HEADERS,
    'Content-Type': file.type,
    'Cache-Control': ALWAYS_REVALIDATE.has(file.ext) ? 'no-cache' : 'public, max-age=3600',
    ETag: file.etag,
  };
  if (file.gz) headers.Vary = 'Accept-Encoding';
  if (status === 200 && isFresh(req, file.etag)) {
    res.writeHead(304, headers);
    return res.end();
  }
  let body = file.raw;
  const ae = String(req.headers['accept-encoding'] || '');
  if (file.br && /\bbr\b/.test(ae)) { body = file.br; headers['Content-Encoding'] = 'br'; }
  else if (file.gz && /\bgzip\b/.test(ae)) { body = file.gz; headers['Content-Encoding'] = 'gzip'; }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

async function sendNotFound(req, res) {
  const page = await getFile(path.join(ROOT, '404.html'));
  if (page) return sendFile(req, res, page, 404);
  sendText(res, 404, 'Not found');
}

function sendText(res, status, text, extra = {}) {
  const body = Buffer.from(text);
  res.writeHead(status, { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': body.length, ...extra });
  res.end(body);
}

function sendJson(res, status, obj, extra = {}) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': body.length, ...extra });
  res.end(body);
}

/* ------------------------------------------------------------ /api/quote */
const RATE = { windowMs: 10 * 60 * 1000, max: 5 };
const hits = new Map(); // ip -> timestamps
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) {
    const live = times.filter((t) => now - t < RATE.windowMs);
    if (live.length) hits.set(ip, live); else hits.delete(ip);
  }
}, 60 * 1000).unref();

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket.remoteAddress || 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  const times = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  const limited = times.length >= RATE.max;
  if (!limited) times.push(now);
  hits.set(ip, times);
  return limited;
}

function clean(value, max, multiline = false) {
  let s = typeof value === 'string' ? value : value == null ? '' : String(value);
  s = s.replace(/\r\n?/g, '\n');
  s = s.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, ' ').trim();
  if (multiline) s = s.replace(/\n{3,}/g, '\n\n');
  return s.slice(0, max);
}

function readBody(req, limit, hardCap = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let over = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > hardCap) { req.destroy(); return; } // abusive upload: just drop it
      if (size > limit) {
        if (!over) { over = true; reject(Object.assign(new Error('payload too large'), { status: 413 })); }
        return; // discard the rest so we can still answer with a clean 413
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!over) resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

function webhookHost() {
  try { return new URL(WEBHOOK_URL).hostname.toLowerCase(); } catch { return ''; }
}

async function deliver(q) {
  const text = [
    'New quote request — Levi Builds',
    `Name: ${q.name}`,
    q.phone && `Phone: ${q.phone}`,
    q.email && `Email: ${q.email}`,
    q.service && `Service: ${q.service}`,
    q.message && `\n${q.message}`,
  ].filter(Boolean).join('\n');

  const host = webhookHost();
  let headers;
  let body;
  if (/(^|\.)discord(app)?\.com$/.test(host)) {
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({ content: text.slice(0, 1900), allowed_mentions: { parse: [] } });
  } else if (host === 'hooks.slack.com') {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({ text: esc(text) });
  } else {
    // Plain text works with ntfy.sh (push notifications to a phone) and most relays.
    headers = { 'Content-Type': 'text/plain; charset=utf-8', Title: 'New quote request' };
    body = text;
  }
  const r = await fetch(WEBHOOK_URL, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`webhook responded ${r.status}`);
}

async function handleQuote(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' }, { Allow: 'POST' });
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
    return sendJson(res, 415, { ok: false, reason: 'content-type' });
  }

  let data;
  try {
    data = JSON.parse(await readBody(req, 16 * 1024));
  } catch (err) {
    if (err.status === 413) return sendJson(res, 413, { ok: false, reason: 'too-large' }, { Connection: 'close' });
    return sendJson(res, 400, { ok: false, reason: 'bad-json' });
  }
  if (!data || typeof data !== 'object') return sendJson(res, 400, { ok: false, reason: 'bad-json' });

  // Honeypot: real people never see or fill this field.
  if (clean(data.company, 200)) return sendJson(res, 200, { ok: true });

  const q = {
    name: clean(data.name, 100),
    phone: clean(data.phone, 40),
    email: clean(data.email, 120),
    service: clean(data.service, 80),
    message: clean(data.message, 2000, true),
  };
  const fields = [];
  if (!q.name) fields.push('name');
  if (!q.phone && !q.email) fields.push('contact');
  if (q.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.email)) fields.push('email');
  if (fields.length) return sendJson(res, 400, { ok: false, reason: 'invalid', fields });

  if (rateLimited(clientIp(req))) return sendJson(res, 429, { ok: false, reason: 'rate-limited' }, { 'Retry-After': '600' });
  if (!WEBHOOK_URL) return sendJson(res, 503, { ok: false, reason: 'not-configured' });

  try {
    await deliver(q);
    console.log(`[quote] delivered (${q.service || 'no service selected'})`); // no personal data in logs
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('[quote] delivery failed:', err.message);
    return sendJson(res, 502, { ok: false, reason: 'delivery-failed' });
  }
}

/* ---------------------------------------------------------------- server */
const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname === '/healthz') return sendText(res, 200, 'ok');
    if (pathname === '/api/quote') return await handleQuote(req, res);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendText(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    }
    const abs = resolvePath(pathname);
    const file = abs ? await getFile(abs) : null;
    if (!file) return await sendNotFound(req, res);
    return sendFile(req, res, file);
  } catch (err) {
    console.error('[server] error:', err);
    if (!res.headersSent) sendText(res, 500, 'Internal Server Error');
    else res.destroy();
  }
});

// Outlive proxy idle timeouts so keep-alive connections don't 502.
server.keepAliveTimeout = 65 * 1000;
server.headersTimeout = 66 * 1000;

server.listen(PORT, () => {
  console.log(`Levi Builds listening on :${PORT} — quote webhook ${WEBHOOK_URL ? 'configured' : 'not set (form falls back to email)'}`);
});

function shutdown(signal) {
  console.log(`${signal} received — shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
