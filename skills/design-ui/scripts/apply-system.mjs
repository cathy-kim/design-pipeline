#!/usr/bin/env node
/**
 * apply-system.mjs — .design/system/ 을 새로 스캐폴드한 Tailwind 3 프로젝트에 붙인다.
 *
 * design-ui 의 artifact · landing-next 모드가 쓴다. 하는 일:
 *   1. .design/system/ 을 <project>/<aliasRoot>/design-system/ 로 복사 (프리미티브 포함)
 *   2. system 의 tailwind config 를 preset 으로 거는 tailwind.config.cjs 작성
 *   3. (--shadcn) shadcn/ui 의 의미 색 이름(background, muted, card, ring …) 중 system preset 에 없는 것만 정의.
 *      system/tokens.shadcn.css 가 있으면 hsl(var(--x)) 로, 없으면 brand_config.tokens.colors.roles 값으로 — 새 색을 만들지 않는다
 *   4. (--shadcn) components/ui 의 hover 용 bg-accent → bg-muted (브랜드 Accent 와 충돌 방지),
 *      닫힌 radius 스케일에 없는 rounded-* 를 가장 가까운 스케일 이름으로 교체
 *   5. 메인 CSS 를 tokens.css (+ tokens.shadcn.css) import + tailwind 지시문으로 다시 쓴다. shadcn :root 블록은 남기지 않는다
 *
 * 새 스캐폴드 전용이다. 이미 design-system/ 이 있으면 --force 없이는 멈춘다.
 *
 * usage:
 *   node apply-system.mjs --project <dir> [--design <.design dir>] [--alias-root src|.] [--shadcn] [--force]
 * exit: 0 ok · 2 필수 입력 없음(.design/system 또는 brand_config) · 3 system 에 tailwind config 없음 · 4 이미 적용됨
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const project = path.resolve(opt("project", "."));
const design = path.resolve(opt("design", path.join(process.cwd(), ".design")));
const systemDir = path.join(design, "system");
const brandPath = path.join(design, "brand_config.json");

if (!fs.existsSync(systemDir) || !fs.existsSync(brandPath)) {
  console.error(`STOP: 필수 입력 없음 — ${fs.existsSync(systemDir) ? "" : systemDir + " "}${fs.existsSync(brandPath) ? "" : brandPath}`);
  console.error("design-ui 는 디자인 시스템 없이 UI 를 만들지 않는다. design-system 스킬을 먼저 실행하라 (brand_config 도 없으면 design-tokens 또는 design-brief 부터).");
  process.exit(2);
}

const aliasRoot = opt("alias-root", fs.existsSync(path.join(project, "src")) ? "src" : ".");
const dest = path.join(project, aliasRoot, "design-system");
if (fs.existsSync(dest) && !flag("force")) {
  console.error(`STOP: ${dest} 가 이미 있다. 기존 프로젝트 수정은 modify 모드로 하라. 덮어쓰려면 --force.`);
  process.exit(4);
}

// ---------- 1. copy system ----------
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(systemDir, dest, {
  recursive: true,
  // 웹 스캐폴드에 필요 없는 것은 복사하지 않는다: 가드 테스트(vitest — 원본 .design/system/guards 에서 실행),
  // React Native 프리미티브와 NativeWind 테마(웹 tsc 를 깨뜨린다).
  filter: (src) => {
    const rel = path.relative(systemDir, src).split(path.sep);
    if (rel.includes("node_modules")) return false;
    if (rel[0] === "guards") return false;
    if (rel[0] === "primitives" && rel[1] === "native") return false;
    if (/^nativewind\.theme\./.test(rel[0] ?? "")) return false;
    return true;
  },
});
console.log(`copied  ${path.relative(process.cwd(), systemDir)} -> ${path.relative(process.cwd(), dest)}`);

const presetFile = fs
  .readdirSync(dest)
  .find((f) => /^tailwind\.(config|preset)\.(ts|js|cjs|mjs)$/.test(f));
if (!presetFile) {
  console.error(`STOP: ${systemDir} 에 tailwind.config.* / tailwind.preset.* 가 없다. design-system 단계 출력을 확인하라.`);
  process.exit(3);
}
const tokensCss = ["tokens.css", "theme.css", "variables.css"].find((f) => fs.existsSync(path.join(dest, f)));

// ---------- 2. brand_config role resolution ----------
const brand = JSON.parse(fs.readFileSync(brandPath, "utf8"));
const colors = brand?.tokens?.colors ?? {};
const roles = colors.roles ?? {};

function lookup(obj, parts) {
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}
function resolveColor(ref, depth = 0) {
  if (ref == null || depth > 8) return undefined;
  if (typeof ref === "object") return resolveColor(ref.DEFAULT, depth + 1);
  if (typeof ref !== "string") return undefined;
  if (/^(#|rgb|hsl|oklch|var\()/.test(ref)) return ref;
  const parts = ref.split(".");
  for (const base of [colors, roles, colors.semantic ?? {}]) {
    const hit = lookup(base, parts);
    if (hit !== undefined) return resolveColor(hit, depth + 1);
  }
  return undefined;
}

const aliases = {};
const missing = [];
function alias(name, ...refs) {
  for (const r of refs) {
    const v = resolveColor(r);
    if (v) return v;
  }
  missing.push(`${name} <- ${refs.join(" | ")}`);
  return undefined;
}
// system preset 이 이미 정의한 색 이름 — shadcn 별칭이 이 이름을 덮으면 브랜드 팔레트가 깨진다.
const presetColorKeys = new Set();
try {
  const mod = await import(pathToFileURL(path.join(dest, presetFile)).href);
  const cfg = mod.default ?? mod;
  for (const k of Object.keys(cfg?.theme?.colors ?? {})) presetColorKeys.add(k);
  for (const k of Object.keys(cfg?.theme?.extend?.colors ?? {})) presetColorKeys.add(k);
} catch {
  // preset 을 직접 못 읽으면(오래된 Node 의 .ts 등) brand_config 의 색 이름으로 근사한다.
  for (const k of Object.keys(colors)) if (!["roles", "semantic"].includes(k)) presetColorKeys.add(k);
  for (const k of Object.keys(colors.semantic ?? {})) presetColorKeys.add(k);
  for (const k of Object.keys(roles)) presetColorKeys.add(k);
}
// design-system 이 내보내는 shadcn 호환 변수(HSL 채널). 있으면 이것이 정본이다.
const shadcnCss = fs.existsSync(path.join(dest, "tokens.shadcn.css")) ? "tokens.shadcn.css" : undefined;
const kept = [];
if (shadcnCss) {
  // 별칭은 hsl(var(--x) / <alpha-value>) 이므로 채널에 알파가 붙어 있으면 CSS 가 깨진다(구버전 system 산출물).
  const withAlpha = [...fs.readFileSync(path.join(dest, shadcnCss), "utf8").matchAll(/--([\w-]+)\s*:\s*[^;]*\/[^;]*;/g)].map((m) => m[1]);
  if (withAlpha.length) {
    console.warn(`WARN    ${shadcnCss} 에 알파가 붙은 채널이 있다(${withAlpha.join(", ")}). design-system 을 다시 빌드하라 — 지금은 불투명 채널로 낸다.`);
  }
}

if (flag("shadcn")) {
  const fromVar = (v) => `hsl(var(--${v}) / <alpha-value>)`;
  const define = (key, value) => {
    if (presetColorKeys.has(key)) { kept.push(key); return; }
    if (value !== undefined && !(typeof value === "object" && !Object.keys(value).length)) aliases[key] = value;
  };
  const pair = (key, bg, fg) => {
    const o = {};
    if (bg !== undefined) o.DEFAULT = bg;
    if (fg !== undefined) o.foreground = fg;
    define(key, o);
  };
  if (shadcnCss) {
    for (const k of ["background", "foreground", "border", "input", "ring"]) define(k, fromVar(k));
    for (const k of ["card", "popover", "secondary", "muted", "primary", "destructive"]) pair(k, fromVar(k), fromVar(`${k}-foreground`));
  } else {
    const bg = alias("background", "background", "neutral.0");
    const text = alias("foreground", "text", "neutral.900");
    const surface = alias("surface", "surface", "background");
    const border = alias("border", "border");
    define("background", bg);
    define("foreground", text);
    define("border", border);
    define("input", border);
    define("ring", alias("ring", "focus", "primary"));
    pair("card", surface, text);
    pair("popover", alias("popover", "elevated", "background"), text);
    pair("secondary", surface, text);
    pair("muted", surface, alias("muted-foreground", "textMuted"));
    pair("primary", alias("primary", "primary"), alias("primary-foreground", "primary.foreground"));
    pair("destructive", alias("destructive", "danger"), alias("destructive-foreground", "danger.foreground", "background"));
  }
  // 'accent' 는 어떤 경우에도 정의하지 않는다 — 브랜드 Accent 이름은 system preset 의 것이고,
  // shadcn 의 hover 용 bg-accent 는 아래 5단계에서 bg-muted 로 바꾼다.
}

// ---------- 3. tailwind.config.cjs ----------
for (const f of fs.readdirSync(project)) {
  if (/^tailwind\.config\.(ts|js|cjs|mjs)$/.test(f)) fs.rmSync(path.join(project, f));
}
const presetRel = "./" + path.posix.join(aliasRoot === "." ? "" : aliasRoot, "design-system", presetFile);
const twConfig = `// generated by design-ui/scripts/apply-system.mjs — 색·radius·타입은 design-system preset 이 정본이다.
// 여기서 값을 추가하지 마라. 바꿀 것이 있으면 .design/system 을 고치고 다시 적용한다.
const sys = require(${JSON.stringify(presetRel)});
const optional = (m) => { try { return [require(m)]; } catch { return []; } };

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [sys.default ?? sys],
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./design-system/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: ${JSON.stringify(aliases, null, 2).replace(/\n/g, "\n      ")},
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [...optional("tailwindcss-animate")],
};
`;
fs.writeFileSync(path.join(project, "tailwind.config.cjs"), twConfig);
console.log(`wrote   tailwind.config.cjs (preset ${presetRel})`);

if (!fs.readdirSync(project).some((f) => /^postcss\.config\.(js|cjs|mjs|ts)$/.test(f))) {
  fs.writeFileSync(
    path.join(project, "postcss.config.cjs"),
    "module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };\n",
  );
  console.log("wrote   postcss.config.cjs");
}

// ---------- 4. main css ----------
const cssCandidates = ["src/index.css", "app/globals.css", "src/app/globals.css", "src/globals.css"];
const mainCss = cssCandidates.map((c) => path.join(project, c)).find((p) => fs.existsSync(p));
if (mainCss) {
  const lines = [];
  if (tokensCss) {
    let rel = path.relative(path.dirname(mainCss), path.join(dest, tokensCss)).split(path.sep).join("/");
    if (!rel.startsWith(".")) rel = "./" + rel;
    lines.push(`@import "${rel}";`);
  }
  if (shadcnCss && flag("shadcn")) {
    let rel = path.relative(path.dirname(mainCss), path.join(dest, shadcnCss)).split(path.sep).join("/");
    if (!rel.startsWith(".")) rel = "./" + rel;
    lines.push(`@import "${rel}";`);
  }
  lines.push("@tailwind base;", "@tailwind components;", "@tailwind utilities;", "");
  const has = (k) => Boolean(aliases[k]) || presetColorKeys.has(k);
  if (flag("shadcn") && has("background") && has("foreground") && has("border")) {
    lines.push("@layer base {", "  * { @apply border-border; }", "  body { @apply bg-background text-foreground; }", "}", "");
  }
  fs.writeFileSync(mainCss, lines.join("\n"));
  console.log(`wrote   ${path.relative(project, mainCss)} (imports ${[tokensCss, flag("shadcn") && shadcnCss].filter(Boolean).join(", ") || "none"})`);
} else {
  console.warn(`WARN    메인 CSS 를 못 찾았다 (${cssCandidates.join(", ")}). tailwind 지시문과 tokens.css import 를 직접 넣어라.`);
}

// ---------- 5. shadcn component patches ----------
const uiDir = [path.join(project, aliasRoot, "components", "ui"), path.join(project, "components", "ui")].find((d) =>
  fs.existsSync(d),
);
if (flag("shadcn") && uiDir) {
  const scale = brand?.tokens?.radius?.scale ?? {};
  const names = Object.keys(scale);
  // Tailwind 3 기본 radius 값(px) — 스케일에 없는 이름을 가장 가까운 스케일 이름으로 옮길 때 쓴다.
  const twDefault = { none: 0, sm: 2, "": 4, DEFAULT: 4, md: 6, lg: 8, xl: 12, "2xl": 16, "3xl": 24, full: 9999 };
  const finite = names.filter((n) => Number(scale[n]) < 9999);
  const nearest = (px) => {
    if (px >= 9999 && names.includes("full")) return "full";
    let best = finite[0];
    for (const n of finite) if (Math.abs(Number(scale[n]) - px) < Math.abs(Number(scale[best]) - px)) best = n;
    return best;
  };
  const toPx = (v) => {
    const m = /^(\d+(?:\.\d+)?)(px|rem)?$/.exec(v);
    if (!m) return undefined;
    return m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]);
  };
  let radiusFixes = 0;
  let accentFixes = 0;
  for (const f of fs.readdirSync(uiDir).filter((x) => /\.(tsx|jsx|ts)$/.test(x))) {
    const p = path.join(uiDir, f);
    let src = fs.readFileSync(p, "utf8");
    const before = src;
    if (finite.length) {
      src = src.replace(/(?<![\w-])rounded(-(?:t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee))?(?:-(\[[^\]]+\]|[a-z0-9]+))?(?![\w-])/g, (m, side = "", name) => {
        if (name === "[inherit]") return m;
        if (name !== undefined && names.includes(name)) return m;
        if (name === undefined && names.includes("DEFAULT")) return m;
        const px = name === undefined ? 4 : name.startsWith("[") ? toPx(name.slice(1, -1)) : twDefault[name];
        if (px === undefined) return m;
        radiusFixes++;
        return `rounded${side}-${nearest(px)}`;
      });
    }
    src = src
      .replace(/((?:^|[\s"'`])(?:[\w-]+(?:\[[^\]]*\])?:)*)bg-accent(\/\d+)?(?![\w-])/g, (m, pre, op = "") => (accentFixes++, `${pre}bg-muted${op}`))
      .replace(/((?:^|[\s"'`])(?:[\w-]+(?:\[[^\]]*\])?:)*)text-accent-foreground(?![\w-])/g, (m, pre) => (accentFixes++, `${pre}text-foreground`));
    if (src !== before) fs.writeFileSync(p, src);
  }
  console.log(`patched ${path.relative(project, uiDir)}: radius ${radiusFixes}, accent-hover ${accentFixes}`);
}

if (kept.length) console.log(`kept    system preset 색 이름 그대로 (shadcn 별칭으로 덮지 않음): ${kept.join(", ")}`);
if (missing.length) {
  console.warn("WARN    brand_config 에서 못 찾은 shadcn 별칭 (해당 클래스는 스타일 없이 렌더된다 — 컴포넌트에서 쓰지 말거나 system 에 role 을 추가하라):");
  for (const m of missing) console.warn(`        ${m}`);
}
console.log("done    apply-system");
