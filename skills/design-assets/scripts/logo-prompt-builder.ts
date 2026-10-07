#!/usr/bin/env -S npx tsx
/**
 * logo-prompt-builder.ts — brand_config 로 로고 생성 프롬프트를 만든다 (이미지는 만들지 않는다).
 *
 * 입력: .design/brand_config.json
 *   brand.name / brand.description / brand.mood[] / brand.industry(선택)
 *   tokens.colors (primary · accent · neutral) / visualSystem.logoDirection → 심볼 설명
 *   artStyle.negative → negative prompt
 * 출력: .design/assets/logo-prompt/prompts.json (+ <platform>.txt) 과 manifest 항목
 * 이미지는 generate-image.ts --mode logo --prompt-file .design/assets/logo-prompt/prompts.json 으로 만든다.
 *
 * Prompt formula: [Style cue] [structure keyword] for [brand context], [color palette], [format modifiers]
 * Research: superside.com/blog/ai-prompts-logo-design · quillbot.com/blog/ai-prompt-writing/ai-logo-promts ·
 *           inkbotdesign.com/logo-design-principles
 *
 * Usage
 *   npx tsx logo-prompt-builder.ts                          # gemini 1개
 *   npx tsx logo-prompt-builder.ts --all-platforms          # gemini · midjourney · dalle · ideogram
 *   npx tsx logo-prompt-builder.ts --industry tech --style geometric --type abstract
 *   npx tsx logo-prompt-builder.ts --style calligraphy --calligraphy "Modern Brush" --type wordmark
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type BrandInput, type BrandPersonality, type Industry, type LogoStyle, type LogoType,
  type PromptOutput, type TargetPlatform,
  CALLIGRAPHY_STYLES, PERSONALITY_VISUAL, getFormatModifiers, getIndustryContext,
  getNegativePrompt, getPersonalityVisuals, getStyleDescription,
} from './logo-framework.ts';
import { brandName, designDir, fail, loadBrand, modeDir, palette, parseArgs, recordManifest, rel, str } from './lib.ts';

// ============================================================================
// Logo Prompt Builder Class
// ============================================================================

export class LogoPromptBuilder {
  readonly brandInput: BrandInput;

  constructor(brandInput: BrandInput) {
    this.brandInput = brandInput;
  }

  /**
   * Infer best logo type based on brand characteristics
   */
  private inferLogoType(): LogoType {
    if (this.brandInput.preferredLogoType) {
      return this.brandInput.preferredLogoType;
    }

    const { name, industry, personality } = this.brandInput;

    // Short names work well as lettermarks
    if (name.length <= 3) {
      return 'lettermark';
    }

    // Beauty/fashion often use wordmarks or combination
    if (industry === 'beauty' || industry === 'fashion') {
      return personality.includes('luxurious') ? 'wordmark' : 'combination';
    }

    // Tech companies often use abstract or pictorial
    if (industry === 'tech') {
      return 'abstract';
    }

    // Food/retail often use emblems or mascots
    if (industry === 'food') {
      return personality.includes('playful') ? 'mascot' : 'emblem';
    }

    // Default to combination (most versatile)
    return 'combination';
  }

  /**
   * Infer best style based on brand personality
   */
  private inferStyle(): LogoStyle {
    if (this.brandInput.preferredStyle) {
      return this.brandInput.preferredStyle;
    }

    const { personality, industry } = this.brandInput;

    // Luxury brands → minimalist or elegant calligraphy
    if (personality.includes('luxurious') || personality.includes('elegant')) {
      return personality.includes('sophisticated') ? 'minimalist' : 'calligraphy';
    }

    // Modern/innovative → geometric or gradient
    if (personality.includes('innovative') || personality.includes('bold')) {
      return 'geometric';
    }

    // Playful → hand-drawn or flat
    if (personality.includes('playful') || personality.includes('friendly')) {
      return 'hand-drawn';
    }

    // Tech → modern or flat
    if (industry === 'tech') {
      return 'modern';
    }

    // Default to minimalist (timeless)
    return 'minimalist';
  }

  /**
   * Get color palette description
   */
  private getColorPalette(): string {
    const colors = this.brandInput.colors || {};
    const parts: string[] = [];

    if (colors.primary) {
      parts.push(`primary color ${colors.primary}`);
    }
    if (colors.secondary) {
      parts.push(`secondary ${colors.secondary}`);
    }
    if (colors.accent) {
      parts.push(`accent ${colors.accent}`);
    }
    if (colors.background) {
      parts.push(`on ${colors.background} background`);
    }

    if (parts.length === 0) {
      // Default to black and white for versatility
      return 'black primary color on white background, with monochromatic palette';
    }

    return parts.join(', ');
  }

  /**
   * Build the main prompt structure
   */
  private buildCorePrompt(logoType: LogoType, style: LogoStyle): string {
    const { name, industry, personality, tagline, symbolDescription, description, extraMood, calligraphyStyle } = this.brandInput;

    // Build style cue
    const calli = style === 'calligraphy' && calligraphyStyle ? `${CALLIGRAPHY_STYLES[calligraphyStyle] ?? calligraphyStyle}, ` : '';
    const styleCue = `${calli}${getStyleDescription(style)} ${logoType} logo`;

    // Build structure keyword
    const structureMap: Record<LogoType, string> = {
      wordmark: 'text-based wordmark with custom typography',
      lettermark: 'monogram/initials lettermark',
      pictorial: 'iconic symbol mark',
      abstract: 'abstract geometric mark',
      emblem: 'badge/seal emblem design',
      combination: 'combination mark with symbol and wordmark',
      mascot: 'character mascot illustration',
    };
    const structureKeyword = structureMap[logoType];

    // Build brand context
    const industryContext = getIndustryContext(industry, description);
    const personalityVisuals = getPersonalityVisuals(personality);
    const traits = [...personality, ...(extraMood ?? [])];
    const brandContext = `for "${name}"${tagline ? ` - ${tagline}` : ''}, a ${industryContext} brand that is ${traits.join(', ') || 'distinctive'}`;

    // Build color palette
    const colorPalette = this.getColorPalette();

    // Build symbol description for relevant types
    let symbolPart = '';
    if (['pictorial', 'abstract', 'combination', 'mascot', 'emblem'].includes(logoType)) {
      if (symbolDescription) {
        symbolPart = `The symbol should represent: ${symbolDescription}.`;
      } else {
        symbolPart = `The symbol should visually represent the brand's core values.`;
      }
    }

    // Combine into core prompt
    return `Create a ${styleCue}, ${structureKeyword}, ${brandContext}.
Color palette: ${colorPalette}.
Visual attributes: ${personalityVisuals}.
${symbolPart}

Ensure the brand name "${name}" is spelled correctly and clearly legible.`;
  }

  /**
   * Generate prompt for specific platform
   */
  public generatePrompt(platform: TargetPlatform = 'gemini'): PromptOutput {
    const logoType = this.inferLogoType();
    const style = this.inferStyle();

    const corePrompt = this.buildCorePrompt(logoType, style);
    const formatModifiers = getFormatModifiers(platform);
    const negativePrompt = [getNegativePrompt(platform), ...(this.brandInput.negative ?? [])].filter(Boolean).join(', ');

    let fullPrompt: string;
    let parameters: Record<string, string | number> = {};

    switch (platform) {
      case 'gemini':
        fullPrompt = this.formatGeminiPrompt(corePrompt, logoType, style, formatModifiers);
        break;
      case 'midjourney':
        fullPrompt = this.formatMidjourneyPrompt(corePrompt, logoType, style, formatModifiers);
        parameters = { ar: '1:1', stylize: 100 };
        break;
      case 'dalle':
        fullPrompt = this.formatDallePrompt(corePrompt, logoType, style, formatModifiers);
        break;
      case 'ideogram':
        fullPrompt = this.formatIdeogramPrompt(corePrompt, logoType, style, formatModifiers);
        break;
      default:
        fullPrompt = corePrompt;
    }

    return {
      platform,
      prompt: fullPrompt,
      negativePrompt: platform !== 'midjourney' ? negativePrompt : undefined,
      parameters,
      metadata: {
        logoType,
        style,
        brandName: this.brandInput.name,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate prompts for all platforms
   */
  public generateAllPlatformPrompts(): PromptOutput[] {
    const platforms: TargetPlatform[] = this.brandInput.targetPlatforms || ['gemini'];
    return platforms.map((platform) => this.generatePrompt(platform));
  }

  // ============================================================================
  // Platform-Specific Formatters
  // ============================================================================

  private formatGeminiPrompt(
    corePrompt: string,
    logoType: LogoType,
    style: LogoStyle,
    formatModifiers: string
  ): string {
    return `**Role:** Expert Logo Designer & Brand Identity Specialist
**Task:** Create a professional ${logoType} logo design.

**Design Brief:**
${corePrompt}

**Design Principles Applied:**
- Simplicity: Clean, recognizable design that works at any size
- Memorability: Unique visual identity that stands out
- Timelessness: Avoid trends, focus on longevity
- Versatility: Works on digital and print, light and dark backgrounds
- Relevance: Connects to brand personality and industry

**Technical Specifications:**
- View: Front view, centered composition
- Format: ${formatModifiers}
- Background: Clean, solid, isolated (preferably white)
- Quality: 4K resolution, sharp edges, print-ready

**Negative Prompt (Avoid):**
${[getNegativePrompt('gemini'), ...(this.brandInput.negative ?? [])].join(', ')}`;
  }

  private formatMidjourneyPrompt(
    corePrompt: string,
    logoType: LogoType,
    style: LogoStyle,
    formatModifiers: string
  ): string {
    // Midjourney prefers concise prompts with specific keywords
    const { personality } = this.brandInput;

    // Reference famous logo designers for style
    let designerRef = '';
    if (personality.includes('luxurious') || personality.includes('sophisticated')) {
      designerRef = 'in the style of Paul Rand, ';
    } else if (personality.includes('bold') || personality.includes('energetic')) {
      designerRef = 'in the style of Saul Bass, ';
    }

    // Note: Midjourney is not good with text, so focus on pictorial elements
    const promptParts = [
      `${style} ${logoType} logo design`,
      designerRef,
      `for ${this.brandInput.industry ?? 'modern'} brand`,
      this.getColorPalette().replace('on', 'with'),
      'vector illustration',
      'white background',
      'professional branding',
      'centered composition',
      formatModifiers,
    ];

    let prompt = promptParts.filter(Boolean).join(', ');

    // Add negative prompt Midjourney style
    if (logoType === 'wordmark' || logoType === 'lettermark') {
      prompt += ' --no realistic, photograph';
    } else {
      prompt += ' --no text, words, letters, realistic';
    }

    prompt += ' --ar 1:1 --stylize 100';

    return prompt;
  }

  private formatDallePrompt(
    corePrompt: string,
    logoType: LogoType,
    style: LogoStyle,
    formatModifiers: string
  ): string {
    return `Professional ${style} ${logoType} logo design.

${corePrompt}

Style: ${formatModifiers}
The design should be clean, professional, and suitable for business use.
Centered on a pure white background.
High resolution, sharp details, ready for commercial use.`;
  }

  private formatIdeogramPrompt(
    corePrompt: string,
    logoType: LogoType,
    style: LogoStyle,
    formatModifiers: string
  ): string {
    // Ideogram is better at typography than Midjourney
    const { name } = this.brandInput;

    return `${style} ${logoType} logo for "${name}"

${corePrompt}

Typography: Clean, legible, properly spelled
Format: ${formatModifiers}
Background: White, clean, isolated
Quality: High resolution, commercial ready`;
  }

}

// ============================================================================
// CLI
// ============================================================================

const PLATFORMS: TargetPlatform[] = ['gemini', 'midjourney', 'dalle', 'ideogram'];

function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(`Options: --industry <${'beauty|fashion|tech|food|health|finance|education|entertainment|retail|consulting'}>
  --personality a,b  (기본: brand.mood 중 알려진 성격어)  --style <LogoStyle>  --type <LogoType>
  --calligraphy "<${Object.keys(CALLIGRAPHY_STYLES).join('|')}>"  --symbol "<desc>"  --tagline "<text>"
  --platform <gemini|midjourney|dalle|ideogram> | --all-platforms  --design-dir <path>`);
    return;
  }
  const dir = designDir(args);
  const cfg = loadBrand(dir);
  const pal = palette(cfg);

  const mood = (cfg.brand?.mood ?? []).map((m) => m.toLowerCase().trim());
  const known = Object.keys(PERSONALITY_VISUAL);
  const personality = (str(args, 'personality')?.split(',').map((p) => p.trim()) ?? mood.filter((m) => known.includes(m))) as BrandPersonality[];
  const extraMood = mood.filter((m) => !known.includes(m));

  const input: BrandInput = {
    name: brandName(cfg),
    personality,
    extraMood,
    industry: (str(args, 'industry') ?? cfg.brand?.industry) as Industry | undefined,
    description: cfg.brand?.description,
    tagline: str(args, 'tagline'),
    preferredStyle: str(args, 'style') as LogoStyle | undefined,
    preferredLogoType: str(args, 'type') as LogoType | undefined,
    calligraphyStyle: str(args, 'calligraphy'),
    symbolDescription: str(args, 'symbol') ?? cfg.visualSystem?.logoDirection,
    colors: { primary: pal.primary, accent: pal.accent !== pal.primary ? pal.accent : undefined, background: pal.bg },
    negative: cfg.artStyle?.negative,
  };
  const builder = new LogoPromptBuilder(input);
  const platforms = args['all-platforms'] ? PLATFORMS : [(str(args, 'platform') ?? 'gemini') as TargetPlatform];
  const outputs: PromptOutput[] = platforms.map((p) => builder.generatePrompt(p));

  const out = modeDir(dir, 'logo-prompt');
  const jsonPath = path.join(out, 'prompts.json');
  fs.writeFileSync(jsonPath, JSON.stringify(outputs, null, 2) + '\n');
  for (const o of outputs) {
    const txt = path.join(out, `${o.platform}.txt`);
    fs.writeFileSync(txt, o.prompt + (o.negativePrompt ? `\n\nNEGATIVE: ${o.negativePrompt}` : '') + '\n');
    recordManifest(dir, cfg, {
      file: rel(dir, txt), mode: 'logo-prompt', kind: 'prompt', prompt: o.prompt, negativePrompt: o.negativePrompt ?? null,
      model: o.platform, seed: null, size: null, note: `${o.metadata.logoType} / ${o.metadata.style}`,
    });
    console.log(`\n=== ${o.platform.toUpperCase()} (${o.metadata.logoType}, ${o.metadata.style}) ===\n${o.prompt}`);
  }
  console.log(`\nOK ${jsonPath}`);
}

try {
  main();
} catch (e) {
  fail(e);
}
