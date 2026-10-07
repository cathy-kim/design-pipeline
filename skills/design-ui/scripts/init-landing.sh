#!/bin/bash
# init-landing.sh — design-ui `landing-next` 모드 스캐폴드.
# Next.js(App Router, TypeScript) + Tailwind 3.4 + framer-motion + Magic UI 준비, .design/system/ 을 preset 으로 붙인다.
#
# usage: bash init-landing.sh <project-dir> [<.design dir>]
# Tailwind 3 을 쓰는 이유: system preset(tailwind.config.*)을 그대로 `presets` 로 걸기 위해서다.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "${1:-}" ]; then
  echo "usage: bash init-landing.sh <project-dir> [<.design dir>]" >&2
  exit 1
fi
PROJECT_DIR="$1"
DESIGN_DIR="$(cd "${2:-.design}" 2>/dev/null && pwd || true)"

if [ -z "$DESIGN_DIR" ] || [ ! -d "$DESIGN_DIR/system" ] || [ ! -f "$DESIGN_DIR/brand_config.json" ]; then
  echo "STOP: .design/system/ 또는 .design/brand_config.json 이 없다 (${2:-.design})." >&2
  echo "design-ui 는 디자인 시스템 없이 UI 를 만들지 않는다. design-system 스킬을 먼저 실행하라." >&2
  exit 2
fi
[ -e "$PROJECT_DIR" ] && { echo "ERROR: $PROJECT_DIR 가 이미 있다. 기존 코드 수정은 modify 모드로." >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm 설치..."; npm install -g pnpm; }

echo "== create-next-app (Tailwind 없이 생성 후 3.4 를 직접 붙인다)"
pnpm dlx create-next-app@latest "$PROJECT_DIR" --ts --app --eslint --no-tailwind --no-src-dir \
  --import-alias "@/*" --use-pnpm --yes
cd "$PROJECT_DIR"

echo "== 의존성"
pnpm add -D tailwindcss@3.4.1 postcss autoprefixer tailwindcss-animate
pnpm add framer-motion clsx tailwind-merge class-variance-authority lucide-react

mkdir -p lib components/ui components/sections
cat > lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
EOF

# create-next-app 기본 page 의 스타일 모듈은 시스템 밖 값을 쓴다 — 지운다.
rm -f app/page.module.css
cat > app/page.tsx << 'EOF'
export default function Page() {
  return <main />;
}
EOF

echo "== 디자인 시스템 적용"
node "$SCRIPT_DIR/apply-system.mjs" --project . --design "$DESIGN_DIR" --alias-root .

echo ""
echo "OK  $PROJECT_DIR"
echo "    프리미티브: import { Button, Input, Card, Nav } from '@/design-system/primitives/web' · 섹션: components/sections/ · Magic UI: components/ui/"
echo "    폰트는 brand_config.tokens.typography.families 로 app/layout.tsx 에서 설정 (next/font 또는 assets.fonts)."
echo "    다음: 섹션 작성 -> pnpm build"
