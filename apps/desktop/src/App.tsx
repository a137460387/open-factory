import { logError } from './lib/error-handlers';
import { Suspense, useEffect, useSyncExternalStore } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/i18next-config';
import { EditorShell } from './components/EditorShell';
import { PreviewWindowShell } from './components/PreviewWindow/PreviewWindowShell';
import { ToastViewport } from './components/common/Toast';
import { syncExportPresetsWithWebdav } from './export/export-presets';
import { getLanguage, subscribeLanguage } from './i18n/strings';
import { getWebdavText, putWebdavText, readExportPresetSyncWebdavPassword } from './lib/tauri-bridge';
import {
  initializeLanguageFromSettings,
  readExportPresetSyncSettings,
  readLocalAiModelsSettings,
  saveExportPresetSyncSettings,
} from './settings/appSettings';
import { NativeCancelSmokeRunner } from './smoke/NativeCancelSmokeRunner';
import { NativePreviewSmokeRunner } from './smoke/NativePreviewSmokeRunner';
import { useDemucsSettingsStore } from './store/demucsSettingsStore';
import { usePrivacyDetectionSettingsStore } from './store/privacyDetectionSettingsStore';
import { useWhisperSettingsStore } from './store/whisperSettingsStore';
import { initializeThemeFromSettings } from './theme/useTheme';
import { StartupUpdateChecker } from './updater/StartupUpdateChecker';

export function App() {
  useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  const previewWindowMode =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('previewWindow') === '1';
  useEffect(() => {
    void initializeLanguageFromSettings().catch((error) => {
      console.warn('Unable to initialize interface language', error);
    });
    void initializeThemeFromSettings().catch((error) => {
      console.warn('Unable to initialize interface theme', error);
    });
    void initializeLocalModelStoresFromSettings();
    void runStartupExportPresetSync();
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={null}>
        {previewWindowMode ? <PreviewWindowShell /> : <EditorShell />}
        <ToastViewport />
        {previewWindowMode ? null : <StartupUpdateChecker />}
        {previewWindowMode ? null : <NativePreviewSmokeRunner />}
        {previewWindowMode ? null : <NativeCancelSmokeRunner />}
      </Suspense>
    </I18nextProvider>
  );
}

async function initializeLocalModelStoresFromSettings(): Promise<void> {
  try {
    const settings = await readLocalAiModelsSettings();
    if (settings.whisper?.path) {
      useWhisperSettingsStore.getState().setModelPath(settings.whisper.path);
    }
    if (settings.demucs?.path) {
      useDemucsSettingsStore.getState().setExecutablePath(settings.demucs.path);
    }
    if (settings.yunet?.path) {
      usePrivacyDetectionSettingsStore.getState().setModelPath(settings.yunet.path);
    }
  } catch (error) {
    console.warn('Unable to initialize local model settings', error);
  }
}

async function runStartupExportPresetSync(): Promise<void> {
  try {
    const settings = await readExportPresetSyncSettings();
    if (!settings.enabled || !settings.syncOnStartup || !settings.url) {
      return;
    }
    const password = await readExportPresetSyncWebdavPassword();
    const result = await syncExportPresetsWithWebdav(
      {
        url: settings.url,
        username: settings.username,
        password: password || undefined,
        conflictResolution: settings.conflictMode,
      },
      {
        client: {
          getText: getWebdavText,
          putText: putWebdavText,
        },
      },
    );
    await saveExportPresetSyncSettings({ ...settings, lastSyncedAt: result.syncedAt, lastSyncWarning: undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export preset startup sync failed.';
    console.warn('Unable to sync export presets on startup', error);
    const settings = await readExportPresetSyncSettings().catch(logError('Appx'));
    if (settings) {
      await saveExportPresetSyncSettings({ ...settings, lastSyncWarning: message }).catch(logError('Appx'));
    }
  }
}
