// Timeline hooks 测试共享 fixture：构造最小可用的 project / clip / asset / params
// 覆盖目标：apps/desktop/src/components/Timeline/hooks/timeline/* 的工厂直调测试
import { vi } from 'vitest';
import type { Clip, ClipGroup, MediaAsset, Project, Track } from '@open-factory/editor-core';
import { createId } from '@open-factory/editor-core';
import type { TimelineHandlerParams } from '../types';

export function makeClip(overrides: Partial<Clip> & { id?: string; trackId?: string } = {}): Clip {
  const id = overrides.id ?? createId('clip');
  const trackId = overrides.trackId ?? 'track-video-1';
  const base = {
    id,
    type: 'video' as const,
    name: `clip-${id}`,
    trackId,
    start: 0,
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    opacity: 1,
    volume: 1,
    speed: 1,
    keyframes: {},
    colorLabel: null,
    locked: false,
  };
  return { ...base, ...overrides } as unknown as Clip;
}

export function makeTrack(overrides: Partial<Track> & { id?: string; clips?: Clip[] } = {}): Track {
  const id = overrides.id ?? 'track-video-1';
  return {
    id,
    type: 'video',
    name: `Track ${id}`,
    clips: overrides.clips ?? [],
    muted: false,
    solo: false,
    locked: false,
    volume: 1,
    height: 64,
    ...overrides,
  } as unknown as Track;
}

export function makeAsset(overrides: Partial<MediaAsset> & { id?: string } = {}): MediaAsset {
  const id = overrides.id ?? createId('media');
  return {
    id,
    type: 'video',
    name: `asset-${id}`,
    path: `D:/media/${id}.mp4`,
    duration: 30,
    width: 1920,
    height: 1080,
    frameRate: 30,
    hasAudio: true,
    importedAt: new Date().toISOString(),
    ...overrides,
  } as MediaAsset;
}

export function makeProject(
  overrides: {
    tracks?: Track[];
    media?: MediaAsset[];
    clipGroups?: ClipGroup[];
    protectedRanges?: Project['protectedRanges'];
    settings?: Partial<Project['settings']>;
  } = {},
): Project {
  return {
    id: createId('project'),
    name: 'Test Project',
    version: 1,
    settings: {
      width: 1920,
      height: 1080,
      fps: 30,
      timecodeFormat: 'ndf',
      ...overrides.settings,
    },
    timeline: {
      tracks: overrides.tracks ?? [makeTrack()],
      markers: [],
    },
    media: overrides.media ?? [],
    clipGroups: overrides.clipGroups ?? [],
    protectedRanges: overrides.protectedRanges ?? [],
    sequences: [],
    activeSequenceId: 'sequence-main',
  } as unknown as Project;
}

