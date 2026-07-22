import {
  DEFAULT_THREE_WAY_COLOR,
  normalizeColorWheelValue,
  normalizeCurvePoints,
  normalizeThreeWayColor,
  sampleCurve,
  type ColorWheelValue,
  type CurvePoint,
  type ThreeWayColor,
} from '@open-factory/editor-core';
import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { zhCN } from '../../i18n/strings';
import { RangeNumberField } from './InspectorEditors';

export type ThreeWayKey = keyof ThreeWayColor;

export const THREE_WAY_CHANNELS: Array<{ key: ThreeWayKey; label: string }> = [
  { key: 'lift', label: zhCN.inspector.fields.lift },
  { key: 'gamma', label: zhCN.inspector.fields.gamma },
  { key: 'gain', label: zhCN.inspector.fields.gain },
];

export function ThreeWayColorEditor({
  threeWayColor,
  onCommit,
}: {
  threeWayColor: ThreeWayColor;
  onCommit(color: ThreeWayColor): void;
}) {
  const normalized = normalizeThreeWayColor(threeWayColor);
  const updateWheel = (key: ThreeWayKey, patch: Partial<ColorWheelValue>) => {
    onCommit(
      normalizeThreeWayColor({
        ...normalized,
        [key]: normalizeColorWheelValue({ ...normalized[key], ...patch }),
      }),
    );
  };

  return (
    <div className="space-y-3 rounded-md border border-line bg-panel p-2" data-testid="three-way-color-editor">
      {THREE_WAY_CHANNELS.map((channel) => (
        <ColorWheelControl
          key={channel.key}
          label={channel.label}
          value={normalized[channel.key]}
          onCommit={(patch) => updateWheel(channel.key, patch)}
          testId={`color-wheel-${channel.key}`}
        />
      ))}
      <button
        className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
        type="button"
        data-testid="reset-three-way-color-button"
        onClick={() => onCommit(DEFAULT_THREE_WAY_COLOR)}
      >
        {zhCN.common.reset}
      </button>
    </div>
  );
}

export function ColorWheelControl({
  label,
  value,
  onCommit,
  testId,
}: {
  label: string;
  value: ColorWheelValue;
  onCommit(patch: Partial<ColorWheelValue>): void;
  testId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawColorWheel(canvas, value);
    }
  }, [value]);

  const updateFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    onCommit(wheelPointToOffsets(eventToUnitPoint(event, canvas)));
  };

  return (
    <div className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-2" data-testid={testId}>
      <div className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">{label}</div>
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
          <RangeNumberField
            label={zhCN.inspector.fields.intensity}
            value={value.intensity}
            min={0}
            max={2}
            step={0.01}
            format={(next) => next.toFixed(2)}
            onCommit={(intensity) => onCommit({ intensity })}
            testId={`${testId}-intensity`}
          />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <RangeNumberField
          label={zhCN.inspector.fields.red}
          value={value.r}
          min={-1}
          max={1}
          step={0.01}
          format={(next) => next.toFixed(2)}
          onCommit={(r) => onCommit({ r })}
          testId={`${testId}-r`}
        />
        <RangeNumberField
          label={zhCN.inspector.fields.green}
          value={value.g}
          min={-1}
          max={1}
          step={0.01}
          format={(next) => next.toFixed(2)}
          onCommit={(g) => onCommit({ g })}
          testId={`${testId}-g`}
        />
        <RangeNumberField
          label={zhCN.inspector.fields.blue}
          value={value.b}
          min={-1}
          max={1}
          step={0.01}
          format={(next) => next.toFixed(2)}
          onCommit={(b) => onCommit({ b })}
          testId={`${testId}-b`}
        />
      </div>
    </div>
  );
}

export function drawCurveCanvas(canvas: HTMLCanvasElement, points: CurvePoint[], strokeColor: string): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const position = (index / 4) * width;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, height);
    context.moveTo(0, position);
    context.lineTo(width, position);
    context.stroke();
  }
  context.strokeStyle = 'rgba(255, 255, 255, 0.24)';
  context.beginPath();
  context.moveTo(0, height);
  context.lineTo(width, 0);
  context.stroke();

  context.strokeStyle = strokeColor;
  context.lineWidth = 2;
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const sampleX = x / (width - 1);
    const sampleY = sampleCurve(points, sampleX);
    const y = (1 - sampleY) * (height - 1);
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();

  for (const point of normalizeCurvePoints(points)) {
    const x = point.x * width;
    const y = (1 - point.y) * height;
    context.beginPath();
    context.fillStyle = '#ffffff';
    context.arc(x, y, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = strokeColor;
    context.lineWidth = 2;
    context.stroke();
  }
}

export function eventToCurvePoint(event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): CurvePoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clampUnit((event.clientX - rect.left) / rect.width),
    y: clampUnit(1 - (event.clientY - rect.top) / rect.height),
  };
}

export function findNearestCurvePoint(points: CurvePoint[], point: CurvePoint, maxDistance: number): number | null {
  let nearestIndex: number | null = null;
  let nearestDistance = maxDistance;
  points.forEach((candidate, index) => {
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

export function drawColorWheel(canvas: HTMLCanvasElement, value: ColorWheelValue): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const size = canvas.width;
  const radius = size / 2;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5 - radius) / radius;
      const dy = (y + 0.5 - radius) / radius;
      const distance = Math.hypot(dx, dy);
      const offset = (y * size + x) * 4;
      if (distance > 1) {
        image.data[offset + 3] = 0;
        continue;
      }
      const hue = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
      const rgb = hsvToRgb(hue, distance, 1);
      image.data[offset] = Math.round(rgb.r * 255);
      image.data[offset + 1] = Math.round(rgb.g * 255);
      image.data[offset + 2] = Math.round(rgb.b * 255);
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const marker = wheelOffsetsToPoint(value);
  context.beginPath();
  context.arc(radius + marker.x * radius, radius + marker.y * radius, 5, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  context.strokeStyle = '#0f172a';
  context.lineWidth = 2;
  context.stroke();
}

export function eventToUnitPoint(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  const length = Math.hypot(x, y);
  if (length <= 1) {
    return { x, y };
  }
  return { x: x / length, y: y / length };
}

export function wheelPointToOffsets(point: { x: number; y: number }): Pick<ColorWheelValue, 'r' | 'g' | 'b'> {
  return {
    r: clampSigned(point.x),
    g: clampSigned(-0.5 * point.x - 0.8660254 * point.y),
    b: clampSigned(-0.5 * point.x + 0.8660254 * point.y),
  };
}

export function wheelOffsetsToPoint(value: ColorWheelValue): { x: number; y: number } {
  const x = value.r;
  const y = (value.b - value.g) / 1.7320508;
  const length = Math.hypot(x, y);
  if (length <= 1) {
    return { x, y };
  }
  return { x: x / length, y: y / length };
}

export function hsvToRgb(hue: number, saturation: number, value: number): { r: number; g: number; b: number } {
  const sector = Math.floor(hue * 6);
  const fraction = hue * 6 - sector;
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);
  switch (sector % 6) {
    case 0:
      return { r: value, g: t, b: p };
    case 1:
      return { r: q, g: value, b: p };
    case 2:
      return { r: p, g: value, b: t };
    case 3:
      return { r: p, g: q, b: value };
    case 4:
      return { r: t, g: p, b: value };
    default:
      return { r: value, g: p, b: q };
  }
}

export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function clampSigned(value: number): number {
  return Math.min(1, Math.max(-1, Number.isFinite(value) ? value : 0));
}
