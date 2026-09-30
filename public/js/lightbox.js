/* lightbox.js — one accessible gallery modal for everything:
   service project photos (from content.js) and the My Story photos
   (any <button data-lightbox data-gallery="…"> in the page). */
let box, img, cap, counter, btnClose, btnPrev, btnNext;
let items = [];
let index = 0;
let returnFocus = null;

function render() {
  const it = items[index];
  if (!it) return;
  img.src = it.src;
  img.alt = it.alt || '';
  cap.textContent = it.cap || '';
  counter.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
  // warm the neighbours so the next swipe / arrow is instant
  for (const d of [1, -1]) {
    const next = items[(index + d + items.length) % items.length];
    if (items.length > 1 && next?.src) new Image().src = next.src;
  }
}

/** Open the gallery. items = [{ src, alt, cap }], start = index, trigger = element to refocus on close. */
export function openLightbox(list, start = 0, trigger = null) {
  if (!box || !list.length) return;
  items = list;
  index = Math.max(0, Math.min(start, list.length - 1));
  returnFocus = trigger;
  btnPrev.hidden = btnNext.hidden = items.length < 2;
  render();
  box.hidden = false;
  document.body.classList.add('lb-open');
  btnClose.focus();
}

function close() {
  box.hidden = true;
  document.body.classList.remove('lb-open');
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
}

function go(delta) {
  if (items.length < 2) return;
  index = (index + delta + items.length) % items.length;
  render();
}

export function initLightbox() {
  box = document.getElementById('lightbox');
  if (!box) return;
  img = document.getElementById('lightboxImg');
  cap = document.getElementById('lightboxCap');
  counter = document.getElementById('lightboxCounter');
  btnClose = box.querySelector('.lightbox__close');
  btnPrev = box.querySelector('.lightbox__nav--prev');
  btnNext = box.querySelector('.lightbox__nav--next');

  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', () => go(-1));
  btnNext.addEventListener('click', () => go(1));
  box.addEventListener('click', (e) => { if (e.target === box) close(); }); // click outside the photo

  // swipe on touch screens
  let x0 = null;
  box.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
    x0 = null;
  });

  document.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'Tab') { // keep focus inside the dialog
      const f = [btnClose, btnPrev, btnNext].filter((b) => !b.hidden);
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[((i < 0 ? 0 : i) + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });

  // My Story photos: every [data-lightbox] with the same data-gallery forms one set
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-lightbox]');
    if (!trigger) return;
    const group = [...document.querySelectorAll(`[data-lightbox][data-gallery="${trigger.dataset.gallery}"]`)];
    const list = group.map((el) => {
      const pic = el.querySelector('img');
      return { src: el.dataset.full || pic?.currentSrc || pic?.src, alt: pic?.alt, cap: el.dataset.cap || pic?.alt }; // data-full: a bigger file than the thumbnail
    });
    openLightbox(list, group.indexOf(trigger), trigger);
  });
}
