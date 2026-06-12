import {
  AddClipCommand,
  AddTimelineMarkerCommand,
  AddTrackCommand,
  AddTransitionCommand,
  CloseGapCommand,
  DeleteClipsCommand,
  PackNestedSequenceCommand,
  UpdateTrackCommand,
  RemoveTimelineMarkerCommand,
  RemoveTransitionCommand,
  buildSlideClipEdit,
  buildSlipClip,
  calculateSpeedCurveDisplayDuration,
  calculateSpeedCurveSourceDuration,
  calculateAnchoredScrollLeft,
  clampTimelineZoom,
  findTimelineSnapTarget,
  fitTimelineZoomToWindow,
  getTimelineVirtualRenderWindow,
  ensurePlayheadVisible,
  MoveClipCommand,
  MoveClipsCommand,
  RemoveSilenceCommand,
  RippleDeleteCommand,
  RollingTrimCommand,
  SlideClipCommand,
  SlipClipCommand,
  UpdateKeyframeCommand,
  rectsIntersect,
  replaceClip,
  SplitClipCommand,
  SplitClipAtTimesCommand,
  TrimClipCommand,
  createId,
  createTrack,
  detectOverlap,
  getTimelineDuration,
  getClipSourceVisibleDuration,
  getClipSpeed,
  isNestedSequenceDepthExceeded,
  instantiateTitleTemplate,
  moveClip,
  round,
  snapTime,
  type Clip,
  type KeyframeProperty,
  type MediaAsset,
  type SilentRange,
  type SnapEdge,
  type SelectionRect,
  type TimelineMarker,
  type TimelineSnapCandidate,
  type Track,
  type TransitionType
} from '@open-factory/editor-core';
import { Captions, Flag, Plus, Scissors, Trash2, Type } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createTextClip } from '../../lib/clipFactory';
import { zhCN } from '../../i18n/strings';
import { showToast } from '../../lib/toast';
import { detectClipSilence } from '../../lib/silenceDetection';
import { canGenerateSubtitlesForClip, buildWhisperSubtitleTrackForClip, getWhisperAvailability, type WhisperAvailability } from '../../lib/whisper';
import { TITLE_TEMPLATE_DRAG_MIME, isTitleTemplateId } from '../../lib/titleTemplates';
import { detectSceneChanges, listenBridge, type WhisperProgressEvent } from '../../lib/tauri-bridge';
import { commandManager, projectAccessor, timelineAccessor } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';
import { useRenderCacheStore } from '../../store/renderCacheStore';
import { useWhisperSettingsStore } from '../../store/whisperSettingsStore';
import { LABEL_WIDTH, Ruler, TrackRow, buildTicks, type ClipMenuRequest, type DragState, type GapMenuRequest } from './TimelineParts';

