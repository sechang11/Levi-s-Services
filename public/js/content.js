/* content.js — the words that change most often. Edit here to update the
   services list, each service's gallery, and the seasonal messaging.
   (Business name, phone, email and the My Story copy live in index.html.) */

export const CONTACT = {
  phoneDisplay: '(555) 555-0142',
  phoneHref: '+15555550142',
  email: 'levi@example.com', // the quote form falls back to emailing this address
};

/* Gallery helper: six photos per service at assets/projects/{id}-01…06.webp
   (1280×720, the lightbox + before/after slider) plus {id}-01…06-sm.webp
   (640×360 thumbnails). The current files are AI renders stamped PLACEHOLDER;
   swap in Levi's real photos by replacing them (keep both sizes).
   `compare` = which two shots (1-based) the before/after slider uses. */
const WORK_SHOTS = ['Wide', 'Before', 'In progress', 'Detail', 'After', 'Finish'];
const gallery = (id, name, labels = WORK_SHOTS) =>
  labels.map((label, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {
      src: `assets/projects/${id}-${n}.webp`,
      thumb: `assets/projects/${id}-${n}-sm.webp`,
      alt: `${name} — ${label.toLowerCase()} (placeholder photo)`,
      cap: `${name} · ${label}`,
    };
  });

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
    shots: ['Driveway', 'Walkway', 'Front steps', 'Sidewalk', 'Before', 'Night clearing'],
    compare: [5, 1], // the buried driveway → the same driveway cleared
  },
];
for (const s of SERVICES) {
  s.gallery = gallery(s.id, s.title, s.shots);
  s.compare ??= [2, 5]; // Before → After
}

export const serviceById = (id) => SERVICES.find((s) => s.id === id);

/* The Woodshop: Levi's handmade furniture (the section under the services
   list — its photos live in index.html). Not an accordion service, but it is a
   quote topic, so "Commission a piece" pre-selects it in the form. */
export const WOODSHOP = { id: 'furniture', title: 'Custom Furniture' };

/* What the quote form's "Service" menu offers, in order. */
export const QUOTE_TOPICS = [...SERVICES, WOODSHOP];
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
  },
  summer: {
    label: 'Summer',
    featured: 'decks',
    chip: 'Build season — decks & fences booking now',
    tagline: 'Long days, big builds. Decks, fences and additions done right the first time — licensed, insured, on schedule.',
    cta: 'Get a free quote',
  },
  fall: {
    label: 'Fall',
    featured: 'roofing',
    chip: 'Beat the freeze — roofs & gutters before first snow',
    tagline: 'Roofs, gutters and exterior work wrapped up before the first freeze — and when the snow comes, we clear it.',
    cta: 'Book before winter',
  },
  winter: {
    label: 'Winter',
    featured: 'snow',
    chip: 'Clear Path snow removal — driveways & walkways',
    tagline: "Driveways and walkways cleared before you're out the door — plus warm indoor remodels while the ground is frozen.",
    cta: 'Book snow clearing',
  },
};
