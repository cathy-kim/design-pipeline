#!/usr/bin/env -S npx tsx
/**
 * validate-with-gemini.ts — 생성한 UI 코드에 대한 Gemini CLI 2차 의견(advisory).
 *
 * 브랜드 토큰은 .design/brand_config.json 과 .design/system/ 의 tailwind preset 에서 읽어 프롬프트에 넣는다.
 * 하드코딩된 브랜드는 없다. 판정의 정본은 design-qa 이고, 이 스크립트는 그 전에 거는 자기 점검이다.
 *
 * usage:
 *   npx tsx validate-with-gemini.ts <code-file> [--design .design] [--platform web|mobile] [--title "화면 이름"] [--json]
 * env:
 *   GEMINI_MODEL   (선택) gemini CLI 에 -m 으로 넘김
 *   GEMINI_API_KEY 등 인증은 gemini CLI 가 process.env 에서 직접 읽는다 — 이 스크립트는 키를 만지지 않는다.
 * exit: 0 score>=70 · 1 score<70 · 2 입력 없음 · 3 gemini CLI 실행 실패(검증 안 됨, 통과 아님)
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export interface ValidationResult {
  score: number;
  violations: string[];
  strengths: string[];
  concerns: string[];
  suggestions: string[];
  verdict: string;
  raw: string;
}

const PLATFORM_RULES: Record<string, string> = {
  web: `- 마우스 타겟 최소 32px(권장 40px), 터치 겸용이면 44px
- 사이드바 240–280px, 주 메뉴 5–7개
- 데이터 테이블: 정렬·필터·검색·페이지네이션, 열 8개 이하, 행 높이 48–56px
- 입력에 연결된 label 또는 aria-label
- 텍스트 대비 4.5:1 (WCAG 2.1 AA)`,
  mobile: `- 터치 타겟 최소 44px(권장 48px)
- 폼 필드 높이 56px, 한 화면 7개 이하
- Primary 버튼 1개 + Secondary 최대 2개
- 하단 탭 3–5개 (iOS 49px / Android 56px)
- 모든 인터랙티브 요소에 접근성 라벨
- 텍스트 대비 4.5:1 (WCAG 2.1 AA)`,
};

function arg(argv: string[], name: string, def?: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
}

export function loadDesignContext(designDir: string): string {
  const brandPath = path.join(designDir, "brand_config.json");
  const systemDir = path.join(designDir, "system");
  if (!fs.existsSync(brandPath) || !fs.existsSync(systemDir)) {
    throw new Error(`필수 입력 없음: ${brandPath} 또는 ${systemDir}`);
  }
  const brand = JSON.parse(fs.readFileSync(brandPath, "utf8"));
  const t = brand.tokens ?? {};
  const preset = fs
    .readdirSync(systemDir)
    .find((f) => /^tailwind\.(config|preset)\.(ts|js|cjs|mjs)$/.test(f));
  const presetSrc = preset ? fs.readFileSync(path.join(systemDir, preset), "utf8").slice(0, 6000) : "(없음)";
  return [
    `Brand: ${brand.brand?.name ?? brand.brand?.id ?? "unknown"} — mood: ${(brand.brand?.mood ?? []).join(", ")}`,
    `Colors (허용 팔레트 전부): ${JSON.stringify(t.colors ?? {})}`,
    `Radius closed scale: ${JSON.stringify(t.radius?.scale ?? {})}`,
    `Typography scale: ${JSON.stringify(t.typography?.scale ?? {})}`,
    `Spacing scale: ${JSON.stringify(t.spacing?.scale ?? {})}`,
    `Tailwind preset (${preset ?? "none"}):\n${presetSrc}`,
  ].join("\n");
}

export function buildPrompt(code: string, title: string, platform: string, designContext: string): string {
  return `You are a senior UI reviewer. Review the generated UI code against the brand design system and the workspace rules.

# Screen
Title: ${title}
Platform: ${platform}

# Design system (the ONLY allowed values)
${designContext}

# Workspace rules (hard)
- One screen uses at most 3 colors: Primary + Accent + Neutral. Any color value or class not traceable to the design system is a violation.
- Border radius only from the closed scale above. Arbitrary values (rounded-[..], inline border-radius) are violations.
- Forbidden: pill-shaped text buttons, neon glow, glassmorphism (backdrop-blur translucent panels), gradient borders.
- Hierarchy order: size/weight -> spacing -> lightness -> color as last resort.

# Platform rules
${PLATFORM_RULES[platform] ?? PLATFORM_RULES.web}

# Code
\`\`\`tsx
${code}
\`\`\`

# Respond exactly in this format
SCORE: <0-100>
VIOLATIONS:
- <rule>: <file location or snippet>
STRENGTHS:
- ...
CONCERNS:
- ...
SUGGESTIONS:
- ...
FINAL VERDICT: <production-ready yes/no and why>

Respond in Korean if the title is Korean.`;
}

export function parseResponse(raw: string): ValidationResult {
  const out: ValidationResult = { score: 0, violations: [], strengths: [], concerns: [], suggestions: [], verdict: "", raw };
  let section: keyof Pick<ValidationResult, "violations" | "strengths" | "concerns" | "suggestions"> | null = null;
  for (const line of raw.split("\n")) {
    const s = line.trim();
    const score = /^SCORE:\s*(\d+)/.exec(s);
    if (score) out.score = Number(score[1]);
    if (/^VIOLATIONS:/.test(s)) { section = "violations"; continue; }
    if (/^STRENGTHS:/.test(s)) { section = "strengths"; continue; }
    if (/^CONCERNS:/.test(s)) { section = "concerns"; continue; }
    if (/^SUGGESTIONS:/.test(s)) { section = "suggestions"; continue; }
    if (/^FINAL VERDICT:/.test(s)) { section = null; continue; }
    if (section && /^[-•]/.test(s)) {
      const item = s.slice(1).trim();
      if (item && !/^(none|없음)$/i.test(item)) out[section].push(item);
    }
  }
  const v = raw.indexOf("FINAL VERDICT:");
  out.verdict = v >= 0 ? raw.slice(v + "FINAL VERDICT:".length).trim() : "";
  return out;
}

export function callGemini(prompt: string): string {
  const cliArgs = ["-p", prompt];
  if (process.env.GEMINI_MODEL) cliArgs.unshift("-m", process.env.GEMINI_MODEL);
  const r = spawnSync("gemini", cliArgs, {
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"], // 인증 프롬프트 등에서 입력을 기다리지 않게
  });
  if (r.error) throw new Error(`gemini CLI 실행 실패: ${r.error.message} (설치: npm i -g @google/gemini-cli)`);
  if (r.status !== 0) throw new Error(`gemini CLI exit ${r.status}: ${(r.stderr || "").slice(0, 500)}`);
  const out = r.stdout.trim();
  if (!/^\s*SCORE:\s*\d+/m.test(out)) {
    // 인증 안내·오류 문구 등 리뷰가 아닌 출력. 점수 0 으로 FAIL 처리하지 않고 "검증 안 됨" 으로 올린다.
    throw new Error(`gemini 응답에 SCORE 가 없다(인증·설정 확인): ${out.slice(0, 300)}`);
  }
  return out;
}

function main(argv: string[]): number {
  const codeFile = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
  if (!codeFile || !fs.existsSync(codeFile)) {
    console.error("usage: validate-with-gemini.ts <code-file> [--design .design] [--platform web|mobile] [--title ...] [--json]");
    return 2;
  }
  const designDir = path.resolve(arg(argv, "design", ".design")!);
  const platform = arg(argv, "platform", "web")!;
  const title = arg(argv, "title", path.basename(codeFile))!;

  let ctx: string;
  try {
    ctx = loadDesignContext(designDir);
  } catch (e) {
    console.error(`STOP: ${(e as Error).message} — design-system 단계를 먼저 실행하라.`);
    return 2;
  }

  let raw: string;
  try {
    raw = callGemini(buildPrompt(fs.readFileSync(codeFile, "utf8"), title, platform, ctx));
  } catch (e) {
    console.error(`SKIPPED (검증 안 됨): ${(e as Error).message}`);
    return 3;
  }
  const res = parseResponse(raw);
  if (argv.includes("--json")) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log(`SCORE ${res.score}/100`);
    for (const [k, list] of [["VIOLATION", res.violations], ["CONCERN", res.concerns], ["SUGGEST", res.suggestions], ["STRENGTH", res.strengths]] as const) {
      for (const item of list) console.log(`${k.padEnd(9)} ${item}`);
    }
    if (res.verdict) console.log(`VERDICT   ${res.verdict}`);
  }
  return res.score >= 70 && res.violations.length === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
