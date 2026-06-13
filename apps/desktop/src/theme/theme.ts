export type BuiltinThemeId = 'dark' | 'light' | 'high-contrast' | 'oled';
export type ThemeId = BuiltinThemeId | string;

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  accentContrast: string;
  accentWarm: string;
  warning: string;
  danger: string;
  canvasBackground: string;
  scopeBackground: string;
  scopeGuide: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  builtin: boolean;
  colors: ThemeColors;
  shadowSoft: string;
}

export interface CustomThemeColors {
  primary: string;
  accent: string;
  background: string;
  text: string;
}

export interface CustomTheme {
  id: string;
  name: string;
  colors: CustomThemeColors;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThemeSettings {
  activeThemeId: ThemeId;
  customThemes: CustomTheme[];
}

export const BUILTIN_THEME_IDS = ['dark', 'light', 'high-contrast', 'oled'] as const;

export const DEFAULT_CUSTOM_THEME_COLORS: CustomThemeColors = {
  primary: '#1f7a68',
  accent: '#d9553f',
  background: '#10141b',
  text: '#f8fafc'
};

export const BUILTIN_THEMES: Record<BuiltinThemeId, ThemeDefinition> = {
  dark: {
    id: 'dark',
    name: 'Dark',
    builtin: true,
    shadowSoft: '0 14px 32px rgba(0, 0, 0, 0.28)',
    colors: {
      bgPrimary: '#10141b',
      bgSecondary: '#171d26',
      bgElevated: '#202733',
      textPrimary: '#f4f7fb',
      textSecondary: '#b8c1cf',
      textMuted: '#8190a5',
      border: '#344053',
      accent: '#2dd4bf',
      accentContrast: '#061311',
      accentWarm: '#f97316',
      warning: '#f59e0b',
      danger: '#fb7185',
      canvasBackground: '#080c12',
      scopeBackground: '#080c12',
      scopeGuide: '#475569'
    }
  },
  light: {
    id: 'light',
    name: 'Light',
    builtin: true,
    shadowSoft: '0 12px 28px rgba(20, 24, 32, 0.10)',
    colors: {
      bgPrimary: '#edeff3',
      bgSecondary: '#f5f6f8',
      bgElevated: '#ffffff',
      textPrimary: '#16181d',
      textSecondary: '#4b5563',
      textMuted: '#64748b',
      border: '#d9dde5',
      accent: '#1f7a68',
      accentContrast: '#ffffff',
      accentWarm: '#d9553f',
      warning: '#c88922',
      danger: '#dc2626',
      canvasBackground: '#1b2028',
      scopeBackground: '#10141b',
      scopeGuide: '#94a3b8'
    }
  },
  'high-contrast': {
    id: 'high-contrast',
    name: 'High Contrast',
    builtin: true,
    shadowSoft: '0 0 0 1px rgba(255, 255, 255, 0.92)',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#0a0a0a',
      bgElevated: '#111111',
      textPrimary: '#ffffff',
      textSecondary: '#f5f5f5',
      textMuted: '#d4d4d4',
      border: '#ffffff',
      accent: '#ffff00',
      accentContrast: '#000000',
      accentWarm: '#00ffff',
      warning: '#ffbf00',
      danger: '#ff4d4d',
      canvasBackground: '#000000',
      scopeBackground: '#000000',
      scopeGuide: '#ffffff'
    }
  },
  oled: {
    id: 'oled',
    name: 'OLED Black',
    builtin: true,
    shadowSoft: '0 18px 42px rgba(0, 0, 0, 0.72)',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#050505',
      bgElevated: '#0b0b0b',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: '#1f2937',
      accent: '#22c55e',
      accentContrast: '#02130a',
      accentWarm: '#38bdf8',
      warning: '#facc15',
      danger: '#f43f5e',
      canvasBackground: '#000000',
      scopeBackground: '#000000',
      scopeGuide: '#334155'
    }
  }
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  activeThemeId: 'dark',
  customThemes: []
};

const THEME_COLOR_VARIABLES: Array<[string, keyof ThemeColors]> = [
  ['--color-bg-primary', 'bgPrimary'],
  ['--color-bg-secondary', 'bgSecondary'],
  ['--color-bg-elevated', 'bgElevated'],
  ['--color-text-primary', 'textPrimary'],
  ['--color-text-secondary', 'textSecondary'],
  ['--color-text-muted', 'textMuted'],
  ['--color-border', 'border'],
  ['--color-accent', 'accent'],
  ['--color-accent-contrast', 'accentContrast'],
  ['--color-accent-warm', 'accentWarm'],
  ['--color-warning', 'warning'],
  ['--color-danger', 'danger'],
  ['--color-canvas-bg', 'canvasBackground'],
  ['--color-scope-bg', 'scopeBackground'],
  ['--color-scope-guide', 'scopeGuide']
];

