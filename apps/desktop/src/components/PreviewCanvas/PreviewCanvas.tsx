import { BarChart3, Blend, Columns2, GitCompareArrows, MousePointer2, Pause, Pipette, Play, Rows2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import {
  CutMulticamClipCommand,
  UpdateClipCommand,
  UpdateMaskCommand,
  buildClipTransformBox,
  buildTimelineRenderFrameKey,
  buildTimelineRenderFrameRequests,
  closePathPoints,
  diffTimelineSnapshots,
  getActiveMulticamAngle,
  getRenderableTracks,
  getTimelineRenderInvalidationRanges,
  getTimelinePlaybackDuration,
  hitTestClipTransformBox,
  isPathMaskClosed,
  isNestedSequenceDepthExceeded,
  moveTransformByCanvasDelta,
  normalizeClipPanoramaView,
  normalizeClipProjection,
  normalizeTransform,
  parseTimecodeToSeconds,
  resizeClipTransform,
  rotateClipTransform,
  screenPointToCanvasPoint,
  secondsToTimecode,
  type Clip,
  type ClipMask,
  type ClipPatch,
  type ClipTransformBox,
  type CanvasPoint,
  type CanvasTransformHandle,
  type ChromaKeyColor,
  type PathPoint,
  type PathPointHandle,
  type Project,
  type Sequence,
  type TimecodeParseError,
  type Transform,
  type Timeline
} from '@open-factory/editor-core';
import {
  buildChromaKeySamplePatch,
  calculatePreviewPixelCoordinates,
  getWheelPreviewZoom,
  rgbToHex,
  rgbToHsl,
  type PreviewPixelCoordinates
} from '../../lib/preview/frame-inspector';
import { ColorScopesPanel } from '../ColorScopes/ColorScopesPanel';
import { zhCN } from '../../i18n/strings';
import {
  buildPreviewCompareDividerStyle,
  buildPreviewCompareOverlayStyle,
  calculatePreviewCompareSplitRatio,
  drawPreviewDifferenceFrame,
  type PreviewCompareMode
} from '../../lib/preview/compare';
import { listProjectSnapshots, readProjectSnapshot, type ProjectSnapshotEntry } from '../../lib/projectSnapshots';
import { PreviewRenderer, type PreviewFrameReadback } from '../../lib/preview/renderer';
import { getTimelineRenderCacheController } from '../../lib/preview/render-cache-controller';
import { showToast } from '../../lib/toast';
import { useAudioMeterStore } from '../../store/audioMeterStore';
import { commandManager, projectAccessor, timelineAccessor } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';
import { useTheme } from '../../theme/useTheme';

const PREVIEW_CANVAS_WIDTH = 1280;
const PREVIEW_CANVAS_HEIGHT = 720;
const CANVAS_TRANSFORM_HANDLES: CanvasTransformHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface PreviewCanvasProps {
  safeFrameGuides?: boolean;
}

export function PreviewCanvas({ safeFrameGuides = false }: PreviewCanvasProps) {
  const t = zhCN.preview;
  const theme = useTheme();
  const compareFrameRef = useRef<HTMLDivElement | null>(null);
  const previewSurfaceRef = useRef<HTMLDivElement | null>(null);
  const transformDragRef = useRef<CanvasTransformDrag | null>(null);
  const pathMaskDragRef = useRef<PathMaskDrag | null>(null);
  const panoramaDragRef = useRef<PanoramaPreviewDrag | null>(null);
  const previewPanDragRef = useRef<PreviewPanDrag | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const differenceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameSearchInputRef = useRef<HTMLInputElement | null>(null);
  const rendererRef = useRef(new PreviewRenderer());
  const originalRendererRef = useRef(new PreviewRenderer());
  const previousTimelineRef = useRef<Timeline | undefined>();
  const scopeFrameCounterRef = useRef(0);
  const project = useEditorStore((state) => state.project);
  const projectPath = useEditorStore((state) => state.projectPath);
  const previewTimeline = useEditorStore((state) => state.previewTimeline);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const playbackRate = useEditorStore((state) => state.playbackRate);
  const setPlayheadTime = useEditorStore((state) => state.setPlayheadTime);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const setTimelineCompareRanges = useEditorStore((state) => state.setTimelineCompareRanges);
  const chromaKeyPickClipId = useEditorStore((state) => state.chromaKeyPickClipId);
  const setChromaKeyPickClipId = useEditorStore((state) => state.setChromaKeyPickClipId);
  const setAudioLevels = useAudioMeterStore((state) => state.setLevels);
  const resetAudioLevels = useAudioMeterStore((state) => state.resetLevels);
  const [scopesOpen, setScopesOpen] = useState(false);
  const [scopeFrame, setScopeFrame] = useState<PreviewFrameReadback>();
  const [compareMode, setCompareMode] = useState<PreviewCompareMode | 'off'>('off');
  const [compareSplitRatio, setCompareSplitRatio] = useState(0.5);
  const [compareDividerDragging, setCompareDividerDragging] = useState(false);
  const [snapshotEntries, setSnapshotEntries] = useState<ProjectSnapshotEntry[]>([]);
  const [snapshotComparePath, setSnapshotComparePath] = useState('');
  const [snapshotCompareProject, setSnapshotCompareProject] = useState<Project>();
  const [snapshotCompareLoading, setSnapshotCompareLoading] = useState(false);
  const [canvasEditMode, setCanvasEditMode] = useState(false);
  const [frameInspectMode, setFrameInspectMode] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [frameInspectorSample, setFrameInspectorSample] = useState<FrameInspectorSample>();
  const [frameSearchQuery, setFrameSearchQuery] = useState('');
  const [frameSearchFocused, setFrameSearchFocused] = useState(false);
  const [frameSearchError, setFrameSearchError] = useState<string>();
  const prerenderCenter = Math.round(playheadTime * 2) / 2;
  const fps = project.settings.fps || 30;
  const snapshotCompareEnabled = Boolean(snapshotCompareProject);
  const compareEnabled = compareMode !== 'off' || snapshotCompareEnabled;
  const compareShowsDifference = compareMode === 'difference';
  const activeCompareMode: PreviewCompareMode = compareMode === 'off' ? 'left-right' : compareMode;
  const selectedMulticamClip = useMemo(() => {
    const clip = project.timeline.tracks.flatMap((track) => track.clips).find((item) => item.id === selectedClipId);
    return clip?.type === 'nested-sequence' && clip.multicam ? clip : undefined;
  }, [project.timeline.tracks, selectedClipId]);
  const selectedMulticamSequence = useMemo(
    () => (selectedMulticamClip ? project.sequences.find((sequence) => sequence.id === selectedMulticamClip.sequenceId) : undefined),
    [project.sequences, selectedMulticamClip]
  );
  const editableCanvasClips = useMemo(() => buildEditableCanvasClips(project, playheadTime), [project, playheadTime]);
  const selectedEditableClip = useMemo(() => editableCanvasClips.find((item) => item.clip.id === selectedClipId), [editableCanvasClips, selectedClipId]);
  const selectedInspectorClip = useMemo(() => selectedEditableClip?.clip, [selectedEditableClip]);
  const selectedPanoramaClip = useMemo(() => {
    const clip = project.timeline.tracks.flatMap((track) => track.clips).find((item) => item.id === selectedClipId);
    return clip?.type === 'video' && normalizeClipProjection(clip.projection) === 'equirectangular' ? clip : undefined;
  }, [project.timeline.tracks, selectedClipId]);
  const chromaKeyPickTarget = useMemo(() => editableCanvasClips.find((item) => item.clip.id === chromaKeyPickClipId), [chromaKeyPickClipId, editableCanvasClips]);
  const selectedPathMask = useMemo(() => selectedEditableClip?.clip.masks?.find((mask) => mask.type === 'path'), [selectedEditableClip]);
  const frameSearchCandidates = useMemo(() => buildFrameSearchCandidates(project, frameSearchQuery), [frameSearchQuery, project]);
  const showFrameSearchCandidates = frameSearchFocused && frameSearchQuery.trim().length > 0 && !isTimecodeLikeQuery(frameSearchQuery);
  const snapshotCompareRanges = useMemo(
    () => (snapshotCompareProject ? diffTimelineSnapshots(project.timeline, snapshotCompareProject.timeline) : []),
    [project.timeline, snapshotCompareProject]
  );
  const previewZoomPercent = Math.round(previewZoom * 100);
  const previewSurfaceStyle: CSSProperties = {
    transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
    transformOrigin: 'center'
  };

  useEffect(() => {
    setTimelineCompareRanges(snapshotCompareRanges);
    return () => setTimelineCompareRanges([]);
  }, [setTimelineCompareRanges, snapshotCompareRanges]);

  useEffect(() => {
    setSnapshotComparePath('');
    setSnapshotCompareProject(undefined);
    setTimelineCompareRanges([]);
  }, [project.id, setTimelineCompareRanges]);

  const refreshSnapshotEntries = async () => {
    setSnapshotCompareLoading(true);
    try {
      setSnapshotEntries(await listProjectSnapshots(project.id));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.projectSnapshots.loadFailed, message: error instanceof Error ? error.message : zhCN.projectSnapshots.loadFailed });
    } finally {
      setSnapshotCompareLoading(false);
    }
  };

  const selectSnapshotCompare = async (path: string) => {
    setSnapshotComparePath(path);
    if (!path) {
      setSnapshotCompareProject(undefined);
      setTimelineCompareRanges([]);
      return;
    }
    const entry = snapshotEntries.find((item) => item.path === path);
    if (!entry) {
      return;
    }
    setSnapshotCompareLoading(true);
    try {
      const snapshotProject = await readProjectSnapshot(entry, projectPath);
      setSnapshotCompareProject(snapshotProject);
      setCompareMode('left-right');
    } catch (error) {
      setSnapshotComparePath('');
      setSnapshotCompareProject(undefined);
      showToast({ kind: 'warning', title: zhCN.projectSnapshots.loadFailed, message: error instanceof Error ? error.message : zhCN.projectSnapshots.loadFailed });
    } finally {
      setSnapshotCompareLoading(false);
    }
  };

  useEffect(() => {
    if (chromaKeyPickClipId && !chromaKeyPickTarget) {
      setChromaKeyPickClipId(undefined);
    }
  }, [chromaKeyPickClipId, chromaKeyPickTarget, setChromaKeyPickClipId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key === '0') {
        event.preventDefault();
        resetPreviewZoom();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        frameSearchInputRef.current?.focus();
        frameSearchInputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const originalCanvas = originalCanvasRef.current;
    const differenceCanvas = differenceCanvasRef.current;
    const timeline = previewTimeline ?? project.timeline;
    const shouldCaptureScopes = scopesOpen && (!isPlaying || scopeFrameCounterRef.current % 4 === 0);
    const shouldCaptureDifference = compareShowsDifference && Boolean(differenceCanvas);
    const canUseRenderCache = !previewTimeline && !shouldCaptureScopes && !compareEnabled;
    const frame = Math.max(0, Math.round(playheadTime * fps));
    const frameTime = frame / fps;
    const frameKey = buildTimelineRenderFrameKey({
      timeline,
      media: project.media,
      sequences: project.sequences,
      activeSequenceId: project.activeSequenceId,
      frame,
      fps,
      width: canvas.width,
      height: canvas.height
    });
    let canceled = false;
    scopeFrameCounterRef.current += 1;
    void (async () => {
      try {
        if (canUseRenderCache) {
          const cached = await getTimelineRenderCacheController().getFrame(frameKey);
          if (cached) {
            try {
              if (!canceled) {
                rendererRef.current.drawCachedFrame(canvas, cached);
              }
            } finally {
              cached.close();
            }
            return;
          }
        }
        const result = await rendererRef.current.render(canvas, timeline, project.media, playheadTime, {
          captureFrame: shouldCaptureScopes || shouldCaptureDifference,
          sequences: project.sequences
        });
        if (canceled) {
          return;
        }
        if (result.frame && shouldCaptureScopes) {
          setScopeFrame(result.frame);
        }
        if (compareEnabled && originalCanvas) {
          const compareProject = snapshotCompareProject ?? project;
          const compareTimeline = snapshotCompareProject?.timeline ?? timeline;
          const originalResult = await originalRendererRef.current.render(originalCanvas, compareTimeline, compareProject.media, playheadTime, {
            bypassProcessing: !snapshotCompareProject,
            captureFrame: shouldCaptureDifference,
            sequences: compareProject.sequences
          });
          if (canceled) {
            return;
          }
          if (shouldCaptureDifference && result.frame && originalResult.frame && differenceCanvas) {
            drawPreviewDifferenceFrame(differenceCanvas, result.frame, originalResult.frame);
          }
        }
        if (canUseRenderCache) {
          const bitmap = await createImageBitmap(canvas);
          getTimelineRenderCacheController().putFrame({
            key: frameKey,
            bitmap,
            time: frameTime,
            duration: 1 / fps,
            bytes: canvas.width * canvas.height * 4,
            playheadTime
          });
        }
      } catch (error) {
        showToast({ kind: 'error', title: t.renderFailedTitle, message: error instanceof Error ? error.message : t.renderFailedMessage });
      }
    })();
    rendererRef.current.syncAudio(timeline, project.media, playheadTime, isPlaying && playbackRate > 0, project.masterVolume);
    const levels = rendererRef.current.getAudioLevels();
    setAudioLevels(levels.trackLevels, levels.masterLevel);
    return () => {
      canceled = true;
    };
  }, [
    fps,
    isPlaying,
    playbackRate,
    playheadTime,
    compareEnabled,
    compareShowsDifference,
    previewTimeline,
    project.activeSequenceId,
    project.masterVolume,
    project.media,
    project.sequences,
    project.timeline,
    scopesOpen,
    setAudioLevels,
    snapshotCompareProject
  ]);

  useEffect(() => {
    const previous = previousTimelineRef.current;
    if (previous && previous !== project.timeline) {
      getTimelineRenderCacheController().invalidateRanges(getTimelineRenderInvalidationRanges(previous, project.timeline));
    }
    previousTimelineRef.current = project.timeline;
  }, [project.timeline]);

  useEffect(() => {
    if (previewTimeline) {
      return undefined;
    }
    let canceled = false;
    const timer = window.setTimeout(() => {
      const duration = getTimelinePlaybackDuration(project.timeline);
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const renderer = new PreviewRenderer();
      const requests = buildTimelineRenderFrameRequests({
        timeline: project.timeline,
        media: project.media,
        sequences: project.sequences,
        activeSequenceId: project.activeSequenceId,
        playheadTime: prerenderCenter,
        duration,
        fps,
        width: canvas.width,
        height: canvas.height
      });

      void (async () => {
        for (const request of requests) {
          if (canceled) {
            break;
          }
          const cached = await getTimelineRenderCacheController().getFrame(request.key);
          if (cached) {
            cached.close();
            continue;
          }
          await renderer.render(canvas, project.timeline, project.media, request.time, { sequences: project.sequences });
          if (canceled) {
            break;
          }
          const bitmap = await createImageBitmap(canvas);
          getTimelineRenderCacheController().putFrame({
            key: request.key,
            bitmap,
            time: request.time,
            duration: 1 / fps,
            bytes: canvas.width * canvas.height * 4,
            playheadTime: prerenderCenter
          });
          await waitForIdleFrame();
        }
      })().catch(() => {
        // Live preview rendering already reports user-facing errors; prerender misses are best-effort.
      });
    }, 80);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [fps, prerenderCenter, previewTimeline, project.activeSequenceId, project.media, project.sequences, project.timeline]);

  useEffect(() => {
    getTimelineRenderCacheController().retainAround(playheadTime);
  }, [playheadTime]);

  useEffect(() => {
    if (isNestedSequenceDepthExceeded(project)) {
      showToast({ kind: 'warning', title: zhCN.timeline.nestedSequenceDepthTitle, message: zhCN.timeline.nestedSequenceDepthMessage });
    }
  }, [project]);

  function toggleCompareMode(): void {
    if (compareEnabled) {
      setCompareMode('off');
      setSnapshotComparePath('');
      setSnapshotCompareProject(undefined);
      setTimelineCompareRanges([]);
      return;
    }
    setCompareMode('left-right');
  }

  function jumpToFrameSearchCandidate(candidate: FrameSearchCandidate): void {
    setIsPlaying(false);
    setPlayheadTime(candidate.time);
    if (candidate.type === 'clip') {
      setSelectedClipIds([candidate.id]);
    }
    setFrameSearchError(undefined);
    setFrameSearchQuery(candidate.label);
    setFrameSearchFocused(false);
    frameSearchInputRef.current?.blur();
  }

  function executeFrameSearch(): void {
    const query = frameSearchQuery.trim();
    if (!query) {
      setFrameSearchError(undefined);
      return;
    }
    if (isTimecodeLikeQuery(query)) {
      const parsed = parseTimecodeToSeconds(query, { fps, duration: getTimelinePlaybackDuration(project.timeline) });
      if (!parsed.ok) {
        setFrameSearchError(frameSearchErrorMessage(parsed.error, fps));
        return;
      }
      setIsPlaying(false);
      setPlayheadTime(parsed.value.seconds);
      setFrameSearchError(undefined);
      frameSearchInputRef.current?.blur();
      return;
    }
    const [candidate] = frameSearchCandidates;
    if (candidate) {
      jumpToFrameSearchCandidate(candidate);
      return;
    }
    setFrameSearchError(t.frameSearchNoMatch);
  }

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
    if (previewZoom <= 1 || canvasEditMode || frameInspectMode || chromaKeyPickTarget || compareEnabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    previewPanDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPan: previewPan
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
      y: drag.startPan.y + event.clientY - drag.startClientY
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

  function updateFrameInspector(event: ReactPointerEvent<HTMLDivElement>): void {
    const sample = readFrameInspectorSample(event);
    setFrameInspectorSample(sample);
  }

  function clearFrameInspector(): void {
    setFrameInspectorSample(undefined);
  }

  async function sampleFrameInspectorColor(event: ReactPointerEvent<HTMLDivElement>): Promise<void> {
    const sample = readFrameInspectorSample(event);
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
      commandManager.execute(new UpdateClipCommand(timelineAccessor, selectedInspectorClip.id, buildChromaKeySamplePatch(selectedInspectorClip, sample.rgb)));
      showToast({ kind: 'success', title: t.frameInspectorApplied, message: sample.hex });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage });
    }
  }

  function readFrameInspectorSample(event: { clientX: number; clientY: number }): FrameInspectorSample | undefined {
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
        y: Math.min(Math.max(12, event.clientY - frameBounds.top + 12), Math.max(12, frameBounds.height - 210))
      }
    };
  }

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
        canvasHeight: canvas.height
      }
    );
  }

  function pickChromaKeyColor(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!chromaKeyPickTarget) {
      setChromaKeyPickClipId(undefined);
      return;
    }
    const canvas = canvasRef.current;
    const bounds = previewSurfaceRef.current?.getBoundingClientRect();
    const sample = canvas && bounds ? readPreviewCanvasPixel(canvas, bounds, event) : undefined;
    if (!sample) {
      showToast({ kind: 'warning', title: zhCN.inspector.chromaKey.pickFailedTitle, message: zhCN.inspector.chromaKey.pickFailedMessage });
      setChromaKeyPickClipId(undefined);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    try {
      commandManager.execute(new UpdateClipCommand(timelineAccessor, chromaKeyPickTarget.clip.id, buildChromaKeySamplePatch(chromaKeyPickTarget.clip, sample.rgb)));
      setSelectedClipIds([chromaKeyPickTarget.clip.id]);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage });
    } finally {
      setChromaKeyPickClipId(undefined);
    }
  }

  function beginCanvasTransformDrag(
    event: ReactPointerEvent<HTMLElement>,
    item: EditableCanvasClip,
    type: CanvasTransformDrag['type'],
    handle?: CanvasTransformHandle
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
      startTransform: normalizeTransform(item.clip.transform)
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
      startPanorama: panorama
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
      pitch: drag.startPanorama.pitch - (event.clientY - drag.startClientY) * 0.25
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
          panorama: normalizeClipPanoramaView({ ...panorama, fov: panorama.fov + delta })
        })
      );
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage });
    }
  }

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
      doubleClickPoint && lastPoint && rawPath.length > 3 && Math.hypot(lastPoint.x - doubleClickPoint.x, lastPoint.y - doubleClickPoint.y) < 0.02
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
    target: PathMaskDrag['target']
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
      startPoint: canvasPointToPathPoint(point, item),
      startPath: clonePathPoints(mask.path ?? [])
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
    const patch = buildPathMaskDragPatch(drag, canvasPointToPathPoint(point, selectedEditableClip));
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
      showToast({ kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage });
    }
  }

  function commitPathMaskPatch(clipId: string, maskId: string, patch: { path: PathPoint[] }): void {
    try {
      commandManager.execute(new UpdateMaskCommand(timelineAccessor, clipId, maskId, patch));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage });
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
      showToast({ kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage });
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
      showToast({ kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage });
    }
  }

  function getDragTransform(drag: CanvasTransformDrag, point: CanvasPoint, modifiers: { keepAspectRatio: boolean; fromCenter: boolean }): Transform {
    if (drag.type === 'move') {
      return moveTransformByCanvasDelta(drag.startTransform, { x: point.x - drag.startPoint.x, y: point.y - drag.startPoint.y });
    }
    if (drag.type === 'rotate') {
      return rotateClipTransform({
        transform: drag.startTransform,
        canvasWidth: drag.canvasWidth,
        canvasHeight: drag.canvasHeight,
        currentPoint: point
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
      fromCenter: modifiers.fromCenter
    });
  }

  useEffect(() => {
    if (!isPlaying) {
      rendererRef.current.pauseAllAudio();
      resetAudioLevels();
      return undefined;
    }
    let frame = 0;
    let last = performance.now();
    const duration = getTimelinePlaybackDuration(project.timeline);
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      const next = useEditorStore.getState().playheadTime + delta * playbackRate;
      if (playbackRate < 0 && next <= 0) {
        setPlayheadTime(0);
        setIsPlaying(false);
        return;
      }
      if (duration > 0 && next >= duration) {
        setPlayheadTime(duration);
        setIsPlaying(false);
        return;
      }
      setPlayheadTime(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, playbackRate, project.timeline, resetAudioLevels, setIsPlaying, setPlayheadTime]);

  return (
    <section
      className="flex min-h-0 flex-col"
      data-theme-canvas-background={theme.colors.canvasBackground}
      style={{ backgroundColor: theme.colors.canvasBackground, color: theme.colors.textPrimary }}
    >
      <div className="relative z-40 flex items-center justify-between border-b px-3 py-2" style={{ borderColor: theme.colors.border }}>
        <div>
          <div className="text-sm font-semibold">{t.title}</div>
          <div className="text-xs text-slate-300">{t.canvasSize}</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="preview-snapshot-compare-select">
            {t.snapshotCompare}
          </label>
          <select
            id="preview-snapshot-compare-select"
            className="h-9 max-w-[190px] rounded-md border border-white/10 bg-white/10 px-2 text-xs font-medium text-white outline-none hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            value={snapshotComparePath}
            disabled={snapshotCompareLoading}
            title={t.snapshotCompare}
            data-testid="preview-snapshot-compare-select"
            onPointerDown={() => void refreshSnapshotEntries()}
            onFocus={() => void refreshSnapshotEntries()}
            onChange={(event) => void selectSnapshotCompare(event.target.value)}
          >
            <option value="">{snapshotCompareLoading ? t.snapshotCompareLoading : t.snapshotCompareOff}</option>
            {snapshotEntries.map((entry) => (
              <option key={entry.path} value={entry.path}>
                {entry.name}
              </option>
            ))}
          </select>
          {compareEnabled ? (
            <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/10 p-0.5" data-testid="preview-compare-mode-group">
              <button
                className={`inline-flex h-8 w-8 items-center justify-center rounded text-white hover:bg-white/20 ${compareMode === 'left-right' ? 'bg-emerald-500/30' : ''}`}
                title={t.compareLeftRight}
                aria-label={t.compareLeftRight}
                data-testid="preview-compare-mode-left-right"
                onClick={() => setCompareMode('left-right')}
              >
                <Columns2 size={16} />
              </button>
              <button
                className={`inline-flex h-8 w-8 items-center justify-center rounded text-white hover:bg-white/20 ${compareMode === 'top-bottom' ? 'bg-emerald-500/30' : ''}`}
                title={t.compareTopBottom}
                aria-label={t.compareTopBottom}
                data-testid="preview-compare-mode-top-bottom"
                onClick={() => setCompareMode('top-bottom')}
              >
                <Rows2 size={16} />
              </button>
              <button
                className={`inline-flex h-8 w-8 items-center justify-center rounded text-white hover:bg-white/20 ${compareMode === 'difference' ? 'bg-emerald-500/30' : ''}`}
                title={t.compareDifference}
                aria-label={t.compareDifference}
                data-testid="preview-compare-mode-difference"
                onClick={() => setCompareMode('difference')}
              >
                <Blend size={16} />
              </button>
            </div>
          ) : null}
          <button
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white hover:bg-white/20 ${
              canvasEditMode ? 'bg-emerald-500/25' : 'bg-white/10'
            }`}
            title={canvasEditMode ? t.canvasEditModeActive : t.canvasEditMode}
            aria-label={canvasEditMode ? t.canvasEditModeActive : t.canvasEditMode}
            data-testid="preview-canvas-edit-toggle"
            data-active={canvasEditMode ? 'true' : 'false'}
            onClick={() => {
              setCanvasEditMode((value) => {
                const next = !value;
                if (next) {
                  setFrameInspectMode(false);
                  clearFrameInspector();
                }
                return next;
              });
            }}
          >
            <MousePointer2 size={17} />
          </button>
          <button
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white hover:bg-white/20 ${
              frameInspectMode ? 'bg-emerald-500/25' : 'bg-white/10'
            }`}
            title={frameInspectMode ? t.frameInspectorActive : t.frameInspector}
            aria-label={frameInspectMode ? t.frameInspectorActive : t.frameInspector}
            data-testid="preview-frame-inspector-toggle"
            data-active={frameInspectMode ? 'true' : 'false'}
            onClick={() => {
              setFrameInspectMode((value) => {
                const next = !value;
                if (next) {
                  setCanvasEditMode(false);
                  setChromaKeyPickClipId(undefined);
                }
                if (!next) {
                  clearFrameInspector();
                }
                return next;
              });
            }}
          >
            <Pipette size={17} />
          </button>
          <button
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white hover:bg-white/20 ${
              compareEnabled ? 'bg-emerald-500/25' : 'bg-white/10'
            }`}
            title={t.compareToggle}
            aria-label={t.compareToggle}
            data-testid="preview-compare-toggle"
            onClick={toggleCompareMode}
          >
            <GitCompareArrows size={17} />
          </button>
          <button
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white hover:bg-white/20 ${
              scopesOpen ? 'bg-emerald-500/25' : 'bg-white/10'
            }`}
            title={t.colorScopes}
            aria-label={t.colorScopes}
            data-testid="toggle-color-scopes"
            onClick={() => setScopesOpen((value) => !value)}
          >
            <BarChart3 size={17} />
          </button>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white hover:bg-white/20"
            title={isPlaying ? zhCN.toolbar.pause : zhCN.toolbar.play}
            aria-label={isPlaying ? zhCN.toolbar.pause : zhCN.toolbar.play}
            data-testid="preview-playback-button"
            data-playback-state={isPlaying ? 'playing' : 'paused'}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          </button>
        </div>
      </div>
      <div className={scopesOpen ? 'grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_180px]' : 'flex min-h-0 flex-1 items-center justify-center p-5'}>
        <div className={scopesOpen ? 'flex min-h-0 items-center justify-center p-4' : 'contents'}>
          <div
            ref={compareFrameRef}
            className={`relative aspect-video w-full max-w-[960px] overflow-hidden rounded-md shadow-soft ${
              previewZoom > 1 && !canvasEditMode && !frameInspectMode && !chromaKeyPickTarget && !compareEnabled ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            style={{ backgroundColor: theme.colors.canvasBackground }}
            onWheel={updatePreviewZoomFromWheel}
            onPointerDown={beginPreviewPan}
            onPointerMove={updatePreviewPan}
            onPointerUp={endPreviewPan}
            onPointerCancel={endPreviewPan}
          >
            <div ref={previewSurfaceRef} className="absolute inset-0" style={previewSurfaceStyle} data-testid="preview-surface">
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className={`pointer-events-none absolute inset-0 h-full w-full ${compareShowsDifference ? 'opacity-0' : 'opacity-100'}`}
                data-testid="preview-canvas"
              />
              {compareEnabled ? (
                <canvas
                  ref={originalCanvasRef}
                  width={1280}
                  height={720}
                  className={`pointer-events-none absolute inset-0 h-full w-full ${compareShowsDifference ? 'opacity-0' : 'opacity-100'}`}
                  style={buildPreviewCompareOverlayStyle(activeCompareMode, compareSplitRatio)}
                  data-testid="preview-compare-original-canvas"
                />
              ) : null}
              {compareShowsDifference ? (
                <canvas ref={differenceCanvasRef} width={1280} height={720} className="pointer-events-none absolute inset-0 h-full w-full" data-testid="preview-compare-difference-canvas" />
              ) : null}
              {safeFrameGuides ? <SafeFrameGuides /> : null}
              {compareEnabled && !compareShowsDifference ? (
                <div
                  role="separator"
                  aria-label={t.compareDivider}
                  data-testid="preview-compare-divider"
                  data-orientation={activeCompareMode === 'top-bottom' ? 'horizontal' : 'vertical'}
                  className={`absolute z-10 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.55)] ${activeCompareMode === 'top-bottom' ? 'cursor-row-resize' : 'cursor-col-resize'} ${
                    compareDividerDragging ? 'opacity-100' : 'opacity-80'
                  }`}
                  style={buildPreviewCompareDividerStyle(activeCompareMode, compareSplitRatio)}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setCompareDividerDragging(true);
                    updateCompareSplitFromPointer(event);
                  }}
                  onPointerMove={(event) => {
                    if (compareDividerDragging) {
                      updateCompareSplitFromPointer(event);
                    }
                  }}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    setCompareDividerDragging(false);
                    updateCompareSplitFromPointer(event);
                  }}
                  onPointerCancel={() => setCompareDividerDragging(false)}
                />
              ) : null}
              {selectedPanoramaClip && !canvasEditMode && !frameInspectMode && !compareEnabled && !chromaKeyPickTarget ? (
                <div
                  className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
                  title={t.panoramaDrag}
                  aria-label={t.panoramaDrag}
                  data-testid="panorama-preview-overlay"
                  onPointerDown={beginPanoramaPreviewDrag}
                  onPointerMove={updatePanoramaPreviewDrag}
                  onPointerUp={endPanoramaPreviewDrag}
                  onPointerCancel={endPanoramaPreviewDrag}
                  onWheel={updatePanoramaFov}
                />
              ) : null}
              {chromaKeyPickTarget ? (
                <div
                  className="absolute inset-0 z-40 cursor-crosshair"
                  title={zhCN.inspector.chromaKey.pickFromPreview}
                  aria-label={zhCN.inspector.chromaKey.pickFromPreview}
                  data-testid="chroma-key-pick-overlay"
                  onPointerDown={pickChromaKeyColor}
                />
              ) : null}
              {canvasEditMode && selectedEditableClip && selectedPathMask ? (
                <div
                  className="absolute inset-0 z-30 cursor-crosshair"
                  data-testid="path-mask-overlay"
                  onClick={addPathMaskAnchor}
                  onDoubleClick={closeSelectedPathMask}
                  onPointerMove={updatePathMaskDrag}
                  onPointerUp={endPathMaskDrag}
                  onPointerCancel={endPathMaskDrag}
                >
                  <PathMaskControls item={selectedEditableClip} mask={selectedPathMask} onBeginDrag={beginPathMaskDrag} />
                </div>
              ) : canvasEditMode ? (
                <div
                  className="absolute inset-0 z-30 cursor-crosshair"
                  data-testid="canvas-transform-overlay"
                  onPointerDown={beginCanvasHitDrag}
                  onPointerMove={updateCanvasTransformDrag}
                  onPointerUp={endCanvasTransformDrag}
                  onPointerCancel={endCanvasTransformDrag}
                >
                  {selectedEditableClip ? (
                    <CanvasTransformControls
                      item={selectedEditableClip}
                      onBeginDrag={(event, item, type, handle) => beginCanvasTransformDrag(event, item, type, handle)}
                    />
                  ) : null}
                </div>
              ) : null}
              {selectedMulticamClip && selectedMulticamSequence ? (
                <MulticamPreviewGrid
                  clip={selectedMulticamClip}
                  sequence={selectedMulticamSequence}
                  media={project.media}
                  sequences={project.sequences}
                  playheadTime={playheadTime}
                  onSelectAngle={(angleId) => {
                    try {
                      commandManager.execute(new CutMulticamClipCommand(projectAccessor, selectedMulticamClip.id, playheadTime, angleId));
                    } catch (error) {
                      showToast({
                        kind: 'warning',
                        title: t.multicamCutFailedTitle,
                        message: error instanceof Error ? error.message : t.multicamCutFailedMessage
                      });
                    }
                  }}
                />
              ) : null}
            </div>
            {frameInspectMode ? (
              <div
                className="absolute inset-0 z-50 cursor-crosshair"
                data-testid="frame-inspector-overlay"
                aria-label={t.frameInspectorActive}
                onPointerMove={(event) => {
                  if (event.target === event.currentTarget) {
                    updateFrameInspector(event);
                  }
                }}
                onPointerLeave={clearFrameInspector}
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) {
                    void sampleFrameInspectorColor(event);
                  }
                }}
              >
                {frameInspectorSample ? (
                  <FrameInspectorPopover
                    sample={frameInspectorSample}
                    canApplyChroma={Boolean(selectedInspectorClip)}
                    onApplyChroma={() => applyFrameInspectorColor(frameInspectorSample)}
                  />
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="absolute left-3 top-3 z-50 rounded border border-white/15 bg-black/65 px-2 py-1 text-[11px] font-semibold tabular-nums text-white shadow-soft hover:bg-black/80"
              title={t.previewZoomReset}
              data-testid="preview-zoom-label"
              onClick={resetPreviewZoom}
            >
              {previewZoomPercent}%
            </button>
          </div>
        </div>
        {scopesOpen ? <ColorScopesPanel frame={scopeFrame} active={scopesOpen} /> : null}
      </div>
      <div className="flex items-center gap-3 border-t border-black/30 px-3 py-2 text-xs text-slate-300">
        <div className="min-w-24 tabular-nums" data-testid="preview-timecode">
          {secondsToTimecode(playheadTime, fps, project.settings.timecodeFormat ?? 'ndf')}
        </div>
        <div className="relative min-w-0 flex-1">
          <input
            ref={frameSearchInputRef}
            type="search"
            value={frameSearchQuery}
            placeholder={t.frameSearchPlaceholder}
            className={`h-7 w-full rounded border bg-black/35 px-2 font-mono text-xs text-white outline-none placeholder:text-slate-500 ${
              frameSearchError ? 'border-red-400 focus:border-red-300' : 'border-white/15 focus:border-brand'
            }`}
            data-testid="frame-search-input"
            aria-invalid={frameSearchError ? 'true' : 'false'}
            onFocus={() => setFrameSearchFocused(true)}
            onBlur={() => setFrameSearchFocused(false)}
            onChange={(event) => {
              setFrameSearchQuery(event.target.value);
              setFrameSearchError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                executeFrameSearch();
              }
              if (event.key === 'Escape') {
                setFrameSearchError(undefined);
                setFrameSearchFocused(false);
                event.currentTarget.blur();
              }
            }}
          />
          {frameSearchError ? (
            <div className="absolute left-0 top-8 z-50 rounded border border-red-400/50 bg-red-950 px-2 py-1 text-[11px] text-red-100 shadow-soft" data-testid="frame-search-error">
              {frameSearchError}
            </div>
          ) : null}
          {showFrameSearchCandidates && frameSearchCandidates.length > 0 ? (
            <div className="absolute bottom-8 left-0 z-50 max-h-44 w-full overflow-auto rounded-md border border-white/15 bg-[#0b1120] py-1 shadow-soft" data-testid="frame-search-candidates">
              {frameSearchCandidates.map((candidate) => (
                <button
                  key={`${candidate.type}-${candidate.id}`}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left text-xs text-slate-100 hover:bg-white/10"
                  data-testid={`frame-search-candidate-${candidate.type}-${candidate.id}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => jumpToFrameSearchCandidate(candidate)}
                >
                  <span className="min-w-0 truncate">
                    <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
                      {candidate.type === 'marker' ? t.frameSearchMarkerType : t.frameSearchClipType}
                    </span>
                    {candidate.label}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-slate-400">{secondsToTimecode(candidate.time, fps, project.settings.timecodeFormat ?? 'ndf')}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SafeFrameGuides() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20" data-testid="preview-safe-frame-guides" aria-hidden="true">
      <div className="absolute border border-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" style={{ left: '5%', top: '5%', width: '90%', height: '90%' }} data-testid="preview-safe-frame-action" />
      <div className="absolute border border-amber-300/80 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" style={{ left: '10%', top: '10%', width: '80%', height: '80%' }} data-testid="preview-safe-frame-title" />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/65 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" data-testid="preview-safe-frame-center-vertical" />
      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/65 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" data-testid="preview-safe-frame-center-horizontal" />
      <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" data-testid="preview-safe-frame-center" />
    </div>
  );
}

