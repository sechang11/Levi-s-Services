#!/usr/bin/env node
/**
 * tools/gen-placeholders.js
 *
 * Zero-dependency generator for the site's neutral placeholder imagery.
 *
 *   node tools/gen-placeholders.js
 *
 * Writes
 *   public/assets/projects/{service}-01..06.svg  6 gallery shots per service (640x360)
 *   public/assets/projects/woodshop-01..05.svg   handmade furniture pieces (640x480)
 *   public/assets/photos/levi-portrait.svg       silhouette bust (480x600)
 *   public/assets/photos/passion-01..03.svg      "off the clock" photo slots (600x600)
 *   public/assets/photos/family-01.svg           family group slot (900x600)
 *   public/assets/photos/work-01.svg             "on the job" slot (900x600)
 *   public/assets/map.svg                        service-area map (640x400)
 *
 * The art is hue-neutral graphite so it sits inside any of the site's seasonal
 * themes (the site adds colour through CSS chrome). The only warm colour is the
 * window light in the snow-removal illustrations.
 *
 * Captions: the site overlays its own caption chip (bottom-left), a zoom icon
 * (top-left) and a corner ribbon (top-right) on the service thumbnails, so the
 * gallery images carry only a small "PLACEHOLDER PHOTO" note at the bottom-right.
 *
 * Every file is validated before anything touches the disk: well-formed XML
 * (balanced tags, single root, no duplicate attributes), no unescaped '&',
 * every url(#id)/href="#id" resolves inside the same file, required root
 * attributes present, and each file under 12 KB. Only after the whole set is
 * written and read back successfully are the retired files removed
 * (projects/proj-01..09.svg, projects/portrait.svg, projects/map.svg).
 *
 * Deterministic and idempotent: all variation comes from a seeded PRNG keyed by
 * the output file name (no Math.random, no clock), so re-running produces
 * byte-identical files; unchanged files are not rewritten.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'public', 'assets');
const MAX_BYTES = 12 * 1024;

/* ================================================================= utils */

/** FNV-1a 32-bit string hash, used to seed the PRNG per file. */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: tiny seeded PRNG returning floats in [0, 1). */
function prng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Compact number: one decimal, no trailing zeros, never "-0". */
const num = (v) => {
  const r = Math.round(v * 10) / 10;
  return String(r === 0 ? 0 : r);
};
const P = (p) => num(p[0]) + ' ' + num(p[1]);
const poly = (pts) => 'M' + pts.map(P).join('L') + 'Z';
const lerp = (a, b, t) => a + (b - a) * t;
const lerpP = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const mul = (p, k) => [p[0] * k, p[1] * k];
function rot(p, deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

/** Catmull-Rom spline through pts as cubic Bezier segments (no leading M). */
function smooth(pts) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += 'C' + P(c1) + ' ' + P(c2) + ' ' + P(p2);
  }
  return d;
}

/** XML-escape text and attribute values. */
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Sutherland-Hodgman clip of a convex polygon against an axis-aligned box. */
function clipBox(pts, x0, x1, y0, y1) {
  const planes = [
    [(p) => p[0] >= x0, (a, b) => [x0, lerp(a[1], b[1], (x0 - a[0]) / (b[0] - a[0]))]],
    [(p) => p[0] <= x1, (a, b) => [x1, lerp(a[1], b[1], (x1 - a[0]) / (b[0] - a[0]))]],
    [(p) => p[1] >= y0, (a, b) => [lerp(a[0], b[0], (y0 - a[1]) / (b[1] - a[1])), y0]],
    [(p) => p[1] <= y1, (a, b) => [lerp(a[0], b[0], (y1 - a[1]) / (b[1] - a[1])), y1]],
  ];
  let out = pts;
  for (const [inside, cut] of planes) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[(i + src.length - 1) % src.length];
      const b = src[i];
      if (inside(b)) {
        if (!inside(a)) out.push(cut(a, b));
        out.push(b);
      } else if (inside(a)) {
        out.push(cut(a, b));
      }
    }
    if (!out.length) break;
  }
  return out;
}

function area(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s / 2);
}

/* ======================================================== shared chrome */

const FONT = "'IBM Plex Mono', ui-monospace, monospace";
const INK = '#D5D9E0'; // icon strokes
const LABEL = '#9AA0AC'; // primary caption
const DIM = '#6E7482'; // secondary caption, crop marks, rims
const NOTE = '#5E6472'; // gallery "PLACEHOLDER PHOTO" note
const SIL = '#3A3F4B'; // people silhouettes

function doc(w, h, label, defs, body) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">` +
    (defs ? `<defs>${defs}</defs>` : '') +
    body +
    '</svg>'
  );
}

/** Film-grain filter: fractal noise mapped to white at a very low alpha. */
function grainDef(id, rnd, alpha) {
  const seed = 1 + Math.floor(rnd() * 9000);
  return (
    `<filter id="${id}" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${seed}" stitchTiles="stitch"/>` +
    `<feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 ${alpha} 0"/></filter>`
  );
}

/** Faint 40px grid. */
function grid(w, h, opacity = 0.05) {
  let d = '';
  for (let x = 40; x < w; x += 40) d += `M${x} 0V${h}`;
  for (let y = 40; y < h; y += 40) d += `M0 ${y}H${w}`;
  return `<path d="${d}" fill="none" stroke="#fff" opacity="${opacity}"/>`;
}

/** Graphite backdrop: vertical gradient + grid + grain. */
function graphite(id, w, h, rnd) {
  const defs =
    `<linearGradient id="bg-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22252D"/><stop offset="1" stop-color="#121419"/></linearGradient>` +
    grainDef(`gr-${id}`, rnd, 0.06);
  const body =
    `<rect width="${w}" height="${h}" fill="url(#bg-${id})"/>` +
    grid(w, h) +
    `<rect width="${w}" height="${h}" filter="url(#gr-${id})"/>`;
  return { defs, body };
}

/** L-shaped crop marks in the four corners (m = inset, l = arm length). */
function cropMarks(w, h, k = 1, m = 16, l = 18) {
  m *= k;
  l *= k;
  const d =
    `M${num(m)} ${num(m + l)}V${num(m)}H${num(m + l)}` +
    `M${num(w - m - l)} ${num(m)}H${num(w - m)}V${num(m + l)}` +
    `M${num(w - m)} ${num(h - m - l)}V${num(h - m)}H${num(w - m - l)}` +
    `M${num(m + l)} ${num(h - m)}H${num(m)}V${num(h - m - l)}`;
  return `<path d="${d}" fill="none" stroke="${DIM}" stroke-width="${num(2 * k)}"/>`;
}

function topLabel(text, k = 1) {
  return `<text x="${num(32 * k)}" y="${num(38 * k)}" font-family="${FONT}" font-size="${num(12 * k)}" letter-spacing="${num(2 * k)}" fill="${DIM}">${esc(text)}</text>`;
}

function bottomLabel(text, h, k = 1) {
  return `<text x="${num(32 * k)}" y="${num(h - 28 * k)}" font-family="${FONT}" font-size="${num(17 * k)}" letter-spacing="${num(3 * k)}" fill="${LABEL}">${esc(text)}</text>`;
}

/**
 * Gallery chrome for the 640x360 service shots: corner marks pushed out to a
 * 10px inset and a quiet note tucked into the bottom-right bracket, clear of
 * the site's caption chip (bottom-left), zoom icon (top-left) and ribbon
 * (top-right).
 */
function galleryChrome() {
  return (
    cropMarks(640, 360, 1, 10, 16) +
    `<text x="624" y="344" text-anchor="end" font-family="${FONT}" font-size="11" letter-spacing="2" fill="${NOTE}">PLACEHOLDER PHOTO</text>`
  );
}

/** Soft top/bottom scrims so overlays stay legible over large artwork. */
function scrimDefs(id, topA = 0.85, botA = 0.9) {
  return (
    `<linearGradient id="st-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22252D" stop-opacity="${topA}"/><stop offset="1" stop-color="#22252D" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="sb-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121419" stop-opacity="0"/><stop offset="1" stop-color="#121419" stop-opacity="${botA}"/></linearGradient>`
  );
}
function scrims(id, w, h, topH, botH) {
  return (
    (topH ? `<rect width="${w}" height="${topH}" fill="url(#st-${id})"/>` : '') +
    `<rect y="${h - botH}" width="${w}" height="${botH}" fill="url(#sb-${id})"/>`
  );
}

/** Camera focus brackets (four corner ticks) around a subject. */
function focusBrackets(x, y, hw, hh, l = 14) {
  const d =
    `M${num(x - hw)} ${num(y - hh + l)}V${num(y - hh)}H${num(x - hw + l)}` +
    `M${num(x + hw - l)} ${num(y - hh)}H${num(x + hw)}V${num(y - hh + l)}` +
    `M${num(x + hw)} ${num(y + hh - l)}V${num(y + hh)}H${num(x + hw - l)}` +
    `M${num(x - hw + l)} ${num(y + hh)}H${num(x - hw)}V${num(y + hh - l)}`;
  return `<path d="${d}" fill="none" stroke="${DIM}" stroke-width="1.5" opacity=".9"/>`;
}

/* ================================================================ icons
 * Each icon is a clean line drawing in a ~200x200 box centred on (0,0).
 * `W` is the main stroke width in icon units; the composition passes a value
 * that keeps the on-screen weight optically consistent across scales. Stroke
 * colour, caps, joins and fill="none" are inherited from the wrapper group.
 * `ctx` = { id, defs } lets an icon register per-file defs (e.g. masks).
 */

function iconDemolition(W) {
  const fine = num(W * 0.6);
  const pose = (p) => add(rot(p, 35), [-24, 14]);
  const head =
    'M-42 -100H42L50 -92V-70L42 -62H-42L-50 -70V-92Z' + // chamfered head
    'M-35 -98V-64M35 -98V-64' + // striking-face bevels
    'M-7 -100V-107H7V-100'; // handle end + wedge
  const handle = 'M-7 -62V38M7 -62V38M-10 38H10V86Q10 97 0 97Q-10 97 -10 86Z';
  let out =
    `<g transform="translate(-24 14) rotate(35)"><path d="${head + handle}"/>` +
    `<path d="M-10 54H10M-10 70H10" stroke-width="${fine}"/></g>`;
  // debris flying off the striking face
  const face = pose([50, -81]);
  const dir = rot([1, 0], 35);
  const perp = rot([0, 1], 35);
  const chunk = [
    [-6, -5],
    [6, -6],
    [7, 4],
    [-4, 6],
  ];
  let d = '';
  for (const [a, b, k, r] of [
    [26, -20, 1.1, 10],
    [38, 4, 0.8, 55],
    [20, 22, 0.95, -30],
  ]) {
    const c = add(face, add(mul(dir, a), mul(perp, b)));
    d += poly(chunk.map((q) => add(c, rot(mul(q, k), r))));
  }
  let ticks = '';
  for (const a of [-38, 0, 38]) {
    const u = rot(dir, a);
    ticks += 'M' + P(add(face, mul(u, 9))) + 'L' + P(add(face, mul(u, 15)));
  }
  return out + `<path d="${d}"/><path d="${ticks}" stroke-width="${fine}"/>`;
}

