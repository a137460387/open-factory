import {
  buildTimelineMinimapLayout,
  buildTimelineRulerTicks,
  buildTimelineGridLines,
  buildTimelineThumbnailTrackSamples,
  buildTimelineNoteLayout,
  calculateTimelineHeatmap,
  calculateTimelineMinimapViewportRect,
  filterTimelineVirtualTracks,
  getTimelineDuration,
  getTimelineLargeProjectMode,
  getTimelineVirtualRenderWindow,
  getTimelineVirtualTrackWindow,
  normalizeClipGroups,
  normalizeExportRanges,
  normalizeProtectedRanges,
  round,
  secondsToTimecode,
  sortTimelineThumbnailSamplesByPriority,
  findCompleteClipGroup,
  DEFAULT_TIMELINE_GRID_SETTINGS,
  type ClipGroup,
  type TimelineColorHeatmapPoint,
  type TimelineGridSettings,
  type TimelineHeatmapSegment,
  type TimelineLabelColor,
  type TimelineMinimapLayout,
  type TimelineMinimapViewportRect,
  type TimelineSnapHighlight,
  type SelectionRect,
  type SceneColorDifference,
  type DialogueInterval,
  type DialogueWhisperMiss,
} from '@open-factory/editor-core';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { zhCN } from '../../i18n/strings';
import { getWhisperAvailability, type WhisperAvailability } from '../../lib/whisper';
import { type CollaborationUiState, useCollaborationStore } from '../../store/collaborationStore';
import { type EditorState, useEditorStore } from '../../store/editorStore';
import { type RenderCacheState, useRenderCacheStore } from '../../store/renderCacheStore';
import { useWhisperSettingsStore } from '../../store/whisperSettingsStore';
import { readTimelineInteractionSettings, type TimelineHeatmapViewSettings } from '../../settings/appSettings';
import { LABEL_WIDTH, TRACK_HEIGHT, type DragState } from './TimelineParts';
import type {
  TransitionMenuState,
  ClipMenuState,
  VolumeEnvelopeMenuState,
  GapMenuState,
  RulerMenuState,
  TrackBatchMenuState,
} from './TimelineMenus';
import type {
  ReplaceMediaDialogState,
  SilenceDialogState,
  SceneDialogState,
  WhisperDialogState,
  CoverFrameDialogState,
  AnnotationEditorState,
  TimelineNoteEditorState,
} from './TimelineDialogs';
import type { TimelineNoteDraftState, BookmarkRenameState } from './TimelineOverlays';
import type { RulerContextMenuAction } from './timeline-ruler-menu';
import { showToast } from '../../lib/toast';
import { cancelSceneDetection, type SceneDetectProgressEvent } from '../../lib/tauri-bridge';

interface HeatmapWorkerResponse {
  id: number;
  segments: TimelineHeatmapSegment[];
}

export interface TimelineStateParams {
  thumbnailTrackVisible?: boolean;
  minimapVisible?: boolean;
  heatmap?: TimelineHeatmapViewSettings;
  colorHeatmap?: TimelineColorHeatmapPoint[];
  colorJumps?: SceneColorDifference[];
  timelineGridSettings?: TimelineGridSettings;
  reduceMotion?: boolean;
  bookmarkPanelOpen?: boolean;
  onBookmarkPanelOpenChange?(open: boolean): void;
  onConvertMediaFrameRate?(assetId: string): void;
  sceneDetectionRequestId?: number;

  // Handler callbacks (from useTimelineHandlers, provided via refs)
  handlerRefs?: React.MutableRefObject<{
    quickAddTimelineNote?: () => void;
    toggleProtectedRangeAtPlayhead?: () => void;
    syncScrollViewport?: () => void;
    openSceneDetection?: (clipId: string) => void;
  }>;
}

export interface TimelineState {
  // useEditorStore
  project: EditorState['project'];
  selectedClipId: string | undefined;
  selectedClipIds: string[];
  playheadTime: number;
  isPlaying: boolean;
  inPoint: number | undefined;
  outPoint: number | undefined;
  projectPath: string | undefined;
  timelineCompareRanges: EditorState['timelineCompareRanges'];
  zoom: number;
  setSelectedClipId: (id: string | undefined) => void;
  setSelectedClipIds: (ids: string[] | ((current: string[]) => string[])) => void;
  addMedia: EditorState['addMedia'];
  selectedKeyframe: EditorState['selectedKeyframe'];
  selectedKeyframes: EditorState['selectedKeyframes'];
  setSelectedKeyframe: EditorState['setSelectedKeyframe'];
  setSelectedKeyframes: EditorState['setSelectedKeyframes'];
  toggleSelectedKeyframe: EditorState['toggleSelectedKeyframe'];
  toggleSelectedClipId: EditorState['toggleSelectedClipId'];
  clearSelectedClipIds: EditorState['clearSelectedClipIds'];
  setPlayheadTime: EditorState['setPlayheadTime'];
  setInPoint: EditorState['setInPoint'];
  setOutPoint: EditorState['setOutPoint'];
  setTimelineZoom: EditorState['setTimelineZoom'];
  setPreviewTimeline: EditorState['setPreviewTimeline'];
  setActiveSequenceId: EditorState['setActiveSequenceId'];