function FrameInspectorPopover({
  sample,
  canApplyChroma,
  onApplyChroma
}: {
  sample: FrameInspectorSample;
  canApplyChroma: boolean;
  onApplyChroma(): void;
}) {
  const t = zhCN.preview;
  return (
    <div
      className="absolute w-[220px] rounded-md border border-white/15 bg-[#050b16]/95 p-2 text-xs text-slate-100 shadow-soft backdrop-blur"
      style={{ left: sample.position.x, top: sample.position.y }}
      data-testid="frame-inspector-popover"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="h-7 w-7 shrink-0 rounded border border-white/20" style={{ backgroundColor: rgbCss(sample.rgb) }} />
        <div className="min-w-0">
          <div className="font-mono text-[13px] font-semibold uppercase text-white" data-testid="frame-inspector-hex">
            {sample.hex}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">{t.frameInspectorSampled}</div>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono text-[11px]">
        <span className="text-slate-400">RGB</span>
        <span data-testid="frame-inspector-rgb">{sample.rgb.join(', ')}</span>
        <span className="text-slate-400">HSL</span>
        <span>
          {sample.hsl.h}, {sample.hsl.s}%, {sample.hsl.l}%
        </span>
        <span className="text-slate-400">PX</span>
        <span>
          {sample.coordinates.x}, {sample.coordinates.y}
        </span>
        <span className="text-slate-400">N</span>
        <span>
          {sample.coordinates.normalizedX.toFixed(3)}, {sample.coordinates.normalizedY.toFixed(3)}
        </span>
      </div>
      <div className="mt-2 grid h-20 w-20 grid-cols-5 overflow-hidden rounded border border-white/15" data-testid="frame-inspector-magnifier">
        {sample.swatches.map((color, index) => (
          <span
            key={`${index}-${color.join('-')}`}
            className={index === 12 ? 'h-4 w-4 outline outline-1 outline-white' : 'h-4 w-4'}
            style={{ backgroundColor: rgbCss(color) }}
          />
        ))}
      </div>
      <button
        type="button"
        className="mt-2 w-full rounded border border-white/15 bg-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!canApplyChroma}
        data-testid="frame-inspector-apply-chroma"
        onClick={onApplyChroma}
      >
        {t.frameInspectorApplyChroma}
      </button>
    </div>
  );
}

