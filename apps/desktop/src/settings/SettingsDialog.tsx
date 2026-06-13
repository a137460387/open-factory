import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Save, Star, Trash2, X } from 'lucide-react';
import {
  SUPPORTED_PROJECT_FPS,
  UpdateClipCommand,
  UpdateProjectSettingsCommand,
  normalizeProjectFps,
  normalizeTimecodeFormat,
  supportsDropFrameTimecode,
  type Clip,
  type Project,
  type TimecodeFormat,
  type Timeline
} from '@open-factory/editor-core';
import { formatBackupDisplayTime } from '../backup/projectBackup';
import { getLanguage, normalizeLanguage, zhCN, type Language } from '../i18n/strings';
import { parseAutomationRulesJson, serializeAutomationRulesJson } from '../automation/automation-rules';
import { pickDemucsExecutablePath } from '../lib/demucs';
import { loadLutLibrary, toggleLutFavorite, type LutLibraryItem } from '../lib/lutLibrary';
import { openDirectoryDialog, readWebdavPassword, writeWebdavPassword } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import {
  detectMacroShortcutConflicts,
  exportClipMacrosToDialog,
  importClipMacrosFromDialog,
  writeClipMacros,
  type ClipMacro,
  type MacroShortcutConflict
} from '../macros/clip-macros';
import { getPluginRegistrySnapshot, refreshPluginRegistry, setPluginEnabled, uninstallPlugin, type LoadedPlugin, type PluginRegistry } from '../plugins/plugin-manager';
import { getLoadedPluginStatus, type PluginPermission } from '../plugins/plugin-loader';
import { writeCustomKeybindings } from '../shortcuts/keybindings';
import {
  TIMELINE_SHORTCUT_DEFINITIONS,
  detectTimelineShortcutConflicts,
  eventToAccelerator,
  getEffectiveTimelineShortcutBindings,
  type TimelineShortcutAction,
  type TimelineShortcutBindings
} from '../shortcuts/timeline-shortcuts';
import { commandManager, projectAccessor, timelineAccessor } from '../store/commandManager';
import { useDemucsSettingsStore } from '../store/demucsSettingsStore';
import { useEditorStore } from '../store/editorStore';
import { PROXY_RESOLUTION_PRESETS, PROXY_TRIGGER_THRESHOLDS, useProxySettingsStore, type ProxyResolutionPreset, type ProxyTriggerThreshold } from '../store/proxySettingsStore';
import { useRecordingSettingsStore } from '../store/recordingSettingsStore';
import { useTranslationSettingsStore, type TranslationProvider } from '../store/translationSettingsStore';
import {
  DEFAULT_BACKUP_SETTINGS,
  readAutomationRules,
  readBackupSettings,
  readExportBackgroundSettings,
  readExportRules,
  saveAutomationRules,
  saveBackupSettings,
  saveExportBackgroundSettings,
  saveExportRules,
  saveLanguageSetting,
  type AutomationRule,
  type BackupSettings,
  type ExportBackgroundSettings,
  type ExportConditionRule
} from './appSettings';
import {
  BUILTIN_THEME_IDS,
  DEFAULT_CUSTOM_THEME_COLORS,
  deleteCustomTheme,
  extractCustomThemeColors,
  isBuiltinThemeId,
  resolveTheme,
  upsertCustomTheme,
  type BuiltinThemeId,
  type CustomThemeColors,
  type ThemeSettings
} from '../theme/theme';
import { getCurrentThemeSettings, setThemeSettings, useTheme } from '../theme/useTheme';

interface SettingsDialogProps {
  open: boolean;
  project: Project;
  selectedClip?: Clip;
  shortcutBindings: TimelineShortcutBindings;
  macros: ClipMacro[];
  onShortcutBindingsChange(bindings: TimelineShortcutBindings): void;
  onMacrosChange(macros: ClipMacro[]): void;
  onClose(): void;
}

type SettingsTab = 'general' | 'appearance' | 'lut-library' | 'shortcuts' | 'macros' | 'automation' | 'translation' | 'proxy' | 'backup' | 'plugins';
const EXPORT_RULE_COPY_SUCCESS_ID = 'copy-success';
const EXPORT_RULE_FAILURE_NOTIFICATION_ID = 'failure-notification';
const EXPORT_RULE_QUEUE_TONE_ID = 'queue-tone';