export function normalizeThemeSettings(value: Partial<ThemeSettings> | undefined): ThemeSettings {
  if (!value || typeof value !== 'object') {
    return cloneThemeSettings(DEFAULT_THEME_SETTINGS);
  }
  const customThemes = Array.isArray(value.customThemes)
    ? value.customThemes.map(normalizeCustomTheme).filter((theme): theme is CustomTheme => Boolean(theme))
    : [];
  const activeThemeId = typeof value.activeThemeId === 'string' ? value.activeThemeId : DEFAULT_THEME_SETTINGS.activeThemeId;
  const activeExists = isBuiltinThemeId(activeThemeId) || customThemes.some((theme) => theme.id === activeThemeId);
  return {
    activeThemeId: activeExists ? activeThemeId : DEFAULT_THEME_SETTINGS.activeThemeId,
    customThemes
  };
}

export function resolveTheme(settings: Partial<ThemeSettings> | undefined): ThemeDefinition {
  const normalized = normalizeThemeSettings(settings);
  if (isBuiltinThemeId(normalized.activeThemeId)) {
    return BUILTIN_THEMES[normalized.activeThemeId];
  }
  const custom = normalized.customThemes.find((theme) => theme.id === normalized.activeThemeId);
  return custom ? customThemeToDefinition(custom) : BUILTIN_THEMES.dark;
}

