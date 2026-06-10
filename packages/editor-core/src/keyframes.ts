import {
  createId,
  type Clip,
  type ClipKeyframes,
  type Keyframe,
  type KeyframeEasing,
  type KeyframeProperty,
  type Transform
} from './model';
import { round } from './time';

export const KEYFRAME_PROPERTY_LIMITS: Record<KeyframeProperty, { min: number; max: number }> = {
  opacity: { min: 0, max: 1 },
  volume: { min: 0, max: 2 },
  x: { min: -1, max: 1 },
  y: { min: -1, max: 1 },
  scaleX: { min: 0.01, max: 4 },
  scaleY: { min: 0.01, max: 4 }
};

export interface KeyframeInput {
  id?: string;
  time: number;
  value: number;
  easing?: KeyframeEasing;
}

export function interpolateKeyframes(keyframes: Keyframe<number>[] | undefined, time: number, fallback: number): number {
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
    const progress = applyEasing((roundedTime - left.time) / span, left.easing);
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
  return t;
}

export function normalizeClipKeyframes(keyframes: ClipKeyframes | undefined, duration: number): ClipKeyframes | undefined {
  if (!keyframes) {
    return undefined;
  }
  const output: ClipKeyframes = {};
  for (const property of Object.keys(KEYFRAME_PROPERTY_LIMITS) as KeyframeProperty[]) {
    const fallback = property === 'opacity' ? 1 : property === 'volume' ? 1 : property === 'scaleX' || property === 'scaleY' ? 1 : 0;
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
  property?: KeyframeProperty
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
      return [
        {
          id: typeof frame.id === 'string' && frame.id ? frame.id : createId('keyframe'),
          time: round(Math.min(maxTime, Math.max(0, frame.time))),
          value: round(limits ? Math.min(limits.max, Math.max(limits.min, value)) : value),
          easing: normalizeEasing(frame.easing),
          originalIndex: index
        }
      ];
    })
    .sort((left, right) => left.time - right.time || left.originalIndex - right.originalIndex)
    .map(({ originalIndex: _originalIndex, ...frame }) => frame);
}

export function normalizeEasing(easing: unknown): KeyframeEasing {
  return easing === 'ease-in' || easing === 'ease-out' || easing === 'ease-in-out' || easing === 'linear' ? easing : 'linear';
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
    return clip.transform.scale;
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
    opacity: getClipKeyframeValue(clip, 'opacity', localTime)
  };
}

export function resolveAnimatedVolume(clip: Clip, localTime: number): number {
  return getClipKeyframeValue(clip, 'volume', localTime);
}

export function applyClipKeyframes<TClip extends Clip>(clip: TClip, localTime: number): TClip {
  const transform = resolveAnimatedTransform(clip, localTime);
  if ('volume' in clip) {
    return {
      ...clip,
      transform,
      volume: resolveAnimatedVolume(clip, localTime)
    } as TClip;
  }
  return {
    ...clip,
    transform
  } as TClip;
}

export function createKeyframe(property: KeyframeProperty, input: KeyframeInput, clipDuration: number): Keyframe<number> {
  const fallback = property === 'opacity' ? 1 : property === 'volume' ? 1 : property === 'scaleX' || property === 'scaleY' ? 1 : 0;
  return normalizeKeyframes(
    [
      {
        id: input.id ?? createId('keyframe'),
        time: input.time,
        value: input.value,
        easing: input.easing ?? 'linear'
      }
    ],
    clipDuration,
    fallback,
    property
  )[0];
}

export function setKeyframeForProperty(
  keyframes: ClipKeyframes | undefined,
  property: KeyframeProperty,
  keyframe: Keyframe<number>,
  clipDuration: number
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
  keyframeId: string
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
      output[property] = frames.map((frame) => ({ ...frame }));
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

export function createKenBurnsKeyframes(duration: number, startScale = 1, endScale = 1.5): ClipKeyframes {
  const end = round(Math.max(0, duration));
  return {
    scaleX: [
      { id: createId('keyframe'), time: 0, value: startScale, easing: 'ease-in-out' },
      { id: createId('keyframe'), time: end, value: endScale, easing: 'ease-in-out' }
    ],
    scaleY: [
      { id: createId('keyframe'), time: 0, value: startScale, easing: 'ease-in-out' },
      { id: createId('keyframe'), time: end, value: endScale, easing: 'ease-in-out' }
    ],
    x: [
      { id: createId('keyframe'), time: 0, value: 0, easing: 'ease-in-out' },
      { id: createId('keyframe'), time: end, value: 0, easing: 'ease-in-out' }
    ],
    y: [
      { id: createId('keyframe'), time: 0, value: 0, easing: 'ease-in-out' },
      { id: createId('keyframe'), time: end, value: 0, easing: 'ease-in-out' }
    ]
  };
}

export function setKenBurnsEndScaleKeyframes(keyframes: ClipKeyframes | undefined, duration: number, scale: number): ClipKeyframes {
  const normalizedDuration = round(Math.max(0, duration));
  const fallback = createKenBurnsKeyframes(normalizedDuration, 1, scale);
  const next = cloneClipKeyframes(keyframes) ?? fallback;
  const clampedScale = Math.min(KEYFRAME_PROPERTY_LIMITS.scaleX.max, Math.max(KEYFRAME_PROPERTY_LIMITS.scaleX.min, scale));
  next.scaleX = setLastScaleFrame(next.scaleX ?? fallback.scaleX ?? [], normalizedDuration, clampedScale, 'scaleX');
  next.scaleY = setLastScaleFrame(next.scaleY ?? fallback.scaleY ?? [], normalizedDuration, clampedScale, 'scaleY');
  return normalizeClipKeyframes(next, normalizedDuration) ?? {};
}

function setLastScaleFrame(
  frames: NonNullable<ClipKeyframes['scaleX']>,
  duration: number,
  scale: number,
  property: Extract<KeyframeProperty, 'scaleX' | 'scaleY'>
): NonNullable<ClipKeyframes['scaleX']> {
  if (frames.length === 0) {
    return createKenBurnsKeyframes(duration, 1, scale)[property] ?? [];
  }
  const next = frames.map((frame) => ({ ...frame }));
  const last = next[next.length - 1];
  next[next.length - 1] = createKeyframe(property, { ...last, time: duration, value: scale }, duration);
  return next;
}