function iconFraming(W, ctx) {
  const fine = num(W * 0.5);
  // stud wall: double top plate, bottom plate, five studs, staggered fire blocking
  let d = 'M-96 -98H56V-74H-96ZM-96 -86H56M-96 64H56V76H-96Z';
  for (const x of [-96, -61, -25, 10, 46]) d += `M${x} -74V64M${x + 10} -74V64`;
  [
    [-86, -61],
    [-51, -25],
    [-15, 10],
    [20, 46],
  ].forEach(([a, b], i) => {
    const y = i % 2 ? -2 : -12;
    d += `M${a} ${y}H${b}M${a} ${y + 10}H${b}`;
  });
  // framing square leaning in front; the wall is knocked out around it
  const sq = 'M0 0H-112V-16H-14V-96H0Z';
  const sqT = 'translate(62 100) rotate(8)';
  ctx.defs +=
    `<mask id="ko-${ctx.id}" maskUnits="userSpaceOnUse" x="-150" y="-150" width="300" height="300">` +
    `<rect x="-150" y="-150" width="300" height="300" fill="#fff"/>` +
    `<path d="${sq}" transform="${sqT}" fill="#000" stroke="#000" stroke-width="${num(W * 3.2)}" stroke-linejoin="round"/></mask>`;
  let tk = '';
  for (let i = 0; i < 8; i++) tk += `M${-28 - i * 10} -16V${i % 2 ? -11 : -8}`;
  for (let i = 0; i < 6; i++) tk += `M-14 ${-28 - i * 10}H${i % 2 ? -9 : -6}`;
  return (
    `<g transform="translate(12 0)"><path d="${d}" mask="url(#ko-${ctx.id})"/>` +
    `<g transform="${sqT}"><path d="${sq}"/><path d="${tk}" stroke-width="${fine}"/></g></g>`
  );
}

function iconDrywall() {
  const d =
    'M-62 -60V-94Q-48 -106 -34 -96T-6 -96T22 -96T50 -96V-60' + // fresh paint swath
    'M-60 -52H40Q54 -52 54 -38V-18Q54 -4 40 -4H-60Q-74 -4 -74 -18V-38Q-74 -52 -60 -52Z' + // roller cover
    'M38 -47V-9' + // cover end cap
    'M54 -28H62Q72 -28 72 -18V8Q72 18 62 18H0Q-10 18 -10 28V38' + // frame
    'M-16 46V38H-4V46' + // ferrule
    'M-10 46Q0 46 0 56V90Q0 100 -10 100Q-20 100 -20 90V56Q-20 46 -10 46Z'; // handle
  return `<path d="${d}" transform="translate(1 2)"/>`;
}

function iconDecks(W) {
  const fine = num(W * 0.6);
  let d = '';
  // fence pickets (bottoms hidden behind the deck)
  for (let i = 0; i < 7; i++) {
    const l = -83 + i * 25;
    d += `M${l} 2V-80L${l + 8} -96L${l + 16} -80V2`;
  }
  // rails showing in the gaps
  let rails = '';
  for (let i = 0; i < 6; i++) {
    const a = -83 + i * 25 + 16;
    rails += `M${a} -56H${a + 9}M${a} -16H${a + 9}`;
  }
  // deck surface in perspective, boards, rim joist, stair
  const e = (y) => 84 + ((y - 2) / 56) * 16;
  d += 'M-84 2H84L100 58H-100Z';
  for (const y of [15, 29, 43]) d += `M${num(-e(y))} ${y}H${num(e(y))}`;
  d += 'M-100 58V72H100V58';
  d += 'M-30 72L-40 98M30 72L40 98M-35 85H35M-40 98H40'; // stair: stringers + treads
  const joints = 'M-30 2V15M40 15V29M-52 29V43M18 43V58';
  return `<path d="${d}"/><path d="${rails + joints}" stroke-width="${fine}"/>`;
}

function iconFlooring(W) {
  // herringbone planks (1:3) laid at 45 degrees, clipped to the sample frame
  const u = 20;
  const L = 60;
  const X = 96;
  const Y = 78;
  const R = (p) => add(rot(p, 45), [0, -14]);
  let d = '';
  for (let i = -10; i <= 10; i++) {
    for (let j = -4; j <= 4; j++) {
      const o = [i * u + j * L, i * u - j * L];
      const V = [o, [o[0] + u, o[1]], [o[0] + u, o[1] + L], [o[0], o[1] + L]];
      const H = [
        [o[0] + u, o[1]],
        [o[0] + u + L, o[1]],
        [o[0] + u + L, o[1] + u],
        [o[0] + u, o[1] + u],
      ];
      for (const q of [V, H]) {
        const c = clipBox(q.map(R), -X, X, -Y, Y);
        if (c.length > 2 && area(c) > 6) d += poly(c);
      }
    }
  }
  return `<path d="${d}" stroke-width="${num(W * 0.72)}"/><rect x="${-X}" y="${-Y}" width="${2 * X}" height="${2 * Y}" rx="3"/>`;
}

function iconKitchen() {
  const d =
    'M-100 8H100V22H-100Z' + // countertop
    'M-78 22V48Q-78 72 -54 72H2Q26 72 26 48V22' + // basin
    'M-26 72V84' + // tailpiece
    'M30 8V1H56V8' + // escutcheon
    'M36 1V-46M50 1V-46' + // riser
    'M50 -46A41.5 41.5 0 0 0 -33 -46M36 -46A27.5 27.5 0 0 0 -19 -46' + // gooseneck
    'M-33 -46V-36M-19 -46V-36M-36 -36H-16' + // spout + aerator
    'M50 -24L72 -38' + // lever
    'M-26 -26Q-18 -15 -18 -9A8 8 0 0 1 -34 -9Q-34 -15 -26 -26Z'; // drop
  return `<path d="${d}" transform="translate(0 4)"/>`;
}

function iconRoofing(W) {
  const fine = num(W * 0.55);
  const rows = [-84, -69.2, -54.4, -39.6, -24.8, -10];
  const hw = (y) => 44 + ((y + 84) * 56) / 74;
  let d = 'M-44 -84H44L100 -10H-100Z' + 'M22 -84V-103H38V-84M17 -103H43'; // roof plane + chimney
  let c = '';
  for (let k = 1; k < 5; k++) c += `M${num(-hw(rows[k]))} ${rows[k]}H${num(hw(rows[k]))}`;
  for (let k = 0; k < 5; k++) {
    const lim = hw(rows[k]) - 8;
    for (let x = -126 + (k % 2 ? 14 : 0); x <= 126; x += 28) {
      if (Math.abs(x) < lim) c += `M${x} ${rows[k]}V${rows[k + 1]}`;
    }
  }
  d += 'M-106 -10H106V-4Q106 2 100 2H-100Q-106 2 -106 -4Z'; // gutter
  d += 'M84 2V76Q84 88 96 88H108V78H102Q96 78 96 72V2'; // downspout + elbow
  d += 'M-80 2V96M80 2V96M-98 96H98'; // walls + grade
  d += 'M-22 28H22V64H-22ZM0 28V64M-22 46H22'; // window
  return `<g transform="translate(0 4)"><path d="${d}"/><path d="${c}" stroke-width="${fine}"/></g>`;
}

function iconConcrete(W) {
  const fine = num(W * 0.55);
  // running-bond brick courses, top course racked back on the left
  const d = 'M-100 100V34H-20V12H100V100Z' + 'M-100 56H100M-100 78H100M-20 34H100';
  const joints = 'M40 12V34M-50 34V56M10 34V56M70 34V56M-80 56V78M-20 56V78M40 56V78M-50 78V100M10 78V100M70 78V100';
  const mortar = 'M-94 27Q-86 21 -78 27T-62 27T-46 27T-30 27';
  // pointing trowel: kite blade, neck, capsule handle; tip resting on the mortar
  const trowel =
    'M0 0Q30 -18 70 -22Q77 0 70 22Q30 18 0 0Z' +
    'M74 0L85 -9H93' +
    'M101 -17H133Q141 -17 141 -9Q141 -1 133 -1H101Q93 -1 93 -9Q93 -17 101 -17ZM101 -17V-1';
  return (
    `<g transform="translate(0 -14)"><path d="${d}"/><path d="${joints}" stroke-width="${fine}"/>` +
    `<path d="${mortar}" stroke-width="${fine}"/>` +
    `<path d="${trowel}" transform="translate(-58 14) rotate(-32)"/></g>`
  );
}

/* ====================================================== woodshop pieces
 * Handmade furniture for the Woodshop gallery, drawn in the same ~200x200
 * icon box. Mostly straight elevations: they read instantly at thumbnail size.
 */

function iconTable(W) {
  const fine = num(W * 0.55);
  // live-edge slab (wavy top edge), trestle legs with cleats and feet, stretcher
  const slab = 'M-106 -30C-84 -38 -58 -25 -30 -31S24 -39 52 -31S90 -25 106 -31V-18H-106Z';
  let legs = '';
  for (const x of [-72, 72]) legs += `M${x - 16} -18V-10H${x + 16}V-18M${x - 6} -10V66M${x + 6} -10V66M${x - 20} 66H${x + 20}V74H${x - 20}Z`;
  const stretcher = 'M-66 26H66M-66 34H66';
  const bowl = 'M16 -46Q40 -16 64 -46ZM34 -46Q36 -58 46 -60'; // bowl + a stem of eucalyptus
  const grain = 'M-90 -24C-60 -27 -30 -22 0 -25S50 -27 80 -24';
  return (
    `<path d="${slab}"/><path d="${legs}"/><path d="${stretcher}"/><path d="${bowl}"/>` +
    `<path d="${grain}" stroke-width="${fine}" opacity=".7"/>`
  );
}

function iconBench(W) {
  const fine = num(W * 0.55);
  // thick plank seat on splayed tapered legs, pinned stretcher, end-grain rings
  const seat = 'M-104 -22H104V-6H-104Z';
  const legs = 'M-80 -6L-96 62H-86L-66 -6M80 -6L96 62H86L66 -6';
  const stretcher = 'M-75 24H75M-77 32H77';
  const wedges = 'M-100 -14H-96M96 -14H100'; // through-tenon wedges showing on the ends
  const grain = 'M-70 -14C-40 -17 -10 -11 20 -14S60 -16 84 -13';
  return (
    `<g transform="translate(0 8)"><path d="${seat}"/><path d="${legs}"/><path d="${stretcher}"/>` +
    `<path d="${wedges + grain}" stroke-width="${fine}"/></g>`
  );
}

