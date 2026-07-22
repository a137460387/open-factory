import {
  normalizeExportColorManagement,
  EXPORT_COLOR_SPACES,
  type ExportColorSpace,
} from '@open-factory/editor-core';
import { type Dispatch, type SetStateAction } from 'react';
import { type ExportPresetSettings } from '../export-presets';
import { zhCN } from '../../i18n/strings';
import { PresetSelectField, PresetCheckboxField } from './PresetFields';
import {
  updateColorManagement,
} from '../lib/exportSettingsHelpers';

export function ColorManagementSection({
  colorManagement,
  setDraftSettings,
}: {
  colorManagement: ExportPresetSettings['colorManagement'];
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  const t = zhCN.exportDialog.colorManagement;
  const normalized = normalizeExportColorManagement(colorManagement);
  const active =
    normalized.inputColorSpace !== 'srgb' ||
    normalized.outputColorSpace !== 'srgb' ||
    normalized.embedIccProfile === false;
  return (
    <details className="rounded-md border border-line p-3" data-testid="export-color-management-section">
      <summary
        className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700"
        data-testid="export-color-management-summary"
      >
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{active ? t.custom : t.default}</span>
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <PresetSelectField
          label={t.inputColorSpace}
          value={normalized.inputColorSpace}
          onChange={(value) => updateColorManagement(setDraftSettings, { inputColorSpace: value as ExportColorSpace })}
          options={[...EXPORT_COLOR_SPACES]}
          testId="export-input-color-space-select"
        />
        <PresetSelectField
          label={t.outputColorSpace}
          value={normalized.outputColorSpace}
          onChange={(value) => updateColorManagement(setDraftSettings, { outputColorSpace: value as ExportColorSpace })}
          options={[...EXPORT_COLOR_SPACES]}
          testId="export-output-color-space-select"
        />
        <PresetCheckboxField
          label={t.embedIccProfile}
          checked={normalized.embedIccProfile}
          onChange={(checked) => updateColorManagement(setDraftSettings, { embedIccProfile: checked })}
          testId="export-embed-icc-toggle"
        />
      </div>
    </details>
  );
}

