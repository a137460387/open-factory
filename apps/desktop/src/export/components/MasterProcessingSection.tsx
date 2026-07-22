import {
  normalizeExportMasterProcessing,
  hasExportMasterProcessing,
  type ExportLoudnessNormalization,
} from '@open-factory/editor-core';
import { type Dispatch, type SetStateAction } from 'react';
import { zhCN } from '../../i18n/strings';
import { PresetSelectField, PresetCheckboxField, WatermarkNumberField } from './PresetFields';
import {
  updateLoudnessNormalization,
  updateMasterEqBand,
  updateMasterEqEnabled,
  updateMasterLimiterEnabled,
  updateMasterLimiterLevel,
  updateMasterStereoAmount,
  updateMasterStereoEnabled,
} from '../lib/exportSettingsHelpers';

export function MasterProcessingSection({
  masterProcessing,
  loudnessNormalization,
  loudnessNormalizationEligible,
  setDraftSettings,
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
      <summary
        className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700"
        data-testid="export-master-processing-summary"
      >
        <span>{t.title}</span>
        <span className="text-[11px] font-normal text-slate-500">{active ? t.on : t.off}</span>
      </summary>
      <div className="mt-3 space-y-3 text-xs">
        <div className="grid gap-3 md:grid-cols-3">
          <PresetCheckboxField
            label={t.eqEnabled}
            checked={master.eq.enabled}
            onChange={(checked) => updateMasterEqEnabled(setDraftSettings, checked)}
            testId="export-master-eq-toggle"
          />
          <PresetCheckboxField
            label={t.stereoEnabled}
            checked={master.stereoEnhancer.enabled}
            onChange={(checked) => updateMasterStereoEnabled(setDraftSettings, checked)}
            testId="export-master-stereo-toggle"
          />
          <PresetCheckboxField
            label={t.limiterEnabled}
            checked={master.limiter.enabled}
            onChange={(checked) => updateMasterLimiterEnabled(setDraftSettings, checked)}
            testId="export-master-limiter-toggle"
          />
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
            <div
              key={band.id}
              className="grid grid-cols-[86px_1fr_72px_64px] items-center gap-2 border-b border-line px-2 py-1 last:border-b-0"
              data-testid="export-master-eq-band"
            >
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
                onChange={(event) =>
                  updateMasterEqBand(setDraftSettings, index, { frequency: Number(event.target.value) })
                }
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