export function SettingsDialog({ open, project, selectedClip, shortcutBindings, macros, onShortcutBindingsChange, onMacrosChange, onClose }: SettingsDialogProps) {
  const t = zhCN.settings;
  const setPreviewTimeline = useEditorStore((state) => state.setPreviewTimeline);
  const [tab, setTab] = useState<SettingsTab>('general');
  const [language, setLanguage] = useState<Language>(() => getLanguage());
  const [items, setItems] = useState<LutLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [capturingAction, setCapturingAction] = useState<TimelineShortcutAction>();
  const [capturingMacroId, setCapturingMacroId] = useState<string>();
  const [pluginRegistry, setPluginRegistry] = useState<PluginRegistry>();
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [pluginsError, setPluginsError] = useState<string>();
  const [backupSettings, setBackupSettings] = useState<BackupSettings>(() => ({
    ...DEFAULT_BACKUP_SETTINGS,
    local: { ...DEFAULT_BACKUP_SETTINGS.local },
    webdav: { ...DEFAULT_BACKUP_SETTINGS.webdav }
  }));
  const [exportBackgroundSettings, setExportBackgroundSettings] = useState<ExportBackgroundSettings>(() => ({ allowPowerActions: false }));
  const [exportRules, setExportRules] = useState<ExportConditionRule[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [automationRulesJson, setAutomationRulesJson] = useState('[]');
  const [automationRulesError, setAutomationRulesError] = useState<string>();
  const [webdavPassword, setWebdavPassword] = useState('');
  const translationProvider = useTranslationSettingsStore((state) => state.provider);
  const translationApiKey = useTranslationSettingsStore((state) => state.apiKey);
  const translationTargetLanguage = useTranslationSettingsStore((state) => state.targetLanguage);
  const setTranslationProvider = useTranslationSettingsStore((state) => state.setProvider);
  const setTranslationApiKey = useTranslationSettingsStore((state) => state.setApiKey);
  const setTranslationTargetLanguage = useTranslationSettingsStore((state) => state.setTargetLanguage);
  const demucsExecutablePath = useDemucsSettingsStore((state) => state.executablePath);
  const setDemucsExecutablePath = useDemucsSettingsStore((state) => state.setExecutablePath);
  const recordingSettings = useRecordingSettingsStore((state) => state.settings);
  const setRecordingSettings = useRecordingSettingsStore((state) => state.setSettings);
  const proxyResolutionPreset = useProxySettingsStore((state) => state.resolutionPreset);
  const proxyTriggerShortEdge = useProxySettingsStore((state) => state.triggerShortEdge);
  const setProxyResolutionPreset = useProxySettingsStore((state) => state.setResolutionPreset);
  const setProxyTriggerShortEdge = useProxySettingsStore((state) => state.setTriggerShortEdge);
  const resetProxySettings = useProxySettingsStore((state) => state.reset);
  const selectedClipCanUseLut = selectedClip?.type === 'video' || selectedClip?.type === 'image';
  const effectiveBindings = useMemo(() => getEffectiveTimelineShortcutBindings(shortcutBindings), [shortcutBindings]);
  const conflicts = useMemo(() => detectTimelineShortcutConflicts(shortcutBindings), [shortcutBindings]);
  const macroConflicts = useMemo(() => detectMacroShortcutConflicts(macros, shortcutBindings), [macros, shortcutBindings]);
  const currentTheme = useTheme();
  const [themeSettings, setThemeSettingsState] = useState<ThemeSettings>(() => getCurrentThemeSettings());
  const [customThemeName, setCustomThemeName] = useState('');
  const [customThemeColors, setCustomThemeColors] = useState<CustomThemeColors>(() => ({ ...DEFAULT_CUSTOM_THEME_COLORS }));
  const activeTheme = useMemo(() => resolveTheme(themeSettings), [themeSettings]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void refresh();
    void loadBackupSettings();
    void loadExportBackgroundSettings();
    void loadExportRules();
    void loadAutomationRules();
    hydrateThemeForm(getCurrentThemeSettings());
    showCurrentPlugins();
    return () => setPreviewTimeline(undefined);
  }, [open, setPreviewTimeline]);

  useEffect(() => {
    if (!capturingAction) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const accelerator = eventToAccelerator({
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey
      });
      event.preventDefault();
      event.stopPropagation();
      if (!accelerator) {
        return;
      }
      void updateShortcutBinding({ ...shortcutBindings, [capturingAction]: [accelerator] });
      setCapturingAction(undefined);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturingAction, shortcutBindings]);

  useEffect(() => {
    if (!capturingMacroId) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const accelerator = eventToAccelerator({
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey
      });
      event.preventDefault();
      event.stopPropagation();
      if (!accelerator) {
        return;
      }
      void updateMacroShortcut(capturingMacroId, accelerator);
      setCapturingMacroId(undefined);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturingMacroId, macros]);

  if (!open) {
    return null;
  }

  async function refresh() {
    try {
      setLoading(true);
      setError(undefined);
      setItems(await loadLutLibrary());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t.lutLibrary.loadFailedMessage;
      setError(message);
      showToast({ kind: 'warning', title: t.lutLibrary.loadFailed, message });
    } finally {
      setLoading(false);
    }
  }

  async function refreshPlugins() {
    try {
      setPluginsLoading(true);
      setPluginsError(undefined);
      setPluginRegistry(await refreshPluginRegistry());
    } catch (pluginError) {
      const message = pluginError instanceof Error ? pluginError.message : t.plugins.loadFailedMessage;
      setPluginsError(message);
      showToast({ kind: 'warning', title: t.plugins.loadFailed, message });
    } finally {
      setPluginsLoading(false);
    }
  }

  function showCurrentPlugins() {
    const snapshot = getPluginRegistrySnapshot();
    if (snapshot) {
      setPluginsError(undefined);
      setPluginRegistry(snapshot);
      return;
    }
    void refreshPlugins();
  }

  async function togglePlugin(entry: LoadedPlugin) {
    try {
      const nextRegistry = setPluginEnabled(entry.plugin.id, !entry.enabled);
      setPluginRegistry(nextRegistry ?? (await refreshPluginRegistry()));
      showToast({ kind: 'info', title: entry.enabled ? t.plugins.disabledTitle : t.plugins.enabledTitle, message: entry.plugin.name });
    } catch (pluginError) {
      const message = pluginError instanceof Error ? pluginError.message : t.plugins.loadFailedMessage;
      setPluginsError(message);
      showToast({ kind: 'warning', title: t.plugins.loadFailed, message });
    }
  }

  async function removePlugin(entry: LoadedPlugin) {
    try {
      setPluginsLoading(true);
      setPluginsError(undefined);
      setPluginRegistry(await uninstallPlugin(entry.sourcePath));
    } catch (pluginError) {
      const message = pluginError instanceof Error ? pluginError.message : t.plugins.uninstallFailedMessage;
      setPluginsError(message);
      showToast({ kind: 'warning', title: t.plugins.uninstallFailed, message });
    } finally {
      setPluginsLoading(false);
    }
  }

  function close() {
    setPreviewTimeline(undefined);
    onClose();
  }

  function preview(item: LutLibraryItem) {
    if (!selectedClipCanUseLut || !selectedClip) {
      showToast({ kind: 'warning', title: t.lutLibrary.noClipSelected, message: t.lutLibrary.noClipSelectedMessage });
      return;
    }
    setPreviewTimeline(buildPreviewTimelineWithLut(project.timeline, selectedClip.id, item.path));
  }

  function apply(item: LutLibraryItem) {
    if (!selectedClipCanUseLut || !selectedClip) {
      showToast({ kind: 'warning', title: t.lutLibrary.noClipSelected, message: t.lutLibrary.noClipSelectedMessage });
      return;
    }
    try {
      commandManager.execute(new UpdateClipCommand(timelineAccessor, selectedClip.id, { colorCorrection: { lutPath: item.path } }));
      setPreviewTimeline(undefined);
      showToast({ kind: 'success', title: t.lutLibrary.applied, message: item.name });
    } catch (applyError) {
      showToast({ kind: 'warning', title: t.lutLibrary.applyFailed, message: applyError instanceof Error ? applyError.message : t.lutLibrary.applyFailedMessage });
    }
  }

  async function toggleFavorite(item: LutLibraryItem) {
    try {
      const favorites = new Set(await toggleLutFavorite(item.path));
      setItems((current) => current.map((entry) => ({ ...entry, favorite: favorites.has(entry.path) })));
    } catch (favoriteError) {
      showToast({ kind: 'warning', title: t.lutLibrary.favoriteFailed, message: favoriteError instanceof Error ? favoriteError.message : t.lutLibrary.favoriteFailedMessage });
    }
  }

  async function updateShortcutBinding(nextBindings: TimelineShortcutBindings) {
    try {
      const saved = await writeCustomKeybindings(nextBindings);
      onShortcutBindingsChange(saved);
    } catch (shortcutError) {
      showToast({ kind: 'warning', title: t.shortcuts.saveFailed, message: shortcutError instanceof Error ? shortcutError.message : t.shortcuts.saveFailedMessage });
    }
  }

  async function updateMacros(nextMacros: ClipMacro[]) {
    try {
      const saved = await writeClipMacros(nextMacros);
      onMacrosChange(saved);
    } catch (macroError) {
      showToast({ kind: 'warning', title: t.macros.saveFailed, message: macroError instanceof Error ? macroError.message : t.macros.saveFailedMessage });
    }
  }

  async function updateMacroShortcut(macroId: string, accelerator: string) {
    await updateMacros(macros.map((macro) => (macro.id === macroId ? { ...macro, shortcut: accelerator } : macro)));
  }

  function resetMacroShortcut(macroId: string) {
    void updateMacros(macros.map((macro) => (macro.id === macroId ? { ...macro, shortcut: undefined } : macro)));
  }

  async function importMacros() {
    try {
      const imported = await importClipMacrosFromDialog();
      if (imported) {
        onMacrosChange(imported);
        showToast({ kind: 'success', title: t.macros.imported, message: t.macros.importedMessage(imported.length) });
      }
    } catch (macroError) {
      showToast({ kind: 'warning', title: t.macros.importFailed, message: macroError instanceof Error ? macroError.message : t.macros.importFailedMessage });
    }
  }

  async function exportMacros() {
    try {
      const path = await exportClipMacrosToDialog(macros);
      if (path) {
        showToast({ kind: 'success', title: t.macros.exported, message: path });
      }
    } catch (macroError) {
      showToast({ kind: 'warning', title: t.macros.exportFailed, message: macroError instanceof Error ? macroError.message : t.macros.exportFailedMessage });
    }
  }

  function formatMacroConflict(conflict: MacroShortcutConflict): string {
    if (conflict.type === 'timeline' && conflict.timelineAction) {
      return t.shortcuts.actions[conflict.timelineAction];
    }
    return conflict.macroName ?? conflict.macroId ?? t.macros.unknownMacro;
  }

  async function updateLanguage(value: string) {
    const nextLanguage = normalizeLanguage(value);
    setLanguage(nextLanguage);
    try {
      await saveLanguageSetting(nextLanguage);
    } catch (languageError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: languageError instanceof Error ? languageError.message : t.general.saveFailedMessage
      });
    }
  }

  async function loadBackupSettings() {
    try {
      setBackupSettings(await readBackupSettings());
      setWebdavPassword((await readWebdavPassword()) ?? '');
    } catch (backupError) {
      showToast({
        kind: 'warning',
        title: t.backup.saveFailed,
        message: backupError instanceof Error ? backupError.message : t.backup.saveFailedMessage
      });
    }
  }

  async function loadExportBackgroundSettings() {
    try {
      setExportBackgroundSettings(await readExportBackgroundSettings());
    } catch (exportBackgroundError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: exportBackgroundError instanceof Error ? exportBackgroundError.message : t.general.saveFailedMessage
      });
    }
  }

  async function loadExportRules() {
    try {
      setExportRules(await readExportRules());
    } catch (exportRulesError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: exportRulesError instanceof Error ? exportRulesError.message : t.general.saveFailedMessage
      });
    }
  }

  async function loadAutomationRules() {
    try {
      const rules = await readAutomationRules();
      setAutomationRules(rules);
      setAutomationRulesJson(serializeAutomationRulesJson(rules));
      setAutomationRulesError(undefined);
    } catch (automationError) {
      showToast({
        kind: 'warning',
        title: t.automation.saveFailed,
        message: automationError instanceof Error ? automationError.message : t.automation.saveFailedMessage
      });
    }
  }

  async function saveAutomationRulesFromJson() {
    const parsed = parseAutomationRulesJson(automationRulesJson);
    if (!parsed.ok) {
      setAutomationRulesError(parsed.error);
      return;
    }
    try {
      const saved = await saveAutomationRules(parsed.rules);
      setAutomationRules(saved);
      setAutomationRulesJson(serializeAutomationRulesJson(saved));
      setAutomationRulesError(undefined);
      showToast({ kind: 'success', title: t.automation.saved });
    } catch (automationError) {
      const message = automationError instanceof Error ? automationError.message : t.automation.saveFailedMessage;
      setAutomationRulesError(message);
      showToast({ kind: 'warning', title: t.automation.saveFailed, message });
    }
  }

  async function toggleAutomationRule(ruleId: string, enabled: boolean) {
    const nextRules = automationRules.map((rule) => (rule.id === ruleId ? { ...rule, enabled } : rule));
    setAutomationRules(nextRules);
    setAutomationRulesJson(serializeAutomationRulesJson(nextRules));
    try {
      const saved = await saveAutomationRules(nextRules);
      setAutomationRules(saved);
      setAutomationRulesJson(serializeAutomationRulesJson(saved));
      setAutomationRulesError(undefined);
    } catch (automationError) {
      const message = automationError instanceof Error ? automationError.message : t.automation.saveFailedMessage;
      setAutomationRulesError(message);
      showToast({ kind: 'warning', title: t.automation.saveFailed, message });
    }
  }

  async function chooseDemucsExecutable() {
    try {
      const path = await pickDemucsExecutablePath();
      if (path) {
        setDemucsExecutablePath(path);
      }
    } catch (demucsError) {
      showToast({
        kind: 'warning',
        title: t.general.chooseDemucsExecutable,
        message: demucsError instanceof Error ? demucsError.message : t.general.demucsChooseFailed
      });
    }
  }

  async function updateExportBackgroundSettings(nextSettings: ExportBackgroundSettings) {
    setExportBackgroundSettings(nextSettings);
    try {
      setExportBackgroundSettings(await saveExportBackgroundSettings(nextSettings));
    } catch (exportBackgroundError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: exportBackgroundError instanceof Error ? exportBackgroundError.message : t.general.saveFailedMessage
      });
    }
  }

  async function updateExportRule(nextRule: ExportConditionRule) {
    const nextRules = upsertExportRule(exportRules, nextRule);
    setExportRules(nextRules);
    try {
      setExportRules(await saveExportRules(nextRules));
    } catch (exportRulesError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: exportRulesError instanceof Error ? exportRulesError.message : t.general.saveFailedMessage
      });
    }
  }

  async function chooseExportRuleCopyDirectory() {
    try {
      const directory = await openDirectoryDialog();
      if (directory) {
        const currentRule = getExportRule(exportRules, EXPORT_RULE_COPY_SUCCESS_ID, defaultExportCopyRule());
        await updateExportRule({ ...currentRule, targetDirectory: directory });
      }
    } catch (exportRulesError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: exportRulesError instanceof Error ? exportRulesError.message : t.general.saveFailedMessage
      });
    }
  }

  async function updateBackupSettings(nextSettings: BackupSettings) {
    setBackupSettings(nextSettings);
    try {
      setBackupSettings(await saveBackupSettings(nextSettings));
    } catch (backupError) {
      showToast({
        kind: 'warning',
        title: t.backup.saveFailed,
        message: backupError instanceof Error ? backupError.message : t.backup.saveFailedMessage
      });
    }
  }

  function hydrateThemeForm(settings: ThemeSettings) {
    const normalized = getCurrentThemeSettings();
    const nextSettings = settings ?? normalized;
    const activeCustomTheme = nextSettings.customThemes.find((theme) => theme.id === nextSettings.activeThemeId);
    const resolved = resolveTheme(nextSettings);
    setThemeSettingsState(nextSettings);
    setCustomThemeName(activeCustomTheme?.name ?? t.appearance.defaultCustomName);
    setCustomThemeColors(activeCustomTheme?.colors ?? extractCustomThemeColors(resolved));
  }

  async function updateThemeSettings(nextSettings: ThemeSettings) {
    setThemeSettingsState(nextSettings);
    try {
      await setThemeSettings(nextSettings);
    } catch (themeError) {
      showToast({
        kind: 'warning',
        title: t.appearance.saveFailed,
        message: themeError instanceof Error ? themeError.message : t.appearance.saveFailedMessage
      });
    }
  }

  async function selectTheme(themeId: string) {
    const nextSettings: ThemeSettings = {
      ...themeSettings,
      activeThemeId: themeId
    };
    hydrateThemeForm(nextSettings);
    await updateThemeSettings(nextSettings);
  }

  async function saveCustomTheme() {
    const activeCustomTheme = themeSettings.customThemes.find((theme) => theme.id === themeSettings.activeThemeId);
    const result = upsertCustomTheme(themeSettings, {
      id: activeCustomTheme?.id,
      name: customThemeName,
      colors: customThemeColors
    });
    hydrateThemeForm(result.settings);
    await updateThemeSettings(result.settings);
  }

  async function removeCustomTheme() {
    if (isBuiltinThemeId(themeSettings.activeThemeId)) {
      return;
    }
    const nextSettings = deleteCustomTheme(themeSettings, themeSettings.activeThemeId);
    hydrateThemeForm(nextSettings);
    await updateThemeSettings(nextSettings);
  }

  function updateCustomThemeColor(key: keyof CustomThemeColors, value: string) {
    setCustomThemeColors((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function chooseBackupDirectory() {
    try {
      const directory = await openDirectoryDialog();
      if (directory) {
        await updateBackupSettings({
          ...backupSettings,
          local: { ...backupSettings.local, directory }
        });
      }
    } catch (backupError) {
      showToast({
        kind: 'warning',
        title: t.backup.saveFailed,
        message: backupError instanceof Error ? backupError.message : t.backup.saveFailedMessage
      });
    }
  }

  async function updateWebdavPassword(password: string) {
    setWebdavPassword(password);
    try {
      await writeWebdavPassword(password);
    } catch (passwordError) {
      showToast({
        kind: 'warning',
        title: t.backup.passwordSaveFailed,
        message: passwordError instanceof Error ? passwordError.message : t.backup.passwordSaveFailedMessage
      });
    }
  }

  function resetShortcut(action: TimelineShortcutAction) {
    const next = { ...shortcutBindings };
    delete next[action];
    void updateShortcutBinding(next);
  }

  function resetAllShortcuts() {
    void updateShortcutBinding({});
  }

  function updateProjectFrameRate(value: string) {
    const fps = normalizeProjectFps(Number(value));
    commandManager.execute(new UpdateProjectSettingsCommand(projectAccessor, { fps, timecodeFormat: normalizeTimecodeFormat(project.settings.timecodeFormat, fps) }));
  }

  function updateProjectTimecodeFormat(value: string) {
    const timecodeFormat: TimecodeFormat = value === 'df' ? 'df' : 'ndf';
    commandManager.execute(new UpdateProjectSettingsCommand(projectAccessor, { timecodeFormat }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="settings-dialog">
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <div className="text-xs text-slate-500">{t.subtitle}</div>
          </div>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel" type="button" title={zhCN.common.close} aria-label={zhCN.common.close} data-testid="settings-close-button" onClick={close}>
            <X size={16} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <nav className="w-44 shrink-0 border-r border-line bg-panel p-2">
            <button
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'general' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-general"
              onClick={() => setTab('general')}
            >
              {t.tabs.general}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'appearance' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-appearance"
              onClick={() => setTab('appearance')}
            >
              {t.tabs.appearance}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'lut-library' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-lut-library"
              onClick={() => setTab('lut-library')}
            >
              {t.tabs.lutLibrary}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'shortcuts' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-shortcuts"
              onClick={() => setTab('shortcuts')}
            >
              {t.tabs.shortcuts}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'macros' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-macros"
              onClick={() => setTab('macros')}
            >
              {t.tabs.macros}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'automation' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-automation"
              onClick={() => setTab('automation')}
            >
              {t.tabs.automation}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'translation' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-translation"
              onClick={() => setTab('translation')}
            >
              {t.tabs.translation}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'proxy' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-proxy"
              onClick={() => setTab('proxy')}
            >
              {t.tabs.proxy}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'backup' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-backup"
              onClick={() => setTab('backup')}
            >
              {t.tabs.backup}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'plugins' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-plugins"
              onClick={() => setTab('plugins')}
            >
              {t.tabs.plugins}
            </button>
          </nav>
          <main className="min-w-0 flex-1 overflow-y-auto p-4">
            {tab === 'general' ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{t.general.title}</h3>
                  <p className="text-xs text-slate-500">{t.general.description}</p>
                </div>
                <label className="block text-xs font-medium text-slate-600">
                  {t.general.language}
                  <select
                    className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                    value={language}
                    data-testid="settings-language-select"
                    onChange={(event) => void updateLanguage(event.target.value)}
                  >
                    <option value="zh">{t.general.options.zh}</option>
                    <option value="en">{t.general.options.en}</option>
                  </select>
                </label>
                <div className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600">{t.general.languageDescription}</div>
                <div className="rounded-md border border-line bg-panel p-3">
                  <div className="mb-2">
                    <h4 className="text-xs font-semibold text-slate-700">{t.general.demucsTitle}</h4>
                    <p className="mt-1 text-xs text-slate-500">{t.general.demucsDescription}</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                      value={demucsExecutablePath}
                      placeholder={t.general.demucsExecutable}
                      data-testid="settings-demucs-executable-input"
                      onChange={(event) => setDemucsExecutablePath(event.target.value)}
                    />
                    <button
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
                      type="button"
                      title={t.general.chooseDemucsExecutable}
                      aria-label={t.general.chooseDemucsExecutable}
                      data-testid="settings-demucs-executable-choose-button"
                      onClick={() => void chooseDemucsExecutable()}
                    >
                      <FolderOpen size={15} />
                    </button>
                  </div>
                </div>
                <div className="rounded-md border border-line bg-panel p-3">
                  <div className="mb-2">
                    <h4 className="text-xs font-semibold text-slate-700">{t.general.recordingTitle}</h4>
                    <p className="mt-1 text-xs text-slate-500">{t.general.recordingDescription}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="block text-xs font-medium text-slate-600">
                      {t.general.recordingWidth}
                      <input
                        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                        type="number"
                        min={320}
                        max={7680}
                        step={16}
                        value={recordingSettings.width}
                        data-testid="settings-recording-width-input"
                        onChange={(event) => setRecordingSettings({ width: Number(event.target.value) })}
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-600">
                      {t.general.recordingHeight}
                      <input
                        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                        type="number"
                        min={240}
                        max={4320}
                        step={16}
                        value={recordingSettings.height}
                        data-testid="settings-recording-height-input"
                        onChange={(event) => setRecordingSettings({ height: Number(event.target.value) })}
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-600">
                      {t.general.recordingFrameRate}
                      <input
                        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                        type="number"
                        min={1}
                        max={120}
                        step={1}
                        value={recordingSettings.frameRate}
                        data-testid="settings-recording-framerate-input"
                        onChange={(event) => setRecordingSettings({ frameRate: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-slate-600">
                    {t.general.projectFrameRate}
                    <select
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                      value={String(normalizeProjectFps(project.settings.fps))}
                      data-testid="project-fps-select"
                      onChange={(event) => updateProjectFrameRate(event.target.value)}
                    >
                      {SUPPORTED_PROJECT_FPS.map((fps) => (
                        <option key={fps} value={fps}>
                          {formatProjectFps(fps)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    {t.general.timecodeFormat}
                    <select
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink disabled:bg-slate-100"
                      value={normalizeTimecodeFormat(project.settings.timecodeFormat, project.settings.fps)}
                      disabled={!supportsDropFrameTimecode(project.settings.fps)}
                      data-testid="project-timecode-format-select"
                      onChange={(event) => updateProjectTimecodeFormat(event.target.value)}
                    >
                      <option value="ndf">{t.general.timecodeNdf}</option>
                      <option value="df">{t.general.timecodeDf}</option>
                    </select>
                    {!supportsDropFrameTimecode(project.settings.fps) ? <span className="mt-1 block text-[11px] text-slate-500">{t.general.dropFrameUnavailable}</span> : null}
                  </label>
                </div>
                <label className="flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
                  <input
                    className="mt-0.5 h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={exportBackgroundSettings.allowPowerActions}
                    data-testid="settings-export-power-actions-toggle"
                    onChange={(event) => void updateExportBackgroundSettings({ allowPowerActions: event.target.checked })}
                  />
                  <span>
                    <span className="block font-semibold text-slate-700">{t.general.allowExportPowerActions}</span>
                    <span className="mt-1 block">{t.general.allowExportPowerActionsDescription}</span>
                  </span>
                </label>
                <ExportRulesSettingsPanel
                  rules={exportRules}
                  onRuleChange={(rule) => void updateExportRule(rule)}
                  onChooseCopyDirectory={() => void chooseExportRuleCopyDirectory()}
                />
              </div>
            ) : null}
            {tab === 'appearance' ? (
              <AppearanceSettingsPanel
                settings={themeSettings}
                activeTheme={activeTheme}
                liveTheme={currentTheme}
                customName={customThemeName}
                customColors={customThemeColors}
                onThemeChange={(themeId) => void selectTheme(themeId)}
                onCustomNameChange={setCustomThemeName}
                onCustomColorChange={updateCustomThemeColor}
                onSaveCustom={() => void saveCustomTheme()}
                onDeleteCustom={() => void removeCustomTheme()}
              />
            ) : null}
            {tab === 'lut-library' ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{t.lutLibrary.title}</h3>
                    <p className="text-xs text-slate-500">{selectedClipCanUseLut ? t.lutLibrary.readyForClip(selectedClip?.name ?? '') : t.lutLibrary.noClipSelectedMessage}</p>
                  </div>
                  <button
                    className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                    type="button"
                    onClick={() => void refresh()}
                    data-testid="lut-library-refresh-button"
                  >
                    {t.lutLibrary.refresh}
                  </button>
                </div>
                {loading ? <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.lutLibrary.loading}</div> : null}
                {error ? <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div> : null}
                {!loading && items.length === 0 ? <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.lutLibrary.empty}</div> : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <div key={item.path} className="rounded-md border border-line bg-white p-3 shadow-sm" data-testid="lut-library-item">
                      <div className="flex items-start gap-3">
                        <div className="h-[54px] w-24 shrink-0 overflow-hidden rounded bg-slate-100">
                          {item.previewDataUrl ? <img className="h-full w-full object-cover" src={item.previewDataUrl} alt="" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink" title={item.path}>{item.name}</div>
                          <div className="truncate text-xs text-slate-500" title={item.path}>{item.path}</div>
                        </div>
                        <button
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line ${item.favorite ? 'bg-amber-50 text-amber-600' : 'bg-white text-slate-500'} hover:bg-panel`}
                          type="button"
                          title={item.favorite ? t.lutLibrary.unfavorite : t.lutLibrary.favorite}
                          aria-label={item.favorite ? t.lutLibrary.unfavorite : t.lutLibrary.favorite}
                          data-testid="lut-library-favorite-button"
                          onClick={() => void toggleFavorite(item)}
                        >
                          <Star size={15} fill={item.favorite ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          className="flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          disabled={!selectedClipCanUseLut}
                          data-testid="lut-library-preview-button"
                          onClick={() => preview(item)}
                        >
                          {t.lutLibrary.preview}
                        </button>
                        <button
                          className="flex-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          disabled={!selectedClipCanUseLut}
                          data-testid="lut-library-apply-button"
                          onClick={() => apply(item)}
                        >
                          {t.lutLibrary.apply}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            {tab === 'shortcuts' ? (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{t.shortcuts.title}</h3>
                    <p className="text-xs text-slate-500">{t.shortcuts.description}</p>
                  </div>
                  <button className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel" type="button" onClick={resetAllShortcuts} data-testid="shortcuts-reset-all-button">
                    {t.shortcuts.resetAll}
                  </button>
                </div>
                <div className="space-y-2">
                  {TIMELINE_SHORTCUT_DEFINITIONS.map((definition) => {
                    const conflictList = conflicts[definition.action];
                    const hasConflict = conflictList.length > 0;
                    const label = t.shortcuts.actions[definition.action];
                    return (
                      <div
                        key={definition.action}
                        className={`rounded-md border p-3 ${hasConflict ? 'border-rose-300 bg-rose-50' : 'border-line bg-white'}`}
                        data-testid={`shortcut-row-${definition.action}`}
                        data-conflict={hasConflict ? 'true' : 'false'}
                      >
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-ink">{label}</div>
                            {hasConflict ? <div className="text-xs font-medium text-rose-700">{t.shortcuts.conflict(conflictList.join(', '))}</div> : null}
                          </div>
                          <button
                            className="min-w-28 rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-slate-700"
                            type="button"
                            data-testid={`shortcut-bind-${definition.action}`}
                            onClick={() => {
                              setCapturingMacroId(undefined);
                              setCapturingAction(definition.action);
                            }}
                          >
                            {capturingAction === definition.action ? t.shortcuts.pressKeys : effectiveBindings[definition.action].join(' / ')}
                          </button>
                          <button
                            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                            type="button"
                            data-testid={`shortcut-reset-${definition.action}`}
                            onClick={() => resetShortcut(definition.action)}
                          >
                            {zhCN.common.reset}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {tab === 'macros' ? (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{t.macros.title}</h3>
                    <p className="text-xs text-slate-500">{t.macros.description}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel" type="button" data-testid="macros-import-button" onClick={() => void importMacros()}>
                      {t.macros.import}
                    </button>
                    <button className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel" type="button" data-testid="macros-export-button" onClick={() => void exportMacros()}>
                      {t.macros.export}
                    </button>
                  </div>
                </div>
                {macros.length === 0 ? <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.macros.empty}</div> : null}
                <div className="space-y-2">
                  {macros.map((macro) => {
                    const conflictList = macroConflicts[macro.id] ?? [];
                    const hasConflict = conflictList.length > 0;
                    return (
                      <div
                        key={macro.id}
                        className={`rounded-md border p-3 ${hasConflict ? 'border-rose-300 bg-rose-50' : 'border-line bg-white'}`}
                        data-testid={`macro-row-${macro.id}`}
                        data-conflict={hasConflict ? 'true' : 'false'}
                      >
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-ink">{macro.name}</div>
                            {macro.description ? <div className="text-xs text-slate-500">{macro.description}</div> : null}
                            {hasConflict ? <div className="mt-1 text-xs font-medium text-rose-700">{t.macros.conflict(conflictList.map(formatMacroConflict).join(', '))}</div> : null}
                          </div>
                          <button
                            className="min-w-28 rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-slate-700"
                            type="button"
                            data-testid={`macro-bind-${macro.id}`}
                            onClick={() => {
                              setCapturingAction(undefined);
                              setCapturingMacroId(macro.id);
                            }}
                          >
                            {capturingMacroId === macro.id ? t.shortcuts.pressKeys : macro.shortcut ?? t.macros.bindShortcut}
                          </button>
                          <button
                            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                            type="button"
                            data-testid={`macro-reset-${macro.id}`}
                            onClick={() => resetMacroShortcut(macro.id)}
                          >
                            {zhCN.common.reset}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {tab === 'automation' ? (
              <AutomationSettingsPanel
                rules={automationRules}
                rulesJson={automationRulesJson}
                error={automationRulesError}
                onRulesJsonChange={(value) => {
                  setAutomationRulesJson(value);
                  setAutomationRulesError(undefined);
                }}
                onSave={() => void saveAutomationRulesFromJson()}
                onToggleRule={(ruleId, enabled) => void toggleAutomationRule(ruleId, enabled)}
              />
            ) : null}
            {tab === 'translation' ? (
              <TranslationSettingsPanel
                provider={translationProvider}
                apiKey={translationApiKey}
                targetLanguage={translationTargetLanguage}
                onProviderChange={setTranslationProvider}
                onApiKeyChange={setTranslationApiKey}
                onTargetLanguageChange={setTranslationTargetLanguage}
              />
            ) : null}
            {tab === 'proxy' ? (
              <ProxySettingsPanel
                resolutionPreset={proxyResolutionPreset}
                triggerShortEdge={proxyTriggerShortEdge}
                onResolutionPresetChange={setProxyResolutionPreset}
                onTriggerShortEdgeChange={setProxyTriggerShortEdge}
                onReset={resetProxySettings}
              />
            ) : null}
            {tab === 'backup' ? (
              <BackupSettingsPanel
                settings={backupSettings}
                password={webdavPassword}
                onSettingsChange={(settings) => void updateBackupSettings(settings)}
                onChooseDirectory={() => void chooseBackupDirectory()}
                onPasswordChange={(password) => void updateWebdavPassword(password)}
              />
            ) : null}
            {tab === 'plugins' ? (
              <PluginsSettingsPanel
                registry={pluginRegistry}
                loading={pluginsLoading}
                error={pluginsError}
                onRefresh={() => void refreshPlugins()}
                onTogglePlugin={(entry) => void togglePlugin(entry)}
                onUninstallPlugin={(entry) => void removePlugin(entry)}
              />
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function AppearanceSettingsPanel({
  settings,
  activeTheme,
  liveTheme,
  customName,
  customColors,
  onThemeChange,
  onCustomNameChange,
  onCustomColorChange,
  onSaveCustom,
  onDeleteCustom
}: {
  settings: ThemeSettings;
  activeTheme: ReturnType<typeof resolveTheme>;
  liveTheme: ReturnType<typeof resolveTheme>;
  customName: string;
  customColors: CustomThemeColors;
  onThemeChange(themeId: string): void;
  onCustomNameChange(name: string): void;
  onCustomColorChange(key: keyof CustomThemeColors, value: string): void;
  onSaveCustom(): void;
  onDeleteCustom(): void;
}) {
  const t = zhCN.settings.appearance;
  const canDeleteCustom = !isBuiltinThemeId(settings.activeThemeId);
  const previewTheme = resolveTheme({
    activeThemeId: '__preview-custom-theme',
    customThemes: [{ id: '__preview-custom-theme', name: customName || t.defaultCustomName, colors: customColors }]
  });
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
        <p className="text-xs text-slate-500">{t.description}</p>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        {t.theme}
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          value={settings.activeThemeId}
          data-testid="theme-select"
          onChange={(event) => onThemeChange(event.target.value)}
        >
          {BUILTIN_THEME_IDS.map((themeId: BuiltinThemeId) => (
            <option key={themeId} value={themeId}>
              {t.themeNames[themeId]}
            </option>
          ))}
          {settings.customThemes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
      </label>
      <div
        className="rounded-md border p-3"
        data-testid="theme-preview"
        data-active-theme={activeTheme.id}
        data-live-theme={liveTheme.id}
        style={{
          borderColor: activeTheme.colors.border,
          backgroundColor: activeTheme.colors.bgPrimary,
          color: activeTheme.colors.textPrimary
        }}
      >
        <div className="text-xs font-semibold">{activeTheme.name}</div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[
            activeTheme.colors.bgSecondary,
            activeTheme.colors.bgElevated,
            activeTheme.colors.accent,
            activeTheme.colors.accentWarm
          ].map((color) => (
            <span key={color} className="h-7 rounded border" style={{ borderColor: activeTheme.colors.border, backgroundColor: color }} />
          ))}
        </div>
      </div>
      <div className="rounded-md border border-line bg-panel p-3">
        <div className="mb-3">
          <div className="text-sm font-semibold text-ink">{t.customTitle}</div>
          <p className="text-xs text-slate-500">{t.customDescription}</p>
        </div>
        <label className="block text-xs font-medium text-slate-600">
          {t.customName}
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={customName}
            data-testid="theme-custom-name-input"
            onChange={(event) => onCustomNameChange(event.target.value)}
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ThemeColorInput label={t.primaryColor} value={customColors.primary} testId="theme-primary-color-input" onChange={(value) => onCustomColorChange('primary', value)} />
          <ThemeColorInput label={t.accentColor} value={customColors.accent} testId="theme-accent-color-input" onChange={(value) => onCustomColorChange('accent', value)} />
          <ThemeColorInput label={t.backgroundColor} value={customColors.background} testId="theme-background-color-input" onChange={(value) => onCustomColorChange('background', value)} />
          <ThemeColorInput label={t.textColor} value={customColors.text} testId="theme-text-color-input" onChange={(value) => onCustomColorChange('text', value)} />
        </div>
        <div
          className="mt-3 rounded-md border p-3 text-xs"
          style={{
            borderColor: previewTheme.colors.border,
            backgroundColor: previewTheme.colors.bgPrimary,
            color: previewTheme.colors.textPrimary
          }}
        >
          <div className="font-semibold">{customName || t.defaultCustomName}</div>
          <div className="mt-2 flex gap-2">
            <span className="h-5 w-10 rounded" style={{ backgroundColor: previewTheme.colors.accent }} />
            <span className="h-5 w-10 rounded" style={{ backgroundColor: previewTheme.colors.accentWarm }} />
            <span className="h-5 w-10 rounded" style={{ backgroundColor: previewTheme.colors.bgElevated }} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95"
            type="button"
            data-testid="theme-save-custom-button"
            onClick={onSaveCustom}
          >
            <Save size={14} />
            {t.saveCustom}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:opacity-50"
            type="button"
            title={canDeleteCustom ? t.deleteCustom : t.deleteDisabled}
            disabled={!canDeleteCustom}
            data-testid="theme-delete-custom-button"
            onClick={onDeleteCustom}
          >
            <Trash2 size={14} />
            {t.deleteCustom}
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeColorInput({ label, value, testId, onChange }: { label: string; value: string; testId: string; onChange(value: string): void }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input className="mt-1 h-9 w-full rounded-md border border-line bg-white p-1" type="color" value={value} data-testid={testId} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function formatProjectFps(fps: number): string {
  return `${Number.isInteger(fps) ? fps.toFixed(0) : fps.toFixed(3)} fps`;
}

const AUTOMATION_RULE_EXAMPLE = [
  {
    trigger: 'on-import',
    conditions: [{ field: 'duration', op: '>', value: 300 }],
    actions: [{ type: 'generate-proxy' }, { type: 'add-tag', value: 'green' }]
  }
];

function AutomationSettingsPanel({
  rules,
  rulesJson,
  error,
  onRulesJsonChange,
  onSave,
  onToggleRule
}: {
  rules: AutomationRule[];
  rulesJson: string;
  error?: string;
  onRulesJsonChange(value: string): void;
  onSave(): void;
  onToggleRule(ruleId: string, enabled: boolean): void;
}) {
  const t = zhCN.settings.automation;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
        </div>
        <button
          className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
          type="button"
          data-testid="automation-rules-example-button"
          onClick={() => onRulesJsonChange(serializeAutomationRulesJson(AUTOMATION_RULE_EXAMPLE as AutomationRule[]))}
        >
          {t.example}
        </button>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        {t.editorLabel}
        <textarea
          className="mt-1 min-h-56 w-full resize-y rounded-md border border-line bg-white px-3 py-2 font-mono text-xs text-ink"
          value={rulesJson}
          spellCheck={false}
          data-testid="automation-rules-json-editor"
          onChange={(event) => onRulesJsonChange(event.target.value)}
        />
      </label>
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800" data-testid="automation-rules-error">
          {error}
        </div>
      ) : null}
      <button className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95" type="button" data-testid="automation-rules-save-button" onClick={onSave}>
        {t.save}
      </button>
      <div className="rounded-md border border-line bg-white p-3" data-testid="automation-rules-list">
        {rules.length === 0 ? <div className="text-sm text-slate-500">{t.empty}</div> : null}
        <div className="space-y-2">
          {rules.map((rule) => (
            <label key={rule.id} className="flex items-start gap-2 rounded-md border border-line bg-panel p-2 text-xs text-slate-600" data-testid="automation-rule-row">
              <input
                className="mt-0.5 h-4 w-4 accent-brand"
                type="checkbox"
                checked={rule.enabled}
                data-testid={`automation-rule-enabled-${rule.id}`}
                onChange={(event) => onToggleRule(rule.id, event.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-800">{rule.name ?? rule.id}</span>
                <span className="mt-1 block text-slate-500">{t.ruleSummary(rule.trigger, rule.actions.length)}</span>
              </span>
              <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">{rule.enabled ? t.enabled : t.disabled}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportRulesSettingsPanel({
  rules,
  onRuleChange,
  onChooseCopyDirectory
}: {
  rules: ExportConditionRule[];
  onRuleChange(rule: ExportConditionRule): void;
  onChooseCopyDirectory(): void;
}) {
  const t = zhCN.settings.exportRules;
  const copyRule = getExportRule(rules, EXPORT_RULE_COPY_SUCCESS_ID, defaultExportCopyRule());
  const failureNotificationRule = getExportRule(rules, EXPORT_RULE_FAILURE_NOTIFICATION_ID, defaultExportFailureNotificationRule());
  const queueToneRule = getExportRule(rules, EXPORT_RULE_QUEUE_TONE_ID, defaultExportQueueToneRule());

  return (
    <div className="rounded-md border border-line bg-white p-3" data-testid="settings-export-rules-panel">
      <div>
        <div className="text-sm font-semibold text-ink">{t.title}</div>
        <p className="text-xs text-slate-500">{t.description}</p>
      </div>
      <div className="mt-3 space-y-3">
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            className="mt-0.5 h-4 w-4 accent-brand"
            type="checkbox"
            checked={copyRule.enabled}
            data-testid="settings-export-rule-copy-success-toggle"
            onChange={(event) => onRuleChange({ ...copyRule, enabled: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-slate-700">{t.copyOnSuccess}</span>
            <span className="mt-1 block">{t.copyOnSuccessDescription}</span>
          </span>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.copyDirectory}
          <div className="mt-1 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              value={copyRule.targetDirectory ?? ''}
              data-testid="settings-export-rule-copy-directory-input"
              onChange={(event) => onRuleChange({ ...copyRule, targetDirectory: event.target.value })}
            />
            <button
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
              type="button"
              title={t.chooseDirectory}
              aria-label={t.chooseDirectory}
              data-testid="settings-export-rule-copy-directory-choose"
              onClick={onChooseCopyDirectory}
            >
              <FolderOpen size={15} />
            </button>
          </div>
          <span className="mt-1 block text-[11px] font-normal text-slate-500">{t.variableHelp}</span>
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            className="mt-0.5 h-4 w-4 accent-brand"
            type="checkbox"
            checked={failureNotificationRule.enabled}
            data-testid="settings-export-rule-failure-notification-toggle"
            onChange={(event) => onRuleChange({ ...failureNotificationRule, enabled: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-slate-700">{t.notifyOnFailure}</span>
            <span className="mt-1 block">{t.notifyOnFailureDescription}</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            className="mt-0.5 h-4 w-4 accent-brand"
            type="checkbox"
            checked={queueToneRule.enabled}
            data-testid="settings-export-rule-queue-tone-toggle"
            onChange={(event) => onRuleChange({ ...queueToneRule, enabled: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-slate-700">{t.playToneOnQueueComplete}</span>
            <span className="mt-1 block">{t.playToneOnQueueCompleteDescription}</span>
          </span>
        </label>
      </div>
    </div>
  );
}

function BackupSettingsPanel({
  settings,
  password,
  onSettingsChange,
  onChooseDirectory,
  onPasswordChange
}: {
  settings: BackupSettings;
  password: string;
  onSettingsChange(settings: BackupSettings): void;
  onChooseDirectory(): void;
  onPasswordChange(password: string): void;
}) {
  const t = zhCN.settings.backup;
  const lastBackup = formatBackupDisplayTime(settings.lastBackupAt) ?? t.neverBackedUp;
  const updateLocal = (patch: Partial<BackupSettings['local']>) => onSettingsChange({ ...settings, local: { ...settings.local, ...patch } });
  const updateWebdav = (patch: Partial<BackupSettings['webdav']>) => onSettingsChange({ ...settings, webdav: { ...settings.webdav, ...patch } });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
        <p className="text-xs text-slate-500">{t.description}</p>
      </div>
      <div className="rounded-md border border-line bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">{t.localTitle}</div>
            <p className="text-xs text-slate-500">{t.localDescription}</p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              className="h-4 w-4"
              type="checkbox"
              checked={settings.local.enabled}
              data-testid="backup-local-enabled"
              onChange={(event) => updateLocal({ enabled: event.target.checked })}
            />
            {t.enableLocal}
          </label>
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-600">
            {t.directory}
            <div className="mt-1 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-sm text-ink"
                value={settings.local.directory ?? ''}
                data-testid="backup-local-directory-input"
                onChange={(event) => updateLocal({ directory: event.target.value })}
              />
              <button
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
                type="button"
                title={t.chooseDirectory}
                aria-label={t.chooseDirectory}
                data-testid="backup-local-choose-directory"
                onClick={onChooseDirectory}
              >
                <FolderOpen size={15} />
              </button>
            </div>
          </label>
        </div>
      </div>
      <div className="rounded-md border border-line bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">{t.webdavTitle}</div>
            <p className="text-xs text-slate-500">{t.webdavDescription}</p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              className="h-4 w-4"
              type="checkbox"
              checked={settings.webdav.enabled}
              data-testid="backup-webdav-enabled"
              onChange={(event) => updateWebdav({ enabled: event.target.checked })}
            />
            {t.enableWebdav}
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
            {t.url}
            <input
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              value={settings.webdav.url ?? ''}
              data-testid="backup-webdav-url-input"
              onChange={(event) => updateWebdav({ url: event.target.value })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.username}
            <input
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              value={settings.webdav.username ?? ''}
              data-testid="backup-webdav-username-input"
              onChange={(event) => updateWebdav({ username: event.target.value })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.password}
            <input
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              type="password"
              value={password}
              data-testid="backup-webdav-password-input"
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-2 text-xs text-slate-500">{t.passwordStorageNote}</div>
      </div>
      <div className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600" data-testid="backup-status">
        <div>
          {t.lastBackup}: <span data-testid="backup-status-last-time">{lastBackup}</span>
        </div>
        {settings.lastBackupWarning ? (
          <div className="mt-1 text-amber-700" data-testid="backup-status-warning">
            {t.lastWarning}: {settings.lastBackupWarning}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProxySettingsPanel({
  resolutionPreset,
  triggerShortEdge,
  onResolutionPresetChange,
  onTriggerShortEdgeChange,
  onReset
}: {
  resolutionPreset: ProxyResolutionPreset;
  triggerShortEdge: ProxyTriggerThreshold;
  onResolutionPresetChange(preset: ProxyResolutionPreset): void;
  onTriggerShortEdgeChange(threshold: ProxyTriggerThreshold): void;
  onReset(): void;
}) {
  const t = zhCN.settings.proxy;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
        </div>
        <button className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel" type="button" data-testid="proxy-settings-reset-button" onClick={onReset}>
          {t.reset}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">
          {t.resolution}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={resolutionPreset}
            data-testid="proxy-resolution-select"
            onChange={(event) => onResolutionPresetChange(normalizeProxyResolutionPreset(event.target.value))}
          >
            {Object.keys(PROXY_RESOLUTION_PRESETS).map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.triggerThreshold}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={triggerShortEdge}
            data-testid="proxy-threshold-select"
            onChange={(event) => onTriggerShortEdgeChange(normalizeProxyTriggerThreshold(event.target.value))}
          >
            {PROXY_TRIGGER_THRESHOLDS.map((threshold) => (
              <option key={threshold} value={threshold}>
                {t.thresholdOption(threshold)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function TranslationSettingsPanel({
  provider,
  apiKey,
  targetLanguage,
  onProviderChange,
  onApiKeyChange,
  onTargetLanguageChange
}: {
  provider: TranslationProvider;
  apiKey: string;
  targetLanguage: string;
  onProviderChange(provider: TranslationProvider): void;
  onApiKeyChange(apiKey: string): void;
  onTargetLanguageChange(targetLanguage: string): void;
}) {
  const t = zhCN.settings.translation;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
        <p className="text-xs text-slate-500">{t.description}</p>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        {t.provider}
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          value={provider}
          data-testid="translation-provider-select"
          onChange={(event) => onProviderChange(event.target.value === 'google' ? 'google' : 'deepl')}
        >
          <option value="deepl">DeepL</option>
          <option value="google">Google</option>
        </select>
      </label>
      <div>
        <label className="block text-xs font-medium text-slate-600">
          {t.apiKey}
          <input
            className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
            type="password"
            value={apiKey}
            data-testid="translation-api-key-input"
            onChange={(event) => onApiKeyChange(event.target.value)}
          />
        </label>
        <p className="mt-1 text-xs text-slate-500">{t.keyStorageNote}</p>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        {t.targetLanguage}
        <input
          className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm uppercase text-ink"
          value={targetLanguage}
          data-testid="translation-target-language-input"
          onChange={(event) => onTargetLanguageChange(event.target.value)}
        />
      </label>
      <div className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600">{t.localOnlyNote}</div>
    </div>
  );
}

function normalizeProxyResolutionPreset(value: string): ProxyResolutionPreset {
  return value === '540p' || value === '1080p' ? value : '720p';
}

function normalizeProxyTriggerThreshold(value: string): ProxyTriggerThreshold {
  const numeric = Number(value);
  return PROXY_TRIGGER_THRESHOLDS.includes(numeric as ProxyTriggerThreshold) ? (numeric as ProxyTriggerThreshold) : 1080;
}

function getExportRule(rules: ExportConditionRule[], id: string, fallback: ExportConditionRule): ExportConditionRule {
  return rules.find((rule) => rule.id === id) ?? fallback;
}

function upsertExportRule(rules: ExportConditionRule[], nextRule: ExportConditionRule): ExportConditionRule[] {
  const existingIndex = rules.findIndex((rule) => rule.id === nextRule.id);
  if (existingIndex === -1) {
    return [...rules, nextRule];
  }
  return rules.map((rule, index) => (index === existingIndex ? nextRule : rule));
}

function defaultExportCopyRule(): ExportConditionRule {
  return {
    id: EXPORT_RULE_COPY_SUCCESS_ID,
    enabled: false,
    trigger: 'export-success',
    action: 'copy-to-directory'
  };
}

function defaultExportFailureNotificationRule(): ExportConditionRule {
  return {
    id: EXPORT_RULE_FAILURE_NOTIFICATION_ID,
    enabled: false,
    trigger: 'export-failure',
    action: 'system-notification'
  };
}

function defaultExportQueueToneRule(): ExportConditionRule {
  return {
    id: EXPORT_RULE_QUEUE_TONE_ID,
    enabled: false,
    trigger: 'queue-complete',
    action: 'play-tone'
  };
}

function PluginsSettingsPanel({
  registry,
  loading,
  error,
  onRefresh,
  onTogglePlugin,
  onUninstallPlugin
}: {
  registry?: PluginRegistry;
  loading: boolean;
  error?: string;
  onRefresh(): void;
  onTogglePlugin(entry: LoadedPlugin): void;
  onUninstallPlugin(entry: LoadedPlugin): void;
}) {
  const t = zhCN.settings.plugins;
  const plugins = registry?.plugins ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
        </div>
        <button className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel" type="button" data-testid="plugins-refresh-button" onClick={onRefresh}>
          {t.refresh}
        </button>
      </div>
      {loading ? <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.loading}</div> : null}
      {error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div> : null}
      {!loading && plugins.length === 0 ? <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.empty}</div> : null}
      <div className="space-y-2">
        {plugins.map((entry) => {
          const status = getLoadedPluginStatus(entry);
          return (
            <div key={`${entry.sourcePath}-${entry.plugin.id}`} className="rounded-md border border-line bg-white p-3" data-testid="plugin-list-item" data-plugin-id={entry.plugin.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{entry.plugin.name}</div>
                  <div className="truncate text-xs text-slate-500">{entry.plugin.id} · {entry.plugin.version}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{entry.plugin.description || t.noDescription}</div>
                </div>
                <span className="rounded bg-panel px-2 py-1 text-[11px] font-semibold text-slate-600">{entry.builtin ? t.builtin : t.user}</span>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-slate-500">
                <div>{t.permissions}: <span data-testid="plugin-permissions">{formatPluginPermissions(entry.plugin.permissions)}</span></div>
                <div>{t.hooks}: {Object.keys(entry.plugin.hooks).join(', ') || zhCN.common.none}</div>
                <div>
                  {t.status}: <span className={`font-semibold ${pluginStatusClass(status)}`} data-testid="plugin-status" data-status={status}>{t.state[status]}</span>
                </div>
              </div>
              {entry.errors.length > 0 ? <div className="mt-2 text-xs font-medium text-amber-700" data-testid="plugin-entry-error">{t.errors}: {entry.errors.join('; ')}</div> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-md border border-line bg-panel px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-white" type="button" data-testid="plugin-toggle-button" onClick={() => onTogglePlugin(entry)}>
                  {entry.enabled ? t.disable : t.enable}
                </button>
                {!entry.builtin ? (
                  <button className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100" type="button" data-testid="plugin-uninstall-button" onClick={() => onUninstallPlugin(entry)}>
                    {t.uninstall}
                  </button>
                ) : (
                  <span className="rounded-md border border-line bg-panel px-2 py-1.5 text-xs font-medium text-slate-500">{t.builtinLocked}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {registry?.errors.map((loadError) => (
        <div key={loadError.sourcePath} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" data-testid="plugin-load-error">
          <div className="font-semibold">{t.loadFailed}</div>
          <div className="break-all">{loadError.sourcePath}: {loadError.message}</div>
        </div>
      ))}
    </div>
  );
}

function formatPluginPermissions(permissions: PluginPermission[]): string {
  return permissions.map((permission) => zhCN.settings.plugins.permissionLabels[permission]).join(', ') || zhCN.common.none;
}

function pluginStatusClass(status: 'enabled' | 'disabled' | 'error'): string {
  if (status === 'enabled') {
    return 'text-emerald-700';
  }
  if (status === 'disabled') {
    return 'text-slate-600';
  }
  return 'text-amber-700';
}

function buildPreviewTimelineWithLut(timeline: Timeline, clipId: string, lutPath: string): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) =>
        clip.id === clipId
          ? {
              ...clip,
              colorCorrection: {
                ...clip.colorCorrection,
                lutPath
              }
            }
          : clip
      )
    }))
  };
}
