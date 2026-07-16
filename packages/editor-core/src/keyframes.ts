import {
  createId,
  getTransformScaleX,
  getTransformScaleY,
  normalizeTextPath,
  type Clip,
  type ClipKeyframes,
  type Keyframe,
  type KeyframeEasing,
  type KeyframeHandle,
  type KeyframeHandleMode,
  type KeyframeProperty,
  type Transform,
} from './model';
import { round } from './time';

const KEYFRAME_MIN_CLIP_SPEED = 0.25;
const KEYFRAME_MAX_CLIP_SPEED = 4;
const KEYFRAME_DEFAULT_CLIP_SPEED = 1;

export const KEYFRAME_PROPERTY_LIMITS: Record<KeyframeProperty, { min: number; max: number }> = {
  opacity: { min: 0, max: 1 },
  volume: { min: 0, max: 2 },
  x: { min: -1, max: 1 },
  y: { min: -1, max: 1 },
  scaleX: { min: 0.01, max: 4 },
  scaleY: { min: 0.01, max: 4 },
  speed: { min: KEYFRAME_MIN_CLIP_SPEED, max: KEYFRAME_MAX_CLIP_SPEED },
  yaw: { min: -180, max: 180 },
  pitch: { min: -90, max: 90 },
  roll: { min: -180, max: 180 },
  spatialX: { min: -1, max: 1 },
  spatialY: { min: -1, max: 1 },
  spatialAzimuth: { min: -180, max: 180 },
  spatialElevation: { min: -90, max: 90 },
  spatialDistanceMeters: { min: 0.1, max: 100 },
  pathStartOffset: { min: 0, max: 1 },
};

export interface KeyframeInput {
  id?: string;
  time: number;
  value: number;
  easing?: KeyframeEasing;
  inHandle?: KeyframeHandle;
  outHandle?: KeyframeHandle;
  handleMode?: KeyframeHandleMode;
}

export interface KeyframeHandlePoint extends KeyframeHandle {
  time: number;
  value: number;
}

export interface KeyframeBezierHandleCoordinates {
  inHandle?: KeyframeHandlePoint;
  outHandle?: KeyframeHandlePoint;
  mode: KeyframeHandleMode;
}

export interface KeyframeSpeedSample {
  time: number;
  value: number;
}

export interface KeyframeExpressionContext {
  prev?: number;
  current?: number;
  next?: number;
  min?: number;
  max?: number;
}

export function interpolateKeyframes(
  keyframes: Keyframe<number>[] | undefined,
  time: number,
  fallback: number,
): number {
  const frames = normalizeKeyframes(keyframes, Number.POSITIVE_INFINITY, fallback);
  if (frames.length === 0) {
    return fallback;
  }

  const roundedTime = round(Math.max(0, time));
  const exactMatches = frames.filter((frame) => Math.abs(frame.time - roundedTime) <= 0.000001);
  if (exactMatches.length > 0) {
    return exactMatches[exactMatches.length - 1].value;
  }

  if (roundedTime < frames[0].time) {
    return frames[0].value;
  }
  if (roundedTime > frames[frames.length - 1].time) {
    return frames[frames.length - 1].value;
  }

  for (let index = 0; index < frames.length - 1; index += 1) {
    const left = frames[index];
    const right = frames[index + 1];
    if (roundedTime < left.time || roundedTime > right.time) {
      continue;
    }
    const span = right.time - left.time;
    if (span <= 0.000001) {
      return right.value;
    }
    const rawProgress = (roundedTime - left.time) / span;
    const progress = hasBezierSegmentHandles(left, right)
      ? interpolateBezierSegmentProgress(left, right, rawProgress)
      : applyEasing(rawProgress, left.easing);
    return round(left.value + (right.value - left.value) * progress);
  }

  return frames[frames.length - 1].value;
}

