/* form.js — the quote form.
   Validates, POSTs to /api/quote (server.js forwards it to Levi's phone via
   QUOTE_WEBHOOK_URL), and falls back to the visitor's email app when the
   webhook isn't configured — so a lead is never lost. */
import { QUOTE_TOPICS, CONTACT, topicById } from './content.js';
import { showTab, scrollToTabs } from './tabs.js';

let form = null;
let statusEl = null;
let submitBtn = null;
let select = null;

const FIELDS = {
  name: { input: 'c-name', err: 'c-name-err' },
  contact: { input: 'c-phone', err: 'c-contact-err', also: 'c-email' },
  email: { input: 'c-email', err: 'c-email-err' },
};

/** Jump to the Contact tab with a service pre-selected. */
export async function goToQuote(serviceId) {
  await showTab('contact');
  const s = topicById(serviceId);
  if (select) select.value = s ? s.title : '';
  scrollToTabs();
  form?.querySelector('#c-name')?.focus({ preventScroll: true });
}

function setStatus(msg, tone = 'ok') {
  if (!statusEl) return;
  statusEl.hidden = !msg;
  statusEl.textContent = msg || '';
  statusEl.dataset.tone = tone;
}

function setBusy(busy) {
  submitBtn.disabled = busy;
  submitBtn.textContent = busy ? 'Sending…' : 'Send request';
}

function validate(d) {
  const errs = {};
  if (!d.name) errs.name = 'Please add your name.';
  if (!d.phone && !d.email) errs.contact = 'Add a phone number or an email so Levi can reach you.';
  else if ((d.reach === 'Text' || d.reach === 'Call') && !d.phone) errs.contact = `Add a phone number so Levi can ${d.reach.toLowerCase()} you.`;
  else if (d.reach === 'Email' && !d.email) errs.contact = 'Add an email so Levi can write back.';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errs.email = "That email doesn't look quite right.";
  return errs;
}

function showErrors(errs) {
  for (const f of Object.values(FIELDS)) {
    form.querySelector(`#${f.input}`).removeAttribute('aria-invalid');
    if (f.also) form.querySelector(`#${f.also}`).removeAttribute('aria-invalid');
    form.querySelector(`#${f.err}`).textContent = '';
  }
  let first = null;
  for (const [key, msg] of Object.entries(errs)) {
    const f = FIELDS[key];
    const input = form.querySelector(`#${f.input}`);
    input.setAttribute('aria-invalid', 'true');
    if (f.also) form.querySelector(`#${f.also}`).setAttribute('aria-invalid', 'true');
    form.querySelector(`#${f.err}`).textContent = msg;
    first ??= input;
  }
  first?.focus();
}

function mailtoFor(d) {
  const subject = `Quote request${d.service ? ` — ${d.service}` : ''}`;
  const lines = [`Name: ${d.name}`, d.phone && `Phone: ${d.phone}`, d.email && `Email: ${d.email}`, d.reach && `Best way to reach me: ${d.reach}`,
    d.service && `Service: ${d.service}`, d.timeline && `Timeline: ${d.timeline}`].filter(Boolean);
  if (d.message) lines.push('', d.message);
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

async function onSubmit(e) {
  e.preventDefault();
  const data = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
  const errs = validate(data);
  showErrors(errs);
  if (Object.keys(errs).length) { setStatus('Please fix the highlighted fields.', 'error'); return; }
  if (data.company) { setStatus('Thanks — your request is in.'); form.reset(); return; } // honeypot

  setBusy(true);
  setStatus('');
  let res = null;
  try {
    res = await fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  } catch { /* offline or static hosting — fall through to email */ }
  setBusy(false);

  if (res?.ok) {
    const first = data.name.split(/\s+/)[0];
    const how = { Text: 'text you', Call: 'call you', Email: 'email you' }[data.reach] || 'get back to you';
    setStatus(`Thanks, ${first} — your request is in. Levi will ${how} within [one business day].`);
    form.reset();
    return;
  }
  if (res?.status === 429) {
    setStatus(`That's a lot of requests — give it a few minutes, or call/text ${CONTACT.phoneDisplay}.`, 'error');
    return;
  }
  // No webhook set up yet (503) or delivery trouble → hand off to the visitor's email app.
  setStatus(`Opening your email app with the details filled in… If nothing opens, call or text ${CONTACT.phoneDisplay}.`);
  location.href = mailtoFor(data);
}

export function initForm() {
  form = document.getElementById('quoteForm');
  if (!form) return;
  statusEl = form.querySelector('.form-status');
  submitBtn = form.querySelector('[data-submit]');
  select = form.querySelector('#c-service');
  select?.insertAdjacentHTML('beforeend', QUOTE_TOPICS.map((s) => {
    const t = s.title.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return `<option value="${t}">${t}</option>`;
  }).join(''));
  form.addEventListener('submit', onSubmit);
  // clear a field's error as soon as it's edited
  form.addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true') e.target.removeAttribute('aria-invalid');
  });
}
