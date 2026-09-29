/**
 * qr.js — a small, dependency-free QR Code encoder (ISO/IEC 18004) for browsers and Node.
 *
 *   qrMatrix(text, opts) → { version, ecc, mask, size, modules }   modules[row][col], true = dark
 *   qrSvg(text, opts)    → '<svg …>' markup with a quiet zone; size it with CSS
 *
 * Byte mode only (text → UTF-8, no ECI header), versions 1–20, ECC levels L/M/Q/H. Masks are
 * scored with N1=3, N2=3, N3=40, N4=10 before format/version info is written (those modules, and
 * the dark module, count as light); the lowest score wins, ties → lowest mask number.
 * Verified cell-for-cell against segno 1.6.6. Note: stock segno inserts an extra 0x00 pad
 * codeword when the bit stream is already byte-aligned; this module follows §7.4.10 instead.
 */

const MAX_VERSION = 20;
const LEVELS = ['L', 'M', 'Q', 'H'];
const FORMAT_LEVEL_BITS = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

// Total codewords (data + error correction) for versions 1–20.
const TOTAL_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085];

// Error-correction codewords per block, and number of blocks, for versions 1–20.
const ECC_PER_BLOCK = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28],
};
const NUM_BLOCKS = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25],
};

// Alignment pattern centre coordinates (Annex E) for versions 1–6, 7–13 and 14–20.
const ALIGNMENT = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
  [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
];

// Data mask conditions (Table 10); r = row, c = column. true = flip the module.
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// ---- capacity --------------------------------------------------------------------------------

const countBits = (v) => (v < 10 ? 8 : 16); // byte-mode character count indicator length
const dataCodewords = (v, ecc) => TOTAL_CODEWORDS[v - 1] - ECC_PER_BLOCK[ecc][v - 1] * NUM_BLOCKS[ecc][v - 1];
const maxBytes = (v, ecc) => Math.floor((dataCodewords(v, ecc) * 8 - 4 - countBits(v)) / 8);

// ---- text → UTF-8 bytes ----------------------------------------------------------------------

function utf8(text) {
  if (typeof TextEncoder === 'function') return Array.from(new TextEncoder().encode(text));
  const out = [];
  for (const ch of text) {
    let cp = ch.codePointAt(0);
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd; // lone surrogate → U+FFFD, like TextEncoder
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}

// ---- Reed–Solomon over GF(256), primitive polynomial x^8+x^4+x^3+x^2+1 ------------------------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++, x = (x << 1) ^ (x & 0x80 ? 0x11d : 0)) {
  EXP[i] = EXP[i + 255] = x;
  LOG[x] = i;
}
const gfMul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

// Generator polynomial ∏(x − α^i), i = 0 … degree−1; coefficients highest power first.
function rsGenerator(degree) {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const next = g.concat(0); // g·x
    for (let j = 0; j < g.length; j++) next[j + 1] ^= gfMul(g[j], EXP[i]); // + g·α^i
    g = next;
  }
  return g;
}

// Remainder of data(x)·x^n divided by the generator: the n error-correction codewords.
function rsRemainder(data, gen) {
  const rem = new Array(gen.length - 1).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < rem.length; i++) rem[i] ^= gfMul(gen[i + 1], factor);
  }
  return rem;
}

// ---- codewords ---------------------------------------------------------------------------------

// Mode indicator, count, data, terminator, bit padding and 0xEC/0x11 pad codewords (§7.4).
function encodeData(bytes, version, ecc) {
  const capacity = dataCodewords(version, ecc) * 8;
  const bits = [];
  const put = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  put(0b0100, 4); // byte mode
  put(bytes.length, countBits(version));
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, capacity - bits.length)); // terminator, truncated if the symbol is full
  put(0, (8 - (bits.length % 8)) % 8); // zero bits up to the next codeword boundary (if any)
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; data.length < capacity / 8; pad ^= 0xec ^ 0x11) data.push(pad);
  return data;
}

// Split into blocks (group 1 short, group 2 one codeword longer), add ECC, interleave (§7.5–7.6).
function addErrorCorrection(data, version, ecc) {
  const numBlocks = NUM_BLOCKS[ecc][version - 1];
  const eccLen = ECC_PER_BLOCK[ecc][version - 1];
  const total = TOTAL_CODEWORDS[version - 1];
  const shortBlocks = numBlocks - (total % numBlocks);
  const shortLen = Math.floor(total / numBlocks) - eccLen; // data codewords in a group-1 block
  const gen = rsGenerator(eccLen);
  const blocks = [];
  for (let b = 0, pos = 0; b < numBlocks; b++) {
    const len = shortLen + (b < shortBlocks ? 0 : 1);
    const block = data.slice(pos, pos + len);
    pos += len;
    blocks.push({ data: block, ecc: rsRemainder(block, gen) });
  }
  const out = [];
  for (let i = 0; i <= shortLen; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < eccLen; i++) for (const b of blocks) out.push(b.ecc[i]);
  return out;
}

