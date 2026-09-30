/* ba.js — the before/after slider, shared by the service panels and the job
   viewer. The "before" photo sits on top, clipped to --pos from the left; a
   transparent range input drives --pos, so mouse, touch, keyboard and screen
   readers all work. It nudges itself once when it comes into view. */
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let seen = null;

/** Markup for one slider. before/after = { src, alt }. lazy → data-src (loaded by the caller). */
export function baHTML(before, after, label, { lazy = false } = {}) {
  const src = lazy ? 'data-src' : 'src';
  return `
        <figure class="ba">
          <div class="ba__frame">
            <img class="ba__img" ${src}="${esc(after.src)}" alt="${esc(after.alt)}" width="1280" height="720" decoding="async" />
            <img class="ba__img ba__img--before" ${src}="${esc(before.src)}" alt="${esc(before.alt)}" width="1280" height="720" decoding="async" />
            <span class="ba__tag ba__tag--before" aria-hidden="true">Before</span>
            <span class="ba__tag ba__tag--after" aria-hidden="true">After</span>
            <span class="ba__handle" aria-hidden="true"></span>
            <input class="ba__range" type="range" min="0" max="100" value="50" aria-label="${esc(label)}: compare before and after" aria-valuetext="50% before, 50% after" />
          </div>
          <figcaption class="ba__cap">Drag to compare before &amp; after</figcaption>
        </figure>`;
}

/** Start nudge-watching every slider inside root (call after inserting markup). */
export function watchBA(root) {
  if (seen) root.querySelectorAll('.ba__frame').forEach((f) => seen.observe(f));
}

export function initBA() {
  document.addEventListener('input', (e) => {
    const range = e.target.closest?.('.ba__range');
    if (!range) return;
    const v = Number(range.value);
    range.parentElement.style.setProperty('--pos', `${v}%`);
    range.setAttribute('aria-valuetext', `${v}% before, ${100 - v}% after`);
  });
  if ('IntersectionObserver' in window) {
    seen = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) en.target.classList.add('is-seen');
    }, { threshold: 0.6 });
  }
}
