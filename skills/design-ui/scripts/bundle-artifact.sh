#!/bin/bash
# bundle-artifact.sh — artifact 프로젝트를 단일 bundle.html 로 묶는다(JS·CSS·에셋 인라인).
# 원본: Anthropic web-artifacts-builder (Apache-2.0, 스킬 루트 LICENSE.txt).
# usage: (artifact 프로젝트 루트에서) bash bundle-artifact.sh
set -euo pipefail

[ -f package.json ] || { echo "ERROR: package.json 없음. 프로젝트 루트에서 실행하라." >&2; exit 1; }
[ -f index.html ] || { echo "ERROR: index.html 없음 (Parcel 진입점)." >&2; exit 1; }

echo "== 번들 의존성"
pnpm add -D parcel @parcel/config-default parcel-resolver-tspaths html-inline

if [ ! -f .parcelrc ]; then
  cat > .parcelrc << 'EOF'
{
  "extends": "@parcel/config-default",
  "resolvers": ["parcel-resolver-tspaths", "..."]
}
EOF
fi

rm -rf dist bundle.html
echo "== Parcel build"
pnpm exec parcel build index.html --dist-dir dist --no-source-maps
echo "== inline"
pnpm exec html-inline dist/index.html > bundle.html

# 외부 리소스가 남아 있으면 단일 파일 아티팩트가 아니다.
if grep -qE '<(script|link)[^>]+(src|href)="https?://' bundle.html; then
  echo "WARN: bundle.html 이 외부 리소스를 참조한다 (CDN 스크립트/스타일). 인라인되지 않았다." >&2
fi
echo "OK  bundle.html ($(du -h bundle.html | cut -f1))"
