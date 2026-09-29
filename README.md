# Levi Builds — contractor site (v2)

A one-page site for Levi, a local contractor: renovations, repairs, new builds and **Clear Path Snow Removal** (driveways, walkways, steps and sidewalks). It has an interactive figure of Levi whose eyes follow your cursor, and **four seasonal themes** that switch automatically with the calendar.

Everything in `[brackets]` is placeholder copy, and the images are placeholders waiting for Levi's real photos. The site is built so those drop in without code changes.

---

## What's in v2

- **Four seasonal themes.** Winter, spring, summer and fall each change the colors, the falling particles (snow, petals, fireflies, leaves), Levi's outfit, the hero message, and which service leads the list. The theme picks itself from today's date, and visitors can switch it from the header.
- **Clear Path Snow Removal.** A new service with its own gallery. In winter it moves to the top of the list, and the hero shows a snowbank with a shoveled path cut through it.
- **My Story section.** Slots for photos of Levi, Levi on the job, his passions ("Off the clock") and his family, plus reviews. Every photo opens in the gallery viewer.
- **A quote form that works.** Requests can go straight to Levi's phone (see *Quote requests* below). Until that's set up, the form opens the visitor's email app.
- **Other additions:** a header with click-to-call, a checklist and a "Get a quote" button for every service, trust badges, SEO metadata and structured data, a favicon, and a 404 page.
- **Accessibility and hosting:** the site respects the "reduce motion" setting, supports keyboard navigation throughout, and prints cleanly. A small zero-dependency server makes it ready for Railway.

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
- `?motion=full` shows every animation even if Windows has **Animation effects** turned off. If Animation effects is off (*Settings → Accessibility → Visual effects*), the site holds still on purpose.

---

## Deploy on Railway

1. On [railway.com](https://railway.com), choose **New Project → Deploy from GitHub repo → `sechang11/Levi-s-Services`**.
2. Railway detects Node from `package.json`. `railway.json` sets the start command (`node server.js`), a health check at `/healthz`, and restart-on-failure.
3. Go to **Settings → Networking → Generate Domain** to get a public URL. You can add a custom domain in the same place.
4. *(Optional)* Go to **Variables** and add `QUOTE_WEBHOOK_URL`; see the next section.

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

| Season | Months | Look | Levi wears | Featured service |
|---|---|---|---|---|
| Winter · *Frost* | Dec–Feb | violet + ice blue, silver, snowfall | beanie + knit scarf | **Clear Path Snow Removal** |
| Spring · *Bloom* | Mar–May | lilac + fresh green, rose gold, petals | varsity jacket | Concrete & Masonry |
| Summer · *Golden Hour* | Jun–Aug | magenta + sunset orange, gold, fireflies | tee + shades | Decks & Fencing |
| Fall · *Harvest* | Sep–Nov | plum + burnt orange, copper, leaves | flannel | Roofing & Gutters |

- A season a visitor picks lasts for their visit.
- You can share a link to a specific season, e.g. `https://your-domain/?season=winter` for a snow-season promotion.
- To change colors, edit `public/seasons.css`. Purple is the brand color in every season, and every button color passes contrast checks with white text.
- To change the words, featured service or services list, edit `public/js/content.js`.

---

## When Levi's photos arrive

| Photo | Where it goes |
|---|---|
| Headshot (front-facing, even light) | `public/assets/photos/levi-portrait.*`; it can also power the interactive head (see below) |
| Levi working | `public/assets/photos/work-01.*` |
| His passions (3) | `public/assets/photos/passion-01…03.*`, plus captions in `index.html` → *Off the clock* |
| His family | `public/assets/photos/family-01.*`, plus the paragraph in *Who I build for* |
| Job photos (6 per service) | `public/assets/projects/{service}-01…06.*`; if you switch from `.svg`, update the extension in `content.js` |

Before publishing any photo:

- **Strip location data.** Phone photos often record GPS coordinates, which could reveal where the family lives. [Squoosh](https://squoosh.app) removes it on export. In Windows, use right-click → Properties → Details → *Remove Properties and Personal Information*.
- **Get consent for family photos,** especially of kids.
- Resize to about 1600px on the long edge and save as WebP or JPG (roughly 200–400 KB each).
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
- [ ] Phone number: find and replace `(555) 555-0142` and `+15555550142` in `public/index.html` and `public/js/content.js`.
- [ ] Email: find and replace `levi@example.com` in the same two files.
- [ ] Update the JSON-LD block in the `<head>` of `index.html`: phone, email, area served.
- [ ] Set `QUOTE_WEBHOOK_URL` on Railway.

---

## Project structure

```
server.js          zero-dependency production server (static files, compression, CSP, /healthz, /api/quote)
package.json       "npm start"; Railway detects Node from this
railway.json       start command, health check, restart policy
tools/
  gen-placeholders.js   regenerates the placeholder images (npm run placeholders)
public/
  index.html  404.html  favicon.svg  robots.txt
  styles.css         layout & components (colors come from seasonal tokens)
  seasons.css        the four seasonal themes + Levi's outfits + hero decor
  js/
    boot.js          sets the season before first paint (no flash)
    main.js          wires everything together
    content.js       services, galleries, seasonal messaging  ← edit copy here
    seasons.js       switcher, circular reveal, featured service
    fx.js            seasonal particles (canvas)
    head.js          the interactive figure
    services.js      accordion + galleries
    tabs.js          Services / My Story / Contact tabs
    lightbox.js      photo viewer
    form.js          quote form
    motion.js        reduce-motion helper
  assets/
    tattoo.svg  map.svg
    photos/          Levi, work, passions, family
    projects/        6 job photos per service
```
