/* boot.js — runs before first paint (tiny, render-blocking on purpose) so the
   right seasonal theme is applied with no flash of the wrong one.
   Priority: ?season=… in the URL → this visit's pick → today's date.
   Motion is on unless the visitor paused it (saved on this device; see motion.js). */
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
    // ?motion=off / ?motion=on override the saved choice (the old ?motion=full means on)
    var mo = params.get('motion');
    if (mo === 'full') mo = 'on';
    if (mo === 'off' || mo === 'on') localStorage.setItem('levi-motion', mo);
    if (localStorage.getItem('levi-motion') === 'off') root.setAttribute('data-motion', 'off');
  } catch (e) { /* storage blocked — fall back to the date */ }

  if (SEASONS.indexOf(pick) < 0) {
    var m = new Date().getMonth(); // 0 = January (northern-hemisphere seasons)
    pick = m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'fall';
  }
  root.setAttribute('data-season', pick);
  root.classList.add('js');
})();
