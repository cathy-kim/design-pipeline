#!/usr/bin/env bash
# recreate-step.sh — ONE iteration of the recursive self-correction loop.
#
# Renders the recreation, asks design-qa's pixel diff (the single pixel-diff implementation)
# for a full-canvas score and per-section scores, optionally collects vision fix hints,
# logs the iteration, rewrites .design/recreate-report.md and decides PASS / CONTINUE / STOP.
#
# This script does NOT edit the recreation. The agent reads progress/fix-<N>.md, fixes only the
# failing sections' layers, and calls this script again.
#
# Usage:
#   bash recreate-step.sh <work-dir> --reference=PNG (--html=PATH | --url=URL) [options]
#
#   <work-dir>              Working dir, normally .design/recreate (holds captures/, progress/)
#   --reference=PNG         Reference image (the capture the recreation must match)
#   --html=PATH             Static recreation to render (Puppeteer)
#   --url=URL               Running recreation to capture (Playwright) — e.g. http://localhost:3000/page
#   --width=N --height=N    Viewport (default: reference image size)
#   --sections=JSON         [{ "id", "x", "y", "width", "height" }] in reference px
#                           (grid-manifest.json from grid-section-image.js is accepted too)
#   --threshold=N           Full-canvas pass line, % (default 95)
#   --section-threshold=N   Every section must reach this, % (default 90)
#   --max-iterations=N      Hard stop (default 5)
#   --report=PATH           Report path (default: <work-dir>/../recreate-report.md)
#   --no-vision             Skip vision fix hints
#
# Exit codes: 0 PASS · 10 CONTINUE (fix and call again) · 3 STOP (max iterations or plateau) · 2 ERROR
#
# Requires design-qa's pixel diff (owner: design-qa, npm ci in its scripts/):
#   node ${CLAUDE_PLUGIN_ROOT}/skills/design-qa/scripts/pixel-diff.js <ref.png> <actual.png> --out <diff.png>
#   → stdout one JSON line {"pass","pixelScore","mismatchedPixels","totalPixels","diffImagePath",…}
#   exit 0 = pass, 1 = fail (both mean "compared"), 2 = error. Actual is resized to reference size.
# Sections: this script crops both images with ImageMagick (actual first resized to reference size)
# and diffs the crops with the same script. pixel-diff.js has no crop option.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
PIXEL_DIFF="$PLUGIN_ROOT/skills/design-qa/scripts/pixel-diff.js"
VISION_PROMPT="$SCRIPT_DIR/prompts/visual-verdict-prompt.txt"

WORK_DIR=""; REF=""; HTML=""; URL=""; WIDTH=""; HEIGHT=""; SECTIONS=""
THRESHOLD=95; SECTION_THRESHOLD=90; MAX_ITER=5; REPORT=""; VISION=true

log() { echo "[recreate-step] $*" >&2; }

for arg in "$@"; do
  case "$arg" in
    --reference=*) REF="${arg#*=}" ;;
    --html=*) HTML="${arg#*=}" ;;
    --url=*) URL="${arg#*=}" ;;
    --width=*) WIDTH="${arg#*=}" ;;
    --height=*) HEIGHT="${arg#*=}" ;;
    --sections=*) SECTIONS="${arg#*=}" ;;
    --threshold=*) THRESHOLD="${arg#*=}" ;;
    --section-threshold=*) SECTION_THRESHOLD="${arg#*=}" ;;
    --max-iterations=*) MAX_ITER="${arg#*=}" ;;
    --report=*) REPORT="${arg#*=}" ;;
    --no-vision) VISION=false ;;
    --*) log "unknown option $arg" ;;
    *) WORK_DIR="$arg" ;;
  esac
done

if [ -z "$WORK_DIR" ] || [ -z "$REF" ] || { [ -z "$HTML" ] && [ -z "$URL" ]; }; then
  echo "Usage: bash recreate-step.sh <work-dir> --reference=PNG (--html=PATH | --url=URL) [options]" >&2
  exit 2
fi
[ -f "$REF" ] || { log "reference not found: $REF"; exit 2; }
[ -f "$PIXEL_DIFF" ] || { log "design-qa pixel diff not found: $PIXEL_DIFF"; exit 2; }
command -v magick >/dev/null 2>&1 || { log "ImageMagick (magick) is required"; exit 2; }

mkdir -p "$WORK_DIR/progress"
WORK_DIR="$(cd "$WORK_DIR" && pwd)"
REPORT="${REPORT:-$(dirname "$WORK_DIR")/recreate-report.md}"
LOG_FILE="$WORK_DIR/progress/iteration-log.json"

