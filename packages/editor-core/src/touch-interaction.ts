export const TOUCH_LONG_PRESS_MS = 500;
export const TOUCH_DOUBLE_TAP_MS = 300;
export const TOUCH_GESTURE_DISCRIMINATION_THRESHOLD_PX = 10;
export const TOUCH_TRIM_HANDLE_SCALE = 1.6;
export const TOUCH_UI_SPACING_MULTIPLIER = 1.3;

export type InputDeviceType = 'touch' | 'mouse' | 'pen' | 'unknown';
export type TouchGestureType = 'pinch-zoom' | 'single-pan' | 'long-press' | 'double-tap' | 'unknown';

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

export interface TouchGestureState {
  type: TouchGestureType;
  startPointCount: number;
  currentPointCount: number;
  startTime: number;
  elapsedMs: number;
  scale?: number;
  deltaX?: number;
  deltaY?: number;
}

export interface TouchOptimizationSettings {
  enabled: boolean;
  autoDetect: boolean;
  trimHandleScale: number;
  uiSpacingMultiplier: number;
  longPressMs: number;
  doubleTapMs: number;
}

export const DEFAULT_TOUCH_OPTIMIZATION_SETTINGS: TouchOptimizationSettings = {
  enabled: false,
  autoDetect: true,
  trimHandleScale: TOUCH_TRIM_HANDLE_SCALE,
  uiSpacingMultiplier: TOUCH_UI_SPACING_MULTIPLIER,
  longPressMs: TOUCH_LONG_PRESS_MS,
  doubleTapMs: TOUCH_DOUBLE_TAP_MS,
};

export function detectInputDevice(event: {
  pointerType?: string;
  sourceCapabilities?: { firesTouchEvents?: boolean };
}): InputDeviceType {
  const pt = event.pointerType?.toLowerCase();
  if (pt === 'touch') return 'touch';
  if (pt === 'pen') return 'pen';
  if (pt === 'mouse') return 'mouse';
  if (event.sourceCapabilities?.firesTouchEvents === true) return 'touch';
  return 'unknown';
}

export function classifyTouchGesture(
  startPoints: TouchPoint[],
  currentPoints: TouchPoint[],
  elapsedMs: number,
  longPressThresholdMs = TOUCH_LONG_PRESS_MS,
): TouchGestureType {
  if (startPoints.length >= 2 && currentPoints.length >= 2) {
    return 'pinch-zoom';
  }
  if (startPoints.length === 1 && currentPoints.length === 1) {
    if (elapsedMs >= longPressThresholdMs) {
      return 'long-press';
    }
    return 'single-pan';
  }
  return 'unknown';
}

export function isDoubleTap(
  lastTapTime: number,
  currentTime: number,
  lastTapPosition: { x: number; y: number },
  currentPosition: { x: number; y: number },
  maxMs = TOUCH_DOUBLE_TAP_MS,
  maxDistancePx = 24,
): boolean {
  const dt = currentTime - lastTapTime;
  if (dt > maxMs || dt < 0) return false;
  const dx = currentPosition.x - lastTapPosition.x;
  const dy = currentPosition.y - lastTapPosition.y;
  return Math.sqrt(dx * dx + dy * dy) <= maxDistancePx;
}

export function calculatePinchScale(
  startPoints: [TouchPoint, TouchPoint],
  currentPoints: [TouchPoint, TouchPoint],
): number {
  const startDist = distanceBetween(startPoints[0], startPoints[1]);
  const currentDist = distanceBetween(currentPoints[0], currentPoints[1]);
  if (startDist <= 0) return 1;
  return currentDist / startDist;
}

export function calculateTouchTrimHandleSize(
  baseSize: number,
  deviceType: InputDeviceType,
  settings?: Partial<TouchOptimizationSettings>,
): number {
  const isTouch = deviceType === 'touch' || deviceType === 'pen';
  if (!isTouch) return baseSize;
  const scale = settings?.trimHandleScale ?? TOUCH_TRIM_HANDLE_SCALE;
  return Math.round(baseSize * Math.max(1, scale));
}

export function calculateTouchUISpacing(baseSpacing: number, touchMode: boolean, multiplier?: number): number {
  if (!touchMode) return baseSpacing;
  return Math.round(baseSpacing * Math.max(1, multiplier ?? TOUCH_UI_SPACING_MULTIPLIER));
}

export function normalizeTouchOptimizationSettings(
  input: Partial<TouchOptimizationSettings> | undefined,
  hasTouchHardware?: boolean,
): TouchOptimizationSettings {
  const autoDetect = input?.autoDetect !== false;
  const enabled = autoDetect ? hasTouchHardware === true : input?.enabled === true;
  return {
    enabled,
    autoDetect,
    trimHandleScale: positiveFinite(input?.trimHandleScale, TOUCH_TRIM_HANDLE_SCALE),
    uiSpacingMultiplier: positiveFinite(input?.uiSpacingMultiplier, TOUCH_UI_SPACING_MULTIPLIER),
    longPressMs: positiveInt(input?.longPressMs, TOUCH_LONG_PRESS_MS),
    doubleTapMs: positiveInt(input?.doubleTapMs, TOUCH_DOUBLE_TAP_MS),
  };
}

function distanceBetween(a: TouchPoint, b: TouchPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function positiveFinite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function positiveInt(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}
