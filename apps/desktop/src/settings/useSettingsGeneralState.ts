import {logger} from '@open-factory/editor-core/utils';
import {useState, useCallback} from 'react';
import {
  UpdateProjectSettingsCommand,
  normalizeProjectColorPipeline,
  normalizeProjectFps,
  normalizeProjectWorkingColorSpace,
  normalizeTimecodeFormat,
  normalizeVfrHandlingStrategy,
  type Clip,
  type Project,
  type TimecodeFormat,
  type TouchOptimizationSettings,
} from '@open-factory/editor-core';
import {getLanguage, normalizeLanguage, setLanguage as setI18nLanguage, zhCN, type Language} from '../i18n/strings';
import {switchLanguage} from '../i18n/i18next-config';
import {pickDemucsExecutablePath} from '../lib/demucs';
import {openFileDialog, getAppVersion, checkAppUpdate} from '../lib/tauri-bridge';
import {showToast} from '../lib/toast';
import {commandManager, projectAccessor} from '../store/commandManager';
import {useDemucsSettingsStore} from '../store/demucsSettingsStore';
import {useEditorStore} from '../store/editorStore';
import {usePrivacyDetectionSettingsStore} from '../store/privacyDetectionSettingsStore';
import {useProxySettingsStore} from '../store/proxySettingsStore';
import {useRecordingSettingsStore} from '../store/recordingSettingsStore';
import {useTranslationSettingsStore} from '../store/translationSettingsStore';
import {applyLocalCoeditingSettings} from '../collaboration/settings';
import {
  DEFAULT_COLLABORATION_IDENTITY_SETTINGS,
  DEFAULT_LOCAL_COEDITING_SETTINGS,
  readCollaborationIdentitySettings,
  readDisplaySettings,
  readLocalCoeditingSettings,
  saveCollaborationIdentitySettings,
  saveDisplaySettings,
  saveLanguageSetting,
  saveLocalCoeditingSettings,
  readUpdateSettings,
  saveUpdateSettings,
  readTouchOptimizationSettings,
  saveTouchOptimizationSettings,
  type CollaborationIdentitySettings,
  type DisplaySettings,
  type LocalCoeditingSettings,
} from './appSettings';
import {useTheme} from '../theme/useTheme';
import {DEFAULT_UPDATE_SETTINGS, type UpdateSettings} from '../updater/update-settings';
import {usePluginSettings} from './usePluginSettings';
import {usePresetMarketSettings} from './usePresetMarketSettings';
import {useTimelineScriptSettings} from './useTimelineScriptSettings';
import {useLocalModelSettings} from './useLocalModelSettings';
import {useThemeSettings} from './useThemeSettings';
import type {SettingsTab} from './settingsTypes';

