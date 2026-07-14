import { interpolateKeyframes } from './keyframes';
import { normalizePathPoints } from './masks/path-mask';
import type { ClipKeyframes, PathPoint, PathPointHandle, TextPathOptions } from './model';
import { round } from './time';

export interface TextPathSample {
  x: number;
  y: number;
  distance: number;
  angle: number;
}

export interface TextPathCharacterLayout {
  char: string;
  index: number;
  x: number;
  y: number;
  angle: number;
  distance: number;
}

export interface TextPathLayoutInput {
  text: string;
  path: PathPoint[] | undefined;
  width: number;
  height: number;
  fontSize: number;
  startOffset: number;
  letterSpacing: number;
  rotateCharacters: boolean;
  offsetX?: number;
  offsetY?: number;
  measureCharacter?: (char: string, index: number) => number;
}

export interface PathTextFrameLayoutInput extends Omit<TextPathLayoutInput, 'startOffset'> {
  duration: number;
  fps: number;
  keyframes?: ClipKeyframes | null;
  pathText: TextPathOptions;
}

export interface PathTextFrameLayout {
  time: number;
  chars: TextPathCharacterLayout[];
}

const TEXT_PATH_SEGMENTS_PER_CURVE = 24;

export function sampleTextPath(
  points: PathPoint[] | undefined,
  width = 1,
  height = 1,
  segmentsPerCurve = TEXT_PATH_SEGMENTS_PER_CURVE,
): TextPathSample[] {
  const normalized = normalizePathPoints(points);
  if (normalized.length < 2) {
    return [];
  }
  const raw: PathPointHandle[] = [];
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const from = scalePoint(normalized[index], width, height);
    const to = scalePoint(normalized[index + 1], width, height);
    if (raw.length === 0) {
      raw.push(from);
    }
    if (normalized[index].handleOut || normalized[index + 1].handleIn) {
      const control1 = scalePoint(normalized[index].handleOut ?? normalized[index], width, height);
      const control2 = scalePoint(normalized[index + 1].handleIn ?? normalized[index + 1], width, height);
      const steps = Math.max(2, Math.round(segmentsPerCurve));
      for (let step = 1; step <= steps; step += 1) {
        raw.push(sampleCubicBezier(from, control1, control2, to, step / steps));
      }
    } else {
      raw.push(to);
    }
  }
  return buildDistanceSamples(removeDuplicateSamples(raw));
}

export function getTextPathLength(points: PathPoint[] | undefined, width = 1, height = 1): number {
  return sampleTextPath(points, width, height).at(-1)?.distance ?? 0;
}

export function layoutTextAlongPath(input: TextPathLayoutInput): TextPathCharacterLayout[] {
  const samples = sampleTextPath(input.path, input.width, input.height);
  const totalLength = samples.at(-1)?.distance ?? 0;
  if (samples.length < 2 || totalLength <= 0) {
    return [];
  }
  const chars = Array.from(input.text ?? '');
  let cursor = totalLength * normalizeUnit(input.startOffset);
  const spacing = Math.max(0, finiteOrDefault(input.letterSpacing, 0));
  const offsetX = finiteOrDefault(input.offsetX, 0);
  const offsetY = finiteOrDefault(input.offsetY, 0);
  const output: TextPathCharacterLayout[] = [];
  chars.forEach((char, index) => {
    const advance = Math.max(
      1,
      input.measureCharacter?.(char, index) ?? estimateCharacterAdvance(char, input.fontSize),
    );
    const distance = cursor + advance / 2;
    if (distance >= 0 && distance <= totalLength) {
      const point = sampleTextPathAtDistance(samples, distance);
      output.push({
        char,
        index,
        x: round(point.x + offsetX),
        y: round(point.y + offsetY),
        angle: input.rotateCharacters ? point.angle : 0,
        distance: round(distance),
      });
    }
    cursor += advance + spacing;
  });
  return output;
}

export function buildPathTextFrameLayouts(input: PathTextFrameLayoutInput): PathTextFrameLayout[] {
  const fps = Math.max(1, finiteOrDefault(input.fps, 30));
  const frameCount = Math.max(1, Math.ceil(Math.max(input.duration, 1 / fps) * fps));
  return Array.from({ length: frameCount }, (_, frameIndex) => {
    const time = round(frameIndex / fps);
    const startOffset = resolvePathTextStartOffset(input.pathText, input.keyframes, time);
    return {
      time,
      chars: layoutTextAlongPath({
        ...input,
        path: input.pathText.path,
        startOffset,
        letterSpacing: input.pathText.letterSpacing,
        rotateCharacters: input.pathText.rotateCharacters,
      }),
    };
  });
}

export function resolvePathTextStartOffset(
  pathText: TextPathOptions,
  keyframes: ClipKeyframes | null | undefined,
  localTime: number,
): number {
  return normalizeUnit(interpolateKeyframes(keyframes?.pathStartOffset, localTime, pathText.startOffset));
}

function sampleTextPathAtDistance(samples: TextPathSample[], distance: number): TextPathSample {
  if (distance <= samples[0].distance) {
    return samples[0];
  }
  const last = samples[samples.length - 1];
  if (distance >= last.distance) {
    return last;
  }
  for (let index = 1; index < samples.length; index += 1) {
    const right = samples[index];
    const left = samples[index - 1];
    if (distance > right.distance) {
      continue;
    }
    const span = Math.max(0.000001, right.distance - left.distance);
    const progress = (distance - left.distance) / span;
    return {
      x: round(left.x + (right.x - left.x) * progress),
      y: round(left.y + (right.y - left.y) * progress),
      distance: round(distance),
      angle: right.angle,
    };
  }
  return last;
}

function buildDistanceSamples(points: PathPointHandle[]): TextPathSample[] {
  if (points.length < 2) {
    return [];
  }
  let distance = 0;
  return points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    if (index > 0) {
      distance += Math.hypot(point.x - previous.x, point.y - previous.y);
    }
    return {
      x: round(point.x),
      y: round(point.y),
      distance: round(distance),
      angle: round((Math.atan2(next.y - previous.y, next.x - previous.x) * 180) / Math.PI),
    };
  });
}

function removeDuplicateSamples(points: PathPointHandle[]): PathPointHandle[] {
  return points.filter(
    (point, index) =>
      index === 0 || Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) > 0.000001,
  );
}

function scalePoint(point: PathPointHandle, width: number, height: number): PathPointHandle {
  return {
    x: point.x * Math.max(1, width),
    y: point.y * Math.max(1, height),
  };
}

function sampleCubicBezier(
  from: PathPointHandle,
  control1: PathPointHandle,
  control2: PathPointHandle,
  to: PathPointHandle,
  t: number,
): PathPointHandle {
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * from.x + 3 * inverse ** 2 * t * control1.x + 3 * inverse * t ** 2 * control2.x + t ** 3 * to.x,
    y: inverse ** 3 * from.y + 3 * inverse ** 2 * t * control1.y + 3 * inverse * t ** 2 * control2.y + t ** 3 * to.y,
  };
}

function estimateCharacterAdvance(char: string, fontSize: number): number {
  if (char.trim().length === 0) {
    return Math.max(1, fontSize * 0.35);
  }
  return Math.max(1, fontSize * (char.charCodeAt(0) > 255 ? 0.95 : 0.6));
}

function normalizeUnit(value: number): number {
  return round(Math.min(1, Math.max(0, finiteOrDefault(value, 0))));
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
