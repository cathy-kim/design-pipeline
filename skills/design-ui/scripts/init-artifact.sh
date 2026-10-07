#!/bin/bash
# init-artifact.sh — design-ui `artifact` 모드 스캐폴드.
# React + TypeScript + Vite + Tailwind 3.4 + shadcn/ui(40+ 컴포넌트) 프로젝트를 만들고
# .design/system/ 을 preset 으로 붙인다. 원본: Anthropic web-artifacts-builder (Apache-2.0, 스킬 루트 LICENSE.txt).
#
# usage: bash init-artifact.sh <project-dir> [<.design dir>]
#   <.design dir> 기본값: 현재 디렉터리의 .design
# 원본과 달리 shadcn 기본 회색 팔레트·--radius 를 쓰지 않는다. 색·radius 는 전부 system preset 이 정한다.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPONENTS_TARBALL="$SCRIPT_DIR/shadcn-components.tar.gz"

if [ -z "${1:-}" ]; then
  echo "usage: bash init-artifact.sh <project-dir> [<.design dir>]" >&2
  exit 1
fi
PROJECT_DIR="$1"
DESIGN_DIR="$(cd "${2:-.design}" 2>/dev/null && pwd || true)"

# 하드 룰: 디자인 시스템 없이 시작하지 않는다.
if [ -z "$DESIGN_DIR" ] || [ ! -d "$DESIGN_DIR/system" ] || [ ! -f "$DESIGN_DIR/brand_config.json" ]; then
  echo "STOP: .design/system/ 또는 .design/brand_config.json 이 없다 (${2:-.design})." >&2
  echo "design-ui 는 디자인 시스템 없이 UI 를 만들지 않는다. design-system 스킬을 먼저 실행하라." >&2
  exit 2
fi
[ -f "$COMPONENTS_TARBALL" ] || { echo "ERROR: $COMPONENTS_TARBALL 없음" >&2; exit 1; }
[ -e "$PROJECT_DIR" ] && { echo "ERROR: $PROJECT_DIR 가 이미 있다. 기존 코드 수정은 modify 모드로." >&2; exit 1; }

NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERROR: Node.js 18+ 필요 (현재 $(node -v))" >&2
  exit 1
fi
command -v pnpm >/dev/null 2>&1 || { echo "pnpm 설치..."; npm install -g pnpm; }

# macOS/GNU sed 호환 in-place
sed_inplace() { if [[ "$OSTYPE" == darwin* ]]; then sed -i '' "$@"; else sed -i "$@"; fi; }

echo "== Vite react-ts 프로젝트 생성: $PROJECT_DIR"
pnpm create vite "$PROJECT_DIR" --template react-ts
cd "$PROJECT_DIR"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
sed_inplace '/<link rel="icon"/d' index.html   # 템플릿 파비콘(vite.svg/favicon.svg)은 단일 번들에서 해석 실패
sed_inplace 's#<title>.*</title>#<title>'"$PROJECT_NAME"'</title>#' index.html

echo "== 의존성 설치"
pnpm install
if [ "$NODE_MAJOR" -lt 20 ]; then pnpm add -D vite@5.4.11; fi
pnpm add -D tailwindcss@3.4.1 postcss autoprefixer @types/node tailwindcss-animate
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add @radix-ui/react-accordion @radix-ui/react-aspect-ratio @radix-ui/react-avatar @radix-ui/react-checkbox \
  @radix-ui/react-collapsible @radix-ui/react-context-menu @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-hover-card @radix-ui/react-label @radix-ui/react-menubar @radix-ui/react-navigation-menu \
  @radix-ui/react-popover @radix-ui/react-progress @radix-ui/react-radio-group @radix-ui/react-scroll-area \
  @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-slot @radix-ui/react-switch \
  @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-toggle @radix-ui/react-toggle-group @radix-ui/react-tooltip
# 번들된 shadcn 컴포넌트가 기대하는 메이저에 고정 (calendar=react-day-picker 9, resizable=react-resizable-panels 2, sonner=next-themes)
pnpm add sonner next-themes cmdk vaul embla-carousel-react react-day-picker@9 react-resizable-panels@2 date-fns@3 react-hook-form @hookform/resolvers zod

echo "== PostCSS"
cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

echo "== 경로 별칭 @/ -> src/"
node -e "
const fs = require('fs');
for (const f of ['tsconfig.json', 'tsconfig.app.json']) {
  if (!fs.existsSync(f)) continue;
  const raw = fs.readFileSync(f, 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/,(\s*[}\]])/g, '\$1');
  const c = JSON.parse(raw);
  c.compilerOptions = c.compilerOptions || {};
  delete c.compilerOptions.baseUrl; // TS 6 deprecates baseUrl; paths resolve relative to tsconfig
  c.compilerOptions.paths = { '@/*': ['./src/*'] };
  fs.writeFileSync(f, JSON.stringify(c, null, 2));
}
"
cat > vite.config.ts << 'EOF'
import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
EOF

echo "== shadcn/ui 컴포넌트 추출"
tar -xzf "$COMPONENTS_TARBALL" -C src/
cat > components.json << 'EOF'
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "tailwind.config.cjs", "css": "src/index.css", "baseColor": "neutral", "cssVariables": false, "prefix": "" },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" }
}
EOF

echo "== 디자인 시스템 적용"
node "$SCRIPT_DIR/apply-system.mjs" --project . --design "$DESIGN_DIR" --alias-root src --shadcn

echo ""
echo "OK  $PROJECT_DIR"
echo "    색·radius·타입: src/design-system/ (preset). 새 hex·임의 radius 금지."
echo "    import { Button } from '@/components/ui/button'  // 시스템 토큰으로 재스킨됨"
echo "    시스템 프리미티브 우선: import { Button, Input, Card, Nav } from '@/design-system/primitives/web'"
echo "    다음: 코드 작성 -> pnpm exec tsc -b -> bash \"$SCRIPT_DIR/bundle-artifact.sh\""
