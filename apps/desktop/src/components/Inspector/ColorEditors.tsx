import {
  DEFAULT_THREE_WAY_COLOR,
  normalizeColorWheelValue,
  normalizeThreeWayColor,
  clamp01,
  type ColorWheelValue,
  type ThreeWayColor,
} from '@open-factory/editor-core';
import { drawColorWheel, eventToUnitPoint, wheelPointToOffsets } from '../../lib/color-wheel';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { zhCN } from '../../i18n/strings';
import { RangeNumberField } from './EffectEditors';

export type ThreeWayKey = keyof ThreeWayColor;

const THREE_WAY_CHANNELS: Array<{ key: ThreeWayKey; label: string }> = [
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

function ColorWheelControl({
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

/** @deprecated 使用 clamp01 代替 */
const clampUnit = clamp01;
