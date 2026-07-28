import {useEffect, useMemo, useRef, useTransition} from 'react';
import {getTimelineDuration, getTimelineLargeProjectMode} from '@open-factory/editor-core';
import {useCollaborationStore} from '../../store/collaborationStore';
import {useEditorStore} from '../../store/editorStore';
import {useRenderCacheStore} from '../../store/renderCacheStore';
import {useTimelineUIState} from './useTimelineUIState';
import {useTimelineComputed} from './useTimelineComputed';
import {useTimelineEffects} from './useTimelineEffects';
import type {TimelineStateParams, TimelineState} from './timelineStateTypes';

export type {TimelineStateParams, TimelineState} from './timelineStateTypes';

export function useTimelineState(params: TimelineStateParams): TimelineState {
  const {
    heatmap,
    timelineGridSettings,
    reduceMotion = false,
  } = params;

  // ---------------------------------------------------------------------------
  // Store selectors
  // ---------------------------------------------------------------------------

  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const inPoint = useEditorStore((state) => state.inPoint);
  const outPoint = useEditorStore((state) => state.outPoint);
  const projectPath = useEditorStore((state) => state.projectPath);
  const timelineCompareRanges = useEditorStore((state) => state.timelineCompareRanges);
  const zoom = useEditorStore((state) => state.timelineZoom);
  const collaborationEnabled = useCollaborationStore((state) => state.enabled);
  const collaborationUserId = useCollaborationStore((state) => state.userId);
  const collaborationUsers = useCollaborationStore((state) => state.users);
  const collaborationLocks = useCollaborationStore((state) => state.locks);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const addMedia = useEditorStore((state) => state.addMedia);
  const selectedKeyframe = useEditorStore((state) => state.selectedKeyframe);
  const selectedKeyframes = useEditorStore((state) => state.selectedKeyframes);
  const setSelectedKeyframe = useEditorStore((state) => state.setSelectedKeyframe);
  const setSelectedKeyframes = useEditorStore((state) => state.setSelectedKeyframes);
  const toggleSelectedKeyframe = useEditorStore((state) => state.toggleSelectedKeyframe);
  const toggleSelectedClipId = useEditorStore((state) => state.toggleSelectedClipId);
  const clearSelectedClipIds = useEditorStore((state) => state.clearSelectedClipIds);
  const setPlayheadTime = useEditorStore((state) => state.setPlayheadTime);
  const setInPoint = useEditorStore((state) => state.setInPoint);
  const setOutPoint = useEditorStore((state) => state.setOutPoint);
  const setTimelineZoom = useEditorStore((state) => state.setTimelineZoom);
  const setPreviewTimeline = useEditorStore((state) => state.setPreviewTimeline);
  const setActiveSequenceId = useEditorStore((state) => state.setActiveSequenceId);
  const renderCacheRanges = useRenderCacheStore((state) => state.ranges);
  const staleRanges = useRenderCacheStore((state) => state.staleRanges);

  // ---------------------------------------------------------------------------
  // Sub-hooks
  // ---------------------------------------------------------------------------

  const ui = useTimelineUIState(params);

  const timelineDuration = Math.max(
    10,
    ...project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration + 2)),
  );

  const computed = useTimelineComputed({
    store: {
      project,
      playheadTime,
      isPlaying,
      inPoint,
      outPoint,
      zoom,
      collaborationEnabled,
      collaborationUserId,
      collaborationUsers,
      collaborationLocks,
      selectedClipIds,
    },
    ui: {
      scrollViewport: ui.scrollViewport,
      timelineViewportHeight: ui.timelineViewportHeight,
      heatmapSegments: ui.heatmapSegments,
      bookmarkPanelOpen: ui.bookmarkPanelOpen,
      timelineNoteSearch: ui.timelineNoteSearch,
      setAnnotationPanelOpen: ui.setAnnotationPanelOpen,
    },
    params,
    timelineDuration,
  });

  // ---------------------------------------------------------------------------
  // useRef declarations
  // ---------------------------------------------------------------------------

  const rootRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const heatmapWorkerRef = useRef<Worker | null>(null);
  const heatmapRequestIdRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActiveRef = useRef(false);
  const gestureScaleRef = useRef(1);
  const scrollRafRef = useRef(0);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useTimelineEffects({
    project,
    selectedClipId,
    selectedClipIds,
    snapHighlight: ui.snapHighlight,
    setSnapHighlight: ui.setSnapHighlight,
    setRollingTrimActive: ui.setRollingTrimActive,
    setSlipEditActive: ui.setSlipEditActive,
    setSlideEditActive: ui.setSlideEditActive,
    setEnvelopeEditMode: ui.setEnvelopeEditMode,
    setVolumeEnvelopeMenu: ui.setVolumeEnvelopeMenu,
    setSelectedTrackIds: ui.setSelectedTrackIds,
    setTrackSelectionAnchorId: ui.setTrackSelectionAnchorId,
    setAnnotationPanelOpen: ui.setAnnotationPanelOpen,
    setWhisperAvailability: ui.setWhisperAvailability,
    setHeatmapSegments: ui.setHeatmapSegments,
    orderedTrackIds: computed.orderedTrackIds,
    protectedRanges: computed.protectedRanges,
    timelineNotes: computed.timelineNotes,
    timelineDuration,
    bookmarkPanelOpen: ui.bookmarkPanelOpen,
    whisperExecutablePath: ui.whisperExecutablePath,
    whisperModelPath: ui.whisperModelPath,
    heatmapWorkerRef,
    heatmapRequestIdRef,
    params,
    reduceMotion,
  });

  // ---------------------------------------------------------------------------
  // useTransition
  // ---------------------------------------------------------------------------

  const [isPending, startTransition] = useTransition();

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // useEditorStore
    project,
    selectedClipId,
    selectedClipIds,
    playheadTime,
    isPlaying,
    inPoint,
    outPoint,
    projectPath,
    timelineCompareRanges,
    zoom,
    setSelectedClipId,
    setSelectedClipIds: setSelectedClipIds as (ids: string[] | ((current: string[]) => string[])) => void,
    addMedia,
    selectedKeyframe,
    selectedKeyframes,
    setSelectedKeyframe,
    setSelectedKeyframes,
    toggleSelectedKeyframe,
    toggleSelectedClipId,
    clearSelectedClipIds,
    setPlayheadTime,
    setInPoint,
    setOutPoint,
    setTimelineZoom,
    setPreviewTimeline,
    setActiveSequenceId,

    // useCollaborationStore
    collaborationEnabled,
    collaborationUserId,
    collaborationUsers,
    collaborationLocks,

    // useRenderCacheStore
    renderCacheRanges,
    staleRanges,

    // useWhisperSettingsStore
    whisperExecutablePath: ui.whisperExecutablePath,
    whisperModelPath: ui.whisperModelPath,

    // useState - drag / UI interaction state
    drag: ui.drag,
    setDrag: ui.setDrag,
    snapHighlight: ui.snapHighlight,
    setSnapHighlight: ui.setSnapHighlight,
    selectionRect: ui.selectionRect,
    setSelectionRect: ui.setSelectionRect,
    selectionStart: ui.selectionStart,
    setSelectionStart: ui.setSelectionStart,
    isPanning: ui.isPanning,
    setIsPanning: ui.setIsPanning,

    // useState - menus
    transitionMenu: ui.transitionMenu,
    setTransitionMenu: ui.setTransitionMenu,
    clipMenu: ui.clipMenu,
    setClipMenu: ui.setClipMenu,
    volumeEnvelopeMenu: ui.volumeEnvelopeMenu,
    setVolumeEnvelopeMenu: ui.setVolumeEnvelopeMenu,
    gapMenu: ui.gapMenu,
    setGapMenu: ui.setGapMenu,
    rulerMenu: ui.rulerMenu,
    setRulerMenu: ui.setRulerMenu,
    trackBatchMenu: ui.trackBatchMenu,
    setTrackBatchMenu: ui.setTrackBatchMenu,

    // useState - dialogs
    silenceDialog: ui.silenceDialog,
    setSilenceDialog: ui.setSilenceDialog,
    sceneDialog: ui.sceneDialog,
    setSceneDialog: ui.setSceneDialog,
    coverFrameDialog: ui.coverFrameDialog,
    setCoverFrameDialog: ui.setCoverFrameDialog,
    whisperDialog: ui.whisperDialog,
    setWhisperDialog: ui.setWhisperDialog,
    subtitleAlignReport: ui.subtitleAlignReport,
    setSubtitleAlignReport: ui.setSubtitleAlignReport,
    replaceMediaDialog: ui.replaceMediaDialog,
    setReplaceMediaDialog: ui.setReplaceMediaDialog,
    reframeDialog: ui.reframeDialog,
    setReframeDialog: ui.setReframeDialog,
    transitionDialog: ui.transitionDialog,
    setTransitionDialog: ui.setTransitionDialog,
    sequenceSettingsDialogOpen: ui.sequenceSettingsDialogOpen,
    setSequenceSettingsDialogOpen: ui.setSequenceSettingsDialogOpen,

    // useState - panels / modes
    dialoguePanelOpen: ui.dialoguePanelOpen,
    setDialoguePanelOpen: ui.setDialoguePanelOpen,
    dialogueMarkers: ui.dialogueMarkers,
    setDialogueMarkers: ui.setDialogueMarkers,
    dialogueMisses: ui.dialogueMisses,
    setDialogueMisses: ui.setDialogueMisses,
    whisperAvailability: ui.whisperAvailability,
    setWhisperAvailability: ui.setWhisperAvailability,
    rollingTrimActive: ui.rollingTrimActive,
    setRollingTrimActive: ui.setRollingTrimActive,
    slipEditActive: ui.slipEditActive,
    setSlipEditActive: ui.setSlipEditActive,
    slideEditActive: ui.slideEditActive,
    setSlideEditActive: ui.setSlideEditActive,
    annotationMode: ui.annotationMode,
    setAnnotationMode: ui.setAnnotationMode,
    annotationPanelOpen: ui.annotationPanelOpen,
    setAnnotationPanelOpen: ui.setAnnotationPanelOpen,
    annotationEditor: ui.annotationEditor,
    setAnnotationEditor: ui.setAnnotationEditor,
    timelineNotePanelOpen: ui.timelineNotePanelOpen,
    setTimelineNotePanelOpen: ui.setTimelineNotePanelOpen,
    timelineNoteEditor: ui.timelineNoteEditor,
    setTimelineNoteEditor: ui.setTimelineNoteEditor,
    timelineNoteSearch: ui.timelineNoteSearch,
    setTimelineNoteSearch: ui.setTimelineNoteSearch,
    timelineNoteDraft: ui.timelineNoteDraft,
    setTimelineNoteDraft: ui.setTimelineNoteDraft,
    localBookmarkPanelOpen: ui.localBookmarkPanelOpen,
    setLocalBookmarkPanelOpen: ui.setLocalBookmarkPanelOpen,
    bookmarkPanelOpen: ui.bookmarkPanelOpen,
    bookmarkRename: ui.bookmarkRename,
    setBookmarkRename: ui.setBookmarkRename,
    timelineColorFilter: ui.timelineColorFilter,
    setTimelineColorFilter: ui.setTimelineColorFilter,
    beatSnapEnabled: ui.beatSnapEnabled,
    setBeatSnapEnabled: ui.setBeatSnapEnabled,
    beatSnapPanelOpen: ui.beatSnapPanelOpen,
    setBeatSnapPanelOpen: ui.setBeatSnapPanelOpen,
    envelopeEditMode: ui.envelopeEditMode,
    setEnvelopeEditMode: ui.setEnvelopeEditMode,
    selectedTrackIds: ui.selectedTrackIds,
    setSelectedTrackIds: ui.setSelectedTrackIds,
    trackSelectionAnchorId: ui.trackSelectionAnchorId,
    setTrackSelectionAnchorId: ui.setTrackSelectionAnchorId,
    gapStatsOpen: ui.gapStatsOpen,
    setGapStatsOpen: ui.setGapStatsOpen,
    audioScrubEnabled: ui.audioScrubEnabled,
    setAudioScrubEnabled: ui.setAudioScrubEnabled,
    equalHeightPrompt: ui.equalHeightPrompt,
    setEqualHeightPrompt: ui.setEqualHeightPrompt,
    equalHeightValue: ui.equalHeightValue,
    setEqualHeightValue: ui.setEqualHeightValue,
    scrollViewport: ui.scrollViewport,
    setScrollViewport: ui.setScrollViewport,
    timelineViewportHeight: ui.timelineViewportHeight,
    setTimelineViewportHeight: ui.setTimelineViewportHeight,
    heatmapSegments: ui.heatmapSegments,
    setHeatmapSegments: ui.setHeatmapSegments,

    // useTransition
    isPending,
    startTransition,

    // useRef
    rootRef,
    scrollRef,
    heatmapWorkerRef,
    heatmapRequestIdRef,
    longPressTimerRef,
    longPressActiveRef,
    gestureScaleRef,
    scrollRafRef,

    // useDeferredValue
    deferredHeatmapSegments: computed.deferredHeatmapSegments,
    deferredMinimapLayout: computed.deferredMinimapLayout,

    // useMemo / computed
    allClips: computed.allClips,
    largeProjectMode: computed.largeProjectMode,
    timelineDuration,
    timelineGridBeatTimes: computed.timelineGridBeatTimes,
    ticks: computed.ticks,
    playheadTimecode: computed.playheadTimecode,
    gridLines: computed.gridLines,
    remoteCollaborationUsers: computed.remoteCollaborationUsers,
    collaborationLocksByClipId: computed.collaborationLocksByClipId,
    activeBeatMarkerId: computed.activeBeatMarkerId,
    exportRangeHighlights: computed.exportRangeHighlights,
    minimapHeight: computed.minimapHeight,
    minimapLayout: computed.minimapLayout,
    minimapViewport: computed.minimapViewport,
    protectedRanges: computed.protectedRanges,
    timelineNotes: computed.timelineNotes,
    timelineNoteLayouts: computed.timelineNoteLayouts,
    filteredTimelineNotes: computed.filteredTimelineNotes,
    sceneCutOverlays: computed.sceneCutOverlays,
    clipGroups: computed.clipGroups,
    clipGroupByClipId: computed.clipGroupByClipId,
    selectedGroup: computed.selectedGroup,
    orderedTrackIds: computed.orderedTrackIds,
    virtualWindow: computed.virtualWindow,
    virtualTrackWindow: computed.virtualTrackWindow,
    virtualTracks: computed.virtualTracks,
    thumbnailTrackSamples: computed.thumbnailTrackSamples,
    activeSequence: computed.activeSequence,
    isMainSequence: computed.isMainSequence,
    projectDuration: computed.projectDuration,
    width: computed.width,
    visibleStart: computed.visibleStart,
    visibleEnd: computed.visibleEnd,

    // Helper
    setBookmarkPanelVisible: ui.setBookmarkPanelVisible,
  };
}
