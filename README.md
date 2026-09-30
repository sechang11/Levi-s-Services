# Levi Builds — contractor site (v2)

A one-page site for Levi, a local contractor: renovations, repairs, new builds, **Clear Path Snow Removal** (driveways, walkways, steps and sidewalks) and **handmade wood furniture**. It has an interactive figure of Levi whose eyes follow your cursor, and **four seasonal themes** that switch automatically with the calendar. A separate [print kit](#business-cards) has his business cards, one per season.

Everything in `[brackets]` is placeholder copy, and the images are placeholders waiting for Levi's real photos. The site is built so those drop in without code changes.

---

## What's in v2

- **Four seasonal themes.** Winter, spring, summer and fall each change the colors, the falling particles (snow, petals, fireflies, leaves), Levi's outfit, the hero message, and which service leads the list. The theme picks itself from today's date, and visitors can switch it from the header.
- **Clear Path Snow Removal.** A new service with its own gallery. In winter it moves to the top of the list, and the hero shows a snowbank with a shoveled path cut through it.
- **My Story section.** Slots for photos of Levi, Levi on the job, his passions ("Off the clock") and his family, plus reviews. Every photo opens in the gallery viewer.
- **A quote form that works.** Requests can go straight to Levi's phone (see *Quote requests* below). Until that's set up, the form opens the visitor's email app.
- **Other additions:** a header with click-to-call, a checklist and a "Get a quote" button for every service, trust badges, SEO metadata and structured data, a favicon, and a 404 page.
- **Accessibility and hosting:** motion is on by default, with a **Pause motion** button (hero corner and footer) that stops every animation and is remembered on that device. The site supports keyboard navigation throughout and prints cleanly. A small zero-dependency server makes it ready for Railway.
- **The Woodshop.** A section under the services list for Levi's handmade furniture: a walnut-textured panel, the kinds of pieces he builds, a photo gallery, and a **Commission a piece** button that starts a quote for *Custom Furniture*.
- **Business cards.** Four seasonal designs plus a year-round Classic, print-ready PDFs, and a demo page at `/cards/` (see [Business cards](#business-cards)).
- **Photo placeholders and before/after sliders.** Every service has six realistic placeholder photos, rendered locally with no people in them, and a **drag-to-compare before/after slider**. Each "after" is an edit of its "before", so the pair shows the same room. Every one of these images is stamped **PLACEHOLDER** in the pixels, so none can pass as Levi's work, even when saved or shared on its own. Swap in real photos as they arrive (see *When Levi's photos arrive*).
- **Recent work.** One card per job, with filters by service. Each card opens a job viewer showing the before/after slider, the story, the client's words and every photo. A job can be shared as a link (`/#job-…`), and a phone's back gesture closes the viewer instead of leaving the site. **Jobs are the only place photos are listed**: every service's gallery and slider are gathered from the jobs tagged with it, so adding one real job updates everything (see [Adding a real job](#adding-a-real-job)). Closed service rows show a small photo, so the list scans at a glance.
- **Seasonal home checklist.** Five to-dos for the current season (for fall: gutters, flashing, driveway cracks), with a quote link for anyone who'd rather not do them.
- **Easier to act on.**
  - *How it works* (three steps) and a closing *Got a project in mind?* panel with **Text a photo** (an `sms:` link), Call and Quote buttons.
  - An FAQ under the quote form.
  - **On phones**, a Call · Text · Free quote bar sits at the bottom of the screen once the hero scrolls away. It steps aside over the quote form and the footer, and while typing.
  - The quote form asks the **best way to reach** the customer (text, call or email) and their **timeline**. Both show up in the notification, and the thank-you message promises the right kind of reply.
  - Tabs now live in the address bar (`#services`, `#story`, `#contact`), so links can be shared and the phone's Back button steps between tabs.
  - `/#snow` (or any service id) opens that service directly, which is handy on a flyer or in an ad.
- **Faster first paint.** The season's hero photo starts downloading from `<head>` instead of after the scripts load. A `sitemap.xml` is served, and `robots.txt` points to it.

---

## Run it locally

Commands are for Windows PowerShell, run from the project folder.

```powershell
npm start
```

Then open <http://localhost:5173>. The server uses `$env:PORT` if it's set.

> You need the server: the scripts are ES modules, so opening `public/index.html` directly from disk won't run them.

Two URL options are useful for previewing:

- `?season=winter`, `?season=spring`, `?season=summer` or `?season=fall` forces a season.
- `?motion=off` / `?motion=on` sets the motion preference, the same as the **Pause motion** button (saved on that device).
- `#contact`, `#story`, `#snow`, `#decks`, `#woodshop` and similar jump straight to that tab or service.

---

## Deploy on Railway

1. On [railway.com](https://railway.com), choose **New Project → Deploy from GitHub repo → `sechang11/Levi-s-Services`**.
2. Railway detects Node from `package.json`. `railway.json` sets the start command (`node server.js`), a health check at `/healthz`, and restart-on-failure.
3. Go to **Settings → Networking → Generate Domain** to get a public URL. You can add a custom domain in the same place.
4. *(Optional)* Go to **Variables** and add `QUOTE_WEBHOOK_URL`; see the next section.
5. *(Optional)* Once you have a custom domain, add `SITE_URL` (e.g. `https://levibuilds.com`) under **Variables**. Link previews already work without it, because the server fills in absolute URLs from the address each visitor used. `SITE_URL` just pins them to one canonical address.

6. *(Optional, later)* Once Levi has a Google Business Profile, add `REVIEW_URL` with his "write a review" link. Then:
   - `your-domain/review` forwards to it, a short link to text clients after every job.
   - A **Leave Levi a review** button appears under the reviews in *My Story*. Until then the button stays hidden.

Every push to `main` redeploys automatically.

---

## Quote requests on Levi's phone (`QUOTE_WEBHOOK_URL`)

The form posts to `/api/quote`. The server validates the request, rate-limits it, drops spam bots (hidden honeypot field), and forwards it to whatever webhook you set:

| Option | Setup | Value for `QUOTE_WEBHOOK_URL` |
|---|---|---|
| **ntfy** (push notification, free) | Install the ntfy app and subscribe to a long, random topic name | `https://ntfy.sh/levi-quotes-<random>` |
| **Discord** | Channel → Integrations → Webhooks → New → Copy URL | the webhook URL |
| **Slack** | Create an Incoming Webhook | the webhook URL |

Anyone who knows an ntfy topic name can read it, so make the name long and random.

If the variable isn't set, or delivery fails, the visitor's email app opens with the details filled in and addressed to `CONTACT.email` in `public/js/content.js`, so no lead is lost.

To test locally in one PowerShell window:

```powershell
$env:QUOTE_WEBHOOK_URL = 'https://ntfy.sh/your-random-topic'
```

```powershell
npm start
```

---

## The four seasons

| Season | Months | Look | Hero scene | Levi wears | Featured service |
|---|---|---|---|---|---|
| Winter · *Frost* | Dec–Feb | violet + ice blue, silver, snowfall with ice crystals | blue-hour street with a freshly cleared driveway | beanie + knit scarf | **Clear Path Snow Removal** |
| Spring · *Bloom* | Mar–May | lilac + fresh green, rose gold, petals | pre-dawn blossoms and a new concrete walkway | varsity jacket | Concrete & Masonry |
| Summer · *Golden Hour* | Jun–Aug | magenta + sunset orange, gold, fireflies | sunset over a new cedar deck | tee + shades | Decks & Fencing |
| Fall · *Harvest* | Sep–Nov | plum + burnt orange, copper, real falling leaves | dusk, new roof with copper gutters | flannel | Roofing & Gutters |

**Seasonal imagery.** Each season has a cinematic backdrop behind the hero, shown under a legibility scrim with a slow drift. Phones get a separate vertical composition. The page is tinted by a tiny blurred copy of the same image. The falling particles are real cut-out leaves, blossom petals and snow crystals. Files load in AVIF with a WebP fallback, and only the active season's images download:

- Backdrops: about 35–95 KB each.
- Sprite sheets: 18–35 KB each.
- Tints: 0.3 KB each.

These backdrops are atmospheric scenes, not Levi's jobs; his real project photos go in the service galleries. The images were rendered locally with Z-Image Turbo (Apache-2.0), which allows commercial use. [`tools/assets/`](tools/assets/README.md) has the prompts and the pipeline to re-render them.

- A season a visitor picks lasts for their visit.
- You can share a link to a specific season, e.g. `https://your-domain/?season=winter` for a snow-season promotion.
- To change colors, edit `public/seasons.css`. Purple is the brand color in every season, and every button color passes contrast checks with white text.
- To change the words, featured service or services list, edit `public/js/content.js`.

---

## Business cards

Open **`/cards/`** on the running site (e.g. <http://localhost:5173/cards/>) to see every design, front and back, with download links. The page isn't linked from the site and search engines are told to skip it.

- **Five designs.** Winter (Levi in a Santa hat, shoveling a driveway: *Clear Path Snow Removal*), Spring (*Concrete & Masonry*), Summer (*Decks & Fencing*), Fall (*Roofing & Gutters*), plus a year-round **Classic**.
- **One shared back.** Name and title, phone, email, service area, a QR code to the website, every service with that season's pick starred at the top, *Licensed & insured*, the license number, and *Free estimates*.
- **Print files** live in `public/cards/print/`: one PDF per design with two pages (front, back). Each page is 3.75 × 2.25 in, which is the 3.5 × 2 in US card plus a 0.125 in bleed, so upload them as-is. Fonts are embedded as TrueType and the artwork is 300+ ppi. `print/cmyk/` has CMYK conversions for printers that require CMYK.

**Before ordering**, fill in the placeholders in `public/cards/cards.js`: last name, email, website, city and license number. The phone number is there too. The services list and seasonal picks come from `public/js/content.js`. Then re-export:

```powershell
node tools/export-cards.js
```

(`npm run cards` does the same.) This uses Edge or Chrome to rebuild the PDFs in about 10 seconds. To rebuild one design, add its name (e.g. `node tools/export-cards.js winter`).

- **CMYK needs Ghostscript.** With Ghostscript on the PATH, the export also rebuilds `print/cmyk/`. Without it, the export deletes the old CMYK copies rather than leave outdated contact details lying around, and the demo page hides those links.
- **The QR code** always encodes the `url` in `cards.js`. Keep that URL short: the dots get bigger and scan more easily.

**Ordering tips:**

- Paper: 16 pt matte or soft-touch, with standard corners.
- Order a printed proof first, since dark purples print slightly darker than on screen.
- Order 250–500 of each seasonal card a few weeks before its season.

The card art was rendered from the site's cartoon of Levi. When his real photo arrives, [`tools/assets`](tools/assets/README.md#business-card-art) re-renders all five designs from it.

---

## Adding a real job

Jobs live in `PROJECTS` in `public/js/content.js`, newest first. For each one:

1. Put the photos in a folder, named after the job: `maple-kitchen-01.jpg`, `maple-kitchen-02.jpg` and so on.
2. Run `tools/assets/process_photos.py` on the folder. It makes the two sizes the site needs, turns photos upright, and strips the GPS location phones hide in them. Copy what it produces into `public/assets/projects/`.
3. Add an entry to `PROJECTS`:

```js
{
  id: 'maple-kitchen', title: 'Kitchen remodel', area: 'Maple Heights',
  when: 'May 2027', length: '3 weeks', services: ['kitchen', 'demolition', 'flooring'],
  summary: 'Two or three sentences: what they needed, what Levi did, how it turned out.',
  quote: { text: "Only with the client's OK.", name: 'Dana R.' },   // optional
  photos: [
    { file: 'maple-kitchen-01', label: 'Before' },
    { file: 'maple-kitchen-02', label: 'Tear-out', services: ['demolition'] },
    { file: 'maple-kitchen-05', label: 'After' },
  ],
  before: 0, after: 2,   // photo positions (from 0) for the before/after slider; optional
},
```

- `services` decides where the job shows up. It appears under those filters in *Recent work*, and its photos join those services' galleries. A photo with its own `services` only goes to those.
- Delete the `sample: true` placeholder jobs as real ones replace them.

---

## When Levi's photos arrive

| Photo | Where it goes |
|---|---|
| Headshot (front-facing, even light) | `public/assets/photos/levi-portrait.*`; it can also power the interactive head (see below) |
| Levi working | `public/assets/photos/work-01.*` |
| His passions (3) | `public/assets/photos/passion-01…03.*`, plus captions in `index.html` → *Off the clock* |
| His family | `public/assets/photos/family-01.*`, plus the paragraph in *Who I build for* |
| Job photos | One entry per job in `PROJECTS` in `public/js/content.js`, with its photos in `public/assets/projects/` (see [Adding a real job](#adding-a-real-job)). For the slider, take the *before* and *after* from the same spot. |
| Furniture he's built (5) | `public/assets/projects/woodshop-01…05.webp` + `-sm.webp`, plus the captions and `alt` text in `index.html` → *The Woodshop* |
| His tattoos | Traced into line art for `public/assets/tattoo.svg` (see *Levi's tattoos* below) |

Before publishing any photo:

- **Strip location data.** Phone photos often record GPS coordinates, which could reveal where the family lives. [Squoosh](https://squoosh.app) removes it on export. In Windows, use right-click → Properties → Details → *Remove Properties and Personal Information*.
- **Get consent for family photos,** especially of kids.
- For job and furniture photos, [`tools/assets/process_photos.py`](tools/assets/process_photos.py) makes both sizes the site needs (`name.webp` 1280×720 and `name-sm.webp` 640×360). It crops to 16:9, turns each photo upright and strips all metadata, including GPS. For the other photos, resize to about 1600px on the long edge and save as WebP or JPG (roughly 200–400 KB each).
- Write real `alt` text describing each photo.

## Using Levi's real photo for the interactive head

The head is a layered rig driven by CSS variables (`--rx --ry --tilt --px --py`) and a `data-expression` of `neutral`, `stern` or `happy`. The controller is `public/js/head.js`. To use photos:

1. Generate three expression images from one headshot: neutral, smile and stern. They must line up pixel-for-pixel. Optionally add separate eye-white and pupil sprites for live eye tracking.
2. Inside `.head-rig`, replace the placeholder `<svg class="head-svg">` with stacked `<img>` layers, and cross-fade them on `[data-expression]` the same way the SVG layers do.
3. No JavaScript changes are needed.

The seasonal outfits belong to the placeholder illustration, so they won't carry over to a photo.

## Levi's tattoos

`public/assets/tattoo.svg` is tiled across the background as a faint etched texture. Replace it with his real tattoo line art: black strokes, no fill, about 2px lines. Nothing else needs to change.

---

## Launch checklist

- [ ] Replace every `[bracketed]` placeholder in `public/index.html`: city, years, stats, hours, license, passions, family, the head-photo captions.
- [ ] **Publish real reviews only.** Delete the placeholder review cards until you have real ones.
- [ ] Add Levi's real jobs as they come in and delete the `sample: true` placeholder jobs in `content.js`. Aim for 3–4 real ones before promoting the site hard.
- [ ] Fill in the towns he serves in the *Got a project in mind?* panel (`index.html`), and set `REVIEW_URL` once his Google Business Profile exists.
- [ ] Confirm the bracketed FAQ answers (snow plans, start times, permits) and the *How it works* turnaround.
- [ ] Phone number: find and replace `(555) 555-0142` and `+15555550142` in `public/index.html`, `public/js/content.js` and `public/cards/cards.js`.
- [ ] Email: find and replace `levi@example.com` in the same two files.
- [ ] Update the JSON-LD block in the `<head>` of `index.html`: phone, email, area served.
- [ ] Set `QUOTE_WEBHOOK_URL` on Railway.
- [ ] Woodshop: confirm the kinds of pieces he builds, the woods, and the lead time (`index.html` → *The Woodshop*).
- [ ] Business cards: fill in `public/cards/cards.js` and re-export (see [Business cards](#business-cards)).

---

## Project structure

```
server.js          zero-dependency production server (static files, compression, CSP, /healthz,
                   /api/quote, fills in absolute URLs for share cards)
package.json       "npm start"; Railway detects Node from this
railway.json       start command, health check, restart policy
tools/
  gen-placeholders.js   regenerates the line-art placeholders for My Story + the map (npm run placeholders)
  export-cards.js       re-exports the business-card PDFs (node tools/export-cards.js)
  assets/               prompts + pipeline that rendered the seasonal imagery and card art on the GPU box
public/
  index.html  404.html  favicon.svg  robots.txt  sitemap.xml  site.webmanifest
  og-image.jpg       1200×630 share card (four seasons)
  apple-touch-icon.png  icon-512.png
  styles.css         layout & components (colors come from seasonal tokens)
  seasons.css        the four seasonal themes + Levi's outfits + hero decor
  js/
    boot.js          sets the season before first paint (no flash)
    main.js          wires everything together
    content.js       services, jobs (Recent work), seasonal messaging + checklists  ← edit copy here
    projects.js      Recent work cards, filters and the job viewer
    ba.js            the before/after slider
    actionbar.js     the Call · Text · Free quote bar on phones
    seasons.js       switcher, circular reveal, featured service
    fx.js            seasonal particles (canvas)
    head.js          the interactive figure
    services.js      accordion + galleries
    tabs.js          Services / My Story / Contact tabs
    lightbox.js      photo viewer
    form.js          quote form
    motion.js        motion on/off + the Pause motion buttons
  assets/
    tattoo.svg  map.svg
    seasons/         hero backdrops (desktop + mobile, AVIF/WebP), page tints, particle sprites
    photos/          Levi, work, passions, family
    projects/        6 job photos per service + 5 woodshop pieces (placeholders, .webp + -sm.webp)
    woodshop/        walnut texture behind the Woodshop section
  cards/             business cards: demo page (index.html), print.html, cards.js (card data),
                     qr.js (QR encoder), art/ (card illustrations), print/ (PDFs, + cmyk/)
```
