import {useEffect} from 'react';
import {calculateTimelineHeatmap} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {getWhisperAvailability} from '../../lib/whisper';
import {showToast} from '../../lib/toast';
import type {HeatmapWorkerResponse, TimelineStateParams} from './timelineStateTypes';

interface EffectsInput {
  // Store
  project: import('../../store/editorStore').EditorState['project'];
  selectedClipId: string | undefined;
  selectedClipIds: string[];

  // UI state
  snapHighlight: import('@open-factory/editor-core').TimelineSnapHighlight | undefined;
  setSnapHighlight: React.Dispatch<React.SetStateAction<import('@open-factory/editor-core').TimelineSnapHighlight | undefined>>;
  setRollingTrimActive: React.Dispatch<React.SetStateAction<boolean>>;
  setSlipEditActive: React.Dispatch<React.SetStateAction<boolean>>;
  setSlideEditActive: React.Dispatch<React.SetStateAction<boolean>>;
  setEnvelopeEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  setVolumeEnvelopeMenu: React.Dispatch<React.SetStateAction<import('./TimelineMenus').VolumeEnvelopeMenuState | undefined>>;
  setSelectedTrackIds: React.Dispatch<React.SetStateAction<string[]>>;
  setTrackSelectionAnchorId: React.Dispatch<React.SetStateAction<string | undefined>>;
  setAnnotationPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setWhisperAvailability: React.Dispatch<React.SetStateAction<import('../../lib/whisper').WhisperAvailability>>;
  setHeatmapSegments: React.Dispatch<React.SetStateAction<import('@open-factory/editor-core').TimelineHeatmapSegment[]>>;

  // Computed
  orderedTrackIds: string[];
  protectedRanges: import('@open-factory/editor-core').ProtectedRange[];
  timelineNotes: {length: number};
  timelineDuration: number;
  bookmarkPanelOpen: boolean;

  // Other
  whisperExecutablePath: string;
  whisperModelPath: string;
  heatmapWorkerRef: React.MutableRefObject<Worker | null>;
  heatmapRequestIdRef: React.MutableRefObject<number>;

  // Params
  params: TimelineStateParams;
  reduceMotion: boolean;
}