  // useCollaborationStore
  collaborationEnabled: boolean;
  collaborationUserId: string;
  collaborationUsers: CollaborationUiState['users'];
  collaborationLocks: CollaborationUiState['locks'];

  // useRenderCacheStore
  renderCacheRanges: RenderCacheState['ranges'];
  staleRanges: RenderCacheState['staleRanges'];

  // useWhisperSettingsStore
  whisperExecutablePath: string | undefined;
  whisperModelPath: string | undefined;

  // useState – drag / UI interaction state
  drag: DragState | undefined;
  setDrag: React.Dispatch<React.SetStateAction<DragState | undefined>>;
  snapHighlight: TimelineSnapHighlight | undefined;
  setSnapHighlight: React.Dispatch<React.SetStateAction<TimelineSnapHighlight | undefined>>;
  selectionRect: SelectionRect | undefined;
  setSelectionRect: React.Dispatch<React.SetStateAction<SelectionRect | undefined>>;
  selectionStart: { x: number; y: number } | undefined;
  setSelectionStart: React.Dispatch<React.SetStateAction<{ x: number; y: number } | undefined>>;
  isPanning: boolean;
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>;

  // useState – menus
  transitionMenu: TransitionMenuState | undefined;
  setTransitionMenu: React.Dispatch<React.SetStateAction<TransitionMenuState | undefined>>;
  clipMenu: ClipMenuState | undefined;
  setClipMenu: React.Dispatch<React.SetStateAction<ClipMenuState | undefined>>;
  volumeEnvelopeMenu: VolumeEnvelopeMenuState | undefined;
  setVolumeEnvelopeMenu: React.Dispatch<React.SetStateAction<VolumeEnvelopeMenuState | undefined>>;
  gapMenu: GapMenuState | undefined;
  setGapMenu: React.Dispatch<React.SetStateAction<GapMenuState | undefined>>;
  rulerMenu: RulerMenuState | undefined;
  setRulerMenu: React.Dispatch<React.SetStateAction<RulerMenuState | undefined>>;
  trackBatchMenu: TrackBatchMenuState | undefined;
  setTrackBatchMenu: React.Dispatch<React.SetStateAction<TrackBatchMenuState | undefined>>;

