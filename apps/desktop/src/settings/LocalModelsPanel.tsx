import { Download, FolderOpen } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import { formatBytes, formatDateTime } from './formatHelpers';
import {
  LOCAL_AI_MODEL_DEFINITIONS,
  LOCAL_AI_MODEL_IDS,
  type LocalAiModelId,
  type LocalAiModelResolvedStatus,
  type LocalAiModelsSettings,
} from './localModels';

function ModelInfo({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-md bg-white/80 p-2">
      <div className="text-[11px] uppercase tracking-normal text-slate-500">{label}</div>
      <div className={`mt-0.5 truncate font-medium text-slate-700 ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function localModelStatusClass(status: LocalAiModelResolvedStatus['status']): string {
  if (status === 'installed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'invalid') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function formatOptionalIsoDateTime(value: string | undefined): string {
  if (!value) {
    return zhCN.common.unavailable;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? formatDateTime(timestamp) : zhCN.common.unavailable;
}

export function LocalModelsSettingsPanel({
  settings,
  statuses,
  onChoose,
  onDownload,
}: {
  settings: LocalAiModelsSettings;
  statuses: Partial<Record<LocalAiModelId, LocalAiModelResolvedStatus>>;
  onChoose(id: LocalAiModelId): void;
  onDownload(id: LocalAiModelId): void;
}) {
  const t = zhCN.settings.localModels;
  return (
    <div className="space-y-4" data-testid="local-models-panel">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
        <p className="text-xs text-slate-500">{t.description}</p>
      </div>
      <div className="grid gap-3">
        {LOCAL_AI_MODEL_IDS.map((id) => {
          const definition = LOCAL_AI_MODEL_DEFINITIONS[id];
          const modelText = t.models[id];
          const config = settings[id];
          const status = statuses[id] ?? { id, status: 'missing' as const, reason: 'not-configured' as const };
          const path = config?.path ?? status.path ?? '';
          return (
            <div
              key={id}
              className="rounded-md border border-line bg-panel p-3"
              data-testid={`local-model-row-${id}`}
              data-status={status.status}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs font-semibold text-slate-800">{modelText.name}</h4>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${localModelStatusClass(status.status)}`}
                      data-testid={`local-model-status-${id}`}
                    >
                      {t.status[status.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{modelText.description}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-white/80"
                    type="button"
                    title={t.download}
                    aria-label={t.download}
                    data-testid={`local-model-download-${id}`}
                    onClick={() => onDownload(id)}
                  >
                    <Download size={14} />
                  </button>
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-white/80"
                    type="button"
                    title={t.chooseFile}
                    aria-label={t.chooseFile}
                    data-testid={`local-model-choose-${id}`}
                    onClick={() => onChoose(id)}
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <ModelInfo label={t.version} value={config?.version ?? definition.version} />
                <ModelInfo
                  label={t.fileSize}
                  value={status.size !== undefined ? formatBytes(status.size) : zhCN.common.unavailable}
                />
                <ModelInfo label={t.storagePath} value={path || t.notConfigured} mono />
                <ModelInfo label={t.lastUsedAt} value={formatOptionalIsoDateTime(config?.lastUsedAt)} />
              </div>
              {status.status === 'invalid' ? (
                <div className="mt-2 text-xs font-medium text-rose-700">{t.invalidStatus}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
