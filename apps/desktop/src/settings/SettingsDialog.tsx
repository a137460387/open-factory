import {logger} from '@open-factory/editor-core/utils';
import {useEffect, useMemo, useState} from 'react';
import {X} from 'lucide-react';
import {DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS, BUILTIN_TIMELINE_SCRIPTS, RunScriptCommand, UpdateProjectSettingsCommand, createTimelineScriptSnapshot, createEffectPresetFromClip, serializeEffectPresetFile, getTimelineScriptApiFunctionNames, getTimelineScriptExportRequests, normalizeProjectColorPipeline, normalizeProjectFps, normalizeProjectWorkingColorSpace, normalizeTimecodeFormat, normalizeVfrHandlingStrategy, type Clip, type BuiltinTimelineScript, type EffectPresetFilters, type Project, type ProjectColorPipeline, type PostExportQualityAssuranceSettings, type TimecodeFormat, type TimelineScriptOperation} from '@open-factory/editor-core';
import {getLanguage, normalizeLanguage, setLanguage as setI18nLanguage, zhCN, type Language} from '../i18n/strings';
import {switchLanguage} from '../i18n/i18next-config';
import {parseAutomationRulesJson, serializeAutomationRulesJson} from '../automation/automation-rules';
import {pickDemucsExecutablePath} from '../lib/demucs';
import {bridgeConfirm, fsExists, getFileStat, openDirectoryDialog, openFileDialog, openPath, readExportPresetSyncWebdavPassword, readWebdavPassword, writeExportPresetSyncWebdavPassword, writeWebdavPassword} from '../lib/tauri-bridge';
import {showToast} from '../lib/toast';
import {PREVIEW_QUALITY_MODES, PREVIEW_SKIP_FRAME_OPTIONS, type PreviewPerformanceSettings, type PreviewQualityMode, type PreviewSkipFrames} from '../lib/preview/preview-performance';
import {type ClipMacro} from '../macros/clip-macros';
import {getPluginRegistrySnapshot, refreshPluginRegistry, setPluginEnabled, uninstallPlugin, type LoadedPlugin, type PluginRegistry} from '../plugins/plugin-manager';
import {installCatalogPlugin, installPluginFromFile, loadPluginCatalog, type PluginCatalogEntry, type PluginCatalogResult} from '../plugins/plugin-market';
import {loadExportPresets, serializeExportPresetPackage} from '../export/export-presets';
import {filterPresetMarketCards, installPresetMarketCard, loadPresetMarket, presetMarketCardHasCustomConflict, readPresetMarketRatings, writePresetMarketRating, type PresetMarketCard, type PresetMarketFilters, type PresetMarketLoadResult} from '../export/preset-market';
import {filterEffectPresetCommunityCards, installEffectPresetCommunityCard, loadEffectPresetCommunityLibrary, type EffectPresetCommunityCard, type EffectPresetCommunityLoadResult} from '../effects/effect-preset-library';
import {type TimelineShortcutBindings} from '../shortcuts/timeline-shortcuts';
import {commandManager, projectAccessor, timelineAccessor} from '../store/commandManager';
import {useDemucsSettingsStore} from '../store/demucsSettingsStore';
import {useEditorStore} from '../store/editorStore';
import {usePrivacyDetectionSettingsStore} from '../store/privacyDetectionSettingsStore';
import {useProxySettingsStore} from '../store/proxySettingsStore';
import {useRecordingSettingsStore} from '../store/recordingSettingsStore';
import {useTranslationSettingsStore} from '../store/translationSettingsStore';
import {AIServicesSettingsPanel} from './AIServicesSettingsPanel';
import {AppearanceSettingsPanel} from './AppearanceSettingsPanel';
import {AutomationSettingsPanel} from './AutomationSettingsPanel';
import {BackupSettingsPanel} from './BackupSettingsPanel';
import {EffectPresetCommunityPanel} from './EffectPresetPanel';
import {ExportPresetSyncSettingsPanel} from './ExportPresetSyncPanel';
import {EXPORT_RULE_COPY_SUCCESS_ID, defaultExportCopyRule, getExportRule, upsertExportRule} from './ExportRulesPanel';
import {formatBytes} from './formatHelpers';
import {HardwareAccelerationSettingsPanel} from './HardwareAccelerationSettingsPanel';
import {GeneralSettingsPanel} from './GeneralSettingsPanel';
import {LutLibraryPanel} from './LutLibraryPanel';
import {ShortcutMacrosPanel} from './ShortcutMacrosPanel';
import {GesturePracticePanel} from '../components/GestureControl/GestureTutorial';
import {LocalModelsSettingsPanel} from './LocalModelsPanel';
import {PluginsSettingsPanel} from './PluginsSettingsPanel';
import {PresetMarketPanel} from './PresetMarketPanel';
import {ProxySettingsPanel} from './ProxySettingsPanel';
import {TaskMonitorSettingsPanel} from './TaskMonitorSettingsPanel';
import {TimelineScriptsSettingsPanel} from './TimelineScriptsSettingsPanel';
import {TranslationSettingsPanel} from './TranslationSettingsPanel';
import {useWhisperSettingsStore} from '../store/whisperSettingsStore';
import {applyLocalCoeditingSettings} from '../collaboration/settings';
import {runTimelineScriptInWorker} from '../scripting/timeline-script-runtime';
import {deleteTimelineScript, exportTimelineScriptToDialog, importTimelineScriptFromDialog, loadTimelineScripts, saveTimelineScript, type TimelineScriptFile} from '../scripting/timeline-scripts';
import {DEFAULT_BACKUP_SETTINGS, DEFAULT_COLLABORATION_IDENTITY_SETTINGS, DEFAULT_EXPORT_PRESET_SYNC_SETTINGS, DEFAULT_LOCAL_COEDITING_SETTINGS, readAutomationRules, readBackupSettings, readCollaborationIdentitySettings, readDisplaySettings, readExportBackgroundSettings, readExportQualityAssuranceSettings, readExportPresetSyncSettings, readExportRules, readLocalCoeditingSettings, readLocalAiModelsSettings, saveAutomationRules, saveBackupSettings, saveCollaborationIdentitySettings, saveDisplaySettings, saveExportBackgroundSettings, saveExportQualityAssuranceSettings, saveExportPresetSyncSettings, saveExportRules, saveLanguageSetting, saveLocalCoeditingSettings, saveLocalAiModelsSettings, readUpdateSettings, saveUpdateSettings, type AutomationRule, type BackupSettings, type CollaborationIdentitySettings, type DisplaySettings, type ExportBackgroundSettings, type ExportPresetSyncSettings, type ExportConditionRule, type LocalCoeditingSettings, type TimelineInteractionSettings, readTouchOptimizationSettings, saveTouchOptimizationSettings} from './appSettings';
import type {TouchOptimizationSettings} from '@open-factory/editor-core';
import {LOCAL_AI_MODEL_DEFINITIONS, LOCAL_AI_MODEL_IDS, isLocalModelFileSizeValid, resolveLocalModelStatus, type LocalAiModelId, type LocalAiModelResolvedStatus, type LocalAiModelsSettings} from './localModels';
import {DEFAULT_CUSTOM_THEME_COLORS, deleteCustomTheme, extractCustomThemeColors, isBuiltinThemeId, resolveTheme, upsertCustomTheme, type CustomThemeColors, type ThemeSettings} from '../theme/theme';
import {getCurrentThemeSettings, setThemeSettings, useTheme} from '../theme/useTheme';
import {DEFAULT_UPDATE_SETTINGS, getEffectiveUpdaterEndpoint, type UpdateSettings} from '../updater/update-settings';

