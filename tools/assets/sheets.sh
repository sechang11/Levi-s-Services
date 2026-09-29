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
# business-card illustrations (make_card_jobs.py): 5 candidates per season
if [ -d ~/ComfyUI/output/levi/cards ]; then
  cd ~/ComfyUI/output/levi/cards
  for s in winter spring summer fall; do
    magick montage -label '%t' ${s}_*_00001_.png -tile 3x -geometry 672x400+6+6 \
      -background '#15161b' -fill '#dddddd' -pointsize 18 -quality 82 ~/levi-assets/sheets/cards_${s}.jpg
  done
fi
ls -la ~/levi-assets/sheets
