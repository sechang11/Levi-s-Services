#!/usr/bin/env python3
"""Levi's real job photos → the site's gallery files (replacing the PLACEHOLDER renders).
  ~/ComfyUI/venv/bin/python process_photos.py <folder>
Name the originals after the job, any common format (iPhone HEIC: share/export as JPG first):
  maple-kitchen-01.jpg, maple-kitchen-02.jpg, oak-st-deck-01.png …
then list them in that job's entry in PROJECTS (public/js/content.js). For the
before/after slider, shoot the before and after from the same spot.
Writes <folder>/out/<name>.webp (1280×720) + <name>-sm.webp (640×360), center-cropped to 16:9,
rotated upright, and with ALL metadata dropped — phone photos carry GPS coordinates of
clients' homes. Copy out/* into public/assets/projects/."""
import os
import sys

from PIL import Image, ImageOps

SIZES = {"": (1280, 720), "-sm": (640, 360)}


def main():
    src = sys.argv[1]
    out = os.path.join(src, "out")
    os.makedirs(out, exist_ok=True)
    for f in sorted(os.listdir(src)):
        name, ext = os.path.splitext(f)
        if not os.path.isfile(os.path.join(src, f)) or ext.lower() not in (".jpg", ".jpeg", ".png", ".webp", ".avif"):
            continue
        im = ImageOps.exif_transpose(Image.open(os.path.join(src, f))).convert("RGB")  # upright, then metadata-free
        for suffix, size in SIZES.items():
            ImageOps.fit(im, size, Image.LANCZOS).save(os.path.join(out, f"{name}{suffix}.webp"), quality=78, method=6)
        print("photo", name, im.size)


if __name__ == "__main__":
    main()
