/* content.js — the words that change most often. Edit here to update the
   services list, each service's gallery, and the seasonal messaging.
   (Business name, phone, email and the My Story copy live in index.html.) */

export const CONTACT = {
  phoneDisplay: '(555) 555-0142',
  phoneHref: '+15555550142',
  email: 'levi@example.com', // the quote form falls back to emailing this address
};

/* Base order of the accordion. Each season moves its "featured" service to
   the top (see SEASONS below). */
export const SERVICES = [
  {
    id: 'demolition',
    title: 'Demolition',
    desc: 'Selective tear-outs to full interior demo — dust-controlled, debris hauled away, and the site left broom-clean and ready for the rebuild.',
    points: ['Interior & selective tear-outs', 'Dust control & floor protection', 'Debris hauled away', 'Broom-clean finish'],
  },
  {
    id: 'framing',
    title: 'Framing & Carpentry',
    desc: 'Walls, additions, beams and custom carpentry, framed square and to code — the bones every good renovation is built on.',
    points: ['Walls, additions & beams', 'Finish & trim carpentry', 'Square, plumb and to code'],
  },
  {
    id: 'drywall',
    title: 'Drywall & Paint',
    desc: 'Hang, tape and finish, then a clean paint job with crisp lines. Walls that look factory-smooth.',
    points: ['Hang, tape & finish', 'Patches & repairs', 'Interior & exterior paint'],
  },
  {
    id: 'decks',
    title: 'Decks & Fencing',
    desc: 'Pressure-treated, composite and hardwood decks, plus privacy and ranch fencing built to last through the seasons.',
    points: ['Pressure-treated, composite & hardwood', 'Privacy & ranch fencing', 'Repairs, rebuilds & staining'],
  },
  {
    id: 'flooring',
    title: 'Flooring & Tile',
    desc: 'LVP, hardwood and tile — flat subfloors, tight seams, and grout lines you could check with a square.',
    points: ['LVP, hardwood & laminate', 'Tile floors, backsplashes & showers', 'Subfloor prep & leveling'],
  },
  {
    id: 'kitchen',
    title: 'Kitchen & Bath',
    desc: 'Full remodels — cabinetry, counters, fixtures, and the waterproofing done right behind the walls, not just on them.',
    points: ['Full & partial remodels', 'Cabinets, counters & fixtures', 'Waterproofing done right'],
  },
  {
    id: 'roofing',
    title: 'Roofing & Gutters',
    desc: 'Repairs, tear-offs and re-roofs, flashing that actually keeps water out, and seamless gutters that move it away from your foundation.',
    points: ['Repairs, tear-offs & re-roofs', 'Flashing & leak fixes', 'Seamless gutters & guards'],
  },
  {
    id: 'concrete',
    title: 'Concrete & Masonry',
    desc: 'Footings, slabs, driveways, walkways and patios — formed, poured and finished to spec, plus block and brick repair.',
    points: ['Driveways, walkways & patios', 'Steps, footings & slabs', 'Block & brick repair'],
  },
  {
    id: 'snow',
    title: 'Clear Path Snow Removal',
    tag: 'Winter',
    desc: "Clear Path keeps your place moving all winter. Levi clears driveways edge to edge and opens up every path to your door — walkways, front steps and sidewalks — so you're never stuck digging out.",
    points: ['Driveways cleared edge to edge', 'Walkways & paths to every door', 'Front steps & sidewalks', '[Per-storm or season-long plans — confirm details]'],
  },
  {
    id: 'furniture',
    title: 'Custom Furniture',
    tag: 'Woodshop',
    desc: "Solid-wood furniture built by hand in Levi's shop — dining tables, benches, shelves and one-off pieces, sized for your space and made to last.",
    points: ['Dining tables & benches', 'Floating shelves & built-ins', 'Cutting boards & gifts', '[Walnut · white oak · maple · reclaimed]'],
    more: { tab: 'woodshop', label: 'Visit the Woodshop' }, // its own tab has the full showcase
  },
];

export const serviceById = (id) => SERVICES.find((s) => s.id === id);

/* ---------------------------------------------------------------- jobs
   Recent work: one entry per job, NEWEST FIRST. Jobs are the single source of
   photos: they fill the Recent work section, and each service's gallery and
   before/after slider are gathered from the jobs tagged with that service.

   Photos live in assets/projects/ as <file>.webp (1280×720) + <file>-sm.webp
   (640×360); tools/assets/process_photos.py makes both from Levi's originals
   (and strips the GPS data phones put in them). A real job looks like:
     {
       id: 'maple-st-kitchen', title: 'Kitchen remodel', area: 'Maple Heights',
       when: 'May 2027', length: '3 weeks', services: ['kitchen', 'demolition', 'flooring'],
       summary: 'Two or three sentences: what they needed, what Levi did, how it turned out.',
       quote: { text: 'Only with the client’s OK.', name: 'Dana R.' },   // optional
       photos: [{ file: 'maple-kitchen-01', label: 'Before', services: ['demolition'] }, …],
       before: 0, after: 4,   // photo indexes for the slider (optional)
     }
   A photo without `services` counts for every service the job lists.
   The `sample: true` jobs below are PLACEHOLDERS built from the stamped
   renders: delete them as real jobs come in. */
const WORK_SHOTS = ['Wide', 'Before', 'In progress', 'Detail', 'After', 'Finish'];
const sampleShots = (prefix, labels = WORK_SHOTS) =>
  labels.map((label, i) => ({ file: `${prefix}-${String(i + 1).padStart(2, '0')}`, label }));
