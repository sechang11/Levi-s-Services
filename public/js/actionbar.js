/* actionbar.js — on phones, Call · Text · Free quote pinned to the bottom of the
   screen (thumb reach) once the hero's own buttons have scrolled away. It gets
   out of the way over the quote form and the footer (they have the same
   options), while the keyboard is up, and never covers the lightbox. */
import { goToQuote } from './form.js';

const phone = matchMedia('(max-width: 720px)');

export function initActionBar() {
  const bar = document.querySelector('.actionbar');
  if (!bar || !('IntersectionObserver' in window)) return;
  bar.hidden = false;

  const inView = new Map(); // hero / quote form / footer → on screen?
  let typing = false;
  const update = () => {
    const show = phone.matches && !typing && ![...inView.values()].some(Boolean);
    bar.classList.toggle('is-shown', show);
    bar.inert = !show; // off-screen links stay out of the tab order
  };

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) inView.set(en.target, en.isIntersecting);
    update();
  });
  for (const el of [document.querySelector('.hero'), document.getElementById('quoteForm'), document.querySelector('.footer')]) {
    if (el) io.observe(el);
  }
  document.addEventListener('focusin', (e) => { typing = e.target.matches('input, textarea, select'); update(); });
  document.addEventListener('focusout', () => { typing = false; update(); });
  phone.addEventListener('change', update);

  bar.querySelector('[data-actionbar-quote]')?.addEventListener('click', () => goToQuote(null));
  bar.inert = true; // hidden until the observer's first report says the hero is off screen
}
