# Seasonal asset pipeline

The seasonal hero backdrops, particle sprites, share card and app icons in `public/` were rendered on a local GPU box (Fedora, RTX 5090) through its running **ComfyUI** server. These scripts reproduce them. The prompts in them are effectively the source of the images.

| Model | Used for | License |
|---|---|---|
| **Z-Image Turbo** (`z_image_turbo_bf16`, text encoder `qwen_3_4b`, VAE `ae`) | backdrops + sprites | Apache-2.0: commercial use OK |
| **BiRefNet** (ComfyUI `RemoveBackground`) | sprite cut-outs | MIT |

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
