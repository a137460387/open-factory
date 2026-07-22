import { Cloud } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import { formatBackupDisplayTime } from '../backup/projectBackup';
import type { ExportPresetSyncSettings } from './appSettings';

export function ExportPresetSyncSettingsPanel({
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