if [ -z "$WIDTH" ] || [ -z "$HEIGHT" ]; then
  dims=$(magick identify -format "%w %h" "$REF" 2>/dev/null || identify -format "%w %h" "$REF")
  WIDTH="${WIDTH:-${dims%% *}}"; HEIGHT="${HEIGHT:-${dims##* }}"
fi

ITER=$(python3 -c "import json,os,sys; p=sys.argv[1]; print(len(json.load(open(p)))+1 if os.path.exists(p) else 1)" "$LOG_FILE")
SHOT="$WORK_DIR/progress/screenshot-$ITER.png"
log "iteration $ITER/$MAX_ITER · ${WIDTH}x${HEIGHT}"

# 1. Render / capture the recreation
if [ -n "$HTML" ]; then
  HTML_ABS="$(cd "$(dirname "$HTML")" && pwd)/$(basename "$HTML")"
  (cd "$SCRIPT_DIR" && npx tsx render-screenshot.ts "$HTML_ABS" "$SHOT" --width="$WIDTH" --height="$HEIGHT" >/dev/null)
else
  node "$SCRIPT_DIR/cap-page.js" "$URL" "$SHOT" --viewport="${WIDTH}x${HEIGHT}" --fold >/dev/null
fi
[ -f "$SHOT" ] || { log "render failed"; exit 2; }

# 2. Full-canvas pixel diff (design-qa)
FULL_JSON="$WORK_DIR/progress/pixel-$ITER-full.json"
node "$PIXEL_DIFF" "$REF" "$SHOT" --out "$WORK_DIR/progress/diff-$ITER-full.png" > "$FULL_JSON" || true
if ! python3 -c "import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if 'pixelScore' in d else 1)" "$FULL_JSON" 2>/dev/null; then
  log "pixel diff failed: $(cat "$FULL_JSON")"; exit 2
fi

# 3. Per-section pixel diff (crop both locally at reference size, then design-qa diff)
SECTION_DIR="$WORK_DIR/progress/sections-$ITER"; mkdir -p "$SECTION_DIR"
SHOT_FIT="$SECTION_DIR/_actual-at-ref-size.png"
magick "$SHOT" -resize "$(magick identify -format "%wx%h" "$REF")!" "$SHOT_FIT"
if [ -n "$SECTIONS" ] && [ -f "$SECTIONS" ]; then
  python3 - "$SECTIONS" > "$SECTION_DIR/crops.tsv" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
items = data.get("cells", data.get("sections", [])) if isinstance(data, dict) else data
for s in items:
    b = s.get("bounds", s)
    sid = str(s.get("id", f"{s.get('row')}-{s.get('col')}"))
    print(f"{sid}\t{int(b['width'])}x{int(b['height'])}+{int(b['x'])}+{int(b['y'])}")
PY
  while IFS=$'\t' read -r sid crop; do
    magick "$REF" -crop "$crop" +repage "$SECTION_DIR/$sid-ref.png"
    magick "$SHOT_FIT" -crop "$crop" +repage "$SECTION_DIR/$sid-actual.png"
    # exit 0 (pass) and 1 (fail) both mean "compared"; 2 leaves no pixelScore and scores 0
    node "$PIXEL_DIFF" "$SECTION_DIR/$sid-ref.png" "$SECTION_DIR/$sid-actual.png" --out "$SECTION_DIR/$sid-diff.png" > "$SECTION_DIR/$sid.json" || true
    echo "$crop" > "$SECTION_DIR/$sid.crop"
  done < "$SECTION_DIR/crops.tsv"
fi

# 4. Vision fix hints (optional; never a pass gate)
HINTS="$WORK_DIR/progress/vision-$ITER.json"
echo '{}' > "$HINTS"
if [ "$VISION" = true ] && command -v codex >/dev/null 2>&1 && [ -f "$VISION_PROMPT" ]; then
  codex exec -i "$REF" -i "$SHOT" --skip-git-repo-check --ephemeral -s read-only "$(cat "$VISION_PROMPT")" 2>/dev/null \
    | python3 -c "
import sys, re, json
raw = sys.stdin.read()
m = re.search(r'\`\`\`(?:json)?\s*(.*?)\`\`\`', raw, re.S) or re.search(r'(\{.*\})', raw, re.S)
try: print(json.dumps(json.loads(m.group(1))))
except Exception: print('{}')
" > "$HINTS" || echo '{}' > "$HINTS"
fi

