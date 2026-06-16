export type BuiltinAudioVisualizationThemeId = 'neon-cyberpunk' | 'minimal-white' | 'retro-vu' | 'nature' | 'flame';

export type AudioVisualizationThemeBackground =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; color: string; color2: string };

export interface AudioVisualizationThemeDefinition {
  id: string;
  name: string;
  colorStart: string;
  colorEnd: string;
  background: AudioVisualizationThemeBackground;
  glow: boolean;
  glowColor: string;
  glowStrength: number;
  particles: boolean;
  particleColor: string;
  border: boolean;
  borderColor: string;
  borderWidth: number;
}

export type CustomAudioVisualizationTheme = AudioVisualizationThemeDefinition;

export interface AudioVisualizationThemeSource {
  themeId?: string;
  theme?: Partial<AudioVisualizationThemeDefinition>;
  color?: string;
  colorStart?: string;
  colorEnd?: string;
  background?: Partial<AudioVisualizationThemeBackground>;
}

export interface ExpandedAudioVisualizationTheme {
  themeId: string;
  colorStart: string;
  colorEnd: string;
  background: AudioVisualizationThemeBackground;
  glow: boolean;
  glowColor: string;
  glowStrength: number;
  particles: boolean;
  particleColor: string;
  border: boolean;
  borderColor: string;
  borderWidth: number;
}

export const MANUAL_AUDIO_VISUALIZATION_THEME_ID = 'manual';

export const BUILTIN_AUDIO_VISUALIZATION_THEMES: readonly AudioVisualizationThemeDefinition[] = [
  {
    id: 'neon-cyberpunk',
    name: '霓虹赛博朋克',
    colorStart: '#8b5cf6',
    colorEnd: '#22d3ee',
    background: { type: 'gradient', color: '#120026', color2: '#020617' },
    glow: true,
    glowColor: '#a78bfa',
    glowStrength: 0.75,
    particles: true,
    particleColor: '#67e8f9',
    border: true,
    borderColor: '#38bdf8',
    borderWidth: 2
  },
  {
    id: 'minimal-white',
    name: '极简白',
    colorStart: '#ffffff',
    colorEnd: '#d1d5db',
    background: { type: 'solid', color: '#000000' },
    glow: false,
    glowColor: '#ffffff',
    glowStrength: 0,
    particles: false,
    particleColor: '#ffffff',
    border: true,
    borderColor: '#ffffff',
    borderWidth: 1
  },
  {
    id: 'retro-vu',
    name: '复古 VU',
    colorStart: '#40d650',
    colorEnd: '#facc15',
    background: { type: 'solid', color: '#02130a' },
    glow: false,
    glowColor: '#7ddc63',
    glowStrength: 0.25,
    particles: false,
    particleColor: '#facc15',
    border: true,
    borderColor: '#7ddc63',
    borderWidth: 3
  },
  {
    id: 'nature',
    name: '自然',
    colorStart: '#22c55e',
    colorEnd: '#86efac',
    background: { type: 'gradient', color: '#052e16', color2: '#064e3b' },
    glow: true,
    glowColor: '#4ade80',
    glowStrength: 0.35,
    particles: true,
    particleColor: '#bbf7d0',
    border: false,
    borderColor: '#86efac',
    borderWidth: 1
  },
  {
    id: 'flame',
    name: '火焰',
    colorStart: '#ef4444',
    colorEnd: '#f97316',
    background: { type: 'gradient', color: '#1f0602', color2: '#450a0a' },
    glow: true,
    glowColor: '#fb923c',
    glowStrength: 0.65,
    particles: true,
    particleColor: '#fed7aa',
    border: true,
    borderColor: '#fdba74',
    borderWidth: 2
  }
];

export const BUILTIN_AUDIO_VISUALIZATION_THEME_IDS = BUILTIN_AUDIO_VISUALIZATION_THEMES.map((theme) => theme.id) as BuiltinAudioVisualizationThemeId[];

export function isBuiltinAudioVisualizationThemeId(value: string | undefined): value is BuiltinAudioVisualizationThemeId {
  return BUILTIN_AUDIO_VISUALIZATION_THEME_IDS.includes(value as BuiltinAudioVisualizationThemeId);
}

export function getBuiltinAudioVisualizationTheme(id: string | undefined): AudioVisualizationThemeDefinition | undefined {
  return BUILTIN_AUDIO_VISUALIZATION_THEMES.find((theme) => theme.id === id);
}

export function resolveAudioVisualizationTheme(
  themeId: string | undefined,
  customThemes: readonly AudioVisualizationThemeDefinition[] = [],
  inlineTheme?: Partial<AudioVisualizationThemeDefinition>
): AudioVisualizationThemeDefinition | undefined {
  if (inlineTheme) {
    return normalizeAudioVisualizationTheme(inlineTheme);
  }
  if (!themeId || themeId === MANUAL_AUDIO_VISUALIZATION_THEME_ID) {
    return undefined;
  }
  return customThemes.find((theme) => theme.id === themeId) ?? getBuiltinAudioVisualizationTheme(themeId);
}