export function Timeline() {
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const inPoint = useEditorStore((state) => state.inPoint);
  const outPoint = useEditorStore((state) => state.outPoint);
  const zoom = useEditorStore((state) => state.timelineZoom);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const selectedKeyframe = useEditorStore((state) => state.selectedKeyframe);
  const setSelectedKeyframe = useEditorStore((state) => state.setSelectedKeyframe);
  const toggleSelectedClipId = useEditorStore((state) => state.toggleSelectedClipId);
  const clearSelectedClipIds = useEditorStore((state) => state.clearSelectedClipIds);
  const setPlayheadTime = useEditorStore((state) => state.setPlayheadTime);
  const setTimelineZoom = useEditorStore((state) => state.setTimelineZoom);
  const setPreviewTimeline = useEditorStore((state) => state.setPreviewTimeline);
  const setActiveSequenceId = useEditorStore((state) => state.setActiveSequenceId);
  const renderCacheRanges = useRenderCacheStore((state) => state.ranges);
  const [drag, setDrag] = useState<DragState | undefined>();
  const [selectionRect, setSelectionRect] = useState<SelectionRect | undefined>();
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | undefined>();
  const [transitionMenu, setTransitionMenu] = useState<TransitionMenuState | undefined>();
  const [clipMenu, setClipMenu] = useState<ClipMenuState | undefined>();
  const [gapMenu, setGapMenu] = useState<GapMenuState | undefined>();
  const [silenceDialog, setSilenceDialog] = useState<SilenceDialogState | undefined>();
  const [sceneDialog, setSceneDialog] = useState<SceneDialogState | undefined>();
  const [whisperDialog, setWhisperDialog] = useState<WhisperDialogState | undefined>();
  const [whisperAvailability, setWhisperAvailability] = useState<WhisperAvailability>({ ready: false, error: zhCN.whisper.notConfigured });
  const [rollingTrimActive, setRollingTrimActive] = useState(false);
  const [slipEditActive, setSlipEditActive] = useState(false);
  const [slideEditActive, setSlideEditActive] = useState(false);
  const [scrollViewport, setScrollViewport] = useState({ scrollLeft: 0, viewportWidth: 960 });
  const whisperExecutablePath = useWhisperSettingsStore((state) => state.executablePath);
  const whisperModelPath = useWhisperSettingsStore((state) => state.modelPath);
  const rootRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const timelineDuration = Math.max(
    10,
    ...project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration + 2))
  );
  const width = Math.max(960, timelineDuration * zoom);
  const ticks = useMemo(() => buildTicks(timelineDuration), [timelineDuration]);
  const allClips = useMemo(() => project.timeline.tracks.flatMap((track) => track.clips), [project.timeline]);
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
  const activeSequence = project.sequences.find((sequence) => sequence.id === project.activeSequenceId);
  const isMainSequence = project.activeSequenceId === 'sequence-main';

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
  }, []);

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

  function updateTrack(trackId: string, patch: Partial<Pick<Track, 'muted' | 'solo' | 'locked' | 'volume'>>): void {
    commandManager.execute(new UpdateTrackCommand(timelineAccessor, trackId, patch));
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

  function addTimelineMarker(): void {
    try {
      commandManager.execute(
        new AddTimelineMarkerCommand(timelineAccessor, {
          id: createId('marker'),
          time: playheadTime,
          label: zhCN.timeline.markerLabel((project.timeline.markers?.length ?? 0) + 1)
        })
      );
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.markerRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.addMarkerFailed });
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

  function deleteSelected(): void {
    if (selectedClipIds.length === 0) {
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
      const nextTime = snapTime(Math.min(drag.clip.duration, Math.max(0, drag.previewStart + delta)));
      setDrag({ ...drag, previewKeyframeTime: nextTime });
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
        commandManager.execute(
          new UpdateKeyframeCommand(timelineAccessor, current.clip.id, current.keyframeProperty, current.keyframeId, {
            time: current.previewKeyframeTime ?? current.previewStart
          })
        );
        setSelectedKeyframe({ clipId: current.clip.id, property: current.keyframeProperty, keyframeId: current.keyframeId });
      } else if (current.mode === 'move') {
        const starts = current.previewStartsByClipId ?? { [current.clip.id]: current.previewStart };
        const ids = Object.keys(starts);
        if (ids.length > 1) {
          commandManager.execute(new MoveClipsCommand(timelineAccessor, starts));
        } else {
          const preview = moveClip(current.clip, current.previewStart);
          const track = project.timeline.tracks.find((item) => item.id === preview.trackId);
          if (track && detectOverlap(track, preview, current.clip.id)) {
            showToast({ kind: 'warning', title: zhCN.timeline.clipOverlapTitle, message: zhCN.timeline.clipOverlapMessage });
            return;
          }
          commandManager.execute(new MoveClipCommand(timelineAccessor, current.clip.id, current.previewStart));
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

  function selectClip(clipId: string, additive: boolean): void {
    if (additive) {
      toggleSelectedClipId(clipId);
      return;
    }
    if (selectedClipIds.length > 1 && selectedClipIds.includes(clipId)) {
      return;
    }
    setSelectedClipId(clipId);
  }

  function selectKeyframe(keyframe: { clipId: string; property: KeyframeProperty; keyframeId: string }): void {
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

  function openGapMenu(request: GapMenuRequest): void {
    setTransitionMenu(undefined);
    setClipMenu(undefined);
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
    setTransitionMenu(undefined);
    setClipMenu(undefined);
    setGapMenu(undefined);
    if (event.target !== event.currentTarget) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    rootRef.current?.focus();
    setSelectionStart({ x: event.clientX, y: event.clientY });
    setSelectionRect({ left: event.clientX, top: event.clientY, right: event.clientX, bottom: event.clientY });
  }

  function openClipMenu(request: ClipMenuRequest): void {
    setTransitionMenu(undefined);
    setGapMenu(undefined);
    setClipMenu({
      ...request,
      x: Math.min(request.x, Math.max(0, window.innerWidth - 240)),
      y: Math.min(request.y, Math.max(0, window.innerHeight - 170))
    });
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

  function onTitleTemplateDragOver(event: React.DragEvent<HTMLDivElement>): void {
    if (Array.from(event.dataTransfer.types).includes(TITLE_TEMPLATE_DRAG_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function onTitleTemplateDrop(event: React.DragEvent<HTMLDivElement>): void {
    const templateId = event.dataTransfer.getData(TITLE_TEMPLATE_DRAG_MIME);
    if (!isTitleTemplateId(templateId)) {
      return;
    }
    event.preventDefault();
    const scroll = scrollRef.current;
    const rect = scroll?.getBoundingClientRect();
    const start = rect && scroll ? round(Math.max(0, (event.clientX - rect.left + scroll.scrollLeft - LABEL_WIDTH) / zoom)) : undefined;
    addTitleTemplate(templateId, start);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
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
    const target = findTimelineSnapTarget({
      clipStart: time,
      clipDuration: duration,
      candidates: buildSnapCandidates(clip),
      pixelsPerSecond: zoom,
      disabled,
      edges
    });
    return target?.snappedStart ?? time;
  }

  function snapClipEnd(time: number, clip: Clip, disabled: boolean): number {
    const target = findTimelineSnapTarget({
      clipStart: clip.start,
      clipDuration: Math.max(1 / 30, time - clip.start),
      candidates: buildSnapCandidates(clip),
      pixelsPerSecond: zoom,
      disabled,
      edges: ['end']
    });
    return target?.candidate.time ?? time;
  }

  function buildSnapCandidates(clip: Clip): TimelineSnapCandidate[] {
    return [
      { time: 0, kind: 'timeline-start' },
      { time: playheadTime, kind: 'playhead' },
      ...(project.timeline.markers ?? []).map((marker) => ({ time: marker.time, kind: 'marker' as const })),
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
      className="flex min-h-0 min-w-0 max-w-full flex-col border-t border-line bg-white focus:outline-none"
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
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.addMarker} data-testid="add-timeline-marker-button" onClick={addTimelineMarker}>
          <Flag size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title={zhCN.timeline.splitSelectedClip} onClick={splitSelected}>
          <Scissors size={16} />
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
      </div>
      <div
        ref={scrollRef}
        className="timeline-scrollbar min-h-0 min-w-0 max-w-full flex-1 overflow-auto"
        onWheel={onWheel}
        onScroll={syncScrollViewport}
        onDragOver={onTitleTemplateDragOver}
        onDrop={onTitleTemplateDrop}
        data-testid="timeline-scroll-container"
      >
        <div className="relative" style={{ width: LABEL_WIDTH + width }}>
          <Ruler ticks={ticks} zoom={zoom} width={width} cachedRanges={renderCacheRanges} onSeek={setPlayheadTime} />
          <div className="relative">
            {project.timeline.tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                zoom={zoom}
                selectedClipId={selectedClipId}
                selectedClipIds={selectedClipIds}
                selectedKeyframe={selectedKeyframe}
                drag={drag}
                media={project.media}
                onSelect={selectClip}
                onKeyframeSelect={selectKeyframe}
                onDragStart={onDragStart}
                onTrackPointerDown={onTrackPointerDown}
                onTrackUpdate={updateTrack}
                transitions={project.timeline.transitions ?? []}
                onTransitionMenu={(request) =>
                  {
                    setGapMenu(undefined);
                    setClipMenu(undefined);
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
                onClipDoubleClick={openNestedSequence}
                virtualWindow={virtualWindow}
                rollingTrimActive={rollingTrimActive}
                slipEditActive={slipEditActive}
                slideEditActive={slideEditActive}
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
            {transitionMenu ? (
              <TransitionMenu
                menu={transitionMenu}
                onChange={setTransitionMenu}
                onAdd={addTransition}
                onRemove={transitionMenu.existingTransitionId ? removeTransition : undefined}
                onClose={() => setTransitionMenu(undefined)}
              />
            ) : null}
            {gapMenu ? <GapActionMenu menu={gapMenu} onClose={() => setGapMenu(undefined)} onCloseGap={closeGap} /> : null}
            {clipMenu ? (
              <ClipActionMenu
                menu={clipMenu}
                clip={allClips.find((clip) => clip.id === clipMenu.clipId)}
                asset={allClips.find((clip) => clip.id === clipMenu.clipId) ? getClipMediaAsset(allClips.find((clip) => clip.id === clipMenu.clipId)!) : undefined}
                whisperReady={whisperAvailability.ready}
                whisperUnavailableMessage={whisperAvailability.error}
                onSilence={() => openSilenceDetection(clipMenu.clipId)}
                onScene={() => void openSceneDetection(clipMenu.clipId)}
                onGenerateSubtitles={() => void generateSubtitles(clipMenu.clipId)}
                onPack={() => packClipMenuSelection(clipMenu.clipId)}
                onClose={() => setClipMenu(undefined)}
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

interface GapMenuState {
  x: number;
  y: number;
  trackId: string;
  time: number;
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
      className="absolute bottom-0 top-0 z-10 w-0.5 -translate-x-1/2 bg-transparent"
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

function ClipActionMenu({
  menu,
  clip,
  asset,
  whisperReady,
  whisperUnavailableMessage,
  onSilence,
  onScene,
  onGenerateSubtitles,
  onPack,
  onClose
}: {
  menu: ClipMenuState;
  clip?: Clip;
  asset?: MediaAsset;
  whisperReady: boolean;
  whisperUnavailableMessage?: string;
  onSilence(): void;
  onScene(): void;
  onGenerateSubtitles(): void;
  onPack(): void;
  onClose(): void;
}) {
  const canDetectSilence = Boolean(clip && (clip.type === 'audio' || (clip.type === 'video' && asset?.hasAudio)));
  const canDetectScene = clip?.type === 'video';
  const canGenerateSubtitles = canGenerateSubtitlesForClip(clip, asset, whisperReady);
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
        disabled={!clip}
        data-testid="clip-action-pack-nested"
        onClick={onPack}
      >
        {zhCN.timeline.packNestedSequence}
      </button>
      <button className="mt-1 block w-full rounded px-2 py-1.5 text-left text-slate-500 hover:bg-panel" type="button" onClick={onClose}>
        {zhCN.timeline.close}
      </button>
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
