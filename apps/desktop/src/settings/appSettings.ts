import { getLanguage, languageFromNavigator, normalizeLanguage, setLanguage, type Language } from '../i18n/strings';
import { normalizeSplitLayoutDefinition, type SplitLayoutDefinition } from '@open-factory/editor-core';
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

export interface ExportBackgroundSettings {
  allowPowerActions: boolean;
  postExportScriptAcknowledged: boolean;
}

export interface ViewSettings {
  safeFrameGuides: boolean;
}

export type ExportRuleTrigger = 'export-success' | 'export-failure' | 'queue-complete';
export type ExportRuleAction = 'copy-to-directory' | 'system-notification' | 'play-tone';

export type AutomationTrigger = 'on-import' | 'on-export-complete' | 'on-project-open';
export type AutomationConditionOperator = '>' | '>=' | '<' | '<=' | '==' | '!=' | 'contains';
export type AutomationConditionField = 'duration' | 'width' | 'height' | 'resolution' | 'fileSize' | 'size' | 'format' | 'type' | 'name';
export type AutomationActionType = 'generate-proxy' | 'add-tag' | 'add-color-label' | 'move-to-group' | 'send-notification';

export interface AutomationCondition {
  field: AutomationConditionField;
  op: AutomationConditionOperator;
  value: string | number | boolean;
}

export interface AutomationAction {
  type: AutomationActionType;
  value?: string;
}

export interface AutomationRule {
  id: string;
  name?: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
}