/** 构造工厂直调所需的 params（只填充被测 handler 解构的字段 + 测试用 setter 断言桩） */
export function makeParams(
  overrides: {
    project?: Project;
    allClips?: Clip[];
    selectedClipId?: string;
    selectedClipIds?: string[];
    clipGroups?: ClipGroup[];
    clipGroupByClipId?: Map<string, ClipGroup>;
    selectedGroup?: ClipGroup;
    playheadTime?: number;
    gapMenu?: TimelineHandlerParams['gapMenu'];
    transitionMenu?: TimelineHandlerParams['transitionMenu'];
    protectedRanges?: TimelineHandlerParams['protectedRanges'];
    timelineNotes?: TimelineHandlerParams['timelineNotes'];
  } = {},
): TimelineHandlerParams & {
  setters: Record<string, ReturnType<typeof vi.fn>>;
} {
  const setters = {
    setGapMenu: vi.fn(),
    setClipMenu: vi.fn(),
    setTransitionMenu: vi.fn(),
    setVolumeEnvelopeMenu: vi.fn(),
    setRulerMenu: vi.fn(),
    setSelectedClipId: vi.fn(),
    setSelectedClipIds: vi.fn(),
    clearSelectedClipIds: vi.fn(),
    addMedia: vi.fn(),
    setSilenceDialog: vi.fn(),
    setSceneDialog: vi.fn(),
    setWhisperDialog: vi.fn(),
    setCoverFrameDialog: vi.fn(),
    setReframeDialog: vi.fn(),
    setTransitionDialog: vi.fn(),
    setDialoguePanelOpen: vi.fn(),
    setDialogueMarkers: vi.fn(),
    setDialogueMisses: vi.fn(),
    setSubtitleAlignReport: vi.fn(),
    setAnnotationEditor: vi.fn(),
    setTimelineNoteEditor: vi.fn(),
    setTimelineNoteDraft: vi.fn(),
    setBookmarkRename: vi.fn(),
    setBookmarkPanelVisible: vi.fn(),
    setAnnotationPanelOpen: vi.fn(),
    setTimelineNotePanelOpen: vi.fn(),
  };
  const project = overrides.project ?? makeProject();
  const allClips = overrides.allClips ?? project.timeline.tracks.flatMap((track) => track.clips);
  const params = {
    // useState 值
    drag: undefined,
    setDrag: vi.fn(),
    snapHighlight: undefined,
    setSnapHighlight: vi.fn(),
    selectionRect: undefined,
    setSelectionRect: vi.fn(),
    selectionStart: undefined,
    setSelectionStart: vi.fn(),
    transitionMenu: overrides.transitionMenu,
    setTransitionMenu: setters.setTransitionMenu,
    clipMenu: undefined,
    setClipMenu: setters.setClipMenu,
    volumeEnvelopeMenu: undefined,
    setVolumeEnvelopeMenu: setters.setVolumeEnvelopeMenu,
    gapMenu: overrides.gapMenu,
    setGapMenu: setters.setGapMenu,
    rulerMenu: undefined,
    setRulerMenu: setters.setRulerMenu,
    silenceDialog: undefined,
    setSilenceDialog: setters.setSilenceDialog,
    sceneDialog: undefined,
    setSceneDialog: setters.setSceneDialog,
    coverFrameDialog: undefined,
    setCoverFrameDialog: setters.setCoverFrameDialog,
    whisperDialog: undefined,
    setWhisperDialog: setters.setWhisperDialog,
    subtitleAlignReport: undefined,
    setSubtitleAlignReport: setters.setSubtitleAlignReport,
    replaceMediaDialog: undefined,
    setReplaceMediaDialog: vi.fn(),
    reframeDialog: undefined,
    setReframeDialog: setters.setReframeDialog,
    transitionDialog: undefined,
    setTransitionDialog: setters.setTransitionDialog,
    // panels / modes
    dialoguePanelOpen: false,
    setDialoguePanelOpen: setters.setDialoguePanelOpen,
    dialogueMarkers: [],
    setDialogueMarkers: setters.setDialogueMarkers,
    dialogueMisses: [],
    setDialogueMisses: setters.setDialogueMisses,
    whisperAvailability: { ready: false, error: 'not configured' },
    rollingTrimActive: false,
    setRollingTrimActive: vi.fn(),
    slipEditActive: false,
    setSlipEditActive: vi.fn(),
    slideEditActive: false,
    setSlideEditActive: vi.fn(),
    annotationMode: false,
    setAnnotationMode: vi.fn(),
    annotationPanelOpen: true,
    setAnnotationPanelOpen: setters.setAnnotationPanelOpen,
    annotationEditor: undefined,
    setAnnotationEditor: setters.setAnnotationEditor,
    timelineNotePanelOpen: false,
    setTimelineNotePanelOpen: setters.setTimelineNotePanelOpen,
    timelineNoteEditor: undefined,
    setTimelineNoteEditor: setters.setTimelineNoteEditor,
    timelineNoteSearch: '',
    timelineNoteDraft: undefined,
    setTimelineNoteDraft: setters.setTimelineNoteDraft,
    bookmarkRename: undefined,
    setBookmarkRename: setters.setBookmarkRename,
    beatSnapEnabled: true,
    setBeatSnapEnabled: vi.fn(),
    beatSnapPanelOpen: false,
    setBeatSnapPanelOpen: vi.fn(),
    envelopeEditMode: false,
    setEnvelopeEditMode: vi.fn(),
    selectedTrackIds: [],
    setSelectedTrackIds: vi.fn(),
    trackSelectionAnchorId: undefined,
    setTrackSelectionAnchorId: vi.fn(),
    trackBatchMenu: undefined,
    setTrackBatchMenu: vi.fn(),
    gapStatsOpen: false,
    setGapStatsOpen: vi.fn(),
    audioScrubEnabled: false,
    equalHeightPrompt: false,
    setEqualHeightPrompt: vi.fn(),
    equalHeightValue: '',
    setEqualHeightValue: vi.fn(),
    scrollViewport: { scrollLeft: 0, scrollTop: 0, viewportWidth: 1920 },
    setScrollViewport: vi.fn(),
    setTimelineViewportHeight: vi.fn(),
    isPanning: false,
    setIsPanning: vi.fn(),
    // useEditorStore
    project,
    selectedClipId: overrides.selectedClipId,
    selectedClipIds: overrides.selectedClipIds ?? [],
    playheadTime: overrides.playheadTime ?? 0,
    isPlaying: false,
    inPoint: undefined,
    outPoint: undefined,
    projectPath: undefined,
    zoom: 100,
    setSelectedClipId: setters.setSelectedClipId,
    setSelectedClipIds: setters.setSelectedClipIds,
    addMedia: setters.addMedia,
    selectedKeyframe: undefined,
    selectedKeyframes: [],
    setSelectedKeyframe: vi.fn(),
    setSelectedKeyframes: vi.fn(),
    toggleSelectedKeyframe: vi.fn(),
    toggleSelectedClipId: vi.fn(),
    clearSelectedClipIds: setters.clearSelectedClipIds,
    setPlayheadTime: vi.fn(),
    setInPoint: vi.fn(),
    setOutPoint: vi.fn(),
    setTimelineZoom: vi.fn(),
    setPreviewTimeline: vi.fn(),
    setActiveSequenceId: vi.fn(),
    // useMemo
    allClips,
    clipGroups: overrides.clipGroups ?? [],
    clipGroupByClipId: overrides.clipGroupByClipId ?? new Map(),
    selectedGroup: overrides.selectedGroup,
    orderedTrackIds: project.timeline.tracks.map((track) => track.id),
    protectedRanges: overrides.protectedRanges ?? [],
    timelineNotes: overrides.timelineNotes ?? [],
    timelineDuration: 30,
    // useRef
    rootRef: { current: null },
    scrollRef: { current: null },
    longPressTimerRef: { current: null },
    longPressActiveRef: { current: false },
    scrollRafRef: { current: 0 },
    // Props
    onConvertMediaFrameRate: undefined,
    onBookmarkPanelOpenChange: undefined,
    reduceMotion: false,
    timelineGridSettings: { enabled: false, unit: 'second' as const },
    collaborationEnabled: false,
    collaborationUserId: 'user-1',
    // computed
    bookmarkPanelOpen: false,
    setBookmarkPanelVisible: setters.setBookmarkPanelVisible,
    projectDuration: 30,
    timelineGridBeatTimes: [],
    startTransition: (callback: () => void) => callback(),
    minimapHeight: 160,
    handlerRefs: undefined,
    useEditorStoreRef: undefined as never,
  } as unknown as TimelineHandlerParams;
  return Object.assign(params, { setters });
}
