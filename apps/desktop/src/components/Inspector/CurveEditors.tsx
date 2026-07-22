import {
  EASING_PRESETS,
  getEasingPresetsByCategory,
  getPresetHandles,
  isStepsPreset,
  applyStepsEasing,
  clamp01,
  clamp,
  type EasingPreset,
  type EasingPresetCategory,
} from '@open-factory/editor-core';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { Clip, Project, ProjectSettings } from '@open-factory/editor-core';
import {
  BatchProofreadSubtitleCommand,
  BatchShiftSubtitleCommand,
  BatchSubtitleTimingCommand,
  UpdateClipCommand,
  BUILTIN_AUDIO_VISUALIZATION_THEMES,
  CUSTOM_SHADER_EXAMPLES,
  AUDIO_SPECTRUM_POSITIONS,
  AUDIO_SPECTRUM_STYLES,
  DEFAULT_EFFECT_PARAMS,
  DEFAULT_SUBTITLE_PROOFREADING_SETTINGS,
  DEFAULT_THREE_WAY_COLOR,
  EFFECT_TYPES,
  KEYFRAME_PROPERTY_LIMITS,
  MANUAL_AUDIO_VISUALIZATION_THEME_ID,
  MAX_CLIP_SPEED,
  MIN_CLIP_SPEED,
  MOTION_BLUR_SAMPLE_COUNTS,
  MOTION_GRAPHIC_TEMPLATE_TYPES,
  applyKeyframeHandlePatch,
  calculateBezierHandleCoordinates,
  calculateKeyframeSpeedSamples,
  analyzeSubtitleProofreading,
  buildSubtitleProofreadingFixes,
  serializeSubtitleProofreadingCsv,
  calculateSubtitleBatchAdjustUpdates,
  calculateSubtitlePeakAlignUpdate,
  calculateSubtitleScaleUpdates,
  createDefaultColorCurves,
  createDefaultMotionGraphic,
  createId,
  getClipSpeed,
  getEffectNumberParam,
  getEffectStringParam,
  getMotionGraphicTemplateDefinition,
  getTimelineDuration,
  interpolateKeyframes,
  normalizeAudioSpectrumParams,
  normalizeColorCurves,
  normalizeColorWheelValue,
  normalizeCurvePoints,
  normalizeCustomShaderParams,
  normalizeMotionBlurParams,
  normalizeMotionGraphic,
  normalizePrivacyBlurEffect,
  normalizeRichTextDocument,
  normalizeThreeWayColor,
  renderSubtitleStyleTemplatePreview,
  richTextToPlainText,
  sampleCurve,
  secondsToTimecode,
  setMotionGraphicParam,
  setMotionGraphicParamKeyframe,
  type ClipSlowMotionMode,
  type ColorCurves,
  type ColorWheelValue,
  type CurvePoint,
  type Effect,
  type EffectType,
  type EffectPatch,
  type ClipMask,
  type FrameInterpolationCompareMode,
  type InputColorSpace,
  type Keyframe,
  type KeyframeEasing,
  type KeyframeHandleMode,
  type KeyframeProperty,
  type MaskPatch,
  type MotionGraphicParamDefinition,
  type MotionGraphicParamValue,
  type MotionGraphicTemplateType,
  type PrivacyBlurEffect,
  type RichTextDocument,
  type RichTextRun,
  type SubtitleProofreadingIssue,
  type SubtitleProofreadingIssueType,
  type SubtitleStyleTemplate,
  type ThreeWayColor,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useEditorStore, type SelectedKeyframeRef } from '../../store/editorStore';

// ---------------------------------------------------------------------------
// Speed curve helpers
// ---------------------------------------------------------------------------

export type SpeedCurveFrame = { id: string; time: number; value: number; easing: KeyframeEasing };

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
  const x = clampUnit((event.clientX - rect.left) / rect.width);
  const y = clampUnit((event.clientY - rect.top) / rect.height);
  return {
    id: createId('speed-keyframe'),
    time: roundFinite(x * duration),
    value: roundFinite(MIN_CLIP_SPEED + (1 - y) * (MAX_CLIP_SPEED - MIN_CLIP_SPEED)),
    easing: 'linear',
  };
}

