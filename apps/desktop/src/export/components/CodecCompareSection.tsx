import type { ExportTaskStatus } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { showToast } from '../../lib/toast';
import type { ExportPreset } from '../export-presets';
import { formatBytes, formatMilliseconds, formatOptionalNumber } from '../lib/exportFormatHelpers';
import {
  MAX_CODEC_COMPARE_PRESETS,
  type CodecCompareRecommendationMode,
  type CodecCompareResult,
  type CodecCompareSortDirection,
  type CodecCompareSortKey,
} from '../codec-compare';

export function CodecCompareSection({
  presets,
  codecComparePresetIds,
  codecCompareRecommendationMode,
  setCodecCompareRecommendationMode,
  codecCompareRecommendation,
  codecCompareEvaluatingTaskId,
  codecCompareResults,
  sortedCodecCompareResults,
  codecCompareSort,
  toggleCodecComparePreset,
  toggleCodecCompareSort,
  setPresetId,
}: {
  presets: ExportPreset[];
  codecComparePresetIds: string[];
  codecCompareRecommendationMode: CodecCompareRecommendationMode;
  setCodecCompareRecommendationMode: (mode: CodecCompareRecommendationMode) => void;
  codecCompareRecommendation: { presetId: string; presetName: string; taskId: string } | null;
  codecCompareEvaluatingTaskId: string | null;
  codecCompareResults: CodecCompareResult[];
  sortedCodecCompareResults: CodecCompareResult[];
  codecCompareSort: { key: CodecCompareSortKey; direction: CodecCompareSortDirection };
  toggleCodecComparePreset: (presetId: string, checked: boolean) => void;
  toggleCodecCompareSort: (key: CodecCompareSortKey) => void;
  setPresetId: (id: string) => void;
}) {
  const t = zhCN.exportDialog;
  return (
    <div
      className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3"
      data-testid="export-codec-compare-tab"
    >
      <label className="pt-1 text-xs font-medium text-slate-600">{t.codecCompare.title}</label>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">{t.codecCompare.description(MAX_CODEC_COMPARE_PRESETS)}</p>
        <div className="grid gap-2 md:grid-cols-2" data-testid="export-codec-compare-preset-list">
          {presets.map((preset) => {
            const checked = codecComparePresetIds.includes(preset.id);
            const disabled = !checked && codecComparePresetIds.length >= MAX_CODEC_COMPARE_PRESETS;
            return (
              <label
                key={preset.id}
                className={`flex items-start gap-2 rounded-md border border-line p-2 text-xs ${disabled ? 'opacity-50' : ''}`}
                data-testid="export-codec-compare-preset-row"
              >
                <input
                  className="mt-0.5 h-4 w-4 accent-brand"
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) => toggleCodecComparePreset(preset.id, event.target.checked)}
                  data-testid={`export-codec-compare-preset-${preset.id}`}
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-700">{preset.name}</span>
                  <span className="block text-[11px] text-slate-500">
                    {preset.settings.videoCodec ?? zhCN.common.auto} ·{' '}
                    {preset.settings.videoBitrate ?? zhCN.common.auto} · {preset.settings.format ?? 'mp4'}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {codecComparePresetIds.length < 2 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            {t.codecCompare.selectAtLeastTwo}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-2 font-medium text-slate-600">
            <span>{t.codecCompare.recommendationMode}</span>
            <select
              className="rounded-md border border-line px-2 py-1.5"
              value={codecCompareRecommendationMode}
              onChange={(event) =>
                setCodecCompareRecommendationMode(event.target.value as CodecCompareRecommendationMode)
              }
              data-testid="export-codec-compare-recommendation-mode"
            >
              <option value="quality">{t.codecCompare.recommendationModes.quality}</option>
              <option value="size">{t.codecCompare.recommendationModes.size}</option>
            </select>
          </label>
          <button
            className="rounded-md border border-line px-2 py-1.5 font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!codecCompareRecommendation}
            data-testid="export-codec-compare-recommend-button"
            onClick={() => {
              if (codecCompareRecommendation) {
                setPresetId(codecCompareRecommendation.presetId);
                showToast({
                  kind: 'info',
                  title: t.codecCompare.recommendedTitle,
                  message: codecCompareRecommendation.presetName,
                });
              }
            }}
          >
            {codecCompareRecommendation
              ? t.codecCompare.chooseRecommended(codecCompareRecommendation.presetName)
              : t.codecCompare.chooseBest}
          </button>
          {codecCompareEvaluatingTaskId ? (
            <span className="text-slate-500" data-testid="export-codec-compare-quality-running">
              {t.codecCompare.evaluating}
            </span>
          ) : null}
        </div>
        {codecCompareResults.length > 0 ? (
          <div
            className="overflow-hidden rounded-md border border-line"
            data-testid="export-codec-compare-results"
          >
            <table className="w-full border-collapse text-xs">
              <thead className="bg-panel text-slate-600">
                <tr>
                  {(['presetName', 'fileSizeBytes', 'durationMs', 'ssim', 'psnr'] as CodecCompareSortKey[]).map(
                    (key) => (
                      <th key={key} className="px-2 py-2 text-left font-semibold">
                        <button
                          className="inline-flex items-center gap-1 hover:text-ink"
                          type="button"
                          data-testid={`export-codec-compare-sort-${key}`}
                          onClick={() => toggleCodecCompareSort(key)}
                        >
                          {t.codecCompare.columns[key]}
                          {codecCompareSort.key === key ? (
                            <span>{codecCompareSort.direction === 'asc' ? '\u2191' : '\u2193'}</span>
                          ) : null}
                        </button>
                      </th>
                    ),
                  )}
                  <th className="px-2 py-2 text-left font-semibold">{t.codecCompare.columns.status}</th>
                </tr>
              </thead>
              <tbody>
                {sortedCodecCompareResults.map((result) => (
                  <tr
                    key={`${result.presetId}-${result.outputPath}`}
                    className={
                      codecCompareRecommendation?.taskId === result.taskId ? 'bg-emerald-50' : undefined
                    }
                    data-testid="export-codec-compare-result-row"
                    data-preset-id={result.presetId}
                  >
                    <td className="px-2 py-2 font-medium text-slate-800">{result.presetName}</td>
                    <td className="px-2 py-2 tabular-nums text-slate-600">
                      {formatBytes(result.fileSizeBytes)}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-slate-600">
                      {formatMilliseconds(result.durationMs)}
                    </td>
                    <td
                      className="px-2 py-2 tabular-nums text-slate-600"
                      data-testid="export-codec-compare-ssim"
                    >
                      {formatOptionalNumber(result.ssim, 3)}
                    </td>
                    <td
                      className="px-2 py-2 tabular-nums text-slate-600"
                      data-testid="export-codec-compare-psnr"
                    >
                      {formatOptionalNumber(result.psnr, 1)}
                    </td>
                    <td className="px-2 py-2 text-slate-600">
                      {result.qualityStatus === 'running'
                        ? t.codecCompare.evaluating
                        : result.qualityStatus === 'error'
                          ? (result.qualityError ?? t.quality.failedMessage)
                          : (t.status[result.status as ExportTaskStatus] ?? result.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
