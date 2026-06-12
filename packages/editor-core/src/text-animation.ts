import { type ClipKeyframes, type Keyframe, type KeyframeProperty, type Transform } from './model';
import { cloneClipKeyframes, createKeyframe, normalizeClipKeyframes } from './keyframes';
import { round } from './time';

export const TEXT_ANIMATION_PRESETS = ['fade', 'fly-up', 'slide-left', 'typewriter', 'bounce', 'scale'] as const;
export type TextAnimationPreset = (typeof TEXT_ANIMATION_PRESETS)[number];

export const TEXT_ANIMATION_DIRECTIONS = ['in', 'out', 'both'] as const;
export type TextAnimationDirection = (typeof TEXT_ANIMATION_DIRECTIONS)[number];

export interface TextAnimationInput {
  preset: TextAnimationPreset;
  direction: TextAnimationDirection;
  duration: number;
  clipDuration: number;
  transform: Partial<Transform>;
  text?: string;
}

const TEXT_ANIMATION_PROPERTIES: readonly KeyframeProperty[] = ['opacity', 'x', 'y', 'scaleX', 'scaleY'];
const MIN_TEXT_ANIMATION_DURATION = 0.1;
const MAX_TEXT_ANIMATION_DURATION = 2;

export function normalizeTextAnimationDuration(duration: number): number {
  return round(Math.min(MAX_TEXT_ANIMATION_DURATION, Math.max(MIN_TEXT_ANIMATION_DURATION, Number.isFinite(duration) ? duration : 0.5)));
}

export function normalizeTextAnimationPreset(preset: unknown): TextAnimationPreset {
  return TEXT_ANIMATION_PRESETS.includes(preset as TextAnimationPreset) ? (preset as TextAnimationPreset) : 'fade';
}

export function normalizeTextAnimationDirection(direction: unknown): TextAnimationDirection {
  return TEXT_ANIMATION_DIRECTIONS.includes(direction as TextAnimationDirection) ? (direction as TextAnimationDirection) : 'in';
}

export function buildTextAnimationKeyframes(input: TextAnimationInput): ClipKeyframes {
  const preset = normalizeTextAnimationPreset(input.preset);
  const direction = normalizeTextAnimationDirection(input.direction);
  const clipDuration = round(Math.max(0.001, Number.isFinite(input.clipDuration) ? input.clipDuration : 1));
  const requestedDuration = normalizeTextAnimationDuration(input.duration);
  const segmentDuration = round(Math.min(requestedDuration, direction === 'both' ? clipDuration / 2 : clipDuration));
  const base = normalizeTextAnimationTransform(input.transform);
  const output: ClipKeyframes = {};

  if (direction === 'in' || direction === 'both') {
    appendPresetFrames(output, preset, 'in', 0, segmentDuration, clipDuration, base, input.text);
  }
  if (direction === 'out' || direction === 'both') {
    appendPresetFrames(output, preset, 'out', round(clipDuration - segmentDuration), clipDuration, clipDuration, base, input.text);
  }

  return normalizeClipKeyframes(output, clipDuration) ?? {};
}

export function mergeTextAnimationKeyframes(existing: ClipKeyframes | undefined, generated: ClipKeyframes, clipDuration: number): ClipKeyframes | undefined {
  const next = cloneClipKeyframes(existing) ?? {};
  for (const property of TEXT_ANIMATION_PROPERTIES) {
    delete next[property];
    const frames = generated[property];
    if (frames?.length) {
      next[property] = frames.map((frame) => ({ ...frame }));
    }
  }
  return normalizeClipKeyframes(next, clipDuration);
}

