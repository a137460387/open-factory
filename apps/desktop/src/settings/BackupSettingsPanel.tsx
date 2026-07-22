import { FolderOpen } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import { formatBackupDisplayTime } from '../backup/projectBackup';
import type { BackupSettings } from './appSettings';

export function BackupSettingsPanel({
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
