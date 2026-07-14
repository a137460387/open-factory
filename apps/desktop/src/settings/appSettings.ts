import { logError } from "../lib/error-handlers";
import { getLanguage, languageFromNavigator, normalizeLanguage, setLanguage, type Language } from '../i18n/strings';
import {
  DEFAULT_TIMELINE_GRID_SETTINGS,
  DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS,
  DEFAULT_EXPORT_OPTIMIZATION_SETTINGS,
  normalizeSplitLayoutDefinition,
  normalizePostExportQualityAssuranceSettings,
  normalizeExportOptimizationSettings,
  normalizeTimelineGridSettings,
  hasEnabledPostExportQualityChecks,
  normalizeCustomAudioVisualizationThemes,
  type SplitLayoutDefinition,
  type CustomAudioVisualizationTheme,
  type ExportOptimizationSettings,
  type PostExportQualityAssuranceSettings,
  type TimelineGridSettings,
  type TimelineHeatmapColorScheme,
  type TimelineHeatmapType,
  type TouchOptimizationSettings,
  DEFAULT_TOUCH_OPTIMIZATION_SETTINGS,
  normalizeTouchOptimizationSettings,
  type MediaGroupingSettings,
  DEFAULT_MEDIA_GROUPING_SETTINGS,
  normalizeMediaGroupingSettings
} from '@open-factory/editor-core';
import { fsExists, getAppDataDir, readFile, writeFile } from '../lib/tauri-bridge';
import {
  DEFAULT_EDITOR_LAYOUT_SETTINGS,
  normalizeStoredLayoutSettings,
  type EditorLayoutSettings
} from '../layout/layoutSettings';
import { DEFAULT_THEME_SETTINGS, normalizeThemeSettings, type ThemeSettings } from '../theme/theme';
import {
  DEFAULT_PREVIEW_PERFORMANCE_SETTINGS,
  normalizePreviewPerformanceSettings,
  type PreviewPerformanceSettings
} from '../lib/preview/preview-performance';
import {
  DEFAULT_MEDIA_LIBRARY_VIEW_SETTINGS,
  normalizeMediaLibraryViewSettings,
  type MediaLibraryViewSettings
} from '../media/mediaLibraryView';
import {
  LOCAL_AI_MODEL_DEFINITIONS,
  hasLocalAiModelsSettings,
  normalizeLocalAiModelsSettings,
  type LocalAiModelId,
  type LocalAiModelsSettings
} from './localModels';
import { normalizeTutorialProgressSettings, type TutorialProgressSettings } from '../tutorial/tutorialState';
import {
  normalizeUpdateSettings,
  shouldPersistUpdateSettings,
  type UpdateSettings
} from '../updater/update-settings';

const BROWSER_SETTINGS_KEY = 'open-factory:settings';

interface LocalBackupSettings {
  enabled: boolean;
  directory?: string;
}

interface WebdavBackupSettings {
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
  lowPowerMode: boolean;
}

interface PreviewWindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

type PreviewWindowResolutionScale = 1 | 0.5 | 0.25;

export interface PreviewWindowSettings {
  bounds: PreviewWindowBounds;
  alwaysOnTop: boolean;
  resolutionScale: PreviewWindowResolutionScale;
}

export type HardwareAccelerationMode = 'auto' | 'enabled' | 'disabled';
export type HardwareAccelerationBackend = 'cuda' | 'vaapi' | 'quicksync' | 'videotoolbox' | 'd3d11va' | 'auto';

export interface HardwareAccelerationSettings {
  mode: HardwareAccelerationMode;
  preferredBackend: HardwareAccelerationBackend;
  enableFrameCache: boolean;
  frameCacheSize: number;
  enablePreDecode: boolean;
  preDecodeFrameCount: number;
}

export const DEFAULT_HARDWARE_ACCELERATION_SETTINGS: HardwareAccelerationSettings = {
  mode: 'auto',
  preferredBackend: 'auto',
  enableFrameCache: true,
  frameCacheSize: 30,
  enablePreDecode: true,
  preDecodeFrameCount: 5,
};

export function normalizeHardwareAccelerationSettings(
  settings: Partial<HardwareAccelerationSettings> | undefined
): HardwareAccelerationSettings {
  if (!settings) {
    return { ...DEFAULT_HARDWARE_ACCELERATION_SETTINGS };
  }
  return {
    mode: settings.mode ?? DEFAULT_HARDWARE_ACCELERATION_SETTINGS.mode,
    preferredBackend: settings.preferredBackend ?? DEFAULT_HARDWARE_ACCELERATION_SETTINGS.preferredBackend,
    enableFrameCache: settings.enableFrameCache ?? DEFAULT_HARDWARE_ACCELERATION_SETTINGS.enableFrameCache,
    frameCacheSize: settings.frameCacheSize ?? DEFAULT_HARDWARE_ACCELERATION_SETTINGS.frameCacheSize,
    enablePreDecode: settings.enablePreDecode ?? DEFAULT_HARDWARE_ACCELERATION_SETTINGS.enablePreDecode,
    preDecodeFrameCount: settings.preDecodeFrameCount ?? DEFAULT_HARDWARE_ACCELERATION_SETTINGS.preDecodeFrameCount,
  };
}

export interface TimelineInteractionSettings {
  reduceMotion: boolean;
  audioScrubEnabled?: boolean;
}