function appendPresetFrames(
  output: ClipKeyframes,
  preset: TextAnimationPreset,
  phase: Extract<TextAnimationDirection, 'in' | 'out'>,
  start: number,
  end: number,
  clipDuration: number,
  base: Required<Pick<Transform, 'x' | 'y' | 'opacity' | 'scaleX' | 'scaleY'>>,
  text: string | undefined
): void {
  const isIn = phase === 'in';
  const yOffset = 0.25;
  const xOffset = 0.35;
  const minScale = 0.2;
  const overshoot = 1.08;

  if (preset === 'fade') {
    add(output, 'opacity', clipDuration, preset, phase, [
      [start, isIn ? 0 : base.opacity, isIn ? 'ease-out' : 'ease-in'],
      [end, isIn ? base.opacity : 0, isIn ? 'ease-out' : 'ease-in']
    ]);
    return;
  }

  if (preset === 'fly-up') {
    add(output, 'opacity', clipDuration, preset, phase, [
      [start, isIn ? 0 : base.opacity, isIn ? 'ease-out' : 'ease-in'],
      [end, isIn ? base.opacity : 0, isIn ? 'ease-out' : 'ease-in']
    ]);
    add(output, 'y', clipDuration, preset, phase, [
      [start, isIn ? base.y + yOffset : base.y, isIn ? 'ease-out' : 'ease-in'],
      [end, isIn ? base.y : base.y + yOffset, isIn ? 'ease-out' : 'ease-in']
    ]);
    return;
  }

  if (preset === 'slide-left') {
    add(output, 'opacity', clipDuration, preset, phase, [
      [start, isIn ? 0 : base.opacity, isIn ? 'ease-out' : 'ease-in'],
      [end, isIn ? base.opacity : 0, isIn ? 'ease-out' : 'ease-in']
    ]);
    add(output, 'x', clipDuration, preset, phase, [
      [start, isIn ? base.x - xOffset : base.x, isIn ? 'ease-out' : 'ease-in'],
      [end, isIn ? base.x : base.x - xOffset, isIn ? 'ease-out' : 'ease-in']
    ]);
    return;
  }

  if (preset === 'typewriter') {
    const steps = Math.max(2, Math.min(12, Array.from((text ?? '').trim() || 'Open Factory').length));
    const frames = Array.from({ length: steps }, (_, index): FrameTuple => {
      const progress = steps === 1 ? 1 : index / (steps - 1);
      const time = round(start + (end - start) * progress);
      const value = isIn ? 0.01 + (base.scaleX - 0.01) * progress : base.scaleX - (base.scaleX - 0.01) * progress;
      return [time, value, 'linear'];
    });
    add(output, 'scaleX', clipDuration, preset, phase, frames);
    add(output, 'opacity', clipDuration, preset, phase, [
      [start, base.opacity, 'linear'],
      [end, base.opacity, 'linear']
    ]);
    return;
  }

  if (preset === 'bounce') {
    add(output, 'opacity', clipDuration, preset, phase, [
      [start, isIn ? 0 : base.opacity, 'ease-out'],
      [end, isIn ? base.opacity : 0, 'ease-in']
    ]);
    if (isIn) {
      add(output, 'y', clipDuration, preset, phase, [
        [start, base.y + 0.22, 'ease-out'],
        [round(start + (end - start) * 0.6), base.y - 0.08, 'ease-out'],
        [round(start + (end - start) * 0.82), base.y + 0.03, 'ease-in-out'],
        [end, base.y, 'ease-in-out']
      ]);
    } else {
      add(output, 'y', clipDuration, preset, phase, [
        [start, base.y, 'ease-in'],
        [round(start + (end - start) * 0.3), base.y - 0.05, 'ease-in'],
        [end, base.y + 0.22, 'ease-in']
      ]);
    }
    return;
  }

  add(output, 'opacity', clipDuration, preset, phase, [
    [start, isIn ? 0 : base.opacity, isIn ? 'ease-out' : 'ease-in'],
    [end, isIn ? base.opacity : 0, isIn ? 'ease-out' : 'ease-in']
  ]);
  const scaleFrames: FrameTuple[] = isIn
    ? [
        [start, minScale, 'ease-out'],
        [round(start + (end - start) * 0.72), Math.max(base.scaleX, overshoot), 'ease-out'],
        [end, base.scaleX, 'ease-in-out']
      ]
    : [
        [start, base.scaleX, 'ease-in-out'],
        [round(start + (end - start) * 0.28), Math.max(base.scaleX, overshoot), 'ease-in'],
        [end, minScale, 'ease-in']
      ];
  add(output, 'scaleX', clipDuration, preset, phase, scaleFrames);
  add(
    output,
    'scaleY',
    clipDuration,
    preset,
    phase,
    scaleFrames.map(([time, value, easing]) => [time, value === base.scaleX ? base.scaleY : value, easing])
  );
}

type FrameTuple = [time: number, value: number, easing: Keyframe<number>['easing']];

function add(
  output: ClipKeyframes,
  property: KeyframeProperty,
  clipDuration: number,
  preset: TextAnimationPreset,
  phase: Extract<TextAnimationDirection, 'in' | 'out'>,
  frames: FrameTuple[]
): void {
  output[property] = [
    ...(output[property] ?? []),
    ...frames.map(([time, value, easing], index) =>
      createKeyframe(property, { id: `text-animation-${preset}-${phase}-${property}-${index}`, time, value, easing }, clipDuration)
    )
  ];
}

function normalizeTextAnimationTransform(transform: Partial<Transform>): Required<Pick<Transform, 'x' | 'y' | 'opacity' | 'scaleX' | 'scaleY'>> {
  const scale = finiteOrDefault(transform.scale, 1);
  return {
    x: round(finiteOrDefault(transform.x, 0)),
    y: round(finiteOrDefault(transform.y, 0)),
    opacity: round(Math.min(1, Math.max(0, finiteOrDefault(transform.opacity, 1)))),
    scaleX: round(Math.min(4, Math.max(0.01, finiteOrDefault(transform.scaleX, scale)))),
    scaleY: round(Math.min(4, Math.max(0.01, finiteOrDefault(transform.scaleY, scale))))
  };
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
