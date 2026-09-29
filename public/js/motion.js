/* motion.js — one place to ask "should we animate?".
   Motion is ON by default: the seasons are meant to be seen moving. The
   "Pause motion" buttons ([data-motion-toggle]) switch every animation off and
   the choice is remembered on this device — that's the WCAG 2.2.2 "pause, stop,
   hide" mechanism for anything that moves on its own. boot.js applies a saved
   choice (or ?motion=off / ?motion=on) before first paint as data-motion="off". */
const root = document.documentElement;
const KEY = 'levi-motion';
const EVENT = 'levi:motion';

export const reduceMotion = () => root.dataset.motion === 'off';
export const onMotionChange = (cb) => document.addEventListener(EVENT, cb);

export function setMotion(on) {
  if (on) delete root.dataset.motion;
  else root.dataset.motion = 'off';
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked — this visit only */ }
  document.dispatchEvent(new CustomEvent(EVENT));
}

/** Wire every [data-motion-toggle] button: label + icon follow the state. */
export function initMotionToggles() {
  const buttons = [...document.querySelectorAll('[data-motion-toggle]')];
  if (!buttons.length) return;
  const sync = () => {
    const paused = reduceMotion();
    for (const b of buttons) {
      b.dataset.state = paused ? 'paused' : 'playing';
      b.querySelector('[data-motion-label]').textContent = paused ? 'Play motion' : 'Pause motion';
    }
  };
  for (const b of buttons) {
    b.hidden = false; // no JS → no animation to pause → button stays hidden
    b.addEventListener('click', () => setMotion(reduceMotion()));
  }
  onMotionChange(sync);
  sync();
}
