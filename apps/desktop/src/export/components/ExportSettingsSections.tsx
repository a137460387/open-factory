import type { Dispatch, SetStateAction } from 'react';
import type {
  ExportColorSpace,
  ExportLoudnessNormalization,
  ExportMasterProcessingSettings,
  ExportSubtitleFormat,
} from '@open-factory/editor-core';
import {
  EXPORT_COLOR_SPACES,
  normalizeExportColorManagement,
  normalizeExportMasterProcessing,
  hasExportMasterProcessing,
  normalizeSubtitleLanguage,
  normalizeSubtitleLanguageList,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import type { ExportPresetSettings } from '../export-presets';
import {
  DEFAULT_TIMECODE_BURN_IN,
  WATERMARK_POSITIONS,
  updateMasterEqEnabled,
  updateMasterStereoEnabled,
  updateMasterLimiterEnabled,
  updateMasterEqBand,
  updateMasterStereoAmount,
  updateMasterLimiterLevel,
  updateLoudnessNormalization,
  updateColorManagement,
  updateSubtitleBurnInLanguage,
  updateSubtitleLanguageSelection,
  updateTimecodeBurnInEnabled,
  updateTimecodeBurnInPosition,
  updateTimecodeBurnInFontSize,
  updateTimecodeBurnInColor,
  updateTimecodeBurnInFrameNumber,
  updateSlateEnabled,
  updatePostExportScriptCommand,
  updateWatermarkEnabled,
  updateWatermarkType,
  updateWatermarkPosition,
  updateImageWatermarkPath,
  updateImageWatermarkScale,
  updateImageWatermarkOpacity,
  updateTextWatermarkText,
  updateTextWatermarkFont,
  updateTextWatermarkColor,
  updateTextWatermarkSize,
  updateReframeOffset,
  normalizeWatermarkPosition,
  timecodeBurnInFrom,
  imageWatermarkFrom,
  textWatermarkFrom,
  type SubtitleLanguageOption,
} from '../lib/exportSettingsHelpers';
import { FolderOpen } from 'lucide-react';
import { PresetCheckboxField, PresetSelectField, PresetColorField, PresetTextField, WatermarkNumberField } from './PresetFields';

export function MasterProcessingSection({
  masterProcessing,
  loudnessNormalization,
  loudnessNormalizationEligible,
  setDraftSettings
}: {
  masterProcessing: ExportPresetSettings['masterProcessing'];
  loudnessNormalization: ExportLoudnessNormalization;
  loudnessNormalizationEligible: boolean;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  const t = zhCN.exportDialog.masterProcessing;
  const master = normalizeExportMasterProcessing(masterProcessing);
  const active = hasExportMasterProcessing(master) || loudnessNormalization !== 'off';
  return (
    <details className="rounded-md border border-line p-3" data-testid="export-master-processing-section">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700" data-testid="export-master-processing-summary">
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{active ? t.on : t.off}</span>
      </summary>
      <div className="mt-3 space-y-3 text-xs">
        <div className="grid gap-3 md:grid-cols-3">
          <PresetCheckboxField label={t.eqEnabled} checked={master.eq.enabled} onChange={(checked) => updateMasterEqEnabled(setDraftSettings, checked)} testId="export-master-eq-toggle" />
          <PresetCheckboxField label={t.stereoEnabled} checked={master.stereoEnhancer.enabled} onChange={(checked) => updateMasterStereoEnabled(setDraftSettings, checked)} testId="export-master-stereo-toggle" />
          <PresetCheckboxField label={t.limiterEnabled} checked={master.limiter.enabled} onChange={(checked) => updateMasterLimiterEnabled(setDraftSettings, checked)} testId="export-master-limiter-toggle" />
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <PresetSelectField
            label={t.loudnessNormalization}
            value={loudnessNormalization}
            disabled={!loudnessNormalizationEligible}
            onChange={(value) => updateLoudnessNormalization(setDraftSettings, value)}
            testId="export-loudness-normalization-select"
            options={['off', 'youtube', 'ebu-r128']}
          />
          <WatermarkNumberField
            label={t.stereoAmount}
            value={master.stereoEnhancer.amount}
            min={0}
            max={2}
            step={0.05}
            disabled={!master.stereoEnhancer.enabled}
            testId="export-master-stereo-amount"
            onChange={(value) => updateMasterStereoAmount(setDraftSettings, value)}
          />
          <WatermarkNumberField
            label={t.limiterLevel}
            value={master.limiter.levelOutDb}
            min={-24}
            max={0}
            step={0.1}
            disabled={!master.limiter.enabled}
            testId="export-master-limiter-level"
            onChange={(value) => updateMasterLimiterLevel(setDraftSettings, value)}
          />
        </div>
        <div className="overflow-hidden rounded-md border border-line" data-testid="export-master-eq-bands">
          <div className="grid grid-cols-[86px_1fr_72px_64px] gap-2 border-b border-line bg-panel px-2 py-1 text-[11px] font-semibold text-slate-500">
            <span>{t.band}</span>
            <span>{t.gain}</span>
            <span>{t.frequency}</span>
            <span>{t.q}</span>
          </div>
          {master.eq.bands.map((band, index) => (
            <div key={band.id} className="grid grid-cols-[86px_1fr_72px_64px] items-center gap-2 border-b border-line px-2 py-1 last:border-b-0" data-testid="export-master-eq-band">
              <div className="truncate font-medium text-slate-600" title={t.bandName(index, band.frequency)}>
                {t.bandName(index, band.frequency)}
              </div>
              <input
                className="min-w-0 accent-brand"
                type="range"
                min={-24}
                max={24}
                step={0.5}
                value={band.gain}
                disabled={!master.eq.enabled}
                data-testid={`export-master-eq-gain-${index}`}
                onChange={(event) => updateMasterEqBand(setDraftSettings, index, { gain: Number(event.target.value) })}
              />
              <input
                className="h-7 min-w-0 rounded border border-line bg-white px-1 text-right tabular-nums disabled:bg-slate-100"
                type="number"
                min={20}
                max={20000}
                step={1}
                value={band.frequency}
                disabled={!master.eq.enabled}
                data-testid={`export-master-eq-frequency-${index}`}
                onChange={(event) => updateMasterEqBand(setDraftSettings, index, { frequency: Number(event.target.value) })}
              />
              <input
                className="h-7 min-w-0 rounded border border-line bg-white px-1 text-right tabular-nums disabled:bg-slate-100"
                type="number"
                min={0.1}
                max={4}
                step={0.1}
                value={band.q}
                disabled={!master.eq.enabled}
                data-testid={`export-master-eq-q-${index}`}
                onChange={(event) => updateMasterEqBand(setDraftSettings, index, { q: Number(event.target.value) })}
              />
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export function SubtitleLanguageSection({
  options,
  selectedLanguages,
  burnInLanguage,
  setDraftSettings
}: {
  options: SubtitleLanguageOption[];
  selectedLanguages?: string[];
  burnInLanguage?: string | null;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  const selected = normalizeSubtitleLanguageList(selectedLanguages);
  const enabledLanguages = selected ? new Set(selected) : new Set(options.map((option) => option.language));
  const activeBurnInLanguage = burnInLanguage ? normalizeSubtitleLanguage(burnInLanguage) : options[0]?.language ?? 'zh';
  const t = zhCN.exportDialog.subtitleLanguages;
  return (
    <section className="rounded-md border border-line p-3 text-xs" data-testid="export-subtitle-language-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-700">{t.title}</div>
          <div className="mt-0.5 text-slate-500">{t.description}</div>
        </div>
        <label className="flex items-center gap-2 text-slate-600">
          <span>{t.burnInLanguage}</span>
          <select
            className="rounded-md border border-line px-2 py-1"
            value={activeBurnInLanguage}
            data-testid="export-subtitle-burn-language-select"
            onChange={(event) => updateSubtitleBurnInLanguage(setDraftSettings, event.target.value)}
          >
            {options.map((option) => (
              <option key={option.language} value={option.language}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.language} className="inline-flex items-center gap-2 rounded-md border border-line px-2 py-1.5 text-slate-700">
            <input
              type="checkbox"
              checked={enabledLanguages.has(option.language)}
              onChange={(event) => updateSubtitleLanguageSelection(setDraftSettings, option.language, event.currentTarget.checked, options)}
              data-testid={`export-subtitle-language-${option.language}`}
            />
            <span>{option.label}</span>
            <span className="text-slate-500">{t.trackCount(option.trackCount)}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

export function ColorManagementSection({
  colorManagement,
  setDraftSettings
}: {
  colorManagement: ExportPresetSettings['colorManagement'];
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  const t = zhCN.exportDialog.colorManagement;
  const normalized = normalizeExportColorManagement(colorManagement);
  const active = normalized.inputColorSpace !== 'srgb' || normalized.outputColorSpace !== 'srgb' || normalized.embedIccProfile === false;
  return (
    <details className="rounded-md border border-line p-3" data-testid="export-color-management-section">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700" data-testid="export-color-management-summary">
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

export function MonitoringSection({
  timecodeBurnIn,
  slate,
  setDraftSettings
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
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700" data-testid="export-monitoring-summary">
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{enabled || slateEnabled ? t.on : t.off}</span>
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <PresetCheckboxField label={t.timecodeEnabled} checked={enabled} onChange={(checked) => updateTimecodeBurnInEnabled(setDraftSettings, checked)} testId="export-timecode-toggle" />
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
        <PresetCheckboxField label={t.slateEnabled} checked={slateEnabled} onChange={(checked) => updateSlateEnabled(setDraftSettings, checked)} testId="export-slate-toggle" />
      </div>
    </details>
  );
}

export function PostExportScriptSection({
  script,
  acknowledged,
  setDraftSettings,
  onAcknowledgedChange
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
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700" data-testid="export-post-script-summary">
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
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900" data-testid="export-post-script-warning">
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

export function WatermarkSection({
  watermark,
  setDraftSettings,
  onChooseImage
}: {
  watermark: ExportPresetSettings['watermark'];
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
  onChooseImage(): void;
}) {
  const t = zhCN.exportDialog.watermark;
  const enabled = watermark?.enabled === true;
  const type = watermark?.type ?? 'text';
  const position = normalizeWatermarkPosition(watermark?.position);
  const imageWatermark = watermark?.type === 'image' ? watermark : imageWatermarkFrom(watermark);
  const textWatermark = watermark?.type === 'text' ? watermark : textWatermarkFrom(watermark);

  return (
    <details className="rounded-md border border-line p-3" data-testid="export-watermark-section">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700" data-testid="export-watermark-summary">
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{enabled ? t.on : t.off}</span>
      </summary>
      <div className="mt-3 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[180px_180px_1fr]">
          <PresetCheckboxField label={t.enabled} checked={enabled} onChange={(checked) => updateWatermarkEnabled(setDraftSettings, checked)} testId="export-watermark-enabled-toggle" />
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>{t.type}</span>
            <select
              className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100"
              value={type}
              disabled={!enabled}
              onChange={(event) => updateWatermarkType(setDraftSettings, event.target.value)}
              data-testid="export-watermark-type-select"
            >
              <option value="text">{t.types.text}</option>
              <option value="image">{t.types.image}</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>{t.position}</span>
            <select
              className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100"
              value={position}
              disabled={!enabled}
              onChange={(event) => updateWatermarkPosition(setDraftSettings, event.target.value)}
              data-testid="export-watermark-position-select"
            >
              {WATERMARK_POSITIONS.map((option) => (
                <option key={option} value={option}>
                  {t.positions[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {type === 'image' ? (
          <div className="grid gap-3 md:grid-cols-[1fr_120px_120px]">
            <label className="space-y-1 text-xs font-medium text-slate-600">
              <span>{t.imagePath}</span>
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100"
                  value={imageWatermark.path}
                  disabled={!enabled}
                  onChange={(event) => updateImageWatermarkPath(setDraftSettings, event.target.value)}
                  data-testid="export-image-watermark-path-input"
                />
                <button
                  className="rounded-md border border-line p-2 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45"
                  title={t.chooseImage}
                  type="button"
                  disabled={!enabled}
                  onClick={onChooseImage}
                  data-testid="export-image-watermark-choose-button"
                >
                  <FolderOpen size={16} />
                </button>
              </div>
            </label>
            <WatermarkNumberField label={t.scalePercent} value={imageWatermark.scalePercent} min={1} max={50} step={1} disabled={!enabled} testId="export-image-watermark-scale-input" onChange={(value) => updateImageWatermarkScale(setDraftSettings, value)} />
            <WatermarkNumberField label={t.opacity} value={imageWatermark.opacity} min={0} max={1} step={0.05} disabled={!enabled} testId="export-image-watermark-opacity-input" onChange={(value) => updateImageWatermarkOpacity(setDraftSettings, value)} />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[1fr_150px_110px_110px]">
            <PresetTextField label={t.text} value={textWatermark.text} disabled={!enabled} onChange={(value) => updateTextWatermarkText(setDraftSettings, value)} testId="export-text-watermark-input" />
            <PresetTextField label={t.fontFamily} value={textWatermark.fontFamily} disabled={!enabled} onChange={(value) => updateTextWatermarkFont(setDraftSettings, value)} testId="export-text-watermark-font-input" />
            <label className="space-y-1 text-xs font-medium text-slate-600">
              <span>{t.color}</span>
              <input
                className="h-[34px] w-full rounded-md border border-line px-1 py-1 disabled:bg-slate-100"
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(textWatermark.color) ? textWatermark.color : '#ffffff'}
                disabled={!enabled}
                onChange={(event) => updateTextWatermarkColor(setDraftSettings, event.target.value)}
                data-testid="export-text-watermark-color-input"
              />
            </label>
            <WatermarkNumberField label={t.fontSize} value={textWatermark.fontSize} min={8} max={240} step={1} disabled={!enabled} testId="export-text-watermark-size-input" onChange={(value) => updateTextWatermarkSize(setDraftSettings, value)} />
          </div>
        )}
      </div>
    </details>
  );
}

export function ReframeOffsetField({
  label,
  value,
  axis,
  setDraftSettings
}: {
  label: string;
  value: number;
  axis: 'x' | 'y';
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <input
          className="w-full accent-brand"
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={value}
          onChange={(event) => updateReframeOffset(setDraftSettings, axis, event.target.value)}
          data-testid={`export-reframe-offset-${axis}`}
        />
        <span className="w-10 text-right tabular-nums">{value.toFixed(2)}</span>
      </div>
    </label>
  );
}