// ---- format & version information -------------------------------------------------------------

// Cells for format bits 0–14: first copy around the top-left finder, then the split second copy.
function formatCells(size) {
  const cells = [];
  for (let i = 0; i < 15; i++) cells.push(i < 6 ? [i, 8] : i < 8 ? [i + 1, 8] : i === 8 ? [8, 7] : [8, 14 - i]);
  for (let i = 0; i < 15; i++) cells.push(i < 8 ? [8, size - 1 - i] : [size - 15 + i, 8]);
  return cells; // cell k carries bit k % 15
}

// Cells for version bits 0–17: the 6×3 block top-right and its transpose bottom-left.
function versionCells(size) {
  const cells = [];
  for (let i = 0; i < 18; i++) {
    const a = size - 11 + (i % 3), b = Math.floor(i / 3);
    cells.push([b, a], [a, b]);
  }
  return cells; // cell k carries bit k >> 1
}

function formatBits(ecc, mask) {
  const data = (FORMAT_LEVEL_BITS[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); // BCH(15,5)
  return ((data << 10) | rem) ^ 0x5412;
}

function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25); // BCH(18,6)
  return (version << 12) | rem;
}

// ---- matrix ------------------------------------------------------------------------------------

function functionPatterns(version) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r, c, dark) => { modules[r][c] = dark; reserved[r][c] = true; };

  // Format info, the dark module and version info are reserved (light) until the mask is chosen.
  const info = formatCells(size).concat(version >= 7 ? versionCells(size) : [], [[size - 8, 8]]);
  for (const [r, c] of info) set(r, c, false);

  // Finder patterns with their one-module light separators.
  for (const [r0, c0] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const ring = Math.max(Math.abs(dr - 3), Math.abs(dc - 3)); // 0 = centre … 4 = separator
        set(r, c, ring !== 2 && ring !== 4);
      }
    }
  }

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }

  // Alignment patterns, except the three positions that would overlap a finder.
  const centres = ALIGNMENT[version - 1];
  const last = centres.length - 1;
  centres.forEach((r, i) => centres.forEach((c, j) => {
    if ((i === 0 && (j === 0 || j === last)) || (i === last && j === 0)) return;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }));
  return { size, modules, reserved };
}

// Zigzag placement in two-module columns, right to left, skipping function modules (§7.7.3).
// Modules left over after the last codeword are remainder bits and stay light (0).
function placeData(modules, reserved, codewords) {
  const size = modules.length;
  let bit = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip the vertical timing pattern
    const upward = ((right + 1) & 2) === 0;
    for (let v = 0; v < size; v++) {
      const r = upward ? size - 1 - v : v;
      for (const c of [right, right - 1]) {
        if (reserved[r][c]) continue;
        const byte = codewords[bit >> 3];
        modules[r][c] = byte !== undefined && ((byte >> (7 - (bit & 7))) & 1) === 1;
        bit++;
      }
    }
  }
}

const applyMask = (modules, reserved, mask) =>
  modules.map((row, r) => row.map((dark, c) => (reserved[r][c] ? dark : dark !== MASKS[mask](r, c))));

// ---- mask penalty (§7.8.3, Table 11) -------------------------------------------------------------

// N1: 3 + (n − 5) points for each run of n ≥ 5 same-coloured modules.
function runPenalty(line) {
  let score = 0, run = 1;
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i] === line[i - 1]) run++;
    else { if (run >= 5) score += run - 2; run = 1; }
  }
  return score;
}

// N3: 40 points for each dark:light:dark×3:light:dark pattern with 4 light modules (or the symbol
// edge) before or after it. Scanning resumes after a counted pattern, else where one could overlap.
function finderPenalty(line) {
  const light = (from, to) => line.slice(Math.max(from, 0), to).every((dark) => !dark);
  let score = 0;
  for (let i = 0; i + 7 <= line.length; i++) {
    if (!(line[i] && !line[i + 1] && line[i + 2] && line[i + 3] && line[i + 4] && !line[i + 5] && line[i + 6])) continue;
    if (light(i - 4, i) || light(i + 7, i + 11)) { score += 40; i += 6; } else i += 3;
  }
  return score;
}

