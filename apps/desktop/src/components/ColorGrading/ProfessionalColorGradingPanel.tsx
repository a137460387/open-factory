import React, { useCallback, useMemo, useRef, useState } from 'react';
import type {
  Clip,
  ColorCorrection,
  ColorCurves,
  ThreeWayColor,
  ColorWheelValue,
} from '@open-factory/editor-core';
import {
  normalizeColorCorrection,
  normalizeThreeWayColor,
  normalizeColorCurves,
  normalizeColorWheelValue,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_THREE_WAY_COLOR,
} from '@open-factory/editor-core';

type GradingTab = 'basic' | 'wheels' | 'lut' | 'curves';

const TAB_LABELS: Record<GradingTab, string> = {
  basic: '基础校色',
  wheels: '色轮',
  lut: 'LUT',
  curves: '曲线',
};

type ThreeWayKey = keyof ThreeWayColor;
type CurveChannel = keyof ColorCurves;

export interface ProfessionalColorGradingPanelProps {
  clip: Clip;
  onCommitColorCorrection: (patch: Partial<ColorCorrection>) => void;
  onChooseLUT?: () => void;
}

export const ProfessionalColorGradingPanel: React.FC<ProfessionalColorGradingPanelProps> = ({
  clip,
  onCommitColorCorrection,
  onChooseLUT,
}) => {
  const [activeTab, setActiveTab] = useState<GradingTab>('basic');

  const colorCorrection = useMemo(
    () => normalizeColorCorrection(clip.colorCorrection),
    [clip.colorCorrection],
  );
  const threeWayColor = useMemo(
    () => normalizeThreeWayColor(colorCorrection.threeWayColor),
    [colorCorrection.threeWayColor],
  );
  const colorCurves = useMemo(
    () => normalizeColorCurves(colorCorrection.colorCurves),
    [colorCorrection.colorCurves],
  );

  const handleResetBasic = useCallback(() => {
    onCommitColorCorrection({
      brightness: DEFAULT_COLOR_CORRECTION.brightness,
      contrast: DEFAULT_COLOR_CORRECTION.contrast,
      saturation: DEFAULT_COLOR_CORRECTION.saturation,
      hue: DEFAULT_COLOR_CORRECTION.hue,
    });
  }, [onCommitColorCorrection]);

  const handleResetWheels = useCallback(() => {
    onCommitColorCorrection({ threeWayColor: DEFAULT_THREE_WAY_COLOR });
  }, [onCommitColorCorrection]);

  const handleResetCurves = useCallback(() => {
    onCommitColorCorrection({ colorCurves: undefined });
  }, [onCommitColorCorrection]);

  const handleClearLUT = useCallback(() => {
    onCommitColorCorrection({ lutPath: null });
  }, [onCommitColorCorrection]);

  return (
    <div className="flex flex-col h-full bg-panel" data-testid="professional-color-grading-panel">
      <div className="flex border-b border-line" data-testid="grading-tabs">
        {(Object.keys(TAB_LABELS) as GradingTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
            onClick={() => setActiveTab(tab)}
            data-testid={`grading-tab-${tab}`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'basic' && (
          <BasicGradingTab
            colorCorrection={colorCorrection}
            onCommit={onCommitColorCorrection}
            onReset={handleResetBasic}
          />
        )}
        {activeTab === 'wheels' && (
          <WheelsGradingTab
            threeWayColor={threeWayColor}
            onCommit={(next) => onCommitColorCorrection({ threeWayColor: next })}
            onReset={handleResetWheels}
          />
        )}
        {activeTab === 'lut' && (
          <LUTGradingTab
            lutPath={colorCorrection.lutPath}
            onChooseLUT={onChooseLUT}
            onClearLUT={handleClearLUT}
          />
        )}
        {activeTab === 'curves' && (
          <CurvesGradingTab
            curves={colorCurves}
            onCommit={(next) => onCommitColorCorrection({ colorCurves: next })}
            onReset={handleResetCurves}
          />
        )}
      </div>
    </div>
  );
};

interface BasicGradingTabProps {
  colorCorrection: ColorCorrection;
  onCommit: (patch: Partial<ColorCorrection>) => void;
  onReset: () => void;
}

const BasicGradingTab: React.FC<BasicGradingTabProps> = ({
  colorCorrection,
  onCommit,
  onReset,
}) => (
  <div className="space-y-3" data-testid="basic-grading-tab">
    <GradingSlider
      label="亮度"
      value={colorCorrection.brightness}
      min={-1}
      max={1}
      step={0.01}
      format={(v) => v.toFixed(2)}
      onChange={(brightness) => onCommit({ brightness })}
      testId="grading-brightness"
    />
    <GradingSlider
      label="对比度"
      value={colorCorrection.contrast}
      min={0}
      max={2}
      step={0.01}
      format={(v) => v.toFixed(2)}
      onChange={(contrast) => onCommit({ contrast })}
      testId="grading-contrast"
    />
    <GradingSlider
      label="饱和度"
      value={colorCorrection.saturation}
      min={0}
      max={2}
      step={0.01}
      format={(v) => v.toFixed(2)}
      onChange={(saturation) => onCommit({ saturation })}
      testId="grading-saturation"
    />
    <GradingSlider
      label="色相"
      value={colorCorrection.hue}
      min={-180}
      max={180}
      step={1}
      format={(v) => `${Math.round(v)}°`}
      onChange={(hue) => onCommit({ hue })}
      testId="grading-hue"
    />
    <button
      type="button"
      className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
      onClick={onReset}
      data-testid="reset-basic-grading"
    >
      重置基础校色
    </button>
  </div>
);

const THREE_WAY_CHANNELS: { key: ThreeWayKey; label: string }[] = [
  { key: 'lift', label: 'Lift (暗部)' },
  { key: 'gamma', label: 'Gamma (中间调)' },
  { key: 'gain', label: 'Gain (高光)' },
];

interface WheelsGradingTabProps {
  threeWayColor: ThreeWayColor;
  onCommit: (color: ThreeWayColor) => void;
  onReset: () => void;
}

const WheelsGradingTab: React.FC<WheelsGradingTabProps> = ({
  threeWayColor,
  onCommit,
  onReset,
}) => {
  const updateWheel = useCallback(
    (key: ThreeWayKey, patch: Partial<ColorWheelValue>) => {
      onCommit(
        normalizeThreeWayColor({
          ...threeWayColor,
          [key]: normalizeColorWheelValue({ ...threeWayColor[key], ...patch }),
        }),
      );
    },
    [threeWayColor, onCommit],
  );

  return (
    <div className="space-y-3" data-testid="wheels-grading-tab">
      {THREE_WAY_CHANNELS.map(({ key, label }) => (
        <ColorWheelControl
          key={key}
          label={label}
          value={threeWayColor[key]}
          onCommit={(patch) => updateWheel(key, patch)}
          testId={`grading-wheel-${key}`}
        />
      ))}
      <button
        type="button"
        className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
        onClick={onReset}
        data-testid="reset-wheels-grading"
      >
        重置色轮
      </button>
    </div>
  );
};

function drawColorWheel(canvas: HTMLCanvasElement, value: ColorWheelValue) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 4;

  ctx.clearRect(0, 0, size, size);

  for (let angle = 0; angle < 360; angle += 1) {
    const startAngle = ((angle - 1) * Math.PI) / 180;
    const endAngle = ((angle + 1) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
    ctx.fill();
  }

  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  const dotX = center + value.r * radius;
  const dotY = center - value.b * radius;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
}

function wheelPointToOffsets(point: { x: number; y: number }): Partial<ColorWheelValue> {
  const clampedX = Math.max(-1, Math.min(1, point.x));
  const clampedY = Math.max(-1, Math.min(1, point.y));
  return { r: clampedX, b: -clampedY };
}

function eventToUnitPoint(
  event: React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
  };
}

const ColorWheelControl: React.FC<{
  label: string;
  value: ColorWheelValue;
  onCommit: (patch: Partial<ColorWheelValue>) => void;
  testId: string;
}> = ({ label, value, onCommit, testId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawColorWheel(canvas, value);
    }
  }, [value]);

  const updateFromEvent = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      onCommit(wheelPointToOffsets(eventToUnitPoint(event, canvas)));
    },
    [onCommit],
  );

  return (
    <div
      className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-2"
      data-testid={testId}
    >
      <div className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="flex items-start gap-3">
        <canvas
          ref={canvasRef}
          className="h-24 w-24 touch-none rounded-full"
          width={96}
          height={96}
          data-testid={`${testId}-canvas`}
          onPointerDown={(event) => {
            updateFromEvent(event);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              updateFromEvent(event);
            }
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <GradingSlider
            label="强度"
            value={value.intensity}
            min={0}
            max={2}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(intensity) => onCommit({ intensity })}
            testId={`${testId}-intensity`}
          />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <GradingSlider
          label="R"
          value={value.r}
          min={-1}
          max={1}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(r) => onCommit({ r })}
          testId={`${testId}-r`}
        />
        <GradingSlider
          label="G"
          value={value.g}
          min={-1}
          max={1}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(g) => onCommit({ g })}
          testId={`${testId}-g`}
        />
        <GradingSlider
          label="B"
          value={value.b}
          min={-1}
          max={1}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(b) => onCommit({ b })}
          testId={`${testId}-b`}
        />
      </div>
    </div>
  );
};

