import { describe, expect, it } from 'vitest';
import type { TouchPoint } from '../src';
import {
  classifyTouchGesture,
  detectInputDevice,
  isDoubleTap,
  calculatePinchScale,
  calculateTouchTrimHandleSize,
  calculateTouchUISpacing,
  normalizeTouchOptimizationSettings,
  TOUCH_LONG_PRESS_MS,
  TOUCH_TRIM_HANDLE_SCALE,
  TOUCH_UI_SPACING_MULTIPLIER
} from '../src';

describe('touch interaction', () => {
  it('detects input device from pointer type', () => {
    expect(detectInputDevice({ pointerType: 'touch' })).toBe('touch');
    expect(detectInputDevice({ pointerType: 'mouse' })).toBe('mouse');
    expect(detectInputDevice({ pointerType: 'pen' })).toBe('pen');
    expect(detectInputDevice({})).toBe('unknown');
  });

  it('detects touch from sourceCapabilities fallback', () => {
    expect(detectInputDevice({ sourceCapabilities: { firesTouchEvents: true } })).toBe('touch');
    expect(detectInputDevice({ sourceCapabilities: { firesTouchEvents: false } })).toBe('unknown');
  });

  it('classifies pinch-zoom when two fingers present', () => {
    const start = [
      { id: 0, x: 100, y: 100, timestamp: 0 },
      { id: 1, x: 200, y: 200, timestamp: 0 }
    ];
    const current = [
      { id: 0, x: 80, y: 80, timestamp: 100 },
      { id: 1, x: 220, y: 220, timestamp: 100 }
    ];
    expect(classifyTouchGesture(start, current, 100)).toBe('pinch-zoom');
  });

  it('classifies single-pan when one finger moves below long-press threshold', () => {
    const start = [{ id: 0, x: 100, y: 100, timestamp: 0 }];
    const current = [{ id: 0, x: 120, y: 120, timestamp: 200 }];
    expect(classifyTouchGesture(start, current, 200)).toBe('single-pan');
  });

  it('classifies long-press when elapsed >= threshold', () => {
    const start = [{ id: 0, x: 100, y: 100, timestamp: 0 }];
    const current = [{ id: 0, x: 100, y: 100, timestamp: 600 }];
    expect(classifyTouchGesture(start, current, 600)).toBe('long-press');
    expect(classifyTouchGesture(start, current, 499)).toBe('single-pan');
  });

  it('classifies long-press with custom threshold', () => {
    const start = [{ id: 0, x: 100, y: 100, timestamp: 0 }];
    const current = [{ id: 0, x: 100, y: 100, timestamp: 300 }];
    expect(classifyTouchGesture(start, current, 300, 300)).toBe('long-press');
    expect(classifyTouchGesture(start, current, 299, 300)).toBe('single-pan');
  });

  it('returns unknown for empty or mismatched point counts', () => {
    expect(classifyTouchGesture([], [], 0)).toBe('unknown');
    expect(classifyTouchGesture(
      [{ id: 0, x: 0, y: 0, timestamp: 0 }],
      [{ id: 0, x: 0, y: 0, timestamp: 0 }, { id: 1, x: 0, y: 0, timestamp: 0 }],
      100
    )).toBe('unknown');
  });

  it('detects double tap within time and distance window', () => {
    expect(isDoubleTap(1000, 1200, { x: 100, y: 100 }, { x: 110, y: 110 })).toBe(true);
    expect(isDoubleTap(1000, 1400, { x: 100, y: 100 }, { x: 110, y: 110 })).toBe(false);
    expect(isDoubleTap(1000, 1200, { x: 100, y: 100 }, { x: 200, y: 200 })).toBe(false);
  });

  it('calculates pinch scale from two point pairs', () => {
    const start: [TouchPoint, TouchPoint] = [
      { id: 0, x: 100, y: 100, timestamp: 0 },
      { id: 1, x: 200, y: 100, timestamp: 0 }
    ];
    const current: [TouchPoint, TouchPoint] = [
      { id: 0, x: 50, y: 100, timestamp: 100 },
      { id: 1, x: 250, y: 100, timestamp: 100 }
    ];
    expect(calculatePinchScale(start, current)).toBe(2);
  });

  it('calculates pinch scale returns 1 when start distance is 0', () => {
    const same: [TouchPoint, TouchPoint] = [
      { id: 0, x: 100, y: 100, timestamp: 0 },
      { id: 1, x: 100, y: 100, timestamp: 0 }
    ];
    expect(calculatePinchScale(same, same)).toBe(1);
  });

  it('enlarges trim handle for touch devices', () => {
    expect(calculateTouchTrimHandleSize(20, 'touch')).toBe(32);
    expect(calculateTouchTrimHandleSize(20, 'mouse')).toBe(20);
    expect(calculateTouchTrimHandleSize(20, 'pen')).toBe(32);
    expect(calculateTouchTrimHandleSize(20, 'touch', { trimHandleScale: 2 })).toBe(40);
  });

  it('increases UI spacing when touch mode active', () => {
    expect(calculateTouchUISpacing(10, true)).toBe(13);
    expect(calculateTouchUISpacing(10, false)).toBe(10);
    expect(calculateTouchUISpacing(10, true, 2)).toBe(20);
  });

  it('normalizes touch optimization settings with auto-detect', () => {
    const off = normalizeTouchOptimizationSettings(undefined, false);
    expect(off.enabled).toBe(false);
    expect(off.autoDetect).toBe(true);

    const on = normalizeTouchOptimizationSettings(undefined, true);
    expect(on.enabled).toBe(true);

    const manual = normalizeTouchOptimizationSettings({ enabled: true, autoDetect: false }, false);
    expect(manual.enabled).toBe(true);
    expect(manual.autoDetect).toBe(false);
  });

  it('normalizes settings with invalid values falls back to defaults', () => {
    const result = normalizeTouchOptimizationSettings({
      trimHandleScale: -1,
      uiSpacingMultiplier: NaN,
      longPressMs: 0,
      doubleTapMs: undefined
    });
    expect(result.trimHandleScale).toBe(TOUCH_TRIM_HANDLE_SCALE);
    expect(result.uiSpacingMultiplier).toBe(TOUCH_UI_SPACING_MULTIPLIER);
    expect(result.longPressMs).toBe(TOUCH_LONG_PRESS_MS);
  });
});
