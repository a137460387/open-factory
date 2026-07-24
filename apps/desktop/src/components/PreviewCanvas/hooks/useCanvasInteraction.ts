import { useRef, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type {
  CanvasPoint,
  CanvasTransformHandle,
  ClipMask,
  ClipPatch,
  PathPoint,
  PathPointHandle,
  Transform,
} from '@open-factory/editor-core';
import {
  closePathPoints,
  isPathMaskClosed,
  moveTransformByCanvasDelta,
  normalizeClipPanoramaView,
  resizeClipTransform,
  rotateClipTransform,
  screenPointToCanvasPoint,
  UpdateClipCommand,
  UpdateMaskCommand,
} from '@open-factory/editor-core';
import { getWheelPreviewZoom, buildChromaKeySamplePatch } from '../../lib/preview/frame-inspector';
import { calculatePreviewCompareSplitRatio, type PreviewCompareMode } from '../../lib/preview/compare';
import { showToast } from '../../lib/toast';
import { zhCN } from '../../i18n/strings';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import type {
  CanvasTransformDrag,
  EditableCanvasClip,
  FrameInspectorSample,
  PanoramaPreviewDrag,
  PathMaskDrag,
  PreviewPanDrag,
  ReviewAnnotationDrag,
} from '../types';
import {
  readFrameInspectorSampleImpl,
  readPreviewCanvasPixel,
  canvasPointToPathPoint,
  buildPathMaskDragPatch,
  clonePathPoints,
  buildReviewAnnotationGeometry,
} from '../utils';

export interface CanvasInteractionParams {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  previewSurfaceRef: React.RefObject<HTMLDivElement | null>;
  compareFrameRef: React.RefObject<HTMLDivElement | null>;
  canvasEditMode: boolean;
  frameInspectMode: boolean;
  compareEnabled: boolean;
  compareMode: PreviewCompareMode | 'off';
  chromaKeyPickTarget: EditableCanvasClip | undefined;
  selectedEditableClip: EditableCanvasClip | undefined;
  selectedPathMask: ClipMask | undefined;
  selectedPanoramaClip: import('@open-factory/editor-core').Clip | undefined;
  selectedInspectorClip: import('@open-factory/editor-core').Clip | undefined;
  editableCanvasClips: EditableCanvasClip[];
  reviewMode: boolean;
  previewZoom: number;
  previewPan: { x: number; y: number };
  frameInspectorSample: FrameInspectorSample | undefined;
  setIsPlaying: (playing: boolean) => void;
  setSelectedClipIds: (ids: string[]) => void;
  setChromaKeyPickClipId: (id: string | undefined) => void;
  setPreviewZoom: (zoom: number) => void;
  setPreviewPan: (pan: { x: number; y: number }) => void;
  setFrameInspectorSample: (sample: FrameInspectorSample | undefined) => void;
  setCompareSplitRatio: (ratio: number) => void;
  setCompareDividerDragging: (dragging: boolean) => void;
  setReviewDragRef?: never;
  onAddReviewAnnotation?: (annotation: Omit<import('@open-factory/editor-core').ReviewAnnotation, 'id'> & Partial<Pick<import('@open-factory/editor-core').ReviewAnnotation, 'id'>>) => void;
  reviewText: string;
  reviewTool: import('@open-factory/editor-core').ReviewAnnotationType;
  playheadTime: number;
  fps: number;
}

export function useCanvasInteraction(params: CanvasInteractionParams) {
  const {
    canvasRef,
    previewSurfaceRef,
    compareFrameRef,
    canvasEditMode,
    frameInspectMode,
    compareEnabled,
    compareMode,
    chromaKeyPickTarget,
    selectedEditableClip,
    selectedPathMask,
    selectedPanoramaClip,
    selectedInspectorClip,
    editableCanvasClips,
    reviewMode,
    previewZoom,
    previewPan,
    frameInspectorSample,
    setIsPlaying,
    setSelectedClipIds,
    setChromaKeyPickClipId,
    setPreviewZoom,
    setPreviewPan,
    setFrameInspectorSample,
    setCompareSplitRatio,
    setCompareDividerDragging,
    onAddReviewAnnotation,
    reviewText,
    reviewTool,
    playheadTime,
    fps,
  } = params;

  const t = zhCN.preview;
  const transformDragRef = useRef<CanvasTransformDrag | null>(null);
  const pathMaskDragRef = useRef<PathMaskDrag | null>(null);
  const panoramaDragRef = useRef<PanoramaPreviewDrag | null>(null);
  const previewPanDragRef = useRef<PreviewPanDrag | null>(null);
  const reviewDragRef = useRef<ReviewAnnotationDrag | null>(null);

  function getCanvasPointFromPointer(event: { clientX: number; clientY: number }): CanvasPoint | undefined {
    const bounds = previewSurfaceRef.current?.getBoundingClientRect();
    const canvas = canvasRef.current;
    if (!bounds || !canvas) {
      return undefined;
    }
    return screenPointToCanvasPoint(
      { x: event.clientX, y: event.clientY },
      {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      },
    );
  }

  function getReviewAnnotationText(): string {
    return reviewText.trim() || t.reviewDefaultText(0);
  }

  function addReviewAnnotation(
    type: import('@open-factory/editor-core').ReviewAnnotationType,
    geometry: Pick<import('@open-factory/editor-core').ReviewAnnotation, 'x' | 'y' | 'width' | 'height'>,
  ): void {
    onAddReviewAnnotation?.({
      time: playheadTime,
      type,
      text: getReviewAnnotationText(),
      color: '#facc15',
      ...geometry,
    });
  }

  // --- Frame Inspector ---
  function updateFrameInspector(event: ReactPointerEvent<HTMLDivElement>): void {
    const sample = readFrameInspectorSampleImpl(event, canvasRef, previewSurfaceRef, compareFrameRef);
    setFrameInspectorSample(sample);
  }

  function clearFrameInspector(): void {
    setFrameInspectorSample(undefined);
  }

  async function sampleFrameInspectorColor(event: ReactPointerEvent<HTMLDivElement>): Promise<void> {
    const sample = readFrameInspectorSampleImpl(event, canvasRef, previewSurfaceRef, compareFrameRef);
    if (!sample) {
      return;
    }
    setFrameInspectorSample({ ...sample, sampled: true });
    try {
      await navigator.clipboard?.writeText(sample.hex);
      showToast({ kind: 'success', title: t.frameInspectorCopied, message: sample.hex });
    } catch {
      showToast({ kind: 'info', title: t.frameInspectorSampled, message: sample.hex });
    }
  }

  function applyFrameInspectorColor(sample = frameInspectorSample): void {
    if (!sample || !selectedInspectorClip) {
      return;
    }
    try {
      commandManager.execute(
        new UpdateClipCommand(
          timelineAccessor,
          selectedInspectorClip.id,
          buildChromaKeySamplePatch(selectedInspectorClip, sample.rgb),
        ),
      );
      showToast({ kind: 'success', title: t.frameInspectorApplied, message: sample.hex });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  }

  // --- Preview Zoom/Pan ---
  function resetPreviewZoom(): void {
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  }

  function updatePreviewZoomFromWheel(event: ReactWheelEvent<HTMLDivElement>): void {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const nextZoom = getWheelPreviewZoom(previewZoom, event.deltaY);
    setPreviewZoom(nextZoom);
    if (nextZoom === 1) {
      setPreviewPan({ x: 0, y: 0 });
    }
  }

  function beginPreviewPan(event: ReactPointerEvent<HTMLDivElement>): void {
    if (
      previewZoom <= 1 ||
      canvasEditMode ||
      frameInspectMode ||
      chromaKeyPickTarget ||
      compareEnabled ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    previewPanDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPan: previewPan,
    };
  }

  function updatePreviewPan(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = previewPanDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    setPreviewPan({
      x: drag.startPan.x + event.clientX - drag.startClientX,
      y: drag.startPan.y + event.clientY - drag.startClientY,
    });
  }

  function endPreviewPan(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = previewPanDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    previewPanDragRef.current = null;
  }

  // --- Compare ---
  function updateCompareSplitFromPointer(event: { clientX: number; clientY: number }): void {
    if (compareMode === 'off' || compareMode === 'difference') {
      return;
    }
    const bounds = previewSurfaceRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }
    setCompareSplitRatio(calculatePreviewCompareSplitRatio(compareMode, event, bounds));
  }

  // --- Review Annotations ---
  function beginReviewAnnotation(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!reviewMode || event.button !== 0) {
      return;
    }
    const point = getCanvasPointFromPointer(event);
    const canvas = canvasRef.current;
    if (!point || !canvas) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (reviewTool === 'text') {
      addReviewAnnotation('text', {
        x: point.x / canvas.width,
        y: point.y / canvas.height,
        width: 0.22,
        height: 0.08,
      });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    reviewDragRef.current = {
      pointerId: event.pointerId,
      type: reviewTool as Exclude<import('@open-factory/editor-core').ReviewAnnotationType, 'text'>,
      startPoint: point,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    };
  }

  function endReviewAnnotation(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = reviewDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const point = getCanvasPointFromPointer(event) ?? drag.startPoint;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    reviewDragRef.current = null;
    addReviewAnnotation(drag.type, buildReviewAnnotationGeometry(drag, point));
  }

  // --- Chroma Key ---
  function pickChromaKeyColor(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!chromaKeyPickTarget) {
      setChromaKeyPickClipId(undefined);
      return;
    }
    const canvas = canvasRef.current;
    const bounds = previewSurfaceRef.current?.getBoundingClientRect();
    const sample = canvas && bounds ? readPreviewCanvasPixel(canvas, bounds, event) : undefined;
    if (!sample) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.chromaKey.pickFailedTitle,
        message: zhCN.inspector.chromaKey.pickFailedMessage,
      });
      setChromaKeyPickClipId(undefined);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    try {
      commandManager.execute(
        new UpdateClipCommand(
          timelineAccessor,
          chromaKeyPickTarget.clip.id,
          buildChromaKeySamplePatch(chromaKeyPickTarget.clip, sample.rgb),
        ),
      );
      setSelectedClipIds([chromaKeyPickTarget.clip.id]);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    } finally {
      setChromaKeyPickClipId(undefined);
    }
  }

  // --- Canvas Transform Drag ---
  function beginCanvasTransformDrag(
    event: ReactPointerEvent<HTMLElement>,
    item: EditableCanvasClip,
    type: CanvasTransformDrag['type'],
    handle?: CanvasTransformHandle,
  ): void {
    if (!canvasEditMode) {
      return;
    }
    const point = getCanvasPointFromPointer(event);
    const canvas = canvasRef.current;
    if (!point || !canvas) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPlaying(false);
    setSelectedClipIds([item.clip.id]);
    transformDragRef.current = {
      pointerId: event.pointerId,
      clipId: item.clip.id,
      type,
      handle,
      sourceWidth: item.sourceWidth,
      sourceHeight: item.sourceHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      startPoint: point,
      startTransform: normalizeTransform(item.clip.transform),
    };
  }

  function beginCanvasHitDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!canvasEditMode) {
      return;
    }
    const point = getCanvasPointFromPointer(event);
    if (!point) {
      return;
    }
    const hit = [...editableCanvasClips].reverse().find((item) => hitTestClipTransformBox(point, item.box));
    if (!hit) {
      setSelectedClipIds([]);
      return;
    }
    beginCanvasTransformDrag(event, hit, 'move');
  }

  function updateCanvasTransformDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = transformDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const point = getCanvasPointFromPointer(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    const nextTransform = getDragTransform(drag, point, { keepAspectRatio: event.shiftKey, fromCenter: event.altKey });
    commitCanvasTransformDrag(drag, nextTransform);
  }

  function endCanvasTransformDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = transformDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    transformDragRef.current = null;
  }

  function commitCanvasTransformDrag(drag: CanvasTransformDrag, transform: Transform): void {
    try {
      const patchTransform = { ...transform };
      if (!drag.command || !drag.patch) {
        const patch: ClipPatch = { transform: patchTransform };
        const command = new UpdateClipCommand(timelineAccessor, drag.clipId, patch);
        commandManager.execute(command);
        drag.command = command;
        drag.patch = patch;
        return;
      }
      drag.patch.transform = patchTransform;
      drag.command.execute();
    } catch (error) {
      transformDragRef.current = null;
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  }

  function getDragTransform(
    drag: CanvasTransformDrag,
    point: CanvasPoint,
    modifiers: { keepAspectRatio: boolean; fromCenter: boolean },
  ): Transform {
    if (drag.type === 'move') {
      return moveTransformByCanvasDelta(drag.startTransform, {
        x: point.x - drag.startPoint.x,
        y: point.y - drag.startPoint.y,
      });
    }
    if (drag.type === 'rotate') {
      return rotateClipTransform({
        transform: drag.startTransform,
        canvasWidth: drag.canvasWidth,
        canvasHeight: drag.canvasHeight,
        currentPoint: point,
      });
    }
    return resizeClipTransform({
      transform: drag.startTransform,
      sourceWidth: drag.sourceWidth,
      sourceHeight: drag.sourceHeight,
      canvasWidth: drag.canvasWidth,
      canvasHeight: drag.canvasHeight,
      handle: drag.handle ?? 'se',
      currentPoint: point,
      keepAspectRatio: modifiers.keepAspectRatio,
      fromCenter: modifiers.fromCenter,
    });
  }

  // --- Panorama ---
  function beginPanoramaPreviewDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!selectedPanoramaClip || canvasEditMode || compareEnabled || chromaKeyPickTarget) {
      return;
    }
    const panorama = normalizeClipPanoramaView(selectedPanoramaClip.panorama);
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPlaying(false);
    panoramaDragRef.current = {
      pointerId: event.pointerId,
      clipId: selectedPanoramaClip.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanorama: panorama,
    };
  }

  function updatePanoramaPreviewDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = panoramaDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const next = normalizeClipPanoramaView({
      ...drag.startPanorama,
      yaw: drag.startPanorama.yaw + (event.clientX - drag.startClientX) * 0.25,
      pitch: drag.startPanorama.pitch - (event.clientY - drag.startClientY) * 0.25,
    });
    commitPanoramaDrag(drag, next);
  }

  function endPanoramaPreviewDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = panoramaDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panoramaDragRef.current = null;
  }

  function updatePanoramaFov(event: ReactWheelEvent<HTMLDivElement>): void {
    if (!selectedPanoramaClip || canvasEditMode || compareEnabled || chromaKeyPickTarget) {
      return;
    }
    event.preventDefault();
    const panorama = normalizeClipPanoramaView(selectedPanoramaClip.panorama);
    const delta = event.deltaY > 0 ? 4 : -4;
    try {
      commandManager.execute(
        new UpdateClipCommand(timelineAccessor, selectedPanoramaClip.id, {
          panorama: normalizeClipPanoramaView({ ...panorama, fov: panorama.fov + delta }),
        }),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  }

  function commitPanoramaDrag(drag: PanoramaPreviewDrag, panorama: ReturnType<typeof normalizeClipPanoramaView>): void {
    try {
      if (!drag.command || !drag.patch) {
        const patch: ClipPatch = { panorama };
        const command = new UpdateClipCommand(timelineAccessor, drag.clipId, patch);
        commandManager.execute(command);
        drag.command = command;
        drag.patch = patch;
        return;
      }
      drag.patch.panorama = panorama;
      drag.command.execute();
    } catch (error) {
      panoramaDragRef.current = null;
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  }

  // --- Path Mask ---
  function addPathMaskAnchor(event: ReactMouseEvent<HTMLDivElement>): void {
    if (!canvasEditMode || !selectedEditableClip || !selectedPathMask || event.detail !== 1) {
      return;
    }
    const point = getCanvasPointFromPointer(event);
    if (!point) {
      return;
    }
    const pathPoint = canvasPointToPathPoint(point, selectedEditableClip);
    const currentPath = selectedPathMask.path ?? [];
    if (isPathMaskClosed(currentPath)) {
      return;
    }
    event.preventDefault();
    commitPathMaskPatch(selectedEditableClip.clip.id, selectedPathMask.id, { path: [...currentPath, pathPoint] });
  }

  function closeSelectedPathMask(event: ReactMouseEvent<HTMLDivElement>): void {
    if (!canvasEditMode || !selectedEditableClip || !selectedPathMask) {
      return;
    }
    const point = getCanvasPointFromPointer(event);
    const doubleClickPoint = point ? canvasPointToPathPoint(point, selectedEditableClip) : undefined;
    const rawPath = selectedPathMask.path ?? [];
    const lastPoint = rawPath.at(-1);
    const path =
      doubleClickPoint &&
      lastPoint &&
      rawPath.length > 3 &&
      Math.hypot(lastPoint.x - doubleClickPoint.x, lastPoint.y - doubleClickPoint.y) < 0.02
        ? rawPath.slice(0, -1)
        : rawPath;
    if (path.length < 3 || isPathMaskClosed(path)) {
      return;
    }
    event.preventDefault();
    commitPathMaskPatch(selectedEditableClip.clip.id, selectedPathMask.id, { path: closePathPoints(path) });
  }

  function beginPathMaskDrag(
    event: ReactPointerEvent<HTMLElement>,
    item: EditableCanvasClip,
    mask: ClipMask,
    pointIndex: number,
    target: PathMaskDrag['target'],
  ): void {
    if (!canvasEditMode) {
      return;
    }
    const point = getCanvasPointFromPointer(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pathMaskDragRef.current = {
      pointerId: event.pointerId,
      clipId: item.clip.id,
      maskId: mask.id,
      pointIndex,
      target,
      startPoint: canvasPointToPathPoint(point, item) as PathPointHandle,
      startPath: clonePathPoints(mask.path ?? []),
    };
  }

  function updatePathMaskDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = pathMaskDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !selectedEditableClip) {
      return;
    }
    const point = getCanvasPointFromPointer(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    const patch = buildPathMaskDragPatch(drag, canvasPointToPathPoint(point, selectedEditableClip) as PathPointHandle);
    commitPathMaskDrag(drag, patch);
  }

  function endPathMaskDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = pathMaskDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pathMaskDragRef.current = null;
  }

  function commitPathMaskPatch(clipId: string, maskId: string, patch: { path: PathPoint[] }): void {
    try {
      commandManager.execute(new UpdateMaskCommand(timelineAccessor, clipId, maskId, patch));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  }

  function commitPathMaskDrag(drag: PathMaskDrag, patch: { path: PathPoint[] }): void {
    try {
      if (!drag.command || !drag.patch) {
        const command = new UpdateMaskCommand(timelineAccessor, drag.clipId, drag.maskId, patch);
        commandManager.execute(command);
        drag.command = command;
        drag.patch = patch;
        return;
      }
      drag.patch.path = patch.path;
      drag.command.execute();
    } catch (error) {
      pathMaskDragRef.current = null;
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  }

  return {
    resetPreviewZoom,
    updatePreviewZoomFromWheel,
    beginPreviewPan,
    updatePreviewPan,
    endPreviewPan,
    updateCompareSplitFromPointer,
    beginReviewAnnotation,
    endReviewAnnotation,
    pickChromaKeyColor,
    beginCanvasTransformDrag,
    beginCanvasHitDrag,
    updateCanvasTransformDrag,
    endCanvasTransformDrag,
    beginPanoramaPreviewDrag,
    updatePanoramaPreviewDrag,
    endPanoramaPreviewDrag,
    updatePanoramaFov,
    addPathMaskAnchor,
    closeSelectedPathMask,
    beginPathMaskDrag,
    updatePathMaskDrag,
    endPathMaskDrag,
    updateFrameInspector,
    clearFrameInspector,
    sampleFrameInspectorColor,
    applyFrameInspectorColor,
  };
}

import { normalizeTransform, hitTestClipTransformBox } from '@open-factory/editor-core';
