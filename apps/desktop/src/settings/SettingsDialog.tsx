import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Cloud,
  Download,
  FilePlus,
  FolderOpen,
  GripVertical,
  Play,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildProxyInventory,
  buildProxyStorageTrend,
  calculateProxyCoverageStats,
  planProxyCleanup,
  summarizeProxyInventory,
  DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS,
  EXPORT_COLOR_SPACES,
  PROJECT_COLOR_PIPELINES,
  SUPPORTED_PROJECT_FPS,
  BUILTIN_TIMELINE_SCRIPTS,
  RunScriptCommand,
  UpdateClipCommand,
  UpdateProjectSettingsCommand,
  createTimelineScriptSnapshot,
  createEffectPresetFromClip,
  serializeEffectPresetFile,
  getTimelineScriptApiFunctionNames,
  getTimelineScriptExportRequests,
  getColorSpaceDisplayName,
  normalizeProjectColorPipeline,
  normalizeProjectFps,
  normalizeProjectWorkingColorSpace,
  normalizeTimecodeFormat,
  normalizeVfrHandlingStrategy,
  supportsDropFrameTimecode,
  generateStressScenario,
  measurePerfMetrics,
  buildStressReport,
  serializeStressReport,
  type Clip,
  type BuiltinTimelineScript,
  type EffectPresetFilters,
  type Project,
  type ProjectColorPipeline,
  type PostExportQualityAssuranceSettings,
  type ProxyInventoryItem,
  type TimecodeFormat,
  type Timeline,
  type TimelineScriptOperation,
  type VfrHandlingStrategy,
} from '@open-factory/editor-core';
import type { StressScenarioId } from '@open-factory/editor-core';
import { formatBackupDisplayTime } from '../backup/projectBackup';
import { getLanguage, normalizeLanguage, setLanguage as setI18nLanguage, zhCN, type Language } from '../i18n/strings';
import { switchLanguage } from '../i18n/i18next-config';
import { parseAutomationRulesJson, serializeAutomationRulesJson } from '../automation/automation-rules';
import { pickDemucsExecutablePath } from '../lib/demucs';
import { loadLutLibrary, toggleLutFavorite, type LutLibraryItem } from '../lib/lutLibrary';
import {
  bridgeConfirm,
  fsExists,
  getFileStat,
  getSystemResourceSnapshot,
  openDirectoryDialog,
  openFileDialog,
  openPath,
  readExportPresetSyncWebdavPassword,
  readWebdavPassword,
  writeExportPresetSyncWebdavPassword,
  writeWebdavPassword,
  type SystemResourceSnapshot,
} from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import {
  PREVIEW_QUALITY_MODES,
  PREVIEW_SKIP_FRAME_OPTIONS,
  type PreviewPerformanceSettings,
  type PreviewQualityMode,
  type PreviewSkipFrames,
} from '../lib/preview/preview-performance';
import {
  detectMacroShortcutConflicts,
  exportClipMacrosToDialog,
  getMacroSteps,
  importClipMacrosFromDialog,
  parseCommandSnapshotsJson,
  serializeCommandSnapshots,
  writeClipMacros,
  type ClipMacro,
  type CommandSnapshot,
  type MacroShortcutConflict,
} from '../macros/clip-macros';
import {
  getPluginRegistrySnapshot,
  refreshPluginRegistry,
  setPluginEnabled,
  uninstallPlugin,
  type LoadedPlugin,
  type PluginRegistry,
} from '../plugins/plugin-manager';
import {
  getCatalogEntryInstallState,
  installCatalogPlugin,
  installPluginFromFile,
  loadPluginCatalog,
  type PluginCatalogEntry,
  type PluginCatalogResult,
} from '../plugins/plugin-market';
import { loadExportPresets, serializeExportPresetPackage } from '../export/export-presets';
import {
  filterPresetMarketCards,
  installPresetMarketCard,
  loadPresetMarket,
  presetMarketCardHasCustomConflict,
  readPresetMarketRatings,
  writePresetMarketRating,
  type PresetMarketCard,
  type PresetMarketFilters,
  type PresetMarketLoadResult,
} from '../export/preset-market';
import {
  filterEffectPresetCommunityCards,
  installEffectPresetCommunityCard,
  loadEffectPresetCommunityLibrary,
  type EffectPresetCommunityCard,
  type EffectPresetCommunityLoadResult,
} from '../effects/effect-preset-library';
import { getLoadedPluginStatus, type PluginPermission } from '../plugins/plugin-loader';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import { calculateMediaJobEtaSeconds, sortMediaJobsForMonitor } from '../media/media-job-monitor';
import { useMediaJobStore, type MediaJob, type MediaJobStatus, type MediaJobType } from '../media/media-job-store';
import { writeCustomKeybindings } from '../shortcuts/keybindings';
import {
  TIMELINE_SHORTCUT_DEFINITIONS,
  detectTimelineShortcutConflicts,
  eventToAccelerator,
  getEffectiveTimelineShortcutBindings,
  type TimelineShortcutAction,
  type TimelineShortcutBindings,
} from '../shortcuts/timeline-shortcuts';
import { commandManager, projectAccessor, timelineAccessor } from '../store/commandManager';
import { useDemucsSettingsStore } from '../store/demucsSettingsStore';
import { useEditorStore } from '../store/editorStore';
import { usePrivacyDetectionSettingsStore } from '../store/privacyDetectionSettingsStore';
import {
  PROXY_RESOLUTION_PRESETS,
  PROXY_TRIGGER_THRESHOLDS,
  useProxySettingsStore,
  type ProxyResolutionPreset,
  type ProxyTriggerThreshold,
} from '../store/proxySettingsStore';
import { useRecordingSettingsStore } from '../store/recordingSettingsStore';
import { useTranslationSettingsStore, type TranslationProvider } from '../store/translationSettingsStore';
import { AIServicesSettingsPanel } from './AIServicesSettingsPanel';
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel';
import { AutomationSettingsPanel } from './AutomationSettingsPanel';
import { BackupSettingsPanel } from './BackupSettingsPanel';
import { EffectPresetCommunityPanel } from './EffectPresetPanel';
import { ExportPresetSyncSettingsPanel } from './ExportPresetSyncPanel';
import { ExportQualityAssuranceSettingsPanel } from './ExportQualityAssurancePanel';
import { ExportRulesSettingsPanel, getExportRule, upsertExportRule } from './ExportRulesPanel';
import { formatBytes, formatDateTime } from './formatHelpers';
import { HardwareAccelerationSettingsPanel } from './HardwareAccelerationSettingsPanel';
import { LocalModelsSettingsPanel } from './LocalModelsPanel';
import { MacroStepsEditor } from './MacroStepsEditor';
import { PluginsSettingsPanel } from './PluginsSettingsPanel';
import { PresetMarketPanel } from './PresetMarketPanel';
import { ProxySettingsPanel } from './ProxySettingsPanel';
import { TaskMonitorSettingsPanel } from './TaskMonitorSettingsPanel';
import { TimelineScriptsSettingsPanel } from './TimelineScriptsSettingsPanel';
import { TranslationSettingsPanel } from './TranslationSettingsPanel';
import { useWhisperSettingsStore } from '../store/whisperSettingsStore';
import { applyLocalCoeditingSettings } from '../collaboration/settings';
import { runTimelineScriptInWorker } from '../scripting/timeline-script-runtime';
import {
  deleteTimelineScript,
  exportTimelineScriptToDialog,
  importTimelineScriptFromDialog,
  loadTimelineScripts,
  saveTimelineScript,
  type TimelineScriptFile,
} from '../scripting/timeline-scripts';
import {
  DEFAULT_BACKUP_SETTINGS,
  DEFAULT_COLLABORATION_IDENTITY_SETTINGS,
  DEFAULT_EXPORT_PRESET_SYNC_SETTINGS,
  DEFAULT_LOCAL_COEDITING_SETTINGS,
  readAutomationRules,
  readBackupSettings,
  readCollaborationIdentitySettings,
  readDisplaySettings,
  readExportBackgroundSettings,
  readExportQualityAssuranceSettings,
  readExportPresetSyncSettings,
  readExportRules,
  readLocalCoeditingSettings,
  readLocalAiModelsSettings,
  saveAutomationRules,
  saveBackupSettings,
  saveCollaborationIdentitySettings,
  saveDisplaySettings,
  saveExportBackgroundSettings,
  saveExportQualityAssuranceSettings,
  saveExportPresetSyncSettings,
  saveExportRules,
  saveLanguageSetting,
  saveLocalCoeditingSettings,
  saveLocalAiModelsSettings,
  readUpdateSettings,
  saveUpdateSettings,
  type AutomationRule,
  type BackupSettings,
  type CollaborationIdentitySettings,
  type DisplaySettings,
  type ExportBackgroundSettings,
  type ExportPresetSyncSettings,
  type ExportConditionRule,
  type LocalCoeditingSettings,
  type TimelineInteractionSettings,
  readTouchOptimizationSettings,
  saveTouchOptimizationSettings,
} from './appSettings';
import type { TouchOptimizationSettings } from '@open-factory/editor-core';
import {
  LOCAL_AI_MODEL_DEFINITIONS,
  LOCAL_AI_MODEL_IDS,
  isLocalModelFileSizeValid,
  resolveLocalModelStatus,
  type LocalAiModelId,
  type LocalAiModelResolvedStatus,
  type LocalAiModelsSettings,
} from './localModels';
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
  type ThemeSettings,
} from '../theme/theme';
import { getCurrentThemeSettings, setThemeSettings, useTheme } from '../theme/useTheme';
import { DEFAULT_UPDATE_SETTINGS, getEffectiveUpdaterEndpoint, type UpdateSettings } from '../updater/update-settings';

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
  | 'hardware-acceleration';
