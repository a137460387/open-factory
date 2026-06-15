import {
  AddKeyframeCommand,
  AddClipCommand,
  AddCreditsClipCommand,
  AddProjectAnnotationCommand,
  AddProjectBookmarkCommand,
  AddTimelineNoteCommand,
  AddTimelineMarkerCommand,
  BatchKeyframeEditCommand,
  BatchUpdateKeyframeCommand,
  BatchUpdateTrackCommand,
  AddTrackCommand,
  AddTransitionCommand,
  CloseGapCommand,
  CLIP_GROUP_COLORS,
  CLIP_GROUP_COLOR_HEX,
  DEFAULT_PROJECT_ANNOTATION_COLOR,
  CreateClipGroupCommand,
  DeleteGroupCommand,
  DeleteClipsCommand,
  PackNestedSequenceCommand,
  PROJECT_ANNOTATION_COLORS,
  DEFAULT_TIMELINE_NOTE_COLOR,
  RemoveProjectBookmarkCommand,
  UpdateTrackCommand,
  RemoveProjectAnnotationCommand,
  RemoveTimelineNoteCommand,
  RemoveTimelineMarkerCommand,
  RemoveTransitionCommand,
  UpdateClipCommand,
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
  buildTimelineThumbnailTrackSamples,
  buildTimelineRulerTicks,
  buildTimelineGridLines,
  buildVolumeFadeKeyframes,
  clampTimelineZoom,
  DEFAULT_TIMELINE_GRID_SETTINGS,
  findTimelineSnapTargetWithGrid,
  fitTimelineZoomToWindow,
  getTimelineVirtualRenderWindow,
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
  UpdateKeyframeCommand,
  UpdateProjectProtectedRangesCommand,
  rectsIntersect,
  replaceClip,
  resolveTrackHeaderSelection,
  SplitClipCommand,
  SplitClipAtTimesCommand,
  TrimClipCommand,
  UpdateProjectBeatMarkersCommand,
  canMoveClipWithProtectedRanges,
  createId,
  createBeatMarker,
  createProtectedRange,
  createTrack,
  detectOverlap,
  getTimelineDuration,
  buildTimelineNoteLayout,
  getClipSourceVisibleDuration,
  getClipSpeed,
  getReplaceMediaCompatibilityWarnings,
  getTimelineLabelColorHex,
  isFrameRateMismatch,
  findClipGroupForClip,
  findCompleteClipGroup,
  isNestedSequenceDepthExceeded,
  instantiateTitleTemplate,
  moveSelectedTrackIds,
  moveClip,
  normalizeClipGroups,
  normalizeExportRanges,
  normalizeProtectedRanges,
  parseTimecodeToSeconds,
  round,
  secondsToTimecode,
  serializeTimelineNotesCsv,
  snapTime,
  snapTimelineTimeToGrid,
  sortTimelineThumbnailSamplesByPriority,
  volumeEnvelopeControlPointToKeyframe,
  TIMELINE_LABEL_COLORS,
  TIMELINE_NOTE_COLORS,
  type Clip,
  type ClipGroup,
  type ClipGroupColor,
  type BeatMarker,
  type KeyframeProperty,
  type MediaAsset,
  type ProjectAnnotation,
  type TimelineNote,
  type TimelineBookmark,
  type ProtectedRange,
  type SilentRange,
  type SnapEdge,
  type SelectionRect,
  type TimelineMarker,
  type TimelineSnapCandidate,
  type TimelineGridSettings,
  type TimelineLabelColor,
  type TimecodeFormat,
  type Track,
  type TrackPatch,
  type TransitionType,
  type ReplaceMediaCompatibilityWarning,
  type ReplaceMediaDurationMode
} from '@open-factory/editor-core';
import { AudioWaveform, Bookmark, Captions, Flag, Group, MessageSquarePlus, MessageSquareText, Music2, Plus, Scissors, Trash2, Type, Ungroup } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createCreditsClip, createTextClip } from '../../lib/clipFactory';
import { probeMediaPath } from '../../lib/media';
import { zhCN } from '../../i18n/strings';
import { showToast } from '../../lib/toast';
import { detectClipSilence } from '../../lib/silenceDetection';
import { canGenerateSubtitlesForClip, buildWhisperSubtitleTrackForClip, getWhisperAvailability, type WhisperAvailability } from '../../lib/whisper';
import { TITLE_TEMPLATE_DRAG_MIME, isTitleTemplateId } from '../../lib/titleTemplates';
import { detectSceneChanges, listenBridge, openFileDialog, saveFileDialog, writeFile, type WhisperProgressEvent } from '../../lib/tauri-bridge';
import { commandManager, projectAccessor, timelineAccessor } from '../../store/commandManager';
import { useEditorStore, type SelectedKeyframeRef } from '../../store/editorStore';
import { useRenderCacheStore } from '../../store/renderCacheStore';
import { useWhisperSettingsStore } from '../../store/whisperSettingsStore';
import { LABEL_WIDTH, Ruler, ThumbnailTrack, TrackRow, type ClipMenuRequest, type DragState, type GapMenuRequest, type VolumeEnvelopeMenuRequest, type VolumeEnvelopePointRequest } from './TimelineParts';
import { buildRulerContextMenuItems, type RulerContextMenuAction } from './timeline-ruler-menu';

function isCreditsTextFile(file: File): boolean {
  return /\.(txt|csv)$/i.test(file.name);
}

function getTimelineDropStart(event: React.DragEvent<HTMLDivElement>, scroll: HTMLDivElement | null, zoom: number): number | undefined {
  const rect = scroll?.getBoundingClientRect();
  return rect && scroll ? round(Math.max(0, (event.clientX - rect.left + scroll.scrollLeft - LABEL_WIDTH) / zoom)) : undefined;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName ?? ''));
}

export function Timeline({
  thumbnailTrackVisible = true,
  timelineGridSettings = DEFAULT_TIMELINE_GRID_SETTINGS,
  bookmarkPanelOpen: controlledBookmarkPanelOpen,
  onBookmarkPanelOpenChange,
  onConvertMediaFrameRate
}: {
  thumbnailTrackVisible?: boolean;
  timelineGridSettings?: TimelineGridSettings;
  bookmarkPanelOpen?: boolean;
  onBookmarkPanelOpenChange?(open: boolean): void;
  onConvertMediaFrameRate?(assetId: string): void;
}) {
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const inPoint = useEditorStore((state) => state.inPoint);
  const outPoint = useEditorStore((state) => state.outPoint);
  const timelineCompareRanges = useEditorStore((state) => state.timelineCompareRanges);
  const zoom = useEditorStore((state) => state.timelineZoom);
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
  const [drag, setDrag] = useState<DragState | undefined>();
  const [selectionRect, setSelectionRect] = useState<SelectionRect | undefined>();
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | undefined>();
  const [transitionMenu, setTransitionMenu] = useState<TransitionMenuState | undefined>();
  const [clipMenu, setClipMenu] = useState<ClipMenuState | undefined>();
  const [volumeEnvelopeMenu, setVolumeEnvelopeMenu] = useState<VolumeEnvelopeMenuState | undefined>();
  const [gapMenu, setGapMenu] = useState<GapMenuState | undefined>();
  const [rulerMenu, setRulerMenu] = useState<RulerMenuState | undefined>();
  const [silenceDialog, setSilenceDialog] = useState<SilenceDialogState | undefined>();
  const [sceneDialog, setSceneDialog] = useState<SceneDialogState | undefined>();
  const [whisperDialog, setWhisperDialog] = useState<WhisperDialogState | undefined>();
  const [replaceMediaDialog, setReplaceMediaDialog] = useState<ReplaceMediaDialogState | undefined>();
  const [whisperAvailability, setWhisperAvailability] = useState<WhisperAvailability>({ ready: false, error: zhCN.whisper.notConfigured });
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
  const [timelineColorFilter, setTimelineColorFilter] = useState<TimelineLabelColor | null>(null);
  const [envelopeEditMode, setEnvelopeEditMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [trackSelectionAnchorId, setTrackSelectionAnchorId] = useState<string | undefined>();
  const [trackBatchMenu, setTrackBatchMenu] = useState<TrackBatchMenuState | undefined>();
  const [scrollViewport, setScrollViewport] = useState({ scrollLeft: 0, viewportWidth: 960 });
  const whisperExecutablePath = useWhisperSettingsStore((state) => state.executablePath);
  const whisperModelPath = useWhisperSettingsStore((state) => state.modelPath);
  const rootRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const timelineDuration = Math.max(
    10,
    ...project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration + 2))
  );

  useEffect(() => {
    if (bookmarkPanelOpen && (project.bookmarks?.length ?? 0) > 0) {
      setAnnotationPanelOpen(false);
    }
  }, [bookmarkPanelOpen, project.bookmarks?.length]);

  function setBookmarkPanelVisible(next: boolean | ((open: boolean) => boolean)): void {
    const resolved = typeof next === 'function' ? next(bookmarkPanelOpen) : next;
    setLocalBookmarkPanelOpen(resolved);
    onBookmarkPanelOpenChange?.(resolved);
  }

  const projectDuration = getTimelineDuration(project.timeline);
  const width = Math.max(960, timelineDuration * zoom);
  const visibleStart = Math.max(0, (scrollViewport.scrollLeft - LABEL_WIDTH) / Math.max(1, zoom));
  const visibleEnd = visibleStart + scrollViewport.viewportWidth / Math.max(1, zoom);
  const timelineGridBeatTimes = useMemo(() => (project.beatMarkers ?? []).map((marker) => marker.time), [project.beatMarkers]);
  const ticks = useMemo(
    () =>
      buildTimelineRulerTicks({
        duration: timelineDuration,
        visibleStart,
        visibleEnd,
        zoom,
        viewportWidth: Math.max(1, scrollViewport.viewportWidth - LABEL_WIDTH),
        fps: project.settings.fps || 30,
        timecodeFormat: project.settings.timecodeFormat ?? 'ndf'
      }),
    [project.settings.fps, project.settings.timecodeFormat, scrollViewport.viewportWidth, timelineDuration, visibleEnd, visibleStart, zoom]
  );
  const playheadTimecode = useMemo(
    () => secondsToTimecode(playheadTime, project.settings.fps || 30, project.settings.timecodeFormat ?? 'ndf'),
    [playheadTime, project.settings.fps, project.settings.timecodeFormat]
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
      beatTimes: timelineGridBeatTimes
    });
  }, [project.settings.fps, scrollViewport.viewportWidth, timelineDuration, timelineGridBeatTimes, timelineGridSettings.enabled, timelineGridSettings.unit, visibleEnd, visibleStart, zoom]);
  const activeBeatMarkerId = useMemo(() => {
    if (!isPlaying) {
      return undefined;
    }
    const frameWindow = 1 / Math.max(1, project.settings.fps || 30);
    return (project.beatMarkers ?? []).find((marker) => Math.abs(marker.time - playheadTime) <= frameWindow * 2)?.id;
  }, [isPlaying, playheadTime, project.beatMarkers, project.settings.fps]);
  const exportRangeHighlights = useMemo(() => {
    const stored = normalizeExportRanges(project.exportRanges, projectDuration).map((range) => ({ id: range.id, start: range.start, end: range.end }));
    if (stored.length > 0) {
      return stored;
    }
    if (typeof inPoint !== 'number' || typeof outPoint !== 'number' || inPoint === outPoint) {
      return [];
    }
    return [{ id: 'current-in-out', start: Math.min(inPoint, outPoint), end: Math.max(inPoint, outPoint) }];
  }, [inPoint, outPoint, project.exportRanges, projectDuration]);
  const protectedRanges = useMemo(() => normalizeProtectedRanges(project.protectedRanges, projectDuration), [project.protectedRanges, projectDuration]);
  const timelineNotes = useMemo(() => project.timelineNotes ?? [], [project.timelineNotes]);
  const timelineNoteLayouts = useMemo(() => buildTimelineNoteLayout(timelineNotes), [timelineNotes]);
  const filteredTimelineNotes = useMemo(() => {
    const query = timelineNoteSearch.trim().toLowerCase();
    if (!query) {
      return timelineNotes;
    }
    return timelineNotes.filter((note) => note.text.toLowerCase().includes(query) || note.color.toLowerCase().includes(query));
  }, [timelineNoteSearch, timelineNotes]);
  const allClips = useMemo(() => project.timeline.tracks.flatMap((track) => track.clips), [project.timeline]);
  const clipGroups = useMemo(() => normalizeClipGroups(project.clipGroups, allClips.map((clip) => clip.id)), [allClips, project.clipGroups]);
  const clipGroupByClipId = useMemo(() => {
    const map = new Map<string, ClipGroup>();
    for (const group of clipGroups) {
      for (const clipId of group.clipIds) {
        map.set(clipId, group);
      }
    }
    return map;
  }, [clipGroups]);
  const selectedGroup = useMemo(() => findCompleteClipGroup(clipGroups, selectedClipIds), [clipGroups, selectedClipIds]);
  const orderedTrackIds = useMemo(() => project.timeline.tracks.map((track) => track.id), [project.timeline.tracks]);
  const virtualWindow = useMemo(
    () =>
      getTimelineVirtualRenderWindow({
        scrollLeft: scrollViewport.scrollLeft,
        viewportWidth: scrollViewport.viewportWidth,
        zoom,
        labelWidth: LABEL_WIDTH,
        overscanScreens: 2
      }),
    [scrollViewport.scrollLeft, scrollViewport.viewportWidth, zoom]
  );
  const thumbnailTrackSamples = useMemo(() => {
    const samples = buildTimelineThumbnailTrackSamples(project.timeline, {
      zoom,
      trackWidth: width,
      duration: timelineDuration,
      visibleStart,
      visibleEnd
    });
    return sortTimelineThumbnailSamplesByPriority(samples, playheadTime);
  }, [playheadTime, project.timeline, timelineDuration, visibleEnd, visibleStart, width, zoom]);
  const activeSequence = project.sequences.find((sequence) => sequence.id === project.activeSequenceId);
  const isMainSequence = project.activeSequenceId === 'sequence-main';

  useEffect(() => {
    const liveTrackIds = new Set(orderedTrackIds);
    setSelectedTrackIds((current) => current.filter((trackId) => liveTrackIds.has(trackId)));
    setTrackSelectionAnchorId((current) => (current && liveTrackIds.has(current) ? current : undefined));
  }, [orderedTrackIds]);

  useEffect(() => {
    let disposed = false;
    void getWhisperAvailability({ executablePath: whisperExecutablePath, modelPath: whisperModelPath }).then((availability) => {
      if (!disposed) {
        setWhisperAvailability(availability);
      }
    });
    return () => {
      disposed = true;
    };
  }, [whisperExecutablePath, whisperModelPath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a' && !isEditableKeyboardTarget(event.target)) {
        event.preventDefault();
        setSelectedTrackIds(orderedTrackIds);
        setTrackSelectionAnchorId(orderedTrackIds[0]);
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'e' && !isEditableKeyboardTarget(event.target)) {
        event.preventDefault();
        setEnvelopeEditMode((active) => !active);
        setVolumeEnvelopeMenu(undefined);
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'n' && !isEditableKeyboardTarget(event.target)) {
        event.preventDefault();
        quickAddTimelineNote();
        return;
      }
      if (event.shiftKey && event.key.toLowerCase() === 'p' && !isEditableKeyboardTarget(event.target)) {
        event.preventDefault();
        toggleProtectedRangeAtPlayhead();
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

  useEffect(() => {
    syncScrollViewport();
    window.addEventListener('resize', syncScrollViewport);
    return () => window.removeEventListener('resize', syncScrollViewport);
  }, []);

  function addTrack(type: Track['type']): void {
    commandManager.execute(
      new AddTrackCommand(timelineAccessor, createTrack({
        id: createId('track'),
        type,
        name: zhCN.timeline.newTrackName(type, project.timeline.tracks.filter((track) => track.type === type).length + 1),
        clips: []
      }))
    );
  }

  function updateTrack(trackId: string, patch: Partial<Pick<Track, 'color' | 'muted' | 'solo' | 'locked' | 'volume'>>): void {
    commandManager.execute(new UpdateTrackCommand(timelineAccessor, trackId, patch));
  }

  function selectTrackHeader(trackId: string, event: React.MouseEvent<HTMLDivElement>): void {
    const result = resolveTrackHeaderSelection({
      orderedTrackIds,
      currentSelection: selectedTrackIds,
      clickedTrackId: trackId,
      anchorTrackId: trackSelectionAnchorId,
      shiftKey: event.shiftKey
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
      y: Math.min(y, Math.max(0, window.innerHeight - 260))
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
          patches: Object.fromEntries(tracks.map((track) => [track.id, patchForTrack(track)]))
        })
      );
      setTrackBatchMenu(undefined);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage });
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
          deleteEmptyTrackIds: tracks.map((track) => track.id)
        })
      );
      setSelectedTrackIds((current) => current.filter((trackId) => project.timeline.tracks.some((track) => track.id === trackId && track.clips.length > 0)));
      setTrackBatchMenu(undefined);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage });
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
      showToast({ kind: 'warning', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage });
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
    if (!asset || asset.type !== 'video' || (!asset.variableFrameRate && !isFrameRateMismatch(asset.frameRate, project.settings.fps)) || !onConvertMediaFrameRate) {
      showToast({ kind: 'warning', title: zhCN.timeline.frameRateConvertUnavailableTitle, message: zhCN.timeline.frameRateConvertUnavailableMessage });
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
          toClipId: transitionMenu.toClipId
        })
      );
      setTransitionMenu(undefined);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.transitionUnavailableTitle, message: error instanceof Error ? error.message : zhCN.timeline.transitionUnavailableMessage });
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
      showToast({ kind: 'warning', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage });
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
        start
      });
      commandManager.execute(new AddClipCommand(timelineAccessor, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage });
    }
  }

  function addTimelineMarker(time = playheadTime): void {
    try {
      commandManager.execute(
        new AddTimelineMarkerCommand(timelineAccessor, {
          id: createId('marker'),
          time,
          label: zhCN.timeline.markerLabel((project.timeline.markers?.length ?? 0) + 1)
        })
      );
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.markerRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.addMarkerFailed });
    }
  }