function rgbCss(color: ChromaKeyColor): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

interface FrameSearchCandidate {
  id: string;
  type: 'marker' | 'clip';
  label: string;
  time: number;
}

function isTimecodeLikeQuery(query: string): boolean {
  const trimmed = query.trim();
  return trimmed.includes(':') && /^[\d:]+$/.test(trimmed);
}

function frameSearchErrorMessage(error: TimecodeParseError, fps: number): string {
  const t = zhCN.preview;
  if (error === 'minutes') {
    return t.frameSearchMinuteError;
  }
  if (error === 'seconds') {
    return t.frameSearchSecondError;
  }
  if (error === 'frames') {
    return t.frameSearchFrameError(Math.round(fps) - 1);
  }
  if (error === 'duration') {
    return t.frameSearchDurationError;
  }
  return t.frameSearchFormatError;
}

function buildFrameSearchCandidates(project: Project, query: string): FrameSearchCandidate[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }
  const markerCandidates = (project.timeline.markers ?? [])
    .filter((marker) => marker.label.toLowerCase().includes(normalizedQuery))
    .map((marker): FrameSearchCandidate => ({ id: marker.id, type: 'marker', label: marker.label, time: marker.time }));
  const clipCandidates = project.timeline.tracks.flatMap((track) =>
    track.clips
      .filter((clip) => {
        const asset = getClipMediaAsset(project, clip);
        return [clip.name, asset?.name, asset?.path].some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .map((clip): FrameSearchCandidate => ({ id: clip.id, type: 'clip', label: clip.name, time: clip.start }))
  );
  return [...markerCandidates, ...clipCandidates]
    .sort((left, right) => {
      const leftStarts = left.label.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
      const rightStarts = right.label.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
      return leftStarts - rightStarts || left.time - right.time || left.label.localeCompare(right.label);
    })
    .slice(0, 8);
}

function getClipMediaAsset(project: Project, clip: Clip): Project['media'][number] | undefined {
  if (!('mediaId' in clip)) {
    return undefined;
  }
  return project.media.find((asset) => asset.id === clip.mediaId);
}

interface EditableCanvasClip {
  clip: Clip;
  box: ClipTransformBox;
  sourceWidth: number;
  sourceHeight: number;
}

interface CanvasTransformDrag {
  pointerId: number;
  clipId: string;
  type: 'move' | 'scale' | 'rotate';
  handle?: CanvasTransformHandle;
  sourceWidth: number;
  sourceHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  startPoint: CanvasPoint;
  startTransform: Transform;
  command?: UpdateClipCommand;
  patch?: ClipPatch;
}

interface PanoramaPreviewDrag {
  pointerId: number;
  clipId: string;
  startClientX: number;
  startClientY: number;
  startPanorama: ReturnType<typeof normalizeClipPanoramaView>;
  command?: UpdateClipCommand;
  patch?: ClipPatch;
}

interface PreviewPanDrag {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPan: { x: number; y: number };
}

interface FrameInspectorSample {
  coordinates: PreviewPixelCoordinates;
  rgb: ChromaKeyColor;
  hsl: ReturnType<typeof rgbToHsl>;
  hex: string;
  position: { x: number; y: number };
  swatches: ChromaKeyColor[];
  sampled?: boolean;
}

interface PreviewPixelRead {
  coordinates: PreviewPixelCoordinates;
  rgb: ChromaKeyColor;
  swatches: ChromaKeyColor[];
}

function readPreviewCanvasPixel(canvas: HTMLCanvasElement, bounds: DOMRect, event: { clientX: number; clientY: number }): PreviewPixelRead | undefined {
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
    offsetY: event.clientY - bounds.top
  });
  const pixel = new Uint8Array(4);
  gl.readPixels(coordinates.x, coordinates.webglY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return {
    coordinates,
    rgb: [pixel[0], pixel[1], pixel[2]],
    swatches: readPreviewCanvasPixelSwatches(gl, coordinates, canvas.width, canvas.height)
  };
}

