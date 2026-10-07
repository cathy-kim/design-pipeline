/**
 * Logo Design Framework
 *
 * Based on industry best practices and research from:
 * - https://inkbotdesign.com/logo-design-principles/
 * - https://www.superside.com/blog/ai-prompts-logo-design
 * - https://quillbot.com/blog/ai-prompt-writing/ai-logo-promts/
 *
 * Core Principles: Simplicity, Memorability, Timelessness, Versatility, Relevance
 */

// ============================================================================
// Logo Types
// ============================================================================

export type LogoType =
  | 'wordmark'       // Text-based logo (Google, Coca-Cola)
  | 'lettermark'     // Initials/monogram (IBM, HBO)
  | 'pictorial'      // Icon/symbol (Apple, Twitter)
  | 'abstract'       // Abstract shape (Pepsi, Adidas)
  | 'emblem'         // Badge/seal (Starbucks, Harley-Davidson)
  | 'combination'    // Symbol + text (Burger King, Lacoste)
  | 'mascot';        // Character (KFC, Michelin)

export type LogoStyle =
  | 'minimalist'     // Clean, simple lines
  | 'modern'         // Contemporary, sleek
  | 'vintage'        // Retro, classic
  | 'geometric'      // Shapes-based
  | 'hand-drawn'     // Organic, artisanal
  | 'gradient'       // Modern gradients
  | 'line-art'       // Single line weight
  | 'flat'           // No shadows/gradients
  | 'isometric'      // 3D-like perspective
  | 'calligraphy';   // Brush/script style

export type Industry =
  | 'beauty'         // K-Beauty, cosmetics
  | 'fashion'        // Apparel, accessories
  | 'tech'           // Software, hardware
  | 'food'           // F&B, restaurant
  | 'health'         // Wellness, medical
  | 'finance'        // Banking, fintech
  | 'education'      // EdTech, schools
  | 'entertainment'  // Media, gaming
  | 'retail'         // E-commerce, stores
  | 'consulting';    // B2B services

export type BrandPersonality =
  | 'professional'
  | 'playful'
  | 'luxurious'
  | 'friendly'
  | 'bold'
  | 'elegant'
  | 'innovative'
  | 'trustworthy'
  | 'energetic'
  | 'sophisticated';

export type TargetPlatform = 'gemini' | 'midjourney' | 'dalle' | 'ideogram';

// ============================================================================
// Brand Input Configuration
// ============================================================================

export interface BrandInput {
  // Required
  name: string;
  personality: BrandPersonality[];

  // brand_config 에서 채워짐 (선택)
  industry?: Industry;
  description?: string;       // brand.description — industry 가 없을 때 맥락으로 쓴다
  extraMood?: string[];       // brand.mood 중 BrandPersonality 에 없는 단어
  negative?: string[];        // artStyle.negative
  calligraphyStyle?: string;  // style=calligraphy 일 때 CALLIGRAPHY_STYLES 키

  // Optional but recommended
  tagline?: string;
  values?: string[];
  targetAudience?: string;
  competitors?: string[];

  // Design preferences
  preferredLogoType?: LogoType;
  preferredStyle?: LogoStyle;
  symbolDescription?: string;  // For pictorial/mascot logos

  // Color preferences
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
  };

  // Typography
  fontStyle?: 'serif' | 'sans-serif' | 'display' | 'script';

  // Technical
  targetPlatforms?: TargetPlatform[];
}

// ============================================================================
// Output Configuration
// ============================================================================

export interface PromptOutput {
  platform: TargetPlatform;
  prompt: string;
  negativePrompt?: string;
  parameters?: Record<string, string | number>;
  metadata: {
    logoType: LogoType;
    style: LogoStyle;
    brandName: string;
    generatedAt: string;
  };
}

// ============================================================================
// Logo Design Principles (for internal reference)
// ============================================================================

