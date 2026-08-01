import type {Clip, KeyframeHandleMode, KeyframeProperty} from '@open-factory/editor-core';
import {applyKeyframeHandlePatch, calculateBezierHandleCoordinates, createId, getClipSpeed, interpolateKeyframes, KEYFRAME_PROPERTY_LIMITS, MAX_CLIP_SPEED, MIN_CLIP_SPEED} from '@open-factory/editor-core';
import type {CanvasPoint, CurveEditorFrame, SpeedCurveFrame} from './sharedTypes';
import {clampUnit, roundFinite} from './sharedTypes';

export function getCurveEditorFrames(clip: Clip, property: KeyframeProperty): CurveEditorFrame[] {
  return normalizeCurveEditorFrames(
    (clip.keyframes?.[property] ?? []) as CurveEditorFrame[],
    property,
    Math.max(0.001, clip.duration),
  );
}

export function normalizeCurveEditorFrames(
  frames: CurveEditorFrame[],
  property: KeyframeProperty,
  duration: number,
): CurveEditorFrame[] {
  const limits = KEYFRAME_PROPERTY_LIMITS[property];
  return frames
    .map((frame) => ({
      id: frame.id,
      time: roundFinite(Math.min(duration, Math.max(0, frame.time))),
      value: roundFinite(Math.min(limits.max, Math.max(limits.min, frame.value))),
      easing: frame.easing,
      inHandle: frame.inHandle ? { ...frame.inHandle } : undefined,
      outHandle: frame.outHandle ? { ...frame.outHandle } : undefined,
      handleMode: frame.handleMode,
    }))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function getInterpolatedCurveEditorValue(left: CurveEditorFrame, right: CurveEditorFrame, time: number): number {
  return interpolateKeyframes([left, right], time, left.value);
}

export function findNearestCurveHandle(
  frames: CurveEditorFrame[],
  property: KeyframeProperty,
  duration: number,
  canvas: HTMLCanvasElement,
  point: CanvasPoint,
  maxDistancePx: number,
): { keyframeId: string; handle: 'in' | 'out' } | null {
  const sorted = normalizeCurveEditorFrames(frames, property, duration);
  let nearest: { keyframeId: string; handle: 'in' | 'out' } | null = null;
  let nearestDistance = maxDistancePx;
  for (const [index, frame] of sorted.entries()) {
    const coordinates = calculateBezierHandleCoordinates(
      frame,
      sorted[index - 1],
      sorted[index + 1],
      frame.handleMode ?? 'independent',
    );
    for (const [handle, coordinatesPoint] of [
      ['in', coordinates.inHandle],
      ['out', coordinates.outHandle],
    ] as const) {
      if (!coordinatesPoint) {
        continue;
      }
      const handlePoint = curveFrameToPoint(
        { id: 'handle', time: coordinatesPoint.time, value: coordinatesPoint.value, easing: 'linear' },
        property,
        duration,
        canvas,
      );
      const distance = Math.hypot(handlePoint.x - point.x, handlePoint.y - point.y);
      if (distance <= nearestDistance) {
        nearest = { keyframeId: frame.id, handle };
        nearestDistance = distance;
      }
    }
  }
  return nearest;
}

export function findNearestCurveFrameIdByPoint(
  frames: CurveEditorFrame[],
  property: KeyframeProperty,
  duration: number,
  canvas: HTMLCanvasElement,
  point: CanvasPoint,
  maxDistancePx: number,
): string | null {
  let nearest: string | null = null;
  let nearestDistance = maxDistancePx;
  for (const frame of frames) {
    const framePoint = curveFrameToPoint(frame, property, duration, canvas);
    const distance = Math.hypot(framePoint.x - point.x, framePoint.y - point.y);
    if (distance <= nearestDistance) {
      nearest = frame.id;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function nextHandleMode(mode: KeyframeHandleMode | undefined): KeyframeHandleMode {
  if (mode === 'unified') {
    return 'independent';
  }
  if (mode === 'independent') {
    return 'broken';
  }
  return 'unified';
}

export function getKeyframeFallbackForCurve(property: KeyframeProperty): number {
  if (
    property === 'opacity' ||
    property === 'volume' ||
    property === 'scaleX' ||
    property === 'scaleY' ||
    property === 'speed'
  ) {
    return 1;
  }
  return 0;
}

export function eventToCurveEditorFrame(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  property: KeyframeProperty,
  duration: number,
): CurveEditorFrame {
  const point = eventToCanvasPoint(event, canvas);
  const limits = KEYFRAME_PROPERTY_LIMITS[property];
  const valueSpan = Math.max(0.001, limits.max - limits.min);
  return {
    id: createId('keyframe-draft'),
    time: roundFinite(Math.min(duration, Math.max(0, (point.x / Math.max(1, canvas.width)) * duration))),
    value: roundFinite(
      Math.min(limits.max, Math.max(limits.min, limits.max - (point.y / Math.max(1, canvas.height)) * valueSpan)),
    ),
    easing: 'linear',
  };
}

export function eventToCanvasPoint(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): CanvasPoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.min(canvas.width, Math.max(0, ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width)),
    y: Math.min(canvas.height, Math.max(0, ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height)),
  };
}

export function curveFrameToPoint(
  frame: CurveEditorFrame,
  property: KeyframeProperty,
  duration: number,
  canvas: HTMLCanvasElement,
): CanvasPoint {
  const limits = KEYFRAME_PROPERTY_LIMITS[property];
  const valueSpan = Math.max(0.001, limits.max - limits.min);
  return {
    x: (frame.time / Math.max(0.001, duration)) * canvas.width,
    y: ((limits.max - frame.value) / valueSpan) * canvas.height,
  };
}

export function findNearestCurveFrame(
  frames: CurveEditorFrame[],
  target: CurveEditorFrame,
  property: KeyframeProperty,
  duration: number,
  maxDistance: number,
): number | null {
  const limits = KEYFRAME_PROPERTY_LIMITS[property];
  const valueSpan = Math.max(0.001, limits.max - limits.min);
  let nearest: number | null = null;
  let nearestDistance = maxDistance;
  for (const [index, frame] of frames.entries()) {
    const distance = Math.hypot(
      (frame.time - target.time) / Math.max(0.001, duration),
      (frame.value - target.value) / valueSpan,
    );
    if (distance <= nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function getCurveFrameIdsInBox(
  frames: CurveEditorFrame[],
  property: KeyframeProperty,
  duration: number,
  canvas: HTMLCanvasElement,
  start: CanvasPoint,
  current: CanvasPoint,
): string[] {
  const left = Math.min(start.x, current.x);
  const right = Math.max(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const bottom = Math.max(start.y, current.y);
  return frames.flatMap((frame) => {
    const point = curveFrameToPoint(frame, property, duration, canvas);
    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom ? [frame.id] : [];
  });
}

export function getSpeedCurveFrames(clip: Clip): SpeedCurveFrame[] {
  const frames = normalizeSpeedCurveFrames(
    (clip.keyframes?.speed ?? []) as SpeedCurveFrame[],
    Math.max(0.001, clip.duration),
  );
  if (frames.length > 0) {
    return frames;
  }
  return normalizeSpeedCurveFrames(
    [
      { id: createId('speed-keyframe'), time: 0, value: getClipSpeed(clip), easing: 'linear' },
      { id: createId('speed-keyframe'), time: clip.duration, value: getClipSpeed(clip), easing: 'linear' },
    ],
    Math.max(0.001, clip.duration),
  );
}

export function normalizeSpeedCurveFrames(frames: SpeedCurveFrame[], duration: number): SpeedCurveFrame[] {
  return frames
    .map((frame) => ({
      id: frame.id || createId('speed-keyframe'),
      time: Math.min(duration, Math.max(0, roundFinite(frame.time))),
      value: Math.min(MAX_CLIP_SPEED, Math.max(MIN_CLIP_SPEED, roundFinite(frame.value))),
      easing: frame.easing ?? 'linear',
    }))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function eventToSpeedFrame(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  duration: number,
): SpeedCurveFrame {
  const rect = canvas.getBoundingClientRect();
  const x = roundFinite(clampUnit((event.clientX - rect.left) / rect.width));
  const y = roundFinite(clampUnit((event.clientY - rect.top) / rect.height));
  return {
    id: createId('speed-keyframe'),
    time: roundFinite(x * duration),
    value: roundFinite(MIN_CLIP_SPEED + (1 - y) * (MAX_CLIP_SPEED - MIN_CLIP_SPEED)),
    easing: 'linear',
  };
}

export function speedFrameToPoint(
  frame: SpeedCurveFrame,
  duration: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: (Math.min(duration, Math.max(0, frame.time)) / duration) * width,
    y:
      (1 -
        (Math.min(MAX_CLIP_SPEED, Math.max(MIN_CLIP_SPEED, frame.value)) - MIN_CLIP_SPEED) /
          (MAX_CLIP_SPEED - MIN_CLIP_SPEED)) *
      height,
  };
}

export function findNearestSpeedFrame(
  frames: SpeedCurveFrame[],
  target: SpeedCurveFrame,
  duration: number,
  maxDistance: number,
): number | null {
  let nearest: number | null = null;
  let nearestDistance = maxDistance;
  for (const [index, frame] of frames.entries()) {
    const distance = Math.hypot(
      (frame.time - target.time) / duration,
      (frame.value - target.value) / (MAX_CLIP_SPEED - MIN_CLIP_SPEED),
    );
    if (distance <= nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
}
