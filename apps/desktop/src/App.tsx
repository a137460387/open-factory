import { useEffect, useSyncExternalStore } from 'react';
import { EditorShell } from './components/EditorShell';
import { ToastViewport } from './components/common/Toast';
import { syncExportPresetsWithWebdav } from './export/export-presets';
import { getLanguage, subscribeLanguage } from './i18n/strings';
import { getWebdavText, putWebdavText, readExportPresetSyncWebdavPassword } from './lib/tauri-bridge';
import { initializeLanguageFromSettings, readExportPresetSyncSettings, saveExportPresetSyncSettings } from './settings/appSettings';
import { NativeCancelSmokeRunner } from './smoke/NativeCancelSmokeRunner';
import { NativePreviewSmokeRunner } from './smoke/NativePreviewSmokeRunner';
import { initializeThemeFromSettings } from './theme/useTheme';

export function App() {
  useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  useEffect(() => {
    void initializeLanguageFromSettings().catch((error) => {
      console.warn('Unable to initialize interface language', error);
    });
    void initializeThemeFromSettings().catch((error) => {
      console.warn('Unable to initialize interface theme', error);
    });
    void runStartupExportPresetSync();
  }, []);

  return (
    <>
      <EditorShell />
      <ToastViewport />
      <NativePreviewSmokeRunner />
      <NativeCancelSmokeRunner />
    </>
  );
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
        conflictResolution: settings.conflictMode
      },
      {
        client: {
          getText: getWebdavText,
          putText: putWebdavText
        }
      }
    );
    await saveExportPresetSyncSettings({ ...settings, lastSyncedAt: result.syncedAt, lastSyncWarning: undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export preset startup sync failed.';
    console.warn('Unable to sync export presets on startup', error);
    const settings = await readExportPresetSyncSettings().catch(() => undefined);
    if (settings) {
      await saveExportPresetSyncSettings({ ...settings, lastSyncWarning: message }).catch(() => undefined);
    }
  }
}