function addProjectBookmark(time = playheadTime): void {
    try {
      commandManager.execute(
        new AddProjectBookmarkCommand(projectAccessor, {
          id: createId('bookmark'),
          time,
          note: zhCN.timeline.bookmarkLabel((project.bookmarks?.length ?? 0) + 1)
        })
      );
      setBookmarkPanelVisible(true);
      setAnnotationPanelOpen(false);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.bookmarkRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.addBookmarkFailed });
    }
  }

  function renameProjectBookmark(bookmarkId: string, note: string): void {
    try {
      commandManager.execute(new UpdateProjectBookmarkCommand(projectAccessor, bookmarkId, { note }));
      setBookmarkRename(undefined);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.bookmarkRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.updateBookmarkFailed });
    }
  }

  function removeProjectBookmark(bookmarkId: string): void {
    try {
      commandManager.execute(new RemoveProjectBookmarkCommand(projectAccessor, bookmarkId));
      setBookmarkRename((current) => (current?.id === bookmarkId ? undefined : current));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.bookmarkRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.removeBookmarkFailed });
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
          label: zhCN.timeline.protectedRangeLabel((project.protectedRanges?.length ?? 0) + 1)
        },
        Math.max(projectDuration, start + duration)
      );
      commandManager.execute(new UpdateProjectProtectedRangesCommand(projectAccessor, [...protectedRanges, nextRange]));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage });
    }
  }

  function toggleProtectedRangeAtPlayhead(): void {
    const existing = protectedRanges.find((range) => playheadTime >= range.start - 0.000001 && playheadTime <= range.end + 0.000001);
    if (existing) {
      commandManager.execute(new UpdateProjectProtectedRangesCommand(projectAccessor, protectedRanges.filter((range) => range.id !== existing.id)));
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
      timecode: secondsToTimecode(request.time, project.settings.fps || 30, project.settings.timecodeFormat ?? 'ndf')
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
    const parsed = parseTimecodeToSeconds(rulerMenu.timecode, { fps: project.settings.fps || 30, duration: projectDuration });
    if (!parsed.ok) {
      showToast({ kind: 'warning', title: zhCN.timeline.invalidTimecodeTitle, message: zhCN.timeline.invalidTimecodeMessage });
      return;
    }
    setPlayheadTime(parsed.value.seconds);
    setRulerMenu(undefined);
  }

  function addBeatMarker(): void {
    try {
      commandManager.execute(new UpdateProjectBeatMarkersCommand(projectAccessor, [...(project.beatMarkers ?? []), createBeatMarker(playheadTime)]));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.beatMarkerRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.addBeatMarkerFailed });
    }
  }

  function openAnnotationEditorAt(time: number, annotation?: ProjectAnnotation): void {
    setAnnotationEditor({
      id: annotation?.id,
      time: annotation?.time ?? Math.max(0, snapTime(time)),
      text: annotation?.text ?? zhCN.timeline.annotationLabel((project.annotations?.length ?? 0) + 1),
      color: annotation?.color ?? DEFAULT_PROJECT_ANNOTATION_COLOR
    });
  }

  function saveAnnotationEditor(next: AnnotationEditorState): void {
    try {
      if (next.id) {
        commandManager.execute(
          new UpdateProjectAnnotationCommand(projectAccessor, next.id, {
            time: next.time,
            text: next.text,
            color: next.color
          })
        );
      } else {
        commandManager.execute(
          new AddProjectAnnotationCommand(projectAccessor, {
            time: next.time,
            text: next.text,
            color: next.color
          })
        );
      }
      setAnnotationEditor(undefined);
      setAnnotationPanelOpen(true);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.timeline.annotationRejectedTitle,
        message: error instanceof Error ? error.message : next.id ? zhCN.timeline.updateAnnotationFailed : zhCN.timeline.addAnnotationFailed
      });
    }
  }

  function removeProjectAnnotation(annotationId: string): void {
    try {
      commandManager.execute(new RemoveProjectAnnotationCommand(projectAccessor, annotationId));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.annotationRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.removeAnnotationFailed });
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
      color: note?.color ?? DEFAULT_TIMELINE_NOTE_COLOR
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
            color: next.color
          })
        );
      } else {
        commandManager.execute(
          new AddTimelineNoteCommand(projectAccessor, {
            id: createId('timeline-note'),
            start: next.start,
            end: next.end,
            text: next.text,
            color: next.color
          })
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
        message: error instanceof Error ? error.message : next.id ? zhCN.timeline.updateTimelineNoteFailed : zhCN.timeline.addTimelineNoteFailed
      });
    }
  }

  function removeTimelineNote(noteId: string): void {
    try {
      commandManager.execute(new RemoveTimelineNoteCommand(projectAccessor, noteId));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.timelineNoteRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.removeTimelineNoteFailed });
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
      showToast({ kind: 'error', title: zhCN.timeline.timelineNoteExportFailed, message: error instanceof Error ? error.message : zhCN.timeline.timelineNoteExportFailedMessage });
    }
  }

  function removeTimelineMarker(markerId: string): void {
    try {
      commandManager.execute(new RemoveTimelineMarkerCommand(timelineAccessor, markerId));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.markerRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.removeMarkerFailed });
    }
  }

  function splitSelected(): void {
    if (!selectedClipId) {
      return;
    }
    try {
      commandManager.execute(new SplitClipCommand(timelineAccessor, selectedClipId, playheadTime));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.splitUnavailableTitle, message: error instanceof Error ? error.message : zhCN.timeline.splitUnavailableMessage });
    }
  }

  function createGroupFromSelection(): void {
    if (selectedClipIds.length < 2) {
      showToast({ kind: 'warning', title: zhCN.timeline.clipGroupCreateUnavailableTitle, message: zhCN.timeline.clipGroupCreateUnavailableMessage });
      return;
    }
    try {
      const command = new CreateClipGroupCommand(projectAccessor, selectedClipIds, {
        name: zhCN.timeline.clipGroupDefaultName(clipGroups.length + 1),
        color: CLIP_GROUP_COLORS[clipGroups.length % CLIP_GROUP_COLORS.length]
      });
      commandManager.execute(command);
      setSelectedClipIds(command.group?.clipIds ?? selectedClipIds);
      setClipMenu(undefined);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }

  function ungroupSelected(group = selectedGroup): void {
    if (!group) {
      showToast({ kind: 'warning', title: zhCN.timeline.clipGroupUngroupUnavailableTitle, message: zhCN.timeline.clipGroupUngroupUnavailableMessage });
      return;
    }
    try {
      commandManager.execute(new UngroupCommand(projectAccessor, group.id));
      setSelectedClipIds(group.clipIds);
      setClipMenu(undefined);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }

  function deleteGroup(group: ClipGroup): void {
    try {
      commandManager.execute(new DeleteGroupCommand(projectAccessor, group.id));
      clearSelectedClipIds();
      setClipMenu(undefined);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }

  function updateGroupColor(group: ClipGroup, color: ClipGroupColor): void {
    try {
      commandManager.execute(new UpdateClipGroupCommand(projectAccessor, group.id, { color }));
      setClipMenu(undefined);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
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

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (selectionStart) {
      setSelectionRect({ left: selectionStart.x, top: selectionStart.y, right: event.clientX, bottom: event.clientY });
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
      const nextTime = snapKeyframeTime(drag.clip, Math.min(drag.clip.duration, Math.max(0, drag.previewStart + delta)), event.altKey);
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
          return [[keyframeRefKey(ref), snapTime(Math.min(clip.duration, Math.max(0, startTime + previewKeyframeDelta)))]];
        })
      );
      setDrag({ ...drag, previewKeyframeTime: nextTime, previewKeyframeDelta, keyframeStartTimes, previewKeyframeTimes });
      setPlayheadTime(drag.clip.start + nextTime);
      return;
    }
    if (drag.mode === 'move') {
      const startByClipId = drag.startByClipId ?? { [drag.clip.id]: drag.clip.start };
      const draggedStart = startByClipId[drag.clip.id] ?? drag.clip.start;
      const minStart = Math.min(...Object.values(startByClipId));
      const unclampedDelta = Math.max(delta, -minStart);
      const snappedDraggedStart = snapClipStart(Math.max(0, draggedStart + unclampedDelta), drag.clip.duration, drag.clip, event.altKey);
      const snappedDelta = round(snappedDraggedStart - draggedStart);
      const previewStartsByClipId = Object.fromEntries(
        Object.entries(startByClipId).map(([clipId, start]) => [clipId, round(Math.max(0, start + snappedDelta))])
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
        previewClipsById: { [preview.id]: preview }
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
            [edit.rightClip.id]: edit.rightClip
          }
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
        previewTrimEnd: preview.trimEnd
      });
      setPreviewTimeline(replaceClip(project.timeline, preview));
      return;
    }
    const preview = buildTrimPreview(drag.clip, 'right', delta, event.altKey);
    setDrag({
      ...drag,
      previewDuration: preview.duration,
      previewTrimStart: preview.trimStart,
      previewTrimEnd: preview.trimEnd
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
        const delta = current.previewKeyframeDelta ?? round((current.previewKeyframeTime ?? current.previewStart) - current.previewStart);
        if (Math.abs(delta) > 0.000001) {
          if (keyframes.length > 1) {
            commandManager.execute(new BatchKeyframeEditCommand(timelineAccessor, keyframes, { type: 'shift', delta }));
          } else {
            commandManager.execute(
              new UpdateKeyframeCommand(timelineAccessor, current.clip.id, current.keyframeProperty, current.keyframeId, {
                time: current.previewKeyframeTime ?? current.previewStart
              })
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
            showToast({ kind: 'warning', title: zhCN.timeline.clipOverlapTitle, message: zhCN.timeline.clipOverlapMessage });
            return;
          }
          commandManager.execute(new MoveClipCommand(timelineAccessor, current.clip.id, current.previewStart, protectedRanges));
        }
      } else if (current.mode === 'rolling-trim') {
        if (!current.rightClip || Math.abs(current.previewRollingDelta ?? 0) <= 0.000001) {
          return;
        }
        commandManager.execute(
          new RollingTrimCommand(timelineAccessor, current.clip.id, current.rightClip.id, current.previewRollingDelta ?? 0, minFrameDuration())
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
        commandManager.execute(new SlideClipCommand(timelineAccessor, current.clip.id, current.previewSlideDelta ?? 0, minFrameDuration()));
      } else {
        commandManager.execute(
          new TrimClipCommand(timelineAccessor, current.clip.id, current.previewTrimStart, current.previewTrimEnd, undefined, minFrameDuration())
        );
      }
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage });
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
      clipIds.map((clipId) => [clipId, allClips.find((clip) => clip.id === clipId)?.start ?? nextDrag.clip?.start ?? 0])
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
    showToast({ kind: 'warning', title: zhCN.timeline.protectedRangeBlockedTitle, message: zhCN.timeline.protectedRangeBlockedMessage });
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
      })
    );
  }

  function selectKeyframe(keyframe: { clipId: string; property: KeyframeProperty; keyframeId: string }, additive: boolean): void {
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
      showToast({ kind: 'warning', title: zhCN.timeline.nestedSequenceDepthTitle, message: zhCN.timeline.nestedSequenceDepthMessage });
    }
  }

  function packClipMenuSelection(clipId: string): void {
    const clipIds = selectedClipIds.includes(clipId) ? selectedClipIds : [clipId];
    try {
      commandManager.execute(new PackNestedSequenceCommand(projectAccessor, clipIds, zhCN.timeline.nestedSequenceName(project.sequences.length)));
      setClipMenu(undefined);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }

  async function openReplaceMedia(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    try {
      const [path] = await openFileDialog(false, [
        { name: zhCN.fileDialogs.media, extensions: ['mp4', 'mov', 'mkv', 'webm', 'm4a', 'mp3', 'wav', 'png', 'jpg', 'jpeg', 'webp'] }
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
        warnings: getReplaceMediaCompatibilityWarnings(clip, media)
      });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.timeline.replaceMediaFailedTitle, message: error instanceof Error ? error.message : zhCN.timeline.replaceMediaChooseFailed });
    }
  }

  function confirmReplaceMedia(): void {
    if (!replaceMediaDialog) {
      return;
    }
    try {
      commandManager.execute(new ReplaceMediaCommand(timelineAccessor, replaceMediaDialog.clipId, replaceMediaDialog.media, replaceMediaDialog.durationMode));
      setSelectedClipId(replaceMediaDialog.clipId);
      setReplaceMediaDialog(undefined);
      showToast({ kind: 'success', title: zhCN.timeline.replaceMediaSuccessTitle, message: zhCN.timeline.replaceMediaSuccessMessage });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.timeline.replaceMediaFailedTitle, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }

  function removeBeatMarker(markerId: string): void {
    try {
      commandManager.execute(new UpdateProjectBeatMarkersCommand(projectAccessor, (project.beatMarkers ?? []).filter((marker) => marker.id !== markerId)));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.beatMarkerRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.removeBeatMarkerFailed });
    }
  }

  function openGapMenu(request: GapMenuRequest): void {
    setTransitionMenu(undefined);
    setClipMenu(undefined);
    setVolumeEnvelopeMenu(undefined);
    setRulerMenu(undefined);
    setGapMenu({
      ...request,
      x: Math.min(request.x, Math.max(0, window.innerWidth - 180)),
      y: Math.min(request.y, Math.max(0, window.innerHeight - 90))
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
      showToast({ kind: 'warning', title: zhCN.timeline.closeGapFailedTitle, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
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
    setSelectionRect({ left: event.clientX, top: event.clientY, right: event.clientX, bottom: event.clientY });
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
      y: Math.min(request.y, Math.max(0, window.innerHeight - 360))
    });
  }

  function addVolumeEnvelopePoint(request: VolumeEnvelopePointRequest): void {
    const clip = findClip(request.clipId);
    if (!('volume' in clip)) {
      return;
    }
    try {
      const keyframe = volumeEnvelopeControlPointToKeyframe({ time: request.time, value: request.value }, clip.duration);
      commandManager.execute(new AddKeyframeCommand(timelineAccessor, clip.id, 'volume', keyframe));
      setSelectedClipId(clip.id);
      setSelectedKeyframe({ clipId: clip.id, property: 'volume', keyframeId: keyframe.id });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.volumeEnvelopeRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage });
    }
  }

  function updateVolumeEnvelopePoint(request: Required<VolumeEnvelopePointRequest>): void {
    try {
      commandManager.execute(new UpdateKeyframeCommand(timelineAccessor, request.clipId, 'volume', request.keyframeId, { time: request.time, value: request.value }));
      setSelectedClipId(request.clipId);
      setSelectedKeyframe({ clipId: request.clipId, property: 'volume', keyframeId: request.keyframeId });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.volumeEnvelopeRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage });
    }
  }

  function removeVolumeEnvelopePoint(request: Required<Pick<VolumeEnvelopePointRequest, 'clipId' | 'keyframeId'>>): void {
    try {
      commandManager.execute(new RemoveKeyframeCommand(timelineAccessor, request.clipId, 'volume', request.keyframeId));
      setSelectedKeyframes([]);
      setSelectedClipId(request.clipId);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.volumeEnvelopeRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage });
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
      y: Math.min(request.y, Math.max(0, window.innerHeight - 170))
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
      commandManager.execute(new BatchUpdateKeyframeCommand(timelineAccessor, [{ clipId: clip.id, property: 'volume', keyframes }], zhCN.timeline.volumeEnvelopeFadeCommand));
      setSelectedClipId(clip.id);
      setSelectedKeyframes(keyframes.map((frame) => ({ clipId: clip.id, property: 'volume', keyframeId: frame.id })));
      setVolumeEnvelopeMenu(undefined);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.volumeEnvelopeRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage });
    }
  }

  function resetVolumeEnvelope(): void {
    if (!volumeEnvelopeMenu) {
      return;
    }
    try {
      commandManager.execute(new BatchUpdateKeyframeCommand(timelineAccessor, [{ clipId: volumeEnvelopeMenu.clipId, property: 'volume', keyframes: [], replace: true }], zhCN.timeline.volumeEnvelopeResetCommand));
      setSelectedKeyframes([]);
      setSelectedClipId(volumeEnvelopeMenu.clipId);
      setVolumeEnvelopeMenu(undefined);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.volumeEnvelopeRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.volumeEnvelopeRejectedMessage });
    }
  }

  function openSilenceDetection(clipId: string): void {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (!asset || (clip.type === 'video' && !asset.hasAudio) || (clip.type !== 'video' && clip.type !== 'audio')) {
      showToast({ kind: 'warning', title: zhCN.timeline.silenceUnavailableTitle, message: zhCN.timeline.silenceUnavailableMessage });
      return;
    }
    setSilenceDialog({ clip, asset });
  }

  function applySilenceRemoval(clipId: string, ranges: SilentRange[]): void {
    try {
      commandManager.execute(new RemoveSilenceCommand(timelineAccessor, clipId, ranges));
      setSilenceDialog(undefined);
      clearSelectedClipIds();
      showToast({ kind: 'success', title: zhCN.timeline.silenceRemovedTitle, message: zhCN.timeline.silenceRemovedMessage(ranges.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.silenceRemoveFailedTitle, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }

  function splitBySceneTimes(clipId: string, times: number[]): void {
    try {
      commandManager.execute(new SplitClipAtTimesCommand(timelineAccessor, clipId, times));
      showToast({ kind: 'success', title: zhCN.timeline.sceneSplitTitle, message: zhCN.timeline.sceneSplitMessage(times.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.sceneSplitFailedTitle, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
    }
  }

  async function openSceneDetection(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (clip.type !== 'video' || !asset) {
      showToast({ kind: 'warning', title: zhCN.timeline.sceneUnavailableTitle, message: zhCN.timeline.sceneUnavailableMessage });
      return;
    }
    setSceneDialog({ clip, progress: 0 });
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listenBridge<{ progress: number }>('scene-detect-progress', (payload) => {
        setSceneDialog((current) => (current?.clip.id === clip.id ? { ...current, progress: payload.progress } : current));
      });
      const speed = getClipSpeed(clip);
      const sourceStart = clip.trimStart;
      const sourceEnd = sourceStart + clip.duration * speed;
      const result = await detectSceneChanges({ path: asset.path, threshold: 0.3, duration: asset.duration || clip.duration });
      const splitTimes = result.sceneTimes
        .filter((time) => time > sourceStart + 0.000001 && time < sourceEnd - 0.000001)
        .map((time) => round((time - sourceStart) / speed));
      if (splitTimes.length === 0) {
        showToast({ kind: 'info', title: zhCN.timeline.noSceneCutsTitle });
        return;
      }
      splitBySceneTimes(clip.id, splitTimes);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.timeline.sceneDetectFailedTitle, message: error instanceof Error ? error.message : zhCN.timeline.sceneDetectFailedMessage });
    } finally {
      unlisten?.();
      setSceneDialog(undefined);
    }
  }

  async function generateSubtitles(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (!asset || (clip.type !== 'audio' && clip.type !== 'video') || !canGenerateSubtitlesForClip(clip, asset, whisperAvailability.ready)) {
      showToast({ kind: 'warning', title: zhCN.timeline.whisperUnavailableTitle, message: whisperAvailability.error ?? zhCN.whisper.notConfigured });
      return;
    }

    const settings = useWhisperSettingsStore.getState();
    const currentAvailability = await getWhisperAvailability(settings);
    if (!currentAvailability.ready) {
      showToast({ kind: 'warning', title: zhCN.timeline.whisperUnavailableTitle, message: currentAvailability.error ?? zhCN.whisper.notConfigured });
      return;
    }

    setWhisperDialog({ clip, progress: 0 });
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listenBridge<WhisperProgressEvent>('whisper-progress', (payload) => {
        setWhisperDialog((current) => (current?.clip.id === payload.clipId ? { ...current, progress: payload.progress } : current));
      });
      const track = await buildWhisperSubtitleTrackForClip(clip, asset, useEditorStore.getState().project.timeline, settings);
      if (track.clips.length === 0) {
        showToast({ kind: 'warning', title: zhCN.timeline.whisperFailedTitle, message: zhCN.whisper.noSubtitleCues });
        return;
      }
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      setSelectedClipId(track.clips[0]?.id);
      showToast({ kind: 'success', title: zhCN.timeline.whisperCompleteTitle, message: zhCN.editorToasts.subtitlesGenerated(track.clips.length) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.timeline.whisperFailedTitle, message: error instanceof Error ? error.message : zhCN.whisper.noSubtitleCues });
    } finally {
      unlisten?.();
      setWhisperDialog(undefined);
    }
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
    const scroll = scrollRef.current;
    if (!scroll) {
      return;
    }
    setScrollViewport({ scrollLeft: scroll.scrollLeft, viewportWidth: scroll.clientWidth || 960 });
  }

  function onTimelineDragOver(event: React.DragEvent<HTMLDivElement>): void {
    const types = Array.from(event.dataTransfer.types);
    if (types.includes(TITLE_TEMPLATE_DRAG_MIME) || types.includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function onTimelineDrop(event: React.DragEvent<HTMLDivElement>): void {
    const templateId = event.dataTransfer.getData(TITLE_TEMPLATE_DRAG_MIME);
    const start = getTimelineDropStart(event, scrollRef.current, zoom);
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
          showToast({ kind: 'warning', title: zhCN.timeline.editRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.editRejectedMessage });
        });
      return;
    }
    event.preventDefault();
    addTitleTemplate(templateId, start);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
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
      labelWidth: LABEL_WIDTH
    });
    const nextScrollLeft = ensurePlayheadVisible({
      scrollLeft: anchoredScrollLeft,
      viewportWidth: scroll.clientWidth,
      playheadTime,
      zoom: nextZoom,
      labelWidth: LABEL_WIDTH
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
    const movedById = new Map(Object.entries(previewStartsByClipId).map(([clipId, start]) => [clipId, moveClip(findClip(clipId), start)]));
    return {
      ...project.timeline,
      tracks: project.timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => movedById.get(clip.id) ?? clip)
      }))
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
        duration: round(Math.max(minDuration, calculateSpeedCurveDisplayDuration(visibleSourceDuration, clip.keyframes, speed))),
        transform: { ...clip.transform }
      } as Clip;
    }
    const proposedEnd = snapClipEnd(clip.start + Math.max(minDuration, clip.duration + delta), clip, snappingDisabled);
    const maxDuration = Math.max(minDuration, calculateSpeedCurveDisplayDuration(sourceDuration - clip.trimStart, clip.keyframes, speed));
    const duration = round(Math.min(maxDuration, Math.max(minDuration, proposedEnd - clip.start)));
    const visibleSourceDuration = calculateSpeedCurveSourceDuration(duration, clip.keyframes, speed);
    return {
      ...clip,
      trimEnd: round(Math.max(0, sourceDuration - clip.trimStart - visibleSourceDuration)),
      duration,
      transform: { ...clip.transform }
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
        beatTimes: timelineGridBeatTimes
      }
    });
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
        beatTimes: timelineGridBeatTimes
      }
    });
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
      beatTimes: timelineGridBeatTimes
    });
    return snapTime(Math.min(clip.duration, Math.max(0, snappedTimelineTime - clip.start)));
  }

  function buildSnapCandidates(clip: Clip): TimelineSnapCandidate[] {
    return [
      { time: 0, kind: 'timeline-start' },
      { time: playheadTime, kind: 'playhead' },
      ...(project.timeline.markers ?? []).map((marker) => ({ time: marker.time, kind: 'marker' as const })),
      ...(project.beatMarkers ?? []).map((marker) => ({ time: marker.time, kind: 'beat' as const })),
      ...project.timeline.tracks.flatMap((track) =>
        track.clips
          .filter((item) => item.id !== clip.id)
          .flatMap((item) => [
            { time: item.start, kind: 'clip-start' as const, clipId: item.id },
            { time: item.start + item.duration, kind: 'clip-end' as const, clipId: item.id }
          ])
      )
    ];
  }

  return (
    <section
      ref={rootRef}
      className="relative flex h-full min-h-0 min-w-0 max-w-full flex-col border-t border-line bg-white focus:outline-none"
      tabIndex={0}
      data-testid="timeline-root"
      data-timeline-shortcuts-root="true"
      onPointerDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (!target?.closest('button,input,textarea,select')) {
          rootRef.current?.focus();
        }
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <div className="mr-auto">
          <div className="text-sm font-semibold">{zhCN.timeline.title}</div>
          <div className="text-xs text-slate-500">{zhCN.timeline.subtitle}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500" data-testid="sequence-breadcrumb">
            {isMainSequence ? (
              <span>{zhCN.timeline.mainSequence}</span>
            ) : (
              <>
                <button className="text-brand hover:underline" type="button" data-testid="sequence-back-main" onClick={() => setActiveSequenceId('sequence-main')}>
                  {zhCN.timeline.backToMainSequence}
                </button>
                <span>/</span>
                <span className="font-medium text-slate-700">{activeSequence?.name ?? zhCN.timeline.mainSequence}</span>
              </>
            )}
          </div>
        </div>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.addVideoTrack} data-testid="add-video-track-button" onClick={() => addTrack('video')}>
          <Plus size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.addAudioTrack} data-testid="add-audio-track-button" onClick={() => addTrack('audio')}>
          <Plus size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.addSubtitleTrack} data-testid="add-subtitle-track-button" onClick={() => addTrack('subtitle')}>
          <Captions size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.addTextClip} data-testid="add-text-clip-button" onClick={addText}>
          <Type size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.addCreditsClip} data-testid="add-credits-clip-button" onClick={() => addCredits()}>
          <Captions size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.addMarker} data-testid="add-timeline-marker-button" onClick={() => addTimelineMarker()}>
          <Flag size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.addBookmark} data-testid="add-timeline-bookmark-button" onClick={() => addProjectBookmark()}>
          <Bookmark size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.addBeatMarker} data-testid="add-beat-marker-button" onClick={addBeatMarker}>
          <Music2 size={16} />
        </button>
        <button
          className={`rounded-md border p-2 hover:bg-panel ${bookmarkPanelOpen ? 'border-brand text-brand' : 'border-line'}`}
          title={zhCN.timeline.bookmarkList}
          aria-pressed={bookmarkPanelOpen}
          data-testid="toggle-bookmark-panel-button"
          onClick={() => {
            setBookmarkPanelVisible((open) => !open);
            setAnnotationPanelOpen(false);
          }}
        >
          <Bookmark size={16} />
        </button>
        <button
          className={`rounded-md border p-2 hover:bg-panel ${annotationMode ? 'border-brand bg-brand text-white' : 'border-line'}`}
          title={zhCN.timeline.annotationMode}
          aria-pressed={annotationMode}
          data-testid="toggle-annotation-mode-button"
          onClick={() => {
            setAnnotationMode((active) => !active);
            setAnnotationPanelOpen(true);
            setBookmarkPanelVisible(false);
          }}
        >
          <MessageSquarePlus size={16} />
        </button>
        <button
          className={`rounded-md border p-2 hover:bg-panel ${annotationPanelOpen ? 'border-brand text-brand' : 'border-line'}`}
          title={zhCN.timeline.annotationList}
          aria-pressed={annotationPanelOpen}
          data-testid="toggle-annotation-panel-button"
          onClick={() => {
            setAnnotationPanelOpen((open) => !open);
            setBookmarkPanelVisible(false);
          }}
        >
          <MessageSquareText size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.timelineNoteQuickAdd} data-testid="add-timeline-note-button" onClick={quickAddTimelineNote}>
          <MessageSquarePlus size={16} />
        </button>
        <button
          className={`rounded-md border p-2 hover:bg-panel ${timelineNotePanelOpen ? 'border-brand text-brand' : 'border-line'}`}
          title={zhCN.timeline.timelineNoteList}
          aria-pressed={timelineNotePanelOpen}
          data-testid="toggle-timeline-note-panel-button"
          onClick={() => {
            setTimelineNotePanelOpen((open) => !open);
            setAnnotationPanelOpen(false);
            setBookmarkPanelVisible(false);
          }}
        >
          <MessageSquareText size={16} />
        </button>
        <button
          className={`rounded-md border p-2 hover:bg-panel ${envelopeEditMode ? 'border-brand bg-brand text-white' : 'border-line'}`}
          title={envelopeEditMode ? zhCN.timeline.envelopeEditModeActive : zhCN.timeline.envelopeEditMode}
          aria-pressed={envelopeEditMode}
          data-testid="toggle-envelope-edit-mode-button"
          onClick={() => {
            setEnvelopeEditMode((active) => !active);
            setVolumeEnvelopeMenu(undefined);
          }}
        >
          <AudioWaveform size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.splitSelectedClip} onClick={splitSelected}>
          <Scissors size={16} />
        </button>
        <button
          className="rounded-md border border-line p-2 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
          title={zhCN.timeline.clipGroupCreate}
          disabled={selectedClipIds.length < 2}
          data-testid="timeline-create-group-button"
          onClick={createGroupFromSelection}
        >
          <Group size={16} />
        </button>
        <button
          className="rounded-md border border-line p-2 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
          title={zhCN.timeline.clipGroupUngroup}
          disabled={!selectedGroup}
          data-testid="timeline-ungroup-button"
          onClick={() => ungroupSelected()}
        >
          <Ungroup size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.deleteSelectedClip} onClick={deleteSelected}>
          <Trash2 size={16} />
        </button>
        <input
          className="w-28 accent-brand"
          title={zhCN.timeline.zoom}
          type="range"
          min={8}
          max={1600}
          value={zoom}
          onChange={(event) => setTimelineZoom(Number(event.target.value))}
          data-testid="timeline-zoom-slider"
        />
        <div className="ml-1 flex items-center gap-1 border-l border-line pl-2" data-testid="timeline-color-filter-bar">
          <span className="text-[11px] font-medium text-slate-500">{zhCN.timeline.timelineColorFilter}</span>
          <button
            className={`rounded border px-2 py-1 text-[11px] font-medium ${timelineColorFilter === null ? 'border-brand text-brand' : 'border-line text-slate-600 hover:bg-panel'}`}
            type="button"
            data-testid="timeline-color-filter-all"
            onClick={() => setTimelineColorFilter(null)}
          >
            {zhCN.timeline.timelineColorFilterAll}
          </button>
          {TIMELINE_LABEL_COLORS.map((color) => (
            <button
              key={color}
              className={`h-5 w-5 rounded-full border ${timelineColorFilter === color ? 'border-slate-900 ring-2 ring-slate-300' : 'border-white'}`}
              style={{ backgroundColor: getTimelineLabelColorHex(color) }}
              type="button"
              title={zhCN.timeline.timelineLabelColorNames[color]}
              aria-label={zhCN.timeline.timelineLabelColorNames[color]}
              data-testid={`timeline-color-filter-${color}`}
              onClick={() => setTimelineColorFilter((current) => (current === color ? null : color))}
            />
          ))}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="timeline-scrollbar min-h-0 min-w-0 max-w-full flex-1 overflow-auto"
        onWheel={onWheel}
        onScroll={syncScrollViewport}
        onDragOver={onTimelineDragOver}
        onDrop={onTimelineDrop}
        data-testid="timeline-scroll-container"
      >
        <div className="relative" style={{ width: LABEL_WIDTH + width }}>
          <Ruler
            ticks={ticks}
            zoom={zoom}
            width={width}
            currentTimecode={playheadTimecode}
            cachedRanges={renderCacheRanges}
            diffRanges={timelineCompareRanges}
            exportRanges={exportRangeHighlights}
            protectedRanges={protectedRanges}
            onSeek={setPlayheadTime}
            onContextMenu={openRulerMenu}
          />
          <TimelineNoteLayer
            width={width}
            zoom={zoom}
            notes={timelineNoteLayouts}
            draft={timelineNoteDraft}
            onDraftChange={setTimelineNoteDraft}
            onCreateRange={onTimelineNoteRangeDraft}
            onSeek={setPlayheadTime}
            onEdit={(note) => openTimelineNoteEditor(note.start, note.end, note)}
          />
          {thumbnailTrackVisible ? <ThumbnailTrack samples={thumbnailTrackSamples} media={project.media} zoom={zoom} width={width} /> : null}
          <div className="relative">
            {gridLines.map((line) => (
              <div
                key={`${line.time}-${line.major ? 'major' : 'minor'}`}
                className={line.major ? 'pointer-events-none absolute bottom-0 top-0 z-[1] border-l border-slate-300/80' : 'pointer-events-none absolute bottom-0 top-0 z-[1] border-l border-slate-200/70'}
                style={{ left: LABEL_WIDTH + line.time * zoom }}
                data-testid="timeline-grid-line"
                data-grid-major={line.major ? 'true' : 'false'}
              />
            ))}
            {project.timeline.tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                zoom={zoom}
                selectedClipId={selectedClipId}
                selectedClipIds={selectedClipIds}
                selectedKeyframe={selectedKeyframe}
                selectedKeyframes={selectedKeyframes}
                selectedTrackIds={selectedTrackIds}
                drag={drag}
                media={project.media}
                onSelect={selectClip}
                onKeyframeSelect={selectKeyframe}
                onDragStart={onDragStart}
                onTrackPointerDown={onTrackPointerDown}
                onTrackUpdate={updateTrack}
                onTrackHeaderClick={selectTrackHeader}
                onTrackBatchMenu={openTrackBatchMenu}
                onTrackReorder={reorderTracks}
                transitions={project.timeline.transitions ?? []}
                onTransitionMenu={(request) =>
                  {
                    setGapMenu(undefined);
                    setClipMenu(undefined);
                    setVolumeEnvelopeMenu(undefined);
                    setRulerMenu(undefined);
                    setTransitionMenu({
                      ...request,
                      x: Math.min(request.x, Math.max(0, window.innerWidth - 230)),
                      y: Math.min(request.y, Math.max(0, window.innerHeight - 180)),
                      type: request.existingType ?? 'dissolve',
                      duration: request.existingDuration ?? 0.5
                    });
                  }
                }
                onGapMenu={openGapMenu}
                onClipMenu={openClipMenu}
                onVolumeEnvelopeAdd={addVolumeEnvelopePoint}
                onVolumeEnvelopeUpdate={updateVolumeEnvelopePoint}
                onVolumeEnvelopeRemove={removeVolumeEnvelopePoint}
                onVolumeEnvelopeMenu={openVolumeEnvelopeMenu}
                onClipDoubleClick={openNestedSequence}
                virtualWindow={virtualWindow}
                rollingTrimActive={rollingTrimActive}
                slipEditActive={slipEditActive}
                slideEditActive={slideEditActive}
                clipGroupByClipId={clipGroupByClipId}
                colorFilter={timelineColorFilter}
                projectFrameRate={project.settings.fps}
                envelopeEditMode={envelopeEditMode}
              />
            ))}
            {protectedRanges.map((range) => (
              <div
                key={range.id}
                className="pointer-events-none absolute bottom-0 top-0 z-[8] bg-rose-500/20 outline outline-1 outline-rose-500/50"
                style={{ left: LABEL_WIDTH + range.start * zoom, width: Math.max(2, (range.end - range.start) * zoom) }}
                title={range.label}
                data-testid="timeline-protected-range"
                data-range-id={range.id}
              />
            ))}
            {annotationMode ? (
              <div
                className="absolute bottom-0 top-0 z-30 cursor-crosshair bg-transparent"
                style={{ left: LABEL_WIDTH, width }}
                data-testid="timeline-annotation-click-layer"
                onPointerDown={onAnnotationLayerPointerDown}
              />
            ) : null}
            {(project.annotations ?? []).map((annotation, index) => (
              <AnnotationBubble
                key={annotation.id}
                annotation={annotation}
                index={index}
                left={LABEL_WIDTH + annotation.time * zoom}
                onSeek={setPlayheadTime}
                onEdit={openAnnotationEditorAt}
              />
            ))}
            {(project.timeline.markers ?? []).map((marker) => (
              <TimelineMarkerOverlay
                key={marker.id}
                marker={marker}
                left={LABEL_WIDTH + marker.time * zoom}
                onSeek={setPlayheadTime}
                onRemove={removeTimelineMarker}
              />
            ))}
            {(project.bookmarks ?? []).map((bookmark) => (
              <TimelineBookmarkOverlay key={bookmark.id} bookmark={bookmark} left={LABEL_WIDTH + bookmark.time * zoom} onSeek={setPlayheadTime} onRemove={removeProjectBookmark} />
            ))}
            {(project.beatMarkers ?? []).map((marker) => (
              <BeatMarkerOverlay
                key={marker.id}
                marker={marker}
                left={LABEL_WIDTH + marker.time * zoom}
                active={activeBeatMarkerId === marker.id}
                onSeek={setPlayheadTime}
                onRemove={removeBeatMarker}
              />
            ))}
            {transitionMenu ? (
              <TransitionMenu
                menu={transitionMenu}
                onChange={setTransitionMenu}
                onAdd={addTransition}
                onRemove={transitionMenu.existingTransitionId ? removeTransition : undefined}
                onClose={() => setTransitionMenu(undefined)}
              />
            ) : null}
            {rulerMenu ? (
              <RulerContextMenu
                menu={rulerMenu}
                onChange={setRulerMenu}
                onAction={runRulerMenuAction}
                onJump={jumpToRulerTimecode}
                onClose={() => setRulerMenu(undefined)}
              />
            ) : null}
            {gapMenu ? <GapActionMenu menu={gapMenu} onClose={() => setGapMenu(undefined)} onCloseGap={closeGap} /> : null}
            {volumeEnvelopeMenu ? <VolumeEnvelopeMenu menu={volumeEnvelopeMenu} onFade={applyVolumeEnvelopeFade} onReset={resetVolumeEnvelope} onClose={() => setVolumeEnvelopeMenu(undefined)} /> : null}
            {clipMenu ? (
              <ClipActionMenu
                menu={clipMenu}
                clip={allClips.find((clip) => clip.id === clipMenu.clipId)}
                asset={allClips.find((clip) => clip.id === clipMenu.clipId) ? getClipMediaAsset(allClips.find((clip) => clip.id === clipMenu.clipId)!) : undefined}
                group={clipGroupByClipId.get(clipMenu.clipId)}
                projectFrameRate={project.settings.fps}
                canCreateGroup={selectedClipIds.length >= 2}
                whisperReady={whisperAvailability.ready}
                whisperUnavailableMessage={whisperAvailability.error}
                onSilence={() => openSilenceDetection(clipMenu.clipId)}
                onScene={() => void openSceneDetection(clipMenu.clipId)}
                onGenerateSubtitles={() => void generateSubtitles(clipMenu.clipId)}
                onReplaceMedia={() => void openReplaceMedia(clipMenu.clipId)}
                onConvertFrameRate={() => convertClipFrameRate(clipMenu.clipId)}
                onPack={() => packClipMenuSelection(clipMenu.clipId)}
                onCreateGroup={createGroupFromSelection}
                onUngroup={(group) => ungroupSelected(group)}
                onDeleteGroup={deleteGroup}
                onGroupColor={updateGroupColor}
                onClipColor={updateClipColor}
                onClose={() => setClipMenu(undefined)}
              />
            ) : null}
            {trackBatchMenu ? (
              <TrackBatchMenu
                menu={trackBatchMenu}
                selectedTracks={selectedTracksForBatch()}
                onPatch={applyBatchTrackPatch}
                onDeleteEmpty={deleteSelectedEmptyTracks}
                onClose={() => setTrackBatchMenu(undefined)}
              />
            ) : null}
            {selectionRect ? <SelectionMarquee rect={selectionRect} /> : null}
            {typeof inPoint === 'number' ? (
        <div
                className="absolute bottom-0 top-0 z-10 w-0.5 bg-emerald-500"
                style={{ left: LABEL_WIDTH + inPoint * zoom }}
                title={zhCN.timeline.inPoint}
                data-testid="timeline-in-point-marker"
              />
            ) : null}
            {typeof outPoint === 'number' ? (
              <div
                className="absolute bottom-0 top-0 z-10 w-0.5 bg-amber-500"
                style={{ left: LABEL_WIDTH + outPoint * zoom }}
                title={zhCN.timeline.outPoint}
                data-testid="timeline-out-point-marker"
              />
            ) : null}
            <div
              className="absolute bottom-0 top-0 z-20 w-0.5 bg-coral"
              style={{ left: LABEL_WIDTH + playheadTime * zoom }}
              data-testid="timeline-playhead"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrag({ mode: 'playhead', startX: event.clientX, previewStart: playheadTime, previewDuration: 0, previewTrimStart: 0, previewTrimEnd: 0 });
              }}
            />
          </div>
        </div>
      </div>
      {silenceDialog ? (
        <SilenceDetectionDialog
          clip={silenceDialog.clip}
          asset={silenceDialog.asset}
          onClose={() => setSilenceDialog(undefined)}
          onApply={(ranges) => applySilenceRemoval(silenceDialog.clip.id, ranges)}
        />
      ) : null}
      {sceneDialog ? <SceneDetectionDialog progress={sceneDialog.progress} /> : null}
      {whisperDialog ? <WhisperGenerationDialog progress={whisperDialog.progress} clipName={whisperDialog.clip.name} /> : null}
      {replaceMediaDialog ? (
        <ReplaceMediaDialog
          value={replaceMediaDialog}
          onChange={setReplaceMediaDialog}
          onCancel={() => setReplaceMediaDialog(undefined)}
          onConfirm={confirmReplaceMedia}
        />
      ) : null}
      {annotationPanelOpen && (annotationMode || (project.annotations?.length ?? 0) > 0) ? (
        <AnnotationListPanel
          annotations={project.annotations ?? []}
          onSeek={setPlayheadTime}
          onEdit={(annotation) => openAnnotationEditorAt(annotation.time, annotation)}
          onRemove={removeProjectAnnotation}
        />
      ) : null}
      {bookmarkPanelOpen && (project.bookmarks?.length ?? 0) > 0 ? (
        <BookmarkListPanel
          bookmarks={project.bookmarks ?? []}
          editing={bookmarkRename}
          onSeek={setPlayheadTime}
          onBeginRename={(bookmark) => setBookmarkRename({ id: bookmark.id, note: bookmark.note })}
          onChangeRename={setBookmarkRename}
          onSaveRename={renameProjectBookmark}
          onCancelRename={() => setBookmarkRename(undefined)}
          onRemove={removeProjectBookmark}
        />
      ) : null}
      {timelineNotePanelOpen ? (
        <TimelineNoteListPanel
          notes={filteredTimelineNotes}
          search={timelineNoteSearch}
          fps={project.settings.fps || 30}
          timecodeFormat={project.settings.timecodeFormat ?? 'ndf'}
          onSearch={setTimelineNoteSearch}
          onSeek={setPlayheadTime}
          onEdit={(note) => openTimelineNoteEditor(note.start, note.end, note)}
          onRemove={removeTimelineNote}
          onExportCsv={() => void exportTimelineNotesCsv()}
        />
      ) : null}
      {annotationEditor ? (
        <AnnotationEditorDialog
          value={annotationEditor}
          onChange={setAnnotationEditor}
          onCancel={() => setAnnotationEditor(undefined)}
          onSave={saveAnnotationEditor}
        />
      ) : null}
      {timelineNoteEditor ? (
        <TimelineNoteEditorDialog
          value={timelineNoteEditor}
          onChange={setTimelineNoteEditor}
          onCancel={() => setTimelineNoteEditor(undefined)}
          onSave={saveTimelineNoteEditor}
        />
      ) : null}
    </section>
  );
}

