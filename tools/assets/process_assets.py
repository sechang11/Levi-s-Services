#!/usr/bin/env python3
"""Turn chosen ComfyUI renders into web assets.
Run with ComfyUI's venv python (Pillow 12 with AVIF + numpy):
  ~/ComfyUI/venv/bin/python process_assets.py picks.json
picks.json = {
  "backdrops": {"winter": {"desk": "winter_desk_s23", "mob": "winter_mob_s67"}, ...},
  "sprites":   {"fall": ["fall_maple_red_s101", ...], "spring": [...], "winter": [...]}
}"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

HOME = os.path.expanduser("~")
BG_SRC = f"{HOME}/ComfyUI/output/levi/bg"
SP_SRC = f"{HOME}/ComfyUI/output/levi/sprites"
OUT = f"{HOME}/levi-assets/out/seasons"
WIDTHS = {"desk": ("desktop", [1280, 1920]), "mob": ("mobile", [720, 1088])}
CELL = {"fall": 112, "spring": 80, "winter": 72}


def backdrops(picks):
    for season, pick in picks.items():
        for fmt, stem in pick.items():
            im = Image.open(f"{BG_SRC}/{stem}_00001_.png").convert("RGB")
            im = im.filter(ImageFilter.GaussianBlur(0.7))  # shed film grain: invisible at backdrop opacity, big size win
            name, widths = WIDTHS[fmt]
            for w in widths:
                h = round(im.height * w / im.width)
                r = im if w == im.width else im.resize((w, h), Image.LANCZOS)
                r.save(f"{OUT}/{season}-{name}-{w}.avif", quality=52, speed=4)
                r.save(f"{OUT}/{season}-{name}-{w}.webp", quality=70, method=6)
            if fmt == "desk":  # small, darkened color field that tints the whole page — blur baked in (no CSS filter cost)
                tiny = im.resize((160, 90), Image.LANCZOS).filter(ImageFilter.GaussianBlur(9))
                tiny = ImageEnhance.Color(ImageEnhance.Brightness(tiny).enhance(0.5)).enhance(1.3)
                tiny.save(f"{OUT}/{season}-atmos.webp", quality=80)
            print("backdrop", season, fmt, stem, flush=True)


def cutout(stem):
    rgb = np.asarray(Image.open(f"{SP_SRC}/{stem}_00001_.png").convert("RGB"), dtype=np.float32)
    a = np.asarray(Image.open(f"{SP_SRC}/{stem}_mask_00001_.png").convert("L"), dtype=np.float32) / 255
    if a[:48, :48].mean() > 0.5:  # make sure background = 0, subject = 1
        a = 1 - a
    a = np.clip((a - 0.06) / 0.88, 0, 1)
    bg = np.median(rgb[a < 0.03], axis=0) if (a < 0.03).any() else np.array([200, 200, 200], np.float32)
    # un-mix the paper color out of semi-transparent edge pixels (kills light halos on dark pages)
    soft = (a > 0.02) & (a < 0.98)
    rgb[soft] = np.clip((rgb[soft] - (1 - a[soft, None]) * bg) / a[soft, None], 0, 255)
    img = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), "RGBA")
    box = img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    img = img.crop(box)
    side = int(max(img.size) * 1.04)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    return sq


def sprites(picks):
    for season, stems in picks.items():
        cell = CELL[season]
        sheet = Image.new("RGBA", (cell * len(stems), cell), (0, 0, 0, 0))
        for i, stem in enumerate(stems):
            sheet.paste(cutout(stem).resize((cell, cell), Image.LANCZOS), (i * cell, 0))
        sheet.save(f"{OUT}/{season}-sprites.webp", quality=86, method=6, exact=False)
        # review copy on a dark background
        prev = Image.new("RGBA", sheet.size, (20, 22, 30, 255))
        prev.alpha_composite(sheet)
        prev.convert("RGB").resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(f"{HOME}/levi-assets/sheets/{season}-sprites-preview.png")
        print("sprites", season, len(stems), sheet.size, flush=True)


if __name__ == "__main__":
    picks = json.load(open(sys.argv[1]))
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(f"{HOME}/levi-assets/sheets", exist_ok=True)
    if picks.get("backdrops"):
        backdrops(picks["backdrops"])
    if picks.get("sprites"):
        sprites(picks["sprites"])
    for f in sorted(os.listdir(OUT)):
        print(f"{os.path.getsize(os.path.join(OUT, f)) / 1024:8.1f} KB  {f}")
