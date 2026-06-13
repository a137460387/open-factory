import { useEffect, useSyncExternalStore } from 'react';
import { EditorShell } from './components/EditorShell';
import { ToastViewport } from './components/common/Toast';
import { getLanguage, subscribeLanguage } from './i18n/strings';
import { initializeLanguageFromSettings } from './settings/appSettings';
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
