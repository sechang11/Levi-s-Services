/* head.js — Levi's interactive figure.
   One controller drives a CSS custom-property contract on #headRig
   (--rx --ry --tilt --px --py) plus data-expression, so the placeholder SVG
   and a future photo rig share this code unchanged.

   · eyes ALWAYS follow the cursor; the head also turns unless reduced motion
   · hover his face → stern · click / tap anywhere → a quick smile */
import { reduceMotion, onMotionChange } from './motion.js';
const coarse = matchMedia('(pointer: coarse)');

export function initHead() {
  const rig = document.getElementById('headRig');
  if (!rig) return;
  const hint = document.querySelector('[data-head-hint]');
  if (hint && coarse.matches) hint.innerHTML = '<b>Tap</b> anywhere to make him smile.';

  /* ---------------- expression state machine ---------------- */
  const HAPPY_MS = 1100;
  let over = false;
  let timer = 0;
  const base = () => (over ? 'stern' : 'neutral');
  const show = (x) => { rig.dataset.expression = x; };
  const settle = () => { if (rig.dataset.expression !== 'happy') show(base()); };
  const smile = () => {
    show('happy');
    clearTimeout(timer);
    timer = setTimeout(() => show(base()), HAPPY_MS); // re-read the base state at expiry
    hint?.classList.add('is-done');
  };

  rig.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') { over = true; settle(); } });
  rig.addEventListener('pointerleave', () => { over = false; settle(); });
  document.addEventListener('click', smile);
  rig.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); smile(); }
  });

  /* ---------------- tilt + eye tracking ---------------- */
  const LERP = 0.14;
  const keys = ['rx', 'ry', 'px', 'py', 'tilt'];
  const target = { rx: 0, ry: 0, px: 0, py: 0, tilt: 0 };
  const current = { rx: 0, ry: 0, px: 0, py: 0, tilt: 0 };
  const units = { rx: 'deg', ry: 'deg', tilt: 'deg', px: 'px', py: 'px' };
  let cx = 0, cy = 0, refW = 1, refH = 1;

  const measure = () => {
    const r = rig.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    refW = r.width * 1.6; // bigger = lazier head
    refH = r.height * 1.6;
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const onMove = (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return; // touch never drives tilt
    const dx = clamp((e.clientX - cx) / refW, -1, 1);
    const dy = clamp((e.clientY - cy) / refH, -1, 1);
    target.px = dx * 6; // eyes: always
    target.py = dy * 4;
    if (reduceMotion()) { target.rx = target.ry = target.tilt = 0; }
    else { target.ry = dx * 18; target.rx = -dy * 12; target.tilt = dx * 4; }
    start();
  };

  const step = () => {
    let moving = false;
    for (const k of keys) {
      const d = target[k] - current[k];
      if (Math.abs(d) > 0.002) { current[k] += d * LERP; moving = true; }
      else if (current[k] !== target[k]) { current[k] = target[k]; moving = true; }
    }
    if (moving) for (const k of keys) rig.style.setProperty(`--${k}`, current[k].toFixed(2) + units[k]);
    return moving;
  };

  // The loop parks itself when the figure settles or scrolls out of view.
  let raf = 0;
  let visible = true;
  const loop = () => { raf = 0; if (step() && visible) raf = requestAnimationFrame(loop); };
  const start = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };

  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { measure(); start(); } })
    .observe(rig);

  measure();
  addEventListener('resize', measure, { passive: true });
  addEventListener('scroll', measure, { passive: true });
  if (!coarse.matches) addEventListener('pointermove', onMove, { passive: true });

  onMotionChange(() => {
    if (reduceMotion()) { target.rx = target.ry = target.tilt = 0; start(); }
  });
}