function iconShelves(W) {
  const fine = num(W * 0.55);
  // three floating shelves, staggered, with the things people put on them
  const planks = 'M-100 -52H-4V-44H-100ZM4 -4H100V4H4ZM-84 48H12V56H-84Z';
  const books = 'M-90 -52V-86H-81V-52M-79 -52V-80H-70V-52M-66 -52L-53 -83L-45 -80L-58 -52';
  const plant = 'M-36 -52L-33 -68H-17L-14 -52ZM-25 -68C-33 -80 -41 -82 -45 -92M-25 -68C-21 -83 -13 -88 -7 -94M-25 -68V-94';
  const vase = 'M28 -4C18 -16 20 -28 29 -34V-44H39V-34C48 -28 50 -16 40 -4Z';
  const frame = 'M60 -4L66 -48H94L92 -4ZM68 -12L72 -40H88L86 -12';
  const stack = 'M-76 48V39H-26V48M-72 39V30H-30V39';
  const mug = 'M-12 48V30H4V48M4 34H8Q12 34 12 38Q12 43 8 43H4';
  return (
    `<path d="${planks}"/><path d="${books + vase + frame + stack + mug}"/>` +
    `<path d="${plant}" stroke-width="${fine}"/>`
  );
}

function iconBoard(W) {
  const fine = num(W * 0.5);
  // end-grain cutting board in three-quarter view: checkerboard top, thickness, juice groove
  const A = [-98, -4];
  const B = [16, -58];
  const C = [98, -2];
  const D = [-16, 52];
  const T = 16; // thickness
  const dn = (p) => [p[0], p[1] + T];
  let d = poly([A, B, C, D]) + `M${P(A)}L${P(dn(A))}L${P(dn(D))}L${P(dn(C))}L${P(C)}M${P(D)}L${P(dn(D))}`;
  let gridLines = '';
  let cells = '';
  const N = 6;
  const at = (i, j) => lerpP(lerpP(A, B, i / N), lerpP(D, C, i / N), j / N);
  for (let i = 1; i < N; i++) {
    gridLines += `M${P(lerpP(A, B, i / N))}L${P(lerpP(D, C, i / N))}`;
    gridLines += `M${P(lerpP(A, D, i / N))}L${P(lerpP(B, C, i / N))}`;
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) if ((i + j) % 2 === 0) cells += poly([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
  }
  // juice groove: an inset ring near the rim
  const k = 0.07;
  const groove = poly([lerpP(A, C, k), lerpP(B, D, k), lerpP(C, A, k), lerpP(D, B, k)]);
  return (
    `<path d="${cells}" fill="${INK}" fill-opacity=".14" stroke="none"/>` +
    `<path d="${d}"/><path d="${gridLines}" stroke-width="${fine}" opacity=".8"/>` +
    `<path d="${groove}" stroke-width="${fine}" stroke-dasharray="3 5"/>`
  );
}

function iconNightstand(W) {
  const fine = num(W * 0.55);
  // mid-century side table: overhanging top, one drawer, open cubby, splayed tapered legs, a lamp
  const top = 'M-66 -58H66V-46H-66Z';
  const box = 'M-56 -46H56V26H-56ZM-56 -8H56';
  const drawer = 'M-46 -38H46V-16H-46ZM-6 -27a6 6 0 1 0 12 0a6 6 0 1 0 -12 0';
  const legs = 'M-50 26L-64 96H-56L-38 26M50 26L64 96H56L38 26';
  const lamp = 'M18 -58V-64H38V-58M28 -64V-92M10 -92L17 -116H39L46 -92Z';
  const book = 'M-44 26V14H4V26';
  return (
    `<g transform="translate(0 -4)"><path d="${top + box + legs + lamp}"/><path d="${drawer}"/>` +
    `<path d="${book}" stroke-width="${fine}"/></g>`
  );
}

/* Woodshop gallery: 640x480 shots, one piece each, framed like a studio photo. */
/* floor = the piece's lowest point in icon units (null = wall-mounted, no floor line) */
const WOODSHOP = [
  { n: '01', icon: iconTable, s: 1.42, y: 246, floor: 74, what: 'live-edge slab dining table with trestle legs' },
  { n: '02', icon: iconBench, s: 1.36, y: 244, floor: 70, what: 'plank bench with splayed legs' },
  { n: '03', icon: iconShelves, s: 1.55, y: 238, floor: null, what: 'three floating shelves with books, a plant, a vase and a frame' },
  { n: '04', icon: iconBoard, s: 1.46, y: 240, floor: 68, what: 'end-grain checkerboard cutting board' },
  { n: '05', icon: iconNightstand, s: 1.24, y: 238, floor: 92, what: 'mid-century nightstand with a lamp' },
];

function woodshopShot(item, id, rnd) {
  const W = 5.5 / Math.sqrt(item.s);
  const bg = graphite(id, 640, 480, rnd);
  const defs = bg.defs + scrimDefs(id) + `<radialGradient id="sp-${id}" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  let body = bg.body + `<rect width="640" height="480" fill="url(#sp-${id})"/>`; // studio spotlight
  if (item.floor != null) {
    const floorY = item.y + item.floor * item.s + W * item.s * 0.5;
    body += `<path d="M36 ${num(floorY)}H604" stroke="${DIM}" stroke-dasharray="1 6" opacity=".7"/>`;
  }
  body += `<g transform="translate(320 ${item.y}) scale(${item.s})"><g fill="none" stroke="${INK}" stroke-width="${num(W)}" stroke-linecap="round" stroke-linejoin="round">${item.icon(W)}</g></g>`;
  body += scrims(id, 640, 480, 70, 96);
  body += cropMarks(640, 480, 1, 10, 16);
  body += `<text x="624" y="464" text-anchor="end" font-family="${FONT}" font-size="11" letter-spacing="2" fill="${NOTE}">PLACEHOLDER PHOTO</text>`;
  return doc(640, 480, `Placeholder woodshop photo ${item.n}: ${item.what}, line drawing`, defs, body);
}

/* ============================================= icon shot compositions */

const SHOTS = [
  { n: '01', label: 'WIDE', s: 0.5, x: 320, y: 174, r: 0, fx: 'frame' },
  { n: '02', label: 'BEFORE', s: 0.9, x: 204, y: 178, r: -3 },
  { n: '03', label: 'IN PROGRESS', s: 0.95, x: 438, y: 176, r: 0, fx: 'build' },
  { n: '04', label: 'DETAIL', s: 0, x: 336, y: 182, r: 0, fx: 'detail' },
  { n: '05', label: 'AFTER', s: 1.22, x: 320, y: 176, r: 0 },
  { n: '06', label: 'FINISH', s: 1.0, x: 330, y: 176, r: 5, fx: 'glow' },
];

const SHOT_WORDS = {
  WIDE: 'wide shot',
  BEFORE: 'before',
  'IN PROGRESS': 'in progress',
  DETAIL: 'detail',
  AFTER: 'after',
  FINISH: 'finished',
};

function iconShot(svc, shot, id, rnd) {
  let s = shot.s;
  let x = shot.x;
  let y = shot.y;
  if (shot.fx === 'detail') {
    const [ds, fx, fy] = svc.detail;
    s = ds;
    x -= fx * s;
    y -= fy * s;
  }
  const W = 5.5 / Math.sqrt(s); // optical stroke compensation
  const ctx = { id, defs: '' };
  const art = svc.icon(W, ctx);
  const g = (inner, extra = '', sw = W) =>
    `<g fill="none" stroke="${INK}" stroke-width="${num(sw)}" stroke-linecap="round" stroke-linejoin="round"${extra}>${inner}</g>`;
  const bg = graphite(id, 640, 360, rnd);
  let defs = bg.defs + scrimDefs(id) + ctx.defs;
  let inner;
  if (shot.fx === 'build') {
    // "under construction": solid below a level line, ghosted above it
    const b = svc.build;
    defs += `<clipPath id="cp-${id}"><rect x="-160" y="${b}" width="320" height="320"/></clipPath>`;
    inner =
      g(art, ' opacity=".2"') +
      g(art, ` clip-path="url(#cp-${id})"`) +
      `<path d="M-128 ${b}H128" fill="none" stroke="${INK}" stroke-width="${num(W * 0.34)}" stroke-dasharray="2 7" stroke-linecap="round" opacity=".7"/>` +
      `<path d="M-128 ${b - 7}V${b + 7}M128 ${b - 7}V${b + 7}" fill="none" stroke="${INK}" stroke-width="${num(W * 0.45)}" stroke-linecap="round" opacity=".7"/>`;
  } else if (shot.fx === 'glow') {
    // "finished": soft halo and a couple of sparkles
    defs += `<filter id="gl-${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>`;
    const spark = 'M0 -11Q1.6 -1.6 11 0Q1.6 1.6 0 11Q-1.6 1.6 -11 0Q-1.6 -1.6 0 -11Z';
    const [sx, sy] = svc.spark || [104, -92];
    inner =
      `<g filter="url(#gl-${id})" opacity=".45">${g(art, '', W * 2.4)}</g>` +
      g(art) +
      g(`<path d="${spark}" transform="translate(${sx} ${sy})"/><path d="${spark}" transform="translate(${sx + 22} ${sy + 28}) scale(.55)"/>`);
  } else {
    inner = g(art);
  }
  const tf = `translate(${num(x)} ${num(y)})` + (shot.r ? ` rotate(${shot.r})` : '') + ` scale(${s})`;
  let body = bg.body + `<g transform="${tf}">${inner}</g>`;
  if (shot.fx === 'frame') {
    body += focusBrackets(x, y, 128 * s + 18, 112 * s + 16);
    body += `<path d="M40 ${num(y + 112 * s + 16)}H600" stroke="${DIM}" stroke-dasharray="1 5" opacity=".6"/>`;
  }
  body += scrims(id, 640, 360, 64, 92) + galleryChrome();
  const label = `Placeholder project photo: ${svc.name}, shot ${shot.n} (${SHOT_WORDS[shot.label]}), ${svc.what} line drawing`;
  return doc(640, 360, label, defs, body);
}

/* ========================================================= snow scenes */

const SNOW = {
  snow: '#E8EEF6',
  shade: '#C3CDDB',
  asphalt: '#2A2E36',
  edge: '#3A3F4A',
  joint: '#22262D',
  riser: '#1B1E25',
  house: '#0D1017',
  door: '#171B24',
  metal: '#2A2F38',
  warm: '#E9C98A',
  far: '#141925',
};

function snowDefs(id, hy, rnd) {
  return (
    `<linearGradient id="sky-${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${hy}"><stop offset="0" stop-color="#10141D"/><stop offset="1" stop-color="#1A2030"/></linearGradient>` +
    `<linearGradient id="gd-${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${hy}" x2="0" y2="360"><stop offset="0" stop-color="#A3AEBF"/><stop offset="1" stop-color="#DCE3EC"/></linearGradient>` +
    `<radialGradient id="gw-${id}"><stop offset="0" stop-color="${SNOW.warm}" stop-opacity=".42"/><stop offset="1" stop-color="${SNOW.warm}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="sc-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0D1017" stop-opacity="0"/><stop offset="1" stop-color="#0D1017" stop-opacity=".62"/></linearGradient>` +
    grainDef(`gr-${id}`, rnd, 0.045)
  );
}

