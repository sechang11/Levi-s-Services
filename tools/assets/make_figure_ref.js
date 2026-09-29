// Build a standalone page that renders just Levi's cartoon bust (for AI reference images).
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../public');
const OUT = process.argv[2];

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const start = html.indexOf('<svg class="head-svg"');
const end = html.indexOf('</svg>', html.indexOf('<!-- 11 · front locs')) + '</svg>'.length;
if (start < 0 || end < start) throw new Error('head svg not found');
const svg = html.slice(start, end);

const page = `<!doctype html>
<html data-season="fall"><head><meta charset="utf-8">
<script>var s=new URLSearchParams(location.search).get('season'); if(s) document.documentElement.dataset.season=s;</script>
<link rel="stylesheet" href="http://localhost:5173/styles.css">
<link rel="stylesheet" href="http://localhost:5173/seasons.css">
<style>
  html, body { margin:0 !important; background:#ECE7DF !important; overflow:hidden; }
  body::before, body::after { display:none !important; }
  .rig { --px:0px; --py:0px; width:900px; height:1020px; }
  .blink, .head-svg { animation:none !important; }
  .lyr { transform:none !important; }
</style></head>
<body><div class="rig" data-expression="neutral">${svg}</div></body></html>`;
fs.writeFileSync(OUT, page);
console.log('wrote', OUT, svg.length, 'chars of svg');
