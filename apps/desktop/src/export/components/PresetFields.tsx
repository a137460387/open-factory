import { normalizeProjectFps, SUPPORTED_PROJECT_FPS } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatFpsOption(fps: number): string {
  return `${Number.isInteger(fps) ? fps.toFixed(0) : fps.toFixed(3)} fps`;
}

function isLoudnessNormalizationOption(value: string): value is 'off' | 'youtube' | 'ebu-r128' {
  return value === 'off' || value === 'youtube' || value === 'ebu-r128';
}

export function formatOptionLabel(value: string): string {
  if (isLoudnessNormalizationOption(value)) {
    return zhCN.exportDialog.loudnessNormalization[value];
  }
  if (value === 'video' || value === 'audio' || value === 'audio-visualization') {
    return zhCN.exportDialog.outputModes[value];
  }
  if (value === 'mp4' || value === 'mov' || value === 'mkv' || value === 'webm') {
    return value.toUpperCase();
  }
  if (value === 'waveform-line' || value === 'spectrum-bars' || value === 'circular-spectrum') {
    return zhCN.exportDialog.audioVisualization.styles[value];
  }
  if (value === 'solid' || value === 'gradient' || value === 'image') {
    return zhCN.exportDialog.audioVisualization.backgroundTypes[value];
  }
  if (value === 'srgb' || value === 'rec709' || value === 'dci-p3' || value === 'display-p3' || value === 'rec2020') {
    return zhCN.exportDialog.colorManagement.colorSpaces[value];
  }
  if (value === 'default') {
    return zhCN.exportDialog.options.default;
  }
  if (value === 'burn-in') {
    return zhCN.exportDialog.options.burnIn;
  }
  if (value === 'soft-sub') {
    return zhCN.exportDialog.options.softSub;
  }
  if (value === 'srt' || value === 'vtt' || value === 'ass' || value === 'ssa') {
    return zhCN.exportDialog.subtitleFormats[value];
  }
  if (value === 'none') {
    return zhCN.exportDialog.options.none;
  }
  if (value === 'fit') {
    return zhCN.exportDialog.options.fit;
  }
  if (value === 'source') {
    return zhCN.exportDialog.options.source;
  }
  if (value === '16:9' || value === '9:16' || value === '1:1' || value === '4:5' || value === '21:9') {
    return value;
  }
  if (value === 'm4a') {
    return 'm4a';
  }
  if (value === 'png-sequence') {
    return zhCN.exportDialog.options.pngSequence;
  }
  if (value === 'gif') {
    return zhCN.exportDialog.options.gif;
  }
  if (value === 'webp') {
    return zhCN.exportDialog.options.webp;
  }
  if (value === 'apng') {
    return zhCN.exportDialog.options.apng;
  }
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function WatermarkNumberField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  testId
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange(value: string): void;
  testId: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <input
        className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        data-testid={testId}
      />
    </label>
  );
}

export function PresetNumberField({
  label,
  value,
  disabled,
  onChange,
  testId
}: {
  label: string;
  value?: number;
  disabled?: boolean;
  onChange(value: string): void;
  testId: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <input className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" type="number" min={1} value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} data-testid={testId} />
    </label>
  );
}

export function PresetFpsField({
  label,
  value,
  disabled,
  onChange,
  testId
}: {
  label: string;
  value?: number;
  disabled?: boolean;
  onChange(value: string): void;
  testId: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <select
        className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100"
        value={String(normalizeProjectFps(value))}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        data-testid={testId}
      >
        {SUPPORTED_PROJECT_FPS.map((fps) => (
          <option key={fps} value={fps}>
            {formatFpsOption(fps)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PresetTextField({
  label,
  value,
  disabled,
  onChange,
  testId
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange(value: string): void;
  testId: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <input className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} data-testid={testId} />
    </label>
  );
}

export function PresetColorField({
  label,
  value,
  disabled,
  onChange,
  testId
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange(value: string): void;
  testId: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <input className="h-[34px] w-full rounded-md border border-line px-1 py-1 disabled:bg-slate-100" type="color" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} data-testid={testId} />
    </label>
  );
}

export function PresetSelectField({
  label,
  value,
  disabled,
  onChange,
  options,
  testId
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange(value: string): void;
  options: string[];
  testId: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <select className="w-full rounded-md border border-line px-2 py-1.5 disabled:bg-slate-100" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} data-testid={testId}>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOptionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PresetCheckboxField({
  label,
  checked,
  disabled,
  onChange,
  testId
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
  testId: string;
}) {
  return (
    <label className={`flex min-h-[58px] items-center gap-2 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-600 ${disabled ? 'bg-slate-100 opacity-70' : ''}`}>
      <input className="h-4 w-4 accent-brand" type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} data-testid={testId} />
      <span>{label}</span>
    </label>
  );
}