const sky = (id, hy) => `<rect width="640" height="${hy + 20}" fill="url(#sky-${id})"/>`;
const ground = (id, hy) => `<rect y="${hy}" width="640" height="${360 - hy}" fill="url(#gd-${id})"/>`;

/** Distant conifer tree line along the horizon. */
function treeline(rnd, base, amp) {
  let d = `M0 ${base + 14}`;
  for (let i = 0, x = 0; x <= 648; i++, x += 8) {
    const y = i % 2 ? base - amp * (0.4 + 0.6 * rnd()) : base - amp * 0.28 * rnd();
    d += `L${x} ${num(y)}`;
  }
  return `<path d="${d}L648 ${base + 14}Z" fill="${SNOW.far}"/>`;
}

/** Conifer silhouette with snow clumps on the branch tips. */
function pine(x, y, s) {
  return (
    `<g transform="translate(${num(x)} ${num(y)}) scale(${s})">` +
    `<path d="M0 -84L16 -58H9L25 -34H14L31 -8H3V2H-3V-8H-31L-14 -34H-25L-9 -58H-16Z" fill="#0B0E14"/>` +
    `<path d="M0 -84L6 -74Q0 -71 -6 -74ZM-18 -58Q-12 -63 -7 -59ZM18 -58Q12 -63 7 -59ZM-27 -34Q-20 -40 -13 -35ZM27 -34Q20 -40 13 -35ZM-33 -8Q-25 -14 -17 -9ZM33 -8Q25 -14 17 -9Z" fill="${SNOW.shade}" opacity=".75"/></g>`
  );
}

/** Falling snow: round white dots (zero-length round-capped strokes) in three depth layers. */
function flakes(rnd, n, box = [0, 0, 640, 360], boost = 1) {
  const layers = ['', '', ''];
  for (let i = 0; i < n; i++) {
    const k = rnd() < 0.5 ? 0 : rnd() < 0.6 ? 1 : 2;
    layers[k] += `M${num(lerp(box[0], box[2], rnd()))} ${num(lerp(box[1], box[3], rnd()))}h0`;
  }
  const widths = ['1.9', '2.9', '4.3'];
  const ops = [0.35, 0.55, 0.8].map((o) => Math.round(Math.min(1, o * boost) * 100) / 100);
  return layers
    .map((d, i) => (d ? `<path d="${d}" stroke="#fff" stroke-width="${widths[i]}" stroke-linecap="round" opacity="${ops[i]}"/>` : ''))
    .join('');
}

/** Smooth lumpy offset along a polyline: returns shifted points. */
function lumpy(pts, rnd, amp, fn) {
  const p1 = rnd() * 6.3;
  const p2 = rnd() * 6.3;
  const n = pts.length - 1;
  return pts.map((p, i) => {
    const t = i / n;
    const b = 1 + amp * Math.sin(t * 12 + p1) + amp * 0.5 * Math.sin(t * 27 + p2);
    return fn(p, t, b);
  });
}

/**
 * Snowbank piled along a pavement edge (points far -> near). dir = -1 piles
 * to the left of the edge on screen, +1 to the right. The face toward the
 * pavement is shaded.
 */
function bank(edge, dir, hF, hN, wF, wN, rnd) {
  const n = edge.length - 1;
  const top = lumpy(edge, rnd, 0.18, ([x, y], t, b) => [x + dir * lerp(wF, wN, t) * 0.5, y - lerp(hF, hN, t) * b]);
  const mid = top.map((p, i) => lerpP(edge[i], p, 0.42));
  const near = edge[n];
  const cap = [near[0] + dir * wN, near[1] + 6];
  const base = edge.map(P).join('L');
  return (
    `<path d="M${base}L${P(cap)}L${P(top[n])}${smooth(top.slice().reverse())}Z" fill="${SNOW.snow}"/>` +
    `<path d="M${base}L${P(mid[n])}${smooth(mid.slice().reverse())}Z" fill="${SNOW.shade}"/>`
  );
}

/** Evenly sampled points along a straight segment. */
function seg(a, b, n) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(lerpP(a, b, i / n));
  return out;
}

/** Snow-covered shrub: a lumpy mound of three domes with a shaded base. */
function shrub(x, y, rx, ry) {
  const e = (cx, cy, a, b) => `<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(a)}" ry="${num(b)}"/>`;
  return (
    `<g fill="${SNOW.snow}">${e(x - rx * 0.42, y + ry * 0.18, rx * 0.62, ry * 0.8)}${e(x + rx * 0.45, y + ry * 0.22, rx * 0.58, ry * 0.74)}${e(x, y, rx * 0.7, ry)}</g>` +
    `<path d="M${num(x - rx * 1.02)} ${num(y + ry * 0.45)}Q${num(x)} ${num(y + ry * 1.25)} ${num(x + rx * 1.02)} ${num(y + ry * 0.45)}Q${num(x)} ${num(y + ry * 0.75)} ${num(x - rx * 1.02)} ${num(y + ry * 0.45)}Z" fill="${SNOW.shade}"/>`
  );
}

function grainLayer(id) {
  return `<rect width="640" height="360" filter="url(#gr-${id})"/>`;
}

/** Bottom vignette + gallery chrome for the snow scenes. */
function snowChrome(id) {
  return `<rect y="236" width="640" height="124" fill="url(#sc-${id})"/>` + galleryChrome();
}

/* ---- house A: gable front with a garage door (driveway scenes) ---- */

const HOUSE_A_LIGHTS =
  '<g fill="#E9C98A"><rect x="-50" y="-72" width="24" height="18"/><rect x="26" y="-72" width="24" height="18"/><circle cy="-100" r="7"/></g>' +
  '<path d="M-38 -72V-54M-50 -63H-26M38 -72V-54M26 -63H50M0 -107V-93M-7 -100H7" stroke="#0D1017" stroke-width="2"/>';

function houseAGlow(id) {
  return `<ellipse cx="-38" cy="-63" rx="34" ry="24" fill="url(#gw-${id})"/><ellipse cx="38" cy="-63" rx="34" ry="24" fill="url(#gw-${id})"/>`;
}

function houseA(id, x, y, s) {
  const H = SNOW.house;
  return (
    `<g transform="translate(${num(x)} ${num(y)}) scale(${s})">` +
    `<path d="M-70 0V-78H-84L0 -134L84 -78H70V0Z" fill="${H}"/>` +
    `<rect x="38" y="-128" width="13" height="30" fill="${H}"/>` +
    // snow on the rakes and chimney
    `<path d="M-88 -83.3L0 -142L88 -83.3Q93 -79 88 -75Q84 -74 80 -77.7L0 -131L-80 -77.7Q-84 -74 -88 -75Q-93 -79 -88 -83.3Z" fill="${SNOW.snow}"/>` +
    `<path d="M36 -128Q44.5 -136 53 -128Z" fill="${SNOW.snow}"/>` +
    // garage door
    `<rect x="-38" y="-46" width="76" height="46" fill="${SNOW.door}"/>` +
    `<path d="M-38 -35H38M-38 -24H38M-38 -13H38" stroke="${H}" stroke-width="1.6"/>` +
    // warm windows + glow + snowy sills
    houseAGlow(id) +
    HOUSE_A_LIGHTS +
    `<path d="M-52 -53H-24M24 -53H52" stroke="${SNOW.shade}" stroke-width="2.6" stroke-linecap="round"/>` +
    '</g>'
  );
}

/* ---- house B: wide hip-roof front with a centred door ---- */

function houseB(id, x, y, s, lights) {
  const H = SNOW.house;
  let g = `<g transform="translate(${num(x)} ${num(y)}) scale(${s})">`;
  g += `<path d="M-140 0V-104H-158L-92 -150H92L158 -104H140V0Z" fill="${H}"/>`;
  // snow-covered roof plane
  g += `<path d="M-161 -103Q-162 -108 -156 -110L-93 -153H93L156 -110Q162 -108 161 -103Q150 -100 140 -104H-140Q-150 -100 -161 -103Z" fill="${SNOW.shade}"/>`;
  g += `<path d="M-94 -153H94L104 -146Q0 -140 -104 -146Z" fill="${SNOW.snow}"/>`;
  g += `<path d="M-158 -104Q-120 -98 -80 -103T0 -103T80 -103T158 -104" fill="none" stroke="${SNOW.snow}" stroke-width="3" stroke-linecap="round"/>`;
  // porch canopy over the door
  g += `<path d="M-34 -64L0 -86L34 -64Z" fill="${H}"/><path d="M-38 -62L0 -89L38 -62L33 -60L0 -82L-33 -60Z" fill="${SNOW.snow}"/>`;
  g += `<rect x="-18" y="-60" width="36" height="60" fill="${SNOW.door}"/>`;
  // windows: lit ones glow, dark ones stay door-grey
  const win = { l: '<rect x="-116" y="-78" width="52" height="40"/>', r: '<rect x="64" y="-78" width="52" height="40"/>' };
  let lit = '';
  for (const k of ['l', 'r']) {
    if (lights[k]) {
      g += `<ellipse cx="${k === 'l' ? -90 : 90}" cy="-58" rx="56" ry="38" fill="url(#gw-${id})"/>`;
      lit += win[k];
    } else {
      g += win[k].replace('/>', ` fill="${SNOW.door}"/>`);
    }
  }
  if (lights.door) lit += '<rect x="-8" y="-52" width="16" height="22"/>';
  g += `<g fill="${SNOW.warm}">${lit}</g>`;
  g += `<path d="M-90 -78V-38M-116 -58H-64M90 -78V-38M64 -58H116" stroke="${H}" stroke-width="3"/>`;
  g += `<path d="M-119 -37H-61M61 -37H119" stroke="${SNOW.snow}" stroke-width="3.4" stroke-linecap="round"/>`;
  return g + '</g>';
}

/* ---- 01 / 05 / 06: the driveway ---- */

const DW = { hy: 198, house: [332, 208], FL: [294, 208], FR: [370, 208], NL: [96, 360], NR: [584, 360] };
const dwLeft = (y) => lerp(DW.FL[0], DW.NL[0], (y - DW.FL[1]) / (DW.NL[1] - DW.FL[1]));
const dwRight = (y) => lerp(DW.FR[0], DW.NR[0], (y - DW.FR[1]) / (DW.NR[1] - DW.FR[1]));

function drivewayBase(id, rnd) {
  const { FL, FR, NL, NR } = DW;
  let s = sky(id, DW.hy) + treeline(rnd, DW.hy + 2, 20) + ground(id, DW.hy);
  s += pine(204, 214, 1.18) + pine(470, 211, 0.92) + pine(548, 215, 0.7);
  s += houseA(id, DW.house[0], DW.house[1], 1);
  // cleared asphalt with lighter plow-cut edges and faint scrape lines
  s += `<path d="${poly([FL, FR, NR, NL])}" fill="${SNOW.asphalt}"/>`;
  s += `<path d="${poly([FL, NL, add(NL, [18, 0]), add(FL, [3, 0])])}${poly([FR, NR, add(NR, [-18, 0]), add(FR, [-3, 0])])}" fill="${SNOW.edge}"/>`;
  s += `<path d="M318 210L236 360M346 210L430 360" stroke="#30353E" stroke-width="2" opacity=".8"/>`;
  s += bank(seg(FL, NL, 14), -1, 5, 42, 12, 90, rnd);
  s += bank(seg(FR, NR, 14), 1, 5, 40, 12, 90, rnd);
  return s;
}

