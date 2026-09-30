#!/usr/bin/env node
/**
 * tools/gen-placeholders.js
 *
 * Zero-dependency generator for the site's neutral placeholder imagery.
 *
 *   node tools/gen-placeholders.js
 *
 * Writes
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
 * The service and Woodshop galleries use photo placeholders instead (rendered on the
 * GPU box, stamped PLACEHOLDER: tools/assets/make_placeholder_jobs.py); running this
 * removes the old line drawings for them (see RETIRED).
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
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];

/** XML-escape text and attribute values. */
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/* ======================================================== shared chrome */

const FONT = "'IBM Plex Mono', ui-monospace, monospace";
const INK = '#D5D9E0'; // icon strokes
const LABEL = '#9AA0AC'; // primary caption
const DIM = '#6E7482'; // secondary caption, crop marks, rims
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

function buildAll() {
  const out = [];
  out.push({ rel: 'photos/levi-portrait.svg', svg: portrait() });
  for (const n of ['01', '02', '03']) out.push({ rel: `photos/passion-${n}.svg`, svg: passion(n) });
  out.push({ rel: 'photos/family-01.svg', svg: family() });
  out.push({ rel: 'photos/work-01.svg', svg: work() });
  out.push({ rel: 'map.svg', svg: map() });
  return out;
}

// Files this script used to write. The service and Woodshop line drawings were replaced by
// photo placeholders (tools/assets/make_placeholder_jobs.py → assets/projects/*.webp).
const SERVICE_IDS = ['demolition', 'framing', 'drywall', 'decks', 'flooring', 'kitchen', 'roofing', 'concrete', 'snow'];
const RETIRED = [
  ...Array.from({ length: 9 }, (_, i) => `projects/proj-0${i + 1}.svg`), 'projects/portrait.svg', 'projects/map.svg',
  ...SERVICE_IDS.flatMap((id) => Array.from({ length: 6 }, (_, i) => `projects/${id}-0${i + 1}.svg`)),
  ...Array.from({ length: 5 }, (_, i) => `projects/woodshop-0${i + 1}.svg`),
];

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