interface TransitionMenuState {
  x: number;
  y: number;
  fromClipId: string;
  toClipId: string;
  existingTransitionId?: string;
  existingType?: TransitionType;
  existingDuration?: number;
  type: TransitionType;
  duration: number;
}

interface ClipMenuState {
  x: number;
  y: number;
  clipId: string;
  clipType: Clip['type'];
}

interface VolumeEnvelopeMenuState {
  x: number;
  y: number;
  clipId: string;
}

interface ReplaceMediaDialogState {
  clipId: string;
  media: MediaAsset;
  durationMode: ReplaceMediaDurationMode;
  warnings: ReplaceMediaCompatibilityWarning[];
}

interface GapMenuState {
  x: number;
  y: number;
  trackId: string;
  time: number;
}

interface RulerMenuState {
  x: number;
  y: number;
  time: number;
  timecode: string;
}

interface TrackBatchMenuState {
  x: number;
  y: number;
  trackId: string;
}

interface SilenceDialogState {
  clip: Clip;
  asset: MediaAsset;
}

interface SceneDialogState {
  clip: Clip;
  progress: number;
}

interface WhisperDialogState {
  clip: Clip;
  progress: number;
}

interface AnnotationEditorState {
  id?: string;
  time: number;
  text: string;
  color: string;
}

