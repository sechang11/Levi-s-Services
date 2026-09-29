#!/usr/bin/env python3
"""Review sheet: every sprite candidate cut out with its mask, on the site's dark background."""
import os

import numpy as np
from PIL import Image, ImageDraw

SRC = os.path.expanduser("~/ComfyUI/output/levi/sprites")
stems = sorted(f[:-len("_00001_.png")] for f in os.listdir(SRC) if f.endswith("_00001_.png") and "_mask_" not in f)
cell, cols = 200, 7
rows = (len(stems) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cell, rows * (cell + 22)), (18, 16, 24))
d = ImageDraw.Draw(sheet)
for i, stem in enumerate(stems):
    rgb = Image.open(f"{SRC}/{stem}_00001_.png").convert("RGB")
    a = np.asarray(Image.open(f"{SRC}/{stem}_mask_00001_.png").convert("L"), dtype=np.float32) / 255
    if a[:48, :48].mean() > 0.5:
        a = 1 - a
    rgba = rgb.copy()
    rgba.putalpha(Image.fromarray((a * 255).astype(np.uint8)))
    tile = Image.new("RGBA", rgb.size, (18, 16, 24, 255))
    tile.alpha_composite(rgba)
    x, y = (i % cols) * cell, (i // cols) * (cell + 22)
    sheet.paste(tile.convert("RGB").resize((cell - 8, cell - 8), Image.LANCZOS), (x + 4, y + 4))
    d.text((x + 6, y + cell - 2), stem.replace("_s", " s"), fill=(200, 200, 210))
sheet.save(os.path.expanduser("~/levi-assets/sheets/sprites_review.jpg"), quality=88)
print(len(stems), "sprites")
