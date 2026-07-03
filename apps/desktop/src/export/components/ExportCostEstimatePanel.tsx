import type { ExportCostHistorySample } from '@open-factory/editor-core';
import type { ExportCostCpuLoad } from '@open-factory/editor-core';
import { calculateEstimateConfidence, buildEstimateHistoryComparison, estimateExportCost } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export function ExportCostEstimatePanel({ estimate, historyErrorPercent, historySamples }: { estimate: ReturnType<typeof estimateExportCost>; historyErrorPercent?: number; historySamples?: ExportCostHistorySample[] }) {
  const t = zhCN.exportDialog.costEstimate;
  const confidence = calculateEstimateConfidence(historySamples?.length ?? 0);
  const comparisonEntries = buildEstimateHistoryComparison(historySamples ?? []);
  const confidenceLabel = t.confidenceLevels[confidence.level];
  return (
    <section className="rounded-md border border-line bg-panel/60 p-3 text-xs text-slate-600" data-testid="export-cost-estimate-panel">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-800">{t.title}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">{t.description}</div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${confidence.level === 'high' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : confidence.level === 'medium' ? 'border-sky-200 bg-sky-50 text-sky-700' : confidence.level === 'low' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
            data-testid="export-cost-confidence"
            title={t.confidenceTooltip(confidence.sampleCount)}
          >
            {t.confidence}: {confidenceLabel}
          </span>
          <div className="rounded-full bg-white px-2 py-1 font-semibold text-slate-700" data-testid="export-cost-complexity">
            {t.complexityValue(estimate.complexityFactor)}
          </div>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        <CostMetric label={t.duration} value={formatCostDuration(estimate.estimatedDurationSeconds)} testId="export-cost-duration" />
        <CostMetric label={t.diskUsage} value={t.sizeValue(estimate.estimatedFileSizeMb)} testId="export-cost-size" />
        <CostMetric label={t.cpuLoad} value={formatCostCpuLoad(estimate.cpuLoad)} testId="export-cost-cpu" tone={estimate.cpuLoad === 'heavy' ? 'bad' : estimate.cpuLoad === 'medium' ? 'warn' : 'ok'} />
        <CostMetric label={t.completion} value={formatCostCompletion(estimate.estimatedCompletionIso)} testId="export-cost-completion" />
        <CostMetric label={t.historyError} value={formatCostHistoryError(historyErrorPercent)} testId="export-cost-history-error" />
      </div>
      {comparisonEntries.length > 0 ? (
        <div className="mt-3 rounded-md border border-line bg-white p-2" data-testid="export-cost-history-comparison">
          <div className="mb-1 text-[11px] font-semibold text-slate-700">{t.historyComparison}</div>
          <div className="grid gap-1">
            {comparisonEntries.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 text-[11px]" data-testid="export-cost-history-entry">
                <span className="w-12 text-right tabular-nums text-slate-500">{t.durationSeconds(Math.round(entry.estimatedSeconds))}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(5, (entry.actualSeconds / Math.max(entry.estimatedSeconds, entry.actualSeconds)) * 100))}%`,
                      backgroundColor: entry.errorPercent > 10 ? '#f59e0b' : '#10b981'
                    }}
                  />
                </div>
                <span className="w-12 tabular-nums text-slate-600">{t.durationSeconds(Math.round(entry.actualSeconds))}</span>
                <span className={`w-14 text-right tabular-nums ${entry.errorPercent > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {entry.errorPercent > 0 ? '+' : ''}{entry.errorPercent.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CostMetric({ label, value, testId, tone }: { label: string; value: string; testId: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const toneClass = tone === 'bad' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : tone === 'ok' ? 'text-emerald-700' : 'text-slate-800';
  return (
    <div className="rounded-md bg-white px-2 py-2" data-testid={testId}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function formatCostDuration(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return zhCN.common.unavailable;
  }
  if (value < 60) {
    return zhCN.exportDialog.costEstimate.durationSeconds(Math.max(1, Math.round(value)));
  }
  return zhCN.exportDialog.costEstimate.durationMinutes(Math.floor(value / 60), Math.round(value % 60));
}

function formatCostCompletion(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return zhCN.common.unavailable;
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatCostCpuLoad(value: ExportCostCpuLoad): string {
  return zhCN.exportDialog.costEstimate.cpuLoadValues[value];
}

function formatCostHistoryError(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? zhCN.exportDialog.costEstimate.historyErrorValue(value) : zhCN.exportDialog.costEstimate.historyUnavailable;
}
