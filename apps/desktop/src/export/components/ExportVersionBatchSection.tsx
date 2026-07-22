import { Download, ListPlus, Trash2, Upload } from 'lucide-react';
import type { ExportPresetSettings } from '../export-presets';
import type { ExportPreset } from '../export-presets';
import type { VersionedExportReportRow, VersionedExportDefinition } from '@open-factory/editor-core';
import { createVersionedExportJobs } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { VersionedBatchReportTable } from './VersionedBatchReportTable';

export type VersionWatermarkMode = 'inherit' | 'none' | 'text';
export type VersionRangeMode = 'default' | 'custom';

export interface VersionedExportRowState {
  id: string;
  enabled: boolean;
  name: string;
  presetId: string;
  platform: string;
  language: string;
  rangeMode: VersionRangeMode;
  rangeStart: number;
  rangeDuration: number;
  width: number;
  height: number;
  watermarkMode: VersionWatermarkMode;
}

export function ExportVersionBatchSection({
  versionedBatchTemplate,
  setVersionedBatchTemplate,
  exportVersionedBatchTemplate,
  importVersionedBatchTemplate,
  versionedBatchRows,
  updateVersionedBatchRow,
  removeVersionedBatchRow,
  addVersionedBatchRow,
  presets,
  exportSettings,
  buildVersionSettings,
  versionedBatchReportRows,
}: {
  versionedBatchTemplate: string;
  setVersionedBatchTemplate: (v: string) => void;
  exportVersionedBatchTemplate: () => void;
  importVersionedBatchTemplate: () => void;
  versionedBatchRows: VersionedExportRowState[];
  updateVersionedBatchRow: (rowId: string, patch: Partial<VersionedExportRowState>) => void;
  removeVersionedBatchRow: (rowId: string) => void;
  addVersionedBatchRow: () => void;
  presets: ExportPreset[];
  exportSettings: ExportPresetSettings;
  buildVersionSettings: (row: VersionedExportRowState) => ExportPresetSettings;
  versionedBatchReportRows: VersionedExportReportRow[];
}) {
  const t = zhCN.exportDialog.versionBatch;
  return (
    <div
      className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3"
      data-testid="export-version-batch-tab"
    >
      <label className="pt-1 text-xs font-medium text-slate-600">{t.title}</label>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">{t.description}</p>
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <label className="block text-xs font-medium text-slate-600">
            {t.outputTemplate}
            <input
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 font-mono text-xs"
              value={versionedBatchTemplate}
              placeholder={t.outputTemplatePlaceholder}
              onChange={(event) => setVersionedBatchTemplate(event.target.value)}
              data-testid="export-version-output-template"
            />
          </label>
          <button
            className="mt-5 inline-flex items-center justify-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="export-version-template-export"
            onClick={exportVersionedBatchTemplate}
          >
            <Download size={13} />
            {t.exportTemplate}
          </button>
          <button
            className="mt-5 inline-flex items-center justify-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="export-version-template-import"
            onClick={importVersionedBatchTemplate}
          >
            <Upload size={13} />
            {t.importTemplate}
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-line" data-testid="export-version-list">
          <div className="grid min-w-[1180px] gap-2 bg-panel px-3 py-2 text-[11px] font-semibold uppercase text-slate-500 md:grid-cols-[minmax(120px,1fr)_96px_90px_190px_132px_80px_80px_110px_120px_42px]">
            <span>{t.columns.version}</span>
            <span>{t.columns.platform}</span>
            <span>{t.columns.language}</span>
            <span>{t.columns.range}</span>
            <span>{t.columns.preset}</span>
            <span>{t.columns.width}</span>
            <span>{t.columns.height}</span>
            <span>{t.columns.watermark}</span>
            <span>{t.columns.output}</span>
            <span />
          </div>
          {versionedBatchRows.map((row) => {
            const previewJob = createVersionedExportJobs({
              batchId: 'preview',
              outputPathTemplate: versionedBatchTemplate,
              defaultSettings: exportSettings,
              versions: [
                {
                  id: row.id,
                  name: row.name,
                  presetId: row.presetId,
                  platform: row.platform,
                  language: row.language,
                  settings: buildVersionSettings(row),
                },
              ],
            })[0];
            return (
              <div
                key={row.id}
                className="grid min-w-[1180px] gap-2 border-b border-line px-3 py-2 text-xs last:border-b-0 md:grid-cols-[minmax(120px,1fr)_96px_90px_190px_132px_80px_80px_110px_120px_42px]"
                data-testid="export-version-row"
              >
                <label className="flex min-w-0 items-center gap-2">
                  <input
                    className="h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) => updateVersionedBatchRow(row.id, { enabled: event.target.checked })}
                    data-testid="export-version-enabled"
                  />
                  <input
                    className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5"
                    value={row.name}
                    onChange={(event) => updateVersionedBatchRow(row.id, { name: event.target.value })}
                    data-testid="export-version-name-input"
                  />
                </label>
                <input
                  className="rounded-md border border-line px-2 py-1.5"
                  value={row.platform}
                  onChange={(event) => updateVersionedBatchRow(row.id, { platform: event.target.value })}
                  data-testid="export-version-platform-input"
                />
                <input
                  className="rounded-md border border-line px-2 py-1.5"
                  value={row.language}
                  onChange={(event) => updateVersionedBatchRow(row.id, { language: event.target.value })}
                  data-testid="export-version-language-input"
                />
                <div className="grid grid-cols-[74px_1fr_1fr] gap-1">
                  <select
                    className="rounded-md border border-line px-1 py-1.5"
                    value={row.rangeMode}
                    onChange={(event) =>
                      updateVersionedBatchRow(row.id, { rangeMode: event.target.value as VersionRangeMode })
                    }
                    data-testid="export-version-range-mode"
                  >
                    <option value="default">{t.rangeModes.default}</option>
                    <option value="custom">{t.rangeModes.custom}</option>
                  </select>
                  <input
                    className="rounded-md border border-line px-1 py-1.5 disabled:bg-slate-100"
                    type="number"
                    min={0}
                    step={0.1}
                    disabled={row.rangeMode !== 'custom'}
                    value={row.rangeStart}
                    onChange={(event) =>
                      updateVersionedBatchRow(row.id, {
                        rangeStart: Math.max(0, Number(event.target.value) || 0),
                      })
                    }
                    data-testid="export-version-range-start"
                    title={t.rangeStart}
                  />
                  <input
                    className="rounded-md border border-line px-1 py-1.5 disabled:bg-slate-100"
                    type="number"
                    min={0.001}
                    step={0.1}
                    disabled={row.rangeMode !== 'custom'}
                    value={row.rangeDuration}
                    onChange={(event) =>
                      updateVersionedBatchRow(row.id, {
                        rangeDuration: Math.max(0.001, Number(event.target.value) || 0.001),
                      })
                    }
                    data-testid="export-version-range-duration"
                    title={t.rangeDuration}
                  />
                </div>
                <select
                  className="rounded-md border border-line px-2 py-1.5"
                  value={row.presetId}
                  onChange={(event) => updateVersionedBatchRow(row.id, { presetId: event.target.value })}
                  data-testid="export-version-preset-select"
                >
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-md border border-line px-2 py-1.5"
                  type="number"
                  min={1}
                  value={row.width}
                  onChange={(event) =>
                    updateVersionedBatchRow(row.id, {
                      width: Math.max(1, Math.round(Number(event.target.value) || 1)),
                    })
                  }
                  data-testid="export-version-width-input"
                />
                <input
                  className="rounded-md border border-line px-2 py-1.5"
                  type="number"
                  min={1}
                  value={row.height}
                  onChange={(event) =>
                    updateVersionedBatchRow(row.id, {
                      height: Math.max(1, Math.round(Number(event.target.value) || 1)),
                    })
                  }
                  data-testid="export-version-height-input"
                />
                <select
                  className="rounded-md border border-line px-2 py-1.5"
                  value={row.watermarkMode}
                  onChange={(event) =>
                    updateVersionedBatchRow(row.id, {
                      watermarkMode: event.target.value as VersionWatermarkMode,
                    })
                  }
                  data-testid="export-version-watermark-select"
                >
                  <option value="inherit">{t.watermarkModes.inherit}</option>
                  <option value="none">{t.watermarkModes.none}</option>
                  <option value="text">{t.watermarkModes.text}</option>
                </select>
                <div
                  className="truncate rounded-md bg-panel px-2 py-1.5 font-mono text-[11px] text-slate-500"
                  title={previewJob?.outputPath}
                  data-testid="export-version-output-preview"
                >
                  {previewJob?.outputPath}
                </div>
                <button
                  className="rounded-md border border-line p-1.5 text-slate-500 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  disabled={versionedBatchRows.length <= 1}
                  data-testid="export-version-remove"
                  onClick={() => removeVersionedBatchRow(row.id)}
                  title={t.remove}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
        <button
          className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
          type="button"
          data-testid="export-version-add"
          onClick={addVersionedBatchRow}
        >
          <ListPlus size={13} />
          {t.add}
        </button>
        {versionedBatchReportRows.length > 0 ? (
          <VersionedBatchReportTable rows={versionedBatchReportRows} />
        ) : null}
      </div>
    </div>
  );
}