interface SettingsDialogProps {
  open: boolean;
  project: Project;
  selectedClip?: Clip;
  shortcutBindings: TimelineShortcutBindings;
  macros: ClipMacro[];
  previewPerformance: PreviewPerformanceSettings;
  timelineInteractionSettings: TimelineInteractionSettings;
  onShortcutBindingsChange(bindings: TimelineShortcutBindings): void;
  onMacrosChange(macros: ClipMacro[]): void;
  onExecuteMacro(macro: ClipMacro): void;
  onPreviewPerformanceChange(settings: Partial<PreviewPerformanceSettings>): void;
  onPreviewSkipFramesChange(skipFrames: PreviewSkipFrames): void;
  onTimelineInteractionSettingsChange(settings: Partial<TimelineInteractionSettings>): void;
  onDeleteProxies(assetIds: string[]): Promise<void> | void;
  onRegenerateProxies(assetIds: string[]): Promise<void> | void;
  onMigrateProxies(targetDirectory: string): Promise<void> | void;
  onClose(): void;
}

type SettingsTab =
  | 'general'
  | 'display'
  | 'appearance'
  | 'lut-library'
  | 'effect-presets'
  | 'shortcuts'
  | 'macros'
  | 'automation'
  | 'scripts'
  | 'translation'
  | 'local-models'
  | 'proxy'
  | 'task-monitor'
  | 'export-presets'
  | 'backup'
  | 'plugins'
  | 'ai-services'
  | 'hardware-acceleration'
  | 'gesture';

