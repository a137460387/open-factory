import {useState, useCallback} from 'react';
import {showToast} from '../lib/toast';
import {fsExists, getFileStat, openFileDialog, openPath} from '../lib/tauri-bridge';
import {LOCAL_AI_MODEL_DEFINITIONS, LOCAL_AI_MODEL_IDS, isLocalModelFileSizeValid, resolveLocalModelStatus, type LocalAiModelId, type LocalAiModelResolvedStatus, type LocalAiModelsSettings} from './localModels';
import {readLocalAiModelsSettings, saveLocalAiModelsSettings} from './appSettings';
import {useWhisperSettingsStore} from '../store/whisperSettingsStore';
import {useDemucsSettingsStore} from '../store/demucsSettingsStore';
import {usePrivacyDetectionSettingsStore} from '../store/privacyDetectionSettingsStore';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function useLocalModelSettings(t: {saveFailed: string; saveFailedMessage: string; invalidFileTitle: string; invalidFileSize: (min: string, max: string) => string; savedTitle: string; models: Record<string, {name: string}>; chooseFailed: string; chooseFailedMessage: string}) {
  const [localModelsSettings, setLocalModelsSettings] = useState<LocalAiModelsSettings>({});
  const [localModelStatuses, setLocalModelStatuses] = useState<
    Partial<Record<LocalAiModelId, LocalAiModelResolvedStatus>>
  >({});

  const setWhisperModelPath = useWhisperSettingsStore((state) => state.setModelPath);
  const demucsExecutablePath = useDemucsSettingsStore((state) => state.executablePath);
  const setDemucsExecutablePath = useDemucsSettingsStore((state) => state.setExecutablePath);
  const privacyDetectionModelPath = usePrivacyDetectionSettingsStore((state) => state.modelPath);
  const setPrivacyDetectionModelPath = usePrivacyDetectionSettingsStore((state) => state.setModelPath);

  const syncLocalModelStores = useCallback((settings: LocalAiModelsSettings) => {
    if (settings.whisper?.path) setWhisperModelPath(settings.whisper.path);
    if (settings.demucs?.path && settings.demucs.path !== demucsExecutablePath) setDemucsExecutablePath(settings.demucs.path);
    if (settings.yunet?.path && settings.yunet.path !== privacyDetectionModelPath) setPrivacyDetectionModelPath(settings.yunet.path);
  }, [setWhisperModelPath, demucsExecutablePath, setDemucsExecutablePath, privacyDetectionModelPath, setPrivacyDetectionModelPath]);

  const refreshLocalModelStatuses = useCallback(async (settings: LocalAiModelsSettings = localModelsSettings) => {
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
  }, [localModelsSettings]);

  const loadLocalModelsSettings = useCallback(async () => {
    try {
      const settings = await readLocalAiModelsSettings();
      setLocalModelsSettings(settings);
      syncLocalModelStores(settings);
      await refreshLocalModelStatuses(settings);
    } catch (modelError) {
      showToast({
        kind: 'warning',
        title: t.saveFailed,
        message: modelError instanceof Error ? modelError.message : t.saveFailedMessage,
      });
    }
  }, [syncLocalModelStores, refreshLocalModelStatuses, t.saveFailed, t.saveFailedMessage]);

  const chooseLocalModelFile = useCallback(async (id: LocalAiModelId) => {
    const definition = LOCAL_AI_MODEL_DEFINITIONS[id];
    try {
      const [path] = await openFileDialog(false, [
        {name: t.models[id].name, extensions: definition.extensions},
      ]);
      if (!path) return;
      const stat = await getFileStat(path);
      if (!isLocalModelFileSizeValid(id, stat.size)) {
        showToast({
          kind: 'warning',
          title: t.invalidFileTitle,
          message: t.invalidFileSize(formatBytes(definition.minBytes), formatBytes(definition.maxBytes)),
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
      showToast({kind: 'success', title: t.savedTitle, message: t.models[id].name});
    } catch (modelError) {
      showToast({
        kind: 'warning',
        title: t.chooseFailed,
        message: modelError instanceof Error ? modelError.message : t.chooseFailedMessage,
      });
    }
  }, [localModelsSettings, syncLocalModelStores, refreshLocalModelStatuses, t]);

  const openLocalModelDownload = useCallback((id: LocalAiModelId) => {
    void openPath(LOCAL_AI_MODEL_DEFINITIONS[id].downloadUrl);
  }, []);

  return {
    localModelsSettings,
    localModelStatuses,
    loadLocalModelsSettings,
    chooseLocalModelFile,
    openLocalModelDownload,
  };
}
