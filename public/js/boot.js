/* boot.js — runs before first paint (tiny, render-blocking on purpose) so the
   right seasonal theme is applied with no flash of the wrong one.
   Priority: ?season=… in the URL → this visit's pick → today's date. */
(function () {
  var SEASONS = ['spring', 'summer', 'fall', 'winter'];
  var root = document.documentElement;
  var pick = null;
  try {
    var params = new URLSearchParams(location.search);
    var q = params.get('season');
    if (q && SEASONS.indexOf(q) > -1) {
      pick = q;
      sessionStorage.setItem('levi-season', q);
    } else {
      pick = sessionStorage.getItem('levi-season');
    }
    // ?motion=full previews every animation even if the OS asks to reduce motion
    if (params.get('motion') === 'full') sessionStorage.setItem('levi-motion', 'full');
    if (sessionStorage.getItem('levi-motion') === 'full') root.setAttribute('data-motion', 'full');
  } catch (e) { /* storage blocked — fall back to the date */ }

  if (SEASONS.indexOf(pick) < 0) {
    var m = new Date().getMonth(); // 0 = January (northern-hemisphere seasons)
    pick = m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'fall';
  }
  root.setAttribute('data-season', pick);
  root.classList.add('js');
})();
