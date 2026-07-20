import {
  AddKeyframeCommand,
  AddClipCommand,
  AddCreditsClipCommand,
  AddProjectAnnotationCommand,
  AddProjectBookmarkCommand,
  AddTimelineNoteCommand,
  AddTimelineMarkerCommand,
  BatchAddMarkersCommand,
  BatchAlignSubtitleCommand,
  BatchKeyframeEditCommand,
  BatchImportSubtitleCommand,
  BatchSplitAtSceneCutsCommand,
  BatchUpdateKeyframeCommand,
  BatchUpdateTrackCommand,
  AddTrackCommand,
  AddTransitionCommand,
  CloseGapCommand,
  FillGapCommand,
  CLIP_GROUP_COLORS,
  DEFAULT_PROJECT_ANNOTATION_COLOR,
  CreateClipGroupCommand,
  DeleteGroupCommand,
  DeleteClipsCommand,
  PackNestedSequenceCommand,
  DEFAULT_TIMELINE_NOTE_COLOR,
  RemoveProjectBookmarkCommand,
  UpdateTrackCommand,
  RemoveProjectAnnotationCommand,
  RemoveTimelineNoteCommand,
  RemoveTimelineMarkerCommand,
  RemoveTransitionCommand,
  UpdateClipCommand,
  UpdateProjectCoverCommand,
  UpdateProjectAnnotationCommand,
  UpdateProjectBookmarkCommand,
  UpdateTimelineNoteCommand,
  UngroupCommand,
  UpdateClipGroupCommand,
  buildSlideClipEdit,
  buildSlipClip,
  calculateSpeedCurveDisplayDuration,
  calculateSpeedCurveSourceDuration,
  calculateAnchoredScrollLeft,
  calculateTimelineScrollLeftFromMinimapY,
  buildVolumeFadeKeyframes,
  buildEvenCoverFrameTimestamps,
  clampTimelineZoom,
  findTimelineSnapTargetWithGrid,
  fitTimelineZoomToWindow,
  ensurePlayheadVisible,
  MoveClipCommand,
  MoveClipsCommand,
  RemoveKeyframeCommand,
  RemoveSilenceCommand,
  ReplaceMediaCommand,
  RippleDeleteCommand,
  RollingTrimCommand,
  SlideClipCommand,
  SlipClipCommand,
  SwitchMediaVersionCommand,
  UpdateKeyframeCommand,
  UpdateProjectProtectedRangesCommand,
  UpdateProjectBeatMarkersCommand,
  UpdateProjectBookmarksCommand,
  rectsIntersect,
  replaceClip,
  resolveTrackHeaderSelection,
  SplitClipCommand,
  TrimClipCommand,
  canMoveClipWithProtectedRanges,
  createId,
  createBeatMarker,
  buildSceneMarkerInputs,
  filterShortSceneCuts,
  getSceneDetectionAnalysisLimit,
  compareDialogueWithWhisper,
  createSubtitleClipsFromDialogues,
  createProtectedRange,
  createTrack,
  detectOverlap,
  getTimelineDuration,
  buildGapFillCommandOperation,
  getClipSourceVisibleDuration,
  getClipSpeed,
  createGapFillImageClip,
  findTimelineGapAtTime,
  dirname,
  getReplaceMediaCompatibilityWarnings,
  isFrameRateMismatch,
  findMediaVersionOwner,
  isNestedSequenceDepthExceeded,
  instantiateTitleTemplate,
  listMediaVersionEntries,
  moveSelectedTrackIds,
  moveClip,
  parseTimecodeToSeconds,
  round,
  secondsToTimecode,
  serializeTimelineNotesCsv,
  snapTime,
  snapTimelineTimeToGrid,
  volumeEnvelopeControlPointToKeyframe,
  sanitizeCoverFileStem,
  buildSelectionMarqueeRect,
  createSnapHighlight,
  computeSampleTimes,
  generateReframeKeyframes,
  smoothKeyframes,
  computeReframeConfidence,
  recommendTransition,
  detectAnomalies,
  type Clip,
  type ClipGroup,
  type ClipGroupColor,
  type KeyframeProperty,
  type GapFillStrategy,
  type MediaAsset,
  type ProjectAnnotation,
  type TimelineNote,
  type ProtectedRange,
  type SilentRange,
  type SnapEdge,
  type SelectionRect,
  type TimelineSnapCandidate,
  type TimelineGridSettings,
  type TimelineLabelColor,
  type MediaVersionEntry,
  type DialogueInterval,
  type DialogueSensitivity,
  type DialogueWhisperMiss,
  type Track,
  type TrackPatch,
  type ReplaceMediaDurationMode,
  type ClipAIReframe,
  type ReframeAIFrame,
  type AnomalyInterval,
  type FrameAnalysisSample,
  type TransitionClipFeatures,
  type TransitionRecommendation,
  type TransitionType,
  type TargetAspectRatio,
  DEFAULT_TRANSITION_DURATION,
} from '@open-factory/editor-core';
import { LONG_PRESS_PAN_THRESHOLD_MS } from '@open-factory/editor-core';
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
import { keyframeRefKey } from './TimelineOverlays';
import type {
  ClipMenuRequest,
  DragState,
  GapMenuRequest,
  VolumeEnvelopeMenuRequest,
  VolumeEnvelopePointRequest,
} from './TimelineParts';
import type { RulerContextMenuAction } from './timeline-ruler-menu';
import type { WhisperAvailability } from '../../lib/whisper';
import {
  canGenerateSubtitlesForClip,
  buildWhisperSubtitleTrackForClip,
  getWhisperAvailability,
} from '../../lib/whisper';
import { TITLE_TEMPLATE_DRAG_MIME, isTitleTemplateId } from '../../lib/titleTemplates';
import {
  analyzeWaveform,
  cancelSceneDetection,
  detectSceneChanges,
  extractCoverFrames,
  generateGapFillMedia,
  getAppDataDir,
  listenBridge,
  listenCoverFrameProgress,
  openFileDialog,
  saveFileDialog,
  writeFile,
  type CoverFrameResult,
  type SceneDetectProgressEvent,
  type WhisperProgressEvent,
} from '../../lib/tauri-bridge';
import { commandManager, projectAccessor, timelineAccessor } from '../../store/commandManager';
import { useEditorStore, type SelectedKeyframeRef } from '../../store/editorStore';
import { useWhisperSettingsStore } from '../../store/whisperSettingsStore';
import { zhCN } from '../../i18n/strings';
import { createCreditsClip, createTextClip } from '../../lib/clipFactory';
import { probeMediaPath } from '../../lib/media';
import { showToast } from '../../lib/toast';
import { detectClipDialogue } from '../../lib/dialogueDetection';
import { generateTtsVoiceover, collectSubtitleClipsForTts } from '../../lib/ttsVoiceover';
import { buildKeyboardClipMoveStarts, buildKeyboardClipTrim, getKeyboardSelectedClipIds } from './timeline-keyboard';
import { LABEL_WIDTH } from './TimelineParts';

// ---------------------------------------------------------------------------
// Module-level helpers (originally in Timeline.tsx outside the component)
// ---------------------------------------------------------------------------

type SubtitleClip = Extract<Clip, { type: 'subtitle' }>;
type SubtitleAlignmentMediaClip = Extract<Clip, { type: 'audio' | 'video' }>;

const SUBTITLE_ALIGNMENT_SAMPLES_PER_SECOND = 20;
const SUBTITLE_ALIGNMENT_MAX_DISTANCE = 0.3;

function isCreditsTextFile(file: File): boolean {
  return /\.(txt|csv)$/i.test(file.name);
}

const TRANSITION_DRAG_MIME = 'application/x-transition-type';

function getTimelineDropStart(
  event: React.DragEvent<HTMLDivElement>,
  scroll: HTMLDivElement | null,
  zoom: number,
): number | undefined {
  const rect = scroll?.getBoundingClientRect();
  return rect && scroll
    ? round(Math.max(0, (event.clientX - rect.left + scroll.scrollLeft - LABEL_WIDTH) / zoom))
    : undefined;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName ?? ''));
}

function buildSubtitleAlignmentPeaks(
  samples: number[],
  samplesPerSec: number,
  sourceClip: SubtitleAlignmentMediaClip,
): number[] {
  const sampleRate = Math.max(1, samplesPerSec);
  const peakLevel = samples.reduce((max, value) => (Number.isFinite(value) ? Math.max(max, value) : max), 0);
  const threshold = Math.max(0.05, peakLevel * 0.6);
  const trimStart = Math.max(0, sourceClip.trimStart ?? 0);
  const sourceEnd = trimStart + getClipSourceVisibleDuration(sourceClip);
  const speed = Math.max(0.01, getClipSpeed(sourceClip));
  const peaks: number[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const value = Number.isFinite(samples[index]) ? samples[index] : 0;
    if (value < threshold || value < (samples[index - 1] ?? 0) || value < (samples[index + 1] ?? 0)) {
      continue;
    }
    const sourceTime = index / sampleRate;
    if (sourceTime < trimStart || sourceTime > sourceEnd) {
      continue;
    }
    const timelineTime = sourceClip.start + (sourceTime - trimStart) / speed;
    if (!peaks.some((peak) => Math.abs(peak - timelineTime) < 1 / sampleRate)) {
      peaks.push(round(timelineTime));
    }
  }
  return peaks;
}

function isSubtitleAlignmentMediaClip(clip: Clip): clip is SubtitleAlignmentMediaClip {
  return clip.type === 'audio' || clip.type === 'video';
}