export function useTimelineEffects(input: EffectsInput): void {
  const {
    project,
    selectedClipId,
    selectedClipIds,
    snapHighlight,
    setSnapHighlight,
    setRollingTrimActive,
    setSlipEditActive,
    setSlideEditActive,
    setEnvelopeEditMode,
    setVolumeEnvelopeMenu,
    setSelectedTrackIds,
    setTrackSelectionAnchorId,
    setAnnotationPanelOpen,
    setWhisperAvailability,
    setHeatmapSegments,
    orderedTrackIds,
    protectedRanges,
    timelineNotes,
    timelineDuration,
    bookmarkPanelOpen,
    whisperExecutablePath,
    whisperModelPath,
    heatmapWorkerRef,
    heatmapRequestIdRef,
    params,
    reduceMotion,
  } = input;
  const {
    heatmap,
    handlerRefs,
    sceneDetectionRequestId = 0,
  } = params;

  // useEffect - bookmark panel auto-close annotation panel
  useEffect(() => {
    if (bookmarkPanelOpen && (project.bookmarks?.length ?? 0) > 0) {
      setAnnotationPanelOpen(false);
    }
  }, [bookmarkPanelOpen, project.bookmarks?.length]);

  // useEffect - sync track selection with live tracks
  useEffect(() => {
    const liveTrackIds = new Set(orderedTrackIds);
    setSelectedTrackIds((current) => current.filter((trackId) => liveTrackIds.has(trackId)));
    setTrackSelectionAnchorId((current) => (current && liveTrackIds.has(current) ? current : undefined));
  }, [orderedTrackIds]);

  // useEffect - whisper availability
  useEffect(() => {
    let disposed = false;
    void getWhisperAvailability({executablePath: whisperExecutablePath, modelPath: whisperModelPath}).then(
      (availability) => {
        if (!disposed) {
          setWhisperAvailability(availability);
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [whisperExecutablePath, whisperModelPath]);

  // useEffect - snap highlight auto-dismiss
  useEffect(() => {
    if (!snapHighlight || reduceMotion) {
      if (reduceMotion && snapHighlight) {
        setSnapHighlight(undefined);
      }
      return undefined;
    }
    const delay = Math.max(0, snapHighlight.expiresAtMs - Date.now());
    const timeout = window.setTimeout(() => setSnapHighlight(undefined), delay);
    return () => window.clearTimeout(timeout);
  }, [reduceMotion, snapHighlight]);

  // useEffect - keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === 'a' &&
        !isEditableKeyboardTarget(event.target)
      ) {
        event.preventDefault();
        setSelectedTrackIds(orderedTrackIds);
        setTrackSelectionAnchorId(orderedTrackIds[0]);
        return;
      }
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'e' &&
        !isEditableKeyboardTarget(event.target)
      ) {
        event.preventDefault();
        setEnvelopeEditMode((active) => !active);
        setVolumeEnvelopeMenu(undefined);
        return;
      }
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'n' &&
        !isEditableKeyboardTarget(event.target)
      ) {
        event.preventDefault();
        handlerRefs?.current.quickAddTimelineNote?.();
        return;
      }
      if (event.shiftKey && event.key.toLowerCase() === 'p' && !isEditableKeyboardTarget(event.target)) {
        event.preventDefault();
        handlerRefs?.current.toggleProtectedRangeAtPlayhead?.();
        return;
      }
      if (event.key.toLowerCase() === 'r') {
        setRollingTrimActive(true);
      }
      if (event.key.toLowerCase() === 's') {
        setSlipEditActive(true);
      }
      if (event.key.toLowerCase() === 'd') {
        setSlideEditActive(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        setRollingTrimActive(false);
      }
      if (event.key.toLowerCase() === 's') {
        setSlipEditActive(false);
      }
      if (event.key.toLowerCase() === 'd') {
        setSlideEditActive(false);
      }
    };
    const onBlur = () => {
      setRollingTrimActive(false);
      setSlipEditActive(false);
      setSlideEditActive(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [orderedTrackIds, project.protectedRanges, protectedRanges, timelineNotes.length]);

  // useEffect - sync scroll viewport on resize
  useEffect(() => {
    handlerRefs?.current.syncScrollViewport?.();
    const handleResize = () => handlerRefs?.current.syncScrollViewport?.();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handlerRefs]);

  // useEffect - scene detection request
  useEffect(() => {
    if (sceneDetectionRequestId <= 0) {
      return;
    }
    const targetClipId = selectedClipId ?? selectedClipIds[0];
    if (!targetClipId) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.sceneUnavailableTitle,
        message: zhCN.timeline.sceneUnavailableMessage,
      });
      return;
    }
    handlerRefs?.current.openSceneDetection?.(targetClipId);
  }, [sceneDetectionRequestId, selectedClipId, selectedClipIds]);

  // useEffect - heatmap computation
  useEffect(() => {
    if (!heatmap?.enabled) {
      setHeatmapSegments([]);
      return undefined;
    }
    const requestId = heatmapRequestIdRef.current + 1;
    heatmapRequestIdRef.current = requestId;
    const bucketSeconds = Math.max(0.25, Math.min(2, Math.ceil(timelineDuration / 180)));
    if (typeof Worker !== 'undefined') {
      try {
        const worker =
          heatmapWorkerRef.current ??
          new Worker(new URL('../../workers/timeline-heatmap.worker.ts', import.meta.url), {
            type: 'module',
          });
        heatmapWorkerRef.current = worker;
        worker.onmessage = (event: MessageEvent<HeatmapWorkerResponse>) => {
          if (event.data.id === heatmapRequestIdRef.current) {
            setHeatmapSegments(event.data.segments);
          }
        };
        worker.postMessage({
          id: requestId,
          type: heatmap.type,
          timeline: project.timeline,
          duration: timelineDuration,
          bucketSeconds,
        });
        return undefined;
      } catch {
        heatmapWorkerRef.current?.terminate();
        heatmapWorkerRef.current = null;
      }
    }
    const timer = window.setTimeout(() => {
      const segments = calculateTimelineHeatmap(heatmap.type, project.timeline, {
        duration: timelineDuration,
        bucketSeconds,
      });
      if (requestId === heatmapRequestIdRef.current) {
        setHeatmapSegments(segments);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [heatmap?.enabled, heatmap?.type, project.timeline, timelineDuration]);

  // useEffect - terminate heatmap worker on unmount
  useEffect(() => () => heatmapWorkerRef.current?.terminate(), []);
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName ?? ''));
}
