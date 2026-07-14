import React, { useCallback } from 'react';
import type { PrimarySliderParams } from '@open-factory/editor-core';

interface PrimarySlidersPanelProps {
  params: PrimarySliderParams;
  onChange: (params: PrimarySliderParams) => void;
}

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
}> = ({ label, value, min, max, step = 1, onChange, unit = '' }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-gray-400 w-20">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1"
      data-testid={`slider-${label.toLowerCase().replace(/\s+/g, '-')}`}
    />
    <span className="text-xs w-12 text-right">
      {value}
      {unit}
    </span>
  </div>
);

export const PrimarySlidersPanel: React.FC<PrimarySlidersPanelProps> = ({ params, onChange }) => {
  const update = useCallback(
    (key: keyof PrimarySliderParams, value: number) => {
      onChange({ ...params, [key]: value });
    },
    [params, onChange],
  );

  return (
    <div className="p-3 space-y-3" data-testid="primary-sliders-panel">
      <h3 className="text-sm font-medium text-gray-200">一级滑块</h3>
      <Slider label="色温" value={params.temperature} min={-100} max={100} onChange={(v) => update('temperature', v)} />
      <Slider label="色调" value={params.tint} min={-100} max={100} onChange={(v) => update('tint', v)} />
      <Slider label="对比度" value={params.contrast} min={-100} max={100} onChange={(v) => update('contrast', v)} />
      <Slider label="轴心" value={params.pivot} min={0} max={1} step={0.01} onChange={(v) => update('pivot', v)} />
      <Slider label="饱和度" value={params.saturation} min={0} max={200} onChange={(v) => update('saturation', v)} />
      <Slider label="色相" value={params.hue} min={-180} max={180} onChange={(v) => update('hue', v)} unit="°" />
    </div>
  );
};
