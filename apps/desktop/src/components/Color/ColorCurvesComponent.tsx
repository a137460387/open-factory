/**
 * Color Curves Component
 */

import React, {useState, useCallback} from 'react';
import {clamp} from '@open-factory/editor-core/utils/math';
import type {ColorCurvesProps, CurvePoint} from './types';

export const ColorCurvesComponent: React.FC<ColorCurvesProps> = ({ curves, onChange, width = 300, height = 200 }) => {
  const [activeChannel, setActiveChannel] = useState<'master' | 'red' | 'green' | 'blue'>('master');
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);

  const handleMouseDown = useCallback((index: number) => {
    setDraggingPointIndex(index);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (draggingPointIndex === null) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / width, 0, 1);
      const y = clamp(1 - (e.clientY - rect.top) / height, 0, 1);

      const newCurves = { ...curves };
      const channel = newCurves[activeChannel];
      channel[draggingPointIndex] = { x, y };

      // Sort by x
      channel.sort((a, b) => a.x - b.x);

      onChange(newCurves);
    },
    [draggingPointIndex, activeChannel, curves, onChange, width, height],
  );

  const handleMouseUp = useCallback(() => {
    setDraggingPointIndex(null);
  }, []);

  const handleAddPoint = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (draggingPointIndex !== null) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / width, 0, 1);
      const y = clamp(1 - (e.clientY - rect.top) / height, 0, 1);

      const newCurves = { ...curves };
      const channel = [...newCurves[activeChannel]];
      channel.push({ x, y });
      channel.sort((a, b) => a.x - b.x);

      newCurves[activeChannel] = channel;
      onChange(newCurves);
    },
    [draggingPointIndex, activeChannel, curves, onChange, width, height],
  );

  // Generate curve path
  const generateCurvePath = (points: CurvePoint[]): string => {
    if (points.length < 2) return '';

    const sorted = [...points].sort((a, b) => a.x - b.x);
    let path = `M ${sorted[0].x * width} ${(1 - sorted[0].y) * height}`;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const cp1x = prev.x + (curr.x - prev.x) / 3;
      const cp1y = prev.y;
      const cp2x = curr.x - (curr.x - prev.x) / 3;
      const cp2y = curr.y;

      path += ` C ${cp1x * width} ${(1 - cp1y) * height}, ${cp2x * width} ${(1 - cp2y) * height}, ${curr.x * width} ${(1 - curr.y) * height}`;
    }

    return path;
  };

  // Channel colors
  const channelColors = {
    master: '#fff',
    red: '#ff4444',
    green: '#44ff44',
    blue: '#4444ff',
  };

  return (
    <div className="color-curves">
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {(['master', 'red', 'green', 'blue'] as const).map((channel) => (
          <button
            key={channel}
            onClick={() => setActiveChannel(channel)}
            style={{
              padding: '4px 12px',
              background: activeChannel === channel ? channelColors[channel] : '#333',
              color: activeChannel === channel ? '#000' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {channel === 'master' ? '主' : channel === 'red' ? '红' : channel === 'green' ? '绿' : '蓝'}
          </button>
        ))}
      </div>

      <svg
        width={width}
        height={height}
        style={{ background: '#1a1a1a', borderRadius: 8, cursor: 'crosshair' }}
        onMouseDown={handleAddPoint}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid */}
        <defs>
          <pattern id="grid" width={width / 4} height={height / 4} patternUnits="userSpaceOnUse">
            <path
              d={`M ${width / 4} 0 L 0 0 0 ${height / 4}`}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Diagonal */}
        <line x1="0" y1={height} x2={width} y2="0" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

        {/* Curve */}
        <path
          d={generateCurvePath(curves[activeChannel])}
          fill="none"
          stroke={channelColors[activeChannel]}
          strokeWidth="2"
        />

        {/* Control points */}
        {curves[activeChannel].map((point, index) => (
          <circle
            key={index}
            cx={point.x * width}
            cy={(1 - point.y) * height}
            r="6"
            fill={channelColors[activeChannel]}
            stroke="#000"
            strokeWidth="2"
            onMouseDown={(e) => {
              e.stopPropagation();
              handleMouseDown(index);
            }}
            style={{ cursor: 'grab' }}
          />
        ))}
      </svg>
    </div>
  );
};