interface TimelineNoteEditorState {
  id?: string;
  start: number;
  end: number;
  text: string;
  color: string;
}

interface TimelineNoteDraftState {
  start: number;
  end: number;
  anchor: number;
}

interface BookmarkRenameState {
  id: string;
  note: string;
}

function TrackBatchMenu({
  menu,
  selectedTracks,
  onPatch,
  onDeleteEmpty,
  onClose
}: {
  menu: TrackBatchMenuState;
  selectedTracks: Track[];
  onPatch(patchForTrack: (track: Track) => TrackPatch): void;
  onDeleteEmpty(): void;
  onClose(): void;
}) {
  const disabled = selectedTracks.length === 0;
  const hasEmptyTrack = selectedTracks.some((track) => track.clips.length === 0);
  return (
    <div
      className="fixed z-50 w-[220px] rounded-md border border-line bg-white p-2 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="track-batch-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 px-2 text-[11px] font-semibold text-slate-500">{zhCN.timeline.trackBatchSelectedCount(selectedTracks.length)}</div>
      <div className="grid grid-cols-2 gap-1">
        <button className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40" type="button" data-testid="track-batch-mute" disabled={disabled} onClick={() => onPatch(() => ({ muted: true }))}>
          {zhCN.timeline.trackBatchMute}
        </button>
        <button className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40" type="button" data-testid="track-batch-unmute" disabled={disabled} onClick={() => onPatch(() => ({ muted: false }))}>
          {zhCN.timeline.trackBatchUnmute}
        </button>
        <button className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40" type="button" data-testid="track-batch-solo" disabled={disabled} onClick={() => onPatch(() => ({ solo: true }))}>
          {zhCN.timeline.trackBatchSolo}
        </button>
        <button className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40" type="button" data-testid="track-batch-unsolo" disabled={disabled} onClick={() => onPatch(() => ({ solo: false }))}>
          {zhCN.timeline.trackBatchUnsolo}
        </button>
        <button className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40" type="button" data-testid="track-batch-lock" disabled={disabled} onClick={() => onPatch(() => ({ locked: true }))}>
          {zhCN.timeline.trackBatchLock}
        </button>
        <button className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40" type="button" data-testid="track-batch-unlock" disabled={disabled} onClick={() => onPatch(() => ({ locked: false }))}>
          {zhCN.timeline.trackBatchUnlock}
        </button>
      </div>
      <button
        className="mt-1 block w-full rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        data-testid="track-batch-delete-empty"
        disabled={disabled || !hasEmptyTrack}
        onClick={onDeleteEmpty}
      >
        {zhCN.timeline.trackBatchDeleteEmpty}
      </button>
      <div className="mt-2 border-t border-line pt-2">
        <div className="mb-1 px-2 text-[11px] font-semibold text-slate-500">{zhCN.timeline.trackBatchSetColor}</div>
        <div className="grid grid-cols-6 gap-1 px-2">
          {TIMELINE_LABEL_COLORS.map((color) => (
            <button
              key={color}
              className="h-5 w-5 rounded-full border border-white ring-1 ring-slate-200 hover:ring-slate-500 disabled:opacity-40"
              style={{ backgroundColor: getTimelineLabelColorHex(color) }}
              type="button"
              title={zhCN.timeline.timelineLabelColorNames[color]}
              aria-label={zhCN.timeline.timelineLabelColorNames[color]}
              data-testid={`track-batch-color-${color}`}
              disabled={disabled}
              onClick={() => onPatch(() => ({ color }))}
            />
          ))}
        </div>
        <button className="mt-2 block w-full rounded px-2 py-1.5 text-left text-slate-500 hover:bg-panel disabled:opacity-40" type="button" data-testid="track-batch-color-default" disabled={disabled} onClick={() => onPatch(() => ({ color: null }))}>
          {zhCN.timeline.defaultLabelColor}
        </button>
      </div>
      <button className="mt-1 block w-full rounded px-2 py-1.5 text-left text-slate-500 hover:bg-panel" type="button" onClick={onClose}>
        {zhCN.timeline.close}
      </button>
    </div>
  );
}

