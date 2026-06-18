import { useEffect, useState } from 'react';
import type { SceneColorDifference, TimelineColorAnalysisResult } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';

interface ColorAnalysisDialogProps {
  results: TimelineColorAnalysisResult[];
  jumps: SceneColorDifference[];
  busy: boolean;
  onAnalyze(): void;
  onAlign(referenceClipId: string): void;
  onClose(): void;
}

export function ColorAnalysisDialog({ results, jumps, busy, onAnalyze, onAlign, onClose }: ColorAnalysisDialogProps) {
  const t = zhCN.colorAnalysis;
  const [referenceClipId, setReferenceClipId] = useState(results[0]?.clipId ?? '');
  useEffect(() => {
    if (!results.some((result) => result.clipId === referenceClipId)) {
      setReferenceClipId(results[0]?.clipId ?? '');
    }
  }, [referenceClipId, results]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" data-testid="color-analysis-dialog">
      <div className="grid max-h-[88vh] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] rounded-md border border-line bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <p className="mt-1 text-xs text-slate-500">{t.summary(results.length, jumps.length)}</p>
          </div>
          <button className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-panel" type="button" onClick={onClose}>
            {zhCN.common.close}
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              {t.referenceClip}
              <select
                className="rounded-md border border-line px-2 py-1.5 text-sm font-normal text-ink outline-none focus:border-brand"
                value={referenceClipId}
                disabled={results.length === 0 || busy}
                data-testid="color-analysis-reference-select"
                onChange={(event) => setReferenceClipId(event.target.value)}
              >
                {results.length === 0 ? <option value="">{t.noResults}</option> : null}
                {results.map((result) => (
                  <option key={result.clipId} value={result.clipId}>
                    {result.name ?? result.clipId}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-panel disabled:opacity-50"
                type="button"
                disabled={busy}
                data-testid="color-analysis-run-button"
                onClick={onAnalyze}
              >
                {busy ? t.analyzing : t.analyze}
              </button>
              <button
                className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                type="button"
                disabled={busy || !referenceClipId || results.length < 2}
                data-testid="color-analysis-align-button"
                onClick={() => onAlign(referenceClipId)}
              >
                {t.alignToReference}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border border-line" data-testid="color-analysis-results">
            <table className="min-w-[780px] w-full border-collapse text-xs">
              <thead className="bg-panel text-left text-[11px] uppercase tracking-normal text-slate-500">
                <tr>
                  <th className="border-b border-line px-2 py-2">{t.columns.clip}</th>
                  <th className="border-b border-line px-2 py-2">{t.columns.brightness}</th>
                  <th className="border-b border-line px-2 py-2">{t.columns.temperature}</th>
                  <th className="border-b border-line px-2 py-2">{t.columns.saturation}</th>
                  <th className="border-b border-line px-2 py-2">{t.columns.contrast}</th>
                  <th className="border-b border-line px-2 py-2">{t.columns.tint}</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-center text-slate-500" colSpan={6}>{t.noResults}</td>
                  </tr>
                ) : (
                  results.map((result) => (
                    <tr key={result.clipId} className="border-b border-line last:border-b-0" data-testid="color-analysis-result-row">
                      <td className="max-w-[220px] truncate px-2 py-2 font-semibold text-ink">{result.name ?? result.clipId}</td>
                      <td className="px-2 py-2 tabular-nums text-slate-700">{formatMetric(result.metrics.averageBrightness, 1)}</td>
                      <td className="px-2 py-2 tabular-nums text-slate-700">{Math.round(result.metrics.colorTemperatureKelvin)}K</td>
                      <td className="px-2 py-2 tabular-nums text-slate-700">{formatMetric(result.metrics.averageSaturation, 2)}</td>
                      <td className="px-2 py-2 tabular-nums text-slate-700">{formatMetric(result.metrics.contrast, 1)}</td>
                      <td className="px-2 py-2 text-slate-700">{t.tintBias[result.metrics.tintBias]}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {jumps.length > 0 ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" data-testid="color-analysis-jump-list">
              <div className="mb-2 font-semibold">{t.jumpListTitle}</div>
              <div className="space-y-1">
                {jumps.map((jump) => (
                  <div key={`${jump.fromClipId}-${jump.toClipId}`} data-testid="color-analysis-jump-row">
                    {t.jumpLabel(jump.fromClipId, jump.toClipId, jump.score)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end border-t border-line p-4">
          <button className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-panel" type="button" onClick={onClose}>
            {zhCN.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMetric(value: number, fractionDigits: number): string {
  return value.toFixed(fractionDigits);
}
