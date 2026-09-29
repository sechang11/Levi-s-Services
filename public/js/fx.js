/* fx.js — seasonal ambient particles on one fixed <canvas> behind the content.
   winter: snow · spring: petals · summer: fireflies · fall: leaves.
   Colors come from the season's --fx-1…4 tokens. Off for reduced motion,
   paused while the tab is hidden, density scaled to the screen. */
import { reduceMotion, onMotionChange } from './motion.js';
const TAU = Math.PI * 2;
const DENSITY = { winter: 110, spring: 34, summer: 30, fall: 30 }; // per 1440×900 screen
const CAP = { winter: 160, spring: 52, summer: 44, fall: 44 };

let canvas = null;
let ctx = null;
let W = 0, H = 0, dpr = 1;
let season = null;
let parts = [];
let colors = [];
let sprites = [];
let raf = 0;
let last = 0;

/* Real leaf / petal / snow-crystal sprites (rendered on the GPU box — see
   tools/assets). One small sheet per season, loaded on demand; until it
   arrives the vector shapes below are drawn instead. */
const SHEETS = {
  fall: { src: 'assets/seasons/fall-sprites.webp', count: 8, cell: 112 },
  spring: { src: 'assets/seasons/spring-sprites.webp', count: 7, cell: 80 },
  winter: { src: 'assets/seasons/winter-sprites.webp', count: 4, cell: 72 },
};
const sheets = {};
function sheetFor(key) {
  const cfg = SHEETS[key];
  if (!cfg) return null;
  if (!sheets[key]) {
    const img = new Image();
    img.decoding = 'async';
    const s = { img, ready: false, ...cfg };
    img.onload = () => { s.ready = true; };
    img.src = cfg.src;
    sheets[key] = s;
  }
  return sheets[key];
}

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const rgba = (hex, a) => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})` : hex;
};

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  colors = ['--fx-1', '--fx-2', '--fx-3', '--fx-4'].map((v) => cs.getPropertyValue(v).trim()).filter(Boolean);
  if (!colors.length) colors = ['#ffffff'];
  sprites = colors.map((c) => { // soft glow sprites for fireflies
    const s = document.createElement('canvas');
    s.width = s.height = 48;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    grd.addColorStop(0, rgba(c, 1));
    grd.addColorStop(0.22, rgba(c, 0.9));
    grd.addColorStop(1, rgba(c, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, 48, 48);
    return s;
  });
}

function spawn(p = {}, initial = false) {
  p.x = rand(0, W);
  p.y = initial ? rand(-H * 0.1, H) : rand(-60, -12);
  p.c = pick(colors);
  p.t = rand(0, 100);
  if (season === 'winter') {
    const depth = Math.random();
    p.r = 0.7 + depth * 2.6;
    p.vy = 16 + depth * 44;
    p.vx = 6 + depth * 6;
    p.sway = 5 + depth * 16;
    p.freq = rand(0.12, 0.35);
    p.a = 0.3 + depth * 0.6;
    p.crystal = depth > 0.84; // the nearest flakes show real ice-crystal detail
    if (p.crystal) {
      p.si = (Math.random() * SHEETS.winter.count) | 0;
      p.rot = rand(0, TAU); p.vr = rand(-0.6, 0.6); p.flip = 0; p.vf = 0;
    }
  } else if (season === 'spring') {
    p.r = rand(4, 8.5); p.vy = rand(16, 36); p.vx = rand(10, 26);
    p.sway = rand(10, 26); p.freq = rand(0.15, 0.4);
    p.rot = rand(0, TAU); p.vr = rand(-1.4, 1.4); p.flip = rand(0, TAU); p.vf = rand(1.2, 2.6);
    p.a = rand(0.55, 0.9);
    p.si = (Math.random() * SHEETS.spring.count) | 0;
  } else if (season === 'summer') {
    p.r = rand(5, 11);
    p.y = initial ? rand(H * 0.12, H) : H + rand(10, 40);
    p.vy = -rand(4, 13); p.vx = rand(-5, 5);
    p.sway = rand(12, 34); p.freq = rand(0.06, 0.18);
    p.tw = rand(0.35, 0.9); p.a = rand(0.55, 1);
    p.sprite = pick(sprites);
  } else { // fall
    p.r = rand(6.5, 12); p.vy = rand(22, 50); p.vx = rand(-6, 14);
    p.sway = rand(18, 50); p.freq = rand(0.12, 0.3);
    p.rot = rand(0, TAU); p.vr = rand(-1.8, 1.8); p.flip = rand(0, TAU); p.vf = rand(1, 2.4);
    p.a = rand(0.6, 0.92);
    p.si = (Math.random() * SHEETS.fall.count) | 0;
  }
  p.x0 = p.x;
  return p;
}

function update(p, dt) {
  p.t += dt;
  p.y += p.vy * dt;
  p.x0 += p.vx * dt;
  p.x = p.x0 + Math.sin(p.t * p.freq * TAU) * p.sway;
  if (p.rot !== undefined) { p.rot += p.vr * dt; p.flip += p.vf * dt; }
  if (season === 'summer' ? p.y < -40 : p.y > H + 40) spawn(p);
  if (p.x < -80) p.x0 += W + 160;
  else if (p.x > W + 80) p.x0 -= W + 160;
}

function drawSprite(sh, p, size, flipX) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  const f = 0.3 + 0.7 * Math.abs(Math.cos(p.flip)); // tumbling: squash along one axis
  if (flipX) ctx.scale(f, 1); else ctx.scale(1, f);
  ctx.drawImage(sh.img, p.si * sh.cell, 0, sh.cell, sh.cell, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function draw(p) {
  const sh = sheets[season];
  if (season === 'winter') {
    if (p.crystal && sh?.ready) {
      ctx.globalAlpha = p.a * 0.95;
      drawSprite(sh, p, p.r * 5.4, false);
      return;
    }
    ctx.globalAlpha = p.a;
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
    return;
  }
  if (season === 'summer') {
    const tw = 0.5 + 0.5 * Math.sin(p.t * p.tw * TAU);
    ctx.globalAlpha = p.a * (0.2 + 0.8 * tw * tw);
    const s = p.r * 2;
    ctx.drawImage(p.sprite, p.x - s / 2, p.y - s / 2, s, s);
    return;
  }
  if (sh?.ready) { // real leaves (tumble side-to-side) / petals (flutter top-to-bottom)
    ctx.globalAlpha = p.a;
    drawSprite(sh, p, p.r * (season === 'fall' ? 2.7 : 2.5), season === 'fall');
    return;
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  const r = p.r;
  ctx.globalAlpha = p.a;
  ctx.fillStyle = p.c;
  ctx.beginPath();
  if (season === 'spring') { // petal
    ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(p.flip)));
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 0.9, -r * 0.4, r * 0.6, r * 0.8, 0, r);
    ctx.bezierCurveTo(-r * 0.6, r * 0.8, -r * 0.9, -r * 0.4, 0, -r);
    ctx.fill();
  } else { // leaf + midrib
    ctx.scale(0.3 + 0.7 * Math.abs(Math.cos(p.flip)), 1);
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.1, 0, r);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.1, 0, -r);
    ctx.fill();
    ctx.globalAlpha = p.a * 0.55;
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.8);
    ctx.lineTo(0, r * 1.3);
    ctx.stroke();
  }
  ctx.restore();
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
  last = now;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = season === 'summer' ? 'lighter' : 'source-over';
  for (const p of parts) { update(p, dt); draw(p); }
  ctx.globalAlpha = 1;
}

function start() {
  if (raf || !ctx || !season || reduceMotion() || document.hidden) return;
  last = 0;
  raf = requestAnimationFrame(frame);
}
function stop() { cancelAnimationFrame(raf); raf = 0; }
function clear() { if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); } }

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth;
  H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
}

function seed() {
  if (!season) return;
  const area = (W * H) / (1440 * 900);
  const n = Math.max(12, Math.min(CAP[season], Math.round(DENSITY[season] * area)));
  parts = Array.from({ length: n }, () => spawn({}, true));
}

/** Switch the particle system to a season (called by seasons.js). */
export function setFxSeason(key) {
  season = key;
  if (!ctx) return;
  if (!reduceMotion()) sheetFor(key); // only fetch sprites when they'll actually be drawn
  readColors();
  seed();
  if (reduceMotion()) { stop(); clear(); return; }
  start();
}

export function initFx() {
  canvas = document.querySelector('.season-fx');
  ctx = canvas?.getContext('2d') || null;
  if (!ctx) return;
  resize();
  let timer = 0;
  let lastW = W;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { resize(); if (W !== lastW) { lastW = W; seed(); } }, 150);
  }, { passive: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  onMotionChange(() => { if (reduceMotion()) { stop(); clear(); } else start(); });
}
