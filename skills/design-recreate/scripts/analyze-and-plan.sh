#!/usr/bin/env bash
# analyze-and-plan.sh — Phase 3 (analysis) + Phase 4 (depth-layer plan) with gates.
#
# Runs auto-analyze.ts → GATE-1 → auto-plan.ts → GATE-2. The Layer-by-Layer build is done by
# the agent; the self-correction loop is recreate-step.sh.
#
# Usage:
#   bash analyze-and-plan.sh <work-dir> [--reference=PATH] [--brand-config=PATH] [--gemini-tier=1|2|3]
#                                       [--asset-prompts] [--skip-analyze]
#
#   <work-dir>  normally .design/recreate — must contain captures/reference.(png|jpg|jpeg|webp)
#               unless --reference is given. Writes analysis/ and plan/ inside it.
#
# Exit: 0 both gates passed · 2 error / gate failed

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

WORK_DIR=""; REF=""; BRAND=""; TIER=3; ASSET_PROMPTS=""; SKIP_ANALYZE=false
log() { echo "[analyze-and-plan] $*" >&2; }

for arg in "$@"; do
  case "$arg" in
    --reference=*) REF="${arg#*=}" ;;
    --brand-config=*) BRAND="${arg#*=}" ;;
    --gemini-tier=*) TIER="${arg#*=}" ;;
    --asset-prompts) ASSET_PROMPTS="--asset-prompts" ;;
    --skip-analyze) SKIP_ANALYZE=true ;;
    --*) log "unknown option $arg" ;;
    *) WORK_DIR="$arg" ;;
  esac
done
[ -n "$WORK_DIR" ] || { echo "Usage: bash analyze-and-plan.sh <work-dir> [options]" >&2; exit 2; }
mkdir -p "$WORK_DIR"
WORK_DIR="$(cd "$WORK_DIR" && pwd)"

if [ -z "$REF" ]; then
  for ext in png jpg jpeg webp; do
    [ -f "$WORK_DIR/captures/reference.$ext" ] && REF="$WORK_DIR/captures/reference.$ext" && break
  done
fi
[ -n "$REF" ] && [ -f "$REF" ] || { log "reference image not found (captures/reference.* or --reference)"; exit 2; }
REF="$(cd "$(dirname "$REF")" && pwd)/$(basename "$REF")"

if [ "$SKIP_ANALYZE" = false ]; then
  log "analysis → $WORK_DIR/analysis"
  (cd "$SCRIPT_DIR" && npx tsx auto-analyze.ts "$REF" "$WORK_DIR/analysis" --gemini-tier="$TIER") \
    > "$WORK_DIR/analysis-summary.json" || true
fi

# GATE-1: metadata + elements + colors JSON and at least one crop
n_json=$(ls "$WORK_DIR"/analysis/d1-{metadata,elements,colors}.json 2>/dev/null | wc -l | tr -d ' ')
n_crop=$(ls "$WORK_DIR"/analysis/crops/* 2>/dev/null | wc -l | tr -d ' ')
if [ "$n_json" -lt 3 ] || [ "$n_crop" -lt 1 ]; then
  log "GATE-1 FAILED (json $n_json/3, crops $n_crop/1). If Gemini fell back to Tier 3, write analysis/d1-elements.json by hand from the manual prompt and rerun with --skip-analyze."
  exit 2
fi
log "GATE-1 passed"

PLAN_ARGS=()
[ -n "$ASSET_PROMPTS" ] && PLAN_ARGS+=("$ASSET_PROMPTS")
[ -n "$BRAND" ] && PLAN_ARGS+=("--brand-config=$(cd "$(dirname "$BRAND")" && pwd)/$(basename "$BRAND")")
(cd "$SCRIPT_DIR" && npx tsx auto-plan.ts "$WORK_DIR/analysis" "$WORK_DIR/plan" ${PLAN_ARGS[@]+"${PLAN_ARGS[@]}"}) \
  > "$WORK_DIR/plan-summary.json" || true

# GATE-2: plan JSON with depthLayers + layers + buildOrder
if ! python3 -c "
import json, sys
p = json.load(open(sys.argv[1]))
assert p.get('depthLayers') and p.get('layers') and p.get('buildOrder')
" "$WORK_DIR/plan/deconstruct-plan.json" 2>/dev/null; then
  log "GATE-2 FAILED (plan/deconstruct-plan.json missing or without depthLayers)"
  exit 2
fi
log "GATE-2 passed → build Layer-by-Layer from plan/deconstruct-plan.json, then run recreate-step.sh"
cat "$WORK_DIR/plan-summary.json"