function timelineRangesOverlap(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function joinLocalPath(baseDir: string, child: string): string {
  return `${baseDir.replace(/\\/g, '/').replace(/\/+$/g, '')}/${child}`;
}

async function getCoverFrameOutputDir(projectPath: string | undefined): Promise<string> {
  const baseDir = projectPath ? dirname(projectPath) : await getAppDataDir();
  return joinLocalPath(baseDir, 'covers');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineHandlerParams {
  // useState – drag / UI interaction state
  drag: DragState | undefined;
  setDrag: React.Dispatch<React.SetStateAction<DragState | undefined>>;
  snapHighlight: import('@open-factory/editor-core').TimelineSnapHighlight | undefined;
  setSnapHighlight: React.Dispatch<
    React.SetStateAction<import('@open-factory/editor-core').TimelineSnapHighlight | undefined>
  >;
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
  addTitleTemplate(templateId: Parameters<typeof instantiateTitleTemplate>[0], start?: number): void;
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTimelineHandlers(params: TimelineHandlerParams): TimelineHandlers {
  const {
    drag,
    setDrag,
    snapHighlight,
    setSnapHighlight,
    selectionRect,
    setSelectionRect,
    selectionStart,
    setSelectionStart,
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
    dialoguePanelOpen,
    setDialoguePanelOpen,
    dialogueMarkers,
    setDialogueMarkers,
    dialogueMisses,
    setDialogueMisses,
    whisperAvailability,
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
    timelineNoteDraft,
    setTimelineNoteDraft,
    bookmarkRename,
    setBookmarkRename,
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
    trackBatchMenu,
    setTrackBatchMenu,
    gapStatsOpen,
    setGapStatsOpen,
    audioScrubEnabled,
    equalHeightPrompt,
    setEqualHeightPrompt,
    equalHeightValue,
    setEqualHeightValue,
    scrollViewport,
    setScrollViewport,
    setTimelineViewportHeight,
    isPanning,
    setIsPanning,
    project,
    selectedClipId,
    selectedClipIds,
    playheadTime,
    isPlaying,
    inPoint,
    outPoint,
    projectPath,
    zoom,
    setSelectedClipId,
    setSelectedClipIds,
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
    allClips,
    clipGroups,
    clipGroupByClipId,
    selectedGroup,
    orderedTrackIds,
    protectedRanges,
    timelineNotes,
    timelineDuration,
    rootRef,
    scrollRef,
    longPressTimerRef,
    longPressActiveRef,
    scrollRafRef,
    onConvertMediaFrameRate,
    onBookmarkPanelOpenChange,
    reduceMotion,
    timelineGridSettings,
    collaborationEnabled,
    collaborationUserId,
    bookmarkPanelOpen,
    setBookmarkPanelVisible,
    projectDuration,
    timelineGridBeatTimes,
    startTransition,
    minimapHeight,
    handlerRefs,
    useEditorStoreRef,
  } = params;
  function addTrack(type: Track['type']): void {
    commandManager.execute(
      new AddTrackCommand(
        timelineAccessor,
        createTrack({
          id: createId('track'),
          type,
          name: zhCN.timeline.newTrackName(
            type,
            project.timeline.tracks.filter((track) => track.type === type).length + 1,
          ),
          clips: [],
        }),
      ),
    );
  }

  function updateTrack(
    trackId: string,
    patch: Partial<Pick<Track, 'color' | 'muted' | 'solo' | 'locked' | 'volume'>>,
  ): void {
    commandManager.execute(new UpdateTrackCommand(timelineAccessor, trackId, patch));
  }

  function selectTrackHeader(trackId: string, event: React.MouseEvent<HTMLDivElement>): void {
    const result = resolveTrackHeaderSelection({
      orderedTrackIds,
      currentSelection: selectedTrackIds,
      clickedTrackId: trackId,
      anchorTrackId: trackSelectionAnchorId,
      shiftKey: event.shiftKey,
    });
    setSelectedTrackIds(result.selectedTrackIds);
    setTrackSelectionAnchorId(result.anchorTrackId);
    setTrackBatchMenu(undefined);
  }

  function openTrackBatchMenu(trackId: string, x: number, y: number): void {
    if (!selectedTrackIds.includes(trackId)) {
      setSelectedTrackIds([trackId]);
      setTrackSelectionAnchorId(trackId);
    }
    setGapMenu(undefined);
    setClipMenu(undefined);
    setVolumeEnvelopeMenu(undefined);
    setTransitionMenu(undefined);
    setRulerMenu(undefined);
    setTrackBatchMenu({
      trackId,
      x: Math.min(x, Math.max(0, window.innerWidth - 230)),
      y: Math.min(y, Math.max(0, window.innerHeight - 260)),
    });
  }

  function selectedTracksForBatch(): Track[] {
    const selected = new Set(selectedTrackIds);
    return project.timeline.tracks.filter((track) => selected.has(track.id));
  }

  function applyBatchTrackPatch(patchForTrack: (track: Track) => TrackPatch): void {
    const tracks = selectedTracksForBatch();
    if (tracks.length === 0) {
      return;
    }
    try {
      commandManager.execute(
        new BatchUpdateTrackCommand(timelineAccessor, {
          patches: Object.fromEntries(tracks.map((track) => [track.id, patchForTrack(track)])),
        }),
      );
      setTrackBatchMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function deleteSelectedEmptyTracks(): void {
    const tracks = selectedTracksForBatch();
    if (tracks.length === 0) {
      return;
    }
    try {
      commandManager.execute(
        new BatchUpdateTrackCommand(timelineAccessor, {
          deleteEmptyTrackIds: tracks.map((track) => track.id),
        }),
      );
      setSelectedTrackIds((current) =>
        current.filter((trackId) =>
          project.timeline.tracks.some((track) => track.id === trackId && track.clips.length > 0),
        ),
      );
      setTrackBatchMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function reorderTracks(draggedTrackId: string, targetTrackId: string): void {
    const nextOrder = moveSelectedTrackIds(orderedTrackIds, selectedTrackIds, draggedTrackId, targetTrackId);
    if (nextOrder.join('\0') === orderedTrackIds.join('\0')) {
      return;
    }
    const nextSelectedTrackIds = selectedTrackIds.includes(draggedTrackId) ? selectedTrackIds : [draggedTrackId];
    try {
      commandManager.execute(new BatchUpdateTrackCommand(timelineAccessor, { order: nextOrder }));
      setSelectedTrackIds(nextSelectedTrackIds);
      setTrackSelectionAnchorId(nextSelectedTrackIds[0]);
      setTrackBatchMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function updateClipColor(clipId: string, colorLabel: TimelineLabelColor | null): void {
    commandManager.execute(new UpdateClipCommand(timelineAccessor, clipId, { colorLabel }));
  }

  function convertClipFrameRate(clipId: string): void {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (
      !asset ||
      asset.type !== 'video' ||
      (!asset.variableFrameRate && !isFrameRateMismatch(asset.frameRate, project.settings.fps)) ||
      !onConvertMediaFrameRate
    ) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.frameRateConvertUnavailableTitle,
        message: zhCN.timeline.frameRateConvertUnavailableMessage,
      });
      return;
    }
    onConvertMediaFrameRate(asset.id);
  }

  function addTransition(): void {
    if (!transitionMenu) {
      return;
    }
    try {
      commandManager.execute(
        new AddTransitionCommand(timelineAccessor, {
          type: transitionMenu.type,
          duration: transitionMenu.duration,
          fromClipId: transitionMenu.fromClipId,
          toClipId: transitionMenu.toClipId,
        }),
      );
      setTransitionMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.transitionUnavailableTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.transitionUnavailableMessage,
      });
    }
  }

  function removeTransition(): void {
    if (!transitionMenu?.existingTransitionId) {
      return;
    }
    commandManager.execute(new RemoveTransitionCommand(timelineAccessor, transitionMenu.existingTransitionId));
    setTransitionMenu(undefined);
  }

  function addText(): void {
    const track = project.timeline.tracks.find((item) => item.type === 'text');
    if (!track) {
      showToast({ kind: 'warning', title: zhCN.timeline.noTextTrackTitle, message: zhCN.timeline.noTextTrackMessage });
      return;
    }
    const clip = createTextClip(track, project.timeline);
    commandManager.execute(new AddClipCommand(timelineAccessor, clip));
    setSelectedClipId(clip.id);
  }

  function addCredits(text?: string, start?: number): void {
    const track = project.timeline.tracks.find((item) => item.type === 'text');
    if (!track) {
      showToast({ kind: 'warning', title: zhCN.timeline.noTextTrackTitle, message: zhCN.timeline.noTextTrackMessage });
      return;
    }
    try {
      const clip = createCreditsClip(track, project.timeline, text, start);
      commandManager.execute(new AddCreditsClipCommand(timelineAccessor, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function addTitleTemplate(templateId: Parameters<typeof instantiateTitleTemplate>[0], start?: number): void {
    const track = project.timeline.tracks.find((item) => item.type === 'text');
    if (!track) {
      showToast({ kind: 'warning', title: zhCN.timeline.noTextTrackTitle, message: zhCN.timeline.noTextTrackMessage });
      return;
    }
    try {
      const label = zhCN.titleTemplates[templateId];
      const clip = instantiateTitleTemplate(templateId, track, project.timeline, {
        name: label.name,
        text: label.defaultText,
        start,
      });
      commandManager.execute(new AddClipCommand(timelineAccessor, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function addTimelineMarker(time = playheadTime): void {
    try {
      commandManager.execute(
        new AddTimelineMarkerCommand(timelineAccessor, {
          id: createId('marker'),
          time,
          label: zhCN.timeline.markerLabel((project.timeline.markers?.length ?? 0) + 1),
        }),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.markerRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.addMarkerFailed,
      });
    }
  }

  function addProjectBookmark(time = playheadTime): void {
    try {
      commandManager.execute(
        new AddProjectBookmarkCommand(projectAccessor, {
          id: createId('bookmark'),
          time,
          note: zhCN.timeline.bookmarkLabel((project.bookmarks?.length ?? 0) + 1),
        }),
      );
      setBookmarkPanelVisible(true);
      setAnnotationPanelOpen(false);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.bookmarkRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.addBookmarkFailed,
      });
    }
  }

  function renameProjectBookmark(bookmarkId: string, note: string): void {
    try {
      commandManager.execute(new UpdateProjectBookmarkCommand(projectAccessor, bookmarkId, { note }));
      setBookmarkRename(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.bookmarkRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.updateBookmarkFailed,
      });
    }
  }

  function removeProjectBookmark(bookmarkId: string): void {
    try {
      commandManager.execute(new RemoveProjectBookmarkCommand(projectAccessor, bookmarkId));
      setBookmarkRename((current) => (current?.id === bookmarkId ? undefined : current));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.bookmarkRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.removeBookmarkFailed,
      });
    }
  }

  function addProtectedRangeAt(time = playheadTime): void {
    try {
      const start = Math.max(0, time);
      const duration = Math.max(1, Math.min(2, Math.max(projectDuration, start + 2) - start));
      const nextRange = createProtectedRange(
        {
          id: createId('protected-range'),
          start,
          end: start + duration,
          label: zhCN.timeline.protectedRangeLabel((project.protectedRanges?.length ?? 0) + 1),
        },
        Math.max(projectDuration, start + duration),
      );
      commandManager.execute(new UpdateProjectProtectedRangesCommand(projectAccessor, [...protectedRanges, nextRange]));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function toggleProtectedRangeAtPlayhead(): void {
    const existing = protectedRanges.find(
      (range) => playheadTime >= range.start - 0.000001 && playheadTime <= range.end + 0.000001,
    );
    if (existing) {
      commandManager.execute(
        new UpdateProjectProtectedRangesCommand(
          projectAccessor,
          protectedRanges.filter((range) => range.id !== existing.id),
        ),
      );
      return;
    }
    addProtectedRangeAt(playheadTime);
  }

  function openRulerMenu(request: { time: number; x: number; y: number }): void {
    setGapMenu(undefined);
    setClipMenu(undefined);
    setVolumeEnvelopeMenu(undefined);
    setTransitionMenu(undefined);
    setRulerMenu({
      x: Math.min(request.x, Math.max(0, window.innerWidth - 230)),
      y: Math.min(request.y, Math.max(0, window.innerHeight - 190)),
      time: request.time,
      timecode: secondsToTimecode(request.time, project.settings.fps || 30, project.settings.timecodeFormat ?? 'ndf'),
    });
  }

  function runRulerMenuAction(action: RulerContextMenuAction): void {
    if (!rulerMenu) {
      return;
    }
    if (action === 'add-marker') {
      addTimelineMarker(rulerMenu.time);
      setRulerMenu(undefined);
      return;
    }
    if (action === 'add-protected-range') {
      addProtectedRangeAt(rulerMenu.time);
      setRulerMenu(undefined);
      return;
    }
    if (action === 'set-in') {
      setInPoint(rulerMenu.time);
      setRulerMenu(undefined);
      return;
    }
    if (action === 'set-out') {
      setOutPoint(rulerMenu.time);
      setRulerMenu(undefined);
    }
  }

  function jumpToRulerTimecode(): void {
    if (!rulerMenu) {
      return;
    }
    const parsed = parseTimecodeToSeconds(rulerMenu.timecode, {
      fps: project.settings.fps || 30,
      duration: projectDuration,
    });
    if (!parsed.ok) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.invalidTimecodeTitle,
        message: zhCN.timeline.invalidTimecodeMessage,
      });
      return;
    }
    setPlayheadTime(parsed.value.seconds);
    setRulerMenu(undefined);
  }

  function addBeatMarker(): void {
    try {
      commandManager.execute(
        new UpdateProjectBeatMarkersCommand(projectAccessor, [
          ...(project.beatMarkers ?? []),
          createBeatMarker(playheadTime),
        ]),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.beatMarkerRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.addBeatMarkerFailed,
      });
    }
  }

  function openAnnotationEditorAt(time: number, annotation?: ProjectAnnotation): void {
    setAnnotationEditor({
      id: annotation?.id,
      time: annotation?.time ?? Math.max(0, snapTime(time)),
      text: annotation?.text ?? zhCN.timeline.annotationLabel((project.annotations?.length ?? 0) + 1),
      color: annotation?.color ?? DEFAULT_PROJECT_ANNOTATION_COLOR,
    });
  }

  function saveAnnotationEditor(next: AnnotationEditorState): void {
    try {
      if (next.id) {
        commandManager.execute(
          new UpdateProjectAnnotationCommand(projectAccessor, next.id, {
            time: next.time,
            text: next.text,
            color: next.color,
          }),
        );
      } else {
        commandManager.execute(
          new AddProjectAnnotationCommand(projectAccessor, {
            time: next.time,
            text: next.text,
            color: next.color,
          }),
        );
      }
      setAnnotationEditor(undefined);
      setAnnotationPanelOpen(true);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.annotationRejectedTitle,
        message:
          error instanceof Error
            ? error.message
            : next.id
              ? zhCN.timeline.updateAnnotationFailed
              : zhCN.timeline.addAnnotationFailed,
      });
    }
  }

  function removeProjectAnnotation(annotationId: string): void {
    try {
      commandManager.execute(new RemoveProjectAnnotationCommand(projectAccessor, annotationId));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.annotationRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.removeAnnotationFailed,
      });
    }
  }

  function openTimelineNoteEditor(start: number, end?: number, note?: TimelineNote): void {
    const normalizedStart = Math.max(0, snapTime(Math.min(start, end ?? start)));
    const normalizedEnd = Math.max(normalizedStart + minFrameDuration(), snapTime(Math.max(end ?? start + 1, start)));
    setTimelineNoteEditor({
      id: note?.id,
      start: note?.start ?? normalizedStart,
      end: note?.end ?? normalizedEnd,
      text: note?.text ?? zhCN.timeline.timelineNoteLabel(timelineNotes.length + 1),
      color: note?.color ?? DEFAULT_TIMELINE_NOTE_COLOR,
    });
  }

  function quickAddTimelineNote(): void {
    openTimelineNoteEditor(playheadTime, playheadTime + Math.max(1, minFrameDuration()));
    setTimelineNotePanelOpen(true);
    setAnnotationPanelOpen(false);
    setBookmarkPanelVisible(false);
  }

  function saveTimelineNoteEditor(next: TimelineNoteEditorState): void {
    try {
      if (next.id) {
        commandManager.execute(
          new UpdateTimelineNoteCommand(projectAccessor, next.id, {
            start: next.start,
            end: next.end,
            text: next.text,
            color: next.color,
          }),
        );
      } else {
        commandManager.execute(
          new AddTimelineNoteCommand(projectAccessor, {
            id: createId('timeline-note'),
            start: next.start,
            end: next.end,
            text: next.text,
            color: next.color,
          }),
        );
      }
      setTimelineNoteEditor(undefined);
      setTimelineNotePanelOpen(true);
      setAnnotationPanelOpen(false);
      setBookmarkPanelVisible(false);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.timelineNoteRejectedTitle,
        message:
          error instanceof Error
            ? error.message
            : next.id
              ? zhCN.timeline.updateTimelineNoteFailed
              : zhCN.timeline.addTimelineNoteFailed,
      });
    }
  }

  function removeTimelineNote(noteId: string): void {
    try {
      commandManager.execute(new RemoveTimelineNoteCommand(projectAccessor, noteId));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.timelineNoteRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.removeTimelineNoteFailed,
      });
    }
  }

  function onTimelineNoteRangeDraft(start: number, end: number): void {
    openTimelineNoteEditor(start, end);
    setTimelineNotePanelOpen(true);
    setAnnotationPanelOpen(false);
    setBookmarkPanelVisible(false);
  }

  async function exportTimelineNotesCsv(): Promise<void> {
    try {
      const path = await saveFileDialog('timeline-notes.csv', [{ name: zhCN.fileDialogs.csv, extensions: ['csv'] }]);
      if (!path) {
        return;
      }
      await writeFile(path, serializeTimelineNotesCsv(timelineNotes, project.settings.fps || 30));
      showToast({ kind: 'success', title: zhCN.timeline.timelineNoteExported, message: path });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.timelineNoteExportFailed,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineNoteExportFailedMessage,
      });
    }
  }

  function removeTimelineMarker(markerId: string): void {
    try {
      commandManager.execute(new RemoveTimelineMarkerCommand(timelineAccessor, markerId));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.markerRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.removeMarkerFailed,
      });
    }
  }

  function splitSelected(): void {
    if (!selectedClipId) {
      return;
    }
    try {
      commandManager.execute(new SplitClipCommand(timelineAccessor, selectedClipId, playheadTime));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.splitUnavailableTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.splitUnavailableMessage,
      });
    }
  }

  function createGroupFromSelection(): void {
    if (selectedClipIds.length < 2) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.clipGroupCreateUnavailableTitle,
        message: zhCN.timeline.clipGroupCreateUnavailableMessage,
      });
      return;
    }
    try {
      const command = new CreateClipGroupCommand(projectAccessor, selectedClipIds, {
        name: zhCN.timeline.clipGroupDefaultName(clipGroups.length + 1),
        color: CLIP_GROUP_COLORS[clipGroups.length % CLIP_GROUP_COLORS.length],
      });
      commandManager.execute(command);
      setSelectedClipIds(command.group?.clipIds ?? selectedClipIds);
      setClipMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  function ungroupSelected(group = selectedGroup): void {
    if (!group) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.clipGroupUngroupUnavailableTitle,
        message: zhCN.timeline.clipGroupUngroupUnavailableMessage,
      });
      return;
    }
    try {
      commandManager.execute(new UngroupCommand(projectAccessor, group.id));
      setSelectedClipIds(group.clipIds);
      setClipMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  function deleteGroup(group: ClipGroup): void {
    try {
      commandManager.execute(new DeleteGroupCommand(projectAccessor, group.id));
      clearSelectedClipIds();
      setClipMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  function updateGroupColor(group: ClipGroup, color: ClipGroupColor): void {
    try {
      commandManager.execute(new UpdateClipGroupCommand(projectAccessor, group.id, { color }));
      setClipMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  function deleteSelected(): void {
    if (selectedClipIds.length === 0) {
      return;
    }
    if (selectedGroup) {
      deleteGroup(selectedGroup);
      return;
    }
    commandManager.execute(new DeleteClipsCommand(timelineAccessor, selectedClipIds));
    clearSelectedClipIds();
  }

  function rippleDeleteSelected(): void {
    if (selectedClipIds.length === 0) {
      return;
    }
    if (selectedGroup) {
      deleteGroup(selectedGroup);
      return;
    }
    commandManager.execute(new RippleDeleteCommand(timelineAccessor, selectedClipIds, project.protectedRanges));
    clearSelectedClipIds();
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (selectionStart) {
      setSelectionRect(buildSelectionMarqueeRect(selectionStart, { x: event.clientX, y: event.clientY }));
      return;
    }
    if (!drag) {
      return;
    }
    const delta = (event.clientX - drag.startX) / zoom;
    if (drag.mode === 'playhead') {
      setPlayheadTime(Math.max(0, snapTime(drag.previewStart + delta)));
      return;
    }
    if (!drag.clip) {
      return;
    }
    if (drag.mode === 'keyframe') {
      if (drag.keyframeSelectionOnly) {
        return;
      }
      const nextTime = snapKeyframeTime(
        drag.clip,
        Math.min(drag.clip.duration, Math.max(0, drag.previewStart + delta)),
        event.altKey,
      );
      const previewKeyframeDelta = round(nextTime - drag.previewStart);
      const keyframes = drag.keyframes?.length
        ? drag.keyframes
        : drag.keyframeProperty && drag.keyframeId
          ? [{ clipId: drag.clip.id, property: drag.keyframeProperty, keyframeId: drag.keyframeId }]
          : [];
      const keyframeStartTimes = drag.keyframeStartTimes ?? buildKeyframeStartTimes(keyframes);
      const previewKeyframeTimes = Object.fromEntries(
        keyframes.flatMap((ref) => {
          const clip = findClipById(ref.clipId);
          const startTime = keyframeStartTimes[keyframeRefKey(ref)] ?? getKeyframeTime(ref);
          if (!clip || startTime === undefined) {
            return [];
          }
          return [
            [keyframeRefKey(ref), snapTime(Math.min(clip.duration, Math.max(0, startTime + previewKeyframeDelta)))],
          ];
        }),
      );
      setDrag({
        ...drag,
        previewKeyframeTime: nextTime,
        previewKeyframeDelta,
        keyframeStartTimes,
        previewKeyframeTimes,
      });
      setPlayheadTime(drag.clip.start + nextTime);
      return;
    }
    if (drag.mode === 'move') {
      const startByClipId = drag.startByClipId ?? { [drag.clip.id]: drag.clip.start };
      const draggedStart = startByClipId[drag.clip.id] ?? drag.clip.start;
      const minStart = Math.min(...Object.values(startByClipId));
      const unclampedDelta = Math.max(delta, -minStart);
      const snappedDraggedStart = snapClipStart(
        Math.max(0, draggedStart + unclampedDelta),
        drag.clip.duration,
        drag.clip,
        event.altKey,
      );
      const snappedDelta = round(snappedDraggedStart - draggedStart);
      const previewStartsByClipId = Object.fromEntries(
        Object.entries(startByClipId).map(([clipId, start]) => [clipId, round(Math.max(0, start + snappedDelta))]),
      );
      setDrag({ ...drag, previewStart: snappedDraggedStart, previewStartsByClipId });
      setPreviewTimeline(buildMovedPreviewTimeline(previewStartsByClipId));
      return;
    }
    if (drag.mode === 'rolling-trim') {
      setDrag({ ...drag, previewRollingDelta: round(delta) });
      return;
    }
    if (drag.mode === 'slip') {
      const preview = buildSlipClip(drag.clip, delta);
      setDrag({
        ...drag,
        previewTrimStart: preview.trimStart,
        previewTrimEnd: preview.trimEnd,
        previewSlipDelta: delta,
        previewClipsById: { [preview.id]: preview },
      });
      setPreviewTimeline(replaceClip(project.timeline, preview));
      return;
    }
    if (drag.mode === 'slide') {
      try {
        const edit = buildSlideClipEdit(project.timeline, drag.clip.id, delta, minFrameDuration());
        setDrag({
          ...drag,
          previewStart: edit.clip.start,
          previewSlideDelta: edit.delta,
          previewClipsById: {
            [edit.leftClip.id]: edit.leftClip,
            [edit.clip.id]: edit.clip,
            [edit.rightClip.id]: edit.rightClip,
          },
        });
        setPreviewTimeline(edit.timeline);
      } catch {
        setDrag({ ...drag, previewSlideDelta: 0, previewClipsById: undefined });
        setPreviewTimeline(undefined);
      }
      return;
    }
    if (drag.mode === 'trim-left') {
      const preview = buildTrimPreview(drag.clip, 'left', delta, event.altKey);
      setDrag({
        ...drag,
        previewStart: preview.start,
        previewDuration: preview.duration,
        previewTrimStart: preview.trimStart,
        previewTrimEnd: preview.trimEnd,
      });
      setPreviewTimeline(replaceClip(project.timeline, preview));
      return;
    }
    const preview = buildTrimPreview(drag.clip, 'right', delta, event.altKey);
    setDrag({
      ...drag,
      previewDuration: preview.duration,
      previewTrimStart: preview.trimStart,
      previewTrimEnd: preview.trimEnd,
    });
    setPreviewTimeline(replaceClip(project.timeline, preview));
  }

  function onPointerUp(): void {
    if (selectionStart) {
      const ids = selectionRect ? findClipIdsIntersectingRect(selectionRect) : [];
      setSelectedClipIds(ids);
      setSelectionStart(undefined);
      setSelectionRect(undefined);
      return;
    }
    if (!drag) {
      return;
    }
    const current = drag;
    setDrag(undefined);
    setPreviewTimeline(undefined);
    if (!current.clip || current.mode === 'playhead') {
      return;
    }
    try {
      if (current.mode === 'keyframe') {
        if (!current.keyframeProperty || !current.keyframeId) {
          return;
        }
        if (current.keyframeSelectionOnly) {
          return;
        }
        const keyframes = current.keyframes?.length
          ? current.keyframes
          : [{ clipId: current.clip.id, property: current.keyframeProperty, keyframeId: current.keyframeId }];
        const delta =
          current.previewKeyframeDelta ??
          round((current.previewKeyframeTime ?? current.previewStart) - current.previewStart);
        if (Math.abs(delta) > 0.000001) {
          if (keyframes.length > 1) {
            commandManager.execute(new BatchKeyframeEditCommand(timelineAccessor, keyframes, { type: 'shift', delta }));
          } else {
            commandManager.execute(
              new UpdateKeyframeCommand(
                timelineAccessor,
                current.clip.id,
                current.keyframeProperty,
                current.keyframeId,
                {
                  time: current.previewKeyframeTime ?? current.previewStart,
                },
              ),
            );
          }
        }
        setSelectedKeyframes(keyframes);
      } else if (current.mode === 'move') {
        const starts = current.previewStartsByClipId ?? { [current.clip.id]: current.previewStart };
        if (!canApplyProtectedMove(starts)) {
          warnProtectedRangeBlocked();
          return;
        }
        const ids = Object.keys(starts);
        if (ids.length > 1) {
          commandManager.execute(new MoveClipsCommand(timelineAccessor, starts, protectedRanges));
        } else {
          const preview = moveClip(current.clip, current.previewStart);
          const track = project.timeline.tracks.find((item) => item.id === preview.trackId);
          if (track && detectOverlap(track, preview, current.clip.id)) {
            showToast({
              kind: 'warning',
              title: zhCN.timeline.clipOverlapTitle,
              message: zhCN.timeline.clipOverlapMessage,
            });
            return;
          }
          commandManager.execute(
            new MoveClipCommand(timelineAccessor, current.clip.id, current.previewStart, protectedRanges),
          );
        }
      } else if (current.mode === 'rolling-trim') {
        if (!current.rightClip || Math.abs(current.previewRollingDelta ?? 0) <= 0.000001) {
          return;
        }
        commandManager.execute(
          new RollingTrimCommand(
            timelineAccessor,
            current.clip.id,
            current.rightClip.id,
            current.previewRollingDelta ?? 0,
            minFrameDuration(),
          ),
        );
      } else if (current.mode === 'slip') {
        if (current.previewTrimStart === current.clip.trimStart && current.previewTrimEnd === current.clip.trimEnd) {
          return;
        }
        commandManager.execute(new SlipClipCommand(timelineAccessor, current.clip.id, current.previewSlipDelta ?? 0));
      } else if (current.mode === 'slide') {
        if (Math.abs(current.previewSlideDelta ?? 0) <= 0.000001) {
          return;
        }
        commandManager.execute(
          new SlideClipCommand(timelineAccessor, current.clip.id, current.previewSlideDelta ?? 0, minFrameDuration()),
        );
      } else {
        commandManager.execute(
          new TrimClipCommand(
            timelineAccessor,
            current.clip.id,
            current.previewTrimStart,
            current.previewTrimEnd,
            undefined,
            minFrameDuration(),
          ),
        );
      }
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function onDragStart(nextDrag: DragState): void {
    if (nextDrag.mode === 'keyframe') {
      if (nextDrag.keyframeSelectionOnly) {
        setDrag(nextDrag);
        return;
      }
      const keyframes = nextDrag.keyframes?.length
        ? nextDrag.keyframes
        : nextDrag.clip && nextDrag.keyframeProperty && nextDrag.keyframeId
          ? [{ clipId: nextDrag.clip.id, property: nextDrag.keyframeProperty, keyframeId: nextDrag.keyframeId }]
          : [];
      setDrag({ ...nextDrag, keyframes, keyframeStartTimes: buildKeyframeStartTimes(keyframes) });
      return;
    }
    if (nextDrag.mode !== 'move' || !nextDrag.clip) {
      setDrag(nextDrag);
      return;
    }
    const clipIds = nextDrag.clipIds?.length ? nextDrag.clipIds : [nextDrag.clip.id];
    const startByClipId = Object.fromEntries(
      clipIds.map((clipId) => [
        clipId,
        allClips.find((clip) => clip.id === clipId)?.start ?? nextDrag.clip?.start ?? 0,
      ]),
    );
    setDrag({ ...nextDrag, clipIds, startByClipId, previewStartsByClipId: startByClipId });
  }

  function selectClip(clipId: string, additive: boolean, forceSingle = false): void {
    const group = forceSingle ? undefined : clipGroupByClipId.get(clipId);
    if (group && additive) {
      const selected = new Set(selectedClipIds);
      const groupFullySelected = group.clipIds.every((groupClipId) => selected.has(groupClipId));
      for (const groupClipId of group.clipIds) {
        if (groupFullySelected) {
          selected.delete(groupClipId);
        } else {
          selected.add(groupClipId);
        }
      }
      setSelectedClipIds(Array.from(selected));
      return;
    }
    if (group && !additive) {
      setSelectedClipIds(group.clipIds);
      return;
    }
    if (additive) {
      toggleSelectedClipId(clipId);
      return;
    }
    if (selectedClipIds.length > 1 && selectedClipIds.includes(clipId)) {
      return;
    }
    setSelectedClipId(clipId);
  }

  function findClipById(clipId: string): Clip | undefined {
    return allClips.find((clip) => clip.id === clipId);
  }

  function canApplyProtectedMove(startsByClipId: Record<string, number>): boolean {
    return Object.entries(startsByClipId).every(([clipId, start]) => {
      const clip = findClipById(clipId);
      return !clip || canMoveClipWithProtectedRanges(clip, start, protectedRanges);
    });
  }

  function warnProtectedRangeBlocked(): void {
    showToast({
      kind: 'warning',
      title: zhCN.timeline.protectedRangeBlockedTitle,
      message: zhCN.timeline.protectedRangeBlockedMessage,
    });
  }

  function getKeyframeTime(ref: SelectedKeyframeRef): number | undefined {
    const clip = findClipById(ref.clipId);
    return clip?.keyframes?.[ref.property]?.find((frame) => frame.id === ref.keyframeId)?.time;
  }

  function buildKeyframeStartTimes(refs: SelectedKeyframeRef[]): Record<string, number> {
    return Object.fromEntries(
      refs.flatMap((ref) => {
        const time = getKeyframeTime(ref);
        return time === undefined ? [] : [[keyframeRefKey(ref), time]];
      }),
    );
  }

  function selectKeyframe(
    keyframe: { clipId: string; property: KeyframeProperty; keyframeId: string },
    additive: boolean,
  ): void {
    if (additive) {
      toggleSelectedKeyframe(keyframe);
      return;
    }
    setSelectedKeyframe(keyframe);
  }

  function openNestedSequence(clip: Clip): void {
    if (clip.type !== 'nested-sequence') {
      return;
    }
    setActiveSequenceId(clip.sequenceId);
    if (isNestedSequenceDepthExceeded(useEditorStore.getState().project)) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.nestedSequenceDepthTitle,
        message: zhCN.timeline.nestedSequenceDepthMessage,
      });
    }
  }

  function packClipMenuSelection(clipId: string): void {
    const clipIds = selectedClipIds.includes(clipId) ? selectedClipIds : [clipId];
    try {
      commandManager.execute(
        new PackNestedSequenceCommand(
          projectAccessor,
          clipIds,
          zhCN.timeline.nestedSequenceName(project.sequences.length),
        ),
      );
      setClipMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  async function openReplaceMedia(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    try {
      const [path] = await openFileDialog(false, [
        {
          name: zhCN.fileDialogs.media,
          extensions: ['mp4', 'mov', 'mkv', 'webm', 'm4a', 'mp3', 'wav', 'png', 'jpg', 'jpeg', 'webp'],
        },
      ]);
      if (!path) {
        return;
      }
      const media = await probeMediaPath(path);
      addMedia([media]);
      setReplaceMediaDialog({
        clipId: clip.id,
        media,
        durationMode: 'trim-to-original',
        warnings: getReplaceMediaCompatibilityWarnings(clip, media),
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.replaceMediaFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.replaceMediaChooseFailed,
      });
    }
  }

  function confirmReplaceMedia(): void {
    if (!replaceMediaDialog) {
      return;
    }
    try {
      commandManager.execute(
        new ReplaceMediaCommand(
          timelineAccessor,
          replaceMediaDialog.clipId,
          replaceMediaDialog.media,
          replaceMediaDialog.durationMode,
        ),
      );
      setSelectedClipId(replaceMediaDialog.clipId);
      setReplaceMediaDialog(undefined);
      showToast({
        kind: 'success',
        title: zhCN.timeline.replaceMediaSuccessTitle,
        message: zhCN.timeline.replaceMediaSuccessMessage,
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.replaceMediaFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  function removeBeatMarker(markerId: string): void {
    try {
      commandManager.execute(
        new UpdateProjectBeatMarkersCommand(
          projectAccessor,
          (project.beatMarkers ?? []).filter((marker) => marker.id !== markerId),
        ),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.beatMarkerRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.removeBeatMarkerFailed,
      });
    }
  }

  function openGapMenu(request: GapMenuRequest): void {
    setTransitionMenu(undefined);
    setClipMenu(undefined);
    setVolumeEnvelopeMenu(undefined);
    setRulerMenu(undefined);
    setGapMenu({
      ...request,
      x: Math.min(request.x, Math.max(0, window.innerWidth - 220)),
      y: Math.min(request.y, Math.max(0, window.innerHeight - 260)),
    });
  }

  function closeGap(): void {
    if (!gapMenu) {
      return;
    }
    try {
      commandManager.execute(new CloseGapCommand(timelineAccessor, gapMenu.trackId, gapMenu.time));
      setGapMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.closeGapFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  async function fillGap(strategy: GapFillStrategy): Promise<void> {
    if (!gapMenu) {
      return;
    }
    const menu = gapMenu;
    try {
      if (strategy === 'repeat' || strategy === 'crossfade') {
        commandManager.execute(
          new FillGapCommand(timelineAccessor, menu.trackId, menu.time, buildGapFillCommandOperation(strategy)),
        );
        setGapMenu(undefined);
        return;
      }
      const media = await createGapFillMediaAsset(menu, strategy);
      const gap = findTimelineGapAtTime(project.timeline, menu.trackId, menu.time);
      if (!gap) {
        throw new Error(zhCN.timeline.noFillableGapMessage);
      }
      addMedia([media]);
      const clip = createGapFillImageClip({
        name: media.name,
        mediaId: media.id,
        trackId: menu.trackId,
        start: gap.start,
        duration: gap.duration,
      });
      commandManager.execute(
        new FillGapCommand(timelineAccessor, menu.trackId, menu.time, buildGapFillCommandOperation(strategy, { clip })),
      );
      setSelectedClipId(clip.id);
      setGapMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.smartGapFillFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  async function createGapFillMediaAsset(
    menu: GapMenuState,
    strategy: Extract<GapFillStrategy, 'freeze-frame' | 'black' | 'white'>,
  ): Promise<MediaAsset> {
    if (strategy === 'freeze-frame') {
      try {
        const gap = findTimelineGapAtTime(project.timeline, menu.trackId, menu.time);
        const sourceClip = gap?.previousClip;
        const sourceAsset = sourceClip ? getClipMediaAsset(sourceClip) : undefined;
        if (!sourceClip || !sourceAsset || sourceAsset.type === 'audio') {
          throw new Error(zhCN.timeline.freezeFrameUnavailableMessage);
        }
        const frameDuration = 1 / Math.max(1, project.settings.fps || 30);
        const sourceTime =
          'mediaId' in sourceClip
            ? Math.max(0, sourceClip.trimStart + getClipSourceVisibleDuration(sourceClip) - frameDuration)
            : 0;
        const result = await generateGapFillMedia({
          kind: 'freeze-frame',
          sourcePath: sourceAsset.path,
          sourceTime,
          width: sourceAsset.width || project.settings.width,
          height: sourceAsset.height || project.settings.height,
        });
        return buildGapFillAsset(result, zhCN.timeline.gapFillFreezeFrameName);
      } catch {
        return createGapFillMediaAsset(menu, 'black');
      }
    }
    const result = await generateGapFillMedia({
      kind: 'solid-color',
      color: strategy === 'white' ? '#ffffff' : '#000000',
      width: project.settings.width,
      height: project.settings.height,
    });
    return buildGapFillAsset(
      result,
      strategy === 'white' ? zhCN.timeline.gapFillWhiteName : zhCN.timeline.gapFillBlackName,
    );
  }

  function buildGapFillAsset(
    result: { path: string; name: string; width: number; height: number },
    fallbackName: string,
  ): MediaAsset {
    return {
      id: createId('media-gap-fill'),
      type: 'image',
      name: result.name || `${fallbackName}.png`,
      path: result.path,
      duration: 0,
      width: result.width || project.settings.width,
      height: result.height || project.settings.height,
      importedAt: new Date().toISOString(),
    };
  }

  function onTrackPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button === 2) {
      return;
    }
    if (annotationMode) {
      event.preventDefault();
      return;
    }
    setTransitionMenu(undefined);
    setClipMenu(undefined);
    setVolumeEnvelopeMenu(undefined);
    setGapMenu(undefined);
    setRulerMenu(undefined);
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

  function openClipMenu(request: ClipMenuRequest): void {
    setTransitionMenu(undefined);
    setGapMenu(undefined);
    setVolumeEnvelopeMenu(undefined);
    setRulerMenu(undefined);
    if (!selectedClipIds.includes(request.clipId)) {
      const group = clipGroupByClipId.get(request.clipId);
      setSelectedClipIds(group?.clipIds ?? [request.clipId]);
    }
    setClipMenu({
      ...request,
      x: Math.min(request.x, Math.max(0, window.innerWidth - 260)),
      y: Math.min(request.y, Math.max(0, window.innerHeight - 360)),
    });
  }

  function addVolumeEnvelopePoint(request: VolumeEnvelopePointRequest): void {
    const clip = findClip(request.clipId);
    if (!('volume' in clip)) {
      return;
    }
    try {
      const keyframe = volumeEnvelopeControlPointToKeyframe(
        { time: request.time, value: request.value },
        clip.duration,
      );
      commandManager.execute(new AddKeyframeCommand(timelineAccessor, clip.id, 'volume', keyframe));
      setSelectedClipId(clip.id);
      setSelectedKeyframe({ clipId: clip.id, property: 'volume', keyframeId: keyframe.id });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.volumeEnvelopeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage,
      });
    }
  }

  function updateVolumeEnvelopePoint(request: Required<VolumeEnvelopePointRequest>): void {
    try {
      commandManager.execute(
        new UpdateKeyframeCommand(timelineAccessor, request.clipId, 'volume', request.keyframeId, {
          time: request.time,
          value: request.value,
        }),
      );
      setSelectedClipId(request.clipId);
      setSelectedKeyframe({ clipId: request.clipId, property: 'volume', keyframeId: request.keyframeId });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.volumeEnvelopeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage,
      });
    }
  }

  function removeVolumeEnvelopePoint(
    request: Required<Pick<VolumeEnvelopePointRequest, 'clipId' | 'keyframeId'>>,
  ): void {
    try {
      commandManager.execute(new RemoveKeyframeCommand(timelineAccessor, request.clipId, 'volume', request.keyframeId));
      setSelectedKeyframes([]);
      setSelectedClipId(request.clipId);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.volumeEnvelopeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage,
      });
    }
  }

  function openVolumeEnvelopeMenu(request: VolumeEnvelopeMenuRequest): void {
    setTransitionMenu(undefined);
    setClipMenu(undefined);
    setGapMenu(undefined);
    setRulerMenu(undefined);
    setSelectedClipId(request.clipId);
    setVolumeEnvelopeMenu({
      ...request,
      x: Math.min(request.x, Math.max(0, window.innerWidth - 180)),
      y: Math.min(request.y, Math.max(0, window.innerHeight - 170)),
    });
  }

  function applyVolumeEnvelopeFade(kind: 'in' | 'out'): void {
    if (!volumeEnvelopeMenu) {
      return;
    }
    const clip = findClip(volumeEnvelopeMenu.clipId);
    if (!('volume' in clip)) {
      return;
    }
    try {
      const keyframes = buildVolumeFadeKeyframes(kind, clip.duration, clip.volume, Math.min(1, clip.duration));
      commandManager.execute(
        new BatchUpdateKeyframeCommand(
          timelineAccessor,
          [{ clipId: clip.id, property: 'volume', keyframes }],
          zhCN.timeline.volumeEnvelopeFadeCommand,
        ),
      );
      setSelectedClipId(clip.id);
      setSelectedKeyframes(keyframes.map((frame) => ({ clipId: clip.id, property: 'volume', keyframeId: frame.id })));
      setVolumeEnvelopeMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.volumeEnvelopeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage,
      });
    }
  }

  function resetVolumeEnvelope(): void {
    if (!volumeEnvelopeMenu) {
      return;
    }
    try {
      commandManager.execute(
        new BatchUpdateKeyframeCommand(
          timelineAccessor,
          [{ clipId: volumeEnvelopeMenu.clipId, property: 'volume', keyframes: [], replace: true }],
          zhCN.timeline.volumeEnvelopeResetCommand,
        ),
      );
      setSelectedKeyframes([]);
      setSelectedClipId(volumeEnvelopeMenu.clipId);
      setVolumeEnvelopeMenu(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.volumeEnvelopeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage,
      });
    }
  }

  function openSilenceDetection(clipId: string): void {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (!asset || (clip.type === 'video' && !asset.hasAudio) || (clip.type !== 'video' && clip.type !== 'audio')) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.silenceUnavailableTitle,
        message: zhCN.timeline.silenceUnavailableMessage,
      });
      return;
    }
    setSilenceDialog({ clip, asset });
  }

  function getDialogueDetectionTarget(): { clip: Clip; asset: MediaAsset } | undefined {
    const selected = new Set(selectedClipIds.length > 0 ? selectedClipIds : selectedClipId ? [selectedClipId] : []);
    const candidates = [...allClips.filter((clip) => selected.has(clip.id)), ...allClips];
    for (const clip of candidates) {
      const asset = getClipMediaAsset(clip);
      if (!asset || (clip.type !== 'audio' && clip.type !== 'video') || (clip.type === 'video' && !asset.hasAudio)) {
        continue;
      }
      return { clip, asset };
    }
    return undefined;
  }

  async function runDialogueDetection(sensitivity: DialogueSensitivity): Promise<void> {
    const target = getDialogueDetectionTarget();
    if (!target) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.dialogueDetectionUnavailableTitle,
        message: zhCN.timeline.dialogueDetectionUnavailableMessage,
      });
      setDialogueMarkers([]);
      setDialogueMisses([]);
      return;
    }
    setSelectedClipId(target.clip.id);
    try {
      const relativeDialogues = await detectClipDialogue(target.clip, target.asset, sensitivity);
      const absoluteDialogues = relativeDialogues.map((dialogue, index) => ({
        ...dialogue,
        id: `dialogue-${target.clip.id}-${index + 1}`,
        start: round(target.clip.start + dialogue.start),
        end: round(target.clip.start + dialogue.end),
        duration: round(dialogue.end - dialogue.start),
      }));
      const whisperSegments = project.timeline.tracks
        .filter((track) => track.type === 'subtitle')
        .flatMap((track) =>
          track.clips
            .filter(
              (clip): clip is Extract<Clip, { type: 'subtitle' }> =>
                clip.type === 'subtitle' && clip.text.trim().length > 0,
            )
            .map((clip) => ({ start: clip.start, end: round(clip.start + clip.duration), text: clip.text })),
        );
      setDialogueMarkers(absoluteDialogues);
      setDialogueMisses(compareDialogueWithWhisper(absoluteDialogues, whisperSegments));
      if (absoluteDialogues.length === 0) {
        showToast({
          kind: 'warning',
          title: zhCN.timeline.dialogueDetectionTitle,
          message: zhCN.timeline.dialogueDetectionNoResults,
        });
      }
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.dialogueDetectionFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.dialogueDetectionFailedMessage,
      });
    }
  }

  function generateDialogueSubtitles(): void {
    if (dialogueMarkers.length === 0) {
      return;
    }
    const existingTrack = project.timeline.tracks.find((track) => track.type === 'subtitle');
    const targetTrack =
      existingTrack ??
      createTrack({
        id: createId('track'),
        type: 'subtitle',
        name: zhCN.timeline.dialogueSubtitleTrackName,
        clips: [],
      });
    const clips = createSubtitleClipsFromDialogues(dialogueMarkers, {
      trackId: targetTrack.id,
      baseId: createId('dialogue-subtitle'),
      namePrefix: zhCN.timeline.dialogueSubtitleNamePrefix,
    });
    try {
      commandManager.execute(
        new BatchImportSubtitleCommand(
          timelineAccessor,
          { ...targetTrack, clips },
          { mode: existingTrack ? 'append' : 'new-track', targetTrackId: existingTrack?.id },
        ),
      );
      setSelectedClipIds(clips.map((clip) => clip.id));
      showToast({
        kind: 'success',
        title: zhCN.timeline.dialogueSubtitlesCreatedTitle,
        message: zhCN.editorToasts.subtitlesGenerated(clips.length),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function applySilenceRemoval(clipId: string, ranges: SilentRange[]): void {
    try {
      commandManager.execute(new RemoveSilenceCommand(timelineAccessor, clipId, ranges));
      setSilenceDialog(undefined);
      clearSelectedClipIds();
      showToast({
        kind: 'success',
        title: zhCN.timeline.silenceRemovedTitle,
        message: zhCN.timeline.silenceRemovedMessage(ranges.length),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.silenceRemoveFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  function openSceneDetection(clipId: string): void {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (clip.type !== 'video' || !asset) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.sceneUnavailableTitle,
        message: zhCN.timeline.sceneUnavailableMessage,
      });
      return;
    }
    setSceneDialog({
      clip,
      asset,
      status: 'ready',
      threshold: 10,
      progress: 0,
      scenecuts: clip.scenecuts ?? [],
      filterShortScenes: true,
      minSceneSeconds: 1,
      splitAtCuts: true,
      addMarkers: false,
      syncChapters: false,
    });
  }

  async function startSceneDetection(): Promise<void> {
    const current = sceneDialog;
    if (!current || current.status === 'running') {
      return;
    }
    const clip = findClip(current.clip.id);
    const asset = getClipMediaAsset(clip);
    if (clip.type !== 'video' || !asset) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.sceneUnavailableTitle,
        message: zhCN.timeline.sceneUnavailableMessage,
      });
      return;
    }
    const speed = getClipSpeed(clip);
    const sourceStart = clip.trimStart;
    const sourceEnd = sourceStart + clip.duration * speed;
    const limit = getSceneDetectionAnalysisLimit(asset.duration || clip.duration);
    const taskId = `scene-${clip.id}-${Date.now()}`;
    setSceneDialog((dialog) =>
      dialog?.clip.id === clip.id
        ? {
            ...dialog,
            clip,
            asset,
            status: 'running',
            progress: 0,
            analyzedFrames: 0,
            totalFrames: undefined,
            taskId,
            limited: limit.limited,
            analyzedDuration: limit.analysisDuration,
          }
        : dialog,
    );
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listenBridge<SceneDetectProgressEvent>('scene-detect-progress', (payload) => {
        setSceneDialog((dialog) =>
          dialog?.clip.id === clip.id && dialog.taskId === taskId
            ? {
                ...dialog,
                progress: payload.progress,
                analyzedFrames: payload.analyzedFrames ?? dialog.analyzedFrames,
                totalFrames: payload.totalFrames ?? dialog.totalFrames,
              }
            : dialog,
        );
      });
      const result = await detectSceneChanges({
        path: asset.path,
        threshold: current.threshold,
        duration: limit.analysisDuration,
        taskId,
        frameRate: project.settings.fps,
      });
      const scenecuts = result.sceneTimes
        .filter((time) => time > sourceStart + 0.000001 && time < sourceEnd - 0.000001)
        .map((time) => round((time - sourceStart) / speed));
      commandManager.execute(new UpdateClipCommand(timelineAccessor, clip.id, { scenecuts }));
      setSceneDialog((dialog) =>
        dialog?.clip.id === clip.id
          ? {
              ...dialog,
              clip: { ...clip, scenecuts },
              status: 'complete',
              progress: 1,
              scenecuts,
              taskId: undefined,
              limited: result.limited ?? limit.limited,
              analyzedDuration: result.analyzedDuration ?? limit.analysisDuration,
            }
          : dialog,
      );
      if (scenecuts.length === 0) {
        showToast({ kind: 'info', title: zhCN.timeline.noSceneCutsTitle });
      }
    } catch (error) {
      if (error instanceof Error && /canceled/i.test(error.message)) {
        setSceneDialog((dialog) =>
          dialog?.clip.id === clip.id ? { ...dialog, status: 'ready', progress: 0, taskId: undefined } : dialog,
        );
        return;
      }
      setSceneDialog((dialog) =>
        dialog?.clip.id === clip.id ? { ...dialog, status: 'ready', progress: 0, taskId: undefined } : dialog,
      );
      showToast({
        kind: 'error',
        title: zhCN.timeline.sceneDetectFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.sceneDetectFailedMessage,
      });
    } finally {
      unlisten?.();
    }
  }

  async function cancelCurrentSceneDetection(): Promise<void> {
    const taskId = sceneDialog?.taskId;
    if (!taskId) {
      setSceneDialog(undefined);
      return;
    }
    try {
      await cancelSceneDetection(taskId);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.sceneCancelFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.sceneDetectFailedMessage,
      });
    } finally {
      setSceneDialog((dialog) =>
        dialog?.taskId === taskId ? { ...dialog, status: 'ready', progress: 0, taskId: undefined } : dialog,
      );
    }
  }

  function applySceneDetectionResult(): void {
    const current = sceneDialog;
    if (!current || current.status === 'running') {
      return;
    }
    const filteredCuts = current.filterShortScenes
      ? filterShortSceneCuts(current.scenecuts, current.clip.duration, current.minSceneSeconds)
      : filterShortSceneCuts(current.scenecuts, current.clip.duration, 0);
    if (filteredCuts.length === 0) {
      showToast({ kind: 'info', title: zhCN.timeline.noSceneCutsTitle });
      return;
    }
    try {
      if (current.addMarkers) {
        const markers = buildSceneMarkerInputs(filteredCuts, current.clip.start, {
          idPrefix: `scene-${current.clip.id}`,
        });
        commandManager.execute(new BatchAddMarkersCommand(timelineAccessor, markers));
      }
      if (current.syncChapters) {
        const chapters = buildSceneMarkerInputs(filteredCuts, current.clip.start, {
          idPrefix: `scene-chapter-${current.clip.id}`,
        }).map((marker) => ({
          id: marker.id ?? createId('bookmark'),
          time: marker.time,
          note: marker.label,
        }));
        commandManager.execute(
          new UpdateProjectBookmarksCommand(projectAccessor, [...(project.bookmarks ?? []), ...chapters]),
        );
      }
      if (current.splitAtCuts) {
        commandManager.execute(
          new BatchSplitAtSceneCutsCommand(timelineAccessor, [
            { clipId: current.clip.id, cuts: filteredCuts, minSceneSeconds: 0 },
          ]),
        );
      }
      showToast({
        kind: 'success',
        title: zhCN.timeline.sceneSplitTitle,
        message: zhCN.timeline.sceneApplyMessage(filteredCuts.length),
      });
      setSceneDialog(undefined);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.sceneSplitFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  async function openCoverFrameGeneration(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (clip.type !== 'video' || !asset) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.coverFrameUnavailableTitle,
        message: zhCN.timeline.coverFrameUnavailableMessage,
      });
      return;
    }
    setCoverFrameDialog({ clip, frames: [], progress: 0, loading: true });
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listenCoverFrameProgress((payload) => {
        setCoverFrameDialog((current) =>
          current?.clip.id === clip.id ? { ...current, progress: payload.progress } : current,
        );
      });
      const outputDir = await getCoverFrameOutputDir(projectPath);
      const timestamps = buildEvenCoverFrameTimestamps(asset.duration || clip.duration, 6);
      const result = await extractCoverFrames({
        clipId: clip.id,
        sourcePath: asset.path,
        outputDir,
        outputStem: sanitizeCoverFileStem(`${project.name}-${clip.name}-${clip.id}`),
        mode: 'interval',
        count: 6,
        timestamps,
      });
      if (result.frames.length === 0) {
        setCoverFrameDialog({ clip, frames: [], progress: 1, loading: false, error: zhCN.timeline.coverFrameEmpty });
        return;
      }
      setCoverFrameDialog({ clip, frames: result.frames, progress: 1, loading: false });
    } catch (error) {
      setCoverFrameDialog({
        clip,
        frames: [],
        progress: 1,
        loading: false,
        error: error instanceof Error ? error.message : zhCN.timeline.coverFrameFailedMessage,
      });
    } finally {
      unlisten?.();
    }
  }

  function applyProjectCoverFrame(frame: CoverFrameResult): void {
    commandManager.execute(new UpdateProjectCoverCommand(projectAccessor, frame.path));
    setCoverFrameDialog((current) => (current ? { ...current, selectedPath: frame.path } : current));
    showToast({
      kind: 'success',
      title: zhCN.timeline.coverFrameSelectedTitle,
      message: zhCN.timeline.coverFrameSelectedMessage,
    });
  }

  async function generateSubtitles(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (
      !asset ||
      (clip.type !== 'audio' && clip.type !== 'video') ||
      !canGenerateSubtitlesForClip(clip, asset, whisperAvailability.ready)
    ) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.whisperUnavailableTitle,
        message: whisperAvailability.error ?? zhCN.whisper.notConfigured,
      });
      return;
    }

    const settings = useWhisperSettingsStore.getState();
    const currentAvailability = await getWhisperAvailability(settings);
    if (!currentAvailability.ready) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.whisperUnavailableTitle,
        message: currentAvailability.error ?? zhCN.whisper.notConfigured,
      });
      return;
    }

    setWhisperDialog({ clip, progress: 0 });
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listenBridge<WhisperProgressEvent>('whisper-progress', (payload) => {
        setWhisperDialog((current) =>
          current?.clip.id === payload.clipId ? { ...current, progress: payload.progress } : current,
        );
      });
      const track = await buildWhisperSubtitleTrackForClip(
        clip,
        asset,
        useEditorStore.getState().project.timeline,
        settings,
      );
      if (track.clips.length === 0) {
        showToast({ kind: 'warning', title: zhCN.timeline.whisperFailedTitle, message: zhCN.whisper.noSubtitleCues });
        return;
      }
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      setSelectedClipId(track.clips[0]?.id);
      showToast({
        kind: 'success',
        title: zhCN.timeline.whisperCompleteTitle,
        message: zhCN.editorToasts.subtitlesGenerated(track.clips.length),
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.whisperFailedTitle,
        message: error instanceof Error ? error.message : zhCN.whisper.noSubtitleCues,
      });
    } finally {
      unlisten?.();
      setWhisperDialog(undefined);
    }
  }

  function findSubtitleAlignmentSource(
    subtitleClips: SubtitleClip[],
  ): { clip: SubtitleAlignmentMediaClip; asset: MediaAsset } | undefined {
    const rangeStart = Math.max(
      0,
      Math.min(...subtitleClips.map((clip) => clip.start)) - SUBTITLE_ALIGNMENT_MAX_DISTANCE,
    );
    const rangeEnd =
      Math.max(...subtitleClips.map((clip) => clip.start + clip.duration)) + SUBTITLE_ALIGNMENT_MAX_DISTANCE;
    for (const clip of allClips) {
      if (
        !isSubtitleAlignmentMediaClip(clip) ||
        !timelineRangesOverlap(rangeStart, rangeEnd, clip.start, clip.start + clip.duration)
      ) {
        continue;
      }
      const asset = getClipMediaAsset(clip);
      if (asset && !asset.missing && (clip.type === 'audio' || asset.hasAudio)) {
        return { clip, asset };
      }
    }
    return undefined;
  }

  async function alignSubtitlesToWaveform(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    if (clip.type !== 'subtitle') {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.subtitleAlignmentFailedTitle,
        message: zhCN.timeline.subtitleAlignmentRequiresSubtitle,
      });
      return;
    }
    const track = project.timeline.tracks.find((item) => item.id === clip.trackId && item.type === 'subtitle');
    const subtitleClips = (track?.clips.filter((item): item is SubtitleClip => item.type === 'subtitle') ?? []).sort(
      (left, right) => left.start - right.start || left.id.localeCompare(right.id),
    );
    if (subtitleClips.length === 0) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.subtitleAlignmentFailedTitle,
        message: zhCN.timeline.subtitleAlignmentNoSubtitles,
      });
      return;
    }
    const source = findSubtitleAlignmentSource(subtitleClips);
    if (!source) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.subtitleAlignmentFailedTitle,
        message: zhCN.timeline.subtitleAlignmentNoAudioSource,
      });
      return;
    }

    try {
      const samples = await analyzeWaveform(source.asset.path, SUBTITLE_ALIGNMENT_SAMPLES_PER_SECOND);
      const peaks = buildSubtitleAlignmentPeaks(samples, SUBTITLE_ALIGNMENT_SAMPLES_PER_SECOND, source.clip);
      const projectDuration = Math.max(
        getTimelineDuration(project.timeline),
        ...subtitleClips.map((item) => item.start + item.duration),
        1 / Math.max(1, project.settings.fps),
      );
      const command = new BatchAlignSubtitleCommand(
        timelineAccessor,
        subtitleClips.map((item) => item.id),
        peaks,
        projectDuration,
        { maxDistance: SUBTITLE_ALIGNMENT_MAX_DISTANCE, minDuration: 1 / Math.max(1, project.settings.fps) },
      );
      commandManager.execute(command);
      setSelectedClipIds(command.report.updates.map((update) => update.clipId));
      setSubtitleAlignReport({
        correctedCount: command.report.correctedCount,
        averageOffsetMs: command.report.averageOffsetMs,
      });
      showToast({
        kind: 'success',
        title: zhCN.timeline.subtitleAlignmentTitle,
        message: zhCN.timeline.subtitleAlignmentReport(command.report.correctedCount, command.report.averageOffsetMs),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.subtitleAlignmentFailedTitle,
        message:
          error instanceof Error && error.message !== 'No subtitle alignment updates'
            ? error.message
            : zhCN.timeline.subtitleAlignmentNoPeaks,
      });
    }
  }

  async function ttsVoiceover(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    if (clip.type !== 'subtitle') return;
    const inputClips = collectSubtitleClipsForTts(project, clip.trackId);
    if (inputClips.length === 0) return;
    await generateTtsVoiceover(inputClips);
  }

  function handleAiReframe(clipId: string): void {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (clip.type !== 'video') {
      showToast({ kind: 'warning', title: zhCN.aiReframe.title, message: zhCN.aiReframe.videoOnlyMessage });
      return;
    }
    setReframeDialog({ clipId });
  }

  function applyAiReframe(clipId: string, aspect: TargetAspectRatio): void {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    if (!asset) return;
    const sourceWidth = asset.width || 1920;
    const sourceHeight = asset.height || 1080;
    const sampleTimes = computeSampleTimes(clip.duration, undefined, clip.scenecuts);
    const mockFrames: ReframeAIFrame[] = sampleTimes.map((time) => ({
      time,
      faceBox: null,
      subjectBox: {
        x: Math.round(sourceWidth * 0.25),
        y: Math.round(sourceHeight * 0.25),
        w: Math.round(sourceWidth * 0.5),
        h: Math.round(sourceHeight * 0.5),
      },
    }));
    const keyframes = generateReframeKeyframes(mockFrames, sourceWidth, sourceHeight, aspect);
    const smoothed = smoothKeyframes(keyframes);
    const confidence = computeReframeConfidence(mockFrames);
    const aiReframe: ClipAIReframe = { targetAspect: aspect, keyframes: smoothed, confidence, generatedAt: Date.now() };
    commandManager.execute(new UpdateClipCommand(timelineAccessor, clipId, { aiReframe }));
    setReframeDialog(undefined);
  }

  function handleAiTransitionRecommend(clipId: string): void {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (clip.type !== 'video') return;
    const track = project.timeline.tracks.find((t) => t.clips.some((c) => c.id === clipId));
    if (!track) return;
    const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);
    const idx = sortedClips.findIndex((c) => c.id === clipId);
    const adjacent = idx >= 0 && idx < sortedClips.length - 1 ? sortedClips[idx + 1] : undefined;
    if (!adjacent || adjacent.type !== 'video') return;
    const featuresA: TransitionClipFeatures = {
      colorHist: new Array(16).fill(0).map((_, i) => (i < 8 ? 0.12 : 0.02)),
      motionScore: 15,
      sceneTag: '室内',
    };
    const featuresB: TransitionClipFeatures = {
      colorHist: new Array(16).fill(0).map((_, i) => (i < 8 ? 0.02 : 0.12)),
      motionScore: 15,
      sceneTag: '户外',
    };
    const result = recommendTransition(featuresA, featuresB);
    setTransitionDialog({ clipId, adjacentClipId: adjacent.id, recommendations: result.recommended });
  }

  function applyAiTransition(clipId: string, adjacentClipId: string, transition: TransitionRecommendation): void {
    const track = project.timeline.tracks.find((t) => t.clips.some((c) => c.id === clipId));
    if (!track) return;
    const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);
    const idx = sortedClips.findIndex((c) => c.id === clipId);
    if (idx < 0 || idx >= sortedClips.length - 1) return;
    const clipA = sortedClips[idx];
    const clipB = sortedClips[idx + 1];
    if (clipB.id !== adjacentClipId) return;
    const newTransition = {
      type: transition.transitionType,
      duration: Math.min(transition.duration, clipA.duration / 2, clipB.duration / 2),
      fromClipId: clipA.id,
      toClipId: clipB.id,
    };
    commandManager.execute(new AddTransitionCommand(timelineAccessor, newTransition));
    setTransitionDialog(undefined);
  }

  function handleAnomalyDetect(clipId: string): void {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (clip.type !== 'video') return;
    const samples: FrameAnalysisSample[] = [];
    for (let t = 0; t < clip.duration; t += 1) {
      const isBlack = t >= 2 && t <= 4;
      const isStatic = t >= 8 && t <= 14;
      samples.push({ time: round(t), lumaMean: isBlack ? 3 : 100, grayscaleDiff: isStatic ? 0.5 : 15 });
    }
    samples.push({ time: round(clip.duration), lumaMean: 100, grayscaleDiff: 15 });
    const anomalies = detectAnomalies(samples);
    commandManager.execute(new UpdateClipCommand(timelineAccessor, clipId, { anomalies }));
    if (anomalies.length > 0) {
      showToast({
        kind: 'info',
        title: zhCN.anomalyDetection.title,
        message: zhCN.anomalyDetection.complete(anomalies.length),
      });
    } else {
      showToast({ kind: 'success', title: zhCN.anomalyDetection.title, message: zhCN.anomalyDetection.noAnomalies });
    }
  }

  function removeAnomaly(clipId: string, anomaly: AnomalyInterval): void {
    const clip = findClip(clipId);
    const remaining = (clip.anomalies ?? []).filter(
      (a) => !(a.startTime === anomaly.startTime && a.endTime === anomaly.endTime && a.type === anomaly.type),
    );
    if (remaining.length === (clip.anomalies ?? []).length) return;
    if (anomaly.type === 'black') {
      const splitStart = Math.max(0, anomaly.startTime - clip.start);
      const splitEnd = Math.min(clip.duration, anomaly.endTime - clip.start);
      if (splitEnd > splitStart) {
        commandManager.execute(new RippleDeleteCommand(timelineAccessor, [clipId]));
      }
      return;
    }
    commandManager.execute(new UpdateClipCommand(timelineAccessor, clipId, { anomalies: remaining }));
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

  function onTimelineDragOver(event: React.DragEvent<HTMLDivElement>): void {
    const types = Array.from(event.dataTransfer.types);
    if (types.includes(TITLE_TEMPLATE_DRAG_MIME) || types.includes('Files') || types.includes(TRANSITION_DRAG_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function onTimelineDrop(event: React.DragEvent<HTMLDivElement>): void {
    const templateId = event.dataTransfer.getData(TITLE_TEMPLATE_DRAG_MIME);
    const transitionType = event.dataTransfer.getData(TRANSITION_DRAG_MIME);
    const start = getTimelineDropStart(event, scrollRef.current, zoom);

    // 转场拖拽：在最近的相邻片段之间插入转场
    if (transitionType) {
      event.preventDefault();
      const dropTime = start ?? 0;
      const droppedTransitionType = transitionType as TransitionType;
      // 找到所有视频轨道上的片段，按时间排序
      const videoTracks = project.timeline.tracks.filter((t) => t.type === 'video');
      for (const track of videoTracks) {
        const sorted = [...track.clips].sort((a, b) => a.start - b.start);
        for (let i = 0; i < sorted.length - 1; i++) {
          const left = sorted[i];
          const right = sorted[i + 1];
          const junctionTime = left.start + left.duration;
          // 如果落点在 left-right 交界处附近（±0.5 秒内），则在此处插入转场
          if (Math.abs(junctionTime - dropTime) < 0.5) {
            try {
              commandManager.execute(
                new AddTransitionCommand(timelineAccessor, {
                  type: droppedTransitionType,
                  duration: DEFAULT_TRANSITION_DURATION,
                  fromClipId: left.id,
                  toClipId: right.id,
                }),
              );
            } catch {
              showToast({
                kind: 'warning',
                title: zhCN.timeline.transitionUnavailableTitle,
                message: zhCN.timeline.transitionUnavailableMessage,
              });
            }
            return;
          }
        }
      }
      return;
    }

    if (!isTitleTemplateId(templateId)) {
      const creditsFile = Array.from(event.dataTransfer.files).find(isCreditsTextFile);
      if (!creditsFile) {
        return;
      }
      event.preventDefault();
      void creditsFile
        .text()
        .then((text) => addCredits(text, start))
        .catch((error) => {
          showToast({
            kind: 'warning',
            title: zhCN.timeline.editRejectedTitle,
            message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
          });
        });
      return;
    }
    event.preventDefault();
    addTitleTemplate(templateId, start);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
    if (event.defaultPrevented || isEditableKeyboardTarget(event.target)) {
      return;
    }
    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey &&
      selectedClipIds.length > 0 &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      event.preventDefault();
      moveSelectedClipsByKeyboardFrame(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey &&
      (event.key === '[' || event.key === ']')
    ) {
      event.preventDefault();
      trimSelectedClipByKeyboardFrame(event.key === '[' ? 'in' : 'out');
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 't') {
      event.preventDefault();
      splitSelected();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      if (event.shiftKey) {
        ungroupSelected();
      } else {
        createGroupFromSelection();
      }
      return;
    }
    if (event.shiftKey && event.key === 'Home') {
      event.preventDefault();
      const scroll = scrollRef.current;
      const duration = Math.max(1, getTimelineDuration(project.timeline));
      setPlayheadTime(0);
      setTimelineZoom(fitTimelineZoomToWindow(duration, scroll?.clientWidth ?? 960, LABEL_WIDTH));
      requestAnimationFrame(() => {
        if (scroll) {
          scroll.scrollLeft = 0;
        }
      });
      return;
    }
    if (event.key === '=' || event.key === '+') {
      event.preventDefault();
      applyZoom(clampTimelineZoom(zoom * 1.2), (scrollRef.current?.clientWidth ?? 960) / 2);
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      applyZoom(clampTimelineZoom(zoom / 1.2), (scrollRef.current?.clientWidth ?? 960) / 2);
    }
  }

  function moveSelectedClipsByKeyboardFrame(direction: -1 | 1): void {
    const starts = buildKeyboardClipMoveStarts({
      clips: allClips,
      selectedClipIds,
      selectedClipId,
      direction,
      fps: project.settings.fps || 30,
    });
    const ids = Object.keys(starts);
    if (ids.length === 0) {
      return;
    }
    try {
      if (!canApplyProtectedMove(starts)) {
        warnProtectedRangeBlocked();
        return;
      }
      if (ids.length > 1) {
        commandManager.execute(new MoveClipsCommand(timelineAccessor, starts, protectedRanges));
        setSelectedClipIds(ids);
      } else {
        commandManager.execute(new MoveClipCommand(timelineAccessor, ids[0], starts[ids[0]], protectedRanges));
        setSelectedClipId(ids[0]);
      }
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
  }

  function trimSelectedClipByKeyboardFrame(edge: 'in' | 'out'): void {
    const clipId = selectedClipId ?? getKeyboardSelectedClipIds(selectedClipIds, selectedClipId)[0];
    const clip = clipId ? findClipById(clipId) : undefined;
    if (!clip) {
      return;
    }
    const nextTrim = buildKeyboardClipTrim({ clip, edge, fps: project.settings.fps || 30 });
    try {
      commandManager.execute(
        new TrimClipCommand(
          timelineAccessor,
          clip.id,
          nextTrim.trimStart,
          nextTrim.trimEnd,
          undefined,
          minFrameDuration(),
        ),
      );
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.editRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage,
      });
    }
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

  function buildMovedPreviewTimeline(previewStartsByClipId: Record<string, number>) {
    const movedById = new Map(
      Object.entries(previewStartsByClipId).map(([clipId, start]) => [clipId, moveClip(findClip(clipId), start)]),
    );
    return {
      ...project.timeline,
      tracks: project.timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => movedById.get(clip.id) ?? clip),
      })),
    };
  }

  function buildTrimPreview(clip: Clip, edge: 'left' | 'right', delta: number, snappingDisabled: boolean): Clip {
    const speed = getClipSpeed(clip);
    const sourceDuration = clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd;
    const minDuration = minFrameDuration();
    const minSourceDuration = calculateSpeedCurveSourceDuration(minDuration, clip.keyframes, speed);
    if (edge === 'left') {
      const sourceDelta = delta >= 0 ? calculateSpeedCurveSourceDuration(delta, clip.keyframes, speed) : delta * speed;
      const maxTrimStart = Math.max(0, sourceDuration - clip.trimEnd - minSourceDuration);
      const trimStart = round(Math.min(maxTrimStart, Math.max(0, clip.trimStart + sourceDelta)));
      const visibleSourceDuration = Math.max(0, sourceDuration - trimStart - clip.trimEnd);
      return {
        ...clip,
        trimStart,
        duration: round(
          Math.max(minDuration, calculateSpeedCurveDisplayDuration(visibleSourceDuration, clip.keyframes, speed)),
        ),
        transform: { ...clip.transform },
      } as Clip;
    }
    const proposedEnd = snapClipEnd(clip.start + Math.max(minDuration, clip.duration + delta), clip, snappingDisabled);
    const maxDuration = Math.max(
      minDuration,
      calculateSpeedCurveDisplayDuration(sourceDuration - clip.trimStart, clip.keyframes, speed),
    );
    const duration = round(Math.min(maxDuration, Math.max(minDuration, proposedEnd - clip.start)));
    const visibleSourceDuration = calculateSpeedCurveSourceDuration(duration, clip.keyframes, speed);
    return {
      ...clip,
      trimEnd: round(Math.max(0, sourceDuration - clip.trimStart - visibleSourceDuration)),
      duration,
      transform: { ...clip.transform },
    } as Clip;
  }

  function findClip(clipId: string): Clip {
    const clip = allClips.find((item) => item.id === clipId);
    if (!clip) {
      throw new Error(`Clip ${clipId} not found`);
    }
    return clip;
  }

  function getClipMediaAsset(clip: Clip) {
    if (!('mediaId' in clip)) {
      return undefined;
    }
    return project.media.find((asset) => asset.id === clip.mediaId);
  }

  function getClipMediaVersionEntries(clip?: Clip): MediaVersionEntry[] {
    if (!clip || !('mediaId' in clip)) {
      return [];
    }
    const owner = findMediaVersionOwner(project, clip.mediaId);
    if (!owner) {
      return [];
    }
    const entries = listMediaVersionEntries(owner, project.mediaMetadata[owner.id], project.media);
    return entries.length > 1 ? entries : [];
  }

  function switchClipMediaVersion(clipId: string, mediaId: string): void {
    const media = project.media.find((asset) => asset.id === mediaId);
    if (!media) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.switchMediaVersionFailedTitle,
        message: zhCN.timeline.switchMediaVersionMissingMedia,
      });
      return;
    }
    try {
      commandManager.execute(new SwitchMediaVersionCommand(timelineAccessor, clipId, media));
      setSelectedClipId(clipId);
      setClipMenu(undefined);
      showToast({
        kind: 'success',
        title: zhCN.timeline.switchMediaVersionSuccessTitle,
        message: zhCN.timeline.switchMediaVersionSuccessMessage,
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.timeline.switchMediaVersionFailedTitle,
        message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage,
      });
    }
  }

  function minFrameDuration(): number {
    return 1 / Math.max(1, project.settings.fps || 30);
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

  // Update handler refs so useTimelineState's keyboard listener can call them
  if (handlerRefs) {
    handlerRefs.current.quickAddTimelineNote = quickAddTimelineNote;
    handlerRefs.current.toggleProtectedRangeAtPlayhead = toggleProtectedRangeAtPlayhead;
    handlerRefs.current.syncScrollViewport = syncScrollViewport;
    handlerRefs.current.openSceneDetection = openSceneDetection;
  }

  return {
    addTrack,
    updateTrack,
    selectTrackHeader,
    openTrackBatchMenu,
    selectedTracksForBatch,
    applyBatchTrackPatch,
    deleteSelectedEmptyTracks,
    reorderTracks,
    updateClipColor,
    convertClipFrameRate,
    addTransition,
    removeTransition,
    addText,
    addCredits,
    addTitleTemplate,
    addTimelineMarker,
    addProjectBookmark,
    renameProjectBookmark,
    removeProjectBookmark,
    addProtectedRangeAt,
    toggleProtectedRangeAtPlayhead,
    openRulerMenu,
    runRulerMenuAction,
    jumpToRulerTimecode,
    addBeatMarker,
    openAnnotationEditorAt,
    saveAnnotationEditor,
    removeProjectAnnotation,
    openTimelineNoteEditor,
    quickAddTimelineNote,
    saveTimelineNoteEditor,
    removeTimelineNote,
    onTimelineNoteRangeDraft,
    exportTimelineNotesCsv,
    removeTimelineMarker,
    splitSelected,
    createGroupFromSelection,
    ungroupSelected,
    deleteGroup,
    updateGroupColor,
    deleteSelected,
    rippleDeleteSelected,
    onPointerMove,
    onPointerUp,
    onDragStart,
    selectClip,
    findClipById,
    canApplyProtectedMove,
    warnProtectedRangeBlocked,
    getKeyframeTime,
    buildKeyframeStartTimes,
    selectKeyframe,
    openNestedSequence,
    packClipMenuSelection,
    openReplaceMedia,
    confirmReplaceMedia,
    removeBeatMarker,
    openGapMenu,
    closeGap,
    fillGap,
    createGapFillMediaAsset,
    buildGapFillAsset,
    onTrackPointerDown,
    onAnnotationLayerPointerDown,
    openClipMenu,
    addVolumeEnvelopePoint,
    updateVolumeEnvelopePoint,
    removeVolumeEnvelopePoint,
    openVolumeEnvelopeMenu,
    applyVolumeEnvelopeFade,
    resetVolumeEnvelope,
    openSilenceDetection,
    getDialogueDetectionTarget,
    runDialogueDetection,
    generateDialogueSubtitles,
    applySilenceRemoval,
    openSceneDetection,
    startSceneDetection,
    cancelCurrentSceneDetection,
    applySceneDetectionResult,
    openCoverFrameGeneration,
    applyProjectCoverFrame,
    generateSubtitles,
    findSubtitleAlignmentSource,
    alignSubtitlesToWaveform,
    ttsVoiceover,
    handleAiReframe,
    applyAiReframe,
    handleAiTransitionRecommend,
    applyAiTransition,
    handleAnomalyDetect,
    removeAnomaly,
    onWheel,
    syncScrollViewport,
    onTimelinePointerDown,
    onTimelineDoubleClick,
    scrollTimelineFromMinimap,
    onTimelineDragOver,
    onTimelineDrop,
    onKeyDown,
    moveSelectedClipsByKeyboardFrame,
    trimSelectedClipByKeyboardFrame,
    applyZoom,
    buildMovedPreviewTimeline,
    buildTrimPreview,
    findClip,
    getClipMediaAsset,
    getClipMediaVersionEntries,
    switchClipMediaVersion,
    minFrameDuration,
    findClipIdsIntersectingRect,
    flashSnapHighlight,
    snapClipStart,
    snapClipEnd,
    snapKeyframeTime,
    buildSnapCandidates,
  };
}
