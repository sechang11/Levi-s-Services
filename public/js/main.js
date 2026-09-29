/* main.js — boots the site. Order matters: services must exist before the
   seasons module features one, and fx must exist before it gets a season. */
import { initLightbox } from './lightbox.js';
import { initTabs, showTab } from './tabs.js';
import { initServices, openService } from './services.js';
import { initForm, goToQuote } from './form.js';
import { initFx } from './fx.js';
import { initSeasons, currentSeason } from './seasons.js';
import { initHead } from './head.js';
import { initMotionToggles } from './motion.js';
import { SEASONS } from './content.js';

initLightbox();
initTabs();
initServices();
initForm();
initFx();
initSeasons();
initHead();
initMotionToggles();

// hero: the seasonal chip opens that season's featured service…
document.querySelector('[data-season-chip]')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await showTab('services');
  openService(SEASONS[currentSeason()].featured, { scroll: true });
});
// …and the primary CTA starts a quote for it
document.querySelector('[data-quote-featured]')?.addEventListener('click', () => {
  goToQuote(SEASONS[currentSeason()].featured);
});
// the Woodshop's "Commission a piece" starts a Custom Furniture quote
document.querySelector('.woodshop [data-quote]')?.addEventListener('click', (e) => {
  goToQuote(e.currentTarget.dataset.quote);
});

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
