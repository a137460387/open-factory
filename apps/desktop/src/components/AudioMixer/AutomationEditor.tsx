import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { AutomationCurve, AutomationPoint } from '@open-factory/editor-core';

interface AutomationEditorProps {
  curve: AutomationCurve;
  onChange: (curve: AutomationCurve) => void;
  duration: number; // 总时长（秒）
  pixelsPerSecond?: number;
  height?: number;
  parameterName?: string;
  parameterRange?: [number, number];
  className?: string;
}

const DEFAULT_PARAM_RANGE: [number, number] = [-60, 12]; // dB range

export const AutomationEditor: React.FC<AutomationEditorProps> = ({
  curve,
  onChange,
  duration,
  pixelsPerSecond = 100,
  height = 120,
  parameterName = 'Volume',
  parameterRange = DEFAULT_PARAM_RANGE,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  const width = duration * pixelsPerSecond;
  const [minParam, maxParam] = parameterRange;

  const timeToX = useCallback((time: number) => time * pixelsPerSecond, [pixelsPerSecond]);
  const xToTime = useCallback((x: number) => x / pixelsPerSecond, [pixelsPerSecond]);
  const valueToY = useCallback(
    (value: number) => {
      const normalized = (value - minParam) / (maxParam - minParam);
      return height - normalized * height; // 翻转 Y 轴
    },
    [height, minParam, maxParam],
  );
  const yToValue = useCallback(
    (y: number) => {
      const normalized = (height - y) / height;
      return minParam + normalized * (maxParam - minParam);
    },
    [height, minParam, maxParam],
  );

  const getMousePos = useCallback(
    (e: React.MouseEvent | MouseEvent): { time: number; value: number } => {
      if (!svgRef.current) return { time: 0, value: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return {
        time: Math.max(0, Math.min(duration, xToTime(x))),
        value: Math.max(minParam, Math.min(maxParam, yToValue(y))),
      };
    },
    [duration, xToTime, yToValue, minParam, maxParam],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePos(e);

      // 检查是否点击了现有点
      for (let i = 0; i < curve.points.length; i++) {
        const point = curve.points[i];
        const dx = timeToX(pos.time) - timeToX(point.time);
        const dy = valueToY(pos.value) - valueToY(point.value);
        if (dx * dx + dy * dy < 100) {
          // 10px threshold
          setDragging(i);
          setSelectedPoint(i);
          e.preventDefault();
          return;
        }
      }

      // 添加新点
      const newPoint: AutomationPoint = {
        time: pos.time,
        value: pos.value,
        curve: 'linear',
      };
      const newPoints = [...curve.points, newPoint].sort((a, b) => a.time - b.time);
      onChange({ ...curve, points: newPoints });
      setSelectedPoint(newPoints.findIndex((p) => p === newPoint));
    },
    [curve, onChange, getMousePos, timeToX, valueToY],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging === null) return;

      const pos = getMousePos(e);
      const newPoints = [...curve.points];
      newPoints[dragging] = {
        ...newPoints[dragging],
        time: pos.time,
        value: pos.value,
      };

      // 重新排序
      const sorted = newPoints.sort((a, b) => a.time - b.time);
      const newSelected = sorted.findIndex((p) => p === newPoints[dragging]);
      onChange({ ...curve, points: sorted });
      setSelectedPoint(newSelected);
    },
    [dragging, curve, onChange, getMousePos],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePos(e);

      // 双击删除点
      for (let i = 0; i < curve.points.length; i++) {
        const point = curve.points[i];
        const dx = timeToX(pos.time) - timeToX(point.time);
        const dy = valueToY(pos.value) - valueToY(point.value);
        if (dx * dx + dy * dy < 100) {
          const newPoints = curve.points.filter((_, idx) => idx !== i);
          onChange({ ...curve, points: newPoints });
          setSelectedPoint(null);
          return;
        }
      }
    },
    [curve, onChange, getMousePos, timeToX, valueToY],
  );

  const handleChangePointCurve = useCallback(
    (type: AutomationPoint['curve']) => {
      if (selectedPoint === null) return;
      const newPoints = [...curve.points];
      newPoints[selectedPoint] = { ...newPoints[selectedPoint], curve: type };
      onChange({ ...curve, points: newPoints });
    },
    [selectedPoint, curve, onChange],
  );

  useEffect(() => {
    if (dragging !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // 生成曲线路径
  const generateCurvePath = (): string => {
    if (curve.points.length === 0) return '';

    const sorted = [...curve.points].sort((a, b) => a.time - b.time);
    let path = `M ${timeToX(sorted[0].time)} ${valueToY(sorted[0].value)}`;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      switch (curr.curve) {
        case 'step':
          path += ` L ${timeToX(curr.time)} ${valueToY(prev.value)}`;
          path += ` L ${timeToX(curr.time)} ${valueToY(curr.value)}`;
          break;
        case 'bezier': {
          const cp1x = timeToX(prev.time + (curr.time - prev.time) * 0.5);
          const cp1y = valueToY(prev.value);
          const cp2x = timeToX(prev.time + (curr.time - prev.time) * 0.5);
          const cp2y = valueToY(curr.value);
          path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${timeToX(curr.time)} ${valueToY(curr.value)}`;
          break;
        }
        case 'smooth': {
          const cp1x = timeToX(prev.time + (curr.time - prev.time) * 0.33);
          const cp1y = valueToY(prev.value);
          const cp2x = timeToX(prev.time + (curr.time - prev.time) * 0.66);
          const cp2y = valueToY(curr.value);
          path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${timeToX(curr.time)} ${valueToY(curr.value)}`;
          break;
        }
        default: // linear
          path += ` L ${timeToX(curr.time)} ${valueToY(curr.value)}`;
      }
    }

    return path;
  };

  return (
    <div className={`relative overflow-x-auto bg-gray-900 ${className}`} data-testid="automation-editor">
      {/* 参数标签 */}
      <div className="absolute top-1 left-2 z-10 text-xs text-gray-400">
        {parameterName} ({minParam} ~ {maxParam})
      </div>

      {/* 曲线类型选择器 */}
      {selectedPoint !== null && (
        <div className="absolute top-1 right-2 z-10 flex gap-1">
          {(['linear', 'bezier', 'step', 'smooth'] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleChangePointCurve(type)}
              className={`px-1.5 py-0.5 text-xs rounded ${
                curve.points[selectedPoint]?.curve === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              data-testid={`curve-type-${type}`}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="cursor-crosshair"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* 网格线 */}
        {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
          <line key={`v-${i}`} x1={timeToX(i)} y1={0} x2={timeToX(i)} y2={height} stroke="#1f2937" strokeWidth={1} />
        ))}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={`h-${t}`} x1={0} y1={t * height} x2={width} y2={t * height} stroke="#1f2937" strokeWidth={1} />
        ))}

        {/* 中心线（0dB） */}
        <line
          x1={0}
          y1={valueToY(0)}
          x2={width}
          y2={valueToY(0)}
          stroke="#4b5563"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* 曲线 */}
        <path d={generateCurvePath()} fill="none" stroke="#22c55e" strokeWidth={2} />

        {/* 控制点 */}
        {curve.points.map((point, index) => (
          <circle
            key={index}
            cx={timeToX(point.time)}
            cy={valueToY(point.value)}
            r={4}
            fill={selectedPoint === index ? '#3b82f6' : '#22c55e'}
            stroke="#000"
            strokeWidth={1}
            className="cursor-move"
          />
        ))}
      </svg>
    </div>
  );
};
