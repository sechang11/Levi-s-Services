/* tabs.js — WAI-ARIA tabs (roving tabindex) with a sliding underline and a
   View Transitions cross-fade between panels. The address bar follows along:
   #services · #woodshop · #story · #contact are shareable links, and Back/Forward step
   between tabs (main.js routes them, plus service deep links like #snow). */
import { reduceMotion } from './motion.js';
export const TAB_IDS = ['services', 'woodshop', 'story', 'contact'];
/** The tab a URL hash names (#story, or the older #panel-story), else null. */
export const tabFromHash = (hash = location.hash) => {
  const id = hash.replace(/^#(panel-)?/, '');
  return TAB_IDS.includes(id) ? id : null;
};
let tabs = [];
let underline = null;
let vt = null;

const panelFor = (tab) => document.getElementById(tab.getAttribute('aria-controls'));
const tabFor = (id) => tabs.find((t) => t.id === `tab-${id}`);

function moveUnderline(tab = tabs.find((t) => t.classList.contains('is-active'))) {
  if (!underline || !tab) return;
  underline.style.width = `${tab.offsetWidth}px`;
  underline.style.transform = `translateX(${tab.offsetLeft}px)`;
}

function apply(tab) {
  for (const t of tabs) {
    const on = t === tab;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    panelFor(t).hidden = !on;
  }
  moveUnderline(tab);
}

/* Put #id in the address bar: 'push' adds a Back step, 'replace' doesn't, 'none' leaves it. */
function syncHash(id, mode) {
  if (mode === 'none' || location.hash === `#${id}`) return;
  if (id === 'services' && !tabFromHash()) return; // no hash already means Services
  const url = new URL(location.href);
  url.hash = id;
  history[mode === 'replace' ? 'replaceState' : 'pushState'](null, '', url);
}

/** Switch to a tab by id ('services' | 'story' | 'contact').
    Resolves once the new panel is in the DOM (safe to focus inside it). */
export function showTab(id, { focus = false, history: mode = 'push' } = {}) {
  const tab = tabFor(id);
  if (!tab) return Promise.resolve();
  if (tab.classList.contains('is-active')) { if (focus) tab.focus(); return Promise.resolve(); }
  syncHash(id, mode);
  const run = () => { apply(tab); if (focus) tab.focus(); };
  if (document.startViewTransition && !reduceMotion() && !vt) {
    vt = document.startViewTransition(run);
    vt.ready.catch(() => {}); // skipped (hidden tab, rapid clicks): the swap still happens, no animation
    vt.finished.finally(() => { vt = null; }).catch(() => {});
    return vt.updateCallbackDone.catch(() => {});
  }
  run(); // a transition is in flight, or no support → plain swap
  return Promise.resolve();
}

/** Bring the tab bar to the top of the viewport (below nothing — it's sticky). */
export function scrollToTabs() {
  document.querySelector('.tabbar')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
}

export function initTabs() {
  tabs = [...document.querySelectorAll('.tab')];
  underline = document.querySelector('.tab__underline');

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => showTab(tab.id.replace('tab-', '')));
    tab.addEventListener('keydown', (e) => {
      const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      const next = tabs[(map[e.key] + tabs.length) % tabs.length];
      showTab(next.id.replace('tab-', ''), { focus: true, history: 'replace' });
    });
  });

  // any element with data-goto-tab="story|contact|services" jumps there
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-goto-tab]');
    if (!link) return;
    e.preventDefault();
    showTab(link.dataset.gotoTab, { focus: true });
    scrollToTabs();
  });

  // follow the tab strip's size (viewport changes, web fonts loading, zoom)
  const strip = document.querySelector('.tabbar__tabs');
  if (strip && 'ResizeObserver' in window) new ResizeObserver(() => moveUnderline()).observe(strip);
  else addEventListener('resize', () => moveUnderline(), { passive: true });
  document.fonts?.ready.then(() => moveUnderline());
  moveUnderline();
}
