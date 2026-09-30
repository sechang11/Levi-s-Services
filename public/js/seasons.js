/* seasons.js — the four seasonal themes.
   boot.js already set <html data-season> before first paint; this module
   wires the switcher (a radiogroup), plays a circular reveal from the clicked
   button, and updates the seasonal copy, featured service and particles. */
import { SEASONS } from './content.js';
import { featureService } from './services.js';
import { setFxSeason } from './fx.js';
import { reduceMotion } from './motion.js';

const root = document.documentElement;
let buttons = [];
let thumb = null;
let seq = 0;

export const currentSeason = () => (SEASONS[root.dataset.season] ? root.dataset.season : 'fall');

/* Seasonal hero backdrop (rendered on the GPU box — see tools/assets).
   Portrait screens get the vertical crop; AVIF with a WebP fallback, two widths each. */
function backdropHTML(key) {
  const b = `assets/seasons/${key}`;
  const set = (kind, ext, [w1, w2]) => `${b}-${kind}-${w1}.${ext} ${w1}w, ${b}-${kind}-${w2}.${ext} ${w2}w`;
  return `
    <source type="image/avif" media="(orientation: portrait)" srcset="${set('mobile', 'avif', [720, 1088])}" sizes="100vw">
    <source type="image/webp" media="(orientation: portrait)" srcset="${set('mobile', 'webp', [720, 1088])}" sizes="100vw">
    <source type="image/avif" srcset="${set('desktop', 'avif', [1280, 1920])}" sizes="100vw">
    <img src="${b}-desktop-1920.webp" srcset="${set('desktop', 'webp', [1280, 1920])}" sizes="100vw" alt="" fetchpriority="high">`;
}

function setBackdrop(key) {
  const pic = document.querySelector('.hero__photo');
  if (!pic || pic.dataset.season === key) return;
  pic.dataset.season = key;
  pic.classList.remove('is-loaded');
  pic.innerHTML = backdropHTML(key);
  const img = pic.querySelector('img');
  const shown = () => { if (pic.dataset.season === key) pic.classList.add('is-loaded'); };
  if (img.complete && img.naturalWidth) shown();
  else img.addEventListener('load', shown, { once: true });
}

function moveThumb() {
  const on = buttons.find((b) => b.getAttribute('aria-checked') === 'true');
  if (!thumb || !on) return;
  thumb.style.width = `${on.offsetWidth}px`;
  thumb.style.transform = `translateX(${on.offsetLeft}px)`;
}

function paint(key) {
  const s = SEASONS[key];
  root.dataset.season = key;
  for (const b of buttons) {
    const on = b.dataset.seasonPick === key;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  moveThumb();
  const setText = (sel, text) => document.querySelectorAll(sel).forEach((el) => { el.textContent = text; });
  setText('[data-season-chip-text]', s.chip);
  setText('[data-season-tagline]', s.tagline);
  setText('[data-season-cta]', s.cta);
  setText('[data-season-label]', s.label);
  document.querySelectorAll('[data-season-icon]').forEach((u) => u.setAttribute('href', `#i-${key}`));
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  document.querySelectorAll('[data-season-checklist]').forEach((ul) => {
    ul.innerHTML = (s.checklist || []).map((t) => `<li><svg aria-hidden="true"><use href="#i-check"/></svg><span>${esc(t)}</span></li>`).join('');
  });
  setBackdrop(key);
  featureService(s.featured, { open: true });
  setFxSeason(key);
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

/** Switch seasons; `origin` is the element the circular reveal grows from. */
export function setSeason(key, origin = null) {
  if (!SEASONS[key] || key === currentSeason()) return;
  try { sessionStorage.setItem('levi-season', key); } catch { /* storage blocked */ }
  const url = new URL(location.href);
  if (url.searchParams.has('season')) { url.searchParams.set('season', key); history.replaceState(null, '', url); }

  if (!document.startViewTransition || reduceMotion()) { paint(key); return; }

  const r = origin?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : innerWidth / 2;
  const y = r ? r.top + r.height / 2 : 0;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const token = ++seq;
  root.classList.add('vt-season');
  const t = document.startViewTransition(() => paint(key));
  t.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 700, easing: 'cubic-bezier(.2,.9,.2,1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
  t.finished.finally(() => { if (token === seq) root.classList.remove('vt-season'); });
}

export function initSeasons() {
  buttons = [...document.querySelectorAll('[data-season-pick]')];
  thumb = document.querySelector('.season-switch__thumb');

  buttons.forEach((b, i) => {
    b.addEventListener('click', () => setSeason(b.dataset.seasonPick, b));
    b.addEventListener('keydown', (e) => { // radiogroup: arrows move + select
      const map = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: buttons.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      const next = buttons[(map[e.key] + buttons.length) % buttons.length];
      next.focus();
      setSeason(next.dataset.seasonPick, next);
    });
  });

  paint(currentSeason());
  // re-measure whenever the switch changes size (labels hide on small screens, fonts load, zoom…)
  const sw = document.querySelector('.season-switch');
  if (sw && 'ResizeObserver' in window) new ResizeObserver(moveThumb).observe(sw);
  else addEventListener('resize', moveThumb, { passive: true });
  document.fonts?.ready.then(moveThumb);
}
