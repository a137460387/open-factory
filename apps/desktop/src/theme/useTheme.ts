import { useSyncExternalStore } from 'react';
import { readThemeSettings, saveThemeSettings } from '../settings/appSettings';
import {
  DEFAULT_THEME_SETTINGS,
  applyThemeToDocument,
  normalizeThemeSettings,
  type ThemeDefinition,
  type ThemeSettings
} from './theme';

const themeListeners = new Set<() => void>();

let currentThemeSettings = normalizeThemeSettings(DEFAULT_THEME_SETTINGS);
let currentTheme = applyThemeToDocument(currentThemeSettings);

export function getCurrentTheme(): ThemeDefinition {
  return currentTheme;
}

export function getCurrentThemeSettings(): ThemeSettings {
  return normalizeThemeSettings(currentThemeSettings);
}

export function subscribeTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

export function applyThemeSettings(settings: Partial<ThemeSettings> | undefined): ThemeDefinition {
  currentThemeSettings = normalizeThemeSettings(settings);
  currentTheme = applyThemeToDocument(currentThemeSettings);
  for (const listener of themeListeners) {
    listener();
  }
  return currentTheme;
}

export async function initializeThemeFromSettings(): Promise<ThemeDefinition> {
  return applyThemeSettings(await readThemeSettings());
}

export async function setThemeSettings(settings: Partial<ThemeSettings>): Promise<ThemeDefinition> {
  const normalized = normalizeThemeSettings(settings);
  applyThemeSettings(normalized);
  await saveThemeSettings(normalized);
  return getCurrentTheme();
}

export function useTheme(): ThemeDefinition {
  return useSyncExternalStore(subscribeTheme, getCurrentTheme, getCurrentTheme);
}