# 5. Log, decide, write fix instructions and report
python3 - "$WORK_DIR" "$ITER" "$THRESHOLD" "$SECTION_THRESHOLD" "$MAX_ITER" "$REPORT" "$REF" "$SHOT" <<'PY'
import json, os, sys, glob
from datetime import datetime
work, it, th, sth, max_it, report, ref, shot = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5]), sys.argv[6], sys.argv[7], sys.argv[8]
prog = os.path.join(work, "progress")
full = json.load(open(os.path.join(prog, f"pixel-{it}-full.json")))
full_pct = float(full.get("pixelScore", 0))
sections = []
for f in sorted(glob.glob(os.path.join(prog, f"sections-{it}", "*.json"))):
    sid = os.path.basename(f)[:-5]
    try: d = json.load(open(f))
    except Exception: d = {}
    crop = open(f[:-5] + ".crop").read().strip() if os.path.exists(f[:-5] + ".crop") else ""
    sections.append({"id": sid, "crop": crop, "matchPercent": float(d.get("pixelScore", 0)), "diffImage": d.get("diffImagePath")})
hints = json.load(open(os.path.join(prog, f"vision-{it}.json")))

log_path = os.path.join(prog, "iteration-log.json")
entries = json.load(open(log_path)) if os.path.exists(log_path) else []
entries.append({"iteration": it, "matchPercent": full_pct, "sections": sections,
                "screenshot": shot, "timestamp": datetime.now().isoformat(timespec="seconds")})
json.dump(entries, open(log_path, "w"), indent=2)

failing = [s for s in sections if s["matchPercent"] < sth]
passed = full_pct >= th and not failing
gains = [entries[i]["matchPercent"] - entries[i - 1]["matchPercent"] for i in range(1, len(entries))]
plateau = len(gains) >= 2 and all(g < 1.0 for g in gains[-2:])
if passed: decision, code = "PASS", 0
elif it >= max_it: decision, code = "STOP (max iterations)", 3
elif plateau: decision, code = "STOP (plateau: <1.0%p gain twice)", 3
else: decision, code = "CONTINUE", 10

if code == 10:
    lines = [f"# Fix instructions — iteration {it}", "",
             f"Full canvas {full_pct:.2f}% (target ≥ {th}%). Sections below {sth}%:", ""]
    for s in sorted(failing, key=lambda s: s["matchPercent"]):
        lines.append(f"- `{s['id']}` {s['matchPercent']:.2f}% · crop {s['crop']} · diff {s['diffImage']}")
    for key in ("differences", "suggestions"):
        if hints.get(key):
            lines += ["", f"## Vision {key}", ""] + [f"- {x}" for x in hints[key]]
    lines += ["", "Fix only the depth layer / region that owns each failing section, then run recreate-step.sh again."]
    open(os.path.join(prog, f"fix-{it}.md"), "w").write("\n".join(lines) + "\n")

rows = "\n".join(f"| {s['id']} | {s['crop']} | {s['matchPercent']:.2f}% | {'PASS' if s['matchPercent'] >= sth else 'FAIL'} |" for s in sections) or "| (no sections given) | | | |"
history = "\n".join(f"| {e['iteration']} | {e['matchPercent']:.2f}% | {sum(1 for s in e['sections'] if s['matchPercent'] < sth)} |" for e in entries)
remaining = "\n".join(f"- `{s['id']}` {s['matchPercent']:.2f}% → {s['diffImage']}" for s in failing) or "- 없음"
vision = "\n".join(f"- {d}" for d in hints.get("differences", [])) or "- (vision hints 없음)"
os.makedirs(os.path.dirname(os.path.abspath(report)), exist_ok=True)
open(report, "w").write(f"""# Recreate Report

- Reference: `{ref}`
- Latest screenshot: `{shot}`
- Decision: **{decision}** (iteration {it}/{max_it})
- Full-canvas match: **{full_pct:.2f}%** (target ≥ {th}%, every section ≥ {sth}%)
- Pixel diff: design-qa `pixel-diff.js` (`pixelScore`). Section scores diff locally cropped pairs

## Per-section match

| Section | Crop (WxH+X+Y) | Match | Status |
|---|---|---|---|
{rows}

## Iterations

| # | Full match | Failing sections |
|---|---|---|
{history}

## Remaining diffs

{remaining}

### Vision notes (latest)

{vision}
""")
print(json.dumps({"iteration": it, "decision": decision, "matchPercent": full_pct,
                  "failingSections": [s["id"] for s in failing], "report": report}))
sys.exit(code)
PY
