import { useEffect } from 'react';
import { zhCN } from '../i18n/strings';
import { chooseUnsavedCloseActionForWindow, forceCloseWindow } from '../lib/projectFiles';
import { isTauriRuntime } from '../lib/tauri';
import { listenBridge } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { useEditorStore } from '../store/editorStore';

export function useCloseGuard(saveProject: () => Promise<void>): void {
  const dirty = useEditorStore((state) => state.dirty);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return undefined;
    }
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenBridge('close-requested', async () => {
      if (!dirty) {
        await forceCloseWindow();
        return;
      }
      const choice = await chooseUnsavedCloseActionForWindow();
      if (choice === 'save') {
        try {
          await saveProject();
          await forceCloseWindow();
        } catch (error) {
          showToast({
            kind: 'error',
            title: zhCN.editorToasts.saveFailed,
            message: error instanceof Error ? error.message : zhCN.editorToasts.saveFailedMessage,
          });
        }
        return;
      }
      if (choice === 'discard') {
        await forceCloseWindow();
      }
    }).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlisten = dispose;
      }
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [dirty, saveProject]);
}
