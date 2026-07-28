import type {Clip, ProjectAnnotation, TimelineGridSettings, TimelineSnapCandidate, SnapEdge, SelectionRect} from '@open-factory/editor-core';
import {
  DEFAULT_PROJECT_ANNOTATION_COLOR,
  buildSelectionMarqueeRect,
  calculateAnchoredScrollLeft,
  calculateTimelineScrollLeftFromMinimapY,
  clampTimelineZoom,
  createSnapHighlight,
  ensurePlayheadVisible,
  findTimelineSnapTargetWithGrid,
  fitTimelineZoomToWindow,
  getTimelineDuration,
  moveClip,
  rectsIntersect,
  round,
  snapTimelineTimeToGrid,
  snapTime,
} from '@open-factory/editor-core';
import {LONG_PRESS_PAN_THRESHOLD_MS} from '@open-factory/editor-core';
import {LABEL_WIDTH} from '../../TimelineParts';
import {zhCN} from '../../../../i18n/strings';
import type {TimelineHandlerParams} from './types';

export function createNavigationHandlers(
  params: TimelineHandlerParams,
  helpers: {
    findClip: (clipId: string) => Clip;
    minFrameDuration: () => number;
  },
) {
  const {
    project,
    allClips,
    zoom,
    playheadTime,
    scrollRef,
    rootRef,
    scrollViewport,
    setScrollViewport,
    setTimelineViewportHeight,
    longPressTimerRef,
    longPressActiveRef,
    scrollRafRef,
    setIsPanning,
    setPlayheadTime,
    setTimelineZoom,
    reduceMotion,
    setSnapHighlight,
    timelineGridSettings,
    timelineGridBeatTimes,
    beatSnapEnabled,
    startTransition,
    timelineDuration,
    minimapHeight,
    selectionStart,
    setSelectionStart,
    selectionRect,
    setSelectionRect,
    setSelectedClipIds,
    setAnnotationEditor,
  } = params;

  const {findClip, minFrameDuration} = helpers;

  function openAnnotationEditorAt(time: number, annotation?: ProjectAnnotation): void {
    setAnnotationEditor({
      id: annotation?.id,
      time: annotation?.time ?? Math.max(0, snapTime(time)),
      text: annotation?.text ?? zhCN.timeline.annotationLabel((project.annotations?.length ?? 0) + 1),
      color: annotation?.color ?? DEFAULT_PROJECT_ANNOTATION_COLOR,
    });
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const scroll = scrollRef.current;
      if (!scroll) {
        return;
      }
      const rect = scroll.getBoundingClientRect();
      applyZoom(clampTimelineZoom(event.deltaY < 0 ? zoom * 1.2 : zoom / 1.2), event.clientX - rect.left);
      return;
    }
    if (event.shiftKey) {
      event.preventDefault();
      const scroll = scrollRef.current;
      if (scroll) {
        scroll.scrollLeft += event.deltaY || event.deltaX;
        syncScrollViewport();
      }
    }
  }

  function syncScrollViewport(): void {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const scroll = scrollRef.current;
      if (!scroll) return;
      const nextScrollLeft = scroll.scrollLeft;
      const nextScrollTop = scroll.scrollTop;
      const nextViewportWidth = scroll.clientWidth || 960;
      const nextViewportHeight = scroll.clientHeight || 240;
      startTransition(() => {
        setScrollViewport({ scrollLeft: nextScrollLeft, scrollTop: nextScrollTop, viewportWidth: nextViewportWidth });
        setTimelineViewportHeight(nextViewportHeight);
      });
    });
  }

  function onTimelinePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('[data-testid^="timeline-clip-"]') || target.closest('[data-testid^="track-header-"]')) {
      return;
    }
    longPressActiveRef.current = false;
    const startX = event.clientX;
    const startY = event.clientY;
    const scroll = scrollRef.current;
    if (!scroll) {
      return;
    }
    const startScrollLeft = scroll.scrollLeft;
    longPressTimerRef.current = setTimeout(() => {
      longPressActiveRef.current = true;
      setIsPanning(true);
    }, LONG_PRESS_PAN_THRESHOLD_MS);

    function onMove(moveEvent: PointerEvent): void {
      if (!longPressActiveRef.current) {
        const dx = Math.abs(moveEvent.clientX - startX);
        const dy = Math.abs(moveEvent.clientY - startY);
        if (dx > 5 || dy > 5) {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
        return;
      }
      moveEvent.preventDefault();
      const delta = startX - moveEvent.clientX;
      scroll!.scrollLeft = startScrollLeft + delta;
      syncScrollViewport();
    }

    function onUp(): void {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      longPressActiveRef.current = false;
      setIsPanning(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function onTimelineDoubleClick(event: React.MouseEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement;
    if (target.closest('[data-testid^="timeline-clip-"]') || target.closest('[data-testid^="track-header-"]')) {
      return;
    }
    const scroll = scrollRef.current;
    if (!scroll) {
      return;
    }
    const duration = Math.max(1, getTimelineDuration(project.timeline));
    setTimelineZoom(fitTimelineZoomToWindow(duration, scroll.clientWidth ?? 960, LABEL_WIDTH));
    requestAnimationFrame(() => {
      scroll.scrollLeft = 0;
    });
  }

  function scrollTimelineFromMinimap(y: number, mode: 'top' | 'center'): void {
    const scroll = scrollRef.current;
    if (!scroll) {
      return;
    }
    scroll.scrollLeft = calculateTimelineScrollLeftFromMinimapY({
      y,
      viewportWidth: scroll.clientWidth || scrollViewport.viewportWidth,
      labelWidth: LABEL_WIDTH,
      zoom,
      duration: timelineDuration,
      minimapHeight,
      mode,
    });
    syncScrollViewport();
  }

  function onTrackPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button === 2) {
      return;
    }
    if (params.annotationMode) {
      event.preventDefault();
      return;
    }
    params.setTransitionMenu(undefined);
    params.setClipMenu(undefined);
    params.setVolumeEnvelopeMenu(undefined);
    params.setGapMenu(undefined);
    params.setRulerMenu(undefined);
    if (event.target !== event.currentTarget) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    rootRef.current?.focus();
    setSelectionStart({ x: event.clientX, y: event.clientY });
    setSelectionRect(
      buildSelectionMarqueeRect({ x: event.clientX, y: event.clientY }, { x: event.clientX, y: event.clientY }),
    );
  }

  function onAnnotationLayerPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openAnnotationEditorAt((event.clientX - rect.left) / zoom);
  }

  function findClipIdsIntersectingRect(rect: SelectionRect): string[] {
    const nodes = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-clip-id]') ?? []);
    return nodes
      .filter((node) => {
        const bounds = node.getBoundingClientRect();
        return rectsIntersect(rect, { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom });
      })
      .map((node) => node.dataset.clipId)
      .filter((clipId): clipId is string => Boolean(clipId));
  }

  function flashSnapHighlight(time: number): void {
    if (reduceMotion) {
      return;
    }
    const highlight = createSnapHighlight(time, Date.now());
    if (highlight) {
      setSnapHighlight(highlight);
    }
  }

  function snapClipStart(time: number, duration: number, clip: Clip, disabled: boolean, edges?: SnapEdge[]): number {
    const target = findTimelineSnapTargetWithGrid({
      clipStart: time,
      clipDuration: duration,
      candidates: buildSnapCandidates(clip),
      pixelsPerSecond: zoom,
      disabled,
      edges,
      grid: {
        enabled: timelineGridSettings.enabled,
        unit: timelineGridSettings.unit,
        fps: project.settings.fps || 30,
        beatTimes: timelineGridBeatTimes,
      },
    });
    if (target && !disabled) {
      flashSnapHighlight(target.candidate.time);
    }
    return target?.snappedStart ?? time;
  }

  function snapClipEnd(time: number, clip: Clip, disabled: boolean): number {
    const target = findTimelineSnapTargetWithGrid({
      clipStart: clip.start,
      clipDuration: Math.max(1 / 30, time - clip.start),
      candidates: buildSnapCandidates(clip),
      pixelsPerSecond: zoom,
      disabled,
      edges: ['end'],
      grid: {
        enabled: timelineGridSettings.enabled,
        unit: timelineGridSettings.unit,
        fps: project.settings.fps || 30,
        beatTimes: timelineGridBeatTimes,
      },
    });
    if (target && !disabled) {
      flashSnapHighlight(target.candidate.time);
    }
    return target?.candidate.time ?? time;
  }

  function snapKeyframeTime(clip: Clip, localTime: number, disabled: boolean): number {
    const roundedLocalTime = snapTime(localTime);
    if (!timelineGridSettings.enabled || disabled) {
      return roundedLocalTime;
    }
    const snappedTimelineTime = snapTimelineTimeToGrid({
      time: clip.start + roundedLocalTime,
      unit: timelineGridSettings.unit,
      fps: project.settings.fps || 30,
      pixelsPerSecond: zoom,
      beatTimes: timelineGridBeatTimes,
    });
    return snapTime(Math.min(clip.duration, Math.max(0, snappedTimelineTime - clip.start)));
  }

  function buildSnapCandidates(clip: Clip): TimelineSnapCandidate[] {
    return [
      { time: 0, kind: 'timeline-start' },
      { time: playheadTime, kind: 'playhead' },
      ...(project.timeline.markers ?? []).map((marker) => ({ time: marker.time, kind: 'marker' as const })),
      ...(beatSnapEnabled
        ? (project.beatMarkers ?? []).map((marker) => ({ time: marker.time, kind: 'beat' as const }))
        : []),
      ...project.timeline.tracks.flatMap((track) =>
        track.clips
          .filter((item) => item.id !== clip.id)
          .flatMap((item) => [
            { time: item.start, kind: 'clip-start' as const, clipId: item.id },
            { time: item.start + item.duration, kind: 'clip-end' as const, clipId: item.id },
          ]),
      ),
    ];
  }

  function applyZoom(nextZoom: number, anchorViewportX: number): void {
    const scroll = scrollRef.current;
    if (!scroll) {
      setTimelineZoom(nextZoom);
      return;
    }
    const anchoredScrollLeft = calculateAnchoredScrollLeft({
      scrollLeft: scroll.scrollLeft,
      anchorViewportX,
      oldZoom: zoom,
      newZoom: nextZoom,
      labelWidth: LABEL_WIDTH,
    });
    const nextScrollLeft = ensurePlayheadVisible({
      scrollLeft: anchoredScrollLeft,
      viewportWidth: scroll.clientWidth,
      playheadTime,
      zoom: nextZoom,
      labelWidth: LABEL_WIDTH,
    });
    scroll.scrollLeft = nextScrollLeft;
    setTimelineZoom(nextZoom);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scroll.scrollLeft = nextScrollLeft;
      });
    });
  }

  return {
    onWheel,
    syncScrollViewport,
    onTimelinePointerDown,
    onTimelineDoubleClick,
    scrollTimelineFromMinimap,
    onTrackPointerDown,
    onAnnotationLayerPointerDown,
    findClipIdsIntersectingRect,
    flashSnapHighlight,
    snapClipStart,
    snapClipEnd,
    snapKeyframeTime,
    buildSnapCandidates,
    applyZoom,
    openAnnotationEditorAt,
  };
}
