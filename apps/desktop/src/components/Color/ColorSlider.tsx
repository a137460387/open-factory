/**
 * Color Slider Component
 */

import React, {useCallback} from 'react';
import type {ColorSliderProps} from './types';

export const ColorSlider: React.FC<ColorSliderProps> = ({
  label,
  value,
  onChange,
  min = -1,
  max = 1,
  step = 0.01,
  unit = '',
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange],
  );

  const handleReset = useCallback(() => {
    onChange(0);
  }, [onChange]);

  // Calculate slider position percentage
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="color-slider" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <label>{label}</label>
        <span style={{ fontSize: 12, color: '#888' }}>
          {value.toFixed(2)}
          {unit}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="range" min={min} max={max} step={step} value={value} onChange={handleChange} style={{ flex: 1 }} />
        <button
          onClick={handleReset}
          style={{
            padding: '2px 8px',
            fontSize: 12,
            background: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          重置
        </button>
      </div>
    </div>
  );
};