export function drawSpeedCurveCanvas(canvas: HTMLCanvasElement, frames: SpeedCurveFrame[], duration: number): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  context.lineWidth = 1;
  for (let index = 1; index < 4; index += 1) {
    const x = (index / 4) * width;
    const y = (index / 4) * height;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  const normalized = normalizeSpeedCurveFrames(frames, duration);
  context.strokeStyle = '#2d6cdf';
  context.lineWidth = 2;
  context.beginPath();
  normalized.forEach((frame, index) => {
    const point = speedFrameToPoint(frame, duration, width, height);
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.stroke();
  for (const frame of normalized) {
    const point = speedFrameToPoint(frame, duration, width, height);
    context.beginPath();
    context.fillStyle = '#ffffff';
    context.arc(point.x, point.y, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#2d6cdf';
    context.lineWidth = 2;
    context.stroke();
  }
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

// ---------------------------------------------------------------------------
// SpeedCurveEditor component
// ---------------------------------------------------------------------------

export function SpeedCurveEditor({ clip, onCommit }: { clip: Clip; onCommit(frames: SpeedCurveFrame[]): void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [draft, setDraft] = useState<SpeedCurveFrame[]>(() => getSpeedCurveFrames(clip));
  const draftRef = useRef(draft);
  const duration = Math.max(0.001, clip.duration);

  useEffect(() => {
    const next = getSpeedCurveFrames(clip);
    draftRef.current = next;
    setDraft(next);
  }, [clip]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawSpeedCurveCanvas(canvas, draft, duration);
    }
  }, [draft, duration]);

  const updateDraft = (frames: SpeedCurveFrame[]) => {
    const next = normalizeSpeedCurveFrames(frames, duration);
    draftRef.current = next;
    setDraft(next);
  };
  const commitDraft = () => onCommit(normalizeSpeedCurveFrames(draftRef.current, duration));
  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const frame = eventToSpeedFrame(event, canvas, duration);
    const frames = normalizeSpeedCurveFrames(draftRef.current, duration);
    const nearest = findNearestSpeedFrame(frames, frame, duration, 0.06);
    if (nearest === null) {
      const nextFrames = normalizeSpeedCurveFrames([...frames, frame], duration);
      dragIndexRef.current = findNearestSpeedFrame(nextFrames, frame, duration, 1) ?? nextFrames.length - 1;
      updateDraft(nextFrames);
    } else {
      dragIndexRef.current = nearest;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const dragIndex = dragIndexRef.current;
    if (!canvas || dragIndex === null) {
      return;
    }
    const next = [...draftRef.current];
    next[dragIndex] = {
      ...next[dragIndex],
      ...eventToSpeedFrame(event, canvas, duration),
      id: next[dragIndex]?.id ?? createId('speed-keyframe'),
    };
    updateDraft(next);
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragIndexRef.current !== null) {
      dragIndexRef.current = null;
      commitDraft();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleDoubleClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || draftRef.current.length <= 2) {
      return;
    }
    const frame = eventToSpeedFrame(event, canvas, duration);
    const nearest = findNearestSpeedFrame(draftRef.current, frame, duration, 0.06);
    if (nearest === null) {
      return;
    }
    const next = draftRef.current.filter((_, index) => index !== nearest);
    updateDraft(next);
    onCommit(normalizeSpeedCurveFrames(next, duration));
  };

  return (
    <div className="rounded-md border border-line bg-panel p-2" data-testid="speed-curve-editor">
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--color-text-muted)]">
        <span>{zhCN.inspector.fields.speedCurve}</span>
        <span>
          {zhCN.inspector.fields.speedCurveMin} - {zhCN.inspector.fields.speedCurveMax}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="block h-28 w-full touch-none rounded border border-line bg-slate-950"
        width={256}
        height={112}
        data-testid="speed-curve-editor-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keyframe curve editor types & helpers
// ---------------------------------------------------------------------------

export type CurveEditorDrag =
  | { mode: 'box'; start: CanvasPoint; current: CanvasPoint }
  | { mode: 'points'; start: CurveEditorFrame; base: CurveEditorFrame[]; selectedIds: string[] }
  | { mode: 'handle'; keyframeId: string; handle: 'in' | 'out'; base: CurveEditorFrame[] };

export type CanvasPoint = { x: number; y: number };
export type CurveEditorFrame = Keyframe<number>;

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

export function drawKeyframeCurveCanvas(
  canvas: HTMLCanvasElement,
  frames: CurveEditorFrame[],
  property: KeyframeProperty,
  duration: number,
  selectedIds: string[],
  selectionBox: { start: CanvasPoint; current: CanvasPoint } | null,
): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148,163,184,0.22)';
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += width / 4) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }
  for (let y = 0; y <= height; y += height / 4) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }
  const points = frames.map((frame) => ({ frame, point: curveFrameToPoint(frame, property, duration, canvas) }));
  if (points.length > 1) {
    context.strokeStyle = '#38bdf8';
    context.lineWidth = 2;
    context.beginPath();
    for (let index = 0; index < points.length - 1; index += 1) {
      const left = points[index];
      const right = points[index + 1];
      for (let step = 0; step <= 20; step += 1) {
        const sampleTime = left.frame.time + ((right.frame.time - left.frame.time) * step) / 20;
        const sampleValue = getInterpolatedCurveEditorValue(left.frame, right.frame, sampleTime);
        const point = curveFrameToPoint(
          { id: 'sample', time: sampleTime, value: sampleValue, easing: 'linear' },
          property,
          duration,
          canvas,
        );
        if (index === 0 && step === 0) {
          context.moveTo(point.x, point.y);
        } else {
          context.lineTo(point.x, point.y);
        }
      }
    }
    context.stroke();
  }
  for (const [index, { frame, point }] of points.entries()) {
    if (!selectedIds.includes(frame.id)) {
      continue;
    }
    const coordinates = calculateBezierHandleCoordinates(
      frame,
      points[index - 1]?.frame,
      points[index + 1]?.frame,
      frame.handleMode ?? 'independent',
    );
    context.strokeStyle = 'rgba(251,191,36,0.85)';
    context.fillStyle = '#fbbf24';
    context.lineWidth = 1.5;
    for (const handle of [coordinates.inHandle, coordinates.outHandle]) {
      if (!handle) {
        continue;
      }
      const handlePoint = curveFrameToPoint(
        { id: 'handle', time: handle.time, value: handle.value, easing: 'linear' },
        property,
        duration,
        canvas,
      );
      // 连线（虚线风格）
      context.save();
      context.setLineDash([3, 2]);
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(handlePoint.x, handlePoint.y);
      context.stroke();
      context.restore();
      // 手柄端点圆圈
      context.beginPath();
      context.arc(handlePoint.x, handlePoint.y, 4.5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(251,191,36,0.4)';
      context.lineWidth = 1;
      context.stroke();
      // 中心高亮点
      context.fillStyle = 'rgba(255,255,255,0.7)';
      context.beginPath();
      context.arc(handlePoint.x, handlePoint.y, 1.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fbbf24';
    }
  }
  for (const { frame, point } of points) {
    const selected = selectedIds.includes(frame.id);
    context.fillStyle = selected ? '#ffffff' : '#fb7185';
    context.strokeStyle = selected ? '#020617' : '#ffffff';
    context.lineWidth = selected ? 2 : 1;
    context.beginPath();
    context.arc(point.x, point.y, selected ? 5 : 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  if (selectionBox) {
    const left = Math.min(selectionBox.start.x, selectionBox.current.x);
    const top = Math.min(selectionBox.start.y, selectionBox.current.y);
    const boxWidth = Math.abs(selectionBox.current.x - selectionBox.start.x);
    const boxHeight = Math.abs(selectionBox.current.y - selectionBox.start.y);
    context.fillStyle = 'rgba(14,165,233,0.18)';
    context.strokeStyle = '#38bdf8';
    context.lineWidth = 1;
    context.fillRect(left, top, boxWidth, boxHeight);
    context.strokeRect(left, top, boxWidth, boxHeight);
  }
}

export function drawKeyframeVelocityCanvas(
  canvas: HTMLCanvasElement,
  frames: CurveEditorFrame[],
  property: KeyframeProperty,
  duration: number,
): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148,163,184,0.22)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();
  const fallback = frames[0]?.value ?? getKeyframeFallbackForCurve(property);
  const samples = calculateKeyframeSpeedSamples(frames, duration, fallback, 48);
  const maxAbs = Math.max(0.001, ...samples.map((sample) => Math.abs(sample.value)));
  context.strokeStyle = '#a78bfa';
  context.lineWidth = 2;
  context.beginPath();
  samples.forEach((sample, index) => {
    const x = (sample.time / Math.max(0.001, duration)) * width;
    const y = height / 2 - (sample.value / maxAbs) * (height * 0.42);
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();
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
  event: ReactPointerEvent<HTMLCanvasElement>,
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

export function formatKeyframeProperty(property: KeyframeProperty): string {
  return zhCN.inspector.keyframeProperty[property] ?? property;
}

export function formatKeyframeValue(property: KeyframeProperty, value: number): string {
  if (property === 'speed') {
    return `${value.toFixed(2)}x`;
  }
  if (
    property === 'opacity' ||
    property === 'volume' ||
    property === 'scaleX' ||
    property === 'scaleY' ||
    property === 'pathStartOffset'
  ) {
    return `${Math.round(value * 100)}%`;
  }
  if (property === 'yaw' || property === 'pitch' || property === 'roll') {
    return `${Math.round(value)}°`;
  }
  return value.toFixed(2);
}

// ---------------------------------------------------------------------------
// EasingPresetSelector component
// ---------------------------------------------------------------------------

/** 缓动预设选择器组件（exported for testing） */
export function EasingPresetSelector({
  selectedIds,
  frames,
  onApplyPreset,
}: {
  selectedIds: string[];
  frames: CurveEditorFrame[];
  onApplyPreset: (preset: EasingPreset) => void;
}) {
  const [expandedCategory, setExpandedCategory] = useState<EasingPresetCategory | null>(null);

  if (selectedIds.length === 0) return null;

  const categories: { key: EasingPresetCategory; label: string }[] = [
    { key: 'standard', label: '标准' },
    { key: 'overshoot', label: '过冲' },
    { key: 'spring', label: '弹簧' },
    { key: 'steps', label: '步进' },
  ];

  return (
    <div className="mt-1.5 space-y-1" data-testid="easing-preset-selector">
      <div className="text-[10px] text-[var(--color-text-muted)]">缓动预设</div>
      <div className="flex flex-wrap gap-1">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setExpandedCategory(expandedCategory === cat.key ? null : cat.key)}
            className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
              expandedCategory === cat.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-accent text-muted-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      {expandedCategory && (
        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
          {getEasingPresetsByCategory(expandedCategory).map((preset) => (
            <button
              key={preset.id}
              onClick={() => onApplyPreset(preset)}
              className="px-1.5 py-0.5 text-[10px] rounded bg-muted hover:bg-accent transition-colors"
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KeyframeCurveEditor component
// ---------------------------------------------------------------------------

export function KeyframeCurveEditor({
  clip,
  property,
  selectedKeyframes,
  onSelectionChange,
  onCommit,
}: {
  clip: Clip;
  property: KeyframeProperty;
  selectedKeyframes: SelectedKeyframeRef[];
  onSelectionChange(refs: SelectedKeyframeRef[]): void;
  onCommit(frames: CurveEditorFrame[]): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<CurveEditorDrag | null>(null);
  const [draft, setDraft] = useState<CurveEditorFrame[]>(() => getCurveEditorFrames(clip, property));
  const [selectionBox, setSelectionBox] = useState<{ start: CanvasPoint; current: CanvasPoint } | null>(null);
  const draftRef = useRef(draft);
  const duration = Math.max(0.001, clip.duration);
  const selectedIds = selectedKeyframes
    .filter((ref) => ref.clipId === clip.id && ref.property === property)
    .map((ref) => ref.keyframeId);

  useEffect(() => {
    const next = getCurveEditorFrames(clip, property);
    draftRef.current = next;
    setDraft(next);
  }, [clip, property]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawKeyframeCurveCanvas(canvas, draft, property, duration, selectedIds, selectionBox);
    }
    const speedCanvas = speedCanvasRef.current;
    if (speedCanvas) {
      drawKeyframeVelocityCanvas(speedCanvas, draft, property, duration);
    }
  }, [draft, duration, property, selectedIds, selectionBox]);

  const updateDraft = (frames: CurveEditorFrame[]) => {
    const next = normalizeCurveEditorFrames(frames, property, duration);
    draftRef.current = next;
    setDraft(next);
  };
  const refsForIds = (ids: string[]) => ids.map((keyframeId) => ({ clipId: clip.id, property, keyframeId }));
  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const frame = eventToCurveEditorFrame(event, canvas, property, duration);
    const point = eventToCanvasPoint(event, canvas);
    const nearestHandle = findNearestCurveHandle(draftRef.current, property, duration, canvas, point, 8);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (nearestHandle) {
      if (!selectedIds.includes(nearestHandle.keyframeId)) {
        onSelectionChange(refsForIds([nearestHandle.keyframeId]));
      }
      dragRef.current = {
        mode: 'handle',
        keyframeId: nearestHandle.keyframeId,
        handle: nearestHandle.handle,
        base: draftRef.current.map((item) => ({ ...item })),
      };
      return;
    }
    const nearest = findNearestCurveFrame(draftRef.current, frame, property, duration, 0.055);
    if (nearest !== null) {
      const nearestFrame = draftRef.current[nearest];
      const nextSelectedIds = selectedIds.includes(nearestFrame.id) ? selectedIds : [nearestFrame.id];
      if (!selectedIds.includes(nearestFrame.id)) {
        onSelectionChange(refsForIds(nextSelectedIds));
      }
      dragRef.current = {
        mode: 'points',
        start: frame,
        base: draftRef.current.map((item) => ({ ...item })),
        selectedIds: nextSelectedIds,
      };
      return;
    }
    dragRef.current = { mode: 'box', start: point, current: point };
    setSelectionBox({ start: point, current: point });
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const drag = dragRef.current;
    if (!canvas || !drag) {
      return;
    }
    if (drag.mode === 'box') {
      const current = eventToCanvasPoint(event, canvas);
      dragRef.current = { ...drag, current };
      setSelectionBox({ start: drag.start, current });
      return;
    }
    if (drag.mode === 'handle') {
      const target = drag.base.find((item) => item.id === drag.keyframeId);
      if (!target) {
        return;
      }
      const handleFrame = eventToCurveEditorFrame(event, canvas, property, duration);
      const handle = {
        dx: roundFinite(handleFrame.time - target.time),
        dy: roundFinite(handleFrame.value - target.value),
      };
      updateDraft(
        drag.base.map((item) =>
          item.id === drag.keyframeId
            ? applyKeyframeHandlePatch(item, drag.handle, handle, item.handleMode ?? 'independent')
            : item,
        ),
      );
      return;
    }
    const frame = eventToCurveEditorFrame(event, canvas, property, duration);
    const limits = KEYFRAME_PROPERTY_LIMITS[property];
    const deltaTime = frame.time - drag.start.time;
    const deltaValue = frame.value - drag.start.value;
    updateDraft(
      drag.base.map((item) =>
        drag.selectedIds.includes(item.id)
          ? {
              ...item,
              time: roundFinite(Math.min(duration, Math.max(0, item.time + deltaTime))),
              value: roundFinite(Math.min(limits.max, Math.max(limits.min, item.value + deltaValue))),
            }
          : item,
      ),
    );
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const drag = dragRef.current;
    dragRef.current = null;
    setSelectionBox(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!canvas || !drag) {
      return;
    }
    if (drag.mode === 'box') {
      const selected = getCurveFrameIdsInBox(draftRef.current, property, duration, canvas, drag.start, drag.current);
      onSelectionChange(refsForIds(selected));
      return;
    }
    onCommit(normalizeCurveEditorFrames(draftRef.current, property, duration));
  };
  const handleContextMenu = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    event.preventDefault();
    const point = eventToCanvasPoint(event, canvas);
    const nearestHandle = findNearestCurveHandle(draftRef.current, property, duration, canvas, point, 10);
    const targetId =
      nearestHandle?.keyframeId ??
      findNearestCurveFrameIdByPoint(draftRef.current, property, duration, canvas, point, 10);
    if (!targetId) {
      return;
    }
    const next = draftRef.current.map((frame) =>
      frame.id === targetId ? { ...frame, handleMode: nextHandleMode(frame.handleMode) } : frame,
    );
    updateDraft(next);
    onCommit(normalizeCurveEditorFrames(next, property, duration));
    onSelectionChange(refsForIds([targetId]));
  };

  return (
    <div className="rounded-md border border-line bg-panel p-2" data-testid="keyframe-curve-editor">
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--color-text-muted)]">
        <span>{zhCN.inspector.fields.speedDerivative}</span>
        <span className="tabular-nums">{draft.length}</span>
      </div>
      <canvas
        ref={speedCanvasRef}
        className="mb-2 block h-16 w-full rounded border border-line bg-slate-950"
        width={288}
        height={64}
        data-testid="keyframe-speed-curve-canvas"
      />
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--color-text-muted)]">
        <span>{formatKeyframeProperty(property)}</span>
        <span>
          {formatKeyframeValue(property, KEYFRAME_PROPERTY_LIMITS[property].min)} -{' '}
          {formatKeyframeValue(property, KEYFRAME_PROPERTY_LIMITS[property].max)}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="block h-32 w-full touch-none rounded border border-line bg-slate-950"
        width={288}
        height={128}
        data-testid="keyframe-curve-editor-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleContextMenu}
      />
      {/* 缓动预设选择器 */}
      <EasingPresetSelector
        selectedIds={selectedIds}
        frames={draft}
        onApplyPreset={(preset) => {
          const handles = getPresetHandles(preset.id);
          if (!handles) return;
          const updated = draft.map((frame) =>
            selectedIds.includes(frame.id)
              ? {
                  ...frame,
                  easing: preset.easing,
                  inHandle: handles.inHandle ?? frame.inHandle,
                  outHandle: handles.outHandle ?? frame.outHandle,
                }
              : frame,
          );
          updateDraft(updated);
          onCommit(normalizeCurveEditorFrames(updated, property, duration));
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color curve helpers
// ---------------------------------------------------------------------------

export function drawCurveCanvas(canvas: HTMLCanvasElement, points: CurvePoint[], strokeColor: string): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const position = (index / 4) * width;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, height);
    context.moveTo(0, position);
    context.lineTo(width, position);
    context.stroke();
  }
  context.strokeStyle = 'rgba(255, 255, 255, 0.24)';
  context.beginPath();
  context.moveTo(0, height);
  context.lineTo(width, 0);
  context.stroke();

  context.strokeStyle = strokeColor;
  context.lineWidth = 2;
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const sampleX = x / (width - 1);
    const sampleY = sampleCurve(points, sampleX);
    const y = (1 - sampleY) * (height - 1);
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();

  for (const point of normalizeCurvePoints(points)) {
    const x = point.x * width;
    const y = (1 - point.y) * height;
    context.beginPath();
    context.fillStyle = '#ffffff';
    context.arc(x, y, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = strokeColor;
    context.lineWidth = 2;
    context.stroke();
  }
}

export function eventToCurvePoint(event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): CurvePoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clampUnit((event.clientX - rect.left) / rect.width),
    y: clampUnit(1 - (event.clientY - rect.top) / rect.height),
  };
}

export function findNearestCurvePoint(points: CurvePoint[], point: CurvePoint, maxDistance: number): number | null {
  let nearestIndex: number | null = null;
  let nearestDistance = maxDistance;
  points.forEach((candidate, index) => {
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

// ---------------------------------------------------------------------------
// CurveEditor component (color curves)
// ---------------------------------------------------------------------------

export type CurveChannel = keyof ColorCurves;

export const CURVE_CHANNELS: Array<{ key: CurveChannel; label: string; color: string }> = [
  { key: 'master', label: zhCN.inspector.fields.masterCurve, color: '#f8fafc' },
  { key: 'r', label: zhCN.inspector.fields.redCurve, color: '#ef4444' },
  { key: 'g', label: zhCN.inspector.fields.greenCurve, color: '#22c55e' },
  { key: 'b', label: zhCN.inspector.fields.blueCurve, color: '#3b82f6' },
];

export function CurveEditor({ curves, onCommit }: { curves: ColorCurves; onCommit(curves: ColorCurves): void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const draftRef = useRef<ColorCurves>(curves);
  const [activeChannel, setActiveChannel] = useState<CurveChannel>('master');
  const [draft, setDraft] = useState<ColorCurves>(curves);

  useEffect(() => {
    const normalized = normalizeColorCurves(curves);
    draftRef.current = normalized;
    setDraft(normalized);
  }, [curves]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    drawCurveCanvas(
      canvas,
      draft[activeChannel],
      CURVE_CHANNELS.find((item) => item.key === activeChannel)?.color ?? '#e2e8f0',
    );
  }, [activeChannel, draft]);

  const setDraftCurves = (next: ColorCurves) => {
    const normalized = normalizeColorCurves(next);
    draftRef.current = normalized;
    setDraft(normalized);
  };
  const commitDraft = () => {
    onCommit(draftRef.current);
  };
  const updateActivePoints = (points: CurvePoint[], shouldCommit = false) => {
    const next = { ...draftRef.current, [activeChannel]: normalizeCurvePoints(points) };
    setDraftCurves(next);
    if (shouldCommit) {
      onCommit(next);
    }
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const point = eventToCurvePoint(event, canvas);
    const points = normalizeCurvePoints(draftRef.current[activeChannel]);
    const nearest = findNearestCurvePoint(points, point, 0.045);
    if (nearest === null) {
      const nextPoints = normalizeCurvePoints([...points, point]);
      dragIndexRef.current = findNearestCurvePoint(nextPoints, point, 1) ?? nextPoints.length - 1;
      updateActivePoints(nextPoints);
    } else {
      dragIndexRef.current = nearest;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const dragIndex = dragIndexRef.current;
    if (!canvas || dragIndex === null) {
      return;
    }
    const point = eventToCurvePoint(event, canvas);
    const points = normalizeCurvePoints(draftRef.current[activeChannel]);
    points[dragIndex] = point;
    const nextPoints = normalizeCurvePoints(points);
    dragIndexRef.current = findNearestCurvePoint(nextPoints, point, 1) ?? dragIndex;
    updateActivePoints(nextPoints);
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragIndexRef.current !== null) {
      dragIndexRef.current = null;
      commitDraft();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleDoubleClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const point = eventToCurvePoint(event, canvas);
    const points = normalizeCurvePoints(draftRef.current[activeChannel]);
    const nearest = findNearestCurvePoint(points, point, 0.06);
    if (nearest === null || points.length <= 2) {
      return;
    }
    updateActivePoints(
      points.filter((_, index) => index !== nearest),
      true,
    );
  };

  return (
    <div className="space-y-2 rounded-md border border-line bg-panel p-2" data-testid="curve-editor">
      <div className="grid grid-cols-4 gap-1">
        {CURVE_CHANNELS.map((channel) => (
          <button
            key={channel.key}
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
              activeChannel === channel.key
                ? 'border-brand bg-[var(--color-bg-elevated)] text-brand'
                : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel'
            }`}
            type="button"
            data-testid={`curve-tab-${channel.key}`}
            onClick={() => setActiveChannel(channel.key)}
          >
            {channel.label}
          </button>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        className="block h-64 w-64 touch-none rounded border border-line bg-slate-950"
        width={256}
        height={256}
        data-testid="curve-editor-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />
      <button
        className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
        type="button"
        data-testid="reset-curves-button"
        onClick={() => {
          const next = createDefaultColorCurves();
          setDraftCurves(next);
          onCommit(next);
        }}
      >
        {zhCN.inspector.fields.resetCurve}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color wheel helpers
// ---------------------------------------------------------------------------

export function drawColorWheel(canvas: HTMLCanvasElement, value: ColorWheelValue): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const size = canvas.width;
  const radius = size / 2;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5 - radius) / radius;
      const dy = (y + 0.5 - radius) / radius;
      const distance = Math.hypot(dx, dy);
      const offset = (y * size + x) * 4;
      if (distance > 1) {
        image.data[offset + 3] = 0;
        continue;
      }
      const hue = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
      const rgb = hsvToRgb(hue, distance, 1);
      image.data[offset] = Math.round(rgb.r * 255);
      image.data[offset + 1] = Math.round(rgb.g * 255);
      image.data[offset + 2] = Math.round(rgb.b * 255);
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const marker = wheelOffsetsToPoint(value);
  context.beginPath();
  context.arc(radius + marker.x * radius, radius + marker.y * radius, 5, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  context.strokeStyle = '#0f172a';
  context.lineWidth = 2;
  context.stroke();
}

export function eventToUnitPoint(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  const length = Math.hypot(x, y);
  if (length <= 1) {
    return { x, y };
  }
  return { x: x / length, y: y / length };
}

export function wheelPointToOffsets(point: { x: number; y: number }): Pick<ColorWheelValue, 'r' | 'g' | 'b'> {
  return {
    r: clampSigned(point.x),
    g: clampSigned(-0.5 * point.x - 0.8660254 * point.y),
    b: clampSigned(-0.5 * point.x + 0.8660254 * point.y),
  };
}

export function wheelOffsetsToPoint(value: ColorWheelValue): { x: number; y: number } {
  const x = value.r;
  const y = (value.b - value.g) / 1.7320508;
  const length = Math.hypot(x, y);
  if (length <= 1) {
    return { x, y };
  }
  return { x: x / length, y: y / length };
}

export function hsvToRgb(hue: number, saturation: number, value: number): { r: number; g: number; b: number } {
  const sector = Math.floor(hue * 6);
  const fraction = hue * 6 - sector;
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);
  switch (sector % 6) {
    case 0:
      return { r: value, g: t, b: p };
    case 1:
      return { r: q, g: value, b: p };
    case 2:
      return { r: p, g: value, b: t };
    case 3:
      return { r: p, g: q, b: value };
    case 4:
      return { r: t, g: p, b: value };
    default:
      return { r: value, g: p, b: q };
  }
}

// ---------------------------------------------------------------------------
// Shared numeric utilities
// ---------------------------------------------------------------------------

export function roundFinite(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}

/** @deprecated 使用 clamp01 代替 */
export const clampUnit = clamp01;

/** @deprecated 使用 clamp(value, -1, 1) 代替 */
export const clampSigned = (value: number): number => clamp(value, -1, 1);
