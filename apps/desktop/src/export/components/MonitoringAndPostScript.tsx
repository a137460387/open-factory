import { type Dispatch, type SetStateAction } from 'react';
import { zhCN } from '../../i18n/strings';
import { PresetColorField, PresetCheckboxField, WatermarkNumberField } from './PresetFields';
import {
  DEFAULT_TIMECODE_BURN_IN,
  WATERMARK_POSITIONS,
  timecodeBurnInFrom,
  updatePostExportScriptCommand,
  updateSlateEnabled,
  updateTimecodeBurnInColor,
  updateTimecodeBurnInEnabled,
  updateTimecodeBurnInFontSize,
  updateTimecodeBurnInFrameNumber,
  updateTimecodeBurnInPosition,
} from '../lib/exportSettingsHelpers';

export function MonitoringSection({
  timecodeBurnIn,
  slate,
  setDraftSettings,
}: {
  timecodeBurnIn: ExportPresetSettings['timecodeBurnIn'];
  slate: ExportPresetSettings['slate'];
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  const t = zhCN.exportDialog.monitoring;
  const positionLabels = zhCN.exportDialog.watermark.positions;
  const enabled = timecodeBurnIn?.enabled === true;
  const timecode = enabled ? timecodeBurnInFrom(timecodeBurnIn) : { ...DEFAULT_TIMECODE_BURN_IN };
  const slateEnabled = slate?.enabled === true;

  return (
    <details className="rounded-md border border-line p-3" data-testid="export-monitoring-section">
      <summary
        className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700"
        data-testid="export-monitoring-summary"
      >
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{enabled || slateEnabled ? t.on : t.off}</span>
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <PresetCheckboxField
          label={t.timecodeEnabled}
          checked={enabled}
          onChange={(checked) => updateTimecodeBurnInEnabled(setDraftSettings, checked)}
          testId="export-timecode-toggle"
        />
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>{t.timecodePosition}</span>
          <select
            className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100"
            value={timecode.position}
            disabled={!enabled}
            onChange={(event) => updateTimecodeBurnInPosition(setDraftSettings, event.target.value)}
            data-testid="export-timecode-position-select"
          >
            {WATERMARK_POSITIONS.map((option) => (
              <option key={option} value={option}>
                {positionLabels[option]}
              </option>
            ))}
          </select>
        </label>
        <WatermarkNumberField
          label={t.timecodeFontSize}
          value={timecode.fontSize}
          min={8}
          max={96}
          step={1}
          disabled={!enabled}
          onChange={(value) => updateTimecodeBurnInFontSize(setDraftSettings, value)}
          testId="export-timecode-font-size"
        />
        <PresetColorField
          label={t.timecodeColor}
          value={timecode.color}
          disabled={!enabled}
          onChange={(value) => updateTimecodeBurnInColor(setDraftSettings, 'color', value)}
          testId="export-timecode-color"
        />
        <PresetColorField
          label={t.timecodeBackgroundColor}
          value={timecode.backgroundColor}
          disabled={!enabled}
          onChange={(value) => updateTimecodeBurnInColor(setDraftSettings, 'backgroundColor', value)}
          testId="export-timecode-background-color"
        />
        <PresetCheckboxField
          label={t.includeFrameNumber}
          checked={timecode.includeFrameNumber}
          disabled={!enabled}
          onChange={(checked) => updateTimecodeBurnInFrameNumber(setDraftSettings, checked)}
          testId="export-timecode-frame-number-toggle"
        />
        <PresetCheckboxField
          label={t.slateEnabled}
          checked={slateEnabled}
          onChange={(checked) => updateSlateEnabled(setDraftSettings, checked)}
          testId="export-slate-toggle"
        />
      </div>
    </details>
  );
}

export function PostExportScriptSection({
  script,
  acknowledged,
  setDraftSettings,
  onAcknowledgedChange,
}: {
  script: ExportPresetSettings['postExportScript'];
  acknowledged: boolean;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
  onAcknowledgedChange(checked: boolean): void;
}) {
  const t = zhCN.exportDialog.postExportScript;
  const command = script?.command ?? '';
  const enabled = command.trim().length > 0;
  return (
    <details className="rounded-md border border-line p-3" data-testid="export-post-script-section">
      <summary
        className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700"
        data-testid="export-post-script-summary"
      >
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{enabled ? t.enabled : t.disabled}</span>
      </summary>
      <div className="mt-3 space-y-3">
        <label className="block space-y-1 text-xs font-medium text-slate-600">
          <span>{t.command}</span>
          <input
            className="w-full rounded-md border border-line px-2 py-1.5 font-mono text-xs"
            placeholder={t.placeholder}
            value={command}
            onChange={(event) => updatePostExportScriptCommand(setDraftSettings, event.target.value)}
            data-testid="export-post-script-command-input"
          />
        </label>
        <div
          className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900"
          data-testid="export-post-script-warning"
        >
          <label className="flex items-start gap-2">
            <input
              className="mt-0.5 h-4 w-4 accent-brand"
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => onAcknowledgedChange(event.target.checked)}
              data-testid="export-post-script-ack-toggle"
            />
            <span>
              <span className="block font-semibold">{t.securityTitle}</span>
              <span className="mt-1 block">{t.securityMessage}</span>
            </span>
          </label>
        </div>
        <div className="text-[11px] leading-4 text-slate-500" data-testid="export-post-script-variables">
          {t.variables}
        </div>
      </div>
    </details>
  );
}