export const LOGO_PRINCIPLES = {
  simplicity: {
    description: 'Less is more - clean, simple logos are easier to recognize and more versatile',
    guidelines: [
      'Limit colors to 2-3 maximum',
      'Avoid complex details that get lost at small sizes',
      'Ensure logo works in black and white',
      'Remove unnecessary elements',
    ],
  },
  memorability: {
    description: 'The best logos are memorable and easy to associate with your brand promise',
    guidelines: [
      'Create unique silhouette/shape',
      'Use distinctive visual element',
      'Avoid generic clip-art style icons',
      'Test recall after brief exposure',
    ],
  },
  timelessness: {
    description: 'Avoid designs that look dated quickly',
    guidelines: [
      'Avoid trendy effects (glossy, 3D shadows)',
      'Focus on classic proportions',
      'Test against 10-year timeline',
      'Prefer simple over complex',
    ],
  },
  versatility: {
    description: 'Logos must adapt across digital and print mediums',
    guidelines: [
      'Works at favicon size (16x16)',
      'Works on billboard size',
      'Readable on light and dark backgrounds',
      'Consider horizontal and stacked versions',
    ],
  },
  relevance: {
    description: 'The logo concept should connect to your brand personality and industry',
    guidelines: [
      'Reflect brand values visually',
      'Consider target audience expectations',
      'Research industry visual language',
      'Avoid conflicting associations',
    ],
  },
};

// ============================================================================
// Style Mappings
// ============================================================================

export const STYLE_KEYWORDS: Record<LogoStyle, string[]> = {
  minimalist: ['clean', 'simple', 'minimal', 'uncluttered', 'sleek', 'refined'],
  modern: ['contemporary', 'sleek', 'current', 'fresh', 'cutting-edge'],
  vintage: ['retro', 'classic', 'nostalgic', 'timeless', 'heritage'],
  geometric: ['shapes', 'angular', 'precise', 'mathematical', 'structured'],
  'hand-drawn': ['organic', 'artisanal', 'handcrafted', 'imperfect', 'authentic'],
  gradient: ['colorful gradient', 'color transition', 'smooth blend', 'dynamic colors'],
  'line-art': ['single line', 'continuous line', 'outline', 'contour'],
  flat: ['flat design', 'no shadows', 'solid colors', '2D', 'bold shapes'],
  isometric: ['3D perspective', 'isometric view', 'dimensional', 'depth'],
  calligraphy: ['brush strokes', 'script', 'hand-lettered', 'flowing', 'elegant script'],
};

export const INDUSTRY_KEYWORDS: Record<Industry, string[]> = {
  beauty: ['skincare', 'cosmetics', 'K-beauty', 'wellness', 'self-care', 'elegance'],
  fashion: ['apparel', 'style', 'couture', 'trendy', 'chic', 'boutique'],
  tech: ['software', 'digital', 'innovation', 'startup', 'SaaS', 'AI'],
  food: ['restaurant', 'culinary', 'gourmet', 'organic', 'fresh', 'delicious'],
  health: ['medical', 'wellness', 'fitness', 'healthcare', 'therapeutic'],
  finance: ['banking', 'fintech', 'investment', 'secure', 'trustworthy'],
  education: ['learning', 'EdTech', 'knowledge', 'academic', 'school'],
  entertainment: ['media', 'gaming', 'streaming', 'creative', 'fun'],
  retail: ['e-commerce', 'shopping', 'marketplace', 'store', 'brand'],
  consulting: ['B2B', 'professional services', 'advisory', 'expert'],
};

export const PERSONALITY_VISUAL: Record<BrandPersonality, string[]> = {
  professional: ['refined lines', 'balanced composition', 'serif or clean sans-serif'],
  playful: ['rounded shapes', 'vibrant colors', 'dynamic elements'],
  luxurious: ['gold accents', 'elegant proportions', 'premium materials feel'],
  friendly: ['approachable shapes', 'warm colors', 'inviting'],
  bold: ['strong contrast', 'thick lines', 'impactful'],
  elegant: ['delicate details', 'sophisticated curves', 'refined'],
  innovative: ['unique shapes', 'unexpected combinations', 'forward-thinking'],
  trustworthy: ['stable shapes', 'classic proportions', 'reliable feel'],
  energetic: ['dynamic angles', 'bright colors', 'movement suggestion'],
  sophisticated: ['subtle details', 'mature color palette', 'understated elegance'],
};

