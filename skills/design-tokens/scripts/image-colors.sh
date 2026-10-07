#!/usr/bin/env bash
# image-colors.sh — pixel-exact color evidence for image mode (ImageMagick 7).
# Vision models decide WHERE to look; this script reads the actual pixel values.
#
# Usage:
#   image-colors.sh <image> [x,y,w,h ...]
#     no regions  -> size, top-12 quantized histogram, 3x3 grid area samples
#     regions     -> additionally the area-averaged color of each region
# Output: JSON on stdout.
set -euo pipefail
img=${1:?usage: image-colors.sh <image> [x,y,w,h ...]}
shift
command -v magick >/dev/null || { echo '{"error":"ImageMagick 7 (magick) not installed"}'; exit 1; }

W=$(magick identify -format '%w' "$img[0]")
H=$(magick identify -format '%h' "$img[0]")

avg() { # x y w h -> #RRGGBB averaged over the area
  magick "$img[0]" -crop "${3}x${4}+${1}+${2}" +repage -scale '1x1!' -format '#%[hex:p{0,0}]' info: | cut -c1-7
}

printf '{\n  "source": "%s",\n  "width": %s,\n  "height": %s,\n  "histogram": [' "$img" "$W" "$H"
magick "$img[0]" -alpha off +dither -colors 12 -format '%c' histogram:info: \
  | sort -rn | head -12 \
  | awk 'BEGIN{sep=""} { n=$1; sub(":","",n); if (match($0,/#[0-9A-Fa-f]{6}/)) { printf "%s\n    {\"value\": \"%s\", \"count\": %d}", sep, toupper(substr($0,RSTART,7)), n; sep="," } }'
printf '\n  ],\n  "grid": ['
sep=""
cw=$((W / 3)); ch=$((H / 3)); sw=$((cw / 5 > 0 ? cw / 5 : 1)); sh=$((ch / 5 > 0 ? ch / 5 : 1))
for r in 0 1 2; do for c in 0 1 2; do
  x=$((c * cw + cw / 2 - sw / 2)); y=$((r * ch + ch / 2 - sh / 2))
  printf '%s\n    {"cell": "r%sc%s", "value": "%s"}' "$sep" "$r" "$c" "$(avg $x $y $sw $sh)"
  sep=","
done; done
printf '\n  ],\n  "regions": ['
sep=""
for reg in "$@"; do
  IFS=, read -r x y w h <<<"$reg"
  printf '%s\n    {"region": "%s", "value": "%s"}' "$sep" "$reg" "$(avg "$x" "$y" "$w" "$h")"
  sep=","
done
printf '\n  ]\n}\n'
