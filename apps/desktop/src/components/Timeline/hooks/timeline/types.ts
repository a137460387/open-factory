import type React from 'react';
import type {TransitionMenuState, ClipMenuState, VolumeEnvelopeMenuState, GapMenuState, RulerMenuState, TrackBatchMenuState} from '../../TimelineMenus';
import type {ReplaceMediaDialogState, SilenceDialogState, SceneDialogState, WhisperDialogState, CoverFrameDialogState, AnnotationEditorState, TimelineNoteEditorState} from '../../TimelineDialogs';
import type {TimelineNoteDraftState, BookmarkRenameState} from '../../TimelineOverlays';
import type {ClipMenuRequest, DragState, GapMenuRequest, VolumeEnvelopeMenuRequest, VolumeEnvelopePointRequest} from '../../TimelineParts';
import type {RulerContextMenuAction} from '../../timeline-ruler-menu';
import type {WhisperAvailability} from '../../../../lib/whisper';
import type {
  Clip,
  ClipGroup,
  ClipGroupColor,
  KeyframeProperty,
  GapFillStrategy,
  MediaAsset,
  ProjectAnnotation,
  TimelineNote,
  ProtectedRange,
  SilentRange,
  SelectionRect,
  TimelineGridSettings,
  TimelineLabelColor,
  MediaVersionEntry,
  DialogueInterval,
  DialogueSensitivity,
  DialogueWhisperMiss,
  Track,
  TrackPatch,
  ClipAIReframe,
  ReframeAIFrame,
  AnomalyInterval,
  FrameAnalysisSample,
  TransitionClipFeatures,
  TransitionRecommendation,
  TransitionType,
  TargetAspectRatio,
  TimelineSnapHighlight,
  TimelineSnapCandidate,
  SnapEdge,
} from '@open-factory/editor-core';
import type {useEditorStore, SelectedKeyframeRef} from '../../../../store/editorStore';
import type {CoverFrameResult} from '../../../../lib/tauri-bridge';

export type SubtitleClip = Extract<Clip, { type: 'subtitle' }>;
export type SubtitleAlignmentMediaClip = Extract<Clip, { type: 'audio' | 'video' }>;

export interface TimelineHandlerParams {
  // useState – drag / UI interaction state
  drag: DragState | undefined;
  setDrag: React.Dispatch<React.SetStateAction<DragState | undefined>>;
  snapHighlight: TimelineSnapHighlight | undefined;
  setSnapHighlight: React.Dispatch<React.SetStateAction<TimelineSnapHighlight | undefined>>;
  selectionRect: SelectionRect | undefined;
  setSelectionRect: React.Dispatch<React.SetStateAction<SelectionRect | undefined>>;
  selectionStart: { x: number; y: number } | undefined;
  setSelectionStart: React.Dispatch<React.SetStateAction<{ x: number; y: number } | undefined>>;

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
  transitionDialog: { clipId: string; adjacentClipId: string; recommendations: TransitionRecommendation[] } | undefined;
  setTransitionDialog: React.Dispatch<
    React.SetStateAction<
      { clipId: string; adjacentClipId: string; recommendations: TransitionRecommendation[] } | undefined
    >
  >;

  // useState – panels / modes
  dialoguePanelOpen: boolean;
  setDialoguePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dialogueMarkers: DialogueInterval[];
  setDialogueMarkers: React.Dispatch<React.SetStateAction<DialogueInterval[]>>;
  dialogueMisses: DialogueWhisperMiss[];
  setDialogueMisses: React.Dispatch<React.SetStateAction<DialogueWhisperMiss[]>>;
  whisperAvailability: WhisperAvailability;
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
  timelineNoteDraft: TimelineNoteDraftState | undefined;
  setTimelineNoteDraft: React.Dispatch<React.SetStateAction<TimelineNoteDraftState | undefined>>;
  bookmarkRename: BookmarkRenameState | undefined;
  setBookmarkRename: React.Dispatch<React.SetStateAction<BookmarkRenameState | undefined>>;
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
  trackBatchMenu: TrackBatchMenuState | undefined;
  setTrackBatchMenu: React.Dispatch<React.SetStateAction<TrackBatchMenuState | undefined>>;
  gapStatsOpen: boolean;
  setGapStatsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  audioScrubEnabled: boolean;
  equalHeightPrompt: boolean;
  setEqualHeightPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  equalHeightValue: string;
  setEqualHeightValue: React.Dispatch<React.SetStateAction<string>>;
  scrollViewport: { scrollLeft: number; scrollTop: number; viewportWidth: number };
  setScrollViewport: React.Dispatch<
    React.SetStateAction<{ scrollLeft: number; scrollTop: number; viewportWidth: number }>
  >;
  setTimelineViewportHeight: React.Dispatch<React.SetStateAction<number>>;
  isPanning: boolean;
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>;