  // useState – dialogs
  silenceDialog: SilenceDialogState | undefined;
  setSilenceDialog: React.Dispatch<React.SetStateAction<SilenceDialogState | undefined>>;
  sceneDialog: SceneDialogState | undefined;
  setSceneDialog: React.Dispatch<React.SetStateAction<SceneDialogState | undefined>>;
  coverFrameDialog: CoverFrameDialogState | undefined;
  setCoverFrameDialog: React.Dispatch<React.SetStateAction<CoverFrameDialogState | undefined>>;
  whisperDialog: WhisperDialogState | undefined;
  setWhisperDialog: React.Dispatch<React.SetStateAction<WhisperDialogState | undefined>>;
  subtitleAlignReport: { correctedCount: number; averageOffsetMs: number } | undefined;
  setSubtitleAlignReport: React.Dispatch<
    React.SetStateAction<{ correctedCount: number; averageOffsetMs: number } | undefined>
  >;
  replaceMediaDialog: ReplaceMediaDialogState | undefined;
  setReplaceMediaDialog: React.Dispatch<React.SetStateAction<ReplaceMediaDialogState | undefined>>;
  reframeDialog: { clipId: string } | undefined;
  setReframeDialog: React.Dispatch<React.SetStateAction<{ clipId: string } | undefined>>;
  transitionDialog:
    | {
        clipId: string;
        adjacentClipId: string;
        recommendations: import('@open-factory/editor-core').TransitionRecommendation[];
      }
    | undefined;
  setTransitionDialog: React.Dispatch<
    React.SetStateAction<
      | {
          clipId: string;
          adjacentClipId: string;
          recommendations: import('@open-factory/editor-core').TransitionRecommendation[];
        }
      | undefined
    >
  >;
  sequenceSettingsDialogOpen: boolean;
  setSequenceSettingsDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // useState – panels / modes
  dialoguePanelOpen: boolean;
  setDialoguePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dialogueMarkers: DialogueInterval[];
  setDialogueMarkers: React.Dispatch<React.SetStateAction<DialogueInterval[]>>;
  dialogueMisses: DialogueWhisperMiss[];
  setDialogueMisses: React.Dispatch<React.SetStateAction<DialogueWhisperMiss[]>>;
  whisperAvailability: WhisperAvailability;
  setWhisperAvailability: React.Dispatch<React.SetStateAction<WhisperAvailability>>;
  rollingTrimActive: boolean;
  setRollingTrimActive: React.Dispatch<React.SetStateAction<boolean>>;
  slipEditActive: boolean;
  setSlipEditActive: React.Dispatch<React.SetStateAction<boolean>>;
  slideEditActive: boolean;
  setSlideEditActive: React.Dispatch<React.SetStateAction<boolean>>;
  annotationMode: boolean;
  setAnnotationMode: React.Dispatch<React.SetStateAction<boolean>>;
  annotationPanelOpen: boolean;
  setAnnotationPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  annotationEditor: AnnotationEditorState | undefined;
  setAnnotationEditor: React.Dispatch<React.SetStateAction<AnnotationEditorState | undefined>>;
  timelineNotePanelOpen: boolean;
  setTimelineNotePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  timelineNoteEditor: TimelineNoteEditorState | undefined;
  setTimelineNoteEditor: React.Dispatch<React.SetStateAction<TimelineNoteEditorState | undefined>>;
  timelineNoteSearch: string;
  setTimelineNoteSearch: React.Dispatch<React.SetStateAction<string>>;
  timelineNoteDraft: TimelineNoteDraftState | undefined;
  setTimelineNoteDraft: React.Dispatch<React.SetStateAction<TimelineNoteDraftState | undefined>>;
  localBookmarkPanelOpen: boolean;
  setLocalBookmarkPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  bookmarkPanelOpen: boolean;
  bookmarkRename: BookmarkRenameState | undefined;
  setBookmarkRename: React.Dispatch<React.SetStateAction<BookmarkRenameState | undefined>>;
  timelineColorFilter: TimelineLabelColor | null;
  setTimelineColorFilter: React.Dispatch<React.SetStateAction<TimelineLabelColor | null>>;
  beatSnapEnabled: boolean;
  setBeatSnapEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  beatSnapPanelOpen: boolean;
  setBeatSnapPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  envelopeEditMode: boolean;
  setEnvelopeEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTrackIds: string[];
  setSelectedTrackIds: React.Dispatch<React.SetStateAction<string[]>>;
  trackSelectionAnchorId: string | undefined;
  setTrackSelectionAnchorId: React.Dispatch<React.SetStateAction<string | undefined>>;
  gapStatsOpen: boolean;
  setGapStatsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  audioScrubEnabled: boolean;
  setAudioScrubEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  equalHeightPrompt: boolean;
  setEqualHeightPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  equalHeightValue: string;
  setEqualHeightValue: React.Dispatch<React.SetStateAction<string>>;
  scrollViewport: { scrollLeft: number; scrollTop: number; viewportWidth: number };
  setScrollViewport: React.Dispatch<
    React.SetStateAction<{ scrollLeft: number; scrollTop: number; viewportWidth: number }>
  >;
  timelineViewportHeight: number;
  setTimelineViewportHeight: React.Dispatch<React.SetStateAction<number>>;
  heatmapSegments: TimelineHeatmapSegment[];
  setHeatmapSegments: React.Dispatch<React.SetStateAction<TimelineHeatmapSegment[]>>;

  // useTransition
  isPending: boolean;
  startTransition: React.TransitionStartFunction;

  // useRef
  rootRef: React.MutableRefObject<HTMLElement | null>;
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  heatmapWorkerRef: React.MutableRefObject<Worker | null>;
  heatmapRequestIdRef: React.MutableRefObject<number>;
  longPressTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  longPressActiveRef: React.MutableRefObject<boolean>;
  gestureScaleRef: React.MutableRefObject<number>;
  scrollRafRef: React.MutableRefObject<number>;

  // useDeferredValue
  deferredHeatmapSegments: TimelineHeatmapSegment[];
  deferredMinimapLayout: TimelineMinimapLayout;