type DisplayColorGamut = 'srgb' | 'p3' | 'rec2020';

export interface DisplaySettings {
  colorGamut: DisplayColorGamut;
}

export interface CollaborationIdentitySettings {
  name: string;
  color: string;
}

type LocalCoeditingMode = 'host' | 'client';
type LocalCoeditingPermission = 'read-only' | 'edit';

export interface LocalCoeditingSettings {
  enabled: boolean;
  mode: LocalCoeditingMode;
  permission: LocalCoeditingPermission;
  port: number;
  hostUrl?: string;
  networkMode?: 'localhost' | 'lan';
  authToken?: string;
}

export interface AudioVisualizationThemeSettings {
  customThemes: CustomAudioVisualizationTheme[];
}

type ExportUploadTargetType = 'webdav' | 'local';

export interface ExportUploadSettings {
  enabled: boolean;
  targetType: ExportUploadTargetType;
  webdav: {
    url?: string;
    username?: string;
  };
  local: {
    directory?: string;
  };
}

type ExportPresetSyncConflictMode = 'merge' | 'keep-local' | 'keep-remote';

export interface ExportPresetSyncSettings {
  enabled: boolean;
  url?: string;
  username?: string;
  syncOnStartup: boolean;
  conflictMode: ExportPresetSyncConflictMode;
  lastSyncedAt?: string;
  lastSyncWarning?: string;
}

export interface ViewSettings {
  safeFrameGuides: boolean;
  thumbnailTrackVisible: boolean;
  timelineMinimapVisible: boolean;
  timelineHeatmap: TimelineHeatmapViewSettings;
  mediaLibrary: MediaLibraryViewSettings;
}

export interface TimelineHeatmapViewSettings {
  enabled: boolean;
  type: TimelineHeatmapType;
  opacity: number;
  colorScheme: TimelineHeatmapColorScheme;
}

export type ExportRuleTrigger = 'export-success' | 'export-failure' | 'queue-complete';
type ExportRuleAction = 'copy-to-directory' | 'system-notification' | 'play-tone';

export type AutomationTrigger = 'on-import' | 'on-export-complete' | 'on-project-open';
type AutomationConditionOperator = '>' | '>=' | '<' | '<=' | '==' | '!=' | 'contains';
type AutomationConditionField = 'duration' | 'width' | 'height' | 'resolution' | 'fileSize' | 'size' | 'format' | 'type' | 'name';
type AutomationActionType = 'generate-proxy' | 'add-tag' | 'add-color-label' | 'move-to-group' | 'send-notification';

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

export const DEFAULT_EXPORT_UPLOAD_SETTINGS: ExportUploadSettings = {
  enabled: false,
  targetType: 'webdav',
  webdav: {},
  local: {}
};

export const DEFAULT_EXPORT_PRESET_SYNC_SETTINGS: ExportPresetSyncSettings = {
  enabled: false,
  syncOnStartup: false,
  conflictMode: 'merge'
};

const DEFAULT_PREVIEW_WINDOW_SETTINGS: PreviewWindowSettings = {
  bounds: {
    width: 960,
    height: 540
  },
  alwaysOnTop: false,
  resolutionScale: 1
};

export const DEFAULT_TIMELINE_INTERACTION_SETTINGS: TimelineInteractionSettings = {
  reduceMotion: false,
  audioScrubEnabled: true
};

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  colorGamut: 'srgb'
};

export const DEFAULT_COLLABORATION_IDENTITY_SETTINGS: CollaborationIdentitySettings = {
  name: '我',
  color: '#38bdf8'
};

export const DEFAULT_LOCAL_COEDITING_SETTINGS: LocalCoeditingSettings = {
  enabled: false,
  mode: 'host',
  permission: 'edit',
  port: 37822,
  networkMode: 'localhost'
};

const DEFAULT_AUDIO_VISUALIZATION_THEME_SETTINGS: AudioVisualizationThemeSettings = {
  customThemes: []
};

