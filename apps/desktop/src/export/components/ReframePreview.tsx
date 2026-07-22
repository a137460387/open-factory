import { type Dispatch, type SetStateAction } from 'react';
import { type ExportPresetSettings } from '../export-presets';
import { normalizeTargetAspectRatio, clampReframeOffset, type TargetAspectRatio } from '@open-factory/editor-core';
import { updateReframeOffset } from '../lib/exportSettingsHelpers';

export function ReframeOffsetField({
  label,
  value,
  axis,
  setDraftSettings,
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

export function ReframePreviewBox({
  aspect,
  offsetX,
  offsetY,
}: {
  aspect: TargetAspectRatio;
  offsetX: number;
  offsetY: number;
}) {
  const normalized = normalizeTargetAspectRatio(aspect);
  const ratioClass =
    normalized === '9:16'
      ? 'aspect-[9/16]'
      : normalized === '1:1'
        ? 'aspect-square'
        : normalized === '4:5'
          ? 'aspect-[4/5]'
          : normalized === '21:9'
            ? 'aspect-[21/9]'
            : 'aspect-video';
  const translateX = `${clampReframeOffset(offsetX) * 18}%`;
  const translateY = `${clampReframeOffset(offsetY) * 18}%`;
  return (
    <div className="flex items-center justify-center rounded-md bg-panel p-2" data-testid="export-reframe-preview">
      <div className="relative h-24 w-full max-w-32 overflow-hidden rounded border border-line bg-slate-200">
        <div className="absolute inset-2 rounded bg-gradient-to-br from-slate-500 via-slate-400 to-slate-600" />
        <div
          className={`absolute left-1/2 top-1/2 max-h-[88%] w-[58%] -translate-x-1/2 -translate-y-1/2 border-2 border-brand bg-brand/10 ${ratioClass}`}
          style={{ transform: `translate(calc(-50% + ${translateX}), calc(-50% + ${translateY}))` }}
        />
      </div>
    </div>
  );
}