export function upsertCustomTheme(
  settings: Partial<ThemeSettings> | undefined,
  input: { id?: string; name: string; colors: Partial<CustomThemeColors> }
): { settings: ThemeSettings; theme: CustomTheme } {
  const normalized = normalizeThemeSettings(settings);
  const now = new Date().toISOString();
  const existing = input.id ? normalized.customThemes.find((theme) => theme.id === input.id) : undefined;
  const name = input.name.trim() || existing?.name || 'Custom Theme';
  const colors = normalizeCustomThemeColors({ ...(existing?.colors ?? DEFAULT_CUSTOM_THEME_COLORS), ...input.colors });
  const id = existing?.id ?? createCustomThemeId(name, new Set(normalized.customThemes.map((theme) => theme.id)));
  const theme: CustomTheme = {
    id,
    name,
    colors,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  const customThemes = existing
    ? normalized.customThemes.map((item) => (item.id === existing.id ? theme : item))
    : [...normalized.customThemes, theme];
  return {
    theme,
    settings: {
      activeThemeId: id,
      customThemes
    }
  };
}

export function deleteCustomTheme(settings: Partial<ThemeSettings> | undefined, id: string): ThemeSettings {
  const normalized = normalizeThemeSettings(settings);
  const customThemes = normalized.customThemes.filter((theme) => theme.id !== id);
  return {
    activeThemeId: normalized.activeThemeId === id ? DEFAULT_THEME_SETTINGS.activeThemeId : normalized.activeThemeId,
    customThemes
  };
}

export function buildThemeCssVariables(theme: ThemeDefinition): Record<string, string> {
  const variables: Record<string, string> = {
    '--shadow-soft': theme.shadowSoft
  };
  for (const [variable, key] of THEME_COLOR_VARIABLES) {
    const hex = normalizeHexColor(theme.colors[key], BUILTIN_THEMES.dark.colors[key]);
    variables[variable] = hex;
    variables[`${variable}-rgb`] = hexToRgbTriplet(hex);
  }
  return variables;
}

export function applyThemeToDocument(settings: Partial<ThemeSettings> | undefined, target: Document | undefined = typeof document === 'undefined' ? undefined : document): ThemeDefinition {
  const theme = resolveTheme(settings);
  if (!target) {
    return theme;
  }
  applyThemeDefinitionToDocument(theme, target);
  return theme;
}

export function applyThemeDefinitionToDocument(theme: ThemeDefinition, target: Document | undefined = typeof document === 'undefined' ? undefined : document): void {
  if (!target) {
    return;
  }
  const variables = buildThemeCssVariables(theme);
  for (const [key, value] of Object.entries(variables)) {
    target.documentElement.style.setProperty(key, value);
  }
  const classList = Array.from(target.body.classList);
  for (const className of classList) {
    if (className.startsWith('theme-')) {
      target.body.classList.remove(className);
    }
  }
  const safeThemeClass = `theme-${theme.builtin ? theme.id : 'custom'}`.replace(/[^a-z0-9_-]/gi, '-');
  target.body.classList.add(safeThemeClass);
  target.body.dataset.theme = theme.id;
}

export function customThemeToDefinition(theme: CustomTheme): ThemeDefinition {
  const colors = normalizeCustomThemeColors(theme.colors);
  const backgroundIsDark = relativeLuminance(colors.background) < 0.4;
  const surfaceMixColor = backgroundIsDark ? '#ffffff' : '#000000';
  const elevatedMix = backgroundIsDark ? 0.12 : 0.03;
  const secondaryMix = backgroundIsDark ? 0.08 : 0.06;
  return {
    id: theme.id,
    name: theme.name,
    builtin: false,
    shadowSoft: backgroundIsDark ? '0 18px 42px rgba(0, 0, 0, 0.40)' : '0 12px 28px rgba(20, 24, 32, 0.12)',
    colors: {
      bgPrimary: colors.background,
      bgSecondary: mixHex(colors.background, surfaceMixColor, secondaryMix),
      bgElevated: mixHex(colors.background, surfaceMixColor, elevatedMix),
      textPrimary: colors.text,
      textSecondary: mixHex(colors.text, colors.background, 0.28),
      textMuted: mixHex(colors.text, colors.background, 0.46),
      border: mixHex(colors.background, colors.text, backgroundIsDark ? 0.22 : 0.18),
      accent: colors.primary,
      accentContrast: readableTextColor(colors.primary),
      accentWarm: colors.accent,
      warning: colors.accent,
      danger: '#ef4444',
      canvasBackground: mixHex(colors.background, '#000000', backgroundIsDark ? 0.35 : 0.75),
      scopeBackground: mixHex(colors.background, '#000000', backgroundIsDark ? 0.48 : 0.82),
      scopeGuide: mixHex(colors.text, colors.background, 0.55)
    }
  };
}

export function extractCustomThemeColors(theme: ThemeDefinition): CustomThemeColors {
  if (!theme.builtin) {
    return {
      primary: theme.colors.accent,
      accent: theme.colors.accentWarm,
      background: theme.colors.bgPrimary,
      text: theme.colors.textPrimary
    };
  }
  return {
    primary: theme.colors.accent,
    accent: theme.colors.accentWarm,
    background: theme.colors.bgPrimary,
    text: theme.colors.textPrimary
  };
}

export function normalizeCustomThemeColors(colors: Partial<CustomThemeColors> | undefined): CustomThemeColors {
  return {
    primary: normalizeHexColor(colors?.primary, DEFAULT_CUSTOM_THEME_COLORS.primary),
    accent: normalizeHexColor(colors?.accent, DEFAULT_CUSTOM_THEME_COLORS.accent),
    background: normalizeHexColor(colors?.background, DEFAULT_CUSTOM_THEME_COLORS.background),
    text: normalizeHexColor(colors?.text, DEFAULT_CUSTOM_THEME_COLORS.text)
  };
}

export function isBuiltinThemeId(id: string): id is BuiltinThemeId {
  return (BUILTIN_THEME_IDS as readonly string[]).includes(id);
}

function normalizeCustomTheme(value: Partial<CustomTheme> | undefined): CustomTheme | undefined {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id.trim()) {
    return undefined;
  }
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Custom Theme';
  const theme: CustomTheme = {
    id: value.id.trim(),
    name,
    colors: normalizeCustomThemeColors(value.colors)
  };
  if (typeof value.createdAt === 'string' && value.createdAt.trim()) {
    theme.createdAt = value.createdAt.trim();
  }
  if (typeof value.updatedAt === 'string' && value.updatedAt.trim()) {
    theme.updatedAt = value.updatedAt.trim();
  }
  return theme;
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  const raw = value?.trim();
  if (!raw) {
    return fallback;
  }
  const shortMatch = raw.match(/^#([0-9a-fA-F]{3})$/);
  if (shortMatch) {
    return `#${shortMatch[1].split('').map((part) => `${part}${part}`).join('')}`.toLowerCase();
  }
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : fallback;
}

function createCustomThemeId(name: string, usedIds: Set<string>): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const base = `custom-${slug || 'theme'}`;
  let candidate = base;
  let index = 2;
  while (usedIds.has(candidate) || isBuiltinThemeId(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}

function cloneThemeSettings(settings: ThemeSettings): ThemeSettings {
  return {
    activeThemeId: settings.activeThemeId,
    customThemes: settings.customThemes.map((theme) => ({ ...theme, colors: { ...theme.colors } }))
  };
}

function hexToRgbTriplet(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = normalizeHexColor(hex, '#000000').slice(1);
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)];
}

function mixHex(left: string, right: string, amount: number): string {
  const [lr, lg, lb] = hexToRgb(left);
  const [rr, rg, rb] = hexToRgb(right);
  const ratio = Math.min(1, Math.max(0, amount));
  return rgbToHex(Math.round(lr + (rr - lr) * ratio), Math.round(lg + (rg - lg) * ratio), Math.round(lb + (rb - lb) * ratio));
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => Math.min(255, Math.max(0, value)).toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function readableTextColor(hex: string): string {
  return relativeLuminance(hex) > 0.48 ? '#000000' : '#ffffff';
}