export interface ExportConditionRule {
  id: string;
  enabled: boolean;
  trigger: ExportRuleTrigger;
  action: ExportRuleAction;
  targetDirectory?: string;
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
  exportBackground?: ExportBackgroundSettings;
  exportRules?: ExportConditionRule[];
  view?: ViewSettings;
  automationRules?: AutomationRule[];
  customSplitLayouts?: SplitLayoutDefinition[];
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

export async function readExportBackgroundSettings(): Promise<ExportBackgroundSettings> {
  const settings = await readAppSettings();
  return settings.exportBackground ?? defaultExportBackgroundSettings();
}

export async function saveExportBackgroundSettings(exportBackground: Partial<ExportBackgroundSettings>): Promise<ExportBackgroundSettings> {
  const settings = await readAppSettings();
  const nextExportBackground = normalizeExportBackgroundSettings({ ...settings.exportBackground, ...exportBackground }) ?? defaultExportBackgroundSettings();
  await writeAppSettings({ ...settings, exportBackground: nextExportBackground });
  return nextExportBackground;
}

export async function readExportRules(): Promise<ExportConditionRule[]> {
  const settings = await readAppSettings();
  return settings.exportRules ?? [];
}

export async function saveExportRules(exportRules: ExportConditionRule[]): Promise<ExportConditionRule[]> {
  const settings = await readAppSettings();
  const nextExportRules = normalizeExportRules(exportRules);
  await writeAppSettings({ ...settings, exportRules: nextExportRules });
  return nextExportRules;
}

export async function readAutomationRules(): Promise<AutomationRule[]> {
  const settings = await readAppSettings();
  return settings.automationRules ?? [];
}

export async function saveAutomationRules(automationRules: AutomationRule[]): Promise<AutomationRule[]> {
  const settings = await readAppSettings();
  const nextAutomationRules = normalizeAutomationRules(automationRules);
  await writeAppSettings({ ...settings, automationRules: nextAutomationRules });
  return nextAutomationRules;
}

export async function readCustomSplitLayouts(): Promise<SplitLayoutDefinition[]> {
  const settings = await readAppSettings();
  return settings.customSplitLayouts ?? [];
}

export async function saveCustomSplitLayouts(customSplitLayouts: SplitLayoutDefinition[]): Promise<SplitLayoutDefinition[]> {
  const settings = await readAppSettings();
  const nextLayouts = normalizeCustomSplitLayouts(customSplitLayouts);
  await writeAppSettings({ ...settings, customSplitLayouts: nextLayouts });
  return nextLayouts;
}

export async function readViewSettings(): Promise<ViewSettings> {
  const settings = await readAppSettings();
  return settings.view ?? defaultViewSettings();
}

export async function saveViewSettings(view: Partial<ViewSettings>): Promise<ViewSettings> {
  const settings = await readAppSettings();
  const nextView = normalizeViewSettings({ ...settings.view, ...view }) ?? defaultViewSettings();
  await writeAppSettings({ ...settings, view: nextView });
  return nextView;
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
  const exportBackground = normalizeExportBackgroundSettings(settings.exportBackground);
  if (exportBackground) {
    normalized.exportBackground = exportBackground;
  }
  const exportRules = normalizeExportRules(settings.exportRules);
  if (exportRules.length > 0) {
    normalized.exportRules = exportRules;
  }
  const view = normalizeViewSettings(settings.view);
  if (view) {
    normalized.view = view;
  }
  const automationRules = normalizeAutomationRules(settings.automationRules);
  if (automationRules.length > 0) {
    normalized.automationRules = automationRules;
  }
  const customSplitLayouts = normalizeCustomSplitLayouts(settings.customSplitLayouts);
  if (customSplitLayouts.length > 0) {
    normalized.customSplitLayouts = customSplitLayouts;
  }
  return normalized;
}

export function normalizeCustomSplitLayouts(layouts: unknown): SplitLayoutDefinition[] {
  if (!Array.isArray(layouts)) {
    return [];
  }
  const usedIds = new Set<string>();
  return layouts.flatMap((layout, index) => {
    const normalized = normalizeSplitLayoutDefinition(layout, `custom-split-${index + 1}`);
    if (!normalized || usedIds.has(normalized.id)) {
      return [];
    }
    usedIds.add(normalized.id);
    return [normalized];
  });
}

export function normalizeAutomationRules(rules: unknown): AutomationRule[] {
  if (!Array.isArray(rules)) {
    return [];
  }
  return rules.flatMap((rule, index) => {
    if (!rule || typeof rule !== 'object') {
      return [];
    }
    const input = rule as Record<string, unknown>;
    const trigger = normalizeAutomationTrigger(input.trigger);
    if (!trigger) {
      return [];
    }
    const actions = normalizeAutomationActions(input.actions);
    if (actions.length === 0) {
      return [];
    }
    const normalized: AutomationRule = {
      id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : `automation-rule-${index + 1}`,
      enabled: input.enabled !== false,
      trigger,
      conditions: normalizeAutomationConditions(input.conditions),
      actions
    };
    if (typeof input.name === 'string' && input.name.trim()) {
      normalized.name = input.name.trim();
    }
    return [normalized];
  });
}

function normalizeAutomationConditions(value: unknown): AutomationCondition[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((condition) => {
    if (!condition || typeof condition !== 'object') {
      return [];
    }
    const input = condition as Record<string, unknown>;
    const field = normalizeAutomationConditionField(input.field);
    const op = normalizeAutomationConditionOperator(input.op);
    const conditionValue = normalizeAutomationValue(input.value);
    return field && op && conditionValue !== undefined ? [{ field, op, value: conditionValue }] : [];
  });
}

function normalizeAutomationActions(value: unknown): AutomationAction[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((action) => {
    if (!action || typeof action !== 'object') {
      return [];
    }
    const input = action as Record<string, unknown>;
    const type = normalizeAutomationActionType(input.type);
    if (!type) {
      return [];
    }
    const normalized: AutomationAction = { type };
    if (typeof input.value === 'string' && input.value.trim()) {
      normalized.value = input.value.trim();
    }
    return [normalized];
  });
}

function normalizeAutomationTrigger(value: unknown): AutomationTrigger | undefined {
  return value === 'on-import' || value === 'on-export-complete' || value === 'on-project-open' ? value : undefined;
}

function normalizeAutomationConditionOperator(value: unknown): AutomationConditionOperator | undefined {
  return value === '>' || value === '>=' || value === '<' || value === '<=' || value === '==' || value === '!=' || value === 'contains' ? value : undefined;
}

function normalizeAutomationConditionField(value: unknown): AutomationConditionField | undefined {
  return value === 'duration' ||
    value === 'width' ||
    value === 'height' ||
    value === 'resolution' ||
    value === 'fileSize' ||
    value === 'size' ||
    value === 'format' ||
    value === 'type' ||
    value === 'name'
    ? value
    : undefined;
}

function normalizeAutomationActionType(value: unknown): AutomationActionType | undefined {
  return value === 'generate-proxy' || value === 'add-tag' || value === 'add-color-label' || value === 'move-to-group' || value === 'send-notification' ? value : undefined;
}

function normalizeAutomationValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

export function normalizeExportRules(rules: unknown): ExportConditionRule[] {
  if (!Array.isArray(rules)) {
    return [];
  }
  return rules.flatMap((rule, index) => {
    if (!rule || typeof rule !== 'object') {
      return [];
    }
    const input = rule as Record<string, unknown>;
    const trigger = normalizeExportRuleTrigger(input.trigger);
    const action = normalizeExportRuleAction(input.action);
    if (!trigger || !action) {
      return [];
    }
    const normalized: ExportConditionRule = {
      id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : `export-rule-${index + 1}`,
      enabled: input.enabled !== false,
      trigger,
      action
    };
    if (typeof input.targetDirectory === 'string' && input.targetDirectory.trim()) {
      normalized.targetDirectory = input.targetDirectory.trim();
    }
    return [normalized];
  });
}

function normalizeExportRuleTrigger(value: unknown): ExportRuleTrigger | undefined {
  return value === 'export-success' || value === 'export-failure' || value === 'queue-complete' ? value : undefined;
}

function normalizeExportRuleAction(value: unknown): ExportRuleAction | undefined {
  return value === 'copy-to-directory' || value === 'system-notification' || value === 'play-tone' ? value : undefined;
}

export function normalizeExportBackgroundSettings(settings: Partial<ExportBackgroundSettings> | undefined): ExportBackgroundSettings | undefined {
  if (!settings || typeof settings !== 'object') {
    return undefined;
  }
  return {
    allowPowerActions: Boolean(settings.allowPowerActions),
    postExportScriptAcknowledged: Boolean(settings.postExportScriptAcknowledged)
  };
}

export function normalizeViewSettings(settings: Partial<ViewSettings> | undefined): ViewSettings | undefined {
  if (!settings || typeof settings !== 'object') {
    return undefined;
  }
  return {
    safeFrameGuides: settings.safeFrameGuides === true
  };
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

function defaultExportBackgroundSettings(): ExportBackgroundSettings {
  return {
    allowPowerActions: false,
    postExportScriptAcknowledged: false
  };
}

function defaultViewSettings(): ViewSettings {
  return {
    safeFrameGuides: false
  };
}

function getBrowserStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}