export function SettingsDialog({
  open,
  project,
  selectedClip,
  shortcutBindings,
  macros,
  previewPerformance,
  timelineInteractionSettings,
  onShortcutBindingsChange,
  onMacrosChange,
  onExecuteMacro,
  onPreviewPerformanceChange,
  onPreviewSkipFramesChange,
  onTimelineInteractionSettingsChange,
  onDeleteProxies,
  onRegenerateProxies,
  onMigrateProxies,
  onClose,
}: SettingsDialogProps) {
  const t = zhCN.settings;
  const setPreviewTimeline = useEditorStore((state) => state.setPreviewTimeline);
  const [tab, setTab] = useState<SettingsTab>('general');
  const [language, setLanguage] = useState<Language>(() => getLanguage());
  const [pluginRegistry, setPluginRegistry] = useState<PluginRegistry>();
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [pluginsError, setPluginsError] = useState<string>();
  const [pluginCatalog, setPluginCatalog] = useState<PluginCatalogResult>();
  const [pluginCatalogLoading, setPluginCatalogLoading] = useState(false);
  const [pluginCatalogError, setPluginCatalogError] = useState<string>();
  const [installingPluginId, setInstallingPluginId] = useState<string>();
  const [backupSettings, setBackupSettings] = useState<BackupSettings>(() => ({
    ...DEFAULT_BACKUP_SETTINGS,
    local: { ...DEFAULT_BACKUP_SETTINGS.local },
    webdav: { ...DEFAULT_BACKUP_SETTINGS.webdav },
  }));
  const [exportPresetSyncSettings, setExportPresetSyncSettings] = useState<ExportPresetSyncSettings>(() => ({
    ...DEFAULT_EXPORT_PRESET_SYNC_SETTINGS,
  }));
  const [exportBackgroundSettings, setExportBackgroundSettings] = useState<ExportBackgroundSettings>(() => ({
    allowPowerActions: false,
    postExportScriptAcknowledged: false,
    lowPowerMode: false,
  }));
  const [exportQualityAssuranceSettings, setExportQualityAssuranceSettings] =
    useState<PostExportQualityAssuranceSettings>(() => ({ ...DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS }));
  const [exportRules, setExportRules] = useState<ExportConditionRule[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [automationRulesJson, setAutomationRulesJson] = useState('[]');
  const [automationRulesError, setAutomationRulesError] = useState<string>();
  const [collaborationIdentity, setCollaborationIdentity] = useState<CollaborationIdentitySettings>(() => ({
    ...DEFAULT_COLLABORATION_IDENTITY_SETTINGS,
  }));
  const [localCoediting, setLocalCoediting] = useState<LocalCoeditingSettings>(() => ({
    ...DEFAULT_LOCAL_COEDITING_SETTINGS,
  }));
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(() => ({ colorGamut: 'srgb' }));
  const [touchOptimizationSettings, setTouchOptimizationSettings] = useState<TouchOptimizationSettings>(() => ({
    enabled: false,
    autoDetect: true,
    trimHandleScale: 1.6,
    uiSpacingMultiplier: 1.3,
    longPressMs: 500,
    doubleTapMs: 300,
  }));
  const [updateSettings, setUpdateSettings] = useState<UpdateSettings>(() => ({ ...DEFAULT_UPDATE_SETTINGS }));
  const [localModelsSettings, setLocalModelsSettings] = useState<LocalAiModelsSettings>({});
  const [localModelStatuses, setLocalModelStatuses] = useState<
    Partial<Record<LocalAiModelId, LocalAiModelResolvedStatus>>
  >({});
  const [webdavPassword, setWebdavPassword] = useState('');
  const [developerMode, setDeveloperMode] = useState(false);
  const [stressTestResult, setStressTestResult] = useState<string | null>(null);
  const [exportPresetSyncPassword, setExportPresetSyncPassword] = useState('');
  const [presetMarketCards, setPresetMarketCards] = useState<PresetMarketCard[]>([]);
  const [presetMarketRatings, setPresetMarketRatings] = useState<Record<string, number>>({});
  const [presetMarketFilters, setPresetMarketFilters] = useState<PresetMarketFilters>({
    platform: 'all',
    quality: 'all',
    format: 'all',
  });
  const [presetMarketLoading, setPresetMarketLoading] = useState(false);
  const [presetMarketSource, setPresetMarketSource] = useState<PresetMarketLoadResult['source']>('empty');
  const [presetMarketWarning, setPresetMarketWarning] = useState<string>();
  const [installingPresetMarketCardId, setInstallingPresetMarketCardId] = useState<string>();
  const [effectPresetCards, setEffectPresetCards] = useState<EffectPresetCommunityCard[]>([]);
  const [effectPresetFilters, setEffectPresetFilters] = useState<EffectPresetFilters>({ style: 'all', use: 'all' });
  const [effectPresetLoading, setEffectPresetLoading] = useState(false);
  const [effectPresetSource, setEffectPresetSource] = useState<EffectPresetCommunityLoadResult['source']>('empty');
  const [effectPresetWarning, setEffectPresetWarning] = useState<string>();
  const [installingEffectPresetCardId, setInstallingEffectPresetCardId] = useState<string>();
  const firstBuiltinScript = BUILTIN_TIMELINE_SCRIPTS[0];
  const [timelineScripts, setTimelineScripts] = useState<TimelineScriptFile[]>([]);
  const [selectedTimelineScriptId, setSelectedTimelineScriptId] = useState(firstBuiltinScript?.id ?? 'bulk-speed');
  const [timelineScriptName, setTimelineScriptName] = useState(() =>
    firstBuiltinScript
      ? t.scripts.examples[firstBuiltinScript.id as keyof typeof t.scripts.examples].name
      : t.scripts.defaultScriptName,
  );
  const [timelineScriptCode, setTimelineScriptCode] = useState(() => firstBuiltinScript?.code ?? '');
  const [timelineScriptPath, setTimelineScriptPath] = useState<string>();
  const [timelineScriptRunning, setTimelineScriptRunning] = useState(false);
  const [timelineScriptOutput, setTimelineScriptOutput] = useState<string[]>([]);
  const [timelineScriptError, setTimelineScriptError] = useState<string>();
  const translationProvider = useTranslationSettingsStore((state) => state.provider);
  const translationApiKey = useTranslationSettingsStore((state) => state.apiKey);
  const translationApiKeyError = useTranslationSettingsStore((state) => state.apiKeyError);
  const translationTargetLanguage = useTranslationSettingsStore((state) => state.targetLanguage);
  const loadTranslationApiKey = useTranslationSettingsStore((state) => state.loadApiKey);
  const setTranslationProvider = useTranslationSettingsStore((state) => state.setProvider);
  const setTranslationApiKey = useTranslationSettingsStore((state) => state.setApiKey);
  const setTranslationTargetLanguage = useTranslationSettingsStore((state) => state.setTargetLanguage);
  const setWhisperModelPath = useWhisperSettingsStore((state) => state.setModelPath);
  const demucsExecutablePath = useDemucsSettingsStore((state) => state.executablePath);
  const setDemucsExecutablePath = useDemucsSettingsStore((state) => state.setExecutablePath);
  const privacyDetectionModelPath = usePrivacyDetectionSettingsStore((state) => state.modelPath);
  const setPrivacyDetectionModelPath = usePrivacyDetectionSettingsStore((state) => state.setModelPath);
  const recordingSettings = useRecordingSettingsStore((state) => state.settings);
  const setRecordingSettings = useRecordingSettingsStore((state) => state.setSettings);
  const proxyResolutionPreset = useProxySettingsStore((state) => state.resolutionPreset);
  const proxyTriggerShortEdge = useProxySettingsStore((state) => state.triggerShortEdge);
  const setProxyResolutionPreset = useProxySettingsStore((state) => state.setResolutionPreset);
  const setProxyTriggerShortEdge = useProxySettingsStore((state) => state.setTriggerShortEdge);
  const resetProxySettings = useProxySettingsStore((state) => state.reset);
  const currentTheme = useTheme();
  const [themeSettings, setThemeSettingsState] = useState<ThemeSettings>(() => getCurrentThemeSettings());
  const [customThemeName, setCustomThemeName] = useState('');
  const [customThemeColors, setCustomThemeColors] = useState<CustomThemeColors>(() => ({
    ...DEFAULT_CUSTOM_THEME_COLORS,
  }));
  const activeTheme = useMemo(() => resolveTheme(themeSettings), [themeSettings]);
  const filteredPresetMarketCards = useMemo(
    () => filterPresetMarketCards(presetMarketCards, presetMarketFilters),
    [presetMarketCards, presetMarketFilters],
  );
  const filteredEffectPresetCards = useMemo(
    () => filterEffectPresetCommunityCards(effectPresetCards, effectPresetFilters),
    [effectPresetCards, effectPresetFilters],
  );
  const timelineScriptApiNames = useMemo(() => getTimelineScriptApiFunctionNames(), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadBackupSettings();
    void loadExportPresetSyncSettings();
    void loadPresetMarketPanel();
    void loadEffectPresetLibraryPanel();
    void loadTimelineScriptsPanel();
    void loadExportBackgroundSettings();
    void loadExportQualityAssuranceSettings();
    void loadExportRules();
    void loadAutomationRules();
    void loadCollaborationIdentity();
    void loadLocalCoediting();
    void loadDisplaySettings();
    void loadUpdateSettings();
    void loadLocalModelsSettings();
    void readTouchOptimizationSettings()
      .then(setTouchOptimizationSettings)
      .catch((error) => logger.warn('[Settings] Unable to load touch optimization', error));
    void loadTranslationApiKey();
    hydrateThemeForm(getCurrentThemeSettings());
    showCurrentPlugins();
    void refreshPluginCatalog();
    return () => setPreviewTimeline(undefined);
  }, [loadTranslationApiKey, open, setPreviewTimeline]);

  if (!open) {
    return null;
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

  async function refreshPluginCatalog() {
    try {
      setPluginCatalogLoading(true);
      setPluginCatalogError(undefined);
      setPluginCatalog(await loadPluginCatalog());
    } catch (catalogError) {
      const message = catalogError instanceof Error ? catalogError.message : t.plugins.catalogLoadFailedMessage;
      setPluginCatalogError(message);
    } finally {
      setPluginCatalogLoading(false);
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

  async function installMarketPlugin(entry: PluginCatalogEntry) {
    try {
      setInstallingPluginId(entry.id);
      setPluginsError(undefined);
      await installCatalogPlugin(entry);
      setPluginRegistry(await refreshPluginRegistry());
      showToast({ kind: 'info', title: t.plugins.installComplete, message: entry.name });
    } catch (pluginError) {
      const message = pluginError instanceof Error ? pluginError.message : t.plugins.installFailedMessage;
      setPluginsError(message);
      showToast({ kind: 'warning', title: t.plugins.installFailed, message });
    } finally {
      setInstallingPluginId(undefined);
    }
  }

  async function installPluginFile() {
    try {
      const paths = await openFileDialog(false, [{ name: t.plugins.fileInstallFilter, extensions: ['js'] }]);
      const sourcePath = paths[0];
      if (!sourcePath) {
        return;
      }
      setPluginsError(undefined);
      await installPluginFromFile(sourcePath);
      setPluginRegistry(await refreshPluginRegistry());
      showToast({ kind: 'info', title: t.plugins.installComplete, message: sourcePath });
    } catch (pluginError) {
      const message = pluginError instanceof Error ? pluginError.message : t.plugins.installFailedMessage;
      setPluginsError(message);
      showToast({ kind: 'warning', title: t.plugins.installFailed, message });
    }
  }

  async function togglePlugin(entry: LoadedPlugin) {
    try {
      const nextRegistry = setPluginEnabled(entry.plugin.id, !entry.enabled);
      setPluginRegistry(nextRegistry ?? (await refreshPluginRegistry()));
      showToast({
        kind: 'info',
        title: entry.enabled ? t.plugins.disabledTitle : t.plugins.enabledTitle,
        message: entry.plugin.name,
      });
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

  async function updateLanguage(value: string) {
    const nextLanguage = normalizeLanguage(value);
    setLanguage(nextLanguage);
    // 同步到 i18next 和现有 i18n 系统
    await switchLanguage(nextLanguage);
    setI18nLanguage(nextLanguage);
    try {
      await saveLanguageSetting(nextLanguage);
    } catch (languageError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: languageError instanceof Error ? languageError.message : t.general.saveFailedMessage,
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
        message: backupError instanceof Error ? backupError.message : t.backup.saveFailedMessage,
      });
    }
  }

  async function loadExportPresetSyncSettings() {
    try {
      setExportPresetSyncSettings(await readExportPresetSyncSettings());
      setExportPresetSyncPassword((await readExportPresetSyncWebdavPassword()) ?? '');
    } catch (settingsError) {
      showToast({
        kind: 'warning',
        title: t.exportPresetSync.saveFailed,
        message: settingsError instanceof Error ? settingsError.message : t.exportPresetSync.saveFailedMessage,
      });
    }
  }

  async function loadPresetMarketPanel() {
    try {
      setPresetMarketLoading(true);
      setPresetMarketWarning(undefined);
      const [market, ratings] = await Promise.all([loadPresetMarket(), readPresetMarketRatings()]);
      setPresetMarketCards(market.cards);
      setPresetMarketRatings(ratings);
      setPresetMarketSource(market.source);
      setPresetMarketWarning(market.warning);
      if (market.source === 'empty' && market.warning) {
        showToast({ kind: 'warning', title: zhCN.presetMarket.loadFailed, message: market.warning });
      }
    } catch (marketError) {
      const message = marketError instanceof Error ? marketError.message : zhCN.presetMarket.loadFailedMessage;
      setPresetMarketCards([]);
      setPresetMarketSource('empty');
      setPresetMarketWarning(message);
      showToast({ kind: 'warning', title: zhCN.presetMarket.loadFailed, message });
    } finally {
      setPresetMarketLoading(false);
    }
  }

  async function loadEffectPresetLibraryPanel() {
    try {
      setEffectPresetLoading(true);
      setEffectPresetWarning(undefined);
      const library = await loadEffectPresetCommunityLibrary();
      setEffectPresetCards(library.cards);
      setEffectPresetSource(library.source);
      setEffectPresetWarning(library.warning);
      if (library.source === 'empty' && library.warning) {
        showToast({ kind: 'warning', title: zhCN.effectPresetLibrary.loadFailed, message: library.warning });
      }
    } catch (libraryError) {
      const message = libraryError instanceof Error ? libraryError.message : zhCN.effectPresetLibrary.loadFailedMessage;
      setEffectPresetCards([]);
      setEffectPresetSource('empty');
      setEffectPresetWarning(message);
      showToast({ kind: 'warning', title: zhCN.effectPresetLibrary.loadFailed, message });
    } finally {
      setEffectPresetLoading(false);
    }
  }

  async function loadTimelineScriptsPanel() {
    try {
      const files = await loadTimelineScripts();
      setTimelineScripts(files);
    } catch (scriptError) {
      showToast({
        kind: 'warning',
        title: t.scripts.loadFailed,
        message: scriptError instanceof Error ? scriptError.message : t.scripts.loadFailedMessage,
      });
    }
  }

  function selectBuiltinTimelineScript(script: BuiltinTimelineScript) {
    const label = t.scripts.examples[script.id as keyof typeof t.scripts.examples];
    setSelectedTimelineScriptId(script.id);
    setTimelineScriptName(label.name);
    setTimelineScriptCode(script.code);
    setTimelineScriptPath(undefined);
    setTimelineScriptError(undefined);
    setTimelineScriptOutput([]);
  }

  function selectTimelineScriptFile(file: TimelineScriptFile) {
    setSelectedTimelineScriptId(file.id);
    setTimelineScriptName(file.name);
    setTimelineScriptCode(file.code);
    setTimelineScriptPath(file.path);
    setTimelineScriptError(undefined);
    setTimelineScriptOutput([]);
  }

  function createNewTimelineScript() {
    setSelectedTimelineScriptId('draft-script');
    setTimelineScriptName(t.scripts.defaultScriptName);
    setTimelineScriptCode('');
    setTimelineScriptPath(undefined);
    setTimelineScriptError(undefined);
    setTimelineScriptOutput([]);
  }

  async function saveCurrentTimelineScript() {
    try {
      const saved = await saveTimelineScript(timelineScriptName, timelineScriptCode, timelineScriptPath);
      setTimelineScripts((files) =>
        [saved, ...files.filter((file) => file.path !== saved.path && file.path !== timelineScriptPath)].sort(
          (left, right) => left.name.localeCompare(right.name),
        ),
      );
      selectTimelineScriptFile(saved);
      showToast({ kind: 'success', title: t.scripts.saved, message: saved.name });
    } catch (saveError) {
      showToast({
        kind: 'warning',
        title: t.scripts.saveFailed,
        message: saveError instanceof Error ? saveError.message : t.scripts.saveFailedMessage,
      });
    }
  }

  async function deleteCurrentTimelineScript() {
    if (!timelineScriptPath) {
      return;
    }
    try {
      await deleteTimelineScript(timelineScriptPath);
      setTimelineScripts((files) => files.filter((file) => file.path !== timelineScriptPath));
      if (firstBuiltinScript) {
        selectBuiltinTimelineScript(firstBuiltinScript);
      } else {
        createNewTimelineScript();
      }
      showToast({ kind: 'success', title: t.scripts.deleted });
    } catch (deleteError) {
      showToast({
        kind: 'warning',
        title: t.scripts.deleteFailed,
        message: deleteError instanceof Error ? deleteError.message : t.scripts.deleteFailedMessage,
      });
    }
  }

  async function importTimelineScript() {
    try {
      const imported = await importTimelineScriptFromDialog();
      if (!imported) {
        return;
      }
      setTimelineScripts((files) =>
        [imported, ...files.filter((file) => file.path !== imported.path)].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
      selectTimelineScriptFile(imported);
      showToast({ kind: 'success', title: t.scripts.imported, message: imported.name });
    } catch (importError) {
      showToast({
        kind: 'warning',
        title: t.scripts.importFailed,
        message: importError instanceof Error ? importError.message : t.scripts.importFailedMessage,
      });
    }
  }

  async function exportTimelineScript() {
    try {
      const outputPath = await exportTimelineScriptToDialog(timelineScriptName, timelineScriptCode);
      if (outputPath) {
        showToast({ kind: 'success', title: t.scripts.exported, message: outputPath });
      }
    } catch (exportError) {
      showToast({
        kind: 'warning',
        title: t.scripts.exportFailed,
        message: exportError instanceof Error ? exportError.message : t.scripts.exportFailedMessage,
      });
    }
  }

  async function runCurrentTimelineScript() {
    try {
      setTimelineScriptRunning(true);
      setTimelineScriptError(undefined);
      setTimelineScriptOutput([]);
      const result = await runTimelineScriptInWorker({
        script: timelineScriptCode,
        snapshot: createTimelineScriptSnapshot(project),
      });
      const exportRequests = getTimelineScriptExportRequests(result.operations);
      const timelineOperations = result.operations.filter(
        (operation): operation is Exclude<TimelineScriptOperation, { type: 'exportProject' }> =>
          operation.type !== 'exportProject',
      );
      if (timelineOperations.length > 0) {
        commandManager.execute(new RunScriptCommand(timelineAccessor, timelineOperations, t.scripts.runCommand));
      }
      setTimelineScriptOutput([
        ...result.logs,
        t.scripts.operationSummary(timelineOperations.length),
        ...(exportRequests.length > 0 ? [t.scripts.exportSummary(exportRequests.length)] : []),
        t.scripts.elapsed(result.durationMs),
      ]);
    } catch (scriptError) {
      const message = scriptError instanceof Error ? scriptError.message : t.scripts.runFailedMessage;
      setTimelineScriptError(message);
      setTimelineScriptOutput([message]);
      showToast({ kind: 'warning', title: t.scripts.runFailed, message });
    } finally {
      setTimelineScriptRunning(false);
    }
  }

  async function installMarketPreset(card: PresetMarketCard) {
    try {
      setInstallingPresetMarketCardId(card.id);
      const existingPresets = await loadExportPresets();
      let conflictMode: 'rename' | 'overwrite' = 'rename';
      if (presetMarketCardHasCustomConflict(card, existingPresets)) {
        const overwrite = await bridgeConfirm(zhCN.presetMarket.overwriteConfirm(card.name));
        if (!overwrite) {
          return;
        }
        conflictMode = 'overwrite';
      }
      const result = await installPresetMarketCard(card, conflictMode);
      showToast({
        kind: 'success',
        title: zhCN.presetMarket.installed,
        message: zhCN.presetMarket.installedMessage(result.imported, result.overwritten),
      });
    } catch (installError) {
      showToast({
        kind: 'warning',
        title: zhCN.presetMarket.installFailed,
        message: installError instanceof Error ? installError.message : zhCN.presetMarket.installFailedMessage,
      });
    } finally {
      setInstallingPresetMarketCardId(undefined);
    }
  }

  async function installEffectPreset(card: EffectPresetCommunityCard) {
    try {
      setInstallingEffectPresetCardId(card.id);
      const path = await installEffectPresetCommunityCard(card);
      showToast({ kind: 'success', title: zhCN.effectPresetLibrary.installed, message: path });
    } catch (installError) {
      showToast({
        kind: 'warning',
        title: zhCN.effectPresetLibrary.installFailed,
        message: installError instanceof Error ? installError.message : zhCN.effectPresetLibrary.installFailedMessage,
      });
    } finally {
      setInstallingEffectPresetCardId(undefined);
    }
  }

  async function ratePresetMarketCard(cardId: string, rating: number) {
    try {
      setPresetMarketRatings(await writePresetMarketRating(cardId, rating));
    } catch (ratingError) {
      showToast({
        kind: 'warning',
        title: zhCN.presetMarket.ratingFailed,
        message: ratingError instanceof Error ? ratingError.message : zhCN.presetMarket.ratingFailedMessage,
      });
    }
  }

  async function shareCustomExportPresets() {
    try {
      const presets = (await loadExportPresets()).filter((preset) => !preset.builtin);
      if (presets.length === 0) {
        showToast({ kind: 'info', title: zhCN.presetMarket.shareEmpty });
        return;
      }
      await navigator.clipboard.writeText(
        serializeExportPresetPackage(presets, { creator: zhCN.presetMarket.localAuthor }),
      );
      showToast({
        kind: 'success',
        title: zhCN.presetMarket.shared,
        message: zhCN.presetMarket.sharedMessage(presets.length),
      });
    } catch (shareError) {
      showToast({
        kind: 'warning',
        title: zhCN.presetMarket.shareFailed,
        message: shareError instanceof Error ? shareError.message : zhCN.presetMarket.shareFailedMessage,
      });
    }
  }

  async function shareSelectedEffectPreset() {
    try {
      if (!selectedClip) {
        showToast({
          kind: 'info',
          title: zhCN.effectPresetLibrary.noClipSelected,
          message: zhCN.effectPresetLibrary.noClipSelectedMessage,
        });
        return;
      }
      const preset = createEffectPresetFromClip(selectedClip, {
        id: `${selectedClip.id}-effect-preset`,
        name: selectedClip.name || zhCN.effectPresetLibrary.defaultPresetName,
        author: zhCN.effectPresetLibrary.localAuthor,
        tags: [],
      });
      await navigator.clipboard.writeText(serializeEffectPresetFile(preset));
      showToast({
        kind: 'success',
        title: zhCN.effectPresetLibrary.shared,
        message: zhCN.effectPresetLibrary.sharedMessage,
      });
    } catch (shareError) {
      showToast({
        kind: 'warning',
        title: zhCN.effectPresetLibrary.shareFailed,
        message: shareError instanceof Error ? shareError.message : zhCN.effectPresetLibrary.shareFailedMessage,
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
        message: exportBackgroundError instanceof Error ? exportBackgroundError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function loadExportQualityAssuranceSettings() {
    try {
      setExportQualityAssuranceSettings(await readExportQualityAssuranceSettings());
    } catch (qualityError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: qualityError instanceof Error ? qualityError.message : t.general.saveFailedMessage,
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
        message: exportRulesError instanceof Error ? exportRulesError.message : t.general.saveFailedMessage,
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
        message: automationError instanceof Error ? automationError.message : t.automation.saveFailedMessage,
      });
    }
  }

  async function loadCollaborationIdentity() {
    try {
      setCollaborationIdentity(await readCollaborationIdentitySettings());
    } catch (identityError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: identityError instanceof Error ? identityError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function loadLocalCoediting() {
    try {
      setLocalCoediting(await readLocalCoeditingSettings());
    } catch (coeditingError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: coeditingError instanceof Error ? coeditingError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function loadDisplaySettings() {
    try {
      setDisplaySettings(await readDisplaySettings());
    } catch (displayError) {
      showToast({
        kind: 'warning',
        title: t.display.saveFailed,
        message: displayError instanceof Error ? displayError.message : t.display.saveFailedMessage,
      });
    }
  }

  async function loadUpdateSettings() {
    try {
      setUpdateSettings(await readUpdateSettings());
    } catch (updateError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: updateError instanceof Error ? updateError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function loadLocalModelsSettings() {
    try {
      const settings = await readLocalAiModelsSettings();
      setLocalModelsSettings(settings);
      syncLocalModelStores(settings);
      await refreshLocalModelStatuses(settings);
    } catch (modelError) {
      showToast({
        kind: 'warning',
        title: t.localModels.saveFailed,
        message: modelError instanceof Error ? modelError.message : t.localModels.saveFailedMessage,
      });
    }
  }

  async function refreshLocalModelStatuses(settings = localModelsSettings) {
    const entries = await Promise.all(
      LOCAL_AI_MODEL_IDS.map(
        async (id) =>
          [
            id,
            await resolveLocalModelStatus(id, settings[id], {
              exists: fsExists,
              stat: getFileStat,
            }).catch((): LocalAiModelResolvedStatus => ({
              id,
              status: 'invalid',
              path: settings[id]?.path,
              reason: 'size',
            })),
          ] as const,
      ),
    );
    setLocalModelStatuses(Object.fromEntries(entries) as Partial<Record<LocalAiModelId, LocalAiModelResolvedStatus>>);
  }

  async function chooseLocalModelFile(id: LocalAiModelId) {
    const definition = LOCAL_AI_MODEL_DEFINITIONS[id];
    try {
      const [path] = await openFileDialog(false, [
        { name: t.localModels.models[id].name, extensions: definition.extensions },
      ]);
      if (!path) {
        return;
      }
      const stat = await getFileStat(path);
      if (!isLocalModelFileSizeValid(id, stat.size)) {
        showToast({
          kind: 'warning',
          title: t.localModels.invalidFileTitle,
          message: t.localModels.invalidFileSize(formatBytes(definition.minBytes), formatBytes(definition.maxBytes)),
        });
        return;
      }
      const nextSettings: LocalAiModelsSettings = {
        ...localModelsSettings,
        [id]: {
          ...(localModelsSettings[id] ?? {}),
          path,
          version: definition.version,
        },
      };
      const saved = await saveLocalAiModelsSettings(nextSettings);
      setLocalModelsSettings(saved);
      syncLocalModelStores(saved);
      await refreshLocalModelStatuses(saved);
      showToast({ kind: 'success', title: t.localModels.savedTitle, message: t.localModels.models[id].name });
    } catch (modelError) {
      showToast({
        kind: 'warning',
        title: t.localModels.chooseFailed,
        message: modelError instanceof Error ? modelError.message : t.localModels.chooseFailedMessage,
      });
    }
  }

  function syncLocalModelStores(settings: LocalAiModelsSettings) {
    if (settings.whisper?.path) {
      setWhisperModelPath(settings.whisper.path);
    }
    if (settings.demucs?.path && settings.demucs.path !== demucsExecutablePath) {
      setDemucsExecutablePath(settings.demucs.path);
    }
    if (settings.yunet?.path && settings.yunet.path !== privacyDetectionModelPath) {
      setPrivacyDetectionModelPath(settings.yunet.path);
    }
  }

  function openLocalModelDownload(id: LocalAiModelId) {
    void openPath(LOCAL_AI_MODEL_DEFINITIONS[id].downloadUrl);
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
        message: demucsError instanceof Error ? demucsError.message : t.general.demucsChooseFailed,
      });
    }
  }

  async function choosePrivacyDetectionModel() {
    try {
      const [path] = await openFileDialog(false, [
        { name: t.general.privacyDetectionModel, extensions: ['onnx', 'pb', 'xml', 'bin'] },
      ]);
      if (path) {
        setPrivacyDetectionModelPath(path);
      }
    } catch (privacyError) {
      showToast({
        kind: 'warning',
        title: t.general.choosePrivacyDetectionModel,
        message: privacyError instanceof Error ? privacyError.message : t.general.privacyDetectionChooseFailed,
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
        message: exportBackgroundError instanceof Error ? exportBackgroundError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function updateCollaborationIdentity(patch: Partial<CollaborationIdentitySettings>) {
    const optimistic = { ...collaborationIdentity, ...patch };
    setCollaborationIdentity(optimistic);
    try {
      const saved = await saveCollaborationIdentitySettings(optimistic);
      setCollaborationIdentity(saved);
      if (localCoediting.enabled) {
        await applyLocalCoeditingSettings(localCoediting, saved);
      }
    } catch (identityError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: identityError instanceof Error ? identityError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function updateLocalCoediting(patch: Partial<LocalCoeditingSettings>) {
    const optimistic = { ...localCoediting, ...patch };
    setLocalCoediting(optimistic);
    try {
      const saved = await saveLocalCoeditingSettings(optimistic);
      setLocalCoediting(saved);
      await applyLocalCoeditingSettings(saved, collaborationIdentity);
    } catch (coeditingError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: coeditingError instanceof Error ? coeditingError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function updateAppUpdateSettings(patch: Partial<UpdateSettings>) {
    const optimistic = { ...updateSettings, ...patch };
    setUpdateSettings(optimistic);
    try {
      setUpdateSettings(await saveUpdateSettings(optimistic));
    } catch (updateError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: updateError instanceof Error ? updateError.message : t.general.saveFailedMessage,
      });
    }
  }

  async function updateExportQualityAssuranceSettings(patch: Partial<PostExportQualityAssuranceSettings>) {
    const nextSettings = { ...exportQualityAssuranceSettings, ...patch };
    setExportQualityAssuranceSettings(nextSettings);
    try {
      setExportQualityAssuranceSettings(await saveExportQualityAssuranceSettings(nextSettings));
    } catch (qualityError) {
      showToast({
        kind: 'warning',
        title: t.general.saveFailed,
        message: qualityError instanceof Error ? qualityError.message : t.general.saveFailedMessage,
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
        message: exportRulesError instanceof Error ? exportRulesError.message : t.general.saveFailedMessage,
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
        message: exportRulesError instanceof Error ? exportRulesError.message : t.general.saveFailedMessage,
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
        message: backupError instanceof Error ? backupError.message : t.backup.saveFailedMessage,
      });
    }
  }

  async function updateExportPresetSyncSettings(nextSettings: ExportPresetSyncSettings) {
    setExportPresetSyncSettings(nextSettings);
    try {
      setExportPresetSyncSettings(await saveExportPresetSyncSettings(nextSettings));
    } catch (settingsError) {
      showToast({
        kind: 'warning',
        title: t.exportPresetSync.saveFailed,
        message: settingsError instanceof Error ? settingsError.message : t.exportPresetSync.saveFailedMessage,
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
        message: themeError instanceof Error ? themeError.message : t.appearance.saveFailedMessage,
      });
    }
  }

  async function selectTheme(themeId: string) {
    const nextSettings: ThemeSettings = {
      ...themeSettings,
      activeThemeId: themeId,
    };
    hydrateThemeForm(nextSettings);
    await updateThemeSettings(nextSettings);
  }

  async function saveCustomTheme() {
    const activeCustomTheme = themeSettings.customThemes.find((theme) => theme.id === themeSettings.activeThemeId);
    const result = upsertCustomTheme(themeSettings, {
      id: activeCustomTheme?.id,
      name: customThemeName,
      colors: customThemeColors,
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
      [key]: value,
    }));
  }

  async function chooseBackupDirectory() {
    try {
      const directory = await openDirectoryDialog();
      if (directory) {
        await updateBackupSettings({
          ...backupSettings,
          local: { ...backupSettings.local, directory },
        });
      }
    } catch (backupError) {
      showToast({
        kind: 'warning',
        title: t.backup.saveFailed,
        message: backupError instanceof Error ? backupError.message : t.backup.saveFailedMessage,
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
        message: passwordError instanceof Error ? passwordError.message : t.backup.passwordSaveFailedMessage,
      });
    }
  }

  async function updateExportPresetSyncPassword(password: string) {
    setExportPresetSyncPassword(password);
    try {
      await writeExportPresetSyncWebdavPassword(password);
    } catch (passwordError) {
      showToast({
        kind: 'warning',
        title: t.exportPresetSync.passwordSaveFailed,
        message: passwordError instanceof Error ? passwordError.message : t.exportPresetSync.passwordSaveFailedMessage,
      });
    }
  }

  function updateProjectFrameRate(value: string) {
    const fps = normalizeProjectFps(Number(value));
    commandManager.execute(
      new UpdateProjectSettingsCommand(projectAccessor, {
        fps,
        timecodeFormat: normalizeTimecodeFormat(project.settings.timecodeFormat, fps),
      }),
    );
  }

  function updateProjectTimecodeFormat(value: string) {
    const timecodeFormat: TimecodeFormat = value === 'df' ? 'df' : 'ndf';
    commandManager.execute(new UpdateProjectSettingsCommand(projectAccessor, { timecodeFormat }));
  }

  function updateProjectVfrHandling(value: string) {
    commandManager.execute(
      new UpdateProjectSettingsCommand(projectAccessor, { vfrHandling: normalizeVfrHandlingStrategy(value) }),
    );
  }

  function updateProjectColorPipeline(value: string) {
    const colorPipeline = normalizeProjectColorPipeline(value);
    if (colorPipeline !== normalizeProjectColorPipeline(project.settings.colorPipeline)) {
      showToast({ kind: 'warning', title: t.general.colorPipelineChanged, message: t.general.colorPipelineWarning });
    }
    commandManager.execute(new UpdateProjectSettingsCommand(projectAccessor, { colorPipeline }));
  }

  function updateProjectWorkingColorSpace(value: string) {
    commandManager.execute(
      new UpdateProjectSettingsCommand(projectAccessor, {
        workingColorSpace: normalizeProjectWorkingColorSpace(value),
      }),
    );
  }

  async function updateDisplaySettings(patch: Partial<DisplaySettings>) {
    const nextSettings = { ...displaySettings, ...patch };
    setDisplaySettings(nextSettings);
    try {
      setDisplaySettings(await saveDisplaySettings(nextSettings));
    } catch (displayError) {
      showToast({
        kind: 'warning',
        title: t.display.saveFailed,
        message: displayError instanceof Error ? displayError.message : t.display.saveFailedMessage,
      });
    }
  }

  async function updateTouchOptimizationSettings(patch: Partial<TouchOptimizationSettings>) {
    const nextSettings = { ...touchOptimizationSettings, ...patch };
    setTouchOptimizationSettings(nextSettings);
    try {
      setTouchOptimizationSettings(await saveTouchOptimizationSettings(nextSettings));
    } catch (touchError) {
      showToast({
        kind: 'warning',
        title: '触屏设置保存失败',
        message: touchError instanceof Error ? touchError.message : '无法写入触屏优化设置。',
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="settings-dialog">
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <div className="text-xs text-slate-500">{t.subtitle}</div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel"
            type="button"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="settings-close-button"
            onClick={close}
          >
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
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'display' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-display"
              onClick={() => setTab('display')}
            >
              {t.tabs.display}
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
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'effect-presets' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-effect-presets"
              onClick={() => setTab('effect-presets')}
            >
              {t.tabs.effectPresets}
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
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'scripts' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-scripts"
              onClick={() => setTab('scripts')}
            >
              {t.tabs.scripts}
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
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'local-models' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-local-models"
              onClick={() => setTab('local-models')}
            >
              {t.tabs.localModels}
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
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'task-monitor' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-task-monitor"
              onClick={() => setTab('task-monitor')}
            >
              {t.tabs.taskMonitor}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'export-presets' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-export-presets"
              onClick={() => setTab('export-presets')}
            >
              {t.tabs.exportPresets}
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
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'ai-services' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-ai-services"
              onClick={() => setTab('ai-services')}
            >
              {t.tabs.aiServices}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'hardware-acceleration' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-hardware-acceleration"
              onClick={() => setTab('hardware-acceleration')}
            >
              {t.tabs.hardwareAcceleration}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'gesture' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-gesture"
              onClick={() => setTab('gesture')}
            >
              手势控制
            </button>
          </nav>
          <main className="min-w-0 flex-1 overflow-y-auto p-4">
            {tab === 'general' ? (
              <GeneralSettingsPanel
                language={language}
                updateLanguage={updateLanguage}
                updateSettings={updateSettings}
                updateAppUpdateSettings={updateAppUpdateSettings}
                previewPerformance={previewPerformance}
                onPreviewPerformanceChange={onPreviewPerformanceChange}
                onPreviewSkipFramesChange={onPreviewSkipFramesChange}
                timelineInteractionSettings={timelineInteractionSettings}
                onTimelineInteractionSettingsChange={onTimelineInteractionSettingsChange}
                collaborationIdentity={collaborationIdentity}
                updateCollaborationIdentity={updateCollaborationIdentity}
                localCoediting={localCoediting}
                updateLocalCoediting={updateLocalCoediting}
                demucsExecutablePath={demucsExecutablePath}
                setDemucsExecutablePath={setDemucsExecutablePath}
                chooseDemucsExecutable={chooseDemucsExecutable}
                privacyDetectionModelPath={privacyDetectionModelPath}
                setPrivacyDetectionModelPath={setPrivacyDetectionModelPath}
                choosePrivacyDetectionModel={choosePrivacyDetectionModel}
                recordingSettings={recordingSettings}
                setRecordingSettings={setRecordingSettings}
                project={project}
                updateProjectFrameRate={updateProjectFrameRate}
                updateProjectTimecodeFormat={updateProjectTimecodeFormat}
                updateProjectVfrHandling={updateProjectVfrHandling}
                updateProjectColorPipeline={updateProjectColorPipeline}
                updateProjectWorkingColorSpace={updateProjectWorkingColorSpace}
                exportBackgroundSettings={exportBackgroundSettings}
                updateExportBackgroundSettings={updateExportBackgroundSettings}
                exportQualityAssuranceSettings={exportQualityAssuranceSettings}
                updateExportQualityAssuranceSettings={updateExportQualityAssuranceSettings}
                touchOptimizationSettings={touchOptimizationSettings}
                updateTouchOptimizationSettings={updateTouchOptimizationSettings}
                exportRules={exportRules}
                updateExportRule={updateExportRule}
                chooseExportRuleCopyDirectory={chooseExportRuleCopyDirectory}
                developerMode={developerMode}
                setDeveloperMode={setDeveloperMode}
                stressTestResult={stressTestResult}
                setStressTestResult={setStressTestResult}
              />
            ) : null}
            {tab === 'display' ? (
              <div className="space-y-4" data-testid="settings-display-panel">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{t.display.title}</h3>
                  <p className="text-xs text-slate-500">{t.display.description}</p>
                </div>
                <label className="block text-xs font-medium text-slate-600">
                  {t.display.colorGamut}
                  <select
                    className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                    value={displaySettings.colorGamut}
                    data-testid="display-color-gamut-select"
                    onChange={(event) =>
                      void updateDisplaySettings({ colorGamut: event.target.value as DisplaySettings['colorGamut'] })
                    }
                  >
                    <option value="srgb">{t.display.colorGamutOptions.srgb}</option>
                    <option value="p3">{t.display.colorGamutOptions.p3}</option>
                    <option value="rec2020">{t.display.colorGamutOptions.rec2020}</option>
                  </select>
                </label>
                <div
                  className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600"
                  data-testid="display-color-gamut-css-hint"
                >
                  <span className="display-gamut-indicator display-gamut-indicator-srgb">
                    {t.display.cssGamut.srgb}
                  </span>
                  <span className="display-gamut-indicator display-gamut-indicator-p3">{t.display.cssGamut.p3}</span>
                  <span className="display-gamut-indicator display-gamut-indicator-rec2020">
                    {t.display.cssGamut.rec2020}
                  </span>
                </div>
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
              <LutLibraryPanel
                selectedClip={selectedClip}
                project={project}
              />
            ) : null}
            {tab === 'effect-presets' ? (
              <EffectPresetCommunityPanel
                cards={filteredEffectPresetCards}
                filters={effectPresetFilters}
                loading={effectPresetLoading}
                source={effectPresetSource}
                warning={effectPresetWarning}
                installingCardId={installingEffectPresetCardId}
                canShare={Boolean(selectedClip)}
                onFiltersChange={setEffectPresetFilters}
                onRefresh={() => void loadEffectPresetLibraryPanel()}
                onInstall={(card) => void installEffectPreset(card)}
                onShare={() => void shareSelectedEffectPreset()}
              />
            ) : null}
            {tab === 'shortcuts' || tab === 'macros' ? (
              <ShortcutMacrosPanel
                tab={tab as 'shortcuts' | 'macros'}
                shortcutBindings={shortcutBindings}
                onShortcutBindingsChange={onShortcutBindingsChange}
                macros={macros}
                onMacrosChange={onMacrosChange}
                onExecuteMacro={onExecuteMacro}
              />
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
            {tab === 'scripts' ? (
              <TimelineScriptsSettingsPanel
                builtins={BUILTIN_TIMELINE_SCRIPTS}
                files={timelineScripts}
                selectedId={selectedTimelineScriptId}
                name={timelineScriptName}
                code={timelineScriptCode}
                path={timelineScriptPath}
                apiNames={timelineScriptApiNames}
                running={timelineScriptRunning}
                output={timelineScriptOutput}
                error={timelineScriptError}
                onSelectBuiltin={selectBuiltinTimelineScript}
                onSelectFile={selectTimelineScriptFile}
                onNameChange={setTimelineScriptName}
                onCodeChange={setTimelineScriptCode}
                onNew={createNewTimelineScript}
                onSave={() => void saveCurrentTimelineScript()}
                onDelete={() => void deleteCurrentTimelineScript()}
                onImport={() => void importTimelineScript()}
                onExport={() => void exportTimelineScript()}
                onRun={() => void runCurrentTimelineScript()}
              />
            ) : null}
            {tab === 'translation' ? (
              <TranslationSettingsPanel
                provider={translationProvider}
                apiKey={translationApiKey}
                apiKeyError={translationApiKeyError}
                targetLanguage={translationTargetLanguage}
                onProviderChange={setTranslationProvider}
                onApiKeyChange={setTranslationApiKey}
                onTargetLanguageChange={setTranslationTargetLanguage}
              />
            ) : null}
            {tab === 'local-models' ? (
              <LocalModelsSettingsPanel
                settings={localModelsSettings}
                statuses={localModelStatuses}
                onChoose={(id) => void chooseLocalModelFile(id)}
                onDownload={openLocalModelDownload}
              />
            ) : null}
            {tab === 'proxy' ? (
              <ProxySettingsPanel
                project={project}
                resolutionPreset={proxyResolutionPreset}
                triggerShortEdge={proxyTriggerShortEdge}
                onResolutionPresetChange={setProxyResolutionPreset}
                onTriggerShortEdgeChange={setProxyTriggerShortEdge}
                onDeleteProxies={onDeleteProxies}
                onRegenerateProxies={onRegenerateProxies}
                onMigrateProxies={onMigrateProxies}
                onReset={resetProxySettings}
              />
            ) : null}
            {tab === 'task-monitor' ? <TaskMonitorSettingsPanel /> : null}
            {tab === 'export-presets' ? (
              <div className="space-y-4">
                <PresetMarketPanel
                  cards={filteredPresetMarketCards}
                  ratings={presetMarketRatings}
                  filters={presetMarketFilters}
                  loading={presetMarketLoading}
                  source={presetMarketSource}
                  warning={presetMarketWarning}
                  installingCardId={installingPresetMarketCardId}
                  onFiltersChange={setPresetMarketFilters}
                  onRefresh={() => void loadPresetMarketPanel()}
                  onInstall={(card) => void installMarketPreset(card)}
                  onRate={(cardId, rating) => void ratePresetMarketCard(cardId, rating)}
                  onShare={() => void shareCustomExportPresets()}
                />
                <ExportPresetSyncSettingsPanel
                  settings={exportPresetSyncSettings}
                  password={exportPresetSyncPassword}
                  onSettingsChange={(settings) => void updateExportPresetSyncSettings(settings)}
                  onPasswordChange={(password) => void updateExportPresetSyncPassword(password)}
                />
              </div>
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
                catalog={pluginCatalog}
                catalogLoading={pluginCatalogLoading}
                catalogError={pluginCatalogError}
                installingPluginId={installingPluginId}
                onRefresh={() => void refreshPlugins()}
                onRefreshCatalog={() => void refreshPluginCatalog()}
                onInstallCatalogPlugin={(entry) => void installMarketPlugin(entry)}
                onInstallFromFile={() => void installPluginFile()}
                onTogglePlugin={(entry) => void togglePlugin(entry)}
                onUninstallPlugin={(entry) => void removePlugin(entry)}
              />
            ) : null}
            {tab === 'ai-services' ? <AIServicesSettingsPanel /> : null}
            {tab === 'hardware-acceleration' ? <HardwareAccelerationSettingsPanel /> : null}
            {tab === 'gesture' ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-ink">手势控制</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  使用摄像头进行手势控制，支持播放/暂停、前进/后退等操作。
                </p>
                <GesturePracticePanel />
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
