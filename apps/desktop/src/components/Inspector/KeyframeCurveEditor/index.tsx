import {getEasingPresetsByCategory, getPresetHandles, type EasingPreset, type EasingPresetCategory} from '@open-factory/editor-core';
import {useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent} from 'react';
import type {Clip, KeyframeProperty} from '@open-factory/editor-core';
import {applyKeyframeHandlePatch, KEYFRAME_PROPERTY_LIMITS} from '@open-factory/editor-core';
import {zhCN} from '../../../i18n/strings';
import type {SelectedKeyframeRef} from '../../../store/editorStore';
import type {CanvasPoint, CurveEditorDrag, CurveEditorFrame} from './sharedTypes';
import {formatKeyframeProperty, formatKeyframeValue, roundFinite} from './sharedTypes';
import {drawKeyframeCurveCanvas, drawKeyframeVelocityCanvas} from './canvasDrawing';
import {
  eventToCanvasPoint,
  eventToCurveEditorFrame,
  findNearestCurveFrame,
  findNearestCurveFrameIdByPoint,
  findNearestCurveHandle,
  getCurveEditorFrames,
  getCurveFrameIdsInBox,
  nextHandleMode,
  normalizeCurveEditorFrames,
} from './keyframeData';

export type {SpeedCurveFrame, CurveEditorDrag, CanvasPoint, CurveEditorFrame} from './sharedTypes';
export {SpeedCurveEditor} from './SpeedCurveEditor';
export {getCurveEditorFrames, normalizeCurveEditorFrames} from './keyframeData';
export {drawKeyframeCurveCanvas, drawKeyframeVelocityCanvas} from './canvasDrawing';
export {getInterpolatedCurveEditorValue, findNearestCurveHandle, findNearestCurveFrameIdByPoint, nextHandleMode, getKeyframeFallbackForCurve, eventToCurveEditorFrame, eventToCanvasPoint, curveFrameToPoint, findNearestCurveFrame, getCurveFrameIdsInBox} from './keyframeData';
export {getSpeedCurveFrames, normalizeSpeedCurveFrames, eventToSpeedFrame, speedFrameToPoint, findNearestSpeedFrame} from './keyframeData';
export {drawSpeedCurveCanvas} from './canvasDrawing';
export {roundFinite, clampUnit, formatKeyframeProperty, formatKeyframeValue} from './sharedTypes';

/** Easing preset selector component (exported for testing) */
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
      {/* Easing preset selector */}
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
