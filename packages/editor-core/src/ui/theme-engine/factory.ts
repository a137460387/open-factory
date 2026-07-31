/**
 * Theme engine factory functions
 */

import type { ThemeConfig, ThemePreset } from './types.js';
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from './default-themes.js';
import { THEME_PRESETS } from './theme-presets.js';
import { generateCSSVariables } from './css-variables.js';
import { ThemeManager } from './theme-manager.js';

/**
 * Create a theme manager instance
 */
export function createThemeManager(): ThemeManager {
  return new ThemeManager();
}

/**
 * Get default dark theme
 */
export function getDefaultDarkTheme(): ThemeConfig {
  return { ...DEFAULT_DARK_THEME };
}

/**
 * Get default light theme
 */
export function getDefaultLightTheme(): ThemeConfig {
  return { ...DEFAULT_LIGHT_THEME };
}

/**
 * Get all theme presets
 */
export function getAllThemePresets(): ThemePreset[] {
  return [...THEME_PRESETS];
}

/**
 * Generate CSS variables string from a theme config
 */
export function generateThemeCSSVariables(theme: ThemeConfig): string {
  return generateCSSVariables(theme);
}
