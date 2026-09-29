#!/usr/bin/env python3
"""Brand raster assets: social share card (og-image.jpg) + app icons.
Run with ComfyUI's venv python:  ~/ComfyUI/venv/bin/python compose_brand.py picks.json"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HOME = os.path.expanduser("~")
BG_SRC = f"{HOME}/ComfyUI/output/levi/bg"
OUT = f"{HOME}/levi-assets/out"
ORDER = ["spring", "summer", "fall", "winter"]
ACCENT = {"spring": (110, 231, 160), "summer": (255, 169, 77), "fall": (242, 140, 56), "winter": (125, 211, 252)}


def font(pattern, size):
    path = subprocess.run(["fc-match", "-f", "%{file}", pattern], capture_output=True, text=True).stdout.strip()
    return ImageFont.truetype(path, size)


def draw_mark(d, x, y, s, frame=True):
    """Brand mark from favicon.svg (40×40 viewBox) at scale s, top-left (x, y)."""
    P = lambda px, py: (x + px * s, y + py * s)

    def stroke(points, color, w):
        d.line([P(*p) for p in points], fill=color, width=round(w * s), joint="curve")
        for p in (points[0], points[-1]):  # round caps
            cx, cy = P(*p)
            r = w * s / 2
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

    if frame:
        d.rounded_rectangle([P(1.5, 1.5), P(38.5, 38.5)], radius=10 * s, fill=(18, 13, 26), outline=(167, 139, 250), width=round(2 * s))
    stroke([(9, 18.5), (20, 9.5), (31, 18.5)], (242, 140, 56), 3)
    stroke([(16.5, 16.5), (16.5, 29), (26.5, 29)], (255, 255, 255), 3.4)


def icons():
    for size, name in ((180, "apple-touch-icon.png"), (512, "icon-512.png")):
        big = size * 4
        im = Image.new("RGB", (big, big), (18, 13, 26))  # full-bleed: iOS masks corners itself
        d = ImageDraw.Draw(im)
        inset = big * 0.14
        s = (big - 2 * inset) / 40
        draw_mark(d, inset, inset, s, frame=False)
        im.resize((size, size), Image.LANCZOS).save(f"{OUT}/{name}", optimize=True)
        print("icon", name)


def spaced(d, xy, text, fnt, fill, spacing):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=fnt, fill=fill)
        x += d.textlength(ch, font=fnt) + spacing
    return x


def text_width(d, text, fnt, spacing):
    return sum(d.textlength(ch, font=fnt) for ch in text) + spacing * (len(text) - 1)


def og(picks):
    W, H = 1200, 630
    card = Image.new("RGB", (W, H), (8, 8, 14))
    sw = W // 4
    for i, season in enumerate(ORDER):
        src = Image.open(f"{BG_SRC}/{picks[season]['desk']}_00001_.png").convert("RGB")
        scale = H / src.height
        src = src.resize((round(src.width * scale), H), Image.LANCZOS)
        left = (src.width - sw) // 2
        card.paste(src.crop((left, 0, left + sw, H)), (i * sw, 0))
    # darken for legibility: overall + a soft central band
    shade = Image.new("L", (W, H))
    sd = ImageDraw.Draw(shade)
    for yy in range(H):
        t = abs(yy - H * 0.47) / (H * 0.53)
        sd.line([(0, yy), (W, yy)], fill=round(255 * (0.78 - 0.33 * t)))
    card = Image.composite(Image.new("RGB", (W, H), (6, 6, 12)), card, shade)
    d = ImageDraw.Draw(card)
    for i in range(1, 4):  # thin metal seams between seasons
        d.line([(i * sw, 0), (i * sw, H)], fill=(200, 190, 175), width=1)

    title = font("Nimbus Sans Narrow:style=Bold", 168)
    tag = font("Montserrat:style=Black", 25)
    mono = font("Source Code Pro:style=Semibold", 18)

    draw_mark(d, W / 2 - 42, 92, 2.1)
    # LEVI · BUILDS, condensed a touch further to echo the Anton display face
    t_img = Image.new("RGBA", (1400, 220), (0, 0, 0, 0))
    td = ImageDraw.Draw(t_img)
    x = spaced(td, (0, 0), "LEVI", title, (255, 255, 255, 255), 2)
    x = spaced(td, (x + 10, 0), "·", title, (167, 139, 250, 255), 0)
    spaced(td, (x + 10, 0), "BUILDS", title, (255, 255, 255, 255), 2)
    t_img = t_img.crop(t_img.getbbox())
    t_img = t_img.resize((round(t_img.width * 0.86), t_img.height), Image.LANCZOS)
    pad = 56  # room for the glow to fall off — blurring a tight crop leaves a hard-edged box
    t_pad = Image.new("RGBA", (t_img.width + 2 * pad, t_img.height + 2 * pad), (0, 0, 0, 0))
    t_pad.paste(t_img, (pad, pad))
    glow = Image.new("RGBA", t_pad.size, (167, 139, 250, 0))
    glow.putalpha(t_pad.getchannel("A").filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * 0.38)))
    tx, ty = (W - t_img.width) // 2, 208
    card.paste(glow, (tx - pad, ty - pad), glow)
    card.paste(t_img, (tx, ty), t_img)

    line = "RENOVATIONS · REPAIRS · CLEAR PATH SNOW REMOVAL"
    lw = text_width(d, line, tag, 3)
    spaced(d, ((W - lw) / 2, ty + t_img.height + 34), line, tag, (238, 232, 226), 3)
    for i, season in enumerate(ORDER):
        label = season.upper()
        lw = text_width(d, label, mono, 4)
        spaced(d, (i * sw + (sw - lw) / 2, H - 52), label, mono, ACCENT[season], 4)
    card.save(f"{OUT}/og-image.jpg", quality=86, optimize=True, progressive=True)
    print("og-image.jpg", os.path.getsize(f"{OUT}/og-image.jpg") // 1024, "KB")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    picks = json.load(open(sys.argv[1]))["backdrops"]
    icons()
    og(picks)
