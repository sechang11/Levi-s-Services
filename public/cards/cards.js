/* cards.js — Levi Builds business cards: a front per design, one shared back.

   Everything that gets printed is in CARD below. Replace the [bracketed]
   placeholders and the .example addresses, then re-export the print PDFs:
     node tools/export-cards.js
   The services list and each season's featured job come from the website
   (js/content.js), so the cards stay in step with the site. */
import { QUOTE_TOPICS } from '../js/content.js';
import { qrSvg } from './qr.js';

export const CARD = {
  name: 'Levi [Last Name]',
  role: 'Owner · Builder',
  business: 'Levi Builds',
  phone: '(555) 555-0142',
  email: 'levi@levibuilds.example',
  web: 'levibuilds.example',          // printed on the card
  url: 'https://levibuilds.example',  // what the QR code opens (short URL = bigger, easier-to-scan dots)
  area: 'Serving [Your City] + 30 mi',
  license: '[LIC #000000]',
};

/* One design per season (the art shows that season's headline job) plus a
   year-round Classic. `featured` is highlighted first in the back's list. */
export const DESIGNS = {
  winter: {
    label: 'Winter', art: 'art/winter.jpg', featured: 'snow',
    kicker: 'Clear Path', title: 'Snow Removal', sub: 'Driveways · walkways · steps · sidewalks',
    scene: 'Levi in a Santa hat, clearing a driveway at night.',
  },
  spring: {
    label: 'Spring', art: 'art/spring.jpg', featured: 'concrete',
    kicker: 'Spring thaw', title: 'Concrete & Masonry', sub: 'Walkways · steps · patios · repairs',
    scene: 'Finishing a fresh concrete walkway under the blossoms.',
  },
  summer: {
    label: 'Summer', art: 'art/summer.jpg', featured: 'decks',
    kicker: 'Build season', title: 'Decks & Fencing', sub: 'New decks · rebuilds · privacy fences',
    scene: 'Nailing down a cedar deck at sunset.',
  },
  fall: {
    label: 'Fall', art: 'art/fall.jpg', featured: 'roofing',
    kicker: 'Beat the freeze', title: 'Roofing & Gutters', sub: 'Repairs · re-roofs · seamless gutters',
    scene: 'Hanging a copper gutter before the first freeze.',
  },
  classic: {
    label: 'Classic', art: 'art/classic.png', featured: null,
    kicker: 'Local contractor', title: 'Build. Repair. Renovate.', sub: 'Plus Clear Path snow removal & handmade furniture',
    scene: 'Year-round: a studio portrait on inked navy and gold.',
  },
};
export const DESIGN_ORDER = ['winter', 'spring', 'summer', 'fall', 'classic'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svg = (body, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ICON = {
  phone: svg('<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M5.2 3h3.1l1.8 4.6-2.3 1.5a11.2 11.2 0 0 0 5.1 5.1l1.5-2.3L19 13.7v3.1a2 2 0 0 1-2.1 2A15.7 15.7 0 0 1 3.2 5.1 2 2 0 0 1 5.2 3z"/>'),
  mail: svg('<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></g>'),
  pin: svg('<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21.2s-6.8-6-6.8-11.6a6.8 6.8 0 0 1 13.6 0c0 5.6-6.8 11.6-6.8 11.6z"/><circle cx="12" cy="9.5" r="2.4"/></g>'),
  star: svg('<path fill="currentColor" d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/>'),
};

/* the site's mark: rounded frame, roof line, L */
const MARK = `<svg class="mark" viewBox="0 0 40 40" aria-hidden="true">
  <rect class="mark__frame" x="1.5" y="1.5" width="37" height="37" rx="10"/>
  <path class="mark__roof" d="M9 18.5 20 9.5l11 9"/>
  <path class="mark__l" d="M16.5 16.5V29h10"/></svg>`;
const LOCKUP = `<div class="lockup">${MARK}<span class="lockup__word">LEVI<b>BUILDS</b></span></div>`;

/* Tattoo-etch texture: the site's tattoo tile, inlined and tiled with <use> so
   it stays crisp vector line art in the PDF (a CSS background could rasterize). */
let etchSymbol = '';
export async function loadEtch() {
  try {
    const text = await (await fetch('../assets/tattoo.svg')).text();
    const inner = text.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
      .replace(/(stroke|fill)="#000(?:000)?"/g, '$1="currentColor"');
    etchSymbol = `<symbol id="card-etch" viewBox="0 0 340 340">${inner}</symbol>`;
  } catch { etchSymbol = ''; } // offline file:// preview — the card just skips the texture
}
function etch() {
  if (!etchSymbol) return '';
  let uses = '';
  for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) uses += `<use href="#card-etch" x="${x * 68 - 14}" y="${y * 68 - 20}" width="68" height="68"/>`;
  return `<svg class="card__etch" viewBox="0 0 270 162" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${uses}</svg>`;
}

function services(featured) {
  const list = [...QUOTE_TOPICS];
  const i = list.findIndex((s) => s.id === featured);
  if (i > 0) list.unshift(...list.splice(i, 1));
  return list.map((s) => (s.id === featured
    ? `<li class="is-feat">${ICON.star}${esc(s.title)}</li>`
    : `<li>${esc(s.title)}</li>`)).join('');
}

export function front(key) {
  const d = DESIGNS[key];
  const classic = key === 'classic';
  return `<article class="card card--front${classic ? ' card--classic' : ''}" data-design="${key}" aria-label="${esc(d.label)} card — front">
  ${classic ? `${etch()}<div class="classic__halo" aria-hidden="true"></div>` : ''}
  <img class="card__art" src="${d.art}" alt="" />
  <div class="card__shade" aria-hidden="true"></div>
  <div class="card__safe">
    ${LOCKUP}
    <div class="feat">
      <p class="feat__kicker">${esc(d.kicker)}</p>
      <h3 class="feat__title">${esc(d.title)}</h3>
      <p class="feat__sub">${esc(d.sub)}</p>
    </div>
    <p class="call"><span class="call__label">Call or text</span><span class="call__num">${ICON.phone}${esc(CARD.phone)}</span></p>
  </div>
</article>`;
}

/* Anton caps: ~17 characters fill the name column; longer names step down a size. */
const nameSize = (n) => (n.length > 22 ? ' is-longer' : n.length > 17 ? ' is-long' : '');

export function back(key) {
  const d = DESIGNS[key];
  const qr = qrSvg(CARD.url, { ecc: 'M', margin: 4, dark: '#0B0B12', light: '#F8F5EE', title: `QR code: ${CARD.web}` });
  return `<article class="card card--back" data-design="${key}" aria-label="${esc(d.label)} card — back">
  ${etch()}
  <div class="card__safe back">
    <div class="back__id">
      <h3 class="back__name${nameSize(CARD.name)}">${esc(CARD.name)}</h3>
      <p class="back__role">${esc(CARD.role)} · ${esc(CARD.business)}</p>
    </div>
    <ul class="back__contact">
      <li class="back__phone">${ICON.phone}${esc(CARD.phone)}</li>
      <li>${ICON.mail}${esc(CARD.email)}</li>
      <li>${ICON.pin}${esc(CARD.area)}</li>
    </ul>
    <div class="back__qr">
      <div class="qr">${qr}</div>
      <p class="back__qr-cap">
        <span class="back__scan">Scan for a<br />free quote</span>
        <b class="back__web">${esc(CARD.web)}</b>
        <span class="back__legal">Licensed &amp; insured<br />${esc(CARD.license)}</span>
      </p>
    </div>
    <div class="back__svc">
      <p class="back__label">Services</p>
      <ul>${services(d.featured)}</ul>
      <p class="back__free">Free estimates</p>
    </div>
  </div>
</article>`;
}

/** Both sides of every design, for pages that want the <symbol> the etch uses. */
export const etchDefs = () => (etchSymbol ? `<svg class="card-defs" aria-hidden="true">${etchSymbol}</svg>` : '');
