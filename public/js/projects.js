/* projects.js — Recent work: a card per job (PROJECTS in content.js), filter
   chips by service, and a job viewer (<dialog>) with the before/after slider,
   the story, the client's words and every photo.
   Links: #work jumps to the section, #job-<id> opens a job. Opening a job adds
   a Back step, so a phone's back gesture closes the viewer instead of the site. */
import { PROJECTS, QUOTE_TOPICS, projectById } from './content.js';
import { baHTML, watchBA } from './ba.js';
import { goToQuote } from './form.js';

const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SHORT = { snow: 'Snow removal', furniture: 'Furniture' };
const label = (id) => SHORT[id] || QUOTE_TOPICS.find((t) => t.id === id)?.title || id;

let grid, filters, more, dialog, body;
let current = 'all';
let expanded = false;
let openId = null;
let returnFocus = null;

function cardHTML(p) {
  const cover = p.photos[p.after ?? 0] || p.photos[0];
  const pair = p.before != null && p.after != null;
  return `
    <li class="job-card" data-services="${esc(p.services.join(' '))}">
      <button class="job-card__btn" type="button" data-job="${esc(p.id)}">
        <span class="job-card__pic"><img src="${esc(cover.thumb)}" alt="" width="640" height="360" loading="lazy" decoding="async" />${pair ? '<span class="job-card__ba" aria-hidden="true">Before / after</span>' : ''}</span>
        <span class="job-card__tags">${p.services.map((id) => esc(label(id))).join(' · ')}</span>
        <span class="job-card__title">${esc(p.title)}</span>
        <span class="job-card__meta">${esc(p.area)} · ${esc(p.length)}</span>
      </button>
    </li>`;
}

function applyFilter() {
  // under "All", show two full rows (however many columns fit), then "Show all"
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
  const first = Math.max(4, cols * 2);
  let matching = 0;
  for (const li of grid.children) {
    const match = current === 'all' || li.dataset.services.split(' ').includes(current);
    if (match) matching++;
    li.hidden = !match || (current === 'all' && !expanded && matching > first);
  }
  more.hidden = current !== 'all' || expanded || matching <= first;
  more.textContent = `Show all ${matching} jobs`;
  for (const b of filters.querySelectorAll('[data-filter]')) b.setAttribute('aria-pressed', String(b.dataset.filter === current));
}

/** Show only one service's jobs ('all' for everything). */
export function filterJobs(id) {
  current = id === 'all' || PROJECTS.some((p) => p.services.includes(id)) ? id : 'all';
  if (grid) applyFilter();
}

/** Open the job viewer. push=false when the address bar already says #job-<id>. */
export function openJob(id, { push = true, trigger = null } = {}) {
  const p = projectById(id);
  if (!p || !dialog) return null;
  returnFocus = trigger || document.activeElement;
  const pair = p.before != null && p.after != null;
  body.innerHTML = `
    <button class="job__close" type="button" data-job-close aria-label="Close"><svg aria-hidden="true"><use href="#i-close" /></svg></button>
    <header class="job__head">
      <p class="kicker">${p.services.map((s) => esc(label(s))).join(' · ')}${p.sample ? ' <span class="job__sample">Placeholder</span>' : ''}</p>
      <h2 class="job__title" id="jobTitle">${esc(p.title)}</h2>
      <p class="job__meta">${[p.area, p.when, p.length].filter(Boolean).map(esc).join(' · ')}</p>
    </header>
    ${pair ? baHTML(p.photos[p.before], p.photos[p.after], p.title) : ''}
    <p class="job__summary">${esc(p.summary)}</p>
    ${p.quote ? `<blockquote class="job__quote"><p>“${esc(p.quote.text)}”</p><footer>${esc(p.quote.name)}</footer></blockquote>` : ''}
    <div class="job__photos-head">
      <h3>Photos</h3>
      <span class="job__count" data-job-count aria-live="polite">1 / ${p.photos.length}</span>
      <button class="job__step" type="button" data-job-step="-1" aria-label="Previous photo"><svg aria-hidden="true"><use href="#i-left" /></svg></button>
      <button class="job__step" type="button" data-job-step="1" aria-label="Next photo"><svg aria-hidden="true"><use href="#i-right" /></svg></button>
    </div>
    <div class="job__strip" tabindex="0" aria-label="Photos of this job, scroll sideways" data-job-strip>
      ${p.photos.map((ph, i) => `<figure class="job__shot"><img src="${esc(ph.src)}" alt="${esc(ph.alt)}" width="1280" height="720" loading="${i ? 'lazy' : 'eager'}" decoding="async" /><figcaption>${String(i + 1).padStart(2, '0')} · ${esc(ph.label)}</figcaption></figure>`).join('')}
    </div>
    <div class="job__actions">
      <button class="cta" type="button" data-job-quote="${esc(p.services[0])}">${p.services[0] === 'furniture' ? 'Commission a piece like this' : 'Get a quote for a job like this'}</button>
      <button class="cta cta--ghost" type="button" data-job-close>Back to all jobs</button>
    </div>`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  body.querySelector('.job__close').focus();
  watchBA(body);
  openId = id;
  if (push && location.hash !== `#job-${id}`) history.pushState({ job: id }, '', `#job-${id}`);
  return p;
}

