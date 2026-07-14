import type { ExportOptimizationSuggestion } from '@open-factory/editor-core';
import type { ExportWarmupStepId } from '../export-warmup';
import { Loader2 } from 'lucide-react';
import { zhCN } from '../../i18n/strings';

export type ExportWarmupUiStatus = { status: 'running' | 'complete' | 'cached'; step?: ExportWarmupStepId };

export function ExportOptimizationPanel({
  suggestions,
  onApply,
  onDismiss,
}: {
  suggestions: ExportOptimizationSuggestion[];
  onApply(suggestion: ExportOptimizationSuggestion): void;
  onDismiss(suggestion: ExportOptimizationSuggestion): void;
}) {
  const t = zhCN.exportDialog.optimization;
  return (
    <section className="rounded-md border border-line bg-white p-3 text-xs" data-testid="export-optimization-panel">
      <div className="mb-2 flex items-start justify-between gap-3" data-testid="export-optimization-tab">
        <div>
          <div className="font-semibold text-slate-800">{t.title}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">{t.description}</div>
        </div>
        <span
          className="rounded-full bg-panel px-2 py-1 text-[11px] font-semibold text-slate-600"
          data-testid="export-optimization-count"
        >
          {suggestions.length}
        </span>
      </div>
      {suggestions.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-line bg-panel/50 px-3 py-3 text-center text-slate-500"
          data-testid="export-optimization-empty"
        >
          {t.empty}
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map((suggestion) => (
            <article
              key={suggestion.id}
              className={`rounded-md border p-3 ${suggestion.severity === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}
              data-testid={`export-optimization-suggestion-${suggestion.id}`}
              data-suggestion-id={suggestion.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800">{formatOptimizationSuggestionTitle(suggestion)}</div>
                  <div className="mt-1 text-slate-600">{formatOptimizationSuggestionMessage(suggestion)}</div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    className="rounded-md bg-brand px-2 py-1.5 font-semibold text-white hover:bg-[#176858]"
                    type="button"
                    data-testid={`apply-export-suggestion-${suggestion.id}`}
                    onClick={() => onApply(suggestion)}
                  >
                    {t.apply}
                  </button>
                  <button
                    className="rounded-md border border-line bg-white px-2 py-1.5 font-medium text-slate-700 hover:bg-panel"
                    type="button"
                    data-testid={`dismiss-export-suggestion-${suggestion.id}`}
                    onClick={() => onDismiss(suggestion)}
                  >
                    {t.dismiss}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function formatOptimizationSuggestionTitle(suggestion: ExportOptimizationSuggestion): string {
  return zhCN.exportDialog.optimization.suggestions[suggestion.id].title;
}

function formatOptimizationSuggestionMessage(suggestion: ExportOptimizationSuggestion): string {
  const messages = zhCN.exportDialog.optimization.suggestions;
  if (suggestion.id === 'proxy-for-4k-downscale') {
    return messages[suggestion.id].message(Math.max(1, suggestion.mediaIds.length));
  }
  if (suggestion.id === 'unify-frame-rate') {
    return messages[suggestion.id].message(suggestion.value ?? 0, suggestion.targetValue ?? 0);
  }
  if (suggestion.id === 'normalize-loudness') {
    return messages[suggestion.id].message(suggestion.value ?? 0);
  }
  if (suggestion.id === 'convert-vfr-to-cfr') {
    return messages[suggestion.id].message(Math.max(1, suggestion.mediaIds.length));
  }
  return messages[suggestion.id].message((suggestion.value ?? 0) / 60);
}

export function ExportWarmupStatusPanel({ status }: { status: ExportWarmupUiStatus }) {
  const t = zhCN.exportDialog.warmup;
  const label = status.step ? t.steps[status.step] : undefined;
  const message =
    status.status === 'running' ? t.running(label ?? '') : status.status === 'cached' ? t.cached : t.complete;
  return (
    <section
      className="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900"
      data-testid="export-warmup-status"
      data-status={status.status}
      data-step={status.step ?? ''}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{t.title}</div>
          <div className="mt-1">{message}</div>
        </div>
        {status.status === 'running' ? <Loader2 className="shrink-0 animate-spin" size={16} /> : null}
      </div>
      {status.status === 'running' ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-sky-500" />
        </div>
      ) : null}
    </section>
  );
}
