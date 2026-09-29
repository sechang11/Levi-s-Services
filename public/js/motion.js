/* motion.js — one place to ask "should we animate?".
   Honors the visitor's OS "reduce motion" setting, unless the page was opened
   with ?motion=full (boot.js sets data-motion="full") for demos/previews. */
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;

export const reduceMotion = () => root.dataset.motion !== 'full' && mq.matches;
export const onMotionChange = (cb) => mq.addEventListener('change', cb);