// ============================================================================
// Famous Designer References (Recognized by AI models)
// ============================================================================

export const DESIGNER_STYLES = {
  'Paul Rand': 'minimalist, geometric, bold shapes, primary colors, conceptual',
  'Saul Bass': 'iconic symbols, bold silhouettes, graphic simplicity',
  'Massimo Vignelli': 'grid-based, helvetica, systematic, clean',
  'Paula Scher': 'expressive typography, bold, colorful, layered',
  'Aaron Draplin': 'thick lines, vintage americana, bold type',
};

// ============================================================================
// Platform-Specific Format Modifiers
// ============================================================================

export const FORMAT_MODIFIERS: Record<TargetPlatform, string[]> = {
  gemini: [
    'vector graphic style',
    'high contrast',
    'professional logo design',
    '4k resolution',
    'sharp edges',
    'clean isolated background',
  ],
  midjourney: [
    'vector logo',
    'white background',
    'high-res',
    '300dpi',
    'centered composition',
    '--ar 1:1',
    '--stylize 100',
  ],
  dalle: [
    'vector illustration',
    'clean white background',
    'professional graphic design',
    'high quality',
    'sharp details',
  ],
  ideogram: [
    'vector logo design',
    'typography accurate',
    'commercial ready',
    'high resolution',
    'clean background',
  ],
};

// ============================================================================
// Negative Prompts by Platform
// ============================================================================

export const NEGATIVE_PROMPTS: Record<TargetPlatform, string[]> = {
  gemini: [
    'blurry',
    'misspelled text',
    'messy lines',
    'realistic photo',
    'complex background',
    'watermark',
    'low resolution',
    'clipart style',
    'generic stock look',
    'neon glow',
    'glassmorphism',
    'gradient border',
  ],
  midjourney: [
    'text',
    'words',
    'letters',
    'realistic',
    'photograph',
    'shadows',
    'gradients',
    'complex background',
    '--no text',
  ],
  dalle: [
    'blurry',
    'low quality',
    'text unless specified',
    'watermark',
    'signature',
    'realistic photograph',
  ],
  ideogram: [
    'blurry',
    'distorted',
    'low quality',
    'complex scene',
    'multiple logos',
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

// ============================================================================
// Calligraphy sub-styles (구 generate-image.ts --type logo 에서 이관)
// ============================================================================

export const CALLIGRAPHY_STYLES: Record<string, string> = {
  'Modern Brush': 'thick modern brush calligraphy with dynamic strokes and organic curves',
  Gothic: 'gothic blackletter calligraphy with sharp angles and medieval elegance',
  Copperplate: 'elegant copperplate script with flowing ink strokes and varying line weight',
  Graffiti: 'urban graffiti lettering with bold tags and street-art energy',
  'Asian Ink': 'traditional East Asian ink-brush calligraphy with balanced, zen-like strokes',
};

export function getStyleDescription(style: LogoStyle): string {
  return STYLE_KEYWORDS[style]?.join(', ') || style;
}

export function getIndustryContext(industry: Industry | undefined, description?: string): string {
  if (!industry) return description || 'modern';
  return INDUSTRY_KEYWORDS[industry]?.join(', ') || industry;
}

export function getPersonalityVisuals(personalities: BrandPersonality[]): string {
  return personalities
    .flatMap((p) => PERSONALITY_VISUAL[p] || [])
    .slice(0, 5)
    .join(', ');
}

export function getFormatModifiers(platform: TargetPlatform): string {
  return FORMAT_MODIFIERS[platform]?.join(', ') || '';
}

export function getNegativePrompt(platform: TargetPlatform): string {
  return NEGATIVE_PROMPTS[platform]?.join(', ') || '';
}
