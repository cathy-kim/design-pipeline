#!/usr/bin/env bash
# 플러그인 구조 검증: 매니페스트가 가리키는 스킬/에이전트 존재, 프론트매터 name=디렉터리명,
# SKILL.md 안의 상대경로(references/, scripts/, ${CLAUDE_PLUGIN_ROOT}/...) 실재 여부.
set -u
cd "$(dirname "$0")/.."
fail=0
say() { echo "  $*"; }
bad() { echo "FAIL: $*"; fail=1; }

for s in $(python3 -c "import json;print(' '.join(json.load(open('.claude-plugin/plugin.json'))['skills']))"); do
  d=${s#./}; d=${d%/}
  f="$d/SKILL.md"
  [ -f "$f" ] || { bad "missing $f"; continue; }
  name=$(awk 'NR==1&&$0!="---"{exit} /^---$/{c++; next} c==1&&/^name:/{sub(/^name:[ ]*/,"");print;exit}' "$f")
  base=$(basename "$d")
  [ "$name" = "$base" ] || bad "$f frontmatter name='$name' != dir '$base'"
  grep -q '^description:' "$f" || bad "$f has no description"
  # relative references inside the skill
  for ref in $(grep -oE '(^|[^A-Za-z0-9_./-])(references|scripts|assets|templates)/[A-Za-z0-9_./-]+' "$f" | sed -E 's#^[^a-z]##' | sort -u); do
    [ -e "$d/$ref" ] || bad "$f -> $d/$ref not found"
  done
  for ref in $(grep -oE '\$\{CLAUDE_PLUGIN_ROOT\}/[A-Za-z0-9_./-]+' "$f" | sed 's#\${CLAUDE_PLUGIN_ROOT}/##' | sort -u); do
    [ -e "$ref" ] || bad "$f -> \${CLAUDE_PLUGIN_ROOT}/$ref not found"
  done
  say "ok $d"
done
for a in $(python3 -c "import json;print(' '.join(json.load(open('.claude-plugin/plugin.json')).get('agents',[])))"); do
  f=${a#./}
  [ -f "$f" ] || { bad "missing agent $f"; continue; }
  head -1 "$f" | grep -q '^---$' || bad "$f has no frontmatter"
  grep -q '^name:' "$f" || bad "$f has no name"
  say "ok $f"
done
for b in brands/*.json; do python3 -m json.tool "$b" >/dev/null || bad "$b invalid JSON"; done
[ -f CONTRACT.md ] || bad "CONTRACT.md missing"
[ $fail = 0 ] && echo "validate: PASS" || { echo "validate: FAIL"; exit 1; }
