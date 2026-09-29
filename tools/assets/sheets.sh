#!/usr/bin/env bash
# Contact sheets of the backdrop candidates for quick review.
set -e
cd ~/ComfyUI/output/levi/bg
mkdir -p ~/levi-assets/sheets
for s in winter spring summer fall; do
  magick montage -label '%t' ${s}_desk_*_00001_.png -tile 2x2 -geometry 900x510+8+8 \
    -background '#15161b' -fill '#dddddd' -pointsize 20 -quality 82 ~/levi-assets/sheets/${s}_desk.jpg
  magick montage -label '%t' ${s}_mob_*_00001_.png -tile 3x1 -geometry 400x707+8+8 \
    -background '#15161b' -fill '#dddddd' -pointsize 20 -quality 82 ~/levi-assets/sheets/${s}_mob.jpg
done
ls -la ~/levi-assets/sheets
