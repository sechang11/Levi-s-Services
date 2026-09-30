/* main.js — boots the site. Order matters: the before/after slider module
   before anything renders sliders, services before the seasons module
   features one, and fx before it gets a season. */
import { initLightbox } from './lightbox.js';
import { initTabs, showTab, scrollToTabs, tabFromHash } from './tabs.js';
import { initServices, openService } from './services.js';
import { initForm, goToQuote } from './form.js';
import { initFx } from './fx.js';
import { initSeasons, currentSeason } from './seasons.js';
import { initHead } from './head.js';
import { initMotionToggles } from './motion.js';
import { initActionBar } from './actionbar.js';
import { initBA } from './ba.js';
import { initProjects, syncJobFromHash } from './projects.js';
import { SEASONS, serviceById } from './content.js';

initBA();
initLightbox();
initTabs();
initServices();
initProjects();
initForm();
initFx();
initSeasons();
initHead();
initMotionToggles();
initActionBar();

// hero: the seasonal chip opens that season's featured service…
document.querySelector('[data-season-chip]')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await showTab('services');
  openService(SEASONS[currentSeason()].featured, { scroll: true });
});
// …and the primary CTA starts a quote for it
document.querySelectorAll('[data-quote-featured]').forEach((b) => b.addEventListener('click', () => {
  goToQuote(SEASONS[currentSeason()].featured);
}));
// the Woodshop's "Commission a piece" starts a Custom Furniture quote
document.querySelector('.woodshop [data-quote]')?.addEventListener('click', (e) => {
  goToQuote(e.currentTarget.dataset.quote);
});

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

/* Deep links: #services · #story · #contact open that tab, #<service> (e.g. #snow,
   for a snow-season flyer) opens that service, #woodshop jumps to the furniture.
   Back/Forward replay them (tabs.js pushes a step per tab switch). */
function route(initial = false) {
  if (syncJobFromHash()) { showTab('services', { history: 'none' }); return; } // #job-<id> opens the job viewer
  let hash = '';
  try { hash = decodeURIComponent(location.hash.slice(1)); } catch { /* malformed %-escape: treat as no hash */ }
  const tab = tabFromHash();
  if (tab) {
    showTab(tab, { history: 'none' });
    if (initial) scrollToTabs();
  } else if (serviceById(hash)) {
    showTab('services', { history: 'none' }).then(() => openService(hash, { scroll: true }));
  } else if (hash === 'work') {
    showTab('services', { history: 'none' }).then(() => { if (initial) document.getElementById('work')?.scrollIntoView({ block: 'start' }); });
  } else if (hash === 'woodshop' || hash === 'furniture') {
    showTab('services', { history: 'none' }).then(() => document.getElementById('woodshop')?.scrollIntoView({ block: 'start' }));
  } else if (!hash && !initial) {
    showTab('services', { history: 'none' });
  }
}
route(true);
addEventListener('popstate', () => route());

// "Leave a review" shows up once the server has REVIEW_URL set (/review then forwards to Google)
const reviewLink = document.querySelector('[data-review-link]');
if (reviewLink) {
  fetch('/review', { method: 'HEAD', redirect: 'manual' })
    .then((r) => { if (r.type === 'opaqueredirect') reviewLink.hidden = false; }, () => {});
}