  // useEditorStore
  project: ReturnType<typeof useEditorStore.getState>['project'];
  selectedClipId: string | undefined;
  selectedClipIds: string[];
  playheadTime: number;
  isPlaying: boolean;
  inPoint: number | undefined;
  outPoint: number | undefined;
  projectPath: string | undefined;
  zoom: number;
  setSelectedClipId: (id: string | undefined) => void;
  setSelectedClipIds: (ids: string[] | ((current: string[]) => string[])) => void;
  addMedia: (media: MediaAsset[]) => void;
  selectedKeyframe: SelectedKeyframeRef | undefined;
  selectedKeyframes: SelectedKeyframeRef[];
  setSelectedKeyframe: (ref: SelectedKeyframeRef | undefined) => void;
  setSelectedKeyframes: (refs: SelectedKeyframeRef[]) => void;
  toggleSelectedKeyframe: (ref: SelectedKeyframeRef) => void;
  toggleSelectedClipId: (id: string) => void;
  clearSelectedClipIds: () => void;
  setPlayheadTime: (time: number) => void;
  setInPoint: (time: number | undefined) => void;
  setOutPoint: (time: number | undefined) => void;
  setTimelineZoom: (zoom: number) => void;
  setPreviewTimeline: (timeline: ReturnType<typeof useEditorStore.getState>['project']['timeline'] | undefined) => void;
  setActiveSequenceId: (id: string) => void;

  // useMemo
  allClips: Clip[];
  clipGroups: ClipGroup[];
  clipGroupByClipId: Map<string, ClipGroup>;
  selectedGroup: ClipGroup | undefined;
  orderedTrackIds: string[];
  protectedRanges: ProtectedRange[];
  timelineNotes: TimelineNote[];
  timelineDuration: number;

  // useRef
  rootRef: React.RefObject<HTMLElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  longPressTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  longPressActiveRef: React.MutableRefObject<boolean>;
  scrollRafRef: React.MutableRefObject<number>;

  // Props
  onConvertMediaFrameRate?: (assetId: string) => void;
  onBookmarkPanelOpenChange?: (open: boolean) => void;
  reduceMotion: boolean;
  timelineGridSettings: TimelineGridSettings;

  // Collaboration
  collaborationEnabled: boolean;
  collaborationUserId: string;

  // Additional computed values
  bookmarkPanelOpen: boolean;
  setBookmarkPanelVisible: (next: boolean | ((open: boolean) => boolean)) => void;
  projectDuration: number;
  timelineGridBeatTimes: number[];
  startTransition: (callback: () => void) => void;
  minimapHeight: number;

  // Handler refs for useTimelineState keyboard shortcuts
  handlerRefs?: React.MutableRefObject<{
    quickAddTimelineNote?: () => void;
    toggleProtectedRangeAtPlayhead?: () => void;
    syncScrollViewport?: () => void;
    openSceneDetection?: (clipId: string) => void;
  }>;

  // Misc
  useEditorStoreRef: typeof useEditorStore;
}