export function useSettingsGeneralState(
  project: Project,
  selectedClip: Clip | undefined,
  onClose: () => void,
) {
  const t = zhCN.settings;

  const pluginState = usePluginSettings(t.plugins);
  const presetMarketState = usePresetMarketSettings(selectedClip);
  const timelineScriptState = useTimelineScriptSettings(t.scripts, project);
  const localModelState = useLocalModelSettings(t.localModels);
  const themeState = useThemeSettings(t.appearance);
  const currentTheme = useTheme();
  const setPreviewTimeline = useEditorStore((state) => state.setPreviewTimeline);

  const [tab, setTab] = useState<SettingsTab>('general');
  const [language, setLanguage] = useState<Language>(() => getLanguage());
  const [developerMode, setDeveloperMode] = useState(false);
  const [stressTestResult, setStressTestResult] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateSettings, setUpdateSettings] = useState<UpdateSettings>(() => ({...DEFAULT_UPDATE_SETTINGS}));
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(() => ({colorGamut: 'srgb'}));
  const [touchOptimizationSettings, setTouchOptimizationSettings] = useState<TouchOptimizationSettings>(() => ({
    enabled: false,
    autoDetect: true,
    trimHandleScale: 1.6,
    uiSpacingMultiplier: 1.3,
    longPressMs: 500,
    doubleTapMs: 300,
  }));
  const [collaborationIdentity, setCollaborationIdentity] = useState<CollaborationIdentitySettings>(() => ({
    ...DEFAULT_COLLABORATION_IDENTITY_SETTINGS,
  }));
  const [localCoediting, setLocalCoediting] = useState<LocalCoeditingSettings>(() => ({
    ...DEFAULT_LOCAL_COEDITING_SETTINGS,
  }));

  const translationProvider = useTranslationSettingsStore((state) => state.provider);
  const translationApiKey = useTranslationSettingsStore((state) => state.apiKey);
  const translationApiKeyError = useTranslationSettingsStore((state) => state.apiKeyError);
  const translationTargetLanguage = useTranslationSettingsStore((state) => state.targetLanguage);
  const loadTranslationApiKey = useTranslationSettingsStore((state) => state.loadApiKey);
  const setTranslationProvider = useTranslationSettingsStore((state) => state.setProvider);
  const setTranslationApiKey = useTranslationSettingsStore((state) => state.setApiKey);
  const setTranslationTargetLanguage = useTranslationSettingsStore((state) => state.setTargetLanguage);
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

  const loadCurrentVersion = useCallback(async () => {
    try {
      const version = await getAppVersion();
      setCurrentVersion(version);
    } catch (error) {
      logger.warn('[Settings] Unable to load app version', error);
    }
  }, []);

  const handleCheckForUpdates = useCallback(async (): Promise<{version: string} | null> => {
    const update = await checkAppUpdate({timeout: 10000});
    if (update) {
      return {version: update.version};
    }
    return null;
  }, []);

  function close() {
    setPreviewTimeline(undefined);
    onClose();
  }

  async function updateLanguage(value: string) {
    const nextLanguage = normalizeLanguage(value);
    setLanguage(nextLanguage);
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
        {name: t.general.privacyDetectionModel, extensions: ['onnx', 'pb', 'xml', 'bin']},
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

  async function updateCollaborationIdentity(patch: Partial<CollaborationIdentitySettings>) {
    const optimistic = {...collaborationIdentity, ...patch};
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
    const optimistic = {...localCoediting, ...patch};
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
    const optimistic = {...updateSettings, ...patch};
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
    commandManager.execute(new UpdateProjectSettingsCommand(projectAccessor, {timecodeFormat}));
  }

  function updateProjectVfrHandling(value: string) {
    commandManager.execute(
      new UpdateProjectSettingsCommand(projectAccessor, {vfrHandling: normalizeVfrHandlingStrategy(value)}),
    );
  }

  function updateProjectColorPipeline(value: string) {
    const colorPipeline = normalizeProjectColorPipeline(value);
    if (colorPipeline !== normalizeProjectColorPipeline(project.settings.colorPipeline)) {
      showToast({kind: 'warning', title: t.general.colorPipelineChanged, message: t.general.colorPipelineWarning});
    }
    commandManager.execute(new UpdateProjectSettingsCommand(projectAccessor, {colorPipeline}));
  }

  function updateProjectWorkingColorSpace(value: string) {
    commandManager.execute(
      new UpdateProjectSettingsCommand(projectAccessor, {
        workingColorSpace: normalizeProjectWorkingColorSpace(value),
      }),
    );
  }

  async function updateDisplaySettings(patch: Partial<DisplaySettings>) {
    const nextSettings = {...displaySettings, ...patch};
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
    const nextSettings = {...touchOptimizationSettings, ...patch};
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

  return {
    ...pluginState,
    ...presetMarketState,
    ...timelineScriptState,
    ...localModelState,
    ...themeState,
    currentTheme,
    setPreviewTimeline,
    tab,
    setTab,
    language,
    developerMode,
    setDeveloperMode,
    stressTestResult,
    setStressTestResult,
    currentVersion,
    handleCheckForUpdates,
    updateSettings,
    displaySettings,
    touchOptimizationSettings,
    collaborationIdentity,
    localCoediting,
    translationProvider,
    translationApiKey,
    translationApiKeyError,
    translationTargetLanguage,
    loadTranslationApiKey,
    setTranslationProvider,
    setTranslationApiKey,
    setTranslationTargetLanguage,
    demucsExecutablePath,
    setDemucsExecutablePath,
    privacyDetectionModelPath,
    setPrivacyDetectionModelPath,
    recordingSettings,
    setRecordingSettings,
    proxyResolutionPreset,
    proxyTriggerShortEdge,
    setProxyResolutionPreset,
    setProxyTriggerShortEdge,
    resetProxySettings,
    loadCollaborationIdentity,
    loadLocalCoediting,
    loadDisplaySettings,
    loadUpdateSettings,
    loadCurrentVersion,
    readTouchOptimizationSettings,
    setTouchOptimizationSettings,
    close,
    updateLanguage,
    chooseDemucsExecutable,
    choosePrivacyDetectionModel,
    updateCollaborationIdentity,
    updateLocalCoediting,
    updateAppUpdateSettings,
    updateProjectFrameRate,
    updateProjectTimecodeFormat,
    updateProjectVfrHandling,
    updateProjectColorPipeline,
    updateProjectWorkingColorSpace,
    updateDisplaySettings,
    updateTouchOptimizationSettings,
  };
}
