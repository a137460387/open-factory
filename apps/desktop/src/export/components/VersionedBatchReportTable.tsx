import type { VersionedExportReportRow } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { formatBytes, formatMilliseconds } from '../lib/exportFormatHelpers';
import { formatDuration } from '../lib/pipelineHelpers';

export function VersionedBatchReportTable({ rows }: { rows: VersionedExportReportRow[] }) {
  const t = zhCN.exportDialog.versionBatch.report;
  return (
    <div className="overflow-hidden rounded-md border border-line" data-testid="export-version-report">
      <div className="border-b border-line bg-panel px-3 py-2 text-xs font-semibold text-slate-700">{t.title}</div>
      <table className="w-full border-collapse text-xs">
        <thead className="bg-panel/60 text-slate-600">
          <tr>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.version}</th>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.platform}</th>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.resolution}</th>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.fileSize}</th>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.duration}</th>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.elapsed}</th>
            <th className="px-2 py-2 text-left font-semibold">{t.columns.status}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.batchId}-${row.versionId}`}
              className="border-t border-line"
              data-testid="export-version-report-row"
              data-version-id={row.versionId}
            >
              <td className="px-2 py-2 font-medium text-slate-800">{row.versionName}</td>
              <td className="px-2 py-2 text-slate-600">
                {[row.platform, row.language].filter(Boolean).join(' / ') || zhCN.common.auto}
              </td>
              <td className="px-2 py-2 tabular-nums text-slate-600">
                {row.width && row.height ? `${row.width} x ${row.height}` : zhCN.common.auto}
              </td>
              <td className="px-2 py-2 tabular-nums text-slate-600" data-testid="export-version-report-size">
                {formatBytes(row.fileSizeBytes ?? undefined)}
              </td>
              <td className="px-2 py-2 tabular-nums text-slate-600">
                {row.durationSeconds === null ? zhCN.common.auto : formatDuration(row.durationSeconds)}
              </td>
              <td className="px-2 py-2 tabular-nums text-slate-600" data-testid="export-version-report-elapsed">
                {formatMilliseconds(row.elapsedMs ?? undefined)}
              </td>
              <td className="px-2 py-2 text-slate-600">{zhCN.exportDialog.status[row.status] ?? row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
