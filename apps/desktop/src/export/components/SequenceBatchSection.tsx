import type { ExportStemFormat, ExportStemMode } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import type { ExportPreset } from '../export-presets';

export type SequenceBatchPresetMode = 'shared' | 'individual';

export interface SequenceBatchRow {
  sequence: { id: string; name: string };
  selected: boolean;
  outputPath: string;
  presetId: string;
}

export function SequenceBatchSection({
  sequenceBatchTemplate,
  setSequenceBatchTemplate,
  sequenceBatchPresetMode,
  setSequenceBatchPresetMode,
  sequenceBatchRows,
  toggleSequenceBatchSelection,
  updateSequenceBatchOutput,
  updateSequenceBatchPreset,
  presets,
  selectedPreset,
}: {
  sequenceBatchTemplate: string;
  setSequenceBatchTemplate: (v: string) => void;
  sequenceBatchPresetMode: SequenceBatchPresetMode;
  setSequenceBatchPresetMode: (mode: SequenceBatchPresetMode) => void;
  sequenceBatchRows: SequenceBatchRow[];
  toggleSequenceBatchSelection: (sequenceId: string, selected: boolean) => void;
  updateSequenceBatchOutput: (sequenceId: string, outputPath: string) => void;
  updateSequenceBatchPreset: (sequenceId: string, presetId: string) => void;
  presets: ExportPreset[];
  selectedPreset: ExportPreset;
}) {
  const t = zhCN.exportDialog;
  return (
    <div
      className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3"
      data-testid="export-sequence-batch-tab"
    >
      <label className="pt-1 text-xs font-medium text-slate-600">{t.sequenceBatch.title}</label>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">{t.sequenceBatch.description}</p>
        <div className="grid gap-2 md:grid-cols-[1fr_220px]">
          <label className="block text-xs font-medium text-slate-600">
            {t.sequenceBatch.outputTemplate}
            <input
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
              value={sequenceBatchTemplate}
              placeholder={t.sequenceBatch.outputTemplatePlaceholder}
              onChange={(event) => setSequenceBatchTemplate(event.target.value)}
              data-testid="export-sequence-output-template"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {t.sequenceBatch.presetMode}
            <select
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
              value={sequenceBatchPresetMode}
              onChange={(event) => setSequenceBatchPresetMode(event.target.value as SequenceBatchPresetMode)}
              data-testid="export-sequence-preset-mode"
            >
              <option value="shared">{t.sequenceBatch.presetModes.shared}</option>
              <option value="individual">{t.sequenceBatch.presetModes.individual}</option>
            </select>
          </label>
        </div>
        <div className="overflow-hidden rounded-md border border-line" data-testid="export-sequence-list">
          {sequenceBatchRows.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-500">{t.sequenceBatch.noSequences}</div>
          ) : (
            sequenceBatchRows.map(
              ({ sequence, selected, outputPath: rowOutputPath, presetId: rowPresetId }) => (
                <div
                  key={sequence.id}
                  className="grid gap-2 border-b border-line px-3 py-2 text-xs last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(220px,1.4fr)_180px]"
                  data-testid="export-sequence-batch-row"
                  data-sequence-id={sequence.id}
                >
                  <label className="flex min-w-0 items-center gap-2 font-medium text-slate-700">
                    <input
                      className="h-4 w-4 accent-brand"
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => toggleSequenceBatchSelection(sequence.id, event.target.checked)}
                      data-testid="export-sequence-checkbox"
                    />
                    <span className="truncate">{sequence.name}</span>
                  </label>
                  <input
                    className="min-w-0 rounded-md border border-line px-2 py-1.5 font-mono text-[11px]"
                    value={rowOutputPath}
                    onChange={(event) => updateSequenceBatchOutput(sequence.id, event.target.value)}
                    data-testid="export-sequence-output-path"
                  />
                  {sequenceBatchPresetMode === 'individual' ? (
                    <select
                      className="rounded-md border border-line px-2 py-1.5 text-xs"
                      value={rowPresetId}
                      onChange={(event) => updateSequenceBatchPreset(sequence.id, event.target.value)}
                      data-testid="export-sequence-preset-select"
                    >
                      {presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-md bg-panel px-2 py-1.5 text-[11px] text-slate-500">
                      {selectedPreset.name}
                    </div>
                  )}
                </div>
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}