function snowDriveway(id, rnd) {
  const s = drivewayBase(id, rnd) + flakes(rnd, 64) + grainLayer(id) + snowChrome(id);
  return doc(640, 360, 'Placeholder illustration for Clear Path Snow Removal: a fully cleared driveway with snowbanks on both sides leading to a house at dusk', snowDefs(id, DW.hy, rnd), s);
}

function snowBeforeAfter(id, rnd) {
  const { FL, NL } = DW;
  const defs = snowDefs(id, DW.hy, rnd) + `<clipPath id="hf-${id}"><rect width="320" height="360"/></clipPath>`;
  let s = drivewayBase(id, rnd);
  // BEFORE: the left half is still buried under an unbroken blanket
  let deep = `<rect y="207" width="320" height="153" fill="url(#gd-${id})"/>`;
  deep += `<path d="M0 262C90 248 200 250 320 240M0 306C110 292 220 286 320 280M150 222C210 218 270 216 320 214" fill="none" stroke="${SNOW.shade}" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>`;
  deep += `<path d="M${P(add(FL, [-10, 6]))}Q260 226 180 300T${P(add(NL, [30, 0]))}" fill="none" stroke="${SNOW.shade}" stroke-width="3" opacity=".5"/>`;
  deep += `<path d="M284 209Q300 188 322 195V210Z" fill="${SNOW.snow}"/>`;
  s += `<g clip-path="url(#hf-${id})">${deep}</g>`;
  s += flakes(rnd, 60);
  // comparison divider with a handle and two tiny tags
  const hy = 268;
  s += `<path d="M320 0V360" stroke="${SNOW.snow}" stroke-width="2" opacity=".9"/>`;
  s += `<circle cx="320" cy="${hy}" r="13" fill="#10141D" stroke="${SNOW.snow}" stroke-width="2"/>`;
  s += `<path d="M316 ${hy - 5}L311 ${hy}L316 ${hy + 5}M324 ${hy - 5}L329 ${hy}L324 ${hy + 5}" fill="none" stroke="${SNOW.snow}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const tiny = `font-family="${FONT}" font-size="11" letter-spacing="2" fill="${INK}"`;
  s += `<rect x="222" y="${hy - 9}" width="78" height="18" rx="3" fill="#10141D" opacity=".78"/><rect x="340" y="${hy - 9}" width="70" height="18" rx="3" fill="#10141D" opacity=".78"/>`;
  s += `<text x="292" y="${hy + 4}" text-anchor="end" ${tiny}>BEFORE</text><text x="348" y="${hy + 4}" ${tiny}>AFTER</text>`;
  s += grainLayer(id) + snowChrome(id);
  return doc(640, 360, 'Placeholder illustration for Clear Path Snow Removal: before and after split view of a driveway, deep snow on the left half and cleared pavement on the right', defs, s);
}

function snowNight(id, rnd) {
  const { FL, FR } = DW;
  const lamp = [458, 222];
  const defs =
    snowDefs(id, DW.hy, rnd) +
    `<radialGradient id="cn-${id}" gradientUnits="userSpaceOnUse" cx="${lamp[0]}" cy="${lamp[1]}" r="250"><stop offset="0" stop-color="#F4F7FB" stop-opacity=".55"/><stop offset=".45" stop-color="#F4F7FB" stop-opacity=".2"/><stop offset="1" stop-color="#F4F7FB" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="hl-${id}"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".3" stop-color="#F4F7FB" stop-opacity=".35"/><stop offset="1" stop-color="#F4F7FB" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="pl-${id}"><stop offset="0" stop-color="#F4F7FB" stop-opacity=".3"/><stop offset="1" stop-color="#F4F7FB" stop-opacity="0"/></radialGradient>` +
    `<filter id="bl-${id}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>`;
  let s = drivewayBase(id, rnd);
  // the upper drive is still unplowed: snow fills it down to a crisp cut line
  const cut = 258;
  s += `<path d="M${P(add(FL, [-2, -1]))}L${P(add(FR, [2, -1]))}L${num(dwRight(cut) + 3)} ${cut + 1}Q320 ${cut - 3} ${num(dwLeft(cut) - 3)} ${cut + 1}Z" fill="url(#gd-${id})"/>`;
  s += `<path d="M${num(dwLeft(cut + 1))} ${cut + 1}Q320 ${cut - 3} ${num(dwRight(cut + 1))} ${cut + 1}L${num(dwRight(cut + 7))} ${cut + 7}Q320 ${cut + 3} ${num(dwLeft(cut + 7))} ${cut + 7}Z" fill="${SNOW.snow}"/>`;
  s += `<path d="M${num(dwLeft(236) + 6)} 236Q320 231 ${num(dwRight(236) - 6)} 236M${num(dwLeft(218) + 4)} 218Q330 215 ${num(dwRight(218) - 4)} 218" fill="none" stroke="${SNOW.shade}" stroke-width="1.6" opacity=".7"/>`;
  s += flakes(rnd, 36, [0, 0, 640, 360], 0.8);
  // night: dim the scene, then relight the windows
  s += `<rect width="640" height="360" fill="#04060A" opacity=".46"/>`;
  s += `<g transform="translate(${DW.house[0]} ${DW.house[1]})">${houseAGlow(id)}${HOUSE_A_LIGHTS}</g>`;
  // tripod work light throwing a soft cone onto the working face
  s += `<path d="M${lamp[0] - 8} ${lamp[1] - 4}L${lamp[0] - 4} ${lamp[1] + 10}L312 318L196 276Z" fill="url(#cn-${id})" filter="url(#bl-${id})"/>`;
  s += `<ellipse cx="300" cy="${cut + 16}" rx="118" ry="26" fill="url(#pl-${id})"/>`;
  s += flakes(rnd, 30, [220, 214, 450, 320], 1.3);
  s += `<path d="M${lamp[0] + 8} ${lamp[1] + 8}V292M${lamp[0] + 8} 274L${lamp[0] - 6} 298M${lamp[0] + 8} 274L${lamp[0] + 22} 298M${lamp[0] + 8} 274V300" stroke="${SNOW.house}" stroke-width="3" stroke-linecap="round"/>`;
  s += `<g transform="translate(${lamp[0] + 4} ${lamp[1]}) rotate(-20)"><rect x="-11" y="-8" width="22" height="15" rx="3" fill="${SNOW.house}"/><rect x="-13" y="-6" width="4" height="11" rx="1.5" fill="#F4F7FB"/></g>`;
  s += `<circle cx="${lamp[0] - 10}" cy="${lamp[1] + 4}" r="28" fill="url(#hl-${id})"/>`;
  s += grainLayer(id) + snowChrome(id);
  return doc(640, 360, 'Placeholder illustration for Clear Path Snow Removal: a driveway being cleared at night, a tripod work light casting a soft cone over the working face', defs, s);
}

/* ---- 02: walkway to the front door ---- */

/** Points along a cubic curve with a tapering, mostly horizontal cross-section. */
function ribbon(p0, c1, c2, p3, w0, w1, n) {
  const L = [];
  const R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    const at = (k) => mt * mt * mt * p0[k] + 3 * mt * mt * t * c1[k] + 3 * mt * t * t * c2[k] + t * t * t * p3[k];
    const dv = (k) => 3 * mt * mt * (c1[k] - p0[k]) + 6 * mt * t * (c2[k] - c1[k]) + 3 * t * t * (p3[k] - c2[k]);
    const pt = [at(0), at(1)];
    const len = Math.hypot(dv(0), dv(1)) || 1;
    const nrm = [-dv(1) / len, dv(0) / len];
    const nx = [Math.sign(nrm[0]) || 1, nrm[1] * 0.25];
    const w = lerp(w0, w1, t * t * 0.4 + t * 0.6) / 2;
    L.push(add(pt, mul(nx, -w)));
    R.push(add(pt, mul(nx, w)));
  }
  return { L, R };
}

function snowWalkway(id, rnd) {
  const hy = 226;
  let s = sky(id, hy) + treeline(rnd, hy - 4, 16) + ground(id, hy);
  s += pine(128, 232, 1.35) + pine(540, 230, 1.1);
  s += houseB(id, 320, 232, 1, { l: 1, r: 1, door: 1 });
  s += shrub(210, 234, 36, 15) + shrub(262, 236, 22, 11) + shrub(386, 236, 24, 11) + shrub(434, 234, 38, 15);
  s += `<path d="M290 232H350L356 242H284Z" fill="${SNOW.edge}"/>`; // stoop
  // winding walkway: lighter cut edge, asphalt-dark slab, control joints
  const rb = ribbon([320, 242], [322, 282], [246, 292], [258, 364], 46, 196, 16);
  s += `<path d="${poly(rb.L.concat(rb.R.slice().reverse()))}" fill="${SNOW.edge}"/>`;
  const inner = rb.L.map((p, i) => lerpP(p, rb.R[i], 0.04)).concat(rb.R.map((p, i) => lerpP(p, rb.L[i], 0.04)).reverse());
  s += `<path d="${poly(inner)}" fill="${SNOW.asphalt}"/>`;
  let j = '';
  for (const i of [2, 4, 6, 9, 12]) j += 'M' + P(lerpP(rb.L[i], rb.R[i], 0.05)) + 'L' + P(lerpP(rb.L[i], rb.R[i], 0.95));
  s += `<path d="${j}" stroke="${SNOW.joint}" stroke-width="2"/>`;
  s += bank(rb.L, -1, 3, 22, 8, 60, rnd) + bank(rb.R, 1, 3, 20, 8, 60, rnd); // shovelled ridges
  s += flakes(rnd, 62) + grainLayer(id) + snowChrome(id);
  return doc(640, 360, 'Placeholder illustration for Clear Path Snow Removal: a cleared walkway winding through the snow to a lit front door', snowDefs(id, hy, rnd), s);
}

/* ---- 03: front steps ---- */