export interface TimelineHandlers {
  addTrack(type: Track['type']): void;
  updateTrack(trackId: string, patch: Partial<Pick<Track, 'color' | 'muted' | 'solo' | 'locked' | 'volume'>>): void;
  selectTrackHeader(trackId: string, event: React.MouseEvent<HTMLDivElement>): void;
  openTrackBatchMenu(trackId: string, x: number, y: number): void;
  selectedTracksForBatch(): Track[];
  applyBatchTrackPatch(patchForTrack: (track: Track) => TrackPatch): void;
  deleteSelectedEmptyTracks(): void;
  reorderTracks(draggedTrackId: string, targetTrackId: string): void;
  updateClipColor(clipId: string, colorLabel: TimelineLabelColor | null): void;
  convertClipFrameRate(clipId: string): void;
  addTransition(): void;
  removeTransition(): void;
  addText(): void;
  addCredits(text?: string, start?: number): void;
  addTitleTemplate(templateId: string, start?: number): void;
  addTimelineMarker(time?: number): void;
  addProjectBookmark(time?: number): void;
  renameProjectBookmark(bookmarkId: string, note: string): void;
  removeProjectBookmark(bookmarkId: string): void;
  addProtectedRangeAt(time?: number): void;
  toggleProtectedRangeAtPlayhead(): void;
  openRulerMenu(request: { time: number; x: number; y: number }): void;
  runRulerMenuAction(action: RulerContextMenuAction): void;
  jumpToRulerTimecode(): void;
  addBeatMarker(): void;
  openAnnotationEditorAt(time: number, annotation?: ProjectAnnotation): void;
  saveAnnotationEditor(next: AnnotationEditorState): void;
  removeProjectAnnotation(annotationId: string): void;
  openTimelineNoteEditor(start: number, end?: number, note?: TimelineNote): void;
  quickAddTimelineNote(): void;
  saveTimelineNoteEditor(next: TimelineNoteEditorState): void;
  removeTimelineNote(noteId: string): void;
  onTimelineNoteRangeDraft(start: number, end: number): void;
  exportTimelineNotesCsv(): Promise<void>;
  removeTimelineMarker(markerId: string): void;
  splitSelected(): void;
  createGroupFromSelection(): void;
  ungroupSelected(group?: ClipGroup): void;
  deleteGroup(group: ClipGroup): void;
  updateGroupColor(group: ClipGroup, color: ClipGroupColor): void;
  deleteSelected(): void;
  rippleDeleteSelected(): void;
  onPointerMove(event: React.PointerEvent<HTMLDivElement>): void;
  onPointerUp(): void;
  onDragStart(nextDrag: DragState): void;
  selectClip(clipId: string, additive: boolean, forceSingle?: boolean): void;
  findClipById(clipId: string): Clip | undefined;
  canApplyProtectedMove(startsByClipId: Record<string, number>): boolean;
  warnProtectedRangeBlocked(): void;
  getKeyframeTime(ref: SelectedKeyframeRef): number | undefined;
  buildKeyframeStartTimes(refs: SelectedKeyframeRef[]): Record<string, number>;
  selectKeyframe(keyframe: { clipId: string; property: KeyframeProperty; keyframeId: string }, additive: boolean): void;
  openNestedSequence(clip: Clip): void;
  packClipMenuSelection(clipId: string): void;
  openReplaceMedia(clipId: string): Promise<void>;
  confirmReplaceMedia(): void;
  removeBeatMarker(markerId: string): void;
  openGapMenu(request: GapMenuRequest): void;
  closeGap(): void;
  fillGap(strategy: GapFillStrategy): Promise<void>;
  createGapFillMediaAsset(
    menu: GapMenuState,
    strategy: Extract<GapFillStrategy, 'freeze-frame' | 'black' | 'white'>,
  ): Promise<MediaAsset>;
  buildGapFillAsset(
    result: { path: string; name: string; width: number; height: number },
    fallbackName: string,
  ): MediaAsset;
  onTrackPointerDown(event: React.PointerEvent<HTMLDivElement>): void;
  onAnnotationLayerPointerDown(event: React.PointerEvent<HTMLDivElement>): void;
  openClipMenu(request: ClipMenuRequest): void;
  addVolumeEnvelopePoint(request: VolumeEnvelopePointRequest): void;
  updateVolumeEnvelopePoint(request: Required<VolumeEnvelopePointRequest>): void;
  removeVolumeEnvelopePoint(request: Required<Pick<VolumeEnvelopePointRequest, 'clipId' | 'keyframeId'>>): void;
  openVolumeEnvelopeMenu(request: VolumeEnvelopeMenuRequest): void;
  applyVolumeEnvelopeFade(kind: 'in' | 'out'): void;
  resetVolumeEnvelope(): void;
  openSilenceDetection(clipId: string): void;
  getDialogueDetectionTarget(): { clip: Clip; asset: MediaAsset } | undefined;
  runDialogueDetection(sensitivity: DialogueSensitivity): Promise<void>;
  generateDialogueSubtitles(): void;
  applySilenceRemoval(clipId: string, ranges: SilentRange[]): void;
  openSceneDetection(clipId: string): void;
  startSceneDetection(): Promise<void>;
  cancelCurrentSceneDetection(): Promise<void>;
  applySceneDetectionResult(): void;
  openCoverFrameGeneration(clipId: string): Promise<void>;
  applyProjectCoverFrame(frame: CoverFrameResult): void;
  generateSubtitles(clipId: string): Promise<void>;
  findSubtitleAlignmentSource(
    subtitleClips: SubtitleClip[],
  ): { clip: SubtitleAlignmentMediaClip; asset: MediaAsset } | undefined;
  alignSubtitlesToWaveform(clipId: string): Promise<void>;
  ttsVoiceover(clipId: string): Promise<void>;
  handleAiReframe(clipId: string): void;
  applyAiReframe(clipId: string, aspect: TargetAspectRatio): void;
  handleAiTransitionRecommend(clipId: string): void;
  applyAiTransition(clipId: string, adjacentClipId: string, transition: TransitionRecommendation): void;
  handleAnomalyDetect(clipId: string): void;
  removeAnomaly(clipId: string, anomaly: AnomalyInterval): void;
  onWheel(event: React.WheelEvent<HTMLDivElement>): void;
  syncScrollViewport(): void;
  onTimelinePointerDown(event: React.PointerEvent<HTMLDivElement>): void;
  onTimelineDoubleClick(event: React.MouseEvent<HTMLDivElement>): void;
  scrollTimelineFromMinimap(y: number, mode: 'top' | 'center'): void;
  onTimelineDragOver(event: React.DragEvent<HTMLDivElement>): void;
  onTimelineDrop(event: React.DragEvent<HTMLDivElement>): void;
  onKeyDown(event: React.KeyboardEvent<HTMLElement>): void;
  moveSelectedClipsByKeyboardFrame(direction: -1 | 1): void;
  trimSelectedClipByKeyboardFrame(edge: 'in' | 'out'): void;
  applyZoom(nextZoom: number, anchorViewportX: number): void;
  buildMovedPreviewTimeline(
    previewStartsByClipId: Record<string, number>,
  ): ReturnType<typeof useEditorStore.getState>['project']['timeline'];
  buildTrimPreview(clip: Clip, edge: 'left' | 'right', delta: number, snappingDisabled: boolean): Clip;
  findClip(clipId: string): Clip;
  getClipMediaAsset(clip: Clip): MediaAsset | undefined;
  getClipMediaVersionEntries(clip?: Clip): MediaVersionEntry[];
  switchClipMediaVersion(clipId: string, mediaId: string): void;
  minFrameDuration(): number;
  findClipIdsIntersectingRect(rect: SelectionRect): string[];
  flashSnapHighlight(time: number): void;
  snapClipStart(time: number, duration: number, clip: Clip, disabled: boolean, edges?: SnapEdge[]): number;
  snapClipEnd(time: number, clip: Clip, disabled: boolean): number;
  snapKeyframeTime(clip: Clip, localTime: number, disabled: boolean): number;
  buildSnapCandidates(clip: Clip): TimelineSnapCandidate[];
}
