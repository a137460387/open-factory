import { type Dispatch, type SetStateAction } from 'react';
import { type ExportPresetSettings } from '../export-presets';
import { zhCN } from '../../i18n/strings';
import { FolderOpen } from 'lucide-react';
import { PresetTextField, PresetCheckboxField, WatermarkNumberField } from './PresetFields';
import {
  WATERMARK_POSITIONS,
  imageWatermarkFrom,
  normalizeWatermarkPosition,
  textWatermarkFrom,
  updateImageWatermarkOpacity,
  updateImageWatermarkPath,
  updateImageWatermarkScale,
  updateTextWatermarkColor,
  updateTextWatermarkFont,
  updateTextWatermarkSize,
  updateTextWatermarkText,
  updateWatermarkEnabled,
  updateWatermarkPosition,
  updateWatermarkType,
} from '../lib/exportSettingsHelpers';

export function WatermarkSection({
  watermark,
  setDraftSettings,
  onChooseImage,
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
      <summary
        className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700"
        data-testid="export-watermark-summary"
      >
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{enabled ? t.on : t.off}</span>
      </summary>
      <div className="mt-3 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[180px_180px_1fr]">
          <PresetCheckboxField
            label={t.enabled}
            checked={enabled}
            onChange={(checked) => updateWatermarkEnabled(setDraftSettings, checked)}
            testId="export-watermark-enabled-toggle"
          />
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
            <WatermarkNumberField
              label={t.scalePercent}
              value={imageWatermark.scalePercent}
              min={1}
              max={50}
              step={1}
              disabled={!enabled}
              testId="export-image-watermark-scale-input"
              onChange={(value) => updateImageWatermarkScale(setDraftSettings, value)}
            />
            <WatermarkNumberField
              label={t.opacity}
              value={imageWatermark.opacity}
              min={0}
              max={1}
              step={0.05}
              disabled={!enabled}
              testId="export-image-watermark-opacity-input"
              onChange={(value) => updateImageWatermarkOpacity(setDraftSettings, value)}
            />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[1fr_150px_110px_110px]">
            <PresetTextField
              label={t.text}
              value={textWatermark.text}
              disabled={!enabled}
              onChange={(value) => updateTextWatermarkText(setDraftSettings, value)}
              testId="export-text-watermark-input"
            />
            <PresetTextField
              label={t.fontFamily}
              value={textWatermark.fontFamily}
              disabled={!enabled}
              onChange={(value) => updateTextWatermarkFont(setDraftSettings, value)}
              testId="export-text-watermark-font-input"
            />
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
            <WatermarkNumberField
              label={t.fontSize}
              value={textWatermark.fontSize}
              min={8}
              max={240}
              step={1}
              disabled={!enabled}
              testId="export-text-watermark-size-input"
              onChange={(value) => updateTextWatermarkSize(setDraftSettings, value)}
            />
          </div>
        )}
      </div>
    </details>
  );
}