function snowSteps(id, rnd) {
  const H = SNOW.house;
  const hy = 238;
  let s = `<rect width="640" height="360" fill="${H}"/>`;
  let sd = '';
  for (let y = 12; y < hy; y += 14) sd += `M0 ${y}H640`;
  s += `<path d="${sd}" stroke="#141821" stroke-width="2"/>`; // lap siding
  // lit window (left)
  s += `<ellipse cx="150" cy="120" rx="84" ry="64" fill="url(#gw-${id})"/>`;
  s += `<rect x="112" y="78" width="76" height="84" fill="#151920"/><rect x="118" y="84" width="64" height="72" fill="${SNOW.warm}"/>`;
  s += `<path d="M150 84V156M118 120H182" stroke="${H}" stroke-width="4"/>`;
  s += `<path d="M108 164H192" stroke="${SNOW.snow}" stroke-width="5" stroke-linecap="round"/>`;
  // door with an arched lite under a snowy canopy
  s += `<rect x="270" y="62" width="100" height="148" fill="#151920"/><rect x="282" y="72" width="76" height="138" fill="${SNOW.door}"/>`;
  s += `<path d="M292 130H348V198H292Z" fill="none" stroke="#0F1218" stroke-width="3"/>`;
  s += `<ellipse cx="320" cy="112" rx="40" ry="30" fill="url(#gw-${id})"/>`;
  s += `<path d="M294 118A26 26 0 0 1 346 118Z" fill="${SNOW.warm}"/>`;
  s += `<path d="M320 92V118M302 100L320 118L338 100" fill="none" stroke="${SNOW.door}" stroke-width="2.5"/>`;
  s += `<path d="M248 62L320 26L392 62Z" fill="#12161D"/>`;
  s += `<path d="M241 65Q239 58 246 56L320 18L394 56Q401 58 399 65Q392 67 386 62L320 30L254 62Q248 67 241 65Z" fill="${SNOW.snow}"/>`;
  // wall lantern (right)
  s += `<circle cx="428" cy="112" r="36" fill="url(#gw-${id})"/>`;
  s += `<path d="M420 100H436L433 126H423Z" fill="${SNOW.warm}"/>`;
  s += `<path d="M417 100H439M421 126H435M428 90V100" stroke="${H}" stroke-width="3" stroke-linecap="round"/>`;
  s += `<path d="M418 98Q428 90 438 98" fill="none" stroke="${SNOW.snow}" stroke-width="3" stroke-linecap="round"/>`;
  // snow drifted against the foundation, shrubs
  s += `<path d="M0 ${hy}C60 ${hy - 8} 140 ${hy - 4} 200 ${hy + 2}H440C500 ${hy - 4} 580 ${hy - 8} 640 ${hy}V360H0Z" fill="url(#gd-${id})"/>`;
  s += shrub(86, 248, 52, 19) + shrub(160, 252, 28, 12) + shrub(480, 252, 28, 12) + shrub(556, 248, 54, 19);
  // stoop: landing + three steps, cleared treads with a lighter nosing
  const steps = [
    [206, 214, 236, 252, 388],
    [236, 246, 270, 238, 402],
    [270, 282, 308, 222, 418],
    [308, 322, 350, 204, 436],
  ];
  let tread = '';
  let riser = '';
  let nose = '';
  for (const [t, b, r, l, rt] of steps) {
    tread += `M${l} ${t}H${rt}V${b}H${l}Z`;
    riser += `M${l} ${b}H${rt}V${r}H${l}Z`;
    nose += `M${l} ${b}H${rt}`;
  }
  s += `<path d="${tread}" fill="${SNOW.asphalt}"/><path d="${riser}" fill="${SNOW.riser}"/>`;
  s += `<path d="${nose}" stroke="${SNOW.edge}" stroke-width="3"/>`;
  s += `<path d="M204 350H436L476 360H164Z" fill="${SNOW.asphalt}"/>`; // walk continues
  // railings: dark metal, snow riding on the rails and capping the posts
  let metal = '';
  let bal = '';
  let snow = '';
  for (const side of [-1, 1]) {
    const X = (v) => 320 + side * (320 - v);
    const bot = [X(212), 266];
    const top = [X(255), 150];
    metal += `M${X(212)} 350V${bot[1]}M${X(255)} 206V${top[1]}M${P(bot)}L${P(top)}`;
    const railY = (x) => bot[1] + ((X(x) - bot[0]) * (top[1] - bot[1])) / (top[0] - bot[0]);
    for (const [x, foot] of [
      [218, 308],
      [230, 270],
      [244, 236],
    ]) {
      bal += `M${X(x)} ${num(railY(x))}V${foot}`;
    }
    snow += `M${P(add(bot, [0, -5]))}L${P(add(top, [0, -5]))}`;
    snow += `M${X(212) - 8} ${bot[1] - 3}Q${X(212)} ${bot[1] - 16} ${X(212) + 8} ${bot[1] - 3}Z`;
    snow += `M${X(255) - 7} ${top[1] - 3}Q${X(255)} ${top[1] - 14} ${X(255) + 7} ${top[1] - 3}Z`;
  }
  s += `<path d="${bal}" stroke="${SNOW.metal}" stroke-width="3"/>`;
  s += `<path d="${metal}" fill="none" stroke="${SNOW.metal}" stroke-width="7" stroke-linecap="round"/>`;
  s += `<path d="${snow}" fill="${SNOW.snow}" stroke="${SNOW.snow}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += flakes(rnd, 58) + grainLayer(id) + snowChrome(id);
  return doc(640, 360, 'Placeholder illustration for Clear Path Snow Removal: cleared front steps with snow resting on the railings, lit door behind', snowDefs(id, hy, rnd), s);
}

/* ---- 04: sidewalk along the property ---- */

function snowSidewalk(id, rnd) {
  const hy = 148;
  const VP = [950, 146];
  const line = (y0) => (x) => [x, y0 + ((VP[1] - y0) * (x + 10)) / (VP[0] + 10)];
  const scale = (x) => (VP[0] - x) / (VP[0] + 10);
  const near = line(320);
  const far = line(244);
  const fence = line(226);
  const xs = [];
  for (let x = -10; x <= 650; x += 22) xs.push(x);
  let s = sky(id, hy) + treeline(rnd, hy + 2, 16) + ground(id, hy);
  s += pine(84, 190, 1.2) + pine(560, 166, 0.6) + pine(604, 162, 0.48);
  s += houseB(id, 300, 188, 0.56, { l: 1, r: 1, door: 0 });
  s += shrub(230, 189, 24, 8) + shrub(372, 189, 24, 8);
  // split-rail fence along the property line, receding with the walk
  let posts = '';
  let caps = '';
  for (let d = 0; d < 40; d++) {
    const x = VP[0] - (VP[0] + 10) / (1 + d / 2.2);
    if (x > 650) break;
    const [px, py] = fence(x);
    const k = scale(x);
    posts += `M${num(px)} ${num(py)}V${num(py - 34 * k)}`;
    caps += `M${num(px - 4 * k)} ${num(py - 34 * k)}Q${num(px)} ${num(py - 40 * k)} ${num(px + 4 * k)} ${num(py - 34 * k)}Z`;
  }
  const rail = (h) => `M${P(add(fence(-10), [0, -h]))}L${P(add(fence(650), [0, -h * scale(650)]))}`;
  s += `<path d="${posts}" stroke="${SNOW.house}" stroke-width="4"/>`;
  s += `<path d="${rail(14) + rail(28)}" stroke="${SNOW.house}" stroke-width="3"/>`;
  s += `<path d="${rail(31)}" stroke="${SNOW.snow}" stroke-width="3" stroke-linecap="round"/>`;
  s += `<path d="${caps}" fill="${SNOW.snow}"/>`;
  // sidewalk: lighter cut edges, slab, control joints
  s += `<path d="${poly([far(-10), far(650), near(650), near(-10)])}" fill="${SNOW.edge}"/>`;
  s += `<path d="${poly([add(far(-10), [0, 3]), add(far(650), [0, 1]), add(near(650), [0, -1]), add(near(-10), [0, -3])])}" fill="${SNOW.asphalt}"/>`;
  let jt = '';
  for (let d = 1; d < 30; d++) {
    const x = VP[0] - (VP[0] + 10) / (1 + d / 1.6);
    if (x > 640) break;
    jt += `M${P(add(near(x), [0, -2]))}L${P(add(far(x + 10 * scale(x)), [0, 2]))}`;
  }
  s += `<path d="${jt}" stroke="${SNOW.edge}" stroke-width="1.6"/>`;
  // shovelled ridge on the yard side
  const farPts = xs.map(far);
  const ridge = lumpy(farPts, rnd, 0.3, ([x, y], t, b) => [x, y - 8 * scale(x) * b]);
  s += `<path d="M${farPts.map(P).join('L')}L${P(ridge[ridge.length - 1])}${smooth(ridge.slice().reverse())}Z" fill="${SNOW.snow}"/>`;
  s += `<path d="M${farPts.map(P).join('L')}" fill="none" stroke="${SNOW.shade}" stroke-width="2"/>`;
  // plow bank on the street side, street at the bottom
  const nearPts = xs.map(near);
  const top = lumpy(nearPts, rnd, 0.25, ([x, y], t, b) => [x, y + 6 * scale(x) - 13 * scale(x) * b]);
  const foot = nearPts.map(([x, y]) => [x, y + 30 * scale(x)]);
  const mid = top.map((p, i) => lerpP(p, foot[i], 0.45));
  s += `<path d="M${P(foot[0])}L${P(foot[foot.length - 1])}L650 360H-10Z" fill="#1B1F26"/>`;
  s += `<path d="M${P(top[0])}${smooth(top)}L${foot.slice().reverse().map(P).join('L')}Z" fill="${SNOW.shade}"/>`;
  s += `<path d="M${P(top[0])}${smooth(top)}L${mid.slice().reverse().map(P).join('L')}Z" fill="${SNOW.snow}"/>`;
  s += flakes(rnd, 60) + grainLayer(id) + snowChrome(id);
  return doc(640, 360, 'Placeholder illustration for Clear Path Snow Removal: a cleared sidewalk running along a snowy property with a plowed snowbank edge', snowDefs(id, hy, rnd), s);
}

const SNOW_SHOTS = [snowDriveway, snowWalkway, snowSteps, snowSidewalk, snowBeforeAfter, snowNight];

/* ======================================================= people + misc */

/**
 * Friendly standing figure, feet at (0,0), drawn in one colour.
 * p: { h, kid, hair: 'bob'|'pony'|'hat', handL, handR } (hands in local coords).
 */
function person(p, col) {
  const H = p.h;
  const kid = !!p.kid;
  const r = H * (kid ? 0.105 : 0.078); // head radius
  const hc = -H + r; // head centre
  const ys = hc + r + H * (kid ? 0.035 : 0.045); // shoulder line
  const sw = H * (kid ? 0.15 : 0.14); // shoulder half-width
  const yh = -H * (kid ? 0.4 : 0.46); // hip line
  const hw = H * (kid ? 0.125 : 0.108);
  const rr = H * (kid ? 0.07 : 0.06);
  const aw = H * (kid ? 0.072 : 0.058); // arm thickness
  const lw = H * (kid ? 0.095 : 0.082); // leg thickness
  const lx = H * (kid ? 0.052 : 0.05); // leg offset
  const shL = [-(sw - aw * 0.55), ys + aw * 0.55];
  const shR = [sw - aw * 0.55, ys + aw * 0.55];
  const handL = p.handL || [-(sw + H * 0.012), -H * (kid ? 0.36 : 0.42)];
  const handR = p.handR || [sw + H * 0.012, -H * (kid ? 0.36 : 0.42)];
  let f = `<circle cy="${num(hc)}" r="${num(r)}"/>`;
  f += `<rect x="${num(-r * 0.42)}" y="${num(hc + r * 0.5)}" width="${num(r * 0.84)}" height="${num(ys - hc - r * 0.5 + 4)}"/>`;
  f += `<path d="M${num(-sw + rr)} ${num(ys)}H${num(sw - rr)}Q${num(sw)} ${num(ys)} ${num(sw)} ${num(ys + rr)}L${num(hw)} ${num(yh)}H${num(-hw)}L${num(-sw)} ${num(ys + rr)}Q${num(-sw)} ${num(ys)} ${num(-sw + rr)} ${num(ys)}Z"/>`;
  if (p.hair === 'bob') {
    const R = r * 1.14;
    f += `<path d="M${num(-R)} ${num(hc)}A${num(R)} ${num(R)} 0 0 1 ${num(R)} ${num(hc)}V${num(hc + r * 1.2)}Q${num(R)} ${num(hc + r * 1.55)} ${num(R * 0.62)} ${num(hc + r * 1.5)}H${num(-R * 0.62)}Q${num(-R)} ${num(hc + r * 1.55)} ${num(-R)} ${num(hc + r * 1.2)}Z"/>`;
  }
  if (p.hair === 'pony') {
    f += `<ellipse cx="${num(r * 1.02)}" cy="${num(hc - r * 0.05)}" rx="${num(r * 0.42)}" ry="${num(r * 0.72)}" transform="rotate(-24 ${num(r * 1.02)} ${num(hc - r * 0.05)})"/>`;
  }
  if (p.hair === 'hat') {
    const R = r * 1.06;
    f += `<path d="M${num(-R)} ${num(hc - r * 0.08)}A${num(R)} ${num(R * 1.02)} 0 0 1 ${num(R)} ${num(hc - r * 0.08)}Z"/>`;
    f += `<rect x="${num(-r * 1.42)}" y="${num(hc - r * 0.2)}" width="${num(r * 2.84)}" height="${num(r * 0.3)}" rx="${num(r * 0.12)}"/>`;
  }
  const arms = `M${P(shL)}L${P(handL)}M${P(shR)}L${P(handR)}`;
  const legs = `M${num(-lx)} ${num(yh)}L${num(-lx * 1.05)} ${num(-lw / 2)}M${num(lx)} ${num(yh)}L${num(lx * 1.05)} ${num(-lw / 2)}`;
  return (
    `<g fill="${col}">${f}</g>` +
    `<path d="${arms}" fill="none" stroke="${col}" stroke-width="${num(aw)}" stroke-linecap="round"/>` +
    `<path d="${legs}" fill="none" stroke="${col}" stroke-width="${num(lw)}" stroke-linecap="round"/>`
  );
}

/** Shoulder point of a figure (local coords) for placing another figure's hand. */
function shoulderOf(p, side) {
  const H = p.h;
  const kid = !!p.kid;
  const r = H * (kid ? 0.105 : 0.078);
  const ys = -H + 2 * r + H * (kid ? 0.035 : 0.045);
  const sw = H * (kid ? 0.15 : 0.14);
  return [side * sw * 0.72, ys + 1];
}

/** Figure with a thin rim light on its upper-right edge. */
function rimmedPerson(p, x, y, extra = '') {
  return (
    `<g transform="translate(${num(x + 3)} ${num(y - 2.4)})">${person(p, DIM)}${extra.replace(/COL/g, DIM)}</g>` +
    `<g transform="translate(${num(x)} ${num(y)})">${person(p, SIL)}${extra.replace(/COL/g, SIL)}</g>`
  );
}

function portrait() {
  const id = 'portrait';
  const rnd = prng(hash('levi-portrait.svg'));
  const bg = graphite(id, 480, 600, rnd);
  const defs =
    bg.defs +
    `<linearGradient id="fd-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset=".72" stop-color="#fff"/><stop offset=".97" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="mk-${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="480" height="600"><rect width="480" height="600" fill="url(#fd-${id})"/></mask>` +
    `<radialGradient id="hl-${id}" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  const head =
    'M240 150C284 150 314 184 314 232C314 262 310 288 298 310C288 330 268 350 240 352C212 350 192 330 182 310C170 288 166 262 166 232C166 184 196 150 240 150Z';
  const ears = 'M170 244C154 242 150 278 174 290ZM310 244C326 242 330 278 306 290Z';
  const body = 'M210 320H270L274 372C302 384 380 396 410 432C440 470 448 540 452 620H28C32 540 40 470 70 432C100 396 178 384 206 372Z';
  const d = head + ears + body;
  let s = bg.body + `<rect width="480" height="600" fill="url(#hl-${id})"/>`;
  s += `<g mask="url(#mk-${id})"><path d="${d}" fill="${DIM}" transform="translate(4 -3)"/><path d="${d}" fill="${SIL}"/></g>`;
  s += cropMarks(480, 600);
  s += `<text x="240" y="62" text-anchor="middle" font-family="${FONT}" font-size="17" letter-spacing="3" fill="${LABEL}">${esc('LEVI · PORTRAIT — REPLACE')}</text>`;
  return doc(480, 600, 'Portrait placeholder: neutral head-and-shoulders silhouette of Levi, to be replaced with a real photo', defs, s);
}

function map() {
  const id = 'map';
  const rnd = prng(hash('map.svg'));
  const defs =
    grainDef(`gr-${id}`, rnd, 0.05) +
    `<radialGradient id="ra-${id}"><stop offset="0" stop-color="${INK}" stop-opacity=".09"/><stop offset="1" stop-color="${INK}" stop-opacity=".02"/></radialGradient>` +
    `<radialGradient id="sh-${id}"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
  let s = `<rect width="640" height="400" fill="#181B22"/>` + grid(640, 400, 0.06);
  // a lake and a river for texture
  s += `<path d="M470 40C520 30 580 52 590 92C598 128 560 150 520 140C486 132 450 104 452 76C453 58 458 44 470 40Z" fill="#20242C"/>`;
  s += `<path d="M-10 318C60 300 120 330 190 322S300 282 360 300 470 356 650 330" fill="none" stroke="#20242C" stroke-width="12" stroke-linecap="round"/>`;
  // roads: one highway and a few secondary roads
  s += `<g fill="none" stroke="#B8BEC8" stroke-linecap="round">`;
  s += `<path d="M-20 136C120 110 230 180 330 170S520 108 660 150" stroke-width="7" opacity=".32"/>`;
  s += `<path d="M150 -20C176 90 120 190 170 270S210 380 196 420" stroke-width="4.5" opacity=".26"/>`;
  s += `<path d="M420 -20C404 80 452 150 430 230S470 360 520 420" stroke-width="4.5" opacity=".26"/>`;
  s += `<path d="M-20 250C100 244 220 228 300 246S520 262 660 240" stroke-width="3" opacity=".2"/>`;
  s += `<path d="M300 40C300 100 340 130 328 200" stroke-width="2.4" opacity=".18"/>`;
  s += '</g>';
  // service radius
  s += `<circle cx="320" cy="196" r="146" fill="url(#ra-${id})"/>`;
  s += `<circle cx="320" cy="196" r="146" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="7 9" stroke-linecap="round"/>`;
  s += `<circle cx="320" cy="196" r="3" fill="${INK}" opacity=".5"/>`;
  // pin with a soft ground shadow
  s += `<ellipse cx="320" cy="200" rx="16" ry="5" fill="url(#sh-${id})"/>`;
  s += `<path d="M320 198C320 198 292 168 292 148A28 28 0 0 1 348 148C348 168 320 198 320 198ZM320 136A12 12 0 1 0 320.1 136Z" fill="${INK}" fill-rule="evenodd"/>`;
  s += `<rect width="640" height="400" filter="url(#gr-${id})"/>`;
  s += `<rect x="150" y="350" width="340" height="30" rx="4" fill="#181B22" opacity=".9"/>`;
  s += cropMarks(640, 400);
  s += `<text x="320" y="370" text-anchor="middle" font-family="${FONT}" font-size="14" letter-spacing="3" fill="${LABEL}">${esc('SERVICE AREA · ~30 MI · PLACEHOLDER')}</text>`;
  return doc(640, 400, 'Service area map placeholder: roughly a 30 mile radius around the home base', defs, s);
}