function penalty(m) {
  const n = m.length;
  let score = 0, dark = 0;
  for (let i = 0; i < n; i++) {
    const row = m[i];
    const col = m.map((r) => r[i]);
    score += runPenalty(row) + runPenalty(col) + finderPenalty(row) + finderPenalty(col);
    for (let j = 0; j < n; j++) {
      if (row[j]) dark++;
      // N2: 3 points for every 2×2 block of one colour (overlapping blocks all count).
      if (i && j && row[j] === row[j - 1] && row[j] === m[i - 1][j] && row[j] === m[i - 1][j - 1]) score += 3;
    }
  }
  // N4: 10 points for every full 5 % the dark share deviates from 50 %.
  return score + 10 * Math.floor((Math.abs(2 * dark - n * n) * 10) / (n * n));
}

// ---- public API ----------------------------------------------------------------------------------

const checkInt = (name, value, lo, hi) => {
  if (Number.isInteger(value) && value >= lo && value <= hi) return;
  throw new RangeError(`qr: ${name} must be an integer from ${lo} to ${hi} (got ${value})`);
};

export function qrMatrix(text, { ecc = 'M', minVersion = 1, version = null, mask = null } = {}) {
  const level = String(ecc).toUpperCase();
  if (!LEVELS.includes(level)) throw new RangeError(`qr: ecc must be L, M, Q or H (got ${ecc})`);
  if (version != null) checkInt('version', version, 1, MAX_VERSION);
  else checkInt('minVersion', minVersion, 1, MAX_VERSION);
  if (mask != null) checkInt('mask', mask, 0, 7);

  // Smallest version ≥ minVersion that holds the data, unless a version was forced.
  const bytes = utf8(String(text ?? ''));
  let ver = version;
  for (let v = minVersion; ver == null && v <= MAX_VERSION; v++) if (bytes.length <= maxBytes(v, level)) ver = v;
  if (ver == null || bytes.length > maxBytes(ver, level)) {
    const where = version == null ? `any version up to ${MAX_VERSION}` : `version ${version}`;
    const max = maxBytes(ver ?? MAX_VERSION, level);
    throw new Error(`qr: ${bytes.length} bytes of data do not fit ${where} at ECC level ${level} (max ${max} bytes)`);
  }

  const codewords = addErrorCorrection(encodeData(bytes, ver, level), ver, level);
  const { size, modules, reserved } = functionPatterns(ver);
  placeData(modules, reserved, codewords);

  let chosen = mask;
  let masked;
  if (chosen != null) masked = applyMask(modules, reserved, chosen);
  else {
    let best = Infinity;
    for (let m = 0; m < 8; m++) {
      const candidate = applyMask(modules, reserved, m);
      const score = penalty(candidate);
      if (score < best) [best, chosen, masked] = [score, m, candidate];
    }
  }

  const fmt = formatBits(level, chosen);
  for (const [k, [r, c]] of formatCells(size).entries()) masked[r][c] = ((fmt >> (k % 15)) & 1) === 1;
  masked[size - 8][8] = true; // the dark module
  if (ver >= 7) {
    const vb = versionBits(ver);
    for (const [k, [r, c]] of versionCells(size).entries()) masked[r][c] = ((vb >> (k >> 1)) & 1) === 1;
  }
  return { version: ver, ecc: level, mask: chosen, size, modules: masked };
}

export function qrSvg(text, { ecc = 'M', margin = 4, dark = '#000', light = null, title = null, ...opts } = {}) {
  const { size, modules } = qrMatrix(text, { ...opts, ecc });
  const q = Math.max(0, Math.floor(margin) || 0);
  const n = size + 2 * q;
  let d = '';
  modules.forEach((row, r) => {
    for (let c = 0; c < size; c++) {
      if (!row[c]) continue;
      let len = 1;
      while (row[c + len]) len++;
      d += `M${c + q} ${r + q}h${len}v1h-${len}z`; // one rectangle per horizontal run of dark modules
      c += len;
    }
  });
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"` +
    `${title ? ' role="img"' : ''}>` +
    (title ? `<title>${esc(title)}</title>` : '') +
    (light ? `<rect width="${n}" height="${n}" fill="${esc(light)}"/>` : '') +
    `<path fill="${esc(dark)}" d="${d}"/></svg>`
  );
}
