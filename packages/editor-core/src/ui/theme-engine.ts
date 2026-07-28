/**
 * Personalized theme engine
 *
 * Core features:
 * 1. Interface theme color customization
 * 2. Timeline style customization
 * 3. Layout customization
 * 4. Theme preview and reset
 * 5. Theme import/export
 *
 * This file is the barrel entry point. Modules are split into:
 * - types.ts          - Type definitions
 * - default-themes.ts - Default dark/light theme configs
 * - theme-presets.ts  - Theme presets
 * - css-variables.ts  - CSS variable generation
 * - persistence.ts    - localStorage persistence
 * - theme-manager.ts  - ThemeManager class
 * - factory.ts        - Factory functions
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
} from './theme-engine/types.js';

export { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from './theme-engine/default-themes.js';
export { THEME_PRESETS } from './theme-engine/theme-presets.js';
export { generateCSSVariables } from './theme-engine/css-variables.js';

export { ThemeManager } from './theme-engine/theme-manager.js';

export {
  createThemeManager,
  getDefaultDarkTheme,
  getDefaultLightTheme,
  getAllThemePresets,
  generateThemeCSSVariables,
} from './theme-engine/factory.js';