const sample = (service, title, extra = {}) => ({
  id: `sample-${service}`,
  sample: true,
  title: `[${title}]`,
  area: '[Neighborhood]',
  when: '[Month Year]',
  length: '[Time on site]',
  services: [service],
  summary: '[What the client needed, what Levi did, and how it turned out: two or three sentences.]',
  photos: sampleShots(service),
  before: 1,
  after: 4,
  ...extra,
});

export const PROJECTS = [
  sample('snow', 'Clear Path season plan', {
    length: '[Every storm, Dec–Mar]',
    photos: sampleShots('snow', ['Driveway', 'Walkway', 'Front steps', 'Sidewalk', 'Before', 'Night clearing']),
    before: 4, // the buried driveway → the same driveway cleared
    after: 0,
  }),
  sample('kitchen', 'Kitchen remodel'),
  sample('decks', 'Deck rebuild'),
  sample('roofing', 'Roof replacement'),
  sample('concrete', 'Walkway replacement'),
  sample('drywall', 'Drywall repair & repaint'),
  sample('flooring', 'New flooring'),
  sample('framing', 'Basement framing'),
  sample('demolition', 'Kitchen tear-out'),
  // Woodshop pieces: each commission is a job too (they fill the Woodshop tab)
  ...[
    ['table', 'Walnut dining table', 'woodshop-01'],
    ['bench', 'White oak entry bench', 'woodshop-02'],
    ['shelves', 'Floating walnut shelves', 'woodshop-03'],
    ['board', 'End-grain cutting board', 'woodshop-04'],
    ['nightstand', 'Walnut nightstand', 'woodshop-05'],
  ].map(([key, title, file]) => sample('furniture', title, {
    id: `sample-${key}`,
    length: '[Build time]',
    summary: '[The piece, the wood, the size, and what the client wanted it for.]',
    photos: [{ file, label: 'Finished piece' }],
    before: null,
    after: null,
  })),
];

const asset = (file, size = '') => `assets/projects/${file}${size}.webp`;
for (const p of PROJECTS) {
  for (const ph of p.photos) {
    ph.src = asset(ph.file);
    ph.thumb = asset(ph.file, '-sm');
    ph.alt ??= `${p.title.replace(/[[\]]/g, '')}: ${ph.label.toLowerCase()}${p.sample ? ' (placeholder photo)' : ''}`;
  }
}
export const projectById = (id) => PROJECTS.find((p) => p.id === id);

/* Each service's gallery (up to 6 photos, newest jobs first) and before/after
   pair, gathered from the jobs tagged with it. */
for (const s of SERVICES) {
  const jobs = PROJECTS.filter((p) => p.services.includes(s.id));
  s.jobs = jobs.length;
  s.gallery = jobs
    .flatMap((p) => p.photos.filter((ph) => !ph.services || ph.services.includes(s.id)))
    .slice(0, 6)
    .map((ph) => ({ src: ph.src, thumb: ph.thumb, alt: ph.alt, cap: `${s.title} · ${ph.label}` }));
  const pair = jobs.find((p) => p.before != null && p.after != null);
  s.compare = pair ? [pair.photos[pair.before], pair.photos[pair.after]] : null;
}

/* What the quote form's "Service" menu (and the business cards) list, in order. */
export const QUOTE_TOPICS = SERVICES;
export const topicById = (id) => QUOTE_TOPICS.find((s) => s.id === id);

/* Four seasonal themes. Colors live in seasons.css; this is the messaging.
   featured = the service that moves to the top of the list that season. */
export const SEASON_ORDER = ['spring', 'summer', 'fall', 'winter'];
export const SEASONS = {
  spring: {
    label: 'Spring',
    featured: 'concrete',
    chip: 'Spring thaw — fixing what winter broke',
    tagline: "Heaved walkways, cracked steps, tired walls — spring is when we fix what winter broke and start what's next.",
    cta: 'Plan a spring project',
    checklist: [
      'Walk your walkways and steps for frost heave, cracks and trip edges',
      'Check the deck for loose boards, popped nails and soft spots',
      'Clear the gutters after the spring seed and pollen drop',
      'Look for new water stains on ceilings after the thaw',
      'Book summer builds now: decks and fences fill up fast',
    ],
  },
  summer: {
    label: 'Summer',
    featured: 'decks',
    chip: 'Build season — decks & fences booking now',
    tagline: 'Long days, big builds. Decks, fences and additions done right the first time — licensed, insured, on schedule.',
    cta: 'Get a free quote',
    checklist: [
      'Re-stain or seal the deck (every 2–3 years keeps the wood happy)',
      'Push on fence posts: rot starts at the base',
      'Do exterior paint and siding repairs while the weather is dry',
      'Seal driveway cracks before the fall rains get in',
      'Book fall roof and gutter work before the rush',
    ],
  },
  fall: {
    label: 'Fall',
    featured: 'roofing',
    chip: 'Beat the freeze — roofs & gutters before first snow',
    tagline: 'Roofs, gutters and exterior work wrapped up before the first freeze — and when the snow comes, we clear it.',
    cta: 'Book before winter',
    checklist: [
      'Clean the gutters once the leaves are down',
      'Check shingles and flashing before the first freeze',
      'Seal cracks in the driveway and walkways',
      'Shut off and drain the outdoor faucets',
      'Line up snow removal before the first storm',
    ],
  },
  winter: {
    label: 'Winter',
    featured: 'snow',
    chip: 'Clear Path snow removal — driveways & walkways',
    tagline: "Driveways and walkways cleared before you're out the door — plus warm indoor remodels while the ground is frozen.",
    cta: 'Book snow clearing',
    checklist: [
      'Keep walkways, steps and sidewalks clear and salted',
      'Watch the roof edge for ice dams and big icicles',
      'Keep snow piles away from the foundation and vents',
      'Check windows and doors for drafts',
      'Plan spring remodels now, while the schedule is open',
    ],
  },
};