  // useMemo / computed
  allClips: import('@open-factory/editor-core').Clip[];
  largeProjectMode: ReturnType<typeof getTimelineLargeProjectMode>;
  timelineDuration: number;
  timelineGridBeatTimes: number[];
  ticks: ReturnType<typeof buildTimelineRulerTicks>;
  playheadTimecode: string;
  gridLines: ReturnType<typeof buildTimelineGridLines>;
  remoteCollaborationUsers: CollaborationUiState['users'];
  collaborationLocksByClipId: Map<string, import('@open-factory/editor-core').CollaborationClipLock>;
  activeBeatMarkerId: string | undefined;
  exportRangeHighlights: { id: string; start: number; end: number }[];
  minimapHeight: number;
  minimapLayout: TimelineMinimapLayout;
  minimapViewport: TimelineMinimapViewportRect;
  protectedRanges: import('@open-factory/editor-core').ProtectedRange[];
  timelineNotes: import('@open-factory/editor-core').TimelineNote[];
  timelineNoteLayouts: ReturnType<typeof buildTimelineNoteLayout>;
  filteredTimelineNotes: import('@open-factory/editor-core').TimelineNote[];
  sceneCutOverlays: { id: string; clipId: string; time: number }[];
  clipGroups: ClipGroup[];
  clipGroupByClipId: Map<string, ClipGroup>;
  selectedGroup: ClipGroup | undefined;
  orderedTrackIds: string[];
  virtualWindow: ReturnType<typeof getTimelineVirtualRenderWindow>;
  virtualTrackWindow: ReturnType<typeof getTimelineVirtualTrackWindow>;
  virtualTracks: import('@open-factory/editor-core').Track[];
  thumbnailTrackSamples: ReturnType<typeof buildTimelineThumbnailTrackSamples>;
  activeSequence: import('@open-factory/editor-core').Track | undefined;
  isMainSequence: boolean;
  projectDuration: number;
  width: number;
  visibleStart: number;
  visibleEnd: number;

  // Helper
  setBookmarkPanelVisible: (next: boolean | ((open: boolean) => boolean)) => void;
}

