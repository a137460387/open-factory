import type {CSSProperties} from 'react';
import type {CanvasPoint, CanvasTransformHandle, ChromaKeyColor, Clip, ClipTransformBox, PathPoint, PathPointHandle, Project, Timeline} from '@open-factory/editor-core';
import {buildClipTransformBox, getRenderableTracks, isPathMaskClosed} from '@open-factory/editor-core';
import type {EditableCanvasClip, PreviewPixelRead} from './types';
import {PREVIEW_CANVAS_WIDTH, PREVIEW_CANVAS_HEIGHT} from './types';
import type {PreviewPixelCoordinates} from '../../lib/preview/frame-inspector';
import {calculatePreviewPixelCoordinates, rgbToHsl, rgbToHex} from '../../lib/preview/frame-inspector';
import type {FrameInspectorSample} from './types';

export function readPreviewCanvasPixel(
  canvas: HTMLCanvasElement,
  bounds: DOMRect,
  event: { clientX: number; clientY: number },
): PreviewPixelRead | undefined {
  const gl = canvas.getContext('webgl');
  if (!gl) {
    return undefined;
  }
  const coordinates = calculatePreviewPixelCoordinates({
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    boundsWidth: bounds.width,
    boundsHeight: bounds.height,
    offsetX: event.clientX - bounds.left,
    offsetY: event.clientY - bounds.top,
  });
  const pixel = new Uint8Array(4);
  gl.readPixels(coordinates.x, coordinates.webglY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return {
    coordinates,
    rgb: [pixel[0], pixel[1], pixel[2]],
    swatches: readPreviewCanvasPixelSwatches(gl, coordinates, canvas.width, canvas.height),
  };
}

function readPreviewCanvasPixelSwatches(
  gl: WebGLRenderingContext,
  coordinates: PreviewPixelCoordinates,
  width: number,
  height: number,
): ChromaKeyColor[] {
  const swatches: ChromaKeyColor[] = [];
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = Math.min(width - 1, Math.max(0, coordinates.x + dx));
      const y = Math.min(height - 1, Math.max(0, coordinates.y + dy));
      const pixel = new Uint8Array(4);
      gl.readPixels(x, height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      swatches.push([pixel[0], pixel[1], pixel[2]]);
    }
  }
  return swatches;
}

export function readFrameInspectorSampleImpl(
  event: { clientX: number; clientY: number },
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  previewSurfaceRef: React.RefObject<HTMLDivElement | null>,
  compareFrameRef: React.RefObject<HTMLDivElement | null>,
): FrameInspectorSample | undefined {
  const canvas = canvasRef.current;
  const bounds = previewSurfaceRef.current?.getBoundingClientRect();
  const frameBounds = compareFrameRef.current?.getBoundingClientRect();
  if (!canvas || !bounds || !frameBounds) {
    return undefined;
  }
  const result = readPreviewCanvasPixel(canvas, bounds, event);
  if (!result) {
    return undefined;
  }
  const hsl = rgbToHsl(result.rgb);
  return {
    ...result,
    hsl,
    hex: rgbToHex(result.rgb),
    position: {
      x: Math.min(Math.max(12, event.clientX - frameBounds.left + 12), Math.max(12, frameBounds.width - 230)),
      y: Math.min(Math.max(12, event.clientY - frameBounds.top + 12), Math.max(12, frameBounds.height - 210)),
    },
  };
}