function TimelineNoteLayer({
  width,
  zoom,
  notes,
  draft,
  onDraftChange,
  onCreateRange,
  onSeek,
  onEdit
}: {
  width: number;
  zoom: number;
  notes: ReturnType<typeof buildTimelineNoteLayout>;
  draft?: TimelineNoteDraftState;
  onDraftChange(draft?: TimelineNoteDraftState): void;
  onCreateRange(start: number, end: number): void;
  onSeek(time: number): void;
  onEdit(note: TimelineNote): void;
}) {
  const createdOrder = useMemo(
    () =>
      new Map(
        [...notes]
          .sort((left, right) => left.note.createdAt.localeCompare(right.note.createdAt) || left.note.id.localeCompare(right.note.id))
          .map((layout, index) => [layout.note.id, index + 1])
      ),
    [notes]
  );

  function timeFromPointer(event: React.PointerEvent<HTMLDivElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.max(0, snapTime((event.clientX - rect.left) / zoom));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = timeFromPointer(event);
    onDraftChange({ start, end: start, anchor: start });
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (!draft) {
      return;
    }
    const time = timeFromPointer(event);
    onDraftChange({ ...draft, start: Math.min(draft.anchor, time), end: Math.max(draft.anchor, time) });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    if (!draft) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    const time = timeFromPointer(event);
    const start = Math.min(draft.anchor, time);
    const end = Math.max(draft.anchor, time);
    onDraftChange(undefined);
    onCreateRange(start, end > start ? end : start + 1);
  }

  return (
    <div className="flex h-6 border-b border-line bg-slate-50/80" data-testid="timeline-note-row" style={{ width: LABEL_WIDTH + width }}>
      <div className="flex h-6 shrink-0 items-center border-r border-line px-2 text-[11px] font-semibold text-slate-500" style={{ width: LABEL_WIDTH }}>
        {zhCN.timeline.timelineNoteLayer}
      </div>
      <div
        className="relative h-6 cursor-crosshair overflow-hidden"
        style={{ width }}
        data-testid="timeline-note-layer"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {notes.map((layout) => {
          const left = layout.note.start * zoom;
          const noteWidth = Math.max(8, (layout.note.end - layout.note.start) * zoom);
          return (
            <button
              key={layout.note.id}
              className={`absolute top-[3px] h-[18px] overflow-hidden rounded-[3px] border border-white/80 px-1 text-left text-[10px] font-semibold text-slate-900 shadow-sm ${layout.overlaps ? 'ring-1 ring-slate-900/20' : ''}`}
              style={{ left, width: noteWidth, backgroundColor: layout.note.color, zIndex: createdOrder.get(layout.note.id) ?? 1 }}
              type="button"
              title={`${layout.note.text} (${layout.note.start.toFixed(2)}s - ${layout.note.end.toFixed(2)}s)`}
              data-testid={`timeline-note-block-${layout.note.id}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSeek(layout.note.start);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onEdit(layout.note);
              }}
            >
              <span className="block truncate pointer-events-none">{layout.note.text}</span>
            </button>
          );
        })}
        {draft ? (
          <div
            className="pointer-events-none absolute top-[3px] h-[18px] rounded-[3px] border border-dashed border-slate-700 bg-slate-300/60"
            style={{ left: draft.start * zoom, width: Math.max(8, (draft.end - draft.start) * zoom) }}
            data-testid="timeline-note-draft"
          />
        ) : null}
      </div>
    </div>
  );
}

function TimelineNoteListPanel({
  notes,
  search,
  fps,
  timecodeFormat,
  onSearch,
  onSeek,
  onEdit,
  onRemove,
  onExportCsv
}: {
  notes: TimelineNote[];
  search: string;
  fps: number;
  timecodeFormat: TimecodeFormat;
  onSearch(value: string): void;
  onSeek(time: number): void;
  onEdit(note: TimelineNote): void;
  onRemove(noteId: string): void;
  onExportCsv(): void;
}) {
  return (
    <aside className="absolute bottom-3 right-3 top-16 z-50 flex w-80 flex-col overflow-hidden rounded-md border border-line bg-white shadow-soft" data-testid="timeline-note-panel">
      <div className="border-b border-line px-3 py-2">
        <div className="text-sm font-semibold text-ink">{zhCN.timeline.timelineNoteList}</div>
        <div className="mt-2 flex gap-2">
          <input
            className="h-8 min-w-0 flex-1 rounded border border-line bg-white px-2 text-xs text-ink"
            value={search}
            placeholder={zhCN.timeline.timelineNoteSearchPlaceholder}
            data-testid="timeline-note-search"
            onChange={(event) => onSearch(event.target.value)}
          />
          <button className="rounded border border-line bg-white px-2 text-xs font-medium hover:bg-panel" type="button" data-testid="timeline-note-export-csv" onClick={onExportCsv}>
            {zhCN.timeline.timelineNoteExportCsv}
          </button>
        </div>
      </div>
      {notes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-3 py-6 text-sm text-slate-500" data-testid="timeline-note-list-empty">
          {zhCN.timeline.timelineNoteListEmpty}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {notes.map((note) => (
            <div key={note.id} className="mb-2 rounded-md border border-line bg-panel p-2 text-xs" data-testid={`timeline-note-list-row-${note.id}`}>
              <button
                className="flex w-full items-start gap-2 rounded text-left hover:bg-white"
                type="button"
                data-testid={`timeline-note-list-item-${note.id}`}
                onClick={() => onSeek(note.start)}
                onDoubleClick={() => onEdit(note)}
              >
                <span className="mt-1 h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: note.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{note.text}</span>
                  <span className="mt-0.5 block tabular-nums text-slate-500">
                    {secondsToTimecode(note.start, fps, timecodeFormat)} - {secondsToTimecode(note.end, fps, timecodeFormat)}
                  </span>
                </span>
              </button>
              <div className="mt-2 flex justify-end gap-2">
                <button className="rounded border border-line bg-white px-2 py-1 hover:bg-panel" type="button" data-testid={`timeline-note-edit-${note.id}`} onClick={() => onEdit(note)}>
                  {zhCN.timeline.timelineNoteEditTitle}
                </button>
                <button className="rounded border border-rose-200 bg-white px-2 py-1 text-rose-700 hover:bg-rose-50" type="button" data-testid={`timeline-note-delete-${note.id}`} onClick={() => onRemove(note.id)}>
                  {zhCN.timeline.timelineNoteDelete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function AnnotationBubble({
  annotation,
  index,
  left,
  onSeek,
  onEdit
}: {
  annotation: ProjectAnnotation;
  index: number;
  left: number;
  onSeek(time: number): void;
  onEdit(time: number, annotation: ProjectAnnotation): void;
}) {
  return (
    <button
      className="absolute top-2 z-40 flex max-w-[180px] -translate-x-3 items-center gap-1 rounded-full border border-white bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-soft hover:border-line"
      style={{ left }}
      type="button"
      title={`${annotation.text} (${annotation.time.toFixed(2)}s)`}
      data-testid={`timeline-annotation-${annotation.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSeek(annotation.time);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEdit(annotation.time, annotation);
      }}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: annotation.color }} />
      <span className="truncate">{annotation.text || zhCN.timeline.annotationLabel(index + 1)}</span>
    </button>
  );
}

function AnnotationListPanel({
  annotations,
  onSeek,
  onEdit,
  onRemove
}: {
  annotations: ProjectAnnotation[];
  onSeek(time: number): void;
  onEdit(annotation: ProjectAnnotation): void;
  onRemove(annotationId: string): void;
}) {
  return (
    <aside className="absolute bottom-3 right-3 top-16 z-50 flex w-72 flex-col overflow-hidden rounded-md border border-line bg-white shadow-soft" data-testid="annotation-list-panel">
      <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">{zhCN.timeline.annotationList}</div>
      {annotations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-3 py-6 text-sm text-slate-500" data-testid="annotation-list-empty">
          {zhCN.timeline.annotationListEmpty}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {annotations.map((annotation) => (
            <div key={annotation.id} className="mb-2 rounded-md border border-line bg-panel p-2 text-xs" data-testid={`annotation-list-row-${annotation.id}`}>
              <button
                className="flex w-full items-start gap-2 rounded text-left hover:bg-white"
                type="button"
                data-testid={`annotation-list-item-${annotation.id}`}
                onClick={() => onSeek(annotation.time)}
              >
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: annotation.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{annotation.text}</span>
                  <span className="mt-0.5 block tabular-nums text-slate-500">{annotation.time.toFixed(2)}s</span>
                </span>
              </button>
              <div className="mt-2 flex justify-end gap-2">
                <button className="rounded border border-line bg-white px-2 py-1 hover:bg-panel" type="button" data-testid={`annotation-edit-${annotation.id}`} onClick={() => onEdit(annotation)}>
                  {zhCN.timeline.annotationEditTitle}
                </button>
                <button className="rounded border border-rose-200 bg-white px-2 py-1 text-rose-700 hover:bg-rose-50" type="button" data-testid={`annotation-delete-${annotation.id}`} onClick={() => onRemove(annotation.id)}>
                  {zhCN.timeline.annotationDelete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function BookmarkListPanel({
  bookmarks,
  editing,
  onSeek,
  onBeginRename,
  onChangeRename,
  onSaveRename,
  onCancelRename,
  onRemove
}: {
  bookmarks: TimelineBookmark[];
  editing?: BookmarkRenameState;
  onSeek(time: number): void;
  onBeginRename(bookmark: TimelineBookmark): void;
  onChangeRename(value: BookmarkRenameState): void;
  onSaveRename(bookmarkId: string, note: string): void;
  onCancelRename(): void;
  onRemove(bookmarkId: string): void;
}) {
  return (
    <aside className="absolute bottom-3 right-3 top-16 z-50 flex w-72 flex-col overflow-hidden rounded-md border border-line bg-white shadow-soft" data-testid="bookmark-panel">
      <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">{zhCN.timeline.bookmarkList}</div>
      {bookmarks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-3 py-6 text-sm text-slate-500" data-testid="bookmark-list-empty">
          {zhCN.timeline.bookmarkListEmpty}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {bookmarks.map((bookmark) => (
            <div key={bookmark.id} className="mb-2 rounded-md border border-line bg-panel p-2 text-xs" data-testid={`bookmark-list-row-${bookmark.id}`}>
              {editing?.id === bookmark.id ? (
                <div className="space-y-2">
                  <input
                    className="h-8 w-full rounded border border-line bg-white px-2 text-xs text-ink"
                    value={editing.note}
                    maxLength={120}
                    autoFocus
                    data-testid={`bookmark-rename-input-${bookmark.id}`}
                    onChange={(event) => onChangeRename({ id: bookmark.id, note: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        onSaveRename(bookmark.id, editing.note);
                      }
                      if (event.key === 'Escape') {
                        onCancelRename();
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <button className="rounded border border-line bg-white px-2 py-1 hover:bg-panel" type="button" onClick={onCancelRename}>
                      {zhCN.common.cancel}
                    </button>
                    <button className="rounded bg-brand px-2 py-1 font-medium text-white hover:bg-[#176858]" type="button" data-testid={`bookmark-rename-save-${bookmark.id}`} onClick={() => onSaveRename(bookmark.id, editing.note)}>
                      {zhCN.timeline.bookmarkRename}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className="flex w-full items-start gap-2 rounded text-left hover:bg-white"
                    type="button"
                    data-testid={`bookmark-list-item-${bookmark.id}`}
                    onClick={() => onSeek(bookmark.time)}
                    onDoubleClick={() => onBeginRename(bookmark)}
                  >
                    <span className="mt-1 h-3 w-3 shrink-0 bg-yellow-400" style={{ clipPath: 'polygon(50% 0, 0 100%, 100% 100%)' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{bookmark.note}</span>
                      <span className="mt-0.5 block tabular-nums text-slate-500">{bookmark.time.toFixed(2)}s</span>
                    </span>
                  </button>
                  <div className="mt-2 flex justify-end gap-2">
                    <button className="rounded border border-line bg-white px-2 py-1 hover:bg-panel" type="button" data-testid={`bookmark-rename-${bookmark.id}`} onClick={() => onBeginRename(bookmark)}>
                      {zhCN.timeline.bookmarkRename}
                    </button>
                    <button className="rounded border border-rose-200 bg-white px-2 py-1 text-rose-700 hover:bg-rose-50" type="button" data-testid={`bookmark-delete-${bookmark.id}`} onClick={() => onRemove(bookmark.id)}>
                      {zhCN.timeline.bookmarkDelete}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function AnnotationEditorDialog({
  value,
  onChange,
  onCancel,
  onSave
}: {
  value: AnnotationEditorState;
  onChange(value: AnnotationEditorState): void;
  onCancel(): void;
  onSave(value: AnnotationEditorState): void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4" data-testid="annotation-editor">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{value.id ? zhCN.timeline.annotationEditTitle : zhCN.timeline.annotationNewTitle}</h2>
          <div className="mt-1 text-xs tabular-nums text-slate-500">{value.time.toFixed(2)}s</div>
        </div>
        <div className="space-y-3 px-4 py-3">
          <label className="block text-xs font-medium text-slate-600">
            {zhCN.timeline.annotationText}
            <textarea
              className="mt-1 h-20 w-full resize-none rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              value={value.text}
              maxLength={240}
              data-testid="annotation-text-input"
              onChange={(event) => onChange({ ...value, text: event.target.value })}
            />
          </label>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">{zhCN.timeline.annotationColor}</div>
            <div className="flex gap-2">
              {PROJECT_ANNOTATION_COLORS.map((color) => (
                <button
                  key={color}
                  className={`h-7 w-7 rounded-full border ${value.color.toLowerCase() === color ? 'border-ink ring-2 ring-brand/30' : 'border-white'}`}
                  style={{ backgroundColor: color }}
                  type="button"
                  title={color}
                  aria-label={color}
                  data-testid={`annotation-color-${color}`}
                  onClick={() => onChange({ ...value, color })}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className="rounded border border-line px-3 py-2 text-sm font-medium hover:bg-panel" type="button" onClick={onCancel}>
            {zhCN.common.cancel}
          </button>
          <button className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]" type="button" data-testid="annotation-save-button" onClick={() => onSave(value)}>
            {zhCN.timeline.annotationSave}
          </button>
        </div>
      </section>
    </div>
  );
}

function TimelineNoteEditorDialog({
  value,
  onChange,
  onCancel,
  onSave
}: {
  value: TimelineNoteEditorState;
  onChange(value: TimelineNoteEditorState): void;
  onCancel(): void;
  onSave(value: TimelineNoteEditorState): void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4" data-testid="timeline-note-editor">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{value.id ? zhCN.timeline.timelineNoteEditTitle : zhCN.timeline.timelineNoteNewTitle}</h2>
          <div className="mt-1 text-xs tabular-nums text-slate-500">
            {value.start.toFixed(2)}s - {value.end.toFixed(2)}s
          </div>
        </div>
        <div className="space-y-3 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-slate-600">
              {zhCN.timeline.timelineNoteStart}
              <input
                className="mt-1 h-8 w-full rounded-md border border-line px-2 text-sm text-ink"
                type="number"
                min={0}
                step={0.01}
                value={value.start}
                data-testid="timeline-note-start-input"
                onChange={(event) => onChange({ ...value, start: Number(event.target.value) })}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              {zhCN.timeline.timelineNoteEnd}
              <input
                className="mt-1 h-8 w-full rounded-md border border-line px-2 text-sm text-ink"
                type="number"
                min={0}
                step={0.01}
                value={value.end}
                data-testid="timeline-note-end-input"
                onChange={(event) => onChange({ ...value, end: Number(event.target.value) })}
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-600">
            {zhCN.timeline.timelineNoteText}
            <textarea
              className="mt-1 h-20 w-full resize-none rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              value={value.text}
              maxLength={240}
              data-testid="timeline-note-text-input"
              onChange={(event) => onChange({ ...value, text: event.target.value })}
            />
          </label>
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">{zhCN.timeline.timelineNoteColor}</div>
            <div className="flex gap-2">
              {TIMELINE_NOTE_COLORS.map((color) => (
                <button
                  key={color}
                  className={`h-7 w-7 rounded-full border ${value.color.toLowerCase() === color ? 'border-ink ring-2 ring-brand/30' : 'border-white'}`}
                  style={{ backgroundColor: color }}
                  type="button"
                  title={color}
                  aria-label={color}
                  data-testid={`timeline-note-color-${color}`}
                  onClick={() => onChange({ ...value, color })}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className="rounded border border-line px-3 py-2 text-sm font-medium hover:bg-panel" type="button" onClick={onCancel}>
            {zhCN.common.cancel}
          </button>
          <button className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]" type="button" data-testid="timeline-note-save-button" onClick={() => onSave(value)}>
            {zhCN.timeline.timelineNoteSave}
          </button>
        </div>
      </section>
    </div>
  );
}

function TimelineBookmarkOverlay({
  bookmark,
  left,
  onSeek,
  onRemove
}: {
  bookmark: TimelineBookmark;
  left: number;
  onSeek(time: number): void;
  onRemove(bookmarkId: string): void;
}) {
  return (
    <button
      className="absolute bottom-0 top-0 z-[35] w-4 -translate-x-1/2 bg-transparent"
      style={{ left }}
      type="button"
      title={`${bookmark.note} (${bookmark.time.toFixed(2)}s)`}
      data-testid={`timeline-bookmark-${bookmark.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSeek(bookmark.time);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemove(bookmark.id);
      }}
    >
      <span className="absolute left-1/2 top-0 z-10 h-4 w-4 -translate-x-1/2 border border-white bg-yellow-400 shadow-sm" style={{ clipPath: 'polygon(50% 0, 0 100%, 100% 100%)' }} />
      <span className="absolute bottom-0 left-1/2 top-4 w-px -translate-x-1/2 bg-yellow-400/70" />
      <span className="sr-only">{bookmark.note}</span>
    </button>
  );
}

function TimelineMarkerOverlay({
  marker,
  left,
  onSeek,
  onRemove
}: {
  marker: TimelineMarker;
  left: number;
  onSeek(time: number): void;
  onRemove(markerId: string): void;
}) {
  return (
    <button
      className="absolute bottom-0 top-0 z-30 w-0.5 -translate-x-1/2 bg-transparent"
      style={{ left }}
      type="button"
      title={`${marker.label} (${marker.time.toFixed(2)}s)`}
      data-testid={`timeline-marker-${marker.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSeek(marker.time);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemove(marker.id);
      }}
    >
      <span className="absolute left-1/2 top-1 z-10 h-4 w-4 -translate-x-1/2 rounded-sm border border-white shadow-sm" style={{ backgroundColor: marker.color }} />
      <span className="absolute bottom-0 top-0 left-1/2 w-0.5 -translate-x-1/2" style={{ backgroundColor: marker.color }} />
      <span className="sr-only">{marker.label}</span>
    </button>
  );
}

function BeatMarkerOverlay({
  marker,
  left,
  active,
  onSeek,
  onRemove
}: {
  marker: BeatMarker;
  left: number;
  active?: boolean;
  onSeek(time: number): void;
  onRemove(markerId: string): void;
}) {
  return (
    <button
      className={`absolute bottom-0 top-0 z-30 w-0.5 -translate-x-1/2 bg-transparent ${active ? 'animate-pulse' : ''}`}
      style={{ left }}
      type="button"
      title={zhCN.timeline.beatMarkerTitle(marker.time)}
      data-testid={`timeline-beat-marker-${marker.id}`}
      data-active={active ? 'true' : 'false'}
      onClick={(event) => {
        event.stopPropagation();
        onSeek(marker.time);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemove(marker.id);
      }}
    >
      <span className={`absolute left-1/2 top-6 z-10 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[2px] border border-white shadow-sm ${active ? 'bg-yellow-300 ring-4 ring-yellow-300/40' : 'bg-orange-500'}`} />
      <span className={`absolute bottom-0 top-0 left-1/2 w-0.5 -translate-x-1/2 ${active ? 'bg-yellow-300' : 'bg-orange-500/75'}`} />
      <span className="sr-only">{zhCN.timeline.beatMarker}</span>
    </button>
  );
}

function TransitionMenu({
  menu,
  onChange,
  onAdd,
  onRemove,
  onClose
}: {
  menu: TransitionMenuState;
  onChange(menu: TransitionMenuState): void;
  onAdd(): void;
  onRemove?: () => void;
  onClose(): void;
}) {
  return (
    <div
      className="fixed z-50 w-[220px] rounded-md border border-line bg-white p-3 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="transition-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 font-semibold text-slate-700">{zhCN.timeline.addTransition}</div>
      <label className="mb-2 block text-slate-600">
        {zhCN.timeline.transitionType}
        <select
          className="mt-1 w-full rounded border border-line px-2 py-1"
          value={menu.type}
          data-testid="transition-type-select"
          onChange={(event) => onChange({ ...menu, type: event.target.value as TransitionType })}
        >
          <option value="dissolve">{zhCN.timeline.transitionNames.dissolve}</option>
          <option value="fade-black">{zhCN.timeline.transitionNames['fade-black']}</option>
        </select>
      </label>
      <label className="mb-3 block text-slate-600">
        {zhCN.timeline.transitionDuration}
        <input
          className="mt-1 w-full rounded border border-line px-2 py-1"
          type="number"
          min={0.03}
          step={0.05}
          value={menu.duration}
          data-testid="transition-duration-input"
          onChange={(event) => onChange({ ...menu, duration: Number(event.target.value) })}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button className="rounded border border-line px-2 py-1 hover:bg-panel" type="button" onClick={onClose}>
          {zhCN.timeline.close}
        </button>
        {onRemove ? (
          <button className="rounded border border-rose-300 px-2 py-1 text-rose-700 hover:bg-rose-50" type="button" data-testid="transition-remove-button" onClick={onRemove}>
            {zhCN.timeline.remove}
          </button>
        ) : null}
        <button className="rounded bg-brand px-2 py-1 font-medium text-white" type="button" data-testid="transition-add-button" onClick={onAdd}>
          {zhCN.timeline.add}
        </button>
      </div>
    </div>
  );
}

function GapActionMenu({
  menu,
  onCloseGap,
  onClose
}: {
  menu: GapMenuState;
  onCloseGap(): void;
  onClose(): void;
}) {
  return (
    <div
      className="fixed z-50 w-[170px] rounded-md border border-line bg-white p-2 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="gap-action-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button className="block w-full rounded px-2 py-2 text-left hover:bg-panel" type="button" data-testid="gap-action-close" onClick={onCloseGap}>
        {zhCN.timeline.closeGapAction}
      </button>
      <button className="mt-1 block w-full rounded px-2 py-1.5 text-left text-slate-500 hover:bg-panel" type="button" onClick={onClose}>
        {zhCN.timeline.close}
      </button>
    </div>
  );
}

function VolumeEnvelopeMenu({
  menu,
  onFade,
  onReset,
  onClose
}: {
  menu: VolumeEnvelopeMenuState;
  onFade(kind: 'in' | 'out'): void;
  onReset(): void;
  onClose(): void;
}) {
  return (
    <div
      className="fixed z-50 w-[180px] rounded-md border border-line bg-white p-2 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="volume-envelope-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button className="block w-full rounded px-2 py-2 text-left hover:bg-panel" type="button" data-testid="volume-envelope-fade-in" onClick={() => onFade('in')}>
        {zhCN.timeline.volumeEnvelopeFadeIn}
      </button>
      <button className="block w-full rounded px-2 py-2 text-left hover:bg-panel" type="button" data-testid="volume-envelope-fade-out" onClick={() => onFade('out')}>
        {zhCN.timeline.volumeEnvelopeFadeOut}
      </button>
      <button className="block w-full rounded px-2 py-2 text-left hover:bg-panel" type="button" data-testid="volume-envelope-reset" onClick={onReset}>
        {zhCN.timeline.volumeEnvelopeReset}
      </button>
      <button className="mt-1 block w-full rounded px-2 py-1.5 text-left text-slate-500 hover:bg-panel" type="button" onClick={onClose}>
        {zhCN.timeline.close}
      </button>
    </div>
  );
}

function RulerContextMenu({
  menu,
  onChange,
  onAction,
  onJump,
  onClose
}: {
  menu: RulerMenuState;
  onChange(menu: RulerMenuState): void;
  onAction(action: RulerContextMenuAction): void;
  onJump(): void;
  onClose(): void;
}) {
  const items = buildRulerContextMenuItems();
  return (
    <div
      className="fixed z-50 w-[220px] rounded-md border border-line bg-white p-2 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="ruler-context-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {items
        .filter((item) => item.action !== 'jump-timecode')
        .map((item) => (
          <button key={item.action} className="block w-full rounded px-2 py-2 text-left hover:bg-panel" type="button" data-testid={item.testId} onClick={() => onAction(item.action)}>
            {item.label}
          </button>
        ))}
      <div className="my-1 border-t border-line" />
      <div className="px-2 py-1" data-testid="ruler-context-jump-timecode">
        <label className="block text-[11px] font-semibold text-slate-500">
          {zhCN.timeline.rulerJumpToTimecode}
          <input
            className="mt-1 h-7 w-full rounded border border-line px-2 font-mono text-xs tabular-nums text-ink"
            value={menu.timecode}
            placeholder={zhCN.timeline.rulerTimecodePlaceholder}
            data-testid="ruler-timecode-input"
            onChange={(event) => onChange({ ...menu, timecode: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onJump();
              }
            }}
          />
        </label>
        <button className="mt-2 block w-full rounded bg-brand px-2 py-1.5 text-center font-medium text-white" type="button" data-testid="ruler-timecode-jump-button" onClick={onJump}>
          {zhCN.timeline.rulerJump}
        </button>
      </div>
      <button className="mt-1 block w-full rounded px-2 py-1.5 text-left text-slate-500 hover:bg-panel" type="button" onClick={onClose}>
        {zhCN.timeline.close}
      </button>
    </div>
  );
}

function ClipActionMenu({
  menu,
  clip,
  asset,
  group,
  projectFrameRate,
  canCreateGroup,
  whisperReady,
  whisperUnavailableMessage,
  onSilence,
  onScene,
  onGenerateSubtitles,
  onReplaceMedia,
  onConvertFrameRate,
  onPack,
  onCreateGroup,
  onUngroup,
  onDeleteGroup,
  onGroupColor,
  onClipColor,
  onClose
}: {
  menu: ClipMenuState;
  clip?: Clip;
  asset?: MediaAsset;
  group?: ClipGroup;
  projectFrameRate: number;
  canCreateGroup: boolean;
  whisperReady: boolean;
  whisperUnavailableMessage?: string;
  onSilence(): void;
  onScene(): void;
  onGenerateSubtitles(): void;
  onReplaceMedia(): void;
  onConvertFrameRate(): void;
  onPack(): void;
  onCreateGroup(): void;
  onUngroup(group: ClipGroup): void;
  onDeleteGroup(group: ClipGroup): void;
  onGroupColor(group: ClipGroup, color: ClipGroupColor): void;
  onClipColor(clipId: string, color: TimelineLabelColor | null): void;
  onClose(): void;
}) {
  const canDetectSilence = Boolean(clip && (clip.type === 'audio' || (clip.type === 'video' && asset?.hasAudio)));
  const canDetectScene = clip?.type === 'video';
  const canGenerateSubtitles = canGenerateSubtitlesForClip(clip, asset, whisperReady);
  const canReplaceMedia = Boolean(clip && (clip.type === 'video' || clip.type === 'audio' || clip.type === 'image'));
  const canConvertFrameRate = Boolean(asset?.type === 'video' && (asset.variableFrameRate || isFrameRateMismatch(asset.frameRate, projectFrameRate)));
  return (
    <div
      className="fixed z-50 w-[230px] rounded-md border border-line bg-white p-2 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="clip-action-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canDetectSilence}
        data-testid="clip-action-silence"
        onClick={onSilence}
      >
        {zhCN.timeline.silenceAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canDetectScene}
        data-testid="clip-action-scene"
        onClick={onScene}
      >
        {zhCN.timeline.sceneAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canGenerateSubtitles}
        title={!canGenerateSubtitles ? whisperUnavailableMessage : undefined}
        data-testid="clip-action-generate-subtitles"
        onClick={onGenerateSubtitles}
      >
        {zhCN.timeline.generateSubtitlesAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canReplaceMedia}
        data-testid="clip-action-replace-media"
        onClick={onReplaceMedia}
      >
        {zhCN.timeline.replaceMediaAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canConvertFrameRate}
        data-testid="clip-action-convert-frame-rate"
        onClick={onConvertFrameRate}
      >
        {zhCN.timeline.convertFrameRateAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!clip}
        data-testid="clip-action-pack-nested"
        onClick={onPack}
      >
        {zhCN.timeline.packNestedSequence}
      </button>
      <div className="my-1 border-t border-line" />
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canCreateGroup}
        data-testid="clip-action-create-group"
        onClick={onCreateGroup}
      >
        {zhCN.timeline.clipGroupCreate}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!group}
        data-testid="clip-action-ungroup"
        onClick={() => group && onUngroup(group)}
      >
        {zhCN.timeline.clipGroupUngroup}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left text-rose-700 hover:bg-rose-50 disabled:opacity-40"
        type="button"
        disabled={!group}
        data-testid="clip-action-delete-group"
        onClick={() => group && onDeleteGroup(group)}
      >
        {zhCN.timeline.clipGroupDelete}
      </button>
      {clip ? (
        <div className="px-2 pb-1 pt-2" data-testid="clip-label-color-options">
          <div className="mb-1 text-[11px] font-semibold text-slate-500">{zhCN.timeline.clipLabelColor}</div>
          <div className="flex flex-wrap gap-1">
            {TIMELINE_LABEL_COLORS.map((color) => (
              <button
                key={color}
                className={`h-5 w-5 rounded-full border ${clip.colorLabel === color ? 'border-slate-900 ring-2 ring-slate-300' : 'border-white'}`}
                type="button"
                title={zhCN.timeline.timelineLabelColorNames[color]}
                style={{ backgroundColor: getTimelineLabelColorHex(color) }}
                data-testid={`clip-label-color-${color}`}
                onClick={() => onClipColor(clip.id, color)}
              />
            ))}
          </div>
          <button className="mt-1 rounded border border-line px-2 py-1 text-[11px] text-slate-600 hover:bg-panel" type="button" data-testid="clip-label-color-clear" onClick={() => onClipColor(clip.id, null)}>
            {zhCN.timeline.defaultLabelColor}
          </button>
        </div>
      ) : null}
      {group ? (
        <div className="px-2 pb-1 pt-2" data-testid="clip-group-color-options">
          <div className="mb-1 text-[11px] font-semibold text-slate-500">{zhCN.timeline.clipGroupColor}</div>
          <div className="flex gap-1">
            {CLIP_GROUP_COLORS.map((color) => (
              <button
                key={color}
                className={`h-5 w-5 rounded-full border ${group.color === color ? 'border-slate-900 ring-2 ring-slate-300' : 'border-white'}`}
                type="button"
                title={zhCN.timeline.clipGroupColorNames[color]}
                style={{ backgroundColor: CLIP_GROUP_COLOR_HEX[color] }}
                data-testid={`clip-group-color-${color}`}
                onClick={() => onGroupColor(group, color)}
              />
            ))}
          </div>
        </div>
      ) : null}
      <button className="mt-1 block w-full rounded px-2 py-1.5 text-left text-slate-500 hover:bg-panel" type="button" onClick={onClose}>
        {zhCN.timeline.close}
      </button>
    </div>
  );
}

function ReplaceMediaDialog({
  value,
  onChange,
  onCancel,
  onConfirm
}: {
  value: ReplaceMediaDialogState;
  onChange(value: ReplaceMediaDialogState): void;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4" data-testid="replace-media-dialog">
      <div className="w-full max-w-sm rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="mb-3">
          <div className="text-sm font-semibold text-slate-900">{zhCN.timeline.replaceMediaTitle}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{value.media.name}</div>
        </div>
        <label className="block text-xs font-medium text-slate-600">
          {zhCN.timeline.replaceMediaDurationMode}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={value.durationMode}
            data-testid="replace-media-duration-mode"
            onChange={(event) => onChange({ ...value, durationMode: event.target.value as ReplaceMediaDurationMode })}
          >
            {(['trim-to-original', 'stretch-to-fit', 'use-new-duration'] as ReplaceMediaDurationMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {zhCN.timeline.replaceMediaModes[mode]}
              </option>
            ))}
          </select>
        </label>
        {value.warnings.length > 0 ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800" data-testid="replace-media-warning">
            <div className="font-semibold">{zhCN.timeline.replaceMediaWarnings.title}</div>
            {value.warnings.map((warning) => (
              <div key={warning} className="mt-1">
                {zhCN.timeline.replaceMediaWarnings[warning]}
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-panel" type="button" onClick={onCancel}>
            {zhCN.timeline.close}
          </button>
          <button className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-[#176858]" type="button" data-testid="replace-media-confirm" onClick={onConfirm}>
            {zhCN.timeline.replaceMediaConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function SilenceDetectionDialog({
  clip,
  asset,
  onClose,
  onApply
}: {
  clip: Clip;
  asset: MediaAsset;
  onClose(): void;
  onApply(ranges: SilentRange[]): void;
}) {
  const [thresholdDb, setThresholdDb] = useState(-40);
  const [minSilenceDuration, setMinSilenceDuration] = useState(0.5);
  const [marginMs, setMarginMs] = useState(100);
  const [status, setStatus] = useState<'params' | 'detecting' | 'preview' | 'error'>('params');
  const [ranges, setRanges] = useState<SilentRange[]>([]);
  const [error, setError] = useState<string>();
  const totalDuration = ranges.reduce((total, range) => total + range.duration, 0);

  async function runDetection(): Promise<void> {
    setStatus('detecting');
    setError(undefined);
    try {
      const nextRanges = await detectClipSilence(clip, asset, {
        thresholdDb,
        minSilenceDuration,
        marginDuration: Math.max(0, marginMs) / 1000
      });
      setRanges(nextRanges);
      setStatus('preview');
    } catch (detectError) {
      setError(detectError instanceof Error ? detectError.message : zhCN.timeline.silenceDecodeFailed);
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="silence-dialog">
      <section className="w-full max-w-md rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.timeline.silenceDialogTitle}</h2>
          <div className="mt-1 truncate text-xs text-slate-500">{clip.name}</div>
        </div>
        <div className="space-y-3 px-4 py-3 text-sm">
          {status === 'detecting' ? (
            <div className="rounded border border-line bg-panel px-3 py-6 text-center text-sm text-slate-600" data-testid="silence-loading">
              {zhCN.timeline.silenceScanning}
            </div>
          ) : (
            <>
              <label className="block text-xs font-medium text-slate-600">
                {zhCN.timeline.silenceThreshold}
                <input
                  className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm"
                  type="number"
                  step={1}
                  value={thresholdDb}
                  data-testid="silence-threshold-input"
                  onChange={(event) => setThresholdDb(Number(event.target.value))}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {zhCN.timeline.silenceMinDuration}
                <input
                  className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm"
                  type="number"
                  min={0}
                  step={0.1}
                  value={minSilenceDuration}
                  data-testid="silence-min-duration-input"
                  onChange={(event) => setMinSilenceDuration(Number(event.target.value))}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {zhCN.timeline.silenceMargin}
                <input
                  className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm"
                  type="number"
                  min={0}
                  step={10}
                  value={marginMs}
                  data-testid="silence-margin-input"
                  onChange={(event) => setMarginMs(Number(event.target.value))}
                />
              </label>
              {status === 'preview' ? (
                <div className="rounded border border-line bg-panel px-3 py-2 text-xs text-slate-700" data-testid="silence-preview">
                  <div className="font-semibold">{zhCN.timeline.silencePreview(ranges.length, totalDuration.toFixed(2))}</div>
                  {ranges.length > 0 ? (
                    <div className="mt-2 max-h-24 overflow-auto">
                      {ranges.slice(0, 6).map((range) => (
                        <div key={`${range.start}-${range.end}`} className="tabular-nums">
                          {range.start.toFixed(2)}s - {range.end.toFixed(2)}s
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-slate-500">{zhCN.timeline.noSilenceFound}</div>
                  )}
                </div>
              ) : null}
              {status === 'error' ? <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div> : null}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className="rounded border border-line px-3 py-2 text-sm font-medium hover:bg-panel" type="button" onClick={onClose}>
            {zhCN.timeline.close}
          </button>
          {status === 'preview' && ranges.length > 0 ? (
            <button className="rounded bg-brand px-3 py-2 text-sm font-medium text-white" type="button" data-testid="silence-confirm-button" onClick={() => onApply(ranges)}>
              {zhCN.timeline.confirmSilenceCut}
            </button>
          ) : (
            <button
              className="rounded bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              type="button"
              disabled={status === 'detecting'}
              data-testid="silence-detect-button"
              onClick={() => void runDetection()}
            >
              {zhCN.timeline.startSilenceDetect}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function SceneDetectionDialog({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="scene-detect-dialog">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.timeline.sceneDialogTitle}</h2>
        </div>
        <div className="px-4 py-5">
          <div className="mb-2 text-sm text-slate-600">{zhCN.timeline.sceneScanning}</div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
          </div>
        </div>
      </section>
    </div>
  );
}

function WhisperGenerationDialog({ progress, clipName }: { progress: number; clipName: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="whisper-dialog">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.timeline.whisperRunningTitle}</h2>
          <div className="mt-1 truncate text-xs text-slate-500">{clipName}</div>
        </div>
        <div className="px-4 py-5">
          <div className="mb-2 text-sm text-slate-600">{zhCN.timeline.whisperRunningMessage(progress)}</div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
          </div>
        </div>
      </section>
    </div>
  );
}

function SelectionMarquee({ rect }: { rect: SelectionRect }) {
  const left = Math.min(rect.left, rect.right);
  const top = Math.min(rect.top, rect.bottom);
  const width = Math.abs(rect.right - rect.left);
  const height = Math.abs(rect.bottom - rect.top);
  return (
    <div
      className="fixed z-50 border border-brand bg-brand/10 pointer-events-none"
      style={{ left, top, width, height }}
      data-testid="timeline-selection-marquee"
    />
  );
}

function keyframeRefKey(ref: SelectedKeyframeRef): string {
  return `${ref.clipId}\0${ref.property}\0${ref.keyframeId}`;
}
