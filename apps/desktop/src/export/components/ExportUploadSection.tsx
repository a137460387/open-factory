import type { ExportUploadState, ExportUploadTargetType } from '@open-factory/editor-core';
import type { ExportUploadSettings } from '../../settings/appSettings';
import { FolderOpen } from 'lucide-react';
import { uploadStatusClass } from '../lib/exportFormatHelpers';
import { zhCN } from '../../i18n/strings';

export function ExportUploadSection({
  settings,
  password,
  onSettingsChange,
  onPasswordChange,
  onChooseDirectory
}: {
  settings: ExportUploadSettings;
  password: string;
  onSettingsChange(settings: ExportUploadSettings): void;
  onPasswordChange(password: string): void;
  onChooseDirectory(): void;
}) {
  const t = zhCN.exportDialog.upload;
  const updateWebdav = (patch: Partial<ExportUploadSettings['webdav']>) => onSettingsChange({ ...settings, webdav: { ...settings.webdav, ...patch } });
  const updateLocal = (patch: Partial<ExportUploadSettings['local']>) => onSettingsChange({ ...settings, local: { ...settings.local, ...patch } });

  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3" data-testid="export-upload-section">
      <label className="pt-1 text-xs font-medium text-slate-600">{t.title}</label>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-xs text-slate-500">{t.description}</div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              className="h-4 w-4 accent-brand"
              type="checkbox"
              checked={settings.enabled}
              data-testid="export-upload-enabled"
              onChange={(event) => onSettingsChange({ ...settings, enabled: event.target.checked })}
            />
            <span>{t.enabled}</span>
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-[180px_1fr]">
          <label className="block text-xs font-medium text-slate-600">
            {t.targetType}
            <select
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
              value={settings.targetType}
              data-testid="export-upload-target-select"
              onChange={(event) => onSettingsChange({ ...settings, targetType: event.target.value as ExportUploadTargetType })}
            >
              <option value="webdav">{t.targets.webdav}</option>
              <option value="local">{t.targets.local}</option>
            </select>
          </label>
          {settings.targetType === 'webdav' ? (
            <div className="grid gap-2 md:grid-cols-2">
              <label className="block text-xs font-medium text-slate-600 md:col-span-2">
                {t.webdavUrl}
                <input
                  className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
                  value={settings.webdav.url ?? ''}
                  data-testid="export-upload-webdav-url"
                  onChange={(event) => updateWebdav({ url: event.target.value })}
                />
                <span className="mt-1 block text-[11px] font-normal text-amber-700" data-testid="export-upload-webdav-https-warning">
                  {t.httpsRequiredNote}
                </span>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t.username}
                <input
                  className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
                  value={settings.webdav.username ?? ''}
                  data-testid="export-upload-webdav-username"
                  onChange={(event) => updateWebdav({ username: event.target.value })}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t.password}
                <input
                  className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
                  type="password"
                  value={password}
                  data-testid="export-upload-webdav-password"
                  onChange={(event) => onPasswordChange(event.target.value)}
                />
              </label>
              <div className="text-[11px] text-slate-500 md:col-span-2">{t.passwordStorageNote}</div>
            </div>
          ) : (
            <label className="block text-xs font-medium text-slate-600">
              {t.localDirectory}
              <div className="mt-1 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-xs"
                  value={settings.local.directory ?? ''}
                  data-testid="export-upload-local-directory"
                  onChange={(event) => updateLocal({ directory: event.target.value })}
                />
                <button
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
                  type="button"
                  title={t.chooseDirectory}
                  aria-label={t.chooseDirectory}
                  data-testid="export-upload-local-choose"
                  onClick={onChooseDirectory}
                >
                  <FolderOpen size={14} />
                </button>
              </div>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

export function ExportUploadStatusPanel({ upload, onRetry }: { upload: ExportUploadState; onRetry?: () => void }) {
  const t = zhCN.exportDialog.upload;
  const progress = Math.round(upload.progress * 100);
  return (
    <div className={`mt-2 rounded-md border p-2 text-[11px] ${uploadStatusClass(upload.status)}`} data-testid="export-upload-status" data-status={upload.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">
          {t.statusLabel}: {t.status[upload.status]}
        </div>
        <div className="tabular-nums" data-testid="export-upload-progress">
          {progress}%
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className="h-full bg-current transition-all" style={{ width: `${progress}%` }} />
      </div>
      {upload.destination ? (
        <div className="mt-1 truncate font-mono" title={upload.destination} data-testid="export-upload-destination">
          {upload.destination}
        </div>
      ) : null}
      {upload.error ? <div className="mt-1 whitespace-pre-wrap text-rose-800" data-testid="export-upload-error">{upload.error}</div> : null}
      {onRetry ? (
        <button className="mt-2 rounded-md border border-line bg-white px-2 py-1 font-medium text-slate-700 hover:bg-panel" type="button" data-testid="export-upload-retry-button" onClick={onRetry}>
          {t.retry}
        </button>
      ) : null}
    </div>
  );
}
