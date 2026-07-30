import {
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
  type getTimelineLargeProjectMode,
  type getTimelineVirtualRenderWindow,
  type getTimelineVirtualTrackWindow,
  type buildTimelineRulerTicks,
  type buildTimelineGridLines,
  type buildTimelineThumbnailTrackSamples,
  type buildTimelineNoteLayout,
} from '@open-factory/editor-core';
import {type CollaborationUiState} from '../../store/collaborationStore';
import {type EditorState} from '../../store/editorStore';
import {type RenderCacheState} from '../../store/renderCacheStore';
import {type WhisperAvailability} from '../../lib/whisper';
import {type TimelineHeatmapViewSettings} from '../../settings/appSettings';
import {type DragState} from './TimelineParts';
import type {TransitionMenuState, ClipMenuState, VolumeEnvelopeMenuState, GapMenuState, RulerMenuState, TrackBatchMenuState} from './TimelineMenus';
import type {ReplaceMediaDialogState, SilenceDialogState, SceneDialogState, WhisperDialogState, CoverFrameDialogState, AnnotationEditorState, TimelineNoteEditorState} from './TimelineDialogs';
import type {TimelineNoteDraftState, BookmarkRenameState} from './TimelineOverlays';

export interface HeatmapWorkerResponse {
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

  // useState - drag / UI interaction state
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

  // useState - menus
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

  // useState - dialogs
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

  // useState - panels / modes
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
  activeSequence: import('@open-factory/editor-core').Sequence | undefined;
  isMainSequence: boolean;
  projectDuration: number;
  width: number;
  visibleStart: number;
  visibleEnd: number;

  // Helper
  setBookmarkPanelVisible: (next: boolean | ((open: boolean) => boolean)) => void;
}
