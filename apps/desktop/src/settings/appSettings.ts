import { getLanguage, languageFromNavigator, normalizeLanguage, setLanguage, type Language } from '../i18n/strings';
import { fsExists, getAppDataDir, readFile, writeFile } from '../lib/tauri-bridge';
import {
  DEFAULT_EDITOR_LAYOUT_SETTINGS,
  normalizeStoredLayoutSettings,
  type EditorLayoutSettings
} from '../layout/layoutSettings';

const BROWSER_SETTINGS_KEY = 'open-factory:settings';

export interface AppSettings {
  language?: Language;
  layout?: EditorLayoutSettings;
}

export async function initializeLanguageFromSettings(): Promise<Language> {
  const settings = await readAppSettings();
  const initialLanguage = settings.language ?? languageFromNavigator(typeof navigator === 'undefined' ? undefined : navigator.language);
  return setLanguage(initialLanguage);
}

export async function saveLanguageSetting(language: string): Promise<Language> {
  const nextLanguage = normalizeLanguage(language);
  setLanguage(nextLanguage);
  const settings = await readAppSettings();
  await writeAppSettings({ ...settings, language: nextLanguage });
  return getLanguage();
}

export async function readLayoutSettings(): Promise<EditorLayoutSettings> {
  const settings = await readAppSettings();
  return settings.layout ?? { ...DEFAULT_EDITOR_LAYOUT_SETTINGS };
}

export async function saveLayoutSettings(layout: Partial<EditorLayoutSettings>): Promise<EditorLayoutSettings> {
  const settings = await readAppSettings();
  const nextLayout = normalizeStoredLayoutSettings({ ...settings.layout, ...layout }) ?? { ...DEFAULT_EDITOR_LAYOUT_SETTINGS };
  await writeAppSettings({ ...settings, layout: nextLayout });
  return nextLayout;
}

export async function readAppSettings(): Promise<AppSettings> {
  const fileSettings = await readFileSettings();
  if (fileSettings) {
    return fileSettings;
  }
  const raw = getBrowserStorage()?.getItem(BROWSER_SETTINGS_KEY);
  if (!raw) {
    return {};
  }
  return normalizeSettings(JSON.parse(raw) as Partial<AppSettings>);
}

export async function writeAppSettings(settings: AppSettings): Promise<void> {
  const normalized = normalizeSettings(settings);
  const settingsPath = await getSettingsFilePath().catch(() => undefined);
  if (settingsPath) {
    await writeFile(settingsPath, JSON.stringify(normalized, null, 2));
    return;
  }
  getBrowserStorage()?.setItem(BROWSER_SETTINGS_KEY, JSON.stringify(normalized));
}

export async function getSettingsFilePath(): Promise<string> {
  const appDataDir = await getAppDataDir();
  return `${appDataDir.replace(/\/+$/, '')}/settings.json`;
}

async function readFileSettings(): Promise<AppSettings | undefined> {
  const settingsPath = await getSettingsFilePath().catch(() => undefined);
  if (!settingsPath || !(await fsExists(settingsPath).catch(() => false))) {
    return undefined;
  }
  try {
    return normalizeSettings(JSON.parse(await readFile(settingsPath)) as Partial<AppSettings>);
  } catch {
    return undefined;
  }
}

function normalizeSettings(settings: Partial<AppSettings>): AppSettings {
  const normalized: AppSettings = {};
  if (settings.language) {
    normalized.language = normalizeLanguage(settings.language);
  }
  const layout = normalizeStoredLayoutSettings(settings.layout);
  if (layout) {
    normalized.layout = layout;
  }
  return normalized;
}

function getBrowserStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}