/** Classic photo glyph (rounded frame, mountain range, sun) for the passion slots. */
function passion(n) {
  const id = `passion${n}`;
  const rnd = prng(hash(`passion-${n}.svg`));
  const bg = graphite(id, 600, 600, rnd);
  const glyph = (x, y, s, r = 0, frameFill = '') =>
    `<g transform="translate(${x} ${y})${r ? ` rotate(${r})` : ''} scale(${s})" fill="none" stroke="${INK}" stroke-width="${num(5.5 / Math.sqrt(s))}" stroke-linecap="round" stroke-linejoin="round">` +
    `<rect x="-120" y="-92" width="240" height="184" rx="18"${frameFill ? ` fill="${frameFill}"` : ''}/>` +
    '<path d="M-100 64L-38 -6L-4 32L40 -22L104 64"/><circle cx="-44" cy="-42" r="18"/></g>';
  let art = '';
  if (n === '01') art = glyph(300, 292, 1.35);
  if (n === '02') art = `<g opacity=".35">${glyph(236, 262, 0.95, -8)}</g>` + glyph(262, 280, 0.95, 4, '#1C1F26');
  if (n === '03') art = glyph(418, 214, 0.52) + focusBrackets(418, 214, 0.52 * 120 + 22, 0.52 * 92 + 20);
  const defs = bg.defs + scrimDefs(id);
  const body =
    bg.body + art + scrims(id, 600, 600, 70, 100) + cropMarks(600, 600) + topLabel('PLACEHOLDER — REPLACE') + bottomLabel(`OFF THE CLOCK · ${n}`, 600);
  return doc(600, 600, `Placeholder for a personal photo of Levi off the clock, slot ${n}`, defs, body);
}