function readPreviewCanvasPixelSwatches(gl: WebGLRenderingContext, coordinates: PreviewPixelCoordinates, width: number, height: number): ChromaKeyColor[] {
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

interface PathMaskDrag {
  pointerId: number;
  clipId: string;
  maskId: string;
  pointIndex: number;
  target: 'anchor' | 'handleIn' | 'handleOut';
  startPoint: PathPointHandle;
  startPath: PathPoint[];
  command?: UpdateMaskCommand;
  patch?: { path: PathPoint[] };
}

function CanvasTransformControls({
  item,
  onBeginDrag
}: {
  item: EditableCanvasClip;
  onBeginDrag(event: ReactPointerEvent<HTMLElement>, item: EditableCanvasClip, type: CanvasTransformDrag['type'], handle?: CanvasTransformHandle): void;
}) {
  const t = zhCN.preview;
  return (
    <>
      <div
        className="pointer-events-none absolute border border-emerald-300 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
        style={canvasBoxStyle(item.box)}
        data-testid="canvas-transform-bounds"
        data-clip-id={item.clip.id}
      >
        <span className="absolute left-1/2 top-0 h-10 w-px -translate-x-1/2 -translate-y-full bg-emerald-300/80" />
      </div>
      {CANVAS_TRANSFORM_HANDLES.map((handle) => (
        <button
          key={handle}
          type="button"
          className="absolute h-3 w-3 rounded-sm border border-black/60 bg-emerald-300 shadow-[0_0_0_1px_rgba(255,255,255,0.65)] hover:bg-white"
          style={{ ...canvasPointStyle(item.box.handles[handle]), cursor: canvasHandleCursor(handle) }}
          title={handle.toUpperCase()}
          aria-label={handle.toUpperCase()}
          data-testid={`canvas-transform-handle-${handle}`}
          onPointerDown={(event) => onBeginDrag(event, item, 'scale', handle)}
        />
      ))}
      <button
        type="button"
        className="absolute h-4 w-4 rounded-full border border-black/60 bg-white shadow-[0_0_0_2px_rgba(16,185,129,0.7)] hover:bg-emerald-100"
        style={{ ...canvasPointStyle(item.box.rotationHandle), cursor: 'grab' }}
        title={t.rotateHandle}
        aria-label={t.rotateHandle}
        data-testid="canvas-transform-rotate-handle"
        onPointerDown={(event) => onBeginDrag(event, item, 'rotate')}
      />
      <span
        className="pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-white bg-emerald-400 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
        style={canvasPointStyle(item.box.anchor)}
        title={t.transformAnchor}
        data-testid="canvas-transform-anchor"
      />
    </>
  );
}

function PathMaskControls({
  item,
  mask,
  onBeginDrag
}: {
  item: EditableCanvasClip;
  mask: ClipMask;
  onBeginDrag(event: ReactPointerEvent<HTMLElement>, item: EditableCanvasClip, mask: ClipMask, pointIndex: number, target: PathMaskDrag['target']): void;
}) {
  const path = mask.path ?? [];
  const t = zhCN.preview;
  const closed = isPathMaskClosed(path);
  const anchors = closed ? path.slice(0, -1) : path;
  const svgPath = buildCanvasPathMaskSvgPath(path, item);
  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${PREVIEW_CANVAS_WIDTH} ${PREVIEW_CANVAS_HEIGHT}`} data-testid="path-mask-svg">
        {svgPath ? <path d={svgPath} fill={closed ? 'rgba(16,185,129,0.22)' : 'none'} stroke="rgb(110,231,183)" strokeDasharray={closed ? undefined : '6 6'} strokeWidth={2} /> : null}
        {anchors.map((point, index) => {
          const handleIn = resolvePathHandle(point, 'handleIn');
          const handleOut = resolvePathHandle(point, 'handleOut');
          const anchorCanvas = pathPointToCanvasPoint(point, item);
          const handleInCanvas = pathPointToCanvasPoint(handleIn, item);
          const handleOutCanvas = pathPointToCanvasPoint(handleOut, item);
          return (
            <g key={`${mask.id}-handles-${index}`}>
              <line x1={anchorCanvas.x} y1={anchorCanvas.y} x2={handleInCanvas.x} y2={handleInCanvas.y} stroke="rgba(191,219,254,0.75)" strokeWidth={1} />
              <line x1={anchorCanvas.x} y1={anchorCanvas.y} x2={handleOutCanvas.x} y2={handleOutCanvas.y} stroke="rgba(191,219,254,0.75)" strokeWidth={1} />
            </g>
          );
        })}
      </svg>
      {anchors.map((point, index) => {
        const handleIn = resolvePathHandle(point, 'handleIn');
        const handleOut = resolvePathHandle(point, 'handleOut');
        return (
          <div key={`${mask.id}-controls-${index}`}>
            <button
              type="button"
              className="absolute h-3 w-3 rounded-full border border-black/60 bg-sky-200 shadow-[0_0_0_1px_rgba(255,255,255,0.8)] hover:bg-white"
              style={canvasPointStyle(pathPointToCanvasPoint(handleIn, item))}
              title={t.pathHandleIn}
              aria-label={t.pathHandleIn}
              data-path-mask-control="true"
              data-testid={`path-mask-handle-in-${index}`}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => onBeginDrag(event, item, mask, index, 'handleIn')}
            />
            <button
              type="button"
              className="absolute h-4 w-4 rounded-full border border-black/70 bg-emerald-300 shadow-[0_0_0_2px_rgba(255,255,255,0.7)] hover:bg-white"
              style={canvasPointStyle(pathPointToCanvasPoint(point, item))}
              title={t.pathAnchor(index + 1)}
              aria-label={t.pathAnchor(index + 1)}
              data-path-mask-control="true"
              data-testid={`path-mask-anchor-${index}`}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => onBeginDrag(event, item, mask, index, 'anchor')}
            />
            <button
              type="button"
              className="absolute h-3 w-3 rounded-full border border-black/60 bg-sky-200 shadow-[0_0_0_1px_rgba(255,255,255,0.8)] hover:bg-white"
              style={canvasPointStyle(pathPointToCanvasPoint(handleOut, item))}
              title={t.pathHandleOut}
              aria-label={t.pathHandleOut}
              data-path-mask-control="true"
              data-testid={`path-mask-handle-out-${index}`}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => onBeginDrag(event, item, mask, index, 'handleOut')}
            />
          </div>
        );
      })}
    </>
  );
}

function buildEditableCanvasClips(project: Project, playheadTime: number): EditableCanvasClip[] {
  return getRenderableTracks(project.timeline)
    .flatMap((track) =>
      track.clips
        .filter((clip) => isCanvasEditableClip(clip) && playheadTime >= clip.start && playheadTime < clip.start + clip.duration)
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
              canvasHeight: PREVIEW_CANVAS_HEIGHT
            })
          };
        })
    );
}

function isCanvasEditableClip(clip: Clip): boolean {
  return clip.type === 'video' || clip.type === 'image' || clip.type === 'text' || clip.type === 'nested-sequence';
}

function getCanvasClipSourceDimensions(project: Project, clip: Clip): { width: number; height: number } {
  if (clip.type === 'text') {
    return { width: 1024, height: 256 };
  }
  if (clip.type === 'nested-sequence') {
    return { width: PREVIEW_CANVAS_WIDTH, height: PREVIEW_CANVAS_HEIGHT };
  }
  if ('mediaId' in clip) {
    const asset = project.media.find((item) => item.id === clip.mediaId);
    return {
      width: Math.max(1, asset?.width || PREVIEW_CANVAS_WIDTH),
      height: Math.max(1, asset?.height || PREVIEW_CANVAS_HEIGHT)
    };
  }
  return { width: PREVIEW_CANVAS_WIDTH, height: PREVIEW_CANVAS_HEIGHT };
}

function canvasPointToPathPoint(point: CanvasPoint, item: EditableCanvasClip): PathPoint {
  const local = canvasPointToClipLocal(point, item.box);
  return {
    x: clampPathUnit((local.x + item.box.width / 2) / Math.max(1, item.box.width)),
    y: clampPathUnit((local.y + item.box.height / 2) / Math.max(1, item.box.height))
  };
}

function pathPointToCanvasPoint(point: PathPointHandle, item: EditableCanvasClip): CanvasPoint {
  return clipLocalToCanvasPoint(
    {
      x: point.x * item.box.width - item.box.width / 2,
      y: point.y * item.box.height - item.box.height / 2
    },
    item.box
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
    y: roundCanvasValue(x * sin + y * cos)
  };
}

function clipLocalToCanvasPoint(point: CanvasPoint, box: Pick<ClipTransformBox, 'center' | 'rotation'>): CanvasPoint {
  const radians = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: roundCanvasValue(box.center.x + point.x * cos - point.y * sin),
    y: roundCanvasValue(box.center.y + point.x * sin + point.y * cos)
  };
}

function buildPathMaskDragPatch(drag: PathMaskDrag, point: PathPointHandle): { path: PathPoint[] } {
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
    [drag.target]: { x: clampPathUnit(point.x), y: clampPathUnit(point.y) }
  };
  return { path };
}

function movePathAnchor(point: PathPoint, next: PathPointHandle, delta: PathPointHandle): PathPoint {
  return {
    ...point,
    x: clampPathUnit(next.x),
    y: clampPathUnit(next.y),
    handleIn: point.handleIn ? { x: clampPathUnit(point.handleIn.x + delta.x), y: clampPathUnit(point.handleIn.y + delta.y) } : undefined,
    handleOut: point.handleOut ? { x: clampPathUnit(point.handleOut.x + delta.x), y: clampPathUnit(point.handleOut.y + delta.y) } : undefined
  };
}

function clonePathPoints(points: PathPoint[]): PathPoint[] {
  return points.map((point) => ({
    x: point.x,
    y: point.y,
    ...(point.handleIn ? { handleIn: { ...point.handleIn } } : {}),
    ...(point.handleOut ? { handleOut: { ...point.handleOut } } : {})
  }));
}

function resolvePathHandle(point: PathPoint, key: 'handleIn' | 'handleOut'): PathPointHandle {
  const fallback = key === 'handleIn' ? -0.08 : 0.08;
  return point[key] ?? { x: clampPathUnit(point.x + fallback), y: point.y };
}

function buildCanvasPathMaskSvgPath(points: PathPoint[], item: EditableCanvasClip): string {
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
        `C ${formatSvgNumber(control1.x)} ${formatSvgNumber(control1.y)} ${formatSvgNumber(control2.x)} ${formatSvgNumber(control2.y)} ${formatSvgNumber(target.x)} ${formatSvgNumber(target.y)}`
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

function clampPathUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000;
}

function roundCanvasValue(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function canvasPointStyle(point: CanvasPoint): CSSProperties {
  return {
    left: `${(point.x / PREVIEW_CANVAS_WIDTH) * 100}%`,
    top: `${(point.y / PREVIEW_CANVAS_HEIGHT) * 100}%`,
    transform: 'translate(-50%, -50%)'
  };
}

function canvasBoxStyle(box: ClipTransformBox): CSSProperties {
  return {
    left: `${(box.center.x / PREVIEW_CANVAS_WIDTH) * 100}%`,
    top: `${(box.center.y / PREVIEW_CANVAS_HEIGHT) * 100}%`,
    width: `${(box.width / PREVIEW_CANVAS_WIDTH) * 100}%`,
    height: `${(box.height / PREVIEW_CANVAS_HEIGHT) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${box.rotation}deg)`
  };
}

function canvasHandleCursor(handle: CanvasTransformHandle): CSSProperties['cursor'] {
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

interface MulticamPreviewGridProps {
  clip: Extract<Clip, { type: 'nested-sequence' }>;
  sequence: Sequence;
  media: Project['media'];
  sequences: Sequence[];
  playheadTime: number;
  onSelectAngle(angleId: string): void;
}

function MulticamPreviewGrid({ clip, sequence, media, sequences, playheadTime, onSelectAngle }: MulticamPreviewGridProps) {
  const t = zhCN.preview;
  const canvasRefs = useRef(new Map<string, HTMLCanvasElement>());
  const renderersRef = useRef(new Map<string, PreviewRenderer>());
  const localTime = Math.min(clip.duration, Math.max(0, playheadTime - clip.start + clip.trimStart));
  const activeAngleId = useMemo(() => {
    try {
      return clip.multicam ? getActiveMulticamAngle(clip.multicam, localTime).id : undefined;
    } catch {
      return undefined;
    }
  }, [clip.multicam, localTime]);
  const columns = (clip.multicam?.angles.length ?? 0) <= 4 ? 2 : 3;

  useEffect(() => {
    let canceled = false;
    void (async () => {
      for (const angle of clip.multicam?.angles ?? []) {
        const canvas = canvasRefs.current.get(angle.id);
        const track = sequence.timeline.tracks.find((item) => item.id === angle.trackId);
        if (!canvas || !track) {
          continue;
        }
        const renderer = getAngleRenderer(renderersRef.current, angle.id);
        const angleTimeline: Timeline = {
          tracks: [{ ...track, solo: false, muted: false }],
          transitions: [],
          markers: []
        };
        try {
          await renderer.render(canvas, angleTimeline, media, localTime, { sequences });
        } catch {
          if (!canceled) {
            const context = canvas.getContext('2d');
            context?.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
        if (canceled) {
          break;
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [clip.multicam, localTime, media, sequence.timeline.tracks, sequences]);

  if (!clip.multicam) {
    return null;
  }

  return (
    <div
      className="absolute inset-2 z-20 grid gap-2 rounded-md border border-white/15 bg-black/70 p-2 shadow-soft"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      data-testid="multicam-preview-grid"
      aria-label={t.multicamGrid}
    >
      {clip.multicam.angles.map((angle, index) => (
        <button
          key={angle.id}
          type="button"
          className={`group relative min-h-0 overflow-hidden rounded-md border bg-black text-left ${
            activeAngleId === angle.id ? 'border-emerald-400 ring-2 ring-emerald-400/45' : 'border-white/15 hover:border-white/40'
          }`}
          title={t.multicamAngle(angle.name)}
          aria-label={t.multicamAngle(angle.name)}
          data-testid={`multicam-angle-button-${angle.id}`}
          data-active={activeAngleId === angle.id ? 'true' : 'false'}
          onClick={() => onSelectAngle(angle.id)}
        >
          <canvas
            ref={(node) => {
              if (node) {
                canvasRefs.current.set(angle.id, node);
              } else {
                canvasRefs.current.delete(angle.id);
              }
            }}
            width={480}
            height={270}
            className="h-full w-full object-cover"
            data-testid={`multicam-angle-canvas-${angle.id}`}
          />
          <span className="absolute left-2 top-2 rounded bg-black/75 px-2 py-1 text-[11px] font-medium text-white">
            {index + 1}. {angle.name}
          </span>
        </button>
      ))}
    </div>
  );
}

function getAngleRenderer(renderers: Map<string, PreviewRenderer>, angleId: string): PreviewRenderer {
  const existing = renderers.get(angleId);
  if (existing) {
    return existing;
  }
  const renderer = new PreviewRenderer();
  renderers.set(angleId, renderer);
  return renderer;
}

function waitForIdleFrame(): Promise<void> {
  return new Promise((resolve) => {
    const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) {
      idle(() => resolve(), { timeout: 50 });
      return;
    }
    window.requestAnimationFrame(() => resolve());
  });
}
