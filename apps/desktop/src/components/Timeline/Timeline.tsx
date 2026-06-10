import {
  AddClipCommand,
  AddTimelineMarkerCommand,
  AddTrackCommand,
  AddTransitionCommand,
  DeleteClipsCommand,
  UpdateTrackCommand,
  RemoveTimelineMarkerCommand,
  RemoveTransitionCommand,
  calculateAnchoredScrollLeft,
  clampTimelineZoom,
  findTimelineSnapTarget,
  fitTimelineZoomToWindow,
  ensurePlayheadVisible,
  MoveClipCommand,
  MoveClipsCommand,
  RemoveSilenceCommand,
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
import { useMemo, useRef, useState } from 'react';
import { createTextClip } from '../../lib/clipFactory';
import { showToast } from '../../lib/toast';
import { detectClipSilence } from '../../lib/silenceDetection';
import { detectSceneChanges, listenBridge } from '../../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';
import { LABEL_WIDTH, Ruler, TrackRow, buildTicks, type ClipMenuRequest, type DragState } from './TimelineParts';

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
  const [drag, setDrag] = useState<DragState | undefined>();
  const [selectionRect, setSelectionRect] = useState<SelectionRect | undefined>();
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | undefined>();
  const [transitionMenu, setTransitionMenu] = useState<TransitionMenuState | undefined>();
  const [clipMenu, setClipMenu] = useState<ClipMenuState | undefined>();
  const [silenceDialog, setSilenceDialog] = useState<SilenceDialogState | undefined>();
  const [sceneDialog, setSceneDialog] = useState<SceneDialogState | undefined>();
  const rootRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const timelineDuration = Math.max(
    10,
    ...project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration + 2))
  );
  const width = Math.max(960, timelineDuration * zoom);
  const ticks = useMemo(() => buildTicks(timelineDuration), [timelineDuration]);
  const allClips = useMemo(() => project.timeline.tracks.flatMap((track) => track.clips), [project.timeline]);

  function addTrack(type: Track['type']): void {
    commandManager.execute(
      new AddTrackCommand(timelineAccessor, createTrack({
        id: createId('track'),
        type,
        name: `${type[0].toUpperCase()}${type.slice(1)} ${project.timeline.tracks.filter((track) => track.type === type).length + 1}`,
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
      showToast({ kind: 'warning', title: 'Transition unavailable', message: error instanceof Error ? error.message : 'The transition could not be added.' });
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
      showToast({ kind: 'warning', title: 'No text track', message: 'Add a text track first.' });
      return;
    }
    const clip = createTextClip(track, project.timeline);
    commandManager.execute(new AddClipCommand(timelineAccessor, clip));
    setSelectedClipId(clip.id);
  }

  function addTimelineMarker(): void {
    try {
      commandManager.execute(
        new AddTimelineMarkerCommand(timelineAccessor, {
          id: createId('marker'),
          time: playheadTime,
          label: `Marker ${(project.timeline.markers?.length ?? 0) + 1}`
        })
      );
    } catch (error) {
      showToast({ kind: 'warning', title: 'Marker rejected', message: error instanceof Error ? error.message : 'Unable to add marker.' });
    }
  }

  function removeTimelineMarker(markerId: string): void {
    try {
      commandManager.execute(new RemoveTimelineMarkerCommand(timelineAccessor, markerId));
    } catch (error) {
      showToast({ kind: 'warning', title: 'Marker rejected', message: error instanceof Error ? error.message : 'Unable to remove marker.' });
    }
  }

  function splitSelected(): void {
    if (!selectedClipId) {
      return;
    }
    try {
      commandManager.execute(new SplitClipCommand(timelineAccessor, selectedClipId, playheadTime));
    } catch (error) {
      showToast({ kind: 'warning', title: 'Split unavailable', message: error instanceof Error ? error.message : 'Move the playhead inside the clip.' });
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
            showToast({ kind: 'warning', title: 'Clip overlap', message: 'This position overlaps another clip.' });
            return;
          }
          commandManager.execute(new MoveClipCommand(timelineAccessor, current.clip.id, current.previewStart));
        }
      } else {
        commandManager.execute(
          new TrimClipCommand(timelineAccessor, current.clip.id, current.previewTrimStart, current.previewTrimEnd, undefined, minFrameDuration())
        );
      }
    } catch (error) {
      showToast({ kind: 'warning', title: 'Timeline edit rejected', message: error instanceof Error ? error.message : 'The edit could not be applied.' });
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

  function onTrackPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    setTransitionMenu(undefined);
    setClipMenu(undefined);
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
      showToast({ kind: 'warning', title: '无法检测静音', message: '请选择带音频的音频或视频 clip。' });
      return;
    }
    setSilenceDialog({ clip, asset });
  }

  function applySilenceRemoval(clipId: string, ranges: SilentRange[]): void {
    try {
      commandManager.execute(new RemoveSilenceCommand(timelineAccessor, clipId, ranges));
      setSilenceDialog(undefined);
      clearSelectedClipIds();
      showToast({ kind: 'success', title: '静音段已删除', message: `删除 ${ranges.length} 段静音。` });
    } catch (error) {
      showToast({ kind: 'warning', title: '静音删除失败', message: error instanceof Error ? error.message : '时间线拒绝了该操作。' });
    }
  }

  function splitBySceneTimes(clipId: string, times: number[]): void {
    try {
      commandManager.execute(new SplitClipAtTimesCommand(timelineAccessor, clipId, times));
      showToast({ kind: 'success', title: '场景已分割', message: `分割 ${times.length} 个切点。` });
    } catch (error) {
      showToast({ kind: 'warning', title: '场景分割失败', message: error instanceof Error ? error.message : '时间线拒绝了该操作。' });
    }
  }

  async function openSceneDetection(clipId: string): Promise<void> {
    const clip = findClip(clipId);
    const asset = getClipMediaAsset(clip);
    setClipMenu(undefined);
    setSelectedClipId(clip.id);
    if (clip.type !== 'video' || !asset) {
      showToast({ kind: 'warning', title: '无法检测场景', message: '请选择视频 clip。' });
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
        showToast({ kind: 'info', title: '未检测到场景切点' });
        return;
      }
      splitBySceneTimes(clip.id, splitTimes);
    } catch (error) {
      showToast({ kind: 'error', title: '场景检测失败', message: error instanceof Error ? error.message : '无法运行 FFmpeg 场景检测。' });
    } finally {
      unlisten?.();
      setSceneDialog(undefined);
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
      }
    }
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
    if (edge === 'left') {
      const maxTrimStart = Math.max(0, sourceDuration - clip.trimEnd - minDuration * speed);
      const trimStart = round(Math.min(maxTrimStart, Math.max(0, clip.trimStart + delta * speed)));
      return {
        ...clip,
        trimStart,
        duration: round(Math.max(minDuration, (sourceDuration - trimStart - clip.trimEnd) / speed)),
        transform: { ...clip.transform }
      } as Clip;
    }
    const proposedEnd = snapClipEnd(clip.start + Math.max(minDuration, clip.duration + delta), clip, snappingDisabled);
    const maxDuration = Math.max(minDuration, (sourceDuration - clip.trimStart) / speed);
    const duration = round(Math.min(maxDuration, Math.max(minDuration, proposedEnd - clip.start)));
    return {
      ...clip,
      trimEnd: round(Math.max(0, sourceDuration - clip.trimStart - duration * speed)),
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
          <div className="text-sm font-semibold">Timeline</div>
          <div className="text-xs text-slate-500">Drag clips, trim edges, split at playhead</div>
        </div>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title="Add video track" onClick={() => addTrack('video')}>
          <Plus size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title="Add audio track" onClick={() => addTrack('audio')}>
          <Plus size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title="Add subtitle track" onClick={() => addTrack('subtitle')}>
          <Captions size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title="Add text clip" onClick={addText}>
          <Type size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title="Add marker at playhead" data-testid="add-timeline-marker-button" onClick={addTimelineMarker}>
          <Flag size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title="Split selected clip" onClick={splitSelected}>
          <Scissors size={16} />
        </button>
        <button className="rounded-md border border-line p-2 hover:bg-panel" title="Delete selected clip" onClick={deleteSelected}>
          <Trash2 size={16} />
        </button>
        <input
          className="w-28 accent-brand"
          title="Timeline zoom"
          type="range"
          min={8}
          max={1600}
          value={zoom}
          onChange={(event) => setTimelineZoom(Number(event.target.value))}
          data-testid="timeline-zoom-slider"
        />
      </div>
      <div ref={scrollRef} className="timeline-scrollbar min-h-0 min-w-0 max-w-full flex-1 overflow-auto" onWheel={onWheel} data-testid="timeline-scroll-container">
        <div className="relative" style={{ width: LABEL_WIDTH + width }}>
          <Ruler ticks={ticks} zoom={zoom} width={width} onSeek={setPlayheadTime} />
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
                  setTransitionMenu({
                    ...request,
                    x: Math.min(request.x, Math.max(0, window.innerWidth - 230)),
                    y: Math.min(request.y, Math.max(0, window.innerHeight - 180)),
                    type: request.existingType ?? 'dissolve',
                    duration: request.existingDuration ?? 0.5
                  })
                }
                onClipMenu={openClipMenu}
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
            {clipMenu ? (
              <ClipActionMenu
                menu={clipMenu}
                clip={allClips.find((clip) => clip.id === clipMenu.clipId)}
                asset={allClips.find((clip) => clip.id === clipMenu.clipId) ? getClipMediaAsset(allClips.find((clip) => clip.id === clipMenu.clipId)!) : undefined}
                onSilence={() => openSilenceDetection(clipMenu.clipId)}
                onScene={() => void openSceneDetection(clipMenu.clipId)}
                onClose={() => setClipMenu(undefined)}
              />
            ) : null}
            {selectionRect ? <SelectionMarquee rect={selectionRect} /> : null}
            {typeof inPoint === 'number' ? (
        <div
                className="absolute bottom-0 top-0 z-10 w-0.5 bg-emerald-500"
                style={{ left: LABEL_WIDTH + inPoint * zoom }}
                title="In point"
                data-testid="timeline-in-point-marker"
              />
            ) : null}
            {typeof outPoint === 'number' ? (
              <div
                className="absolute bottom-0 top-0 z-10 w-0.5 bg-amber-500"
                style={{ left: LABEL_WIDTH + outPoint * zoom }}
                title="Out point"
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

interface SilenceDialogState {
  clip: Clip;
  asset: MediaAsset;
}

interface SceneDialogState {
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
      <div className="mb-2 font-semibold text-slate-700">添加过渡</div>
      <label className="mb-2 block text-slate-600">
        类型
        <select
          className="mt-1 w-full rounded border border-line px-2 py-1"
          value={menu.type}
          data-testid="transition-type-select"
          onChange={(event) => onChange({ ...menu, type: event.target.value as TransitionType })}
        >
          <option value="dissolve">Dissolve</option>
          <option value="fade-black">Fade black</option>
        </select>
      </label>
      <label className="mb-3 block text-slate-600">
        时长
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
          关闭
        </button>
        {onRemove ? (
          <button className="rounded border border-rose-300 px-2 py-1 text-rose-700 hover:bg-rose-50" type="button" data-testid="transition-remove-button" onClick={onRemove}>
            移除
          </button>
        ) : null}
        <button className="rounded bg-brand px-2 py-1 font-medium text-white" type="button" data-testid="transition-add-button" onClick={onAdd}>
          添加
        </button>
      </div>
    </div>
  );
}

function ClipActionMenu({
  menu,
  clip,
  asset,
  onSilence,
  onScene,
  onClose
}: {
  menu: ClipMenuState;
  clip?: Clip;
  asset?: MediaAsset;
  onSilence(): void;
  onScene(): void;
  onClose(): void;
}) {
  const canDetectSilence = Boolean(clip && (clip.type === 'audio' || (clip.type === 'video' && asset?.hasAudio)));
  const canDetectScene = clip?.type === 'video';
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
        自动剪切静音段
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canDetectScene}
        data-testid="clip-action-scene"
        onClick={onScene}
      >
        自动按场景分割
      </button>
      <button className="mt-1 block w-full rounded px-2 py-1.5 text-left text-slate-500 hover:bg-panel" type="button" onClick={onClose}>
        关闭
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
      setError(detectError instanceof Error ? detectError.message : '无法解码音频。');
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="silence-dialog">
      <section className="w-full max-w-md rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">静音检测</h2>
          <div className="mt-1 truncate text-xs text-slate-500">{clip.name}</div>
        </div>
        <div className="space-y-3 px-4 py-3 text-sm">
          {status === 'detecting' ? (
            <div className="rounded border border-line bg-panel px-3 py-6 text-center text-sm text-slate-600" data-testid="silence-loading">
              正在解码并扫描音频...
            </div>
          ) : (
            <>
              <label className="block text-xs font-medium text-slate-600">
                静音阈值 dB
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
                最小静音时长 s
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
                边距 ms
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
                  <div className="font-semibold">将删除 {ranges.length} 段，合计 {totalDuration.toFixed(2)}s</div>
                  {ranges.length > 0 ? (
                    <div className="mt-2 max-h-24 overflow-auto">
                      {ranges.slice(0, 6).map((range) => (
                        <div key={`${range.start}-${range.end}`} className="tabular-nums">
                          {range.start.toFixed(2)}s - {range.end.toFixed(2)}s
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-slate-500">未找到符合条件的静音段。</div>
                  )}
                </div>
              ) : null}
              {status === 'error' ? <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div> : null}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className="rounded border border-line px-3 py-2 text-sm font-medium hover:bg-panel" type="button" onClick={onClose}>
            关闭
          </button>
          {status === 'preview' && ranges.length > 0 ? (
            <button className="rounded bg-brand px-3 py-2 text-sm font-medium text-white" type="button" data-testid="silence-confirm-button" onClick={() => onApply(ranges)}>
              确认剪切
            </button>
          ) : (
            <button
              className="rounded bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              type="button"
              disabled={status === 'detecting'}
              data-testid="silence-detect-button"
              onClick={() => void runDetection()}
            >
              开始检测
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
          <h2 className="text-sm font-semibold">场景检测</h2>
        </div>
        <div className="px-4 py-5">
          <div className="mb-2 text-sm text-slate-600">正在分析视频切点...</div>
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