export function expandAudioVisualizationTheme(
  source: AudioVisualizationThemeSource = {},
  customThemes: readonly AudioVisualizationThemeDefinition[] = []
): ExpandedAudioVisualizationTheme {
  const resolved = resolveAudioVisualizationTheme(source.themeId, customThemes, source.theme);
  const manualColorStart = normalizeHexColor(source.colorStart ?? source.color, '#22d3ee');
  const colorStart = resolved?.colorStart ?? manualColorStart;
  const colorEnd = resolved?.colorEnd ?? normalizeHexColor(source.colorEnd, colorStart);
  return {
    themeId: resolved?.id ?? source.themeId ?? MANUAL_AUDIO_VISUALIZATION_THEME_ID,
    colorStart,
    colorEnd,
    background: resolved?.background ?? normalizeThemeBackground(source.background, { type: 'solid', color: '#050816' }),
    glow: resolved?.glow ?? false,
    glowColor: resolved?.glowColor ?? colorStart,
    glowStrength: resolved?.glowStrength ?? 0,
    particles: resolved?.particles ?? false,
    particleColor: resolved?.particleColor ?? colorEnd,
    border: resolved?.border ?? false,
    borderColor: resolved?.borderColor ?? colorStart,
    borderWidth: resolved?.borderWidth ?? 1
  };
}

export function normalizeAudioVisualizationTheme(input: Partial<AudioVisualizationThemeDefinition> | undefined): AudioVisualizationThemeDefinition {
  const fallback = BUILTIN_AUDIO_VISUALIZATION_THEMES[0];
  const colorStart = normalizeHexColor(input?.colorStart, fallback.colorStart);
  const colorEnd = normalizeHexColor(input?.colorEnd, colorStart);
  return {
    id: normalizeThemeId(input?.id, fallback.id),
    name: normalizeThemeName(input?.name, fallback.name),
    colorStart,
    colorEnd,
    background: normalizeThemeBackground(input?.background, fallback.background),
    glow: input?.glow === true,
    glowColor: normalizeHexColor(input?.glowColor, colorStart),
    glowStrength: normalizeUnitNumber(input?.glowStrength, fallback.glowStrength),
    particles: input?.particles === true,
    particleColor: normalizeHexColor(input?.particleColor, colorEnd),
    border: input?.border === true,
    borderColor: normalizeHexColor(input?.borderColor, colorStart),
    borderWidth: normalizeInteger(input?.borderWidth, 1, 12, fallback.borderWidth)
  };
}

export function normalizeCustomAudioVisualizationThemes(input: unknown): CustomAudioVisualizationTheme[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const normalized = normalizeAudioVisualizationTheme(item as Partial<AudioVisualizationThemeDefinition>);
    if (!normalized.id || isBuiltinAudioVisualizationThemeId(normalized.id) || normalized.id === MANUAL_AUDIO_VISUALIZATION_THEME_ID || seen.has(normalized.id)) {
      return [];
    }
    seen.add(normalized.id);
    return [normalized];
  });
}

export function upsertCustomAudioVisualizationTheme(
  themes: readonly CustomAudioVisualizationTheme[],
  theme: Partial<AudioVisualizationThemeDefinition>
): CustomAudioVisualizationTheme[] {
  const normalized = normalizeAudioVisualizationTheme(theme);
  const id = isBuiltinAudioVisualizationThemeId(normalized.id) || normalized.id === MANUAL_AUDIO_VISUALIZATION_THEME_ID ? `custom-${normalized.id}` : normalized.id;
  const nextTheme = { ...normalized, id };
  const existing = normalizeCustomAudioVisualizationThemes(themes);
  const replaced = existing.some((item) => item.id === id);
  return replaced ? existing.map((item) => (item.id === id ? nextTheme : item)) : [...existing, nextTheme];
}

export function removeCustomAudioVisualizationTheme(themes: readonly CustomAudioVisualizationTheme[], id: string): CustomAudioVisualizationTheme[] {
  const normalizedId = normalizeThemeId(id, '');
  return normalizeCustomAudioVisualizationThemes(themes).filter((theme) => theme.id !== normalizedId);
}

function normalizeThemeBackground(
  input: Partial<AudioVisualizationThemeBackground> | undefined,
  fallback: AudioVisualizationThemeBackground
): AudioVisualizationThemeBackground {
  if (input?.type === 'gradient') {
    const color = normalizeHexColor(input.color, fallback.type === 'gradient' ? fallback.color : '#050816');
    return {
      type: 'gradient',
      color,
      color2: normalizeHexColor(input.color2, fallback.type === 'gradient' ? fallback.color2 : color)
    };
  }
  if (input?.type === 'solid') {
    return { type: 'solid', color: normalizeHexColor(input.color, fallback.color) };
  }
  return { ...fallback };
}

function normalizeThemeId(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return normalized || fallback;
}

function normalizeThemeName(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : fallback;
}

function normalizeHexColor(value: unknown, fallback: string): string {
  const candidate = typeof value === 'string' ? value.trim() : '';
  const six = /^#?([0-9a-fA-F]{6})$/.exec(candidate);
  if (six) {
    return `#${six[1].toLowerCase()}`;
  }
  const three = /^#?([0-9a-fA-F]{3})$/.exec(candidate);
  if (three) {
    const [r, g, b] = three[1].toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function normalizeUnitNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

function normalizeInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.round(Math.min(max, Math.max(min, value)));
}
