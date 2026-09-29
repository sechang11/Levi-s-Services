#!/usr/bin/env node
/**
 * tools/export-cards.js — print-ready business-card PDFs.
 *
 *   node tools/export-cards.js           every design
 *   node tools/export-cards.js winter    just one (winter | spring | summer | fall | classic)
 *
 * Starts the site server on a spare port and prints /cards/print.html?design=<key>
 * with headless Edge or Chrome to public/cards/print/levi-builds-card-<key>.pdf:
 * two pages (front, back), each 3.75 × 2.25 in: the 3.5 × 2 in card plus 0.125 in bleed.
 *
 * With Ghostscript on the PATH (gs / gswin64c) it also writes the CMYK versions to
 * print/cmyk/. Without it, CMYK files for the designs just exported are removed
 * rather than left stale, since an old CMYK PDF could carry old contact details.
 *
 * Browser: $CHROME if set, else Edge/Chrome in their usual install locations.
 * Zero dependencies; Node 20+.
 */
'use strict';

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'cards', 'print');
const CMYK = path.join(OUT, 'cmyk');
const DESIGNS = ['winter', 'spring', 'summer', 'fall', 'classic'];

function findBrowser() {
  const candidates = [
    process.env.CHROME,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

function findGhostscript() {
  for (const cmd of ['gs', 'gswin64c', 'gswin32c']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return cmd;
  }
  return null;
}

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once('error', reject);
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

const get = (url) => new Promise((resolve) => {
  http.get(url, (res) => { res.resume(); resolve(res.statusCode); }).on('error', () => resolve(0));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wait until `file` exists and its size has stopped changing (some launchers return early). */
async function settled(file, timeoutMs) {
  const end = Date.now() + timeoutMs;
  let last = -1;
  while (Date.now() < end) {
    const size = fs.existsSync(file) ? fs.statSync(file).size : -1;
    if (size > 0 && size === last) return true;
    last = size;
    await sleep(500);
  }
  return false;
}

async function printPdf(browser, url, out) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'levi-cards-'));
  const tmp = out + '.part';
  fs.rmSync(tmp, { force: true });
  spawnSync(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--no-pdf-header-footer', '--print-to-pdf-no-header', '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=15000', `--user-data-dir=${profile}`, `--print-to-pdf=${tmp}`, url,
  ], { stdio: 'ignore', timeout: 90_000 });
  const ok = await settled(tmp, 60_000);
  await sleep(500);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* the browser may still hold it briefly */ }
  if (!ok) throw new Error(`no PDF was written for ${url}`);
  fs.renameSync(tmp, out);
}

async function main() {
  const want = process.argv.slice(2);
  const bad = want.filter((k) => !DESIGNS.includes(k));
  if (bad.length) throw new Error(`unknown design(s): ${bad.join(', ')} (choose from ${DESIGNS.join(', ')})`);
  const keys = want.length ? want : DESIGNS;

  const browser = findBrowser();
  if (!browser) throw new Error('No Edge/Chrome found. Set CHROME to the browser executable.');

  const port = await freePort();
  const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50 && (await get(`http://127.0.0.1:${port}/healthz`)) !== 200; i++) await sleep(200);

    fs.mkdirSync(OUT, { recursive: true });
    for (const key of keys) {
      const out = path.join(OUT, `levi-builds-card-${key}.pdf`);
      await printPdf(browser, `http://127.0.0.1:${port}/cards/print.html?design=${key}`, out);
      console.log(`  ${path.relative(ROOT, out)}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
    }
  } finally {
    server.kill();
  }

  const gs = findGhostscript();
  for (const key of keys) {
    const src = path.join(OUT, `levi-builds-card-${key}.pdf`);
    const dst = path.join(CMYK, `levi-builds-card-${key}-cmyk.pdf`);
    if (!gs) { fs.rmSync(dst, { force: true }); continue; }
    fs.mkdirSync(CMYK, { recursive: true });
    const r = spawnSync(gs, ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=pdfwrite', '-dPDFSETTINGS=/prepress',
      '-sColorConversionStrategy=CMYK', '-sProcessColorModel=DeviceCMYK', '-dAutoRotatePages=/None', `-sOutputFile=${dst}`, src], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`Ghostscript failed for ${key}: ${r.stderr}`);
    console.log(`  ${path.relative(ROOT, dst)}  ${(fs.statSync(dst).size / 1024).toFixed(0)} KB`);
  }
  if (!gs) console.log('  (no Ghostscript on PATH: skipped CMYK and removed any stale CMYK copies of these designs)');
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
