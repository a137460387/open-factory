/**
 * Theme persistence - localStorage-based theme storage
 */

import type { ThemeConfig } from './types.js';

const STORAGE_KEY = 'open-factory-themes';

/**
 * Save custom themes to localStorage
 */
export function saveCustomThemes(themes: Map<string, ThemeConfig>): void {
  try {
    const customThemes = Array.from(themes.values()).filter(t => !t.isDefault);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customThemes));
  } catch {
    // Storage not available
  }
}

/**
 * Load custom themes from localStorage
 */
export function loadCustomThemes(themes: Map<string, ThemeConfig>): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ThemeConfig[];
      for (const theme of parsed) {
        themes.set(theme.id, theme);
      }
    }
  } catch {
    // Storage not available
  }
}

/**
 * Save active theme ID to localStorage
 */
export function saveActiveThemeId(themeId: string): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}-active`, themeId);
  } catch {
    // Storage not available
  }
}

/**
 * Load active theme ID from localStorage
 */
export function loadActiveThemeId(): string | null {
  try {
    return localStorage.getItem(`${STORAGE_KEY}-active`);
  } catch {
    return null;
  }
}
