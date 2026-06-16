import earcut from 'earcut';

import { round } from '../time';
import type { PathPoint, PathPointHandle } from '../model-types';

export interface TriangulatedPathMask {
  vertices: number[];
  indices: number[];
}

const PATH_CLOSE_EPSILON = 0.01;
const CURVE_SEGMENTS = 12;

export function isPathMaskClosed(points: PathPoint[] | undefined, epsilon = PATH_CLOSE_EPSILON): boolean {
  if (!Array.isArray(points) || points.length < 4) {
    return false;
  }
  const first = points[0];
  const last = points[points.length - 1];
  return Math.hypot(first.x - last.x, first.y - last.y) <= epsilon;
}

export function normalizePathPoints(points: PathPoint[] | undefined): PathPoint[] {
  if (!Array.isArray(points)) {
    return [];
  }
  return points
    .map((point) => normalizePathPoint(point))
    .filter((point): point is PathPoint => Boolean(point));
}

export function closePathPoints(points: PathPoint[] | undefined): PathPoint[] {
  const normalized = normalizePathPoints(points);
  if (normalized.length < 3 || isPathMaskClosed(normalized)) {
    return normalized;
  }
  return [...normalized, { ...normalized[0], handleIn: cloneHandle(normalized[0].handleIn), handleOut: cloneHandle(normalized[0].handleOut) }];
}

export function samplePathPoints(points: PathPoint[] | undefined, segmentsPerCurve = CURVE_SEGMENTS): PathPointHandle[] {
  const normalized = normalizePathPoints(points);
  if (!isPathMaskClosed(normalized)) {
    return [];
  }
  const anchors = normalized.slice(0, -1);
  if (anchors.length < 3) {
    return [];
  }
  const samples: PathPointHandle[] = [];
  for (let index = 0; index < anchors.length; index += 1) {
    const from = anchors[index];
    const to = anchors[(index + 1) % anchors.length];
    if (index === 0) {
      samples.push({ x: from.x, y: from.y });
    }
    const hasCurve = Boolean(from.handleOut || to.handleIn);
    if (!hasCurve) {
      samples.push({ x: to.x, y: to.y });
      continue;
    }
    const control1 = from.handleOut ?? from;
    const control2 = to.handleIn ?? to;
    const steps = Math.max(2, Math.round(segmentsPerCurve));
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      samples.push(sampleCubicBezier(from, control1, control2, to, t));
    }
  }
  return removeClosingDuplicate(samples);
}

export function triangulatePathMask(points: PathPoint[] | undefined): TriangulatedPathMask {
  const samples = samplePathPoints(points);
  if (samples.length < 3) {
    return { vertices: [], indices: [] };
  }
  const vertices = samples.flatMap((point) => [point.x, point.y]);
  return { vertices, indices: earcut(vertices, undefined, 2) };
}

export function pathPointsToSvgPath(points: PathPoint[] | undefined, width = 1, height = 1): string {
  const normalized = normalizePathPoints(points);
  if (normalized.length === 0) {
    return '';
  }
  const commands = [`M ${formatSvgNumber(normalized[0].x * width)} ${formatSvgNumber(normalized[0].y * height)}`];
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const point = normalized[index];
    if (previous.handleOut || point.handleIn) {
      const control1 = previous.handleOut ?? previous;
      const control2 = point.handleIn ?? point;
      commands.push(
        `C ${formatSvgNumber(control1.x * width)} ${formatSvgNumber(control1.y * height)} ${formatSvgNumber(control2.x * width)} ${formatSvgNumber(control2.y * height)} ${formatSvgNumber(
          point.x * width
        )} ${formatSvgNumber(point.y * height)}`
      );
    } else {
      commands.push(`L ${formatSvgNumber(point.x * width)} ${formatSvgNumber(point.y * height)}`);
    }
  }
  if (isPathMaskClosed(normalized)) {
    commands.push('Z');
  }
  return commands.join(' ');
}

function normalizePathPoint(point: Partial<PathPoint> | undefined): PathPoint | undefined {
  if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return undefined;
  }
  const normalized: PathPoint = {
    x: normalizeUnit(point.x),
    y: normalizeUnit(point.y)
  };
  const handleIn = normalizeHandle(point.handleIn);
  const handleOut = normalizeHandle(point.handleOut);
  if (handleIn) {
    normalized.handleIn = handleIn;
  }
  if (handleOut) {
    normalized.handleOut = handleOut;
  }
  return normalized;
}

function normalizeHandle(handle: Partial<PathPointHandle> | undefined): PathPointHandle | undefined {
  if (!handle || typeof handle.x !== 'number' || typeof handle.y !== 'number' || !Number.isFinite(handle.x) || !Number.isFinite(handle.y)) {
    return undefined;
  }
  return {
    x: normalizeUnit(handle.x),
    y: normalizeUnit(handle.y)
  };
}

function cloneHandle(handle: PathPointHandle | undefined): PathPointHandle | undefined {
  return handle ? { ...handle } : undefined;
}

function normalizeUnit(value: number): number {
  return round(Math.min(1, Math.max(0, value)));
}

function sampleCubicBezier(from: PathPointHandle, control1: PathPointHandle, control2: PathPointHandle, to: PathPointHandle, t: number): PathPointHandle {
  const inverse = 1 - t;
  return {
    x: round(inverse ** 3 * from.x + 3 * inverse ** 2 * t * control1.x + 3 * inverse * t ** 2 * control2.x + t ** 3 * to.x),
    y: round(inverse ** 3 * from.y + 3 * inverse ** 2 * t * control1.y + 3 * inverse * t ** 2 * control2.y + t ** 3 * to.y)
  };
}

function removeClosingDuplicate(points: PathPointHandle[]): PathPointHandle[] {
  if (points.length < 2) {
    return points;
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) <= PATH_CLOSE_EPSILON) {
    return points.slice(0, -1);
  }
  return points;
}

function formatSvgNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
