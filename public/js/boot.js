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

  // Start the season's hero photo now instead of when the scripts get to it: it's
  // the biggest thing on the first screen. Same files and widths seasons.js uses.
  var base = 'assets/seasons/' + pick + '-';
  [['(orientation: portrait)', 'mobile', 720, 1088], ['(orientation: landscape)', 'desktop', 1280, 1920]].forEach(function (v) {
    var l = document.createElement('link');
    l.rel = 'preload';
    l.as = 'image';
    l.type = 'image/avif'; // browsers without AVIF skip it and take the WebP later
    l.media = v[0];
    l.setAttribute('imagesrcset', base + v[1] + '-' + v[2] + '.avif ' + v[2] + 'w, ' + base + v[1] + '-' + v[3] + '.avif ' + v[3] + 'w');
    l.setAttribute('imagesizes', '100vw');
    l.setAttribute('fetchpriority', 'high');
    document.head.appendChild(l);
  });
})();