/* Close and tidy up right here (not in the dialog's "close" event, which browsers
   may hold back while the page isn't visible). mode 'back' pops the history step
   openJob pushed; 'replace' rewrites it, for when we're heading to the quote form. */
function closeJob(mode = 'back') {
  if (!dialog?.open) return;
  const id = openId;
  openId = null;
  dialog.close();
  if (id && location.hash === `#job-${id}`) {
    if (mode === 'back' && history.state?.job === id) history.back();
    else history.replaceState(null, '', `${location.pathname}${location.search}#work`);
  }
  if (mode === 'back' && returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
}

/** Keep the viewer in step with the address bar (Back/Forward, shared links).
    Returns the job it opened, if the address names one. */
export function syncJobFromHash() {
  const m = /^#job-(.+)$/.exec(location.hash);
  let id = null;
  try { id = m ? decodeURIComponent(m[1]) : null; } catch { /* malformed */ }
  if (id && projectById(id)) return openJob(id, { push: false });
  if (openId) { openId = null; closeJob(); } // Back pressed while a job was open
  return null;
}

/* The Woodshop tab: the newest piece up top, the rest as cards (furniture jobs). */
function renderWoodshop() {
  const pieces = PROJECTS.filter((p) => p.services.includes('furniture'));
  const gridEl = document.querySelector('[data-woodshop-grid]');
  if (gridEl) {
    gridEl.innerHTML = pieces.slice(1).map(cardHTML).join('');
    gridEl.closest('section').hidden = pieces.length < 2; // just one piece so far: the feature is enough
  }
  const note = document.querySelector('[data-woodshop-sample]');
  if (note) note.hidden = !pieces.some((p) => p.sample);
  const feature = document.querySelector('[data-woodshop-feature]');
  const top = pieces[0];
  if (feature && top) {
    const ph = top.photos[top.after ?? 0] || top.photos[0];
    feature.innerHTML = `
      <button class="woodshop__feature" type="button" data-job="${esc(top.id)}">
        <img src="${esc(ph.src)}" alt="${esc(ph.alt)}" width="1280" height="720" decoding="async" />
        <span class="thumb__cap">Latest · ${esc(top.title)}</span>
      </button>`;
  }
}

function stepStrip(dir) {
  const strip = body.querySelector('[data-job-strip]');
  strip?.scrollBy({ left: dir * strip.clientWidth, behavior: 'smooth' });
}

export function initProjects() {
  const section = document.getElementById('work');
  dialog = document.getElementById('jobDialog');
  if (!section || !dialog) return;
  grid = section.querySelector('[data-jobs-grid]');
  filters = section.querySelector('[data-jobs-filters]');
  more = section.querySelector('[data-jobs-more]');
  body = dialog.querySelector('[data-job-body]');

  grid.innerHTML = PROJECTS.map(cardHTML).join('');
  const used = new Set(PROJECTS.flatMap((p) => p.services));
  filters.innerHTML = ['all', ...QUOTE_TOPICS.map((t) => t.id).filter((id) => used.has(id))]
    .map((id) => `<button class="chip" type="button" data-filter="${id}" aria-pressed="false">${id === 'all' ? 'All jobs' : esc(label(id))}</button>`)
    .join('');
  section.querySelector('[data-jobs-sample]').hidden = !PROJECTS.some((p) => p.sample);
  applyFilter();
  // the column count decides how many cards make two rows: redo it when the width changes
  // (incl. the Services tab going from hidden to shown)
  if ('ResizeObserver' in window) {
    let width = 0;
    new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w !== width) { width = w; applyFilter(); }
    }).observe(grid);
  }

  filters.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (b) filterJobs(b.dataset.filter);
  });
  more.addEventListener('click', () => { expanded = true; applyFilter(); });
  // any job card or feature (Recent work, the Woodshop tab) opens the viewer
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-job]');
    if (b) openJob(b.dataset.job, { trigger: b });
  });
  renderWoodshop();
  // "See the jobs" links in the service panels: filter first, then the link jumps to #work
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-jobs-filter]');
    if (a) filterJobs(a.dataset.jobsFilter);
  });

  body.addEventListener('click', (e) => {
    if (e.target.closest('[data-job-close]')) closeJob();
    const step = e.target.closest('[data-job-step]');
    if (step) stepStrip(Number(step.dataset.jobStep));
    const quote = e.target.closest('[data-job-quote]');
    if (quote) { closeJob('replace'); goToQuote(quote.dataset.jobQuote); }
  });
  body.addEventListener('scroll', (e) => {   // photo counter follows the strip
    const strip = e.target.closest?.('[data-job-strip]');
    if (!strip) return;
    const n = Math.round(strip.scrollLeft / strip.clientWidth) + 1;
    const count = body.querySelector('[data-job-count]');
    if (count) count.textContent = `${n} / ${strip.children.length}`;
  }, true);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeJob(); }); // the dimmed backdrop
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeJob(); });   // Esc takes the same path
  dialog.addEventListener('close', () => { openId = null; });                       // closed some other way
}