export function useTimelineState(params: TimelineStateParams): TimelineState {
  const {
    heatmap,
    timelineGridSettings = DEFAULT_TIMELINE_GRID_SETTINGS,
    reduceMotion = false,
    bookmarkPanelOpen: controlledBookmarkPanelOpen,
    onBookmarkPanelOpenChange,
    sceneDetectionRequestId = 0,
    handlerRefs,
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
  // useState declarations
  // ---------------------------------------------------------------------------

  const [drag, setDrag] = useState<DragState | undefined>();
  const [snapHighlight, setSnapHighlight] = useState<TimelineSnapHighlight | undefined>();
  const [selectionRect, setSelectionRect] = useState<SelectionRect | undefined>();
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | undefined>();
  const [transitionMenu, setTransitionMenu] = useState<TransitionMenuState | undefined>();
  const [clipMenu, setClipMenu] = useState<ClipMenuState | undefined>();
  const [volumeEnvelopeMenu, setVolumeEnvelopeMenu] = useState<VolumeEnvelopeMenuState | undefined>();
  const [gapMenu, setGapMenu] = useState<GapMenuState | undefined>();
  const [rulerMenu, setRulerMenu] = useState<RulerMenuState | undefined>();
  const [silenceDialog, setSilenceDialog] = useState<SilenceDialogState | undefined>();
  const [sceneDialog, setSceneDialog] = useState<SceneDialogState | undefined>();
  const [coverFrameDialog, setCoverFrameDialog] = useState<CoverFrameDialogState | undefined>();
  const [whisperDialog, setWhisperDialog] = useState<WhisperDialogState | undefined>();
  const [subtitleAlignReport, setSubtitleAlignReport] = useState<
    { correctedCount: number; averageOffsetMs: number } | undefined
  >();
  const [dialoguePanelOpen, setDialoguePanelOpen] = useState(false);
  const [dialogueMarkers, setDialogueMarkers] = useState<DialogueInterval[]>([]);
  const [dialogueMisses, setDialogueMisses] = useState<DialogueWhisperMiss[]>([]);
  const [replaceMediaDialog, setReplaceMediaDialog] = useState<ReplaceMediaDialogState | undefined>();
  const [whisperAvailability, setWhisperAvailability] = useState<WhisperAvailability>({
    ready: false,
    error: zhCN.whisper.notConfigured,
  });
  const [rollingTrimActive, setRollingTrimActive] = useState(false);
  const [slipEditActive, setSlipEditActive] = useState(false);
  const [slideEditActive, setSlideEditActive] = useState(false);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationPanelOpen, setAnnotationPanelOpen] = useState(true);
  const [annotationEditor, setAnnotationEditor] = useState<AnnotationEditorState | undefined>();
  const [timelineNotePanelOpen, setTimelineNotePanelOpen] = useState(false);
  const [timelineNoteEditor, setTimelineNoteEditor] = useState<TimelineNoteEditorState | undefined>();
  const [timelineNoteSearch, setTimelineNoteSearch] = useState('');
  const [timelineNoteDraft, setTimelineNoteDraft] = useState<TimelineNoteDraftState | undefined>();
  const [localBookmarkPanelOpen, setLocalBookmarkPanelOpen] = useState(true);
  const bookmarkPanelOpen = controlledBookmarkPanelOpen ?? localBookmarkPanelOpen;
  const [bookmarkRename, setBookmarkRename] = useState<BookmarkRenameState | undefined>();
  const [reframeDialog, setReframeDialog] = useState<{ clipId: string } | undefined>();
  const [transitionDialog, setTransitionDialog] = useState<
    | {
        clipId: string;
        adjacentClipId: string;
        recommendations: import('@open-factory/editor-core').TransitionRecommendation[];
      }
    | undefined
  >();
  const [timelineColorFilter, setTimelineColorFilter] = useState<TimelineLabelColor | null>(null);
  const [beatSnapEnabled, setBeatSnapEnabled] = useState(true);
  const [beatSnapPanelOpen, setBeatSnapPanelOpen] = useState(false);
  const [envelopeEditMode, setEnvelopeEditMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [trackSelectionAnchorId, setTrackSelectionAnchorId] = useState<string | undefined>();
  const [trackBatchMenu, setTrackBatchMenu] = useState<TrackBatchMenuState | undefined>();
  const [gapStatsOpen, setGapStatsOpen] = useState(false);
  const [sequenceSettingsDialogOpen, setSequenceSettingsDialogOpen] = useState(false);
  const [audioScrubEnabled, setAudioScrubEnabled] = useState(true);
  const [equalHeightPrompt, setEqualHeightPrompt] = useState(false);
  const [equalHeightValue, setEqualHeightValue] = useState('48');
  const [scrollViewport, setScrollViewport] = useState({ scrollLeft: 0, scrollTop: 0, viewportWidth: 960 });
  const [timelineViewportHeight, setTimelineViewportHeight] = useState(240);
  const [heatmapSegments, setHeatmapSegments] = useState<TimelineHeatmapSegment[]>([]);
  const [isPanning, setIsPanning] = useState(false);

  // ---------------------------------------------------------------------------
  // useEffect – load audio scrub settings
  // ---------------------------------------------------------------------------

  useEffect(() => {
    readTimelineInteractionSettings()
      .then((s: { audioScrubEnabled?: boolean }) => setAudioScrubEnabled(s.audioScrubEnabled !== false))
      .catch((error) => console.warn('Unable to load timeline interaction settings', error));
  }, []);

  // ---------------------------------------------------------------------------
  // useWhisperSettingsStore
  // ---------------------------------------------------------------------------

  const whisperExecutablePath = useWhisperSettingsStore((state) => state.executablePath);
  const whisperModelPath = useWhisperSettingsStore((state) => state.modelPath);

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
  // useDeferredValue
  // ---------------------------------------------------------------------------

  const deferredHeatmapSegments = useDeferredValue(heatmapSegments);

  // ---------------------------------------------------------------------------
  // Computed values (non-memoized)
  // ---------------------------------------------------------------------------

  const timelineDuration = Math.max(
    10,
    ...project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration + 2)),
  );

  // ---------------------------------------------------------------------------
  // useMemo declarations
  // ---------------------------------------------------------------------------

  const allClips = useMemo(() => project.timeline.tracks.flatMap((track) => track.clips), [project.timeline]);
  const largeProjectMode = useMemo(
    () => getTimelineLargeProjectMode({ clipCount: allClips.length }),
    [allClips.length],
  );

  // ---------------------------------------------------------------------------
  // useEffect – bookmark panel auto-close annotation panel
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (bookmarkPanelOpen && (project.bookmarks?.length ?? 0) > 0) {
      setAnnotationPanelOpen(false);
    }
  }, [bookmarkPanelOpen, project.bookmarks?.length]);

  // ---------------------------------------------------------------------------
  // Helper
  // ---------------------------------------------------------------------------

  function setBookmarkPanelVisible(next: boolean | ((open: boolean) => boolean)): void {
    const resolved = typeof next === 'function' ? next(bookmarkPanelOpen) : next;
    setLocalBookmarkPanelOpen(resolved);
    onBookmarkPanelOpenChange?.(resolved);
  }

  // ---------------------------------------------------------------------------
  // Computed values (non-memoized)
  // ---------------------------------------------------------------------------

  const projectDuration = getTimelineDuration(project.timeline);
  const width = Math.max(960, timelineDuration * zoom);
  const visibleStart = Math.max(0, (scrollViewport.scrollLeft - LABEL_WIDTH) / Math.max(1, zoom));
  const visibleEnd = visibleStart + scrollViewport.viewportWidth / Math.max(1, zoom);

  // ---------------------------------------------------------------------------
  // useMemo declarations (continued)
  // ---------------------------------------------------------------------------

  const timelineGridBeatTimes = useMemo(
    () => (project.beatMarkers ?? []).map((marker) => marker.time),
    [project.beatMarkers],
  );

  const ticks = useMemo(
    () =>
      buildTimelineRulerTicks({
        duration: timelineDuration,
        visibleStart,
        visibleEnd,
        zoom,
        viewportWidth: Math.max(1, scrollViewport.viewportWidth - LABEL_WIDTH),
        fps: project.settings.fps || 30,
        timecodeFormat: project.settings.timecodeFormat ?? 'ndf',
      }),
    [
      project.settings.fps,
      project.settings.timecodeFormat,
      scrollViewport.viewportWidth,
      timelineDuration,
      visibleEnd,
      visibleStart,
      zoom,
    ],
  );

  const playheadTimecode = useMemo(
    () => secondsToTimecode(playheadTime, project.settings.fps || 30, project.settings.timecodeFormat ?? 'ndf'),
    [playheadTime, project.settings.fps, project.settings.timecodeFormat],
  );

  const gridLines = useMemo(() => {
    if (!timelineGridSettings.enabled) {
      return [];
    }
    return buildTimelineGridLines({
      unit: timelineGridSettings.unit,
      fps: project.settings.fps || 30,
      duration: timelineDuration,
      visibleStart,
      visibleEnd,
      zoom,
      viewportWidth: Math.max(1, scrollViewport.viewportWidth - LABEL_WIDTH),
      beatTimes: timelineGridBeatTimes,
    });
  }, [
    project.settings.fps,
    scrollViewport.viewportWidth,
    timelineDuration,
    timelineGridBeatTimes,
    timelineGridSettings.enabled,
    timelineGridSettings.unit,
    visibleEnd,
    visibleStart,
    zoom,
  ]);

  const remoteCollaborationUsers = useMemo(
    () => (collaborationEnabled ? collaborationUsers.filter((user) => user.userId !== collaborationUserId) : []),
    [collaborationEnabled, collaborationUserId, collaborationUsers],
  );

  const collaborationLocksByClipId = useMemo(
    () =>
      new Map(
        collaborationLocks.filter((lock) => lock.userId !== collaborationUserId).map((lock) => [lock.clipId, lock]),
      ),
    [collaborationLocks, collaborationUserId],
  );

  const activeBeatMarkerId = useMemo(() => {
    if (!isPlaying) {
      return undefined;
    }
    const frameWindow = 1 / Math.max(1, project.settings.fps || 30);
    return (project.beatMarkers ?? []).find((marker) => Math.abs(marker.time - playheadTime) <= frameWindow * 2)?.id;
  }, [isPlaying, playheadTime, project.beatMarkers, project.settings.fps]);

  const exportRangeHighlights = useMemo(() => {
    const stored = normalizeExportRanges(project.exportRanges, projectDuration).map((range) => ({
      id: range.id,
      start: range.start,
      end: range.end,
    }));
    if (stored.length > 0) {
      return stored;
    }
    if (typeof inPoint !== 'number' || typeof outPoint !== 'number' || inPoint === outPoint) {
      return [];
    }
    return [{ id: 'current-in-out', start: Math.min(inPoint, outPoint), end: Math.max(inPoint, outPoint) }];
  }, [inPoint, outPoint, project.exportRanges, projectDuration]);

  const minimapHeight = Math.max(160, timelineViewportHeight);

  const minimapLayout = useMemo(
    () =>
      buildTimelineMinimapLayout(project.timeline, {
        duration: timelineDuration,
        width: 120,
        height: minimapHeight,
        maxClips: largeProjectMode.minimapClipLimit,
        markers: project.timeline.markers ?? [],
        bookmarks: project.bookmarks ?? [],
        exportRanges: exportRangeHighlights,
      }),
    [
      exportRangeHighlights,
      largeProjectMode.minimapClipLimit,
      minimapHeight,
      project.bookmarks,
      project.timeline,
      timelineDuration,
    ],
  );

  const deferredMinimapLayout = useDeferredValue(minimapLayout);

  const minimapViewport = useMemo(
    () =>
      calculateTimelineMinimapViewportRect({
        scrollLeft: scrollViewport.scrollLeft,
        viewportWidth: scrollViewport.viewportWidth,
        labelWidth: LABEL_WIDTH,
        zoom,
        duration: timelineDuration,
        minimapHeight,
      }),
    [minimapHeight, scrollViewport.scrollLeft, scrollViewport.viewportWidth, timelineDuration, zoom],
  );

  const protectedRanges = useMemo(
    () => normalizeProtectedRanges(project.protectedRanges, projectDuration),
    [project.protectedRanges, projectDuration],
  );

  const timelineNotes = useMemo(() => project.timelineNotes ?? [], [project.timelineNotes]);
  const timelineNoteLayouts = useMemo(() => buildTimelineNoteLayout(timelineNotes), [timelineNotes]);

  const filteredTimelineNotes = useMemo(() => {
    const query = timelineNoteSearch.trim().toLowerCase();
    if (!query) {
      return timelineNotes;
    }
    return timelineNotes.filter(
      (note) => note.text.toLowerCase().includes(query) || note.color.toLowerCase().includes(query),
    );
  }, [timelineNoteSearch, timelineNotes]);

  const sceneCutOverlays = useMemo(
    () =>
      allClips.flatMap((clip) =>
        (clip.scenecuts ?? []).map((time, index) => ({
          id: `${clip.id}-${index}-${time}`,
          clipId: clip.id,
          time: round(clip.start + time),
        })),
      ),
    [allClips],
  );

  const clipGroups = useMemo(
    () =>
      normalizeClipGroups(
        project.clipGroups,
        allClips.map((clip) => clip.id),
      ),
    [allClips, project.clipGroups],
  );

  const clipGroupByClipId = useMemo(() => {
    const map = new Map<string, ClipGroup>();
    for (const group of clipGroups) {
      for (const clipId of group.clipIds) {
        map.set(clipId, group);
      }
    }
    return map;
  }, [clipGroups]);

  const selectedGroup = useMemo(
    () => findCompleteClipGroup(clipGroups, selectedClipIds),
    [clipGroups, selectedClipIds],
  );

  const orderedTrackIds = useMemo(() => project.timeline.tracks.map((track) => track.id), [project.timeline.tracks]);

  const virtualWindow = useMemo(
    () =>
      getTimelineVirtualRenderWindow({
        scrollLeft: scrollViewport.scrollLeft,
        viewportWidth: scrollViewport.viewportWidth,
        zoom,
        labelWidth: LABEL_WIDTH,
        overscanScreens: largeProjectMode.virtualOverscanScreens,
      }),
    [largeProjectMode.virtualOverscanScreens, scrollViewport.scrollLeft, scrollViewport.viewportWidth, zoom],
  );

  const virtualTrackWindow = useMemo(
    () =>
      getTimelineVirtualTrackWindow({
        scrollTop: scrollViewport.scrollTop,
        viewportHeight: timelineViewportHeight,
        rowHeight: TRACK_HEIGHT,
        trackCount: project.timeline.tracks.length,
        overscanRows: 2,
      }),
    [project.timeline.tracks.length, scrollViewport.scrollTop, timelineViewportHeight],
  );

  const virtualTracks = useMemo(
    () => filterTimelineVirtualTracks(project.timeline.tracks, virtualTrackWindow),
    [project.timeline.tracks, virtualTrackWindow],
  );

  const thumbnailTrackSamples = useMemo(() => {
    const samples = buildTimelineThumbnailTrackSamples(project.timeline, {
      zoom,
      trackWidth: width,
      duration: timelineDuration,
      visibleStart,
      visibleEnd,
    });
    return sortTimelineThumbnailSamplesByPriority(samples, playheadTime);
  }, [playheadTime, project.timeline, timelineDuration, visibleEnd, visibleStart, width, zoom]);

  const activeSequence = project.sequences.find((sequence) => sequence.id === project.activeSequenceId);
  const isMainSequence = project.activeSequenceId === 'sequence-main';

  // ---------------------------------------------------------------------------
  // useEffect – sync track selection with live tracks
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const liveTrackIds = new Set(orderedTrackIds);
    setSelectedTrackIds((current) => current.filter((trackId) => liveTrackIds.has(trackId)));
    setTrackSelectionAnchorId((current) => (current && liveTrackIds.has(current) ? current : undefined));
  }, [orderedTrackIds]);

  // ---------------------------------------------------------------------------
  // useEffect – whisper availability
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let disposed = false;
    void getWhisperAvailability({ executablePath: whisperExecutablePath, modelPath: whisperModelPath }).then(
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

  // ---------------------------------------------------------------------------
  // useEffect – snap highlight auto-dismiss
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // useEffect – keyboard shortcuts
  // ---------------------------------------------------------------------------

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
  }, [orderedTrackIds, playheadTime, project.protectedRanges, projectDuration, protectedRanges, timelineNotes.length]);

  // ---------------------------------------------------------------------------
  // useEffect – sync scroll viewport on resize
  // ---------------------------------------------------------------------------

  useEffect(() => {
    handlerRefs?.current.syncScrollViewport?.();
    const handleResize = () => handlerRefs?.current.syncScrollViewport?.();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handlerRefs]);

  // ---------------------------------------------------------------------------
  // useEffect – scene detection request
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // useEffect – heatmap computation
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // useEffect – terminate heatmap worker on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => () => heatmapWorkerRef.current?.terminate(), []);

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
    whisperExecutablePath,
    whisperModelPath,

    // useState – drag / UI interaction state
    drag,
    setDrag,
    snapHighlight,
    setSnapHighlight,
    selectionRect,
    setSelectionRect,
    selectionStart,
    setSelectionStart,
    isPanning,
    setIsPanning,

    // useState – menus
    transitionMenu,
    setTransitionMenu,
    clipMenu,
    setClipMenu,
    volumeEnvelopeMenu,
    setVolumeEnvelopeMenu,
    gapMenu,
    setGapMenu,
    rulerMenu,
    setRulerMenu,
    trackBatchMenu,
    setTrackBatchMenu,

    // useState – dialogs
    silenceDialog,
    setSilenceDialog,
    sceneDialog,
    setSceneDialog,
    coverFrameDialog,
    setCoverFrameDialog,
    whisperDialog,
    setWhisperDialog,
    subtitleAlignReport,
    setSubtitleAlignReport,
    replaceMediaDialog,
    setReplaceMediaDialog,
    reframeDialog,
    setReframeDialog,
    transitionDialog,
    setTransitionDialog,
    sequenceSettingsDialogOpen,
    setSequenceSettingsDialogOpen,

    // useState – panels / modes
    dialoguePanelOpen,
    setDialoguePanelOpen,
    dialogueMarkers,
    setDialogueMarkers,
    dialogueMisses,
    setDialogueMisses,
    whisperAvailability,
    setWhisperAvailability,
    rollingTrimActive,
    setRollingTrimActive,
    slipEditActive,
    setSlipEditActive,
    slideEditActive,
    setSlideEditActive,
    annotationMode,
    setAnnotationMode,
    annotationPanelOpen,
    setAnnotationPanelOpen,
    annotationEditor,
    setAnnotationEditor,
    timelineNotePanelOpen,
    setTimelineNotePanelOpen,
    timelineNoteEditor,
    setTimelineNoteEditor,
    timelineNoteSearch,
    setTimelineNoteSearch,
    timelineNoteDraft,
    setTimelineNoteDraft,
    localBookmarkPanelOpen,
    setLocalBookmarkPanelOpen,
    bookmarkPanelOpen,
    bookmarkRename,
    setBookmarkRename,
    timelineColorFilter,
    setTimelineColorFilter,
    beatSnapEnabled,
    setBeatSnapEnabled,
    beatSnapPanelOpen,
    setBeatSnapPanelOpen,
    envelopeEditMode,
    setEnvelopeEditMode,
    selectedTrackIds,
    setSelectedTrackIds,
    trackSelectionAnchorId,
    setTrackSelectionAnchorId,
    gapStatsOpen,
    setGapStatsOpen,
    audioScrubEnabled,
    setAudioScrubEnabled,
    equalHeightPrompt,
    setEqualHeightPrompt,
    equalHeightValue,
    setEqualHeightValue,
    scrollViewport,
    setScrollViewport,
    timelineViewportHeight,
    setTimelineViewportHeight,
    heatmapSegments,
    setHeatmapSegments,

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
    deferredHeatmapSegments,
    deferredMinimapLayout,

    // useMemo / computed
    allClips,
    largeProjectMode,
    timelineDuration,
    timelineGridBeatTimes,
    ticks,
    playheadTimecode,
    gridLines,
    remoteCollaborationUsers,
    collaborationLocksByClipId,
    activeBeatMarkerId,
    exportRangeHighlights,
    minimapHeight,
    minimapLayout,
    minimapViewport,
    protectedRanges,
    timelineNotes,
    timelineNoteLayouts,
    filteredTimelineNotes,
    sceneCutOverlays,
    clipGroups,
    clipGroupByClipId,
    selectedGroup,
    orderedTrackIds,
    virtualWindow,
    virtualTrackWindow,
    virtualTracks,
    thumbnailTrackSamples,
    activeSequence: activeSequence as import('@open-factory/editor-core').Track | undefined,
    isMainSequence,
    projectDuration,
    width,
    visibleStart,
    visibleEnd,

    // Helper
    setBookmarkPanelVisible,
  };
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName ?? ''));
}
