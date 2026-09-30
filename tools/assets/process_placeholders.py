#!/usr/bin/env python3
"""Placeholder job photos (make_placeholder_jobs.py) → site files, every one labeled PLACEHOLDER.
Run with ComfyUI's venv python (Pillow with WebP):
  ~/ComfyUI/venv/bin/python process_placeholders.py
Writes ~/levi-assets/out/projects/{service}-01..06.webp (1280×720, lightbox + before/after slider)
and {service}-01..06-sm.webp (640×360, gallery thumbnails); woodshop-01..05 likewise.
The label is burned into the pixels on purpose: these stand in for Levi's real job photos
and must read as placeholders everywhere, even saved or shared on their own."""
import os

from PIL import Image, ImageDraw, ImageFont

SRC = os.path.expanduser("~/ComfyUI/output/levi/ph")
OUT = os.path.expanduser("~/levi-assets/out/projects")
FONT = "/usr/share/fonts/liberation-mono-fonts/LiberationMono-Bold.ttf"

WORK = ["wide", "before", "progress", "detail", "after", "finish"]  # = WORK_SHOTS in public/js/content.js
ORDER = {s: WORK for s in ("demolition", "framing", "drywall", "decks", "flooring", "kitchen", "roofing", "concrete")}
ORDER["snow"] = ["driveway", "walkway", "steps", "sidewalk", "snowy", "night"]
ORDER["woodshop"] = ["table", "bench", "shelves", "board", "nightstand"]

SIZES = {"": (1280, 720, 22), "-sm": (640, 360, 16)}  # suffix: (w, h, label px)


def labeled(im, px):
    """Dark pill in the bottom-right corner (the site's overlays use the other three)."""
    im = im.convert("RGBA")
    font = ImageFont.truetype(FONT, px)
    text, track = "PLACEHOLDER", round(px * 0.14)
    widths = [font.getlength(c) for c in text]
    tw = sum(widths) + track * (len(text) - 1)
    padx, pady, margin = round(px * 0.75), round(px * 0.5), round(px * 0.8)
    w, h = round(tw + 2 * padx), round(px + 2 * pady)
    x0, y0 = im.width - margin - w, im.height - margin - h
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=h // 2, fill=(8, 9, 20, 190), outline=(255, 255, 255, 90), width=max(1, px // 14))
    x, y = x0 + padx, y0 + pady - round(px * 0.1)
    for c, cw in zip(text, widths):
        d.text((x, y), c, font=font, fill=(255, 255, 255, 235))
        x += cw + track
    return Image.alpha_composite(im, layer).convert("RGB")


def main():
    os.makedirs(OUT, exist_ok=True)
    for svc, shots in ORDER.items():
        for i, shot in enumerate(shots, 1):
            src = Image.open(f"{SRC}/{svc}_{shot}_00001_.png").convert("RGB")
            for suffix, (w, h, px) in SIZES.items():
                im = labeled(src.resize((w, h), Image.LANCZOS), px)
                im.save(f"{OUT}/{svc}-{i:02d}{suffix}.webp", quality=74 if not suffix else 72, method=6)
        print("placeholders", svc, len(shots), flush=True)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f"{len(os.listdir(OUT))} files, {total / 1024:.0f} KB total")


if __name__ == "__main__":
    main()