interface LUTGradingTabProps {
  lutPath?: string | null;
  onChooseLUT?: () => void;
  onClearLUT: () => void;
}

function formatLutPath(path?: string | null): string {
  if (!path) return '未加载 LUT';
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] ?? path;
}

const LUTGradingTab: React.FC<LUTGradingTabProps> = ({
  lutPath,
  onChooseLUT,
  onClearLUT,
}) => (
  <div className="space-y-3" data-testid="lut-grading-tab">
    <div className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
          当前 LUT
        </span>
        {lutPath ? (
          <button
            type="button"
            className="rounded border border-line bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-xs hover:bg-panel"
            onClick={onClearLUT}
            data-testid="grading-clear-lut"
          >
            清除
          </button>
        ) : null}
      </div>
      <div
        className="mb-2 truncate text-xs text-[var(--color-text-muted)]"
        title={lutPath ?? undefined}
        data-testid="current-lut-path"
      >
        {formatLutPath(lutPath)}
      </div>
      {onChooseLUT ? (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
          onClick={onChooseLUT}
          data-testid="grading-choose-lut"
        >
          选择 LUT 文件 (.cube / .3dl)
        </button>
      ) : null}
    </div>
  </div>
);

interface CurvesGradingTabProps {
  curves: ColorCurves;
  onCommit: (curves: ColorCurves) => void;
  onReset: () => void;
}

