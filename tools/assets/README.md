# Seasonal asset pipeline

The seasonal hero backdrops, particle sprites, share card and app icons in `public/` were rendered on a local GPU box (Fedora, RTX 5090) through its running **ComfyUI** server. These scripts reproduce them. The prompts in them are effectively the source of the images.

| Model | Used for | License |
|---|---|---|
| **Z-Image Turbo** (`z_image_turbo_bf16`, text encoder `qwen_3_4b`, VAE `ae`) | backdrops, sprites, placeholder job photos | Apache-2.0: commercial use OK |
| **BiRefNet** (ComfyUI `RemoveBackground`) | sprite and portrait cut-outs | MIT |
| **Qwen-Image-Edit 2511** (`qwen_image_edit_2511_fp8mixed`, text encoder `qwen_2.5_vl_7b`, VAE `qwen_image_vae`) + the **Lightning** 4-step LoRA | business-card art: restages Levi from a reference image | Apache-2.0 |

The backdrops are **atmospheric scenes**, not Levi's work. Keep them in the hero, and never present them as project photos. Real job photos go in `public/assets/projects/`.

## Pipeline

Copy this folder to the GPU box (e.g. `~/levi-assets`), then run:

```bash
python3 make_backdrop_jobs.py backdrops.json      # 4 seasons × (4 desktop 1920×1088 + 3 mobile 1088×1920)
python3 make_spring2_jobs.py spring2.json         # spring re-render: low-key pre-dawn to match the others
python3 make_sprite_jobs.py sprites.json          # leaves / petals / snow crystals, background removed
python3 comfy_run.py backdrops.json               # queue on ComfyUI (127.0.0.1:8188) and wait
python3 comfy_run.py spring2.json
python3 comfy_run.py sprites.json
bash sheets.sh                                    # contact sheets to pick from
~/ComfyUI/venv/bin/python sprite_sheet_review.py  # sprite cut-outs on the site's dark background
# edit picks.json with the chosen seeds, then:
~/ComfyUI/venv/bin/python process_assets.py picks.json   # → out/seasons/*.avif|webp, sprite sheets, atmos tints
~/ComfyUI/venv/bin/python compose_brand.py picks.json    # → out/og-image.jpg, apple-touch-icon.png, icon-512.png
```

Copy `out/seasons/*` to `public/assets/seasons/`, and the other three files to `public/`.

## What gets produced

- `{season}-desktop-{1280,1920}.{avif,webp}` and `{season}-mobile-{720,1088}.{avif,webp}`: hero backdrops. They're pre-blurred slightly to shed film grain, which is invisible at backdrop opacity and saves a lot of bytes. Each is about 35–95 KB as AVIF.
- `{season}-atmos.webp`: a 160×90, darkened, pre-blurred copy that tints the whole page (about 0.3 KB).
- `{fall,spring,winter}-sprites.webp`: one-row sprite sheets for `public/js/fx.js`. The cell count and size must match `SHEETS` there.
- `og-image.jpg` (1200×630 share card), `apple-touch-icon.png` (180, full-bleed) and `icon-512.png`.

All generation settings are deterministic (fixed seeds), so the same picks reproduce the same files.

## Business-card art

The card fronts in `public/cards/art/` show Levi on each season's headline job, plus a studio portrait for the year-round Classic card. The same pipeline also produced the walnut texture behind the site's Woodshop section.

**The reference image.** Qwen-Image-Edit restages a *reference* image of Levi. For now that is the site's own cartoon, rendered once per season so he's already in that season's outfit:

```bash
node make_figure_ref.js figure-ref.html
```

That writes a page with just the figure. Serve the site, open `figure-ref.html?season=winter` (and the other three seasons), and screenshot each at 900×1020. Upload the screenshots to the box as `~/ComfyUI/input/levi_ref_{season}.png`.

**Render and pick:**

```bash
python3 make_card_jobs.py cards.json                   # 4 seasons × 5 candidates, 5 Classic portraits, 2 walnut textures
python3 comfy_run.py cards.json                        # ~12 minutes on an RTX 5090
bash sheets.sh                                         # includes sheets/cards_{season}.jpg
# put the chosen stems under "cards" (and "wood") in picks.json, then:
~/ComfyUI/venv/bin/python process_assets.py picks.json # → out/cards/{season}.jpg, classic.png; out/woodshop/walnut-1600.*
```

Copy `out/cards/*` to `public/cards/art/` and `out/woodshop/*` to `public/assets/woodshop/`, then re-export the PDFs (`node tools/export-cards.js`).

- `make_card_jobs.py` takes an optional filter such as `winter classic` to re-render only those.
- Each season gets 3 Lightning renders (4 steps, about 5 s) and 2 full-quality renders (30 steps, about 65 s).
- The Classic portrait is cut out with BiRefNet, so the card's own background shows through.

**Redo them with Levi's real photo.** This is the upgrade for when his photos arrive:

1. Use one clear, front-facing photo as the reference. Upload it as `levi_ref_{season}.png`, or point `ref` in `make_card_jobs.py` at one file.
2. Change the `KEEP` sentence to describe *him* ("keep his face, hairstyle, beard and tattoos exactly as in the photo").
3. Keep the `STYLE` sentence if the cards should stay illustrated, so they match the site's look. Replace it with a photographic style to make them look like real photos.
4. His **tattoo photos** can become line art for the site's etched background (`public/assets/tattoo.svg`). Trace them into clean black strokes rather than using AI renders, so the art is really his.

Keep these renders on the cards and in the hero. They're illustrations of the kind of work he does, not photos of his jobs.

## Placeholder job photos

The service galleries, the before/after sliders and the Woodshop show realistic **placeholder** photos until Levi's own arrive. There are six per service and five furniture pieces, 59 in all.

- **No people** appear in any of them, so a stranger can't be mistaken for Levi.
- **Every file is stamped PLACEHOLDER** in the pixels.

```bash
python3 make_placeholder_jobs.py a.json            # 50 Z-Image renders: every shot except the "after"s (~3 min)
python3 comfy_run.py a.json
python3 make_placeholder_jobs.py b.json --after    # 9 Qwen-Image-Edit "after"s, each edited from its "before" (~10 min)
python3 comfy_run.py b.json
~/ComfyUI/venv/bin/python process_placeholders.py  # → out/projects/{id}-0N.webp + -sm.webp, labeled
```

Copy `out/projects/*` to `public/assets/projects/`.

- **Re-roll individual shots** with `--only decks_detail,kitchen_before --seed 23`. If a *before* changes, run `--after --only <service>_after` too, so the pair still matches.
- **Keep camera words out of prompts.** Phrases like "full-frame camera, 24-70mm lens" put actual cameras into the scenes. The style line says "no cameras" for that reason.
- **Real photos** replace these through [`process_photos.py`](process_photos.py), which writes the same two sizes and strips GPS and other metadata.