export function drawAudioOnlyPreview(canvas: HTMLCanvasElement, label: string): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#141820';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(255, 255, 255, 0.72)';
  context.font = `${Math.max(12, Math.round(canvas.height * 0.035))}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, canvas.width / 2, canvas.height / 2);
}

export function buildEditableCanvasClips(project: Project, playheadTime: number): EditableCanvasClip[] {
  return getRenderableTracks(project.timeline).flatMap((track) =>
    track.clips
      .filter(
        (clip) => isCanvasEditableClip(clip) && playheadTime >= clip.start && playheadTime < clip.start + clip.duration,
      )
      .map((clip) => {
        const dimensions = getCanvasClipSourceDimensions(project, clip);
        return {
          clip,
          sourceWidth: dimensions.width,
          sourceHeight: dimensions.height,
          box: buildClipTransformBox({
            transform: clip.transform,
            sourceWidth: dimensions.width,
            sourceHeight: dimensions.height,
            canvasWidth: PREVIEW_CANVAS_WIDTH,
            canvasHeight: PREVIEW_CANVAS_HEIGHT,
          }),
        };
      }),
  );
}

function isCanvasEditableClip(clip: Clip): boolean {
  return (
    clip.type === 'video' ||
    clip.type === 'image' ||
    clip.type === 'text' ||
    clip.type === 'credits' ||
    clip.type === 'nested-sequence'
  );
}

function getCanvasClipSourceDimensions(project: Project, clip: Clip): { width: number; height: number } {
  if (clip.type === 'text' || clip.type === 'credits') {
    return { width: 1024, height: 256 };
  }
  if (clip.type === 'nested-sequence') {
    return { width: PREVIEW_CANVAS_WIDTH, height: PREVIEW_CANVAS_HEIGHT };
  }
  if ('mediaId' in clip) {
    const asset = project.media.find((item) => item.id === clip.mediaId);
    return {
      width: Math.max(1, asset?.width || PREVIEW_CANVAS_WIDTH),
      height: Math.max(1, asset?.height || PREVIEW_CANVAS_HEIGHT),
    };
  }
  return { width: PREVIEW_CANVAS_WIDTH, height: PREVIEW_CANVAS_HEIGHT };
}

export function canvasPointToPathPoint(point: CanvasPoint, item: EditableCanvasClip): PathPoint {
  const local = canvasPointToClipLocal(point, item.box);
  return {
    x: clampPathUnit((local.x + item.box.width / 2) / Math.max(1, item.box.width)),
    y: clampPathUnit((local.y + item.box.height / 2) / Math.max(1, item.box.height)),
  };
}

export function pathPointToCanvasPoint(point: PathPointHandle, item: EditableCanvasClip): CanvasPoint {
  return clipLocalToCanvasPoint(
    {
      x: point.x * item.box.width - item.box.width / 2,
      y: point.y * item.box.height - item.box.height / 2,
    },
    item.box,
  );
}

function canvasPointToClipLocal(point: CanvasPoint, box: Pick<ClipTransformBox, 'center' | 'rotation'>): CanvasPoint {
  const radians = (-box.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const x = point.x - box.center.x;
  const y = point.y - box.center.y;
  return {
    x: roundCanvasValue(x * cos - y * sin),
    y: roundCanvasValue(x * sin + y * cos),
  };
}

function clipLocalToCanvasPoint(point: CanvasPoint, box: Pick<ClipTransformBox, 'center' | 'rotation'>): CanvasPoint {
  const radians = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: roundCanvasValue(box.center.x + point.x * cos - point.y * sin),
    y: roundCanvasValue(box.center.y + point.x * sin + point.y * cos),
  };
}

export function buildPathMaskDragPatch(
  drag: import('./types').PathMaskDrag,
  point: PathPointHandle,
): { path: PathPoint[] } {
  const path = clonePathPoints(drag.startPath);
  const current = path[drag.pointIndex];
  if (!current) {
    return { path };
  }
  if (drag.target === 'anchor') {
    const delta = { x: point.x - drag.startPoint.x, y: point.y - drag.startPoint.y };
    path[drag.pointIndex] = movePathAnchor(current, point, delta);
    const closingIndex = path.length - 1;
    if (isPathMaskClosed(drag.startPath)) {
      if (drag.pointIndex === 0 && path[closingIndex]) {
        path[closingIndex] = movePathAnchor(path[closingIndex], point, delta);
      } else if (drag.pointIndex === closingIndex && path[0]) {
        path[0] = movePathAnchor(path[0], point, delta);
      }
    }
    return { path };
  }
  path[drag.pointIndex] = {
    ...current,
    [drag.target]: { x: clampPathUnit(point.x), y: clampPathUnit(point.y) },
  };
  return { path };
}

function movePathAnchor(point: PathPoint, next: PathPointHandle, delta: PathPointHandle): PathPoint {
  return {
    ...point,
    x: clampPathUnit(next.x),
    y: clampPathUnit(next.y),
    handleIn: point.handleIn
      ? { x: clampPathUnit(point.handleIn.x + delta.x), y: clampPathUnit(point.handleIn.y + delta.y) }
      : undefined,
    handleOut: point.handleOut
      ? { x: clampPathUnit(point.handleOut.x + delta.x), y: clampPathUnit(point.handleOut.y + delta.y) }
      : undefined,
  };
}

export function clonePathPoints(points: PathPoint[]): PathPoint[] {
  return points.map((point) => ({
    x: point.x,
    y: point.y,
    ...(point.handleIn ? { handleIn: { ...point.handleIn } } : {}),
    ...(point.handleOut ? { handleOut: { ...point.handleOut } } : {}),
  }));
}

export function resolvePathHandle(point: PathPoint, key: 'handleIn' | 'handleOut'): PathPointHandle {
  const fallback = key === 'handleIn' ? -0.08 : 0.08;
  return point[key] ?? { x: clampPathUnit(point.x + fallback), y: point.y };
}

export function buildCanvasPathMaskSvgPath(points: PathPoint[], item: EditableCanvasClip): string {
  if (points.length === 0) {
    return '';
  }
  const first = pathPointToCanvasPoint(points[0], item);
  const commands = [`M ${formatSvgNumber(first.x)} ${formatSvgNumber(first.y)}`];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const target = pathPointToCanvasPoint(point, item);
    if (previous.handleOut || point.handleIn) {
      const control1 = pathPointToCanvasPoint(previous.handleOut ?? previous, item);
      const control2 = pathPointToCanvasPoint(point.handleIn ?? point, item);
      commands.push(
        `C ${formatSvgNumber(control1.x)} ${formatSvgNumber(control1.y)} ${formatSvgNumber(control2.x)} ${formatSvgNumber(control2.y)} ${formatSvgNumber(target.x)} ${formatSvgNumber(target.y)}`,
      );
    } else {
      commands.push(`L ${formatSvgNumber(target.x)} ${formatSvgNumber(target.y)}`);
    }
  }
  if (isPathMaskClosed(points)) {
    commands.push('Z');
  }
  return commands.join(' ');
}

function formatSvgNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export function clampPathUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000;
}

function roundCanvasValue(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function canvasPointStyle(point: CanvasPoint): CSSProperties {
  return {
    left: `${(point.x / PREVIEW_CANVAS_WIDTH) * 100}%`,
    top: `${(point.y / PREVIEW_CANVAS_HEIGHT) * 100}%`,
    transform: 'translate(-50%, -50%)',
  };
}

export function canvasBoxStyle(box: ClipTransformBox): CSSProperties {
  return {
    left: `${(box.center.x / PREVIEW_CANVAS_WIDTH) * 100}%`,
    top: `${(box.center.y / PREVIEW_CANVAS_HEIGHT) * 100}%`,
    width: `${(box.width / PREVIEW_CANVAS_WIDTH) * 100}%`,
    height: `${(box.height / PREVIEW_CANVAS_HEIGHT) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${box.rotation}deg)`,
  };
}

export function canvasHandleCursor(handle: CanvasTransformHandle): CSSProperties['cursor'] {
  if (handle === 'n' || handle === 's') {
    return 'ns-resize';
  }
  if (handle === 'e' || handle === 'w') {
    return 'ew-resize';
  }
  if (handle === 'ne' || handle === 'sw') {
    return 'nesw-resize';
  }
  return 'nwse-resize';
}

export function rgbCss(color: ChromaKeyColor): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

export function countActivePreviewEffects(timeline: Timeline, playheadTime: number): number {
  return getRenderableTracks(timeline)
    .flatMap((track) => track.clips)
    .filter((clip) => playheadTime >= clip.start && playheadTime < clip.start + clip.duration)
    .reduce(
      (total, clip) =>
        total + (clip.effects ?? []).filter((effect) => effect.enabled).length + (clip.colorNodeGraph ? 1 : 0),
      0,
    );
}

export function hasActiveCustomShader(timeline: Timeline, playheadTime: number): boolean {
  return getRenderableTracks(timeline)
    .flatMap((track) => track.clips)
    .filter((clip) => playheadTime >= clip.start && playheadTime < clip.start + clip.duration)
    .some((clip) => (clip.effects ?? []).some((effect) => effect.enabled && effect.type === 'custom-shader'));
}

export function buildReviewAnnotationGeometry(
  drag: import('./types').ReviewAnnotationDrag,
  point: CanvasPoint,
): Pick<import('@open-factory/editor-core').ReviewAnnotation, 'x' | 'y' | 'width' | 'height'> {
  if (drag.type === 'arrow') {
    const width = (point.x - drag.startPoint.x) / drag.canvasWidth;
    const height = (point.y - drag.startPoint.y) / drag.canvasHeight;
    return {
      x: drag.startPoint.x / drag.canvasWidth,
      y: drag.startPoint.y / drag.canvasHeight,
      width: Math.abs(width) < 0.01 ? 0.12 : width,
      height: Math.abs(height) < 0.01 ? 0.12 : height,
    };
  }
  const startX = drag.startPoint.x / drag.canvasWidth;
  const startY = drag.startPoint.y / drag.canvasHeight;
  const endX = point.x / drag.canvasWidth;
  const endY = point.y / drag.canvasHeight;
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: width < 0.01 ? 0.18 : width,
    height: height < 0.01 ? 0.12 : height,
  };
}

export function waitForIdleFrame(): Promise<void> {
  return new Promise((resolve) => {
    const idle = (
      window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }
    ).requestIdleCallback;
    if (idle) {
      idle(() => resolve(), { timeout: 50 });
      return;
    }
    window.requestAnimationFrame(() => resolve());
  });
}

export function getAdaptiveQualityIndicatorClass(status: ReturnType<typeof import('../../lib/preview/preview-performance').getPreviewAdaptiveQualityStatus>): string {
  if (status === 'degraded') {
    return 'bg-amber-400';
  }
  if (status === 'low') {
    return 'bg-rose-500';
  }
  return 'bg-emerald-400';
}

export function isFrameJumpLikeQuery(query: string): boolean {
  const trimmed = query.trim();
  return (trimmed.includes(':') && /^[\d:]+$/.test(trimmed)) || /^f/i.test(trimmed);
}

export function buildFrameSearchCandidates(project: Project, query: string): import('./types').FrameSearchCandidate[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const markerCandidates = (project.timeline.markers ?? [])
    .filter((m) => m.label.toLowerCase().includes(normalizedQuery))
    .map((m): import('./types').FrameSearchCandidate => ({ id: m.id, type: 'marker', label: m.label, time: m.time }));
  const clipCandidates = project.timeline.tracks.flatMap((tr) =>
    tr.clips
      .filter((c) => {
        const asset = 'mediaId' in c ? project.media.find((a) => a.id === (c as any).mediaId) : undefined;
        return [c.name, asset?.name, asset?.path].some((v) => v?.toLowerCase().includes(normalizedQuery));
      })
      .map((c): import('./types').FrameSearchCandidate => ({ id: c.id, type: 'clip', label: c.name, time: c.start })),
  );
  return [...markerCandidates, ...clipCandidates]
    .sort((l, r) =>
      (l.label.toLowerCase().startsWith(normalizedQuery) ? 0 : 1) -
      (r.label.toLowerCase().startsWith(normalizedQuery) ? 0 : 1) ||
      l.time - r.time || l.label.localeCompare(r.label),
    )
    .slice(0, 8);
}