export function applyEasing(progress: number, easing: KeyframeEasing): number {
  const t = Math.min(1, Math.max(0, progress));
  if (easing === 'ease-in') {
    return t * t;
  }
  if (easing === 'ease-out') {
    return 1 - (1 - t) * (1 - t);
  }
  if (easing === 'ease-in-out') {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  if (easing === 'elastic') {
    if (t === 0 || t === 1) {
      return t;
    }
    const c4 = (2 * Math.PI) / 3;
    return Math.min(1, Math.max(0, Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1));
  }
  if (easing === 'bounce') {
    return easeOutBounce(t);
  }
  return t;
}

export function normalizeClipKeyframes(
  keyframes: ClipKeyframes | undefined,
  duration: number,
): ClipKeyframes | undefined {
  if (!keyframes) {
    return undefined;
  }
  const output: ClipKeyframes = {};
  for (const property of Object.keys(KEYFRAME_PROPERTY_LIMITS) as KeyframeProperty[]) {
    const fallback = getKeyframeFallbackValue(property);
    const frames = normalizeKeyframes(keyframes[property], duration, fallback, property);
    if (frames.length > 0) {
      output[property] = frames;
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

export function normalizeKeyframes(
  keyframes: Keyframe<number>[] | undefined,
  duration: number,
  fallback: number,
  property?: KeyframeProperty,
): Keyframe<number>[] {
  if (!Array.isArray(keyframes)) {
    return [];
  }
  const maxTime = Number.isFinite(duration) ? Math.max(0, duration) : Number.POSITIVE_INFINITY;
  const limits = property ? KEYFRAME_PROPERTY_LIMITS[property] : undefined;
  return keyframes
    .flatMap((frame, index) => {
      if (!frame || typeof frame.time !== 'number' || !Number.isFinite(frame.time)) {
        return [];
      }
      const value = typeof frame.value === 'number' && Number.isFinite(frame.value) ? frame.value : fallback;
      const normalizedFrame: Keyframe<number> & { originalIndex: number } = {
        id: typeof frame.id === 'string' && frame.id ? frame.id : createId('keyframe'),
        time: round(Math.min(maxTime, Math.max(0, frame.time))),
        value: round(limits ? Math.min(limits.max, Math.max(limits.min, value)) : value),
        easing: normalizeEasing(frame.easing),
        originalIndex: index,
      };
      const inHandle = normalizeKeyframeHandle(frame.inHandle);
      const outHandle = normalizeKeyframeHandle(frame.outHandle);
      const handleMode = normalizeKeyframeHandleMode(frame.handleMode);
      if (inHandle) {
        normalizedFrame.inHandle = inHandle;
      }
      if (outHandle) {
        normalizedFrame.outHandle = outHandle;
      }
      if (handleMode) {
        normalizedFrame.handleMode = handleMode;
      }
      return [normalizedFrame];
    })
    .sort((left, right) => left.time - right.time || left.originalIndex - right.originalIndex)
    .map(({ originalIndex: _originalIndex, ...frame }) => frame);
}

export function normalizeEasing(easing: unknown): KeyframeEasing {
  return easing === 'ease-in' ||
    easing === 'ease-out' ||
    easing === 'ease-in-out' ||
    easing === 'elastic' ||
    easing === 'bounce' ||
    easing === 'linear'
    ? easing
    : 'linear';
}

export function getClipKeyframeValue(clip: Clip, property: KeyframeProperty, localTime: number): number {
  return interpolateKeyframes(clip.keyframes?.[property], localTime, getClipStaticKeyframeValue(clip, property));
}

export function getClipStaticKeyframeValue(clip: Clip, property: KeyframeProperty): number {
  if (property === 'opacity') {
    return clip.transform.opacity;
  }
  if (property === 'volume') {
    return 'volume' in clip ? clip.volume : 1;
  }
  if (property === 'x') {
    return clip.transform.x;
  }
  if (property === 'y') {
    return clip.transform.y;
  }
  if (property === 'scaleX' || property === 'scaleY') {
    return property === 'scaleX' ? getTransformScaleX(clip.transform) : getTransformScaleY(clip.transform);
  }
  if (property === 'speed') {
    return clip.speed;
  }
  if (property === 'yaw') {
    return clip.panorama?.yaw ?? 0;
  }
  if (property === 'pitch') {
    return clip.panorama?.pitch ?? 0;
  }
  if (property === 'roll') {
    return clip.panorama?.roll ?? 0;
  }
  if (property === 'spatialX') {
    return 'volume' in clip ? (clip.spatialAudio?.x ?? 0) : 0;
  }
  if (property === 'spatialY') {
    return 'volume' in clip ? (clip.spatialAudio?.y ?? 0) : 0;
  }
  if (property === 'spatialAzimuth') {
    return 'volume' in clip ? (clip.spatialAudio?.azimuth ?? 0) : 0;
  }
  if (property === 'spatialElevation') {
    return 'volume' in clip ? (clip.spatialAudio?.elevation ?? 0) : 0;
  }
  if (property === 'spatialDistanceMeters') {
    return 'volume' in clip ? (clip.spatialAudio?.distanceMeters ?? 1) : 1;
  }
  if (property === 'pathStartOffset') {
    return clip.type === 'text' ? normalizeTextPath(clip.pathText).startOffset : 0;
  }
  return 0;
}

export function resolveAnimatedTransform(clip: Clip, localTime: number): Transform {
  const scaleX = getClipKeyframeValue(clip, 'scaleX', localTime);
  const scaleY = getClipKeyframeValue(clip, 'scaleY', localTime);
  return {
    ...clip.transform,
    x: getClipKeyframeValue(clip, 'x', localTime),
    y: getClipKeyframeValue(clip, 'y', localTime),
    scale: round((scaleX + scaleY) / 2),
    scaleX,
    scaleY,
    opacity: getClipKeyframeValue(clip, 'opacity', localTime),
  };
}

export function resolveAnimatedVolume(clip: Clip, localTime: number): number {
  return getClipKeyframeValue(clip, 'volume', localTime);
}

export function applyClipKeyframes<TClip extends Clip>(clip: TClip, localTime: number): TClip {
  const transform = resolveAnimatedTransform(clip, localTime);
  const panorama =
    clip.panorama && (clip.keyframes?.yaw || clip.keyframes?.pitch || clip.keyframes?.roll)
      ? {
          ...clip.panorama,
          yaw: getClipKeyframeValue(clip, 'yaw', localTime),
          pitch: getClipKeyframeValue(clip, 'pitch', localTime),
          roll: getClipKeyframeValue(clip, 'roll', localTime),
        }
      : clip.panorama;
  if ('volume' in clip) {
    return {
      ...clip,
      transform,
      panorama,
      volume: resolveAnimatedVolume(clip, localTime),
    } as TClip;
  }
  return {
    ...clip,
    transform,
    panorama,
  } as TClip;
}

export function createKeyframe(
  property: KeyframeProperty,
  input: KeyframeInput,
  clipDuration: number,
): Keyframe<number> {
  const fallback = getKeyframeFallbackValue(property);
  return normalizeKeyframes(
    [
      {
        id: input.id ?? createId('keyframe'),
        time: input.time,
        value: input.value,
        easing: input.easing ?? 'linear',
        inHandle: input.inHandle,
        outHandle: input.outHandle,
        handleMode: input.handleMode,
      },
    ],
    clipDuration,
    fallback,
    property,
  )[0];
}

function getKeyframeFallbackValue(property: KeyframeProperty): number {
  if (property === 'opacity' || property === 'volume' || property === 'scaleX' || property === 'scaleY') {
    return 1;
  }
  if (property === 'speed') {
    return KEYFRAME_DEFAULT_CLIP_SPEED;
  }
  if (property === 'pathStartOffset') {
    return 0;
  }
  return 0;
}

export function setKeyframeForProperty(
  keyframes: ClipKeyframes | undefined,
  property: KeyframeProperty,
  keyframe: Keyframe<number>,
  clipDuration: number,
): ClipKeyframes {
  const next: ClipKeyframes = cloneClipKeyframes(keyframes) ?? {};
  const existing = next[property] ?? [];
  const withoutSameId = existing.filter((frame) => frame.id !== keyframe.id);
  next[property] = normalizeKeyframes([...withoutSameId, keyframe], clipDuration, keyframe.value, property);
  return next;
}

export function removeKeyframeForProperty(
  keyframes: ClipKeyframes | undefined,
  property: KeyframeProperty,
  keyframeId: string,
): ClipKeyframes | undefined {
  const next = cloneClipKeyframes(keyframes);
  if (!next?.[property]) {
    return next;
  }
  const remaining = next[property]?.filter((frame) => frame.id !== keyframeId) ?? [];
  if (remaining.length > 0) {
    next[property] = remaining;
  } else {
    delete next[property];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function cloneClipKeyframes(keyframes: ClipKeyframes | undefined): ClipKeyframes | undefined {
  if (!keyframes) {
    return undefined;
  }
  const output: ClipKeyframes = {};
  for (const property of Object.keys(KEYFRAME_PROPERTY_LIMITS) as KeyframeProperty[]) {
    const frames = keyframes[property];
    if (frames?.length) {
      output[property] = frames.map((frame) => cloneKeyframe(frame));
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

export function cloneKeyframe<T>(frame: Keyframe<T>): Keyframe<T> {
  return {
    ...frame,
    ...(frame.inHandle ? { inHandle: { ...frame.inHandle } } : {}),
    ...(frame.outHandle ? { outHandle: { ...frame.outHandle } } : {}),
  };
}

export function normalizeKeyframeHandle(handle: KeyframeHandle | undefined): KeyframeHandle | undefined {
  if (
    !handle ||
    typeof handle.dx !== 'number' ||
    typeof handle.dy !== 'number' ||
    !Number.isFinite(handle.dx) ||
    !Number.isFinite(handle.dy)
  ) {
    return undefined;
  }
  return {
    dx: round(handle.dx),
    dy: round(handle.dy),
  };
}

export function normalizeKeyframeHandleMode(mode: unknown): KeyframeHandleMode | undefined {
  return mode === 'unified' || mode === 'independent' || mode === 'broken' ? mode : undefined;
}

export function calculateBezierHandleCoordinates(
  frame: Keyframe<number>,
  previous?: Keyframe<number>,
  next?: Keyframe<number>,
  mode: KeyframeHandleMode = frame.handleMode ?? 'independent',
): KeyframeBezierHandleCoordinates {
  const normalizedMode = normalizeKeyframeHandleMode(mode) ?? 'independent';
  const inSpan = previous ? Math.max(0.001, frame.time - previous.time) : 0;
  const outSpan = next ? Math.max(0.001, next.time - frame.time) : 0;
  const explicitIn = normalizeKeyframeHandle(frame.inHandle);
  const explicitOut = normalizeKeyframeHandle(frame.outHandle);
  let inHandle = explicitIn ?? (previous ? { dx: -inSpan / 3, dy: 0 } : undefined);
  let outHandle = explicitOut ?? (next ? { dx: outSpan / 3, dy: 0 } : undefined);

  if (normalizedMode === 'unified') {
    const source = outHandle ?? (inHandle ? mirrorHandle(inHandle, outSpan || inSpan, inSpan || outSpan) : undefined);
    outHandle = source && next ? clampHandleForDirection(source, 'out', outSpan) : undefined;
    inHandle =
      source && previous
        ? clampHandleForDirection(mirrorHandle(source, inSpan || outSpan, outSpan || inSpan), 'in', inSpan)
        : undefined;
  } else if (normalizedMode === 'independent') {
    inHandle = inHandle && previous ? clampHandleForDirection(inHandle, 'in', inSpan) : undefined;
    outHandle = outHandle && next ? clampHandleForDirection(outHandle, 'out', outSpan) : undefined;
  } else {
    inHandle = inHandle && previous ? inHandle : undefined;
    outHandle = outHandle && next ? outHandle : undefined;
  }

  return {
    mode: normalizedMode,
    ...(inHandle ? { inHandle: handleToPoint(frame, inHandle) } : {}),
    ...(outHandle ? { outHandle: handleToPoint(frame, outHandle) } : {}),
  };
}

export function applyKeyframeHandlePatch(
  frame: Keyframe<number>,
  handle: 'in' | 'out',
  value: KeyframeHandle,
  mode: KeyframeHandleMode = frame.handleMode ?? 'independent',
): Keyframe<number> {
  const normalizedMode = normalizeKeyframeHandleMode(mode) ?? 'independent';
  const normalized = normalizeKeyframeHandle(value) ?? { dx: 0, dy: 0 };
  if (normalizedMode === 'unified') {
    const opposite = mirrorHandle(normalized);
    return {
      ...cloneKeyframe(frame),
      handleMode: normalizedMode,
      inHandle: handle === 'in' ? normalized : opposite,
      outHandle: handle === 'out' ? normalized : opposite,
    };
  }
  return {
    ...cloneKeyframe(frame),
    handleMode: normalizedMode,
    ...(handle === 'in' ? { inHandle: normalized } : { outHandle: normalized }),
  };
}

export function calculateKeyframeSpeedSamples(
  frames: Keyframe<number>[] | undefined,
  duration: number,
  fallback: number,
  sampleCount = 32,
): KeyframeSpeedSample[] {
  const normalizedDuration = Math.max(0.001, Number.isFinite(duration) ? duration : 0.001);
  const count = Math.max(2, Math.floor(sampleCount));
  const normalizedFrames = normalizeKeyframes(frames, normalizedDuration, fallback);
  const epsilon = Math.min(0.05, Math.max(0.001, normalizedDuration / 1000));
  return Array.from({ length: count }, (_, index) => {
    const time = round((index / (count - 1)) * normalizedDuration);
    const leftTime = Math.max(0, time - epsilon);
    const rightTime = Math.min(normalizedDuration, time + epsilon);
    const divisor = Math.max(0.000001, rightTime - leftTime);
    const left = interpolateKeyframes(normalizedFrames, leftTime, fallback);
    const right = interpolateKeyframes(normalizedFrames, rightTime, fallback);
    return {
      time,
      value: round((right - left) / divisor),
    };
  });
}

export function applyBatchKeyframeEasing(frames: Keyframe<number>[], easing: KeyframeEasing): Keyframe<number>[] {
  const normalizedEasing = normalizeEasing(easing);
  return frames.map((frame) => ({ ...cloneKeyframe(frame), easing: normalizedEasing }));
}

export function distributeKeyframeTimes(frames: Keyframe<number>[], start?: number, end?: number): Keyframe<number>[] {
  const sorted = frames
    .map((frame) => cloneKeyframe(frame))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
  if (sorted.length <= 2) {
    return sorted;
  }
  const first = Number.isFinite(start) ? Number(start) : sorted[0].time;
  const last = Number.isFinite(end) ? Number(end) : sorted[sorted.length - 1].time;
  const step = (last - first) / (sorted.length - 1);
  return sorted.map((frame, index) => ({
    ...frame,
    time: round(first + step * index),
  }));
}

export function alignKeyframeValues(frames: Keyframe<number>[], value = frames[0]?.value ?? 0): Keyframe<number>[] {
  const normalizedValue = Number.isFinite(value) ? value : (frames[0]?.value ?? 0);
  return frames.map((frame) => ({
    ...cloneKeyframe(frame),
    value: round(normalizedValue),
  }));
}

export function parseKeyframeExpression(expression: string, context: KeyframeExpressionContext = {}): number {
  const parser = new NumericExpressionParser(expression, context);
  const value = parser.parse();
  const min = Number.isFinite(context.min) ? context.min! : Number.NEGATIVE_INFINITY;
  const max = Number.isFinite(context.max) ? context.max! : Number.POSITIVE_INFINITY;
  return round(Math.min(max, Math.max(min, value)));
}

function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  }
  if (t < 2 / d1) {
    const shifted = t - 1.5 / d1;
    return n1 * shifted * shifted + 0.75;
  }
  if (t < 2.5 / d1) {
    const shifted = t - 2.25 / d1;
    return n1 * shifted * shifted + 0.9375;
  }
  const shifted = t - 2.625 / d1;
  return n1 * shifted * shifted + 0.984375;
}

/**
 * 将连续进度值转换为离散步进值。
 * 例如 steps=3 时：0→0, 0.33→0.33, 0.34→0.33, 0.66→0.66, 0.67→0.66, 1→1
 */
export function applyStepsEasing(progress: number, steps: number): number {
  if (steps <= 1) return progress;
  const t = Math.min(1, Math.max(0, progress));
  return Math.floor(t * steps) / steps;
}

function hasBezierSegmentHandles(left: Keyframe<number>, right: Keyframe<number>): boolean {
  return Boolean(left.outHandle || right.inHandle);
}

function interpolateBezierSegmentProgress(left: Keyframe<number>, right: Keyframe<number>, progress: number): number {
  const span = Math.max(0.001, right.time - left.time);
  const valueSpan = right.value - left.value;
  const yScale = Math.abs(valueSpan) > 0.000001 ? valueSpan : 1;
  const outHandle = normalizeKeyframeHandle(left.outHandle) ?? { dx: span / 3, dy: 0 };
  const inHandle = normalizeKeyframeHandle(right.inHandle) ?? { dx: -span / 3, dy: 0 };
  const p0 = { x: 0, y: 0 };
  const p1 = {
    x: Math.min(1, Math.max(0, outHandle.dx / span)),
    y: outHandle.dy / yScale,
  };
  const p2 = {
    x: Math.min(1, Math.max(0, 1 + inHandle.dx / span)),
    y: 1 + inHandle.dy / yScale,
  };
  const p3 = { x: 1, y: 1 };
  const target = Math.min(1, Math.max(0, progress));
  let low = 0;
  let high = 1;
  let t = target;
  for (let index = 0; index < 14; index += 1) {
    t = (low + high) / 2;
    const x = cubicBezier(p0.x, p1.x, p2.x, p3.x, t);
    if (x < target) {
      low = t;
    } else {
      high = t;
    }
  }
  return Math.min(1, Math.max(0, cubicBezier(p0.y, p1.y, p2.y, p3.y, t)));
}

function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const inv = 1 - t;
  return inv * inv * inv * p0 + 3 * inv * inv * t * p1 + 3 * inv * t * t * p2 + t * t * t * p3;
}

function mirrorHandle(handle: KeyframeHandle, targetSpan?: number, sourceSpan?: number): KeyframeHandle {
  const scale = targetSpan && sourceSpan ? targetSpan / Math.max(0.001, sourceSpan) : 1;
  return {
    dx: round(-handle.dx * scale),
    dy: round(-handle.dy),
  };
}

function clampHandleForDirection(handle: KeyframeHandle, direction: 'in' | 'out', span: number): KeyframeHandle {
  const maxDx = Math.max(0.001, span);
  const dx = direction === 'in' ? -Math.min(maxDx, Math.abs(handle.dx)) : Math.min(maxDx, Math.abs(handle.dx));
  return {
    dx: round(dx),
    dy: round(handle.dy),
  };
}

function handleToPoint(frame: Keyframe<number>, handle: KeyframeHandle): KeyframeHandlePoint {
  return {
    dx: handle.dx,
    dy: handle.dy,
    time: round(frame.time + handle.dx),
    value: round(frame.value + handle.dy),
  };
}

type NumericToken =
  | { type: 'number'; value: number }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' }
  | { type: 'paren'; value: '(' | ')' };

class NumericExpressionParser {
  private readonly tokens: NumericToken[];
  private index = 0;

  constructor(
    expression: string,
    private readonly context: KeyframeExpressionContext,
  ) {
    this.tokens = tokenizeNumericExpression(expression, context);
  }

  parse(): number {
    const value = this.parseExpression();
    if (this.index < this.tokens.length) {
      throw new Error('Unexpected token in keyframe expression');
    }
    if (!Number.isFinite(value)) {
      throw new Error('Keyframe expression did not produce a finite value');
    }
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (this.matchOperator('+') || this.matchOperator('-')) {
      const operator = this.previous().value;
      const right = this.parseTerm();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    while (this.matchOperator('*') || this.matchOperator('/')) {
      const operator = this.previous().value;
      const right = this.parseFactor();
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  }

  private parseFactor(): number {
    if (this.matchOperator('-')) {
      return -this.parseFactor();
    }
    if (this.matchOperator('+')) {
      return this.parseFactor();
    }
    const token = this.advance();
    if (!token) {
      throw new Error('Unexpected end of keyframe expression');
    }
    if (token.type === 'number') {
      return token.value;
    }
    if (token.type === 'paren' && token.value === '(') {
      const value = this.parseExpression();
      const closing = this.advance();
      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new Error('Missing closing parenthesis in keyframe expression');
      }
      return value;
    }
    throw new Error('Invalid keyframe expression');
  }

  private matchOperator(operator: Extract<NumericToken, { type: 'operator' }>['value']): boolean {
    const token = this.tokens[this.index];
    if (token?.type !== 'operator' || token.value !== operator) {
      return false;
    }
    this.index += 1;
    return true;
  }

  private advance(): NumericToken | undefined {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  private previous(): NumericToken & { type: 'operator' } {
    return this.tokens[this.index - 1] as NumericToken & { type: 'operator' };
  }
}

function tokenizeNumericExpression(expression: string, context: KeyframeExpressionContext): NumericToken[] {
  const tokens: NumericToken[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ type: 'operator', value: char });
      index += 1;
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      index += 1;
      continue;
    }
    const numberMatch = expression.slice(index).match(/^\d+(?:\.\d+)?/);
    if (numberMatch) {
      tokens.push({ type: 'number', value: Number(numberMatch[0]) });
      index += numberMatch[0].length;
      continue;
    }
    const variableMatch = expression.slice(index).match(/^(prev|current|next)\b/);
    if (variableMatch) {
      const key = variableMatch[0] as keyof Pick<KeyframeExpressionContext, 'prev' | 'current' | 'next'>;
      const value = context[key];
      if (!Number.isFinite(value)) {
        throw new Error(`Missing ${key} value for keyframe expression`);
      }
      tokens.push({ type: 'number', value: value! });
      index += key.length;
      continue;
    }
    throw new Error('Unsupported keyframe expression token');
  }
  if (tokens.length === 0) {
    throw new Error('Keyframe expression is empty');
  }
  return tokens;
}

export function createKenBurnsKeyframes(duration: number, startScale = 1, endScale = 1.5): ClipKeyframes {
  const end = round(Math.max(0, duration));
  return {
    scaleX: [
      { id: createId('keyframe'), time: 0, value: startScale, easing: 'ease-in-out' },
      { id: createId('keyframe'), time: end, value: endScale, easing: 'ease-in-out' },
    ],
    scaleY: [
      { id: createId('keyframe'), time: 0, value: startScale, easing: 'ease-in-out' },
      { id: createId('keyframe'), time: end, value: endScale, easing: 'ease-in-out' },
    ],
    x: [
      { id: createId('keyframe'), time: 0, value: 0, easing: 'ease-in-out' },
      { id: createId('keyframe'), time: end, value: 0, easing: 'ease-in-out' },
    ],
    y: [
      { id: createId('keyframe'), time: 0, value: 0, easing: 'ease-in-out' },
      { id: createId('keyframe'), time: end, value: 0, easing: 'ease-in-out' },
    ],
  };
}

export function setKenBurnsEndScaleKeyframes(
  keyframes: ClipKeyframes | undefined,
  duration: number,
  scale: number,
): ClipKeyframes {
  const normalizedDuration = round(Math.max(0, duration));
  const fallback = createKenBurnsKeyframes(normalizedDuration, 1, scale);
  const next = cloneClipKeyframes(keyframes) ?? fallback;
  const clampedScale = Math.min(
    KEYFRAME_PROPERTY_LIMITS.scaleX.max,
    Math.max(KEYFRAME_PROPERTY_LIMITS.scaleX.min, scale),
  );
  next.scaleX = setLastScaleFrame(next.scaleX ?? fallback.scaleX ?? [], normalizedDuration, clampedScale, 'scaleX');
  next.scaleY = setLastScaleFrame(next.scaleY ?? fallback.scaleY ?? [], normalizedDuration, clampedScale, 'scaleY');
  return normalizeClipKeyframes(next, normalizedDuration) ?? {};
}

function setLastScaleFrame(
  frames: NonNullable<ClipKeyframes['scaleX']>,
  duration: number,
  scale: number,
  property: Extract<KeyframeProperty, 'scaleX' | 'scaleY'>,
): NonNullable<ClipKeyframes['scaleX']> {
  if (frames.length === 0) {
    return createKenBurnsKeyframes(duration, 1, scale)[property] ?? [];
  }
  const next = frames.map((frame) => ({ ...frame }));
  const last = next[next.length - 1];
  next[next.length - 1] = createKeyframe(property, { ...last, time: duration, value: scale }, duration);
  return next;
}

export interface ClipboardKeyframeGroup {
  sourceClipId: string;
  sourceClipStart: number;
  property: KeyframeProperty;
  keyframes: Keyframe<number>[];
}

export type PasteMode = 'relative' | 'absolute';

export function normalizeCrossPropertyValue(
  value: number,
  sourceProperty: KeyframeProperty,
  targetProperty: KeyframeProperty,
): number {
  if (sourceProperty === targetProperty) {
    return value;
  }
  const sourceLimits = KEYFRAME_PROPERTY_LIMITS[sourceProperty];
  const targetLimits = KEYFRAME_PROPERTY_LIMITS[targetProperty];
  if (!sourceLimits || !targetLimits) {
    return value;
  }
  const sourceRange = sourceLimits.max - sourceLimits.min;
  if (Math.abs(sourceRange) < 0.000001) {
    return targetLimits.min;
  }
  const normalized = (value - sourceLimits.min) / sourceRange;
  return round(targetLimits.min + normalized * (targetLimits.max - targetLimits.min));
}

export function normalizePastedKeyframes(
  groups: ClipboardKeyframeGroup[],
  targetClipStart: number,
  targetClipDuration: number,
  mode: PasteMode,
  targetProperty?: KeyframeProperty,
): Array<{ property: KeyframeProperty; keyframes: Keyframe<number>[] }> {
  const result: Array<{ property: KeyframeProperty; keyframes: Keyframe<number>[] }> = [];
  for (const group of groups) {
    const property = targetProperty ?? group.property;
    const limits = KEYFRAME_PROPERTY_LIMITS[property];
    const fallback = getKeyframeFallbackValue(property);
    const needsNormalization = targetProperty != null && targetProperty !== group.property;
    const mapped: Keyframe<number>[] = [];
    for (const kf of group.keyframes) {
      let time = kf.time;
      if (mode === 'absolute') {
        const absoluteTime = group.sourceClipStart + kf.time;
        time = absoluteTime - targetClipStart;
      }
      time = Math.min(targetClipDuration, Math.max(0, time));
      let value = kf.value;
      if (needsNormalization) {
        value = normalizeCrossPropertyValue(value, group.property, property);
      }
      if (limits) {
        value = Math.min(limits.max, Math.max(limits.min, value));
      }
      mapped.push({
        id: createId('keyframe'),
        time: round(time),
        value: round(value),
        easing: normalizeEasing(kf.easing),
        ...(kf.inHandle ? { inHandle: { ...kf.inHandle } } : {}),
        ...(kf.outHandle ? { outHandle: { ...kf.outHandle } } : {}),
        ...(kf.handleMode ? { handleMode: kf.handleMode } : {}),
      });
    }
    mapped.sort((a, b) => a.time - b.time);
    if (mapped.length > 0) {
      result.push({ property, keyframes: normalizeKeyframes(mapped, targetClipDuration, fallback, property) });
    }
  }
  return result;
}
