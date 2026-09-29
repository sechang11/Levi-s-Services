/* page.js — boots the two card pages.
   index.html (data-page="demo")  every design, front + back, with PDF links
   print.html (data-page="print") one card side per page, exact size, for the PDFs:
     print.html?design=winter   that design's front + back (what tools/export-cards.js prints)
     print.html                 every design
     &guides                    draw the trim (red) and safe (cyan) lines — a proof, not for the printer */
import { CARD, DESIGNS, DESIGN_ORDER, front, back, loadEtch, etchDefs } from './cards.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const params = new URLSearchParams(location.search);

await loadEtch();
document.body.insertAdjacentHTML('afterbegin', etchDefs());

if (document.body.dataset.page === 'print') {
  const one = params.get('design');
  const keys = DESIGNS[one] ? [one] : DESIGN_ORDER;
  document.body.classList.toggle('guides', params.has('guides'));
  document.querySelector('[data-sheets]').innerHTML = keys.map((k) => `<div class="sheet">${front(k)}</div><div class="sheet">${back(k)}</div>`).join('');
  document.title = `${CARD.business} business card${keys.length > 1 ? 's' : ` — ${DESIGNS[keys[0]].label}`}`;
} else {
  document.querySelector('[data-cards]').innerHTML = DESIGN_ORDER.map((k) => {
    const d = DESIGNS[k];
    const file = `levi-builds-card-${k}`;
    return `
    <section class="design" aria-labelledby="d-${k}">
      <header class="design__head">
        <h2 id="d-${k}">${esc(d.label)} <span>${esc(d.featured ? d.title : 'Year-round')}</span></h2>
        <p>${esc(d.scene)}</p>
      </header>
      <div class="design__sides">
        <figure class="design__side"><div class="trim">${front(k)}</div><figcaption>Front</figcaption></figure>
        <figure class="design__side"><div class="trim">${back(k)}</div><figcaption>Back</figcaption></figure>
      </div>
      <p class="design__files">
        <a href="print/${file}.pdf" download>Print PDF <span>RGB · front + back</span></a>
        <a href="print/cmyk/${file}-cmyk.pdf" download>CMYK PDF <span>for printers that ask for CMYK</span></a>
      </p>
    </section>`;
  }).join('');

  const guides = document.querySelector('[data-guides]');
  guides?.addEventListener('change', () => document.body.classList.toggle('guides', guides.checked));

  // hide a download that isn't there (e.g. CMYK after a re-export without Ghostscript)
  for (const a of document.querySelectorAll('.design__files a')) {
    fetch(a.href, { method: 'HEAD' }).then((r) => { if (!r.ok) a.hidden = true; }, () => {});
  }
}