const VFR_HANDLING_OPTIONS: VfrHandlingStrategy[] = ['ignore', 'auto-cfr', 'ask'];
const EXPORT_RULE_COPY_SUCCESS_ID = 'copy-success';
const EXPORT_RULE_FAILURE_NOTIFICATION_ID = 'failure-notification';
const EXPORT_RULE_QUEUE_TONE_ID = 'queue-tone';

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
  const [items, setItems] = useState<LutLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [capturingAction, setCapturingAction] = useState<TimelineShortcutAction>();
  const [capturingMacroId, setCapturingMacroId] = useState<string>();
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
  const selectedClipCanUseLut = selectedClip?.type === 'video' || selectedClip?.type === 'image';
  const effectiveBindings = useMemo(() => getEffectiveTimelineShortcutBindings(shortcutBindings), [shortcutBindings]);
  const conflicts = useMemo(() => detectTimelineShortcutConflicts(shortcutBindings), [shortcutBindings]);
  const macroConflicts = useMemo(
    () => detectMacroShortcutConflicts(macros, shortcutBindings),
    [macros, shortcutBindings],
  );
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
    void refresh();
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
      .catch((error) => console.warn('Unable to load touch optimization settings', error));
    void loadTranslationApiKey();
    hydrateThemeForm(getCurrentThemeSettings());
    showCurrentPlugins();
    void refreshPluginCatalog();
    return () => setPreviewTimeline(undefined);
  }, [loadTranslationApiKey, open, setPreviewTimeline]);

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
        shiftKey: event.shiftKey,
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
        shiftKey: event.shiftKey,
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
      commandManager.execute(
        new UpdateClipCommand(timelineAccessor, selectedClip.id, { colorCorrection: { lutPath: item.path } }),
      );
      setPreviewTimeline(undefined);
      showToast({ kind: 'success', title: t.lutLibrary.applied, message: item.name });
    } catch (applyError) {
      showToast({
        kind: 'warning',
        title: t.lutLibrary.applyFailed,
        message: applyError instanceof Error ? applyError.message : t.lutLibrary.applyFailedMessage,
      });
    }
  }

  async function toggleFavorite(item: LutLibraryItem) {
    try {
      const favorites = new Set(await toggleLutFavorite(item.path));
      setItems((current) => current.map((entry) => ({ ...entry, favorite: favorites.has(entry.path) })));
    } catch (favoriteError) {
      showToast({
        kind: 'warning',
        title: t.lutLibrary.favoriteFailed,
        message: favoriteError instanceof Error ? favoriteError.message : t.lutLibrary.favoriteFailedMessage,
      });
    }
  }

  async function updateShortcutBinding(nextBindings: TimelineShortcutBindings) {
    try {
      const saved = await writeCustomKeybindings(nextBindings);
      onShortcutBindingsChange(saved);
    } catch (shortcutError) {
      showToast({
        kind: 'warning',
        title: t.shortcuts.saveFailed,
        message: shortcutError instanceof Error ? shortcutError.message : t.shortcuts.saveFailedMessage,
      });
    }
  }

  async function updateMacros(nextMacros: ClipMacro[]) {
    try {
      const saved = await writeClipMacros(nextMacros);
      onMacrosChange(saved);
    } catch (macroError) {
      showToast({
        kind: 'warning',
        title: t.macros.saveFailed,
        message: macroError instanceof Error ? macroError.message : t.macros.saveFailedMessage,
      });
    }
  }

  async function updateMacroShortcut(macroId: string, accelerator: string) {
    await updateMacros(macros.map((macro) => (macro.id === macroId ? { ...macro, shortcut: accelerator } : macro)));
  }

  function resetMacroShortcut(macroId: string) {
    void updateMacros(macros.map((macro) => (macro.id === macroId ? { ...macro, shortcut: undefined } : macro)));
  }

  async function updateMacroSteps(macroId: string, steps: CommandSnapshot[]) {
    if (steps.length === 0) {
      showToast({ kind: 'warning', title: t.macros.saveFailed, message: t.macros.invalidSteps });
      return;
    }
    await updateMacros(macros.map((macro) => (macro.id === macroId ? { ...macro, patch: undefined, steps } : macro)));
  }

  async function updateMacroStepsFromJson(macroId: string, raw: string) {
    const steps = parseCommandSnapshotsJson(raw);
    if (steps.length === 0) {
      showToast({ kind: 'warning', title: t.macros.saveFailed, message: t.macros.invalidSteps });
      return;
    }
    await updateMacroSteps(macroId, steps);
  }

  async function importMacros() {
    try {
      const imported = await importClipMacrosFromDialog();
      if (imported) {
        onMacrosChange(imported);
        showToast({ kind: 'success', title: t.macros.imported, message: t.macros.importedMessage(imported.length) });
      }
    } catch (macroError) {
      showToast({
        kind: 'warning',
        title: t.macros.importFailed,
        message: macroError instanceof Error ? macroError.message : t.macros.importFailedMessage,
      });
    }
  }

  async function exportMacros() {
    try {
      const path = await exportClipMacrosToDialog(macros);
      if (path) {
        showToast({ kind: 'success', title: t.macros.exported, message: path });
      }
    } catch (macroError) {
      showToast({
        kind: 'warning',
        title: t.macros.exportFailed,
        message: macroError instanceof Error ? macroError.message : t.macros.exportFailedMessage,
      });
    }
  }

  function formatMacroConflict(conflict: MacroShortcutConflict): string {
    if (conflict.type === 'timeline' && conflict.timelineAction) {
      return (t.shortcuts.actions as Record<string, string>)[conflict.timelineAction] ?? conflict.timelineAction;
    }
    return conflict.macroName ?? conflict.macroId ?? t.macros.unknownMacro;
  }

  async function updateLanguage(value: string) {
    const nextLanguage = normalizeLanguage(value);
    setLanguage(nextLanguage);
    // 同步到 i18next 和现有 i18n 系统
    switchLanguage(nextLanguage);
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
                <div className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
                  {t.general.languageDescription}
                </div>
                <div className="rounded-md border border-line bg-panel p-3" data-testid="settings-update-section">
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold text-slate-700">{t.general.updatesTitle}</h4>
                    <p className="mt-1 text-xs text-slate-500">{t.general.updatesDescription}</p>
                  </div>
                  <label className="mb-3 flex items-start gap-2 text-xs text-slate-600">
                    <input
                      className="mt-0.5 h-4 w-4 accent-brand"
                      type="checkbox"
                      checked={updateSettings.autoCheckEnabled}
                      data-testid="settings-update-auto-check"
                      onChange={(event) => void updateAppUpdateSettings({ autoCheckEnabled: event.target.checked })}
                    />
                    <span>
                      <span className="block font-semibold text-slate-700">{t.general.autoUpdateCheck}</span>
                      <span className="mt-1 block">{t.general.autoUpdateCheckDescription}</span>
                    </span>
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    {t.general.updateEndpoint}
                    <input
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                      value={updateSettings.customEndpoint ?? ''}
                      placeholder={getEffectiveUpdaterEndpoint(DEFAULT_UPDATE_SETTINGS)}
                      data-testid="settings-update-endpoint-input"
                      onChange={(event) => void updateAppUpdateSettings({ customEndpoint: event.target.value })}
                    />
                  </label>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {updateSettings.customEndpoint
                      ? t.general.updateEndpointDescription
                      : t.general.defaultUpdateEndpoint}
                  </p>
                </div>
                <div className="rounded-md border border-line bg-panel p-3">
                  <div className="mb-2">
                    <h4 className="text-xs font-semibold text-slate-700">{t.general.previewPerformanceTitle}</h4>
                    <p className="mt-1 text-xs text-slate-500">{t.general.previewPerformanceDescription}</p>
                  </div>
                  <label className="mb-3 flex items-start gap-2 text-xs text-slate-600">
                    <input
                      className="mt-0.5 h-4 w-4 accent-brand"
                      type="checkbox"
                      checked={previewPerformance.adaptiveEnabled !== false}
                      data-testid="settings-preview-adaptive-toggle"
                      onChange={(event) => onPreviewPerformanceChange({ adaptiveEnabled: event.target.checked })}
                    />
                    <span>
                      <span className="block font-semibold text-slate-700">{t.general.previewAdaptiveQuality}</span>
                      <span className="mt-1 block">{t.general.previewAdaptiveQualityDescription}</span>
                    </span>
                  </label>
                  <label className="mb-3 block text-xs font-medium text-slate-600">
                    {t.general.previewFixedQuality}
                    <select
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
                      value={previewPerformance.qualityMode}
                      disabled={previewPerformance.adaptiveEnabled !== false}
                      data-testid="settings-preview-fixed-quality-select"
                      onChange={(event) =>
                        onPreviewPerformanceChange({
                          qualityMode: event.target.value as PreviewQualityMode,
                          adaptiveEnabled: false,
                        })
                      }
                    >
                      {PREVIEW_QUALITY_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {zhCN.toolbar.previewQualityOptions[mode]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    {t.general.previewSkipFrames}
                    <select
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
                      value={previewPerformance.skipFrames}
                      disabled={previewPerformance.adaptiveEnabled !== false}
                      data-testid="settings-preview-skip-frames-select"
                      onChange={(event) => onPreviewSkipFramesChange(Number(event.target.value) as PreviewSkipFrames)}
                    >
                      {PREVIEW_SKIP_FRAME_OPTIONS.map((frames) => (
                        <option key={frames} value={frames}>
                          {t.general.previewSkipFrameOptions[frames]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
                  <input
                    className="mt-0.5 h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={timelineInteractionSettings.reduceMotion}
                    data-testid="settings-reduce-motion-toggle"
                    onChange={(event) => onTimelineInteractionSettingsChange({ reduceMotion: event.target.checked })}
                  />
                  <span>
                    <span className="block font-semibold text-slate-700">{t.general.reduceMotion}</span>
                    <span className="mt-1 block">{t.general.reduceMotionDescription}</span>
                  </span>
                </label>
                <div className="rounded-md border border-line bg-panel p-3">
                  <div className="mb-2">
                    <h4 className="text-xs font-semibold text-slate-700">{t.general.collaborationIdentityTitle}</h4>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                    <label className="block text-xs font-medium text-slate-600">
                      {t.general.collaborationName}
                      <input
                        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                        value={collaborationIdentity.name}
                        data-testid="settings-collaboration-name-input"
                        onChange={(event) => void updateCollaborationIdentity({ name: event.target.value })}
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-600">
                      {t.general.collaborationColor}
                      <input
                        className="mt-1 h-9 w-full rounded-md border border-line bg-white px-1"
                        type="color"
                        value={collaborationIdentity.color}
                        data-testid="settings-collaboration-color-input"
                        onChange={(event) => void updateCollaborationIdentity({ color: event.target.value })}
                      />
                    </label>
                  </div>
                </div>
                <div
                  className="rounded-md border border-line bg-panel p-3"
                  data-testid="settings-local-coediting-section"
                >
                  <label className="flex items-start gap-2 text-xs text-slate-600">
                    <input
                      className="mt-0.5 h-4 w-4 accent-brand"
                      type="checkbox"
                      checked={localCoediting.enabled}
                      data-testid="settings-local-coediting-enabled"
                      onChange={(event) => void updateLocalCoediting({ enabled: event.target.checked })}
                    />
                    <span>
                      <span className="block font-semibold text-slate-700">{t.general.localCoeditingTitle}</span>
                      <span className="mt-1 block">{t.general.localCoeditingDescription}</span>
                    </span>
                  </label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-slate-600">
                      {t.general.localCoeditingMode}
                      <select
                        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                        value={localCoediting.mode}
                        data-testid="settings-local-coediting-mode"
                        onChange={(event) =>
                          void updateLocalCoediting({ mode: event.target.value === 'client' ? 'client' : 'host' })
                        }
                      >
                        <option value="host">{t.general.localCoeditingHost}</option>
                        <option value="client">{t.general.localCoeditingClient}</option>
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-slate-600">
                      {t.general.localCoeditingPermission}
                      <select
                        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                        value={localCoediting.permission}
                        data-testid="settings-local-coediting-permission"
                        onChange={(event) =>
                          void updateLocalCoediting({
                            permission: event.target.value === 'read-only' ? 'read-only' : 'edit',
                          })
                        }
                      >
                        <option value="edit">{t.general.localCoeditingEdit}</option>
                        <option value="read-only">{t.general.localCoeditingReadOnly}</option>
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-slate-600">
                      {t.general.localCoeditingPort}
                      <input
                        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                        type="number"
                        min={1}
                        max={65535}
                        value={localCoediting.port}
                        data-testid="settings-local-coediting-port"
                        onChange={(event) => void updateLocalCoediting({ port: Number(event.target.value) })}
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-600">
                      {t.general.localCoeditingHostUrl}
                      <input
                        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                        value={localCoediting.hostUrl ?? ''}
                        placeholder="ws://192.168.1.10:37822"
                        data-testid="settings-local-coediting-host-url"
                        onChange={(event) => void updateLocalCoediting({ hostUrl: event.target.value })}
                      />
                    </label>
                    {localCoediting.mode === 'host' && (
                      <>
                        <label className="block text-xs font-medium text-slate-600">
                          {t.general.localCoeditingNetworkMode}
                          <select
                            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                            value={localCoediting.networkMode ?? 'localhost'}
                            data-testid="settings-local-coediting-network-mode"
                            onChange={(event) =>
                              void updateLocalCoediting({
                                networkMode: event.target.value === 'lan' ? 'lan' : 'localhost',
                              })
                            }
                          >
                            <option value="localhost">{t.general.localCoeditingNetworkLocalhost}</option>
                            <option value="lan">{t.general.localCoeditingNetworkLan}</option>
                          </select>
                        </label>
                        <label className="block text-xs font-medium text-slate-600">
                          {t.general.localCoeditingAuthToken}
                          <input
                            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                            value={localCoediting.authToken ?? ''}
                            placeholder={t.general.localCoeditingAuthTokenPlaceholder}
                            data-testid="settings-local-coediting-auth-token"
                            onChange={(event) =>
                              void updateLocalCoediting({ authToken: event.target.value || undefined })
                            }
                          />
                        </label>
                      </>
                    )}
                    {localCoediting.mode === 'host' && localCoediting.networkMode === 'lan' && (
                      <div
                        className="sm:col-span-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800"
                        data-testid="settings-local-coediting-lan-warning"
                      >
                        {t.general.localCoeditingLanWarning}
                      </div>
                    )}
                  </div>
                </div>
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
                    <h4 className="text-xs font-semibold text-slate-700">{t.general.privacyDetectionTitle}</h4>
                    <p className="mt-1 text-xs text-slate-500">{t.general.privacyDetectionDescription}</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                      value={privacyDetectionModelPath}
                      placeholder={t.general.privacyDetectionModel}
                      data-testid="settings-privacy-model-input"
                      onChange={(event) => setPrivacyDetectionModelPath(event.target.value)}
                    />
                    <button
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
                      type="button"
                      title={t.general.choosePrivacyDetectionModel}
                      aria-label={t.general.choosePrivacyDetectionModel}
                      data-testid="settings-privacy-model-choose-button"
                      onClick={() => void choosePrivacyDetectionModel()}
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
                    {!supportsDropFrameTimecode(project.settings.fps) ? (
                      <span className="mt-1 block text-[11px] text-slate-500">{t.general.dropFrameUnavailable}</span>
                    ) : null}
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    {t.general.vfrHandling}
                    <select
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                      value={normalizeVfrHandlingStrategy(project.settings.vfrHandling)}
                      data-testid="project-vfr-handling-select"
                      onChange={(event) => updateProjectVfrHandling(event.target.value)}
                    >
                      {VFR_HANDLING_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {t.general.vfrHandlingOptions[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    {t.general.colorPipeline}
                    <select
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                      value={normalizeProjectColorPipeline(project.settings.colorPipeline)}
                      data-testid="project-color-pipeline-select"
                      onChange={(event) => updateProjectColorPipeline(event.target.value)}
                    >
                      {PROJECT_COLOR_PIPELINES.map((pipeline) => (
                        <option key={pipeline} value={pipeline}>
                          {t.general.colorPipelineOptions[pipeline as ProjectColorPipeline]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    {t.general.workingColorSpace}
                    <select
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                      value={normalizeProjectWorkingColorSpace(project.settings.workingColorSpace)}
                      data-testid="project-working-color-space-select"
                      onChange={(event) => updateProjectWorkingColorSpace(event.target.value)}
                    >
                      {EXPORT_COLOR_SPACES.map((colorSpace) => (
                        <option key={colorSpace} value={colorSpace}>
                          {getColorSpaceDisplayName(colorSpace)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
                  <input
                    className="mt-0.5 h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={exportBackgroundSettings.allowPowerActions}
                    data-testid="settings-export-power-actions-toggle"
                    onChange={(event) =>
                      void updateExportBackgroundSettings({
                        ...exportBackgroundSettings,
                        allowPowerActions: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <span className="block font-semibold text-slate-700">{t.general.allowExportPowerActions}</span>
                    <span className="mt-1 block">{t.general.allowExportPowerActionsDescription}</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
                  <input
                    className="mt-0.5 h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={exportBackgroundSettings.lowPowerMode}
                    data-testid="settings-export-low-power-toggle"
                    onChange={(event) =>
                      void updateExportBackgroundSettings({
                        ...exportBackgroundSettings,
                        lowPowerMode: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <span className="block font-semibold text-slate-700">{t.general.lowPowerExportMode}</span>
                    <span className="mt-1 block">{t.general.lowPowerExportModeDescription}</span>
                  </span>
                </label>
                <ExportQualityAssuranceSettingsPanel
                  settings={exportQualityAssuranceSettings}
                  onChange={(patch) => void updateExportQualityAssuranceSettings(patch)}
                />
                <label className="flex items-start gap-2 rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
                  <input
                    className="mt-0.5 h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={touchOptimizationSettings.enabled}
                    data-testid="settings-touch-optimization-toggle"
                    onChange={(event) => void updateTouchOptimizationSettings({ enabled: event.target.checked })}
                  />
                  <span>
                    <span className="block font-semibold text-slate-700">触屏优化模式</span>
                    <span className="mt-1 block">
                      开启后时间线交互元素自动放大、间距增加，适配触屏设备。关闭后使用标准鼠标交互尺寸。
                    </span>
                  </span>
                </label>
                <ExportRulesSettingsPanel
                  rules={exportRules}
                  onRuleChange={(rule) => void updateExportRule(rule)}
                  onChooseCopyDirectory={() => void chooseExportRuleCopyDirectory()}
                />
                <div className="rounded-md border border-line bg-panel p-3" data-testid="settings-developer-section">
                  <label className="flex items-start gap-2 text-xs text-slate-600">
                    <input
                      className="mt-0.5 h-4 w-4 accent-brand"
                      type="checkbox"
                      checked={developerMode}
                      data-testid="settings-developer-mode-toggle"
                      onChange={(e) => setDeveloperMode(e.target.checked)}
                    />
                    <span>
                      <span className="block font-semibold text-slate-700">开发者模式</span>
                      <span className="mt-1 block">开启后显示开发者工具，包括项目压力测试。</span>
                    </span>
                  </label>
                  {developerMode ? (
                    <div className="mt-3 space-y-2 border-t border-line pt-3" data-testid="stress-test-panel">
                      <h4 className="text-xs font-semibold text-slate-700">项目压力测试</h4>
                      <p className="text-[11px] text-slate-500">在独立临时项目中模拟极端场景，不影响当前工作。</p>
                      <div className="flex flex-wrap gap-2">
                        {(['mega-clips', 'long-timeline', 'mass-keyframes', 'deep-nested'] as StressScenarioId[]).map(
                          (sid) => (
                            <button
                              key={sid}
                              className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                              data-testid={`stress-run-${sid}`}
                              onClick={() => {
                                const { project, metrics: baseMetrics } = generateStressScenario(sid);
                                const start = Date.now();
                                const renderStart = performance.now();
                                const _clone = JSON.parse(JSON.stringify(project));
                                const renderTimeMs = performance.now() - renderStart;
                                const metrics = measurePerfMetrics(baseMetrics, renderTimeMs, 0, 0);
                                const report = buildStressReport(sid, start, metrics, undefined, '3.9.0');
                                setStressTestResult(serializeStressReport(report));
                              }}
                            >
                              {sid === 'mega-clips'
                                ? '超大项目'
                                : sid === 'long-timeline'
                                  ? '超长TL'
                                  : sid === 'mass-keyframes'
                                    ? '大量KF'
                                    : '深度嵌套'}
                            </button>
                          ),
                        )}
                      </div>
                      {stressTestResult ? (
                        <pre
                          className="mt-2 max-h-48 overflow-auto rounded border border-line bg-white p-2 text-[10px] text-slate-700"
                          data-testid="stress-test-result"
                        >
                          {stressTestResult}
                        </pre>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
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
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{t.lutLibrary.title}</h3>
                    <p className="text-xs text-slate-500">
                      {selectedClipCanUseLut
                        ? t.lutLibrary.readyForClip(selectedClip?.name ?? '')
                        : t.lutLibrary.noClipSelectedMessage}
                    </p>
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
                {loading ? (
                  <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">
                    {t.lutLibrary.loading}
                  </div>
                ) : null}
                {error ? (
                  <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {error}
                  </div>
                ) : null}
                {!loading && items.length === 0 ? (
                  <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">
                    {t.lutLibrary.empty}
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <div
                      key={item.path}
                      className="rounded-md border border-line bg-white p-3 shadow-sm"
                      data-testid="lut-library-item"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-[54px] w-24 shrink-0 overflow-hidden rounded bg-slate-100">
                          {item.previewDataUrl ? (
                            <img
                              className="h-full w-full object-cover"
                              src={item.previewDataUrl}
                              alt=""
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink" title={item.path}>
                            {item.name}
                          </div>
                          <div className="truncate text-xs text-slate-500" title={item.path}>
                            {item.path}
                          </div>
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
            {tab === 'shortcuts' ? (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{t.shortcuts.title}</h3>
                    <p className="text-xs text-slate-500">{t.shortcuts.description}</p>
                  </div>
                  <button
                    className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                    type="button"
                    onClick={resetAllShortcuts}
                    data-testid="shortcuts-reset-all-button"
                  >
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
                            {hasConflict ? (
                              <div className="text-xs font-medium text-rose-700">
                                {t.shortcuts.conflict(conflictList.join(', '))}
                              </div>
                            ) : null}
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
                            {capturingAction === definition.action
                              ? t.shortcuts.pressKeys
                              : effectiveBindings[definition.action].join(' / ')}
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
                    <button
                      className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                      type="button"
                      data-testid="macros-import-button"
                      onClick={() => void importMacros()}
                    >
                      {t.macros.import}
                    </button>
                    <button
                      className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                      type="button"
                      data-testid="macros-export-button"
                      onClick={() => void exportMacros()}
                    >
                      {t.macros.export}
                    </button>
                  </div>
                </div>
                {macros.length === 0 ? (
                  <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">
                    {t.macros.empty}
                  </div>
                ) : null}
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
                            {macro.description ? (
                              <div className="text-xs text-slate-500">{macro.description}</div>
                            ) : null}
                            <div className="mt-1 text-xs text-slate-500">
                              {t.macros.stepCount(getMacroSteps(macro).length)}
                            </div>
                            {hasConflict ? (
                              <div className="mt-1 text-xs font-medium text-rose-700">
                                {t.macros.conflict(conflictList.map(formatMacroConflict).join(', '))}
                              </div>
                            ) : null}
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
                            {capturingMacroId === macro.id
                              ? t.shortcuts.pressKeys
                              : (macro.shortcut ?? t.macros.bindShortcut)}
                          </button>
                          <button
                            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                            type="button"
                            data-testid={`macro-apply-${macro.id}`}
                            onClick={() => onExecuteMacro(macro)}
                          >
                            {t.macros.apply}
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
                        <MacroStepsEditor
                          macro={macro}
                          onSave={(raw) => void updateMacroStepsFromJson(macro.id, raw)}
                          onDeleteStep={(steps) => void updateMacroSteps(macro.id, steps)}
                        />
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
          </main>
        </div>
      </div>
    </div>
  );
}




function formatProjectFps(fps: number): string {
  return `${Number.isInteger(fps) ? fps.toFixed(0) : fps.toFixed(3)} fps`;
}

const AUTOMATION_RULE_EXAMPLE = [
  {
    trigger: 'on-import',
    conditions: [{ field: 'duration', op: '>', value: 300 }],
    actions: [{ type: 'generate-proxy' }, { type: 'add-tag', value: 'green' }],
  },
];

function AutomationSettingsPanel({
  rules,
  rulesJson,
  error,
  onRulesJsonChange,
  onSave,
  onToggleRule,
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
        <div
          className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800"
          data-testid="automation-rules-error"
        >
          {error}
        </div>
      ) : null}
      <button
        className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95"
        type="button"
        data-testid="automation-rules-save-button"
        onClick={onSave}
      >
        {t.save}
      </button>
      <div className="rounded-md border border-line bg-white p-3" data-testid="automation-rules-list">
        {rules.length === 0 ? <div className="text-sm text-slate-500">{t.empty}</div> : null}
        <div className="space-y-2">
          {rules.map((rule) => (
            <label
              key={rule.id}
              className="flex items-start gap-2 rounded-md border border-line bg-panel p-2 text-xs text-slate-600"
              data-testid="automation-rule-row"
            >
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
              <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {rule.enabled ? t.enabled : t.disabled}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportQualityAssuranceSettingsPanel({
  settings,
  onChange,
}: {
  settings: PostExportQualityAssuranceSettings;
  onChange(patch: Partial<PostExportQualityAssuranceSettings>): void;
}) {
  const t = zhCN.settings.general.postExportQuality;
  return (
    <div className="rounded-md border border-line bg-panel p-3" data-testid="settings-export-qa-section">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-700">{t.title}</h4>
          <p className="mt-1 text-xs text-slate-500">{t.description}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            className="h-4 w-4 accent-brand"
            type="checkbox"
            checked={settings.enabled}
            data-testid="settings-export-qa-enabled"
            onChange={(event) => onChange({ enabled: event.target.checked })}
          />
          <span>{t.enabled}</span>
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <QualityAssuranceCheckbox
          label={t.duration}
          testId="settings-export-qa-duration"
          checked={settings.duration}
          onChange={(checked) => onChange({ duration: checked })}
        />
        <QualityAssuranceCheckbox
          label={t.blackFrames}
          testId="settings-export-qa-black-frames"
          checked={settings.blackFrames}
          onChange={(checked) => onChange({ blackFrames: checked })}
        />
        <QualityAssuranceCheckbox
          label={t.silence}
          testId="settings-export-qa-silence"
          checked={settings.silence}
          onChange={(checked) => onChange({ silence: checked })}
        />
        <QualityAssuranceCheckbox
          label={t.fileSize}
          testId="settings-export-qa-file-size"
          checked={settings.fileSize}
          onChange={(checked) => onChange({ fileSize: checked })}
        />
        <QualityAssuranceCheckbox
          label={t.resolution}
          testId="settings-export-qa-resolution"
          checked={settings.resolution}
          onChange={(checked) => onChange({ resolution: checked })}
        />
        <QualityAssuranceCheckbox
          label={t.autoRetry}
          testId="settings-export-qa-auto-retry"
          checked={settings.autoRetry}
          onChange={(checked) => onChange({ autoRetry: checked })}
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block text-xs font-medium text-slate-600">
          {t.minFileSizeBytes}
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            type="number"
            min={0}
            step={1}
            value={settings.minFileSizeBytes ?? ''}
            data-testid="settings-export-qa-min-size"
            onChange={(event) => onChange({ minFileSizeBytes: optionalNumberFromInput(event.target.value) })}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.maxFileSizeBytes}
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            type="number"
            min={0}
            step={1}
            value={settings.maxFileSizeBytes ?? ''}
            data-testid="settings-export-qa-max-size"
            onChange={(event) => onChange({ maxFileSizeBytes: optionalNumberFromInput(event.target.value) })}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.blackFrameDurationSeconds}
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            type="number"
            min={0.1}
            step={0.1}
            value={settings.blackFrameDurationSeconds}
            data-testid="settings-export-qa-black-duration"
            onChange={(event) =>
              onChange({
                blackFrameDurationSeconds: requiredNumberFromInput(
                  event.target.value,
                  DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.blackFrameDurationSeconds,
                ),
              })
            }
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.silenceThresholdDb}
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            type="number"
            step={1}
            value={settings.silenceThresholdDb}
            data-testid="settings-export-qa-silence-threshold"
            onChange={(event) =>
              onChange({
                silenceThresholdDb: requiredNumberFromInput(
                  event.target.value,
                  DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.silenceThresholdDb,
                ),
              })
            }
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.silenceDurationSeconds}
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            type="number"
            min={0.1}
            step={0.1}
            value={settings.silenceDurationSeconds}
            data-testid="settings-export-qa-silence-duration"
            onChange={(event) =>
              onChange({
                silenceDurationSeconds: requiredNumberFromInput(
                  event.target.value,
                  DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.silenceDurationSeconds,
                ),
              })
            }
          />
        </label>
      </div>
    </div>
  );
}

function QualityAssuranceCheckbox({
  label,
  testId,
  checked,
  onChange,
}: {
  label: string;
  testId: string;
  checked: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
      <input
        className="h-4 w-4 accent-brand"
        type="checkbox"
        checked={checked}
        data-testid={testId}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function optionalNumberFromInput(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requiredNumberFromInput(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ExportRulesSettingsPanel({
  rules,
  onRuleChange,
  onChooseCopyDirectory,
}: {
  rules: ExportConditionRule[];
  onRuleChange(rule: ExportConditionRule): void;
  onChooseCopyDirectory(): void;
}) {
  const t = zhCN.settings.exportRules;
  const copyRule = getExportRule(rules, EXPORT_RULE_COPY_SUCCESS_ID, defaultExportCopyRule());
  const failureNotificationRule = getExportRule(
    rules,
    EXPORT_RULE_FAILURE_NOTIFICATION_ID,
    defaultExportFailureNotificationRule(),
  );
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
  onPasswordChange,
}: {
  settings: BackupSettings;
  password: string;
  onSettingsChange(settings: BackupSettings): void;
  onChooseDirectory(): void;
  onPasswordChange(password: string): void;
}) {
  const t = zhCN.settings.backup;
  const lastBackup = formatBackupDisplayTime(settings.lastBackupAt) ?? t.neverBackedUp;
  const updateLocal = (patch: Partial<BackupSettings['local']>) =>
    onSettingsChange({ ...settings, local: { ...settings.local, ...patch } });
  const updateWebdav = (patch: Partial<BackupSettings['webdav']>) =>
    onSettingsChange({ ...settings, webdav: { ...settings.webdav, ...patch } });

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
            <span
              className="mt-1 block text-[11px] font-normal text-amber-700"
              data-testid="backup-webdav-https-warning"
            >
              {t.httpsRequiredNote}
            </span>
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

function PresetMarketPanel({
  cards,
  ratings,
  filters,
  loading,
  source,
  warning,
  installingCardId,
  onFiltersChange,
  onRefresh,
  onInstall,
  onRate,
  onShare,
}: {
  cards: PresetMarketCard[];
  ratings: Record<string, number>;
  filters: PresetMarketFilters;
  loading: boolean;
  source: PresetMarketLoadResult['source'];
  warning?: string;
  installingCardId?: string;
  onFiltersChange(filters: PresetMarketFilters): void;
  onRefresh(): void;
  onInstall(card: PresetMarketCard): void;
  onRate(cardId: string, rating: number): void;
  onShare(): void;
}) {
  const t = zhCN.presetMarket;
  const updateFilter = (key: keyof PresetMarketFilters, value: string) => onFiltersChange({ ...filters, [key]: value });

  return (
    <section className="rounded-md border border-line bg-panel p-3" data-testid="preset-market-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
          <p
            className="mt-1 text-[11px] font-medium text-slate-500"
            data-testid="preset-market-source"
            data-source={source}
          >
            {t.sourceLabels[source]}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="preset-market-share-button"
            onClick={onShare}
          >
            <FilePlus size={13} />
            {t.share}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={loading}
            data-testid="preset-market-refresh-button"
            onClick={onRefresh}
          >
            <RotateCcw size={13} />
            {loading ? t.loading : t.refresh}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3" data-testid="preset-market-filters">
        <PresetMarketFilterSelect
          label={t.filters.platform}
          value={filters.platform ?? 'all'}
          options={t.filters.platformOptions}
          testId="preset-market-platform-filter"
          onChange={(value) => updateFilter('platform', value)}
        />
        <PresetMarketFilterSelect
          label={t.filters.quality}
          value={filters.quality ?? 'all'}
          options={t.filters.qualityOptions}
          testId="preset-market-quality-filter"
          onChange={(value) => updateFilter('quality', value)}
        />
        <PresetMarketFilterSelect
          label={t.filters.format}
          value={filters.format ?? 'all'}
          options={t.filters.formatOptions}
          testId="preset-market-format-filter"
          onChange={(value) => updateFilter('format', value)}
        />
      </div>

      {warning ? (
        <div
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
          data-testid="preset-market-warning"
        >
          {warning}
        </div>
      ) : null}
      {loading ? (
        <div className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">{t.loading}</div>
      ) : null}
      {!loading && cards.length === 0 ? (
        <div className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">{t.empty}</div>
      ) : null}

      <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="preset-market-list">
        {cards.map((card) => {
          const displayedRating = ratings[card.id] ?? card.rating;
          const installing = installingCardId === card.id;
          return (
            <div
              key={card.id}
              className="rounded-md border border-line bg-white p-3"
              data-testid="preset-market-card"
              data-preset-id={card.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{card.name}</div>
                  <div className="truncate text-xs text-slate-500">{t.byAuthor(card.author)}</div>
                </div>
                <div
                  className="shrink-0 rounded bg-panel px-2 py-1 text-[11px] font-semibold text-slate-600"
                  data-testid="preset-market-downloads"
                >
                  {t.downloads(card.downloads)}
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-slate-500">{card.description}</p>
              <div className="mt-2 flex flex-wrap gap-1" data-testid="preset-market-tags">
                {card.tags.map((tag) => (
                  <span key={tag} className="rounded bg-panel px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div
                  className="flex items-center gap-1"
                  data-testid="preset-market-rating"
                  data-rating={displayedRating}
                >
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-line ${rating <= displayedRating ? 'bg-amber-50 text-amber-600' : 'bg-white text-slate-400'} hover:bg-panel`}
                      type="button"
                      title={t.rate(rating)}
                      aria-label={t.rate(rating)}
                      data-testid={`preset-market-rate-${rating}`}
                      onClick={() => onRate(card.id, rating)}
                    >
                      <Star size={13} fill={rating <= displayedRating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <button
                  className="inline-flex items-center justify-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={installing}
                  data-testid="preset-market-install-button"
                  onClick={() => onInstall(card)}
                >
                  <Download size={13} />
                  {installing ? t.installing : t.install}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EffectPresetCommunityPanel({
  cards,
  filters,
  loading,
  source,
  warning,
  installingCardId,
  canShare,
  onFiltersChange,
  onRefresh,
  onInstall,
  onShare,
}: {
  cards: EffectPresetCommunityCard[];
  filters: EffectPresetFilters;
  loading: boolean;
  source: EffectPresetCommunityLoadResult['source'];
  warning?: string;
  installingCardId?: string;
  canShare: boolean;
  onFiltersChange(filters: EffectPresetFilters): void;
  onRefresh(): void;
  onInstall(card: EffectPresetCommunityCard): void;
  onShare(): void;
}) {
  const t = zhCN.effectPresetLibrary;
  const updateFilter = (key: keyof EffectPresetFilters, value: string) => onFiltersChange({ ...filters, [key]: value });

  return (
    <section className="rounded-md border border-line bg-panel p-3" data-testid="effect-preset-community-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
          <p
            className="mt-1 text-[11px] font-medium text-slate-500"
            data-testid="effect-preset-source"
            data-source={source}
          >
            {t.sourceLabels[source]}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!canShare}
            data-testid="effect-preset-share-button"
            onClick={onShare}
          >
            <FilePlus size={13} />
            {t.share}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={loading}
            data-testid="effect-preset-refresh-button"
            onClick={onRefresh}
          >
            <RotateCcw size={13} />
            {loading ? t.loading : t.refresh}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="effect-preset-filters">
        <EffectPresetFilterSelect
          label={t.filters.style}
          value={filters.style ?? 'all'}
          options={t.filters.styleOptions}
          testId="effect-preset-style-filter"
          onChange={(value) => updateFilter('style', value)}
        />
        <EffectPresetFilterSelect
          label={t.filters.use}
          value={filters.use ?? 'all'}
          options={t.filters.useOptions}
          testId="effect-preset-use-filter"
          onChange={(value) => updateFilter('use', value)}
        />
      </div>

      {warning ? (
        <div
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
          data-testid="effect-preset-warning"
        >
          {warning}
        </div>
      ) : null}
      {loading ? (
        <div className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">{t.loading}</div>
      ) : null}
      {!loading && cards.length === 0 ? (
        <div className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">{t.empty}</div>
      ) : null}

      <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="effect-preset-community-list">
        {cards.map((card) => {
          const installing = installingCardId === card.id;
          return (
            <div
              key={card.id}
              className="rounded-md border border-line bg-white p-3"
              data-testid="effect-preset-community-card"
              data-preset-id={card.id}
            >
              <div className="flex items-start gap-3">
                <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded border border-line bg-panel">
                  {card.thumbnail ? (
                    <img
                      className="h-full w-full object-cover"
                      src={card.thumbnail}
                      alt=""
                      data-testid="effect-preset-community-thumbnail"
                      loading="lazy"
                    />
                  ) : (
                    <SlidersHorizontal size={18} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{card.name}</div>
                  <div className="truncate text-xs text-slate-500">{t.byAuthor(card.author)}</div>
                  {card.description ? (
                    <p className="mt-2 line-clamp-2 text-xs text-slate-500">{card.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1" data-testid="effect-preset-community-tags">
                {card.tags.map((tag) => (
                  <span key={tag} className="rounded bg-panel px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {(t.tagLabels as Record<string, string>)[tag] ?? tag}
                  </span>
                ))}
              </div>
              <button
                className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={installing}
                data-testid="effect-preset-install-button"
                onClick={() => onInstall(card)}
              >
                <Download size={13} />
                {installing ? t.installing : t.install}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EffectPresetFilterSelect({
  label,
  value,
  options,
  testId,
  onChange,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  testId: string;
  onChange(value: string): void;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <select
        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      >
        {Object.entries(options).map(([option, optionLabel]) => (
          <option key={option} value={option}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function PresetMarketFilterSelect({
  label,
  value,
  options,
  testId,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  testId: string;
  onChange(value: string): void;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <select
        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExportPresetSyncSettingsPanel({
  settings,
  password,
  onSettingsChange,
  onPasswordChange,
}: {
  settings: ExportPresetSyncSettings;
  password: string;
  onSettingsChange(settings: ExportPresetSyncSettings): void;
  onPasswordChange(password: string): void;
}) {
  const t = zhCN.settings.exportPresetSync;
  const lastSync = formatBackupDisplayTime(settings.lastSyncedAt) ?? t.neverSynced;
  const update = (patch: Partial<ExportPresetSyncSettings>) => onSettingsChange({ ...settings, ...patch });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-panel text-slate-600">
          <Cloud size={16} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
        </div>
      </div>
      <div className="rounded-md border border-line bg-white p-3">
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            className="mt-0.5 h-4 w-4"
            type="checkbox"
            checked={settings.enabled}
            data-testid="export-preset-sync-enabled"
            onChange={(event) => update({ enabled: event.target.checked })}
          />
          <span className="font-semibold text-slate-700">{t.enabled}</span>
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
            {t.url}
            <input
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              value={settings.url ?? ''}
              data-testid="export-preset-sync-url-input"
              onChange={(event) => update({ url: event.target.value })}
            />
            <span
              className="mt-1 block text-[11px] font-normal text-amber-700"
              data-testid="export-preset-sync-https-warning"
            >
              {t.httpsRequiredNote}
            </span>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.username}
            <input
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              value={settings.username ?? ''}
              data-testid="export-preset-sync-username-input"
              onChange={(event) => update({ username: event.target.value })}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.password}
            <input
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              type="password"
              value={password}
              data-testid="export-preset-sync-password-input"
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              className="mt-0.5 h-4 w-4"
              type="checkbox"
              checked={settings.syncOnStartup}
              data-testid="export-preset-sync-startup-toggle"
              onChange={(event) => update({ syncOnStartup: event.target.checked })}
            />
            <span>{t.syncOnStartup}</span>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.conflictMode}
            <select
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              value={settings.conflictMode}
              data-testid="export-preset-sync-conflict-mode-select"
              onChange={(event) =>
                update({ conflictMode: event.target.value as ExportPresetSyncSettings['conflictMode'] })
              }
            >
              {(['merge', 'keep-local', 'keep-remote'] as const).map((mode) => (
                <option key={mode} value={mode}>
                  {t.conflictModes[mode]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 text-xs text-slate-500">{t.passwordStorageNote}</div>
      </div>
      <div
        className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600"
        data-testid="export-preset-sync-status"
      >
        <div>
          {t.lastSync}: <span data-testid="export-preset-sync-last-time">{lastSync}</span>
        </div>
        {settings.lastSyncWarning ? (
          <div className="mt-1 text-amber-700" data-testid="export-preset-sync-warning">
            {t.lastWarning}: {settings.lastSyncWarning}
          </div>
        ) : null}
      </div>
    </div>
  );
}


function TranslationSettingsPanel({
  provider,
  apiKey,
  apiKeyError,
  targetLanguage,
  onProviderChange,
  onApiKeyChange,
  onTargetLanguageChange,
}: {
  provider: TranslationProvider;
  apiKey: string;
  apiKeyError?: string;
  targetLanguage: string;
  onProviderChange(provider: TranslationProvider): void;
  onApiKeyChange(apiKey: string): void | Promise<void>;
  onTargetLanguageChange(targetLanguage: string): void;
}) {
  const t = zhCN.settings.translation;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
        <p className="text-xs text-slate-500">{t.description}</p>
      </div>
      <div
        className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800"
        data-testid="translation-third-party-warning"
      >
        {t.thirdPartyWarning}
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
            onChange={(event) => void onApiKeyChange(event.target.value)}
          />
        </label>
        <p className="mt-1 text-xs text-slate-500">{t.keyStorageNote}</p>
        {apiKeyError ? (
          <p className="mt-1 text-xs font-medium text-amber-700" data-testid="translation-api-key-error">
            {apiKeyError}
          </p>
        ) : null}
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

function LocalModelsSettingsPanel({
  settings,
  statuses,
  onChoose,
  onDownload,
}: {
  settings: LocalAiModelsSettings;
  statuses: Partial<Record<LocalAiModelId, LocalAiModelResolvedStatus>>;
  onChoose(id: LocalAiModelId): void;
  onDownload(id: LocalAiModelId): void;
}) {
  const t = zhCN.settings.localModels;
  return (
    <div className="space-y-4" data-testid="local-models-panel">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
        <p className="text-xs text-slate-500">{t.description}</p>
      </div>
      <div className="grid gap-3">
        {LOCAL_AI_MODEL_IDS.map((id) => {
          const definition = LOCAL_AI_MODEL_DEFINITIONS[id];
          const modelText = t.models[id];
          const config = settings[id];
          const status = statuses[id] ?? { id, status: 'missing' as const, reason: 'not-configured' as const };
          const path = config?.path ?? status.path ?? '';
          return (
            <div
              key={id}
              className="rounded-md border border-line bg-panel p-3"
              data-testid={`local-model-row-${id}`}
              data-status={status.status}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs font-semibold text-slate-800">{modelText.name}</h4>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${localModelStatusClass(status.status)}`}
                      data-testid={`local-model-status-${id}`}
                    >
                      {t.status[status.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{modelText.description}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-white/80"
                    type="button"
                    title={t.download}
                    aria-label={t.download}
                    data-testid={`local-model-download-${id}`}
                    onClick={() => onDownload(id)}
                  >
                    <Download size={14} />
                  </button>
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-white/80"
                    type="button"
                    title={t.chooseFile}
                    aria-label={t.chooseFile}
                    data-testid={`local-model-choose-${id}`}
                    onClick={() => onChoose(id)}
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <ModelInfo label={t.version} value={config?.version ?? definition.version} />
                <ModelInfo
                  label={t.fileSize}
                  value={status.size !== undefined ? formatBytes(status.size) : zhCN.common.unavailable}
                />
                <ModelInfo label={t.storagePath} value={path || t.notConfigured} mono />
                <ModelInfo label={t.lastUsedAt} value={formatOptionalIsoDateTime(config?.lastUsedAt)} />
              </div>
              {status.status === 'invalid' ? (
                <div className="mt-2 text-xs font-medium text-rose-700">{t.invalidStatus}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModelInfo({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-md bg-white/80 p-2">
      <div className="text-[11px] uppercase tracking-normal text-slate-500">{label}</div>
      <div className={`mt-0.5 truncate font-medium text-slate-700 ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function localModelStatusClass(status: LocalAiModelResolvedStatus['status']): string {
  if (status === 'installed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'invalid') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function formatOptionalIsoDateTime(value: string | undefined): string {
  if (!value) {
    return zhCN.common.unavailable;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? formatDateTime(timestamp) : zhCN.common.unavailable;
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
    action: 'copy-to-directory',
  };
}

function defaultExportFailureNotificationRule(): ExportConditionRule {
  return {
    id: EXPORT_RULE_FAILURE_NOTIFICATION_ID,
    enabled: false,
    trigger: 'export-failure',
    action: 'system-notification',
  };
}

function defaultExportQueueToneRule(): ExportConditionRule {
  return {
    id: EXPORT_RULE_QUEUE_TONE_ID,
    enabled: false,
    trigger: 'queue-complete',
    action: 'play-tone',
  };
}

function MacroStepsEditor({
  macro,
  onSave,
  onDeleteStep,
}: {
  macro: ClipMacro;
  onSave(raw: string): void;
  onDeleteStep(steps: CommandSnapshot[]): void;
}) {
  const t = zhCN.settings.macros;
  const steps = useMemo(() => getMacroSteps(macro), [macro]);
  const [value, setValue] = useState(() => serializeCommandSnapshots(steps));

  useEffect(() => {
    setValue(serializeCommandSnapshots(steps));
  }, [steps]);

  return (
    <details className="mt-3 rounded-md border border-line bg-panel p-2">
      <summary className="cursor-pointer text-xs font-semibold text-slate-600">{t.editSteps}</summary>
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <button
              key={`${step.type}-${index}`}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-panel"
              type="button"
              data-testid={`macro-delete-step-${macro.id}-${index}`}
              onClick={() => onDeleteStep(steps.filter((_, stepIndex) => stepIndex !== index))}
            >
              <Trash2 size={12} />
              <span>{t.deleteStep(index + 1, step.type)}</span>
            </button>
          ))}
        </div>
        <textarea
          className="h-32 w-full resize-y rounded-md border border-line bg-white p-2 font-mono text-xs text-ink"
          value={value}
          data-testid={`macro-steps-json-${macro.id}`}
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
          type="button"
          data-testid={`macro-save-steps-${macro.id}`}
          onClick={() => onSave(value)}
        >
          <Save size={13} />
          <span>{t.saveSteps}</span>
        </button>
      </div>
    </details>
  );
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
                lutPath,
              },
            }
          : clip,
      ),
    })),
  };
}
