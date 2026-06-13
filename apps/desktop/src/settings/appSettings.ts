import { getLanguage, languageFromNavigator, normalizeLanguage, setLanguage, type Language } from '../i18n/strings';
import { fsExists, getAppDataDir, readFile, writeFile } from '../lib/tauri-bridge';
import {
  DEFAULT_EDITOR_LAYOUT_SETTINGS,
  normalizeStoredLayoutSettings,
  type EditorLayoutSettings
} from '../layout/layoutSettings';
import { DEFAULT_THEME_SETTINGS, normalizeThemeSettings, type ThemeSettings } from '../theme/theme';

const BROWSER_SETTINGS_KEY = 'open-factory:settings';

export interface LocalBackupSettings {
  enabled: boolean;
  directory?: string;
}

export interface WebdavBackupSettings {
  enabled: boolean;
  url?: string;
  username?: string;
}

export interface BackupSettings {
  local: LocalBackupSettings;
  webdav: WebdavBackupSettings;
  lastBackupAt?: string;
  lastBackupWarning?: string;
}

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  local: { enabled: false },
  webdav: { enabled: false }
};

export interface AppSettings {
  language?: Language;
  layout?: EditorLayoutSettings;
  backup?: BackupSettings;
  theme?: ThemeSettings;
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

export async function readBackupSettings(): Promise<BackupSettings> {
  const settings = await readAppSettings();
  return settings.backup ?? defaultBackupSettings();
}

export async function saveBackupSettings(backup: Partial<BackupSettings>): Promise<BackupSettings> {
  const settings = await readAppSettings();
  const nextBackup = normalizeBackupSettings({ ...settings.backup, ...backup }) ?? defaultBackupSettings();
  await writeAppSettings({ ...settings, backup: nextBackup });
  return nextBackup;
}

export async function readThemeSettings(): Promise<ThemeSettings> {
  const settings = await readAppSettings();
  return settings.theme ?? normalizeThemeSettings(DEFAULT_THEME_SETTINGS);
}

export async function saveThemeSettings(theme: Partial<ThemeSettings>): Promise<ThemeSettings> {
  const settings = await readAppSettings();
  const nextTheme = normalizeThemeSettings(theme);
  await writeAppSettings({ ...settings, theme: nextTheme });
  return nextTheme;
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
  const backup = normalizeBackupSettings(settings.backup);
  if (backup) {
    normalized.backup = backup;
  }
  if (settings.theme) {
    normalized.theme = normalizeThemeSettings(settings.theme);
  }
  return normalized;
}

export function normalizeBackupSettings(settings: Partial<BackupSettings> | undefined): BackupSettings | undefined {
  if (!settings || typeof settings !== 'object') {
    return undefined;
  }
  const local: Partial<LocalBackupSettings> = settings.local && typeof settings.local === 'object' ? settings.local : {};
  const webdav: Partial<WebdavBackupSettings> = settings.webdav && typeof settings.webdav === 'object' ? settings.webdav : {};
  const normalized: BackupSettings = {
    local: {
      enabled: Boolean(local.enabled)
    },
    webdav: {
      enabled: Boolean(webdav.enabled)
    }
  };
  if (typeof local.directory === 'string' && local.directory.trim()) {
    normalized.local.directory = local.directory.trim();
  }
  if (typeof webdav.url === 'string' && webdav.url.trim()) {
    normalized.webdav.url = webdav.url.trim();
  }
  if (typeof webdav.username === 'string' && webdav.username.trim()) {
    normalized.webdav.username = webdav.username.trim();
  }
  if (typeof settings.lastBackupAt === 'string' && settings.lastBackupAt.trim()) {
    normalized.lastBackupAt = settings.lastBackupAt.trim();
  }
  if (typeof settings.lastBackupWarning === 'string' && settings.lastBackupWarning.trim()) {
    normalized.lastBackupWarning = settings.lastBackupWarning.trim();
  }
  return normalized;
}

function defaultBackupSettings(): BackupSettings {
  return {
    ...DEFAULT_BACKUP_SETTINGS,
    local: { ...DEFAULT_BACKUP_SETTINGS.local },
    webdav: { ...DEFAULT_BACKUP_SETTINGS.webdav }
  };
}

function getBrowserStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}