export interface AppSettings {
  language?: Language;
  tutorialStep?: number;
  tutorialSkipped?: boolean;
  tutorialCompleted?: boolean;
  layout?: EditorLayoutSettings;
  backup?: BackupSettings;
  theme?: ThemeSettings;
  exportBackground?: ExportBackgroundSettings;
  exportUpload?: ExportUploadSettings;
  exportPresetSync?: ExportPresetSyncSettings;
  exportQualityAssurance?: PostExportQualityAssuranceSettings;
  exportOptimization?: ExportOptimizationSettings;
  exportRules?: ExportConditionRule[];
  view?: ViewSettings;
  previewPerformance?: PreviewPerformanceSettings;
  previewWindow?: PreviewWindowSettings;
  hardwareAcceleration?: HardwareAccelerationSettings;
  timelineInteraction?: TimelineInteractionSettings;
  display?: DisplaySettings;
  collaborationIdentity?: CollaborationIdentitySettings;
  localCoediting?: LocalCoeditingSettings;
  audioVisualizationThemes?: AudioVisualizationThemeSettings;
  localModels?: LocalAiModelsSettings;
  automationRules?: AutomationRule[];
  customSplitLayouts?: SplitLayoutDefinition[];
  timelineGrid?: TimelineGridSettings;
  update?: UpdateSettings;
  disableExportRecommendations?: boolean;
  thumbnailPrerenderEnabled?: boolean;
  touchOptimization?: TouchOptimizationSettings;
  mediaGrouping?: MediaGroupingSettings;
  developerMode?: boolean;
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

export async function readTutorialProgressSettings(): Promise<TutorialProgressSettings> {
  const settings = await readAppSettings();
  return normalizeTutorialProgressSettings(settings);
}

export async function saveTutorialProgressSettings(progress: Partial<TutorialProgressSettings>): Promise<TutorialProgressSettings> {
  const settings = await readAppSettings();
  const nextProgress = normalizeTutorialProgressSettings(progress);
  await writeAppSettings({
    ...settings,
    tutorialStep: nextProgress.tutorialStep,
    tutorialSkipped: nextProgress.tutorialSkipped,
    tutorialCompleted: nextProgress.tutorialCompleted
  });
  return nextProgress;
}

export async function readExportUploadSettings(): Promise<ExportUploadSettings> {
  const settings = await readAppSettings();
  return settings.exportUpload ?? defaultExportUploadSettings();
}

export async function saveExportUploadSettings(exportUpload: Partial<ExportUploadSettings>): Promise<ExportUploadSettings> {
  const settings = await readAppSettings();
  const nextExportUpload = normalizeExportUploadSettings({ ...settings.exportUpload, ...exportUpload }) ?? defaultExportUploadSettings();
  await writeAppSettings({ ...settings, exportUpload: nextExportUpload });
  return nextExportUpload;
}

export async function readExportPresetSyncSettings(): Promise<ExportPresetSyncSettings> {
  const settings = await readAppSettings();
  return settings.exportPresetSync ?? defaultExportPresetSyncSettings();
}

export async function saveExportPresetSyncSettings(exportPresetSync: Partial<ExportPresetSyncSettings>): Promise<ExportPresetSyncSettings> {
  const settings = await readAppSettings();
  const nextExportPresetSync = normalizeExportPresetSyncSettings({ ...settings.exportPresetSync, ...exportPresetSync }) ?? defaultExportPresetSyncSettings();
  await writeAppSettings({ ...settings, exportPresetSync: nextExportPresetSync });
  return nextExportPresetSync;
}

export async function readExportQualityAssuranceSettings(): Promise<PostExportQualityAssuranceSettings> {
  const settings = await readAppSettings();
  return settings.exportQualityAssurance ?? { ...DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS };
}

export async function saveExportQualityAssuranceSettings(exportQualityAssurance: Partial<PostExportQualityAssuranceSettings>): Promise<PostExportQualityAssuranceSettings> {
  const settings = await readAppSettings();
  const nextExportQualityAssurance = normalizePostExportQualityAssuranceSettings({ ...settings.exportQualityAssurance, ...exportQualityAssurance });
  await writeAppSettings({ ...settings, exportQualityAssurance: nextExportQualityAssurance });
  return nextExportQualityAssurance;
}

export async function readExportOptimizationSettings(): Promise<ExportOptimizationSettings> {
  const settings = await readAppSettings();
  return settings.exportOptimization ?? { ...DEFAULT_EXPORT_OPTIMIZATION_SETTINGS };
}

export async function saveExportOptimizationSettings(exportOptimization: Partial<ExportOptimizationSettings>): Promise<ExportOptimizationSettings> {
  const settings = await readAppSettings();
  const nextExportOptimization = normalizeExportOptimizationSettings({ ...settings.exportOptimization, ...exportOptimization });
  await writeAppSettings({ ...settings, exportOptimization: nextExportOptimization });
  return nextExportOptimization;
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

export async function readDisableExportRecommendations(): Promise<boolean> {
  const settings = await readAppSettings();
  return settings.disableExportRecommendations ?? false;
}

async function saveDisableExportRecommendations(disabled: boolean): Promise<void> {
  const settings = await readAppSettings();
  await writeAppSettings({ ...settings, disableExportRecommendations: disabled });
}

async function readThumbnailPrerenderEnabled(): Promise<boolean> {
  const settings = await readAppSettings();
  return settings.thumbnailPrerenderEnabled ?? true;
}

async function saveThumbnailPrerenderEnabled(enabled: boolean): Promise<void> {
  const settings = await readAppSettings();
  await writeAppSettings({ ...settings, thumbnailPrerenderEnabled: enabled });
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

export async function readPreviewPerformanceSettings(): Promise<PreviewPerformanceSettings> {
  const settings = await readAppSettings();
  return settings.previewPerformance ?? { ...DEFAULT_PREVIEW_PERFORMANCE_SETTINGS };
}

export async function readTimelineGridSettings(): Promise<TimelineGridSettings> {
  const settings = await readAppSettings();
  return settings.timelineGrid ?? { ...DEFAULT_TIMELINE_GRID_SETTINGS };
}

export async function readUpdateSettings(): Promise<UpdateSettings> {
  const settings = await readAppSettings();
  return normalizeUpdateSettings(settings.update);
}

export async function saveTimelineGridSettings(timelineGrid: Partial<TimelineGridSettings>): Promise<TimelineGridSettings> {
  const settings = await readAppSettings();
  const nextTimelineGrid = normalizeTimelineGridSettings({ ...settings.timelineGrid, ...timelineGrid });
  await writeAppSettings({ ...settings, timelineGrid: nextTimelineGrid });
  return nextTimelineGrid;
}

export async function saveUpdateSettings(update: Partial<UpdateSettings>): Promise<UpdateSettings> {
  const settings = await readAppSettings();
  const nextUpdate = normalizeUpdateSettings({ ...settings.update, ...update });
  await writeAppSettings({ ...settings, update: nextUpdate });
  return nextUpdate;
}

export async function savePreviewPerformanceSettings(previewPerformance: Partial<PreviewPerformanceSettings>): Promise<PreviewPerformanceSettings> {
  const settings = await readAppSettings();
  const nextPreviewPerformance = normalizePreviewPerformanceSettings({ ...settings.previewPerformance, ...previewPerformance });
  await writeAppSettings({ ...settings, previewPerformance: nextPreviewPerformance });
  return nextPreviewPerformance;
}

export async function readHardwareAccelerationSettings(): Promise<HardwareAccelerationSettings> {
  const settings = await readAppSettings();
  return normalizeHardwareAccelerationSettings(settings.hardwareAcceleration);
}

export async function saveHardwareAccelerationSettings(
  hardwareAcceleration: Partial<HardwareAccelerationSettings>
): Promise<HardwareAccelerationSettings> {
  const settings = await readAppSettings();
  const nextHwAccel = normalizeHardwareAccelerationSettings({
    ...settings.hardwareAcceleration,
    ...hardwareAcceleration,
  });
  await writeAppSettings({ ...settings, hardwareAcceleration: nextHwAccel });
  return nextHwAccel;
}

export async function readTimelineInteractionSettings(): Promise<TimelineInteractionSettings> {
  const settings = await readAppSettings();
  return settings.timelineInteraction ?? defaultTimelineInteractionSettings();
}

export async function saveTimelineInteractionSettings(timelineInteraction: Partial<TimelineInteractionSettings>): Promise<TimelineInteractionSettings> {
  const settings = await readAppSettings();
  const nextTimelineInteraction = normalizeTimelineInteractionSettings({ ...settings.timelineInteraction, ...timelineInteraction }) ?? defaultTimelineInteractionSettings();
  await writeAppSettings({ ...settings, timelineInteraction: nextTimelineInteraction });
  return nextTimelineInteraction;
}

export async function readDisplaySettings(): Promise<DisplaySettings> {
  const settings = await readAppSettings();
  return normalizeDisplaySettings(settings.display) ?? defaultDisplaySettings();
}

export async function saveDisplaySettings(display: Partial<DisplaySettings>): Promise<DisplaySettings> {
  const settings = await readAppSettings();
  const nextDisplay = normalizeDisplaySettings({ ...settings.display, ...display }) ?? defaultDisplaySettings();
  await writeAppSettings({ ...settings, display: nextDisplay });
  return nextDisplay;
}

export async function readCollaborationIdentitySettings(): Promise<CollaborationIdentitySettings> {
  const settings = await readAppSettings();
  return settings.collaborationIdentity ?? { ...DEFAULT_COLLABORATION_IDENTITY_SETTINGS };
}

export async function saveCollaborationIdentitySettings(identity: Partial<CollaborationIdentitySettings>): Promise<CollaborationIdentitySettings> {
  const settings = await readAppSettings();
  const nextIdentity = normalizeCollaborationIdentitySettings({ ...settings.collaborationIdentity, ...identity });
  await writeAppSettings({ ...settings, collaborationIdentity: nextIdentity });
  return nextIdentity;
}

export async function readLocalCoeditingSettings(): Promise<LocalCoeditingSettings> {
  const settings = await readAppSettings();
  return normalizeLocalCoeditingSettings(settings.localCoediting);
}

export async function saveLocalCoeditingSettings(localCoediting: Partial<LocalCoeditingSettings>): Promise<LocalCoeditingSettings> {
  const settings = await readAppSettings();
  const nextLocalCoediting = normalizeLocalCoeditingSettings({ ...settings.localCoediting, ...localCoediting });
  await writeAppSettings({ ...settings, localCoediting: nextLocalCoediting });
  return nextLocalCoediting;
}

export async function readAudioVisualizationThemeSettings(): Promise<AudioVisualizationThemeSettings> {
  const settings = await readAppSettings();
  return settings.audioVisualizationThemes ?? { ...DEFAULT_AUDIO_VISUALIZATION_THEME_SETTINGS };
}

export async function saveAudioVisualizationThemeSettings(audioVisualizationThemes: Partial<AudioVisualizationThemeSettings>): Promise<AudioVisualizationThemeSettings> {
  const settings = await readAppSettings();
  const nextThemes = normalizeAudioVisualizationThemeSettings({ ...settings.audioVisualizationThemes, ...audioVisualizationThemes });
  await writeAppSettings({ ...settings, audioVisualizationThemes: nextThemes });
  return nextThemes;
}

export async function readPreviewWindowSettings(): Promise<PreviewWindowSettings> {
  const settings = await readAppSettings();
  return settings.previewWindow ?? defaultPreviewWindowSettings();
}

export async function savePreviewWindowSettings(previewWindow: Partial<PreviewWindowSettings>): Promise<PreviewWindowSettings> {
  const settings = await readAppSettings();
  const nextPreviewWindow = normalizePreviewWindowSettings({ ...settings.previewWindow, ...previewWindow }) ?? defaultPreviewWindowSettings();
  await writeAppSettings({ ...settings, previewWindow: nextPreviewWindow });
  return nextPreviewWindow;
}

export async function readLocalAiModelsSettings(): Promise<LocalAiModelsSettings> {
  const settings = await readAppSettings();
  return settings.localModels ?? {};
}

export async function saveLocalAiModelsSettings(localModels: LocalAiModelsSettings): Promise<LocalAiModelsSettings> {
  const settings = await readAppSettings();
  const nextLocalModels = normalizeLocalAiModelsSettings({ ...settings.localModels, ...localModels });
  await writeAppSettings({ ...settings, localModels: nextLocalModels });
  return nextLocalModels;
}

export async function markLocalAiModelUsed(id: LocalAiModelId, path?: string, now = new Date().toISOString()): Promise<LocalAiModelsSettings> {
  const settings = await readAppSettings();
  const current = settings.localModels ?? {};
  return saveLocalAiModelsSettings({
    [id]: {
      ...(current[id] ?? {}),
      ...(path?.trim() ? { path: path.trim() } : {}),
      version: current[id]?.version ?? LOCAL_AI_MODEL_DEFINITIONS[id].version,
      lastUsedAt: now
    }
  });
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

async function writeAppSettings(settings: AppSettings): Promise<void> {
  const normalized = normalizeSettings(settings);
  const settingsPath = await getSettingsFilePath().catch(logError("appSettings"));
  if (settingsPath) {
    await writeFile(settingsPath, JSON.stringify(normalized, null, 2));
    return;
  }
  getBrowserStorage()?.setItem(BROWSER_SETTINGS_KEY, JSON.stringify(normalized));
}

async function getSettingsFilePath(): Promise<string> {
  const appDataDir = await getAppDataDir();
  return `${appDataDir.replace(/\/+$/, '')}/settings.json`;
}

async function readFileSettings(): Promise<AppSettings | undefined> {
  const settingsPath = await getSettingsFilePath().catch(logError("appSettings"));
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
  const tutorialProgress = normalizeTutorialProgressSettings(settings);
  if (shouldPersistTutorialProgressSettings(tutorialProgress)) {
    normalized.tutorialStep = tutorialProgress.tutorialStep;
    normalized.tutorialSkipped = tutorialProgress.tutorialSkipped;
    normalized.tutorialCompleted = tutorialProgress.tutorialCompleted;
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
  const exportUpload = normalizeExportUploadSettings(settings.exportUpload);
  if (exportUpload && shouldPersistExportUploadSettings(exportUpload)) {
    normalized.exportUpload = exportUpload;
  }
  const exportPresetSync = normalizeExportPresetSyncSettings(settings.exportPresetSync);
  if (exportPresetSync && shouldPersistExportPresetSyncSettings(exportPresetSync)) {
    normalized.exportPresetSync = exportPresetSync;
  }
  const exportQualityAssurance = normalizePostExportQualityAssuranceSettings(settings.exportQualityAssurance);
  if (shouldPersistExportQualityAssuranceSettings(exportQualityAssurance)) {
    normalized.exportQualityAssurance = exportQualityAssurance;
  }
  const exportOptimization = normalizeExportOptimizationSettings(settings.exportOptimization);
  if (shouldPersistExportOptimizationSettings(exportOptimization)) {
    normalized.exportOptimization = exportOptimization;
  }
  const exportRules = normalizeExportRules(settings.exportRules);
  if (exportRules.length > 0) {
    normalized.exportRules = exportRules;
  }
  const view = normalizeViewSettings(settings.view);
  if (view) {
    normalized.view = view;
  }
  const previewPerformance = normalizePreviewPerformanceSettings(settings.previewPerformance);
  if (
    previewPerformance.qualityMode !== DEFAULT_PREVIEW_PERFORMANCE_SETTINGS.qualityMode ||
    previewPerformance.skipFrames !== DEFAULT_PREVIEW_PERFORMANCE_SETTINGS.skipFrames ||
    previewPerformance.adaptiveEnabled !== DEFAULT_PREVIEW_PERFORMANCE_SETTINGS.adaptiveEnabled
  ) {
    normalized.previewPerformance = previewPerformance;
  }
  const previewWindow = normalizePreviewWindowSettings(settings.previewWindow);
  if (previewWindow) {
    normalized.previewWindow = previewWindow;
  }
  const timelineInteraction = normalizeTimelineInteractionSettings(settings.timelineInteraction);
  if (timelineInteraction && shouldPersistTimelineInteractionSettings(timelineInteraction)) {
    normalized.timelineInteraction = timelineInteraction;
  }
  const display = normalizeDisplaySettings(settings.display);
  if (display && shouldPersistDisplaySettings(display)) {
    normalized.display = display;
  }
  const collaborationIdentity = normalizeCollaborationIdentitySettings(settings.collaborationIdentity);
  if (shouldPersistCollaborationIdentitySettings(collaborationIdentity)) {
    normalized.collaborationIdentity = collaborationIdentity;
  }
  const localCoediting = normalizeLocalCoeditingSettings(settings.localCoediting);
  if (shouldPersistLocalCoeditingSettings(localCoediting)) {
    normalized.localCoediting = localCoediting;
  }
  const audioVisualizationThemes = normalizeAudioVisualizationThemeSettings(settings.audioVisualizationThemes);
  if (shouldPersistAudioVisualizationThemeSettings(audioVisualizationThemes)) {
    normalized.audioVisualizationThemes = audioVisualizationThemes;
  }
  const localModels = normalizeLocalAiModelsSettings(settings.localModels);
  if (hasLocalAiModelsSettings(localModels)) {
    normalized.localModels = localModels;
  }
  const automationRules = normalizeAutomationRules(settings.automationRules);
  if (automationRules.length > 0) {
    normalized.automationRules = automationRules;
  }
  const customSplitLayouts = normalizeCustomSplitLayouts(settings.customSplitLayouts);
  if (customSplitLayouts.length > 0) {
    normalized.customSplitLayouts = customSplitLayouts;
  }
  if (settings.timelineGrid) {
    normalized.timelineGrid = normalizeTimelineGridSettings(settings.timelineGrid);
  }
  const update = normalizeUpdateSettings(settings.update);
  if (shouldPersistUpdateSettings(update)) {
    normalized.update = update;
  }
  return normalized;
}

function normalizeCustomSplitLayouts(layouts: unknown): SplitLayoutDefinition[] {
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

function normalizeExportRules(rules: unknown): ExportConditionRule[] {
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

function normalizeExportBackgroundSettings(settings: Partial<ExportBackgroundSettings> | undefined): ExportBackgroundSettings | undefined {
  if (!settings || typeof settings !== 'object') {
    return undefined;
  }
  return {
    allowPowerActions: Boolean(settings.allowPowerActions),
    postExportScriptAcknowledged: Boolean(settings.postExportScriptAcknowledged),
    lowPowerMode: Boolean(settings.lowPowerMode)
  };
}

function normalizePreviewWindowSettings(settings: Partial<PreviewWindowSettings> | undefined): PreviewWindowSettings | undefined {
  if (!settings || typeof settings !== 'object') {
    return undefined;
  }
  const fallback = DEFAULT_PREVIEW_WINDOW_SETTINGS.bounds;
  const boundsInput = settings.bounds && typeof settings.bounds === 'object' ? (settings.bounds as Partial<PreviewWindowBounds>) : {};
  const x = normalizeOptionalInteger(boundsInput.x, -32768, 32767);
  const y = normalizeOptionalInteger(boundsInput.y, -32768, 32767);
  const width = normalizeInteger(boundsInput.width, 320, 7680, fallback.width);
  const height = normalizeInteger(boundsInput.height, 240, 4320, fallback.height);
  const bounds: PreviewWindowBounds = { width, height };
  if (x !== undefined) {
    bounds.x = x;
  }
  if (y !== undefined) {
    bounds.y = y;
  }
  return {
    bounds,
    alwaysOnTop: settings.alwaysOnTop === true,
    resolutionScale: normalizePreviewWindowResolutionScale(settings.resolutionScale)
  };
}

function normalizeTimelineInteractionSettings(settings: Partial<TimelineInteractionSettings> | undefined): TimelineInteractionSettings | undefined {
  if (!settings || typeof settings !== 'object') {
    return undefined;
  }
  return {
    reduceMotion: settings.reduceMotion === true,
    audioScrubEnabled: settings.audioScrubEnabled !== false
  };
}

function normalizeDisplaySettings(settings: Partial<DisplaySettings> | undefined): DisplaySettings | undefined {
  if (!settings || typeof settings !== 'object') {
    return undefined;
  }
  return {
    colorGamut: normalizeDisplayColorGamut(settings.colorGamut)
  };
}

function normalizeCollaborationIdentitySettings(settings: Partial<CollaborationIdentitySettings> | undefined): CollaborationIdentitySettings {
  const name = typeof settings?.name === 'string' && settings.name.trim() ? settings.name.trim().slice(0, 80) : DEFAULT_COLLABORATION_IDENTITY_SETTINGS.name;
  return {
    name,
    color: normalizeHexColor(settings?.color, DEFAULT_COLLABORATION_IDENTITY_SETTINGS.color)
  };
}

function normalizeLocalCoeditingSettings(settings: Partial<LocalCoeditingSettings> | undefined): LocalCoeditingSettings {
  return {
    enabled: settings?.enabled === true,
    mode: settings?.mode === 'client' ? 'client' : 'host',
    permission: settings?.permission === 'read-only' ? 'read-only' : 'edit',
    port: normalizeInteger(settings?.port, 1, 65535, DEFAULT_LOCAL_COEDITING_SETTINGS.port),
    hostUrl: typeof settings?.hostUrl === 'string' && settings.hostUrl.trim() ? settings.hostUrl.trim().slice(0, 300) : undefined,
    networkMode: settings?.networkMode === 'lan' ? 'lan' : 'localhost',
    authToken: typeof settings?.authToken === 'string' && settings.authToken.trim() ? settings.authToken.trim().slice(0, 256) : undefined
  };
}

function normalizeAudioVisualizationThemeSettings(settings: Partial<AudioVisualizationThemeSettings> | undefined): AudioVisualizationThemeSettings {
  return {
    customThemes: normalizeCustomAudioVisualizationThemes(settings?.customThemes)
  };
}

function normalizePreviewWindowResolutionScale(value: unknown): PreviewWindowResolutionScale {
  return value === 0.5 || value === 0.25 ? value : 1;
}

function normalizeDisplayColorGamut(value: unknown): DisplayColorGamut {
  return value === 'p3' || value === 'rec2020' ? value : 'srgb';
}

function normalizeExportUploadSettings(settings: Partial<ExportUploadSettings> | undefined): ExportUploadSettings | undefined {
  if (!settings || typeof settings !== 'object') {
    return undefined;
  }
  const webdav = settings.webdav && typeof settings.webdav === 'object' ? settings.webdav : {};
  const local = settings.local && typeof settings.local === 'object' ? settings.local : {};
  const targetType: ExportUploadTargetType = settings.targetType === 'local' ? 'local' : 'webdav';
  const normalized: ExportUploadSettings = {
    enabled: Boolean(settings.enabled),
    targetType,
    webdav: {},
    local: {}
  };
  if (typeof webdav.url === 'string' && webdav.url.trim()) {
    normalized.webdav.url = webdav.url.trim();
  }
  if (typeof webdav.username === 'string' && webdav.username.trim()) {
    normalized.webdav.username = webdav.username.trim();
  }
  if (typeof local.directory === 'string' && local.directory.trim()) {
    normalized.local.directory = local.directory.trim();
  }
  return normalized;
}

function normalizeExportPresetSyncSettings(settings: Partial<ExportPresetSyncSettings> | undefined): ExportPresetSyncSettings | undefined {
  if (!settings || typeof settings !== 'object') {
    return undefined;
  }
  const normalized: ExportPresetSyncSettings = {
    enabled: Boolean(settings.enabled),
    syncOnStartup: Boolean(settings.syncOnStartup),
    conflictMode: normalizeExportPresetSyncConflictMode(settings.conflictMode)
  };
  if (typeof settings.url === 'string' && settings.url.trim()) {
    normalized.url = settings.url.trim();
  }
  if (typeof settings.username === 'string' && settings.username.trim()) {
    normalized.username = settings.username.trim();
  }
  if (typeof settings.lastSyncedAt === 'string' && settings.lastSyncedAt.trim()) {
    normalized.lastSyncedAt = settings.lastSyncedAt.trim();
  }
  if (typeof settings.lastSyncWarning === 'string' && settings.lastSyncWarning.trim()) {
    normalized.lastSyncWarning = settings.lastSyncWarning.trim();
  }
  return normalized;
}

function normalizeViewSettings(settings: Partial<ViewSettings> | undefined): ViewSettings | undefined {
  if (!settings || typeof settings !== 'object') {
    return undefined;
  }
  return {
    safeFrameGuides: settings.safeFrameGuides === true,
    thumbnailTrackVisible: settings.thumbnailTrackVisible !== false,
    timelineMinimapVisible: settings.timelineMinimapVisible !== false,
    timelineHeatmap: normalizeTimelineHeatmapViewSettings(settings.timelineHeatmap),
    mediaLibrary: normalizeMediaLibraryViewSettings(settings.mediaLibrary)
  };
}

export function normalizeTimelineHeatmapViewSettings(settings: Partial<TimelineHeatmapViewSettings> | undefined): TimelineHeatmapViewSettings {
  const type = settings?.type === 'volume' || settings?.type === 'cut-frequency' ? settings.type : 'edit-density';
  const colorScheme = settings?.colorScheme === 'cool' || settings?.colorScheme === 'mono' ? settings.colorScheme : 'warm';
  const rawOpacity = typeof settings?.opacity === 'number' && Number.isFinite(settings.opacity) ? settings.opacity : 0.45;
  return {
    enabled: settings?.enabled === true,
    type,
    opacity: Math.round(Math.min(0.8, Math.max(0, rawOpacity)) * 100) / 100,
    colorScheme
  };
}

function normalizeBackupSettings(settings: Partial<BackupSettings> | undefined): BackupSettings | undefined {
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
    postExportScriptAcknowledged: false,
    lowPowerMode: false
  };
}

function defaultExportUploadSettings(): ExportUploadSettings {
  return {
    enabled: DEFAULT_EXPORT_UPLOAD_SETTINGS.enabled,
    targetType: DEFAULT_EXPORT_UPLOAD_SETTINGS.targetType,
    webdav: { ...DEFAULT_EXPORT_UPLOAD_SETTINGS.webdav },
    local: { ...DEFAULT_EXPORT_UPLOAD_SETTINGS.local }
  };
}

function shouldPersistExportUploadSettings(settings: ExportUploadSettings): boolean {
  return settings.enabled || Boolean(settings.webdav.url || settings.webdav.username || settings.local.directory) || settings.targetType !== DEFAULT_EXPORT_UPLOAD_SETTINGS.targetType;
}

function defaultExportPresetSyncSettings(): ExportPresetSyncSettings {
  return { ...DEFAULT_EXPORT_PRESET_SYNC_SETTINGS };
}

function defaultPreviewWindowSettings(): PreviewWindowSettings {
  return {
    bounds: { ...DEFAULT_PREVIEW_WINDOW_SETTINGS.bounds },
    alwaysOnTop: DEFAULT_PREVIEW_WINDOW_SETTINGS.alwaysOnTop,
    resolutionScale: DEFAULT_PREVIEW_WINDOW_SETTINGS.resolutionScale
  };
}

function defaultTimelineInteractionSettings(): TimelineInteractionSettings {
  return { ...DEFAULT_TIMELINE_INTERACTION_SETTINGS };
}

function defaultDisplaySettings(): DisplaySettings {
  return { ...DEFAULT_DISPLAY_SETTINGS };
}

function shouldPersistTimelineInteractionSettings(settings: TimelineInteractionSettings): boolean {
  return settings.reduceMotion !== DEFAULT_TIMELINE_INTERACTION_SETTINGS.reduceMotion || settings.audioScrubEnabled !== DEFAULT_TIMELINE_INTERACTION_SETTINGS.audioScrubEnabled;
}

function shouldPersistDisplaySettings(settings: DisplaySettings): boolean {
  return settings.colorGamut !== DEFAULT_DISPLAY_SETTINGS.colorGamut;
}

function shouldPersistCollaborationIdentitySettings(settings: CollaborationIdentitySettings): boolean {
  return settings.name !== DEFAULT_COLLABORATION_IDENTITY_SETTINGS.name || settings.color !== DEFAULT_COLLABORATION_IDENTITY_SETTINGS.color;
}

function shouldPersistLocalCoeditingSettings(settings: LocalCoeditingSettings): boolean {
  return (
    settings.enabled !== DEFAULT_LOCAL_COEDITING_SETTINGS.enabled ||
    settings.mode !== DEFAULT_LOCAL_COEDITING_SETTINGS.mode ||
    settings.permission !== DEFAULT_LOCAL_COEDITING_SETTINGS.permission ||
    settings.port !== DEFAULT_LOCAL_COEDITING_SETTINGS.port ||
    Boolean(settings.hostUrl) ||
    settings.networkMode !== DEFAULT_LOCAL_COEDITING_SETTINGS.networkMode ||
    Boolean(settings.authToken)
  );
}

function shouldPersistAudioVisualizationThemeSettings(settings: AudioVisualizationThemeSettings): boolean {
  return settings.customThemes.length > 0;
}

function shouldPersistTutorialProgressSettings(settings: TutorialProgressSettings): boolean {
  return settings.tutorialStep > 0 || settings.tutorialSkipped || settings.tutorialCompleted;
}

function shouldPersistExportPresetSyncSettings(settings: ExportPresetSyncSettings): boolean {
  return (
    settings.enabled ||
    settings.syncOnStartup ||
    settings.conflictMode !== DEFAULT_EXPORT_PRESET_SYNC_SETTINGS.conflictMode ||
    Boolean(settings.url || settings.username || settings.lastSyncedAt || settings.lastSyncWarning)
  );
}

function shouldPersistExportQualityAssuranceSettings(settings: PostExportQualityAssuranceSettings): boolean {
  return (
    hasEnabledPostExportQualityChecks(settings) ||
    settings.duration ||
    settings.blackFrames ||
    settings.silence ||
    settings.fileSize ||
    settings.resolution ||
    settings.autoRetry ||
    settings.minFileSizeBytes !== undefined ||
    settings.maxFileSizeBytes !== undefined ||
    settings.blackFrameDurationSeconds !== DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.blackFrameDurationSeconds ||
    settings.silenceThresholdDb !== DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.silenceThresholdDb ||
    settings.silenceDurationSeconds !== DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.silenceDurationSeconds
  );
}

function shouldPersistExportOptimizationSettings(settings: ExportOptimizationSettings): boolean {
  return settings.dismissedSuggestionIds.length > 0;
}

function normalizeHexColor(color: string | undefined, fallback: string): string {
  const candidate = typeof color === 'string' ? color.trim() : '';
  if (!candidate) return fallback;
  const six = /^#?([0-9a-fA-F]{6})$/.exec(candidate);
  if (six) return `#${six[1].toLowerCase()}`;
  const three = /^#?([0-9a-fA-F]{3})$/.exec(candidate);
  if (three) {
    const [r, g, b] = three[1].toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function normalizeExportPresetSyncConflictMode(value: unknown): ExportPresetSyncConflictMode {
  return value === 'keep-local' || value === 'keep-remote' ? value : 'merge';
}

function defaultViewSettings(): ViewSettings {
  return {
    safeFrameGuides: false,
    thumbnailTrackVisible: true,
    timelineMinimapVisible: true,
    timelineHeatmap: normalizeTimelineHeatmapViewSettings(undefined),
    mediaLibrary: { ...DEFAULT_MEDIA_LIBRARY_VIEW_SETTINGS }
  };
}

function getBrowserStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function normalizeInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.round(Math.min(max, Math.max(min, value)));
}

function normalizeOptionalInteger(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.round(Math.min(max, Math.max(min, value)));
}

export async function readTouchOptimizationSettings(): Promise<TouchOptimizationSettings> {
  const settings = await readAppSettings();
  return normalizeTouchOptimizationSettings(settings.touchOptimization);
}

export async function saveTouchOptimizationSettings(touchOptimization: Partial<TouchOptimizationSettings>): Promise<TouchOptimizationSettings> {
  const settings = await readAppSettings();
  const next = normalizeTouchOptimizationSettings({ ...settings.touchOptimization, ...touchOptimization });
  await writeAppSettings({ ...settings, touchOptimization: next });
  return next;
}

async function readMediaGroupingSettings(): Promise<MediaGroupingSettings> {
  const settings = await readAppSettings();
  return normalizeMediaGroupingSettings(settings.mediaGrouping);
}

async function saveMediaGroupingSettings(mediaGrouping: Partial<MediaGroupingSettings>): Promise<MediaGroupingSettings> {
  const settings = await readAppSettings();
  const next = normalizeMediaGroupingSettings({ ...settings.mediaGrouping, ...mediaGrouping });
  await writeAppSettings({ ...settings, mediaGrouping: next });
  return next;
}
