/* services.js — renders the accordion from content.js and handles opening,
   the cursor spotlight, lazy thumbnails, the before/after sliders,
   per-service "Get a quote" buttons, and the seasonal "featured" service
   that moves to the top. */
import { SERVICES } from './content.js';
import { openLightbox } from './lightbox.js';
import { goToQuote } from './form.js';
import { reduceMotion } from './motion.js';

const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const byId = new Map(); // service id → .svc element
let accordion = null;

function itemHTML(s) {
  const title = esc(s.title);
  const thumbs = s.gallery.map((g, k) => `
          <button type="button" class="thumb" data-svc="${s.id}" data-idx="${k}" aria-label="Open photo ${k + 1} of ${s.gallery.length}: ${esc(g.cap)}">
            <img data-src="${esc(g.thumb || g.src)}" alt="${esc(g.alt)}" width="640" height="360" decoding="async" />
            <span class="thumb__zoom" aria-hidden="true"><svg><use href="#i-expand"/></svg></span>
            <span class="thumb__cap">${String(k + 1).padStart(2, '0')} · ${esc(g.cap.split(' · ').pop())}</span>
          </button>`).join('');
  // before/after slider: the "before" photo sits on top, clipped to --pos from the left
  const [before, after] = (s.compare || []).map((n) => s.gallery[n - 1]);
  const slider = before && after ? `
        <figure class="ba">
          <div class="ba__frame">
            <img class="ba__img" data-src="${esc(after.src)}" alt="${esc(after.alt)}" width="1280" height="720" decoding="async" />
            <img class="ba__img ba__img--before" data-src="${esc(before.src)}" alt="${esc(before.alt)}" width="1280" height="720" decoding="async" />
            <span class="ba__tag ba__tag--before" aria-hidden="true">Before</span>
            <span class="ba__tag ba__tag--after" aria-hidden="true">After</span>
            <span class="ba__handle" aria-hidden="true"></span>
            <input class="ba__range" type="range" min="0" max="100" value="50" aria-label="${title}: compare before and after" aria-valuetext="50% before, 50% after" />
          </div>
          <figcaption class="ba__cap">Drag to compare before &amp; after</figcaption>
        </figure>` : '';
  return `
  <div class="svc" data-id="${s.id}" data-open="false">
    <h3 class="svc__heading">
      <button class="svc__head" type="button" id="svc-${s.id}-btn" aria-expanded="false" aria-controls="svc-${s.id}-panel">
        <span class="svc__num">00</span>
        <span class="svc__titles">
          <span class="svc-title" data-text="${title}">${title}</span>
          <span class="svc__meta">
            <span class="svc__badge" hidden><svg aria-hidden="true"><use href="#i-star"/></svg>Seasonal pick</span>
            ${s.tag ? `<span class="svc__tag">${esc(s.tag)}</span>` : ''}
          </span>
        </span>
        <span class="svc__toggle" aria-hidden="true"></span>
      </button>
    </h3>
    <div class="svc__panel" id="svc-${s.id}-panel" role="region" aria-labelledby="svc-${s.id}-btn" inert>
      <div class="svc__inner"><div class="svc__body">
        <p class="svc__desc">${esc(s.desc)}</p>
        <ul class="svc__points">${s.points.map((p) => `<li><svg aria-hidden="true"><use href="#i-check"/></svg><span>${esc(p)}</span></li>`).join('')}</ul>${slider}
        <div class="thumbs">${thumbs}</div>
        <div class="svc__actions">
          <button class="cta cta--sm" type="button" data-quote="${s.id}">Get a quote<span class="vh"> for ${title}</span></button>
        </div>
      </div></div>
    </div>
  </div>`;
}

function swapIn(img) {
  if (!img.dataset.src) return;
  img.src = img.dataset.src;
  img.removeAttribute('data-src');
  const done = () => img.classList.add('is-loaded');
  if (img.complete) done();
  else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
}

function setOpen(svc, open) {
  svc.dataset.open = String(open);
  svc.querySelector('.svc__head').setAttribute('aria-expanded', String(open));
  const panel = svc.querySelector('.svc__panel');
  panel.inert = !open; // collapsed content stays out of the a11y tree + tab order
  if (open) panel.querySelectorAll('img[data-src]').forEach(swapIn);
  else panel.querySelector('.ba__frame')?.classList.remove('is-seen'); // re-opening nudges again
}

/** Move a service to the top, badge it, renumber, and (optionally) open only it. */
export function featureService(id, { open = true } = {}) {
  if (!accordion) return;
  const season = document.documentElement.dataset.season;
  const order = [id, ...SERVICES.map((s) => s.id).filter((x) => x !== id)];
  for (const key of order) { const el = byId.get(key); if (el) accordion.append(el); }
  let n = 0;
  for (const el of accordion.children) {
    const featured = el.dataset.id === id;
    el.classList.toggle('is-featured', featured);
    const badge = el.querySelector('.svc__badge');
    badge.hidden = !featured;
    badge.querySelector('use').setAttribute('href', `#i-${season}`);
    el.querySelector('.svc__num').textContent = String(++n).padStart(2, '0');
    if (open) setOpen(el, featured);
  }
}

/** Open one service (and optionally scroll it into view). */
export function openService(id, { scroll = false } = {}) {
  const el = byId.get(id);
  if (!el) return;
  setOpen(el, true);
  if (scroll) {
    el.querySelector('.svc__head').focus({ preventScroll: true });
    requestAnimationFrame(() => el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }));
  }
}

export function initServices() {
  accordion = document.getElementById('accordion');
  if (!accordion) return;
  accordion.innerHTML = SERVICES.map(itemHTML).join('');
  for (const el of accordion.querySelectorAll('.svc')) byId.set(el.dataset.id, el);

  accordion.addEventListener('click', (e) => {
    const head = e.target.closest('.svc__head');
    if (head) {
      const svc = head.closest('.svc');
      setOpen(svc, svc.dataset.open !== 'true');
      return;
    }
    const thumb = e.target.closest('.thumb');
    if (thumb) {
      const s = SERVICES.find((x) => x.id === thumb.dataset.svc);
      if (s) openLightbox(s.gallery, Number(thumb.dataset.idx), thumb);
      return;
    }
    const quote = e.target.closest('[data-quote]');
    if (quote) goToQuote(quote.dataset.quote);
  });

  // before/after sliders: nudge the handle once each time one comes into view…
  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) en.target.classList.add('is-seen');
    }, { threshold: 0.6 });
    accordion.querySelectorAll('.ba__frame').forEach((f) => seen.observe(f));
  }
  // …and the range input drives --pos
  accordion.addEventListener('input', (e) => {
    const range = e.target.closest('.ba__range');
    if (!range) return;
    const v = Number(range.value);
    range.parentElement.style.setProperty('--pos', `${v}%`);
    range.setAttribute('aria-valuetext', `${v}% before, ${100 - v}% after`);
  });

  // cursor-tracked spotlight on each service row
  accordion.addEventListener('pointermove', (e) => {
    const head = e.target.closest('.svc__head');
    if (!head) return;
    const r = head.getBoundingClientRect();
    head.style.setProperty('--mx', `${e.clientX - r.left}px`);
    head.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  // lazy thumbnails: load near the viewport (and always when a service opens)
  const lazy = accordion.querySelectorAll('img[data-src]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { swapIn(en.target); io.unobserve(en.target); }
    }, { rootMargin: '300px' });
    lazy.forEach((img) => io.observe(img));
  } else {
    lazy.forEach(swapIn);
  }
}
