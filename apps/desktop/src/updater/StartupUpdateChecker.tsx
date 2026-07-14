import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import { checkAppUpdate, getAppVersion, relaunchApp } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { readUpdateSettings } from '../settings/appSettings';
import { checkForAvailableUpdate, type AppUpdateNotice } from './update-check';

export function StartupUpdateChecker() {
  const t = zhCN.updater;
  const [notice, setNotice] = useState<AppUpdateNotice>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let canceled = false;
    const fetchJson = async (url: string): Promise<unknown> => {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`Update endpoint returned ${response.status}`);
      }
      return response.json();
    };
    void (async () => {
      try {
        const settings = await readUpdateSettings();
        const currentVersion = await getAppVersion();
        const nextNotice = await checkForAvailableUpdate(settings, currentVersion, {
          checkNativeUpdate: () => checkAppUpdate({ timeout: 8000 }),
          fetchJson,
          installNativeUpdate: async (update) => {
            await update.downloadAndInstall();
            await relaunchApp();
          },
        });
        if (!nextNotice || canceled) {
          return;
        }
        setNotice(nextNotice);
        showToast({
          kind: 'info',
          title: t.toastTitle(nextNotice.version),
          message: t.toastMessage,
          action: {
            label: t.viewReleaseNotes,
            onClick: () => setDialogOpen(true),
          },
        });
      } catch {
        // Startup update checks must never block local editing.
      }
    })();
    return () => {
      canceled = true;
    };
  }, [t]);

  if (!notice || !dialogOpen) {
    return null;
  }

  async function installUpdate() {
    if (!notice?.install) {
      return;
    }
    try {
      setInstalling(true);
      await notice.install();
    } catch (error) {
      setInstalling(false);
      showToast({
        kind: 'warning',
        title: t.installFailed,
        message: error instanceof Error ? error.message : t.installFailedMessage,
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="update-dialog"
    >
      <div className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.dialogTitle(notice.version)}</h2>
            <div className="text-xs text-slate-500">
              {notice.source === 'tauri-updater' ? t.sourceNative : t.sourceEndpoint}
            </div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel"
            type="button"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            onClick={() => setDialogOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-ink">{t.releaseNotes}</h3>
          <div
            className="mt-2 whitespace-pre-wrap rounded-md border border-line bg-panel p-3 text-sm leading-6 text-slate-700"
            data-testid="update-release-notes"
          >
            {notice.releaseNotes || t.noReleaseNotes}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button
            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-panel"
            type="button"
            onClick={() => setDialogOpen(false)}
          >
            {zhCN.common.close}
          </button>
          {notice.install ? (
            <button
              className="inline-flex items-center gap-1 rounded-md border border-brand bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              data-testid="update-install-button"
              disabled={installing}
              onClick={() => void installUpdate()}
            >
              <Download size={15} />
              <span>{installing ? t.installing : t.installAndRestart}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