function family() {
  const id = 'family';
  const rnd = prng(hash('family-01.svg'));
  const k = 900 / 640;
  const bg = graphite(id, 900, 600, rnd);
  const defs =
    bg.defs +
    scrimDefs(id) +
    `<radialGradient id="sh-${id}"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
  const G = 500;
  // two adults side by side, a kid in front of each; one arm on a shoulder, one hand held
  const A = { x: 404, p: { h: 330 } };
  const B = { x: 488, p: { h: 302, hair: 'bob' } };
  const C = { x: 318, p: { h: 200, kid: true, hair: 'pony' } };
  const D = { x: 574, p: { h: 150, kid: true } };
  const cs = add(shoulderOf(C.p, 1), [C.x - A.x, 0]);
  A.p.handL = [cs[0], cs[1] + 2];
  const meet = [(B.x + D.x) / 2 + 6, G - 150 * 0.52];
  B.p.handR = [meet[0] - B.x, meet[1] - G];
  D.p.handL = [meet[0] - D.x, meet[1] - G + 2];
  let s = bg.body;
  s += `<ellipse cx="446" cy="${G + 4}" rx="250" ry="24" fill="url(#sh-${id})"/>`;
  s += `<path d="M60 ${G}H840" stroke="${DIM}" stroke-dasharray="1 6" opacity=".5"/>`;
  for (const f of [B, A, D, C]) s += rimmedPerson(f.p, f.x, G);
  s += scrims(id, 900, 600, 0, 110) + cropMarks(900, 600, k);
  s += topLabel('PLACEHOLDER — REPLACE', k) + bottomLabel('FAMILY', 600, k);
  return doc(900, 600, 'Family photo placeholder: four neutral silhouettes, two adults and two kids, standing close together', defs, s);
}

function work() {
  const id = 'work';
  const rnd = prng(hash('work-01.svg'));
  const k = 900 / 640;
  const bg = graphite(id, 900, 600, rnd);
  const defs =
    bg.defs +
    scrimDefs(id) +
    `<radialGradient id="sh-${id}"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
  const G = 494;
  let s = bg.body;
  // structure outline: stud wall + roof trusses (line art, behind the figure)
  let fr = 'M430 494V300H790V494M424 494H800M430 312H790M430 482H790';
  for (let x = 430; x <= 790; x += 40) fr += `M${x} 312V482`;
  fr += 'M410 300L610 176L810 300M430 300L610 190L790 300M610 190V300M520 300L610 246L700 300';
  s += `<path d="${fr}" fill="none" stroke="${DIM}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>`;
  s += `<path d="M60 ${G}H840" stroke="${DIM}" stroke-dasharray="1 6" opacity=".5"/>`;
  s += `<ellipse cx="318" cy="${G + 4}" rx="130" ry="16" fill="url(#sh-${id})"/>`;
  // Levi in a hard hat, one hand resting on a planted shovel
  const p = { h: 330, hair: 'hat' };
  const gx = 68; // shovel shaft x (local)
  p.handR = [gx - 6, -236];
  const shovel =
    `<path d="M${gx} -250V-52" fill="none" stroke="COL" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M${gx - 13} -262H${gx + 13}" fill="none" stroke="COL" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M${gx - 16} -56H${gx + 16}L${gx + 13} -8Q${gx} 6 ${gx - 13} -8Z" fill="COL"/>`;
  s += rimmedPerson(p, 290, G, shovel);
  s += scrims(id, 900, 600, 0, 110) + cropMarks(900, 600, k);
  s += topLabel('PLACEHOLDER — REPLACE', k) + bottomLabel('ON THE JOB', 600, k);
  return doc(900, 600, 'On-the-job photo placeholder: silhouette of Levi in a hard hat with a shovel beside a framed structure', defs, s);
}

/* ============================================================ catalogue */

const SERVICES = [
  { id: 'snow', name: 'Clear Path Snow Removal' },
  { id: 'demolition', name: 'Demolition', icon: iconDemolition, what: 'sledgehammer', detail: [2.2, 36, -52], build: -12, spark: [94, -96] },
  { id: 'framing', name: 'Framing & Carpentry', icon: iconFraming, what: 'stud wall and framing square', detail: [2.1, 40, 30], build: -20 },
  { id: 'drywall', name: 'Drywall & Paint', icon: iconDrywall, what: 'paint roller', detail: [2.2, -8, -40], build: -30 },
  { id: 'decks', name: 'Decks & Fencing', icon: iconDecks, what: 'deck boards and fence pickets', detail: [2.2, -30, -34], build: -6 },
  { id: 'flooring', name: 'Flooring & Tile', icon: iconFlooring, what: 'herringbone floor', detail: [2.7, 24, 8], build: -8 },
  { id: 'kitchen', name: 'Kitchen & Bath', icon: iconKitchen, what: 'faucet over a sink', detail: [2.1, 8, -36], build: -6 },
  { id: 'roofing', name: 'Roofing & Gutters', icon: iconRoofing, what: 'shingled roof with gutter', detail: [2.1, 58, -22], build: -28 },
  { id: 'concrete', name: 'Concrete & Masonry', icon: iconConcrete, what: 'trowel and brick courses', detail: [2.1, -22, 4], build: 12 },
];

function buildAll() {
  const out = [];
  for (const svc of SERVICES) {
    for (let i = 0; i < 6; i++) {
      const n = String(i + 1).padStart(2, '0');
      const file = `${svc.id}-${n}.svg`;
      const id = `${svc.id}${n}`;
      const rnd = prng(hash(file));
      const svg = svc.id === 'snow' ? SNOW_SHOTS[i](id, rnd) : iconShot(svc, SHOTS[i], id, rnd);
      out.push({ rel: `projects/${file}`, svg });
    }
  }
  for (const item of WOODSHOP) {
    const file = `woodshop-${item.n}.svg`;
    out.push({ rel: `projects/${file}`, svg: woodshopShot(item, `wood${item.n}`, prng(hash(file))) });
  }
  out.push({ rel: 'photos/levi-portrait.svg', svg: portrait() });
  for (const n of ['01', '02', '03']) out.push({ rel: `photos/passion-${n}.svg`, svg: passion(n) });
  out.push({ rel: 'photos/family-01.svg', svg: family() });
  out.push({ rel: 'photos/work-01.svg', svg: work() });
  out.push({ rel: 'map.svg', svg: map() });
  return out;
}

const RETIRED = [...Array.from({ length: 9 }, (_, i) => `projects/proj-0${i + 1}.svg`), 'projects/portrait.svg', 'projects/map.svg'];

/* ============================================================ validation */

/**
 * Minimal zero-dependency well-formedness check: tokenises tags, checks
 * nesting, a single root, duplicate attributes, stray markup characters,
 * entity escaping, local id references, root attributes and the size budget.
 */
function validate(svg) {
  const errs = [];
  if (!svg.startsWith('<svg')) errs.push('does not start with <svg');
  if (!svg.endsWith('</svg>')) errs.push('does not end with </svg>');
  const badAmp = svg.match(/&(?!(?:amp|lt|gt|quot|apos);|#\d+;|#x[0-9a-fA-F]+;)/);
  if (badAmp) errs.push(`unescaped & at offset ${badAmp.index}`);
  const tagRe = /<!--[\s\S]*?-->|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[A-Za-z_][\w:.-]*\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  const stack = [];
  let last = 0;
  let roots = 0;
  let m;
  while ((m = tagRe.exec(svg))) {
    if (/[<>]/.test(svg.slice(last, m.index))) errs.push(`stray markup before offset ${m.index}`);
    last = tagRe.lastIndex;
    if (m[0].startsWith('<!--')) continue;
    const [, close, name, attrs, selfClose] = m;
    if (/</.test(attrs)) errs.push(`'<' inside attributes of <${name}>`);
    const seen = new Set();
    for (const a of attrs.matchAll(/([A-Za-z_][\w:.-]*)\s*=/g)) {
      if (seen.has(a[1])) errs.push(`duplicate attribute ${a[1]} on <${name}>`);
      seen.add(a[1]);
    }
    if (close) {
      const open = stack.pop();
      if (open !== name) errs.push(`</${name}> closes <${open}>`);
      if (!stack.length) roots++;
    } else if (selfClose) {
      if (!stack.length) roots++;
    } else {
      if (!stack.length && roots) errs.push('content after the root element');
      stack.push(name);
    }
  }
  if (/[<>]/.test(svg.slice(last))) errs.push('stray markup at end');
  if (stack.length) errs.push(`unclosed <${stack.join('>, <')}>`);
  if (roots !== 1) errs.push(`expected one root element, found ${roots}`);
  const ids = new Set();
  for (const a of svg.matchAll(/\sid="([^"]+)"/g)) {
    if (ids.has(a[1])) errs.push(`duplicate id ${a[1]}`);
    ids.add(a[1]);
  }
  for (const a of svg.matchAll(/url\(#([^)]+)\)/g)) if (!ids.has(a[1])) errs.push(`url(#${a[1]}) is not defined`);
  for (const a of svg.matchAll(/href="#([^"]+)"/g)) if (!ids.has(a[1])) errs.push(`href #${a[1]} is not defined`);
  const root = svg.slice(0, svg.indexOf('>') + 1);
  for (const attr of ['xmlns="http://www.w3.org/2000/svg"', 'viewBox="0 0 ', 'width="', 'height="', 'role="img"', 'aria-label="']) {
    if (!root.includes(attr)) errs.push(`root is missing ${attr}`);
  }
  const bytes = Buffer.byteLength(svg, 'utf8');
  if (bytes >= MAX_BYTES) errs.push(`${bytes} bytes exceeds the ${MAX_BYTES}-byte budget`);
  return errs;
}

/* ================================================================== main */

function main() {
  const files = buildAll();

  // 1. validate everything in memory before touching the disk
  let failed = 0;
  for (const f of files) {
    const errs = validate(f.svg);
    if (errs.length) {
      failed++;
      console.error(`x ${f.rel}\n  - ${errs.join('\n  - ')}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} file(s) failed validation; nothing was written.`);
    process.exit(1);
  }

  // 2. write (skip files whose bytes are already identical)
  let written = 0;
  for (const f of files) {
    const abs = path.join(ASSETS, f.rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const prev = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    if (prev !== f.svg) {
      fs.writeFileSync(abs, f.svg, 'utf8');
      written++;
    }
  }

  // 3. read everything back, then retire the old placeholders
  for (const f of files) {
    if (fs.readFileSync(path.join(ASSETS, f.rel), 'utf8') !== f.svg) {
      console.error(`x ${f.rel} did not round-trip; retired files left in place.`);
      process.exit(1);
    }
  }
  const removed = [];
  for (const rel of RETIRED) {
    const abs = path.join(ASSETS, rel);
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
      removed.push(rel);
    }
  }

  // 4. summary
  const sizes = files.map((f) => ({ rel: f.rel, bytes: Buffer.byteLength(f.svg, 'utf8') }));
  const max = sizes.reduce((a, b) => (b.bytes > a.bytes ? b : a));
  const total = sizes.reduce((a, b) => a + b.bytes, 0);
  const groups = {};
  for (const s of sizes) {
    const key = s.rel.replace(/^(projects\/\w+)-\d+\.svg$/, '$1-NN.svg');
    (groups[key] = groups[key] || []).push(s.bytes);
  }
  const kb = (b) => (b / 1024).toFixed(1) + ' KB';
  console.log('placeholder assets -> public/assets/');
  for (const [key, list] of Object.entries(groups)) {
    const lo = Math.min(...list);
    const hi = Math.max(...list);
    console.log(`  ${key.padEnd(30)} ${String(list.length).padStart(2)} file(s)  ${(lo === hi ? kb(hi) : `${kb(lo)} - ${kb(hi)}`).padStart(17)}`);
  }
  console.log(`  ${files.length} files valid; ${written} written, ${files.length - written} unchanged; total ${(total / 1024).toFixed(1)} KB`);
  console.log(`  largest: ${max.rel} (${max.bytes} B; limit ${MAX_BYTES} B)`);
  console.log(removed.length ? `  removed retired: ${removed.join(', ')}` : '  retired files: none left to remove');
}

main();
