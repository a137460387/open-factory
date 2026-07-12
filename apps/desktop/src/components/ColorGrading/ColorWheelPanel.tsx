import React, { useCallback } from 'react';
import type { PrimaryWheelParams } from '@open-factory/editor-core';

interface ColorWheelPanelProps {
  params: PrimaryWheelParams;
  onChange: (params: PrimaryWheelParams) => void;
}

/** 单个色轮组件 */
const ColorWheel: React.FC<{
  label: string;
  value: { r: number; g: number; b: number; y: number };
  onChange: (value: { r: number; g: number; b: number; y: number }) => void;
}> = ({ label, value, onChange }) => {
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    onChange({ ...value, r: Math.max(-1, Math.min(1, x)), b: Math.max(-1, Math.min(1, -y)) });
  }, [value, onChange]);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <div
        className="relative w-24 h-24 rounded-full border border-gray-600 cursor-crosshair bg-gray-800"
        onClick={handleClick}
        data-testid={`color-wheel-${label.toLowerCase()}`}
      >
        <div
          className="absolute w-3 h-3 rounded-full bg-white border border-gray-400 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${(value.r + 1) * 50}%`,
            top: `${(-value.b + 1) * 50}%`,
          }}
        />
      </div>
    </div>
  );
};

/** 主亮度滑块 */
const MasterSlider: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-gray-400 w-12">{label}</span>
    <input
      type="range"
      min={-100}
      max={100}
      value={value * 100}
      onChange={e => onChange(Number(e.target.value) / 100)}
      className="flex-1"
      data-testid={`master-slider-${label.toLowerCase()}`}
    />
    <span className="text-xs w-8 text-right">{(value * 100).toFixed(0)}</span>
  </div>
);

/** 一级色轮面板 */
export const ColorWheelPanel: React.FC<ColorWheelPanelProps> = ({ params, onChange }) => {
  const updateLift = useCallback((value: { r: number; g: number; b: number; y: number }) => {
    onChange({ ...params, lift: value });
  }, [params, onChange]);

  const updateGamma = useCallback((value: { r: number; g: number; b: number; y: number }) => {
    onChange({ ...params, gamma: value });
  }, [params, onChange]);

  const updateGain = useCallback((value: { r: number; g: number; b: number; y: number }) => {
    onChange({ ...params, gain: value });
  }, [params, onChange]);

  const updateOffset = useCallback((value: { r: number; g: number; b: number; y: number }) => {
    onChange({ ...params, offset: value });
  }, [params, onChange]);

  return (
    <div className="p-3 space-y-4" data-testid="color-wheel-panel">
      <h3 className="text-sm font-medium text-gray-200">一级色轮</h3>
      <div className="grid grid-cols-2 gap-4">
        <ColorWheel label="Lift (暗部)" value={params.lift} onChange={updateLift} />
        <ColorWheel label="Gamma (中间调)" value={params.gamma} onChange={updateGamma} />
        <ColorWheel label="Gain (高光)" value={params.gain} onChange={updateGain} />
        <ColorWheel label="Offset (偏移)" value={params.offset} onChange={updateOffset} />
      </div>
      <div className="space-y-2">
        <MasterSlider label="Lift" value={params.liftMaster} onChange={v => onChange({ ...params, liftMaster: v })} />
        <MasterSlider label="Gamma" value={params.gammaMaster} onChange={v => onChange({ ...params, gammaMaster: v })} />
        <MasterSlider label="Gain" value={params.gainMaster} onChange={v => onChange({ ...params, gainMaster: v })} />
        <MasterSlider label="Offset" value={params.offsetMaster} onChange={v => onChange({ ...params, offsetMaster: v })} />
      </div>
    </div>
  );
};
