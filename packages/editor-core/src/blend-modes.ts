export const CLIP_BLEND_MODES = [
  'normal',
  'overlay',
  'screen',
  'multiply',
  'difference',
  'color-burn',
  'color-dodge',
  'hard-light',
  'soft-light',
] as const;

export type ClipBlendMode = (typeof CLIP_BLEND_MODES)[number];

export interface RgbPixel {
  r: number;
  g: number;
  b: number;
}

const CLIP_BLEND_MODE_SET = new Set<string>(CLIP_BLEND_MODES);

export function normalizeClipBlendMode(value: unknown): ClipBlendMode {
  return typeof value === 'string' && CLIP_BLEND_MODE_SET.has(value) ? (value as ClipBlendMode) : 'normal';
}

export function getFfmpegBlendMode(mode: ClipBlendMode): string {
  switch (normalizeClipBlendMode(mode)) {
    case 'color-burn':
      return 'burn';
    case 'color-dodge':
      return 'dodge';
    case 'hard-light':
      return 'hardlight';
    case 'soft-light':
      return 'softlight';
    default:
      return mode;
  }
}

export function clipBlendModeToShaderIndex(mode: ClipBlendMode): number {
  return CLIP_BLEND_MODES.indexOf(normalizeClipBlendMode(mode));
}

export function blendChannel(mode: ClipBlendMode, baseValue: number, topValue: number): number {
  const base = clamp01(baseValue);
  const top = clamp01(topValue);
  switch (normalizeClipBlendMode(mode)) {
    case 'multiply':
      return base * top;
    case 'screen':
      return 1 - (1 - base) * (1 - top);
    case 'overlay':
      return overlayChannel(base, top);
    case 'difference':
      return Math.abs(base - top);
    case 'color-burn':
      return top <= 0 ? 0 : 1 - Math.min(1, (1 - base) / top);
    case 'color-dodge':
      return top >= 1 ? 1 : Math.min(1, base / (1 - top));
    case 'hard-light':
      return top < 0.5 ? 2 * base * top : 1 - 2 * (1 - base) * (1 - top);
    case 'soft-light':
      return softLightChannel(base, top);
    case 'normal':
    default:
      return top;
  }
}

export function blendPixels(mode: ClipBlendMode, base: RgbPixel, top: RgbPixel): RgbPixel {
  return {
    r: round6(blendChannel(mode, base.r, top.r)),
    g: round6(blendChannel(mode, base.g, top.g)),
    b: round6(blendChannel(mode, base.b, top.b)),
  };
}

function overlayChannel(base: number, top: number): number {
  return base < 0.5 ? 2 * base * top : 1 - 2 * (1 - base) * (1 - top);
}

function softLightChannel(base: number, top: number): number {
  if (top <= 0.5) {
    return base - (1 - 2 * top) * base * (1 - base);
  }
  const d = base <= 0.25 ? ((16 * base - 12) * base + 4) * base : Math.sqrt(base);
  return base + (2 * top - 1) * (d - base);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function round6(value: number): number {
  return Math.round(clamp01(value) * 1_000_000) / 1_000_000;
}
