import { assessQualityMetric } from '@open-factory/editor-core';
import type { QualityEvaluationResult } from '../../lib/tauri-bridge';
import { formatQualityMetricValue, qualityLevelClass } from '../lib/exportFormatHelpers';
import { zhCN } from '../../i18n/strings';

export function QualityResultPanel({
  result,
  running,
  progress,
  error,
  onCancel
}: {
  result?: QualityEvaluationResult;
  running: boolean;
  progress: number;
  error?: string;
  onCancel(): void;
}) {
  const t = zhCN.exportDialog.quality;
  return (
    <div className="border-t border-line p-3 text-xs" data-testid="quality-result-panel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-semibold text-slate-800">{t.title}</div>
        {running ? (
          <button className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 font-medium text-rose-800 hover:bg-rose-100" type="button" data-testid="quality-cancel-button" onClick={onCancel}>
            {t.cancel}
          </button>
        ) : null}
      </div>
      {running ? (
        <div className="mb-2 flex items-center gap-2" data-testid="quality-progress">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
          <div className="w-20 text-right tabular-nums text-slate-500">{t.running(progress)}</div>
        </div>
      ) : null}
      {error ? <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-rose-700">{error}</div> : null}
      {result ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <QualityMetricCell metric="ssim" value={result.ssim} />
          <QualityMetricCell metric="psnr" value={result.psnr} suffix=" dB" />
          <QualityMetricCell metric="vmaf" value={result.vmafAvailable ? result.vmaf : undefined} />
        </div>
      ) : !running && !error ? (
        <div className="text-slate-500">{t.noResult}</div>
      ) : null}
    </div>
  );
}

function QualityMetricCell({ metric, value, suffix = '' }: { metric: 'ssim' | 'psnr' | 'vmaf'; value?: number; suffix?: string }) {
  const t = zhCN.exportDialog.quality;
  const level = assessQualityMetric(metric, value);
  return (
    <div className="rounded-md bg-panel p-2" data-testid={`quality-result-${metric}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-slate-700">{t.labels[metric]}</div>
        {level ? <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${qualityLevelClass(level)}`}>{t.levels[level]}</span> : null}
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums text-slate-900">{formatQualityMetricValue(value, suffix)}</div>
      <div className="mt-1 text-[11px] leading-4 text-slate-500">{t.descriptions[metric]}</div>
    </div>
  );
}
