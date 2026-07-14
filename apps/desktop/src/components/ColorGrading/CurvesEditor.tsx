import React, { useCallback, useRef, useState, useEffect } from 'react';

interface CurvePoint {
  x: number; // 0 ~ 1
  y: number; // 0 ~ 1
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}

interface CurvesEditorProps {
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  channel?: 'rgb' | 'red' | 'green' | 'blue';
  width?: number;
  height?: number;
}

export const CurvesEditor: React.FC<CurvesEditorProps> = ({
  points,
  onChange,
  channel = 'rgb',
  width = 256,
  height = 256,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<{ index: number; type: 'in' | 'out' } | null>(null);

  const channelColor = {
    rgb: '#ffffff',
    red: '#ef4444',
    green: '#22c55e',
    blue: '#3b82f6',
  }[channel];

  const getMousePos = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height)), // 翻转 Y 轴
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePos(e);

      // 检查是否点击了现有点
      for (let i = 0; i < points.length; i++) {
        const dx = pos.x - points[i].x;
        const dy = pos.y - points[i].y;
        if (dx * dx + dy * dy < 0.001) {
          setDragging(i);
          e.preventDefault();
          return;
        }
      }

      // 添加新点
      const newPoints = [...points, { x: pos.x, y: pos.y }];
      newPoints.sort((a, b) => a.x - b.x);
      onChange(newPoints);
    },
    [points, onChange, getMousePos],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging !== null) {
        const pos = getMousePos(e);
        const newPoints = [...points];
        // 保持首尾点的 x 坐标固定
        if (dragging === 0) {
          newPoints[dragging] = { ...newPoints[dragging], y: pos.y };
        } else if (dragging === points.length - 1) {
          newPoints[dragging] = { ...newPoints[dragging], y: pos.y };
        } else {
          // 中间点不能超出相邻点的 x 范围
          const minX = points[dragging - 1].x + 0.01;
          const maxX = points[dragging + 1].x - 0.01;
          newPoints[dragging] = {
            ...newPoints[dragging],
            x: Math.max(minX, Math.min(maxX, pos.x)),
            y: pos.y,
          };
        }
        onChange(newPoints);
      }

      if (draggingHandle) {
        const pos = getMousePos(e);
        const newPoints = [...points];
        const point = newPoints[draggingHandle.index];
        if (draggingHandle.type === 'in') {
          newPoints[draggingHandle.index] = {
            ...point,
            handleIn: { x: pos.x - point.x, y: pos.y - point.y },
          };
        } else {
          newPoints[draggingHandle.index] = {
            ...point,
            handleOut: { x: pos.x - point.x, y: pos.y - point.y },
          };
        }
        onChange(newPoints);
      }
    },
    [dragging, draggingHandle, points, onChange, getMousePos],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setDraggingHandle(null);
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePos(e);

      // 检查是否双击了现有点（删除）
      for (let i = 0; i < points.length; i++) {
        const dx = pos.x - points[i].x;
        const dy = pos.y - points[i].y;
        if (dx * dx + dy * dy < 0.001 && i !== 0 && i !== points.length - 1) {
          const newPoints = points.filter((_, idx) => idx !== i);
          onChange(newPoints);
          return;
        }
      }
    },
    [points, onChange, getMousePos],
  );

  useEffect(() => {
    if (dragging !== null || draggingHandle) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, draggingHandle, handleMouseMove, handleMouseUp]);

  // 生成曲线路径
  const generateCurvePath = (): string => {
    if (points.length < 2) return '';

    const sorted = [...points].sort((a, b) => a.x - b.x);
    let path = `M ${sorted[0].x * width} ${(1 - sorted[0].y) * height}`;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      if (prev.handleOut || curr.handleIn) {
        // 贝塞尔曲线
        const cp1x = (prev.x + (prev.handleOut?.x || 0)) * width;
        const cp1y = (1 - (prev.y + (prev.handleOut?.y || 0))) * height;
        const cp2x = (curr.x + (curr.handleIn?.x || 0)) * width;
        const cp2y = (1 - (curr.y + (curr.handleIn?.y || 0))) * height;
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x * width} ${(1 - curr.y) * height}`;
      } else {
        // 直线
        path += ` L ${curr.x * width} ${(1 - curr.y) * height}`;
      }
    }

    return path;
  };

  return (
    <div className="relative" data-testid={`curves-editor-${channel}`}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-gray-900 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* 网格 */}
        {[0.25, 0.5, 0.75].map((t) => (
          <React.Fragment key={t}>
            <line x1={t * width} y1={0} x2={t * width} y2={height} stroke="#374151" strokeWidth={0.5} />
            <line x1={0} y1={t * height} x2={width} y2={t * height} stroke="#374151" strokeWidth={0.5} />
          </React.Fragment>
        ))}

        {/* 对角线参考 */}
        <line x1={0} y1={height} x2={width} y2={0} stroke="#4b5563" strokeWidth={1} strokeDasharray="4 4" />

        {/* 曲线 */}
        <path d={generateCurvePath()} fill="none" stroke={channelColor} strokeWidth={2} />

        {/* 控制点 */}
        {points.map((point, index) => (
          <React.Fragment key={index}>
            {/* 控制点圆圈 */}
            <circle
              cx={point.x * width}
              cy={(1 - point.y) * height}
              r={4}
              fill={channelColor}
              stroke="#000"
              strokeWidth={1}
              className="cursor-move"
              onMouseDown={(e) => {
                e.stopPropagation();
                setDragging(index);
              }}
            />

            {/* 贝塞尔手柄 */}
            {point.handleIn && (
              <>
                <line
                  x1={point.x * width}
                  y1={(1 - point.y) * height}
                  x2={(point.x + point.handleIn.x) * width}
                  y2={(1 - (point.y + point.handleIn.y)) * height}
                  stroke="#9ca3af"
                  strokeWidth={1}
                />
                <circle
                  cx={(point.x + point.handleIn.x) * width}
                  cy={(1 - (point.y + point.handleIn.y)) * height}
                  r={3}
                  fill="#9ca3af"
                  className="cursor-move"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingHandle({ index, type: 'in' });
                  }}
                />
              </>
            )}
            {point.handleOut && (
              <>
                <line
                  x1={point.x * width}
                  y1={(1 - point.y) * height}
                  x2={(point.x + point.handleOut.x) * width}
                  y2={(1 - (point.y + point.handleOut.y)) * height}
                  stroke="#9ca3af"
                  strokeWidth={1}
                />
                <circle
                  cx={(point.x + point.handleOut.x) * width}
                  cy={(1 - (point.y + point.handleOut.y)) * height}
                  r={3}
                  fill="#9ca3af"
                  className="cursor-move"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingHandle({ index, type: 'out' });
                  }}
                />
              </>
            )}
          </React.Fragment>
        ))}
      </svg>
    </div>
  );
};
