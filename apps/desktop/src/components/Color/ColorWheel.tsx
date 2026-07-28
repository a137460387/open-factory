/**
 * Color Wheel Component
 */

import React, {useState, useCallback, useMemo} from 'react';
import {clamp} from '@open-factory/editor-core/utils/math';
import type {ColorWheelProps} from './types';

export const ColorWheel: React.FC<ColorWheelProps> = ({ type, value, onChange, size = 150, label }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [center, setCenter] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCenter({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;

      const radius = size / 2;
      const dx = (e.clientX - center.x) / radius;
      const dy = (e.clientY - center.y) / radius;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 1;

      if (distance > maxDistance) {
        const scale = maxDistance / distance;
        onChange({
          ...value,
          r: clamp(dx * scale, -1, 1),
          g: clamp(dy * scale, -1, 1),
        });
      } else {
        onChange({
          ...value,
          r: clamp(dx, -1, 1),
          g: clamp(dy, -1, 1),
        });
      }
    },
    [isDragging, center, size, value, onChange],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Calculate indicator position
  const indicatorX = ((value.r + 1) / 2) * size;
  const indicatorY = ((value.g + 1) / 2) * size;

  // Select gradient based on type
  const wheelGradient = useMemo(() => {
    switch (type) {
      case 'lift':
        return 'radial-gradient(circle, #000 0%, #333 50%, #666 100%)';
      case 'gamma':
        return 'radial-gradient(circle, #666 0%, #999 50%, #ccc 100%)';
      case 'gain':
        return 'radial-gradient(circle, #ccc 0%, #fff 50%, #fff 100%)';
      case 'offset':
        return 'radial-gradient(circle, #000 0%, #888 50%, #fff 100%)';
      default:
        return 'radial-gradient(circle, #000 0%, #fff 100%)';
    }
  }, [type]);

  return (
    <div className="color-wheel-container">
      <label className="color-wheel-label">{label}</label>
      <div
        className="color-wheel"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: wheelGradient,
          position: 'relative',
          cursor: 'crosshair',
          border: '2px solid #333',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Crosshair */}
        <div
          style={{
            position: 'absolute',
            left: size / 2 - 1,
            top: 0,
            width: 2,
            height: size,
            background: 'rgba(255,255,255,0.2)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: size / 2 - 1,
            width: size,
            height: 2,
            background: 'rgba(255,255,255,0.2)',
          }}
        />

        {/* Indicator */}
        <div
          style={{
            position: 'absolute',
            left: indicatorX - 6,
            top: indicatorY - 6,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#fff',
            border: '2px solid #000',
            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Value display */}
      <div className="color-wheel-values" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <span>R: {value.r.toFixed(2)}</span>
        <span>G: {value.g.toFixed(2)}</span>
        <span>B: {value.b.toFixed(2)}</span>
      </div>
    </div>
  );
};