const CURVE_CHANNELS: { key: CurveChannel; label: string; color: string }[] = [
  { key: 'master', label: '主通道', color: '#ffffff' },
  { key: 'r', label: '红', color: '#ef4444' },
  { key: 'g', label: '绿', color: '#22c55e' },
  { key: 'b', label: '蓝', color: '#3b82f6' },
];

const CurvesGradingTab: React.FC<CurvesGradingTabProps> = ({
  curves,
  onCommit,
  onReset,
}) => {
  const [activeChannel, setActiveChannel] = useState<CurveChannel>('master');

  const channelPoints = useMemo(() => {
    return curves[activeChannel] ?? [];
  }, [curves, activeChannel]);

  const handleChannelChange = useCallback(
    (points: { x: number; y: number }[]) => {
      onCommit({ ...curves, [activeChannel]: points });
    },
    [curves, activeChannel, onCommit],
  );

  return (
    <div className="space-y-3" data-testid="curves-grading-tab">
      <div className="flex gap-1" data-testid="curve-channel-tabs">
        {CURVE_CHANNELS.map(({ key, label, color }) => (
          <button
            key={key}
            type="button"
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              activeChannel === key
                ? 'bg-[var(--color-bg-elevated)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
            style={activeChannel === key ? { borderBottom: `2px solid ${color}` } : undefined}
            onClick={() => setActiveChannel(key)}
            data-testid={`curve-channel-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      <MiniCurveEditor
        points={channelPoints}
        onChange={handleChannelChange}
        color={CURVE_CHANNELS.find((c) => c.key === activeChannel)?.color ?? '#fff'}
        testId={`curve-editor-${activeChannel}`}
      />

      <button
        type="button"
        className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
        onClick={onReset}
        data-testid="reset-curves-grading"
      >
        重置曲线
      </button>
    </div>
  );
};

interface MiniCurveEditorProps {
  points: { x: number; y: number }[];
  onChange: (points: { x: number; y: number }[]) => void;
  color: string;
  testId: string;
}

const MiniCurveEditor: React.FC<MiniCurveEditorProps> = ({
  points,
  onChange,
  color,
  testId,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const width = 256;
  const height = 256;

  const getMousePos = useCallback(
    (e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height)),
      };
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePos(e);
      for (let i = 0; i < points.length; i++) {
        const dx = pos.x - points[i].x;
        const dy = pos.y - points[i].y;
        if (dx * dx + dy * dy < 0.001) {
          setDragging(i);
          e.preventDefault();
          return;
        }
      }
      const newPoints = [...points, { x: pos.x, y: pos.y }];
      newPoints.sort((a, b) => a.x - b.x);
      onChange(newPoints);
    },
    [points, onChange, getMousePos],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging === null) return;
      const pos = getMousePos(e);
      const newPoints = [...points];
      if (dragging === 0) {
        newPoints[dragging] = { ...newPoints[dragging], y: pos.y };
      } else if (dragging === points.length - 1) {
        newPoints[dragging] = { ...newPoints[dragging], y: pos.y };
      } else {
        const minX = points[dragging - 1].x + 0.01;
        const maxX = points[dragging + 1].x - 0.01;
        newPoints[dragging] = {
          ...newPoints[dragging],
          x: Math.max(minX, Math.min(maxX, pos.x)),
          y: pos.y,
        };
      }
      onChange(newPoints);
    },
    [dragging, points, onChange, getMousePos],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePos(e);
      for (let i = 0; i < points.length; i++) {
        const dx = pos.x - points[i].x;
        const dy = pos.y - points[i].y;
        if (dx * dx + dy * dy < 0.001 && i !== 0 && i !== points.length - 1) {
          onChange(points.filter((_, idx) => idx !== i));
          return;
        }
      }
    },
    [points, onChange, getMousePos],
  );

  React.useEffect(() => {
    if (dragging !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const generateCurvePath = (): string => {
    if (points.length < 2) return '';
    const sorted = [...points].sort((a, b) => a.x - b.x);
    let path = `M ${sorted[0].x * width} ${(1 - sorted[0].y) * height}`;
    for (let i = 1; i < sorted.length; i++) {
      path += ` L ${sorted[i].x * width} ${(1 - sorted[i].y) * height}`;
    }
    return path;
  };

  return (
    <div data-testid={testId}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-gray-900 cursor-crosshair rounded"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {[0.25, 0.5, 0.75].map((t) => (
          <React.Fragment key={t}>
            <line x1={t * width} y1={0} x2={t * width} y2={height} stroke="#374151" strokeWidth={0.5} />
            <line x1={0} y1={t * height} x2={width} y2={t * height} stroke="#374151" strokeWidth={0.5} />
          </React.Fragment>
        ))}
        <line x1={0} y1={height} x2={width} y2={0} stroke="#4b5563" strokeWidth={1} strokeDasharray="4 4" />
        <path d={generateCurvePath()} fill="none" stroke={color} strokeWidth={2} />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x * width}
            cy={(1 - point.y) * height}
            r={4}
            fill={color}
            stroke="#000"
            strokeWidth={1}
            className="cursor-move"
            onMouseDown={(e) => {
              e.stopPropagation();
              setDragging(index);
            }}
          />
        ))}
      </svg>
    </div>
  );
};

interface GradingSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  testId: string;
}

const GradingSlider: React.FC<GradingSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  testId,
}) => (
  <div className="flex items-center gap-2" data-testid={testId}>
    <span className="text-xs text-[var(--color-text-muted)] w-16 shrink-0">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1"
      data-testid={`${testId}-slider`}
    />
    <span className="text-xs text-[var(--color-text-secondary)] w-12 text-right shrink-0">
      {format ? format(value) : value}
    </span>
  </div>
);
