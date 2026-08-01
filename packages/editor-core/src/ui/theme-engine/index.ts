/**
 * Theme engine barrel - re-exports all theme engine modules
 */

export type {
  ThemeMode,
  ColorFormat,
  ThemeColors,
  TimelineStyle,
  LayoutConfig,
  FontConfig,
  AnimationConfig,
  ThemeConfig,
  ThemePreset,
  ThemeStats,
} from './types.js';

export { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from './default-themes.js';
export { THEME_PRESETS } from './theme-presets.js';
export { generateCSSVariables } from './css-variables.js';

export { ThemeManager } from './theme-manager.js';

export {
  createThemeManager,
  getDefaultDarkTheme,
  getDefaultLightTheme,
  getAllThemePresets,
  generateThemeCSSVariables,
} from './factory.js';
