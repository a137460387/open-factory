import type {Clip} from '@open-factory/editor-core';
import {
  BatchKeyframeEditCommand,
  MoveClipCommand,
  MoveClipsCommand,
  RollingTrimCommand,
  SlipClipCommand,
  SlideClipCommand,
  TrimClipCommand,
  UpdateKeyframeCommand,
  buildSlideClipEdit,
  buildSlipClip,
  moveClip,
  detectOverlap,
  round,
  replaceClip,
  canMoveClipWithProtectedRanges,
  type KeyframeProperty,
} from '@open-factory/editor-core';
import {keyframeRefKey} from '../../TimelineOverlays';
import type {DragState} from '../../TimelineParts';
import type {SelectedKeyframeRef} from '../../../../store/editorStore';
import {commandManager, timelineAccessor} from '../../../../store/commandManager';
import {zhCN} from '../../../../i18n/strings';
import {showToast} from '../../../../lib/toast';
import type {TimelineHandlerParams} from './types';

export function createDragHandlers(
  params: TimelineHandlerParams,
  helpers: {
    findClipById: (clipId: string) => Clip | undefined;
    findClip: (clipId: string) => Clip;
    getKeyframeTime: (ref: SelectedKeyframeRef) => number | undefined;
    buildKeyframeStartTimes: (refs: SelectedKeyframeRef[]) => Record<string, number>;
    snapKeyframeTime: (clip: Clip, localTime: number, disabled: boolean) => number;
    snapClipStart: (time: number, duration: number, clip: Clip, disabled: boolean) => number;
    buildMovedPreviewTimeline: (previewStartsByClipId: Record<string, number>) => ReturnType<typeof import('../../../store/editorStore').useEditorStore.getState>['project']['timeline'];
    buildTrimPreview: (clip: Clip, edge: 'left' | 'right', delta: number, snappingDisabled: boolean) => Clip;
    minFrameDuration: () => number;
    canApplyProtectedMove: (startsByClipId: Record<string, number>) => boolean;
    warnProtectedRangeBlocked: () => void;
  },
) {
  const {
    project,
    allClips,
    zoom,
    drag,
    setDrag,
    selectionStart,
    setSelectionStart,
    selectionRect,
    setSelectionRect,
    protectedRanges,
    setSelectedClipId,
    setSelectedClipIds,
    setSelectedKeyframe,
    setSelectedKeyframes,
    setPreviewTimeline,
    setPlayheadTime,
    snapTime: snapTimeFn,
  } = params;

  const {
    findClipById,
    findClip,
    getKeyframeTime,
    buildKeyframeStartTimes,
    snapKeyframeTime,
    snapClipStart,
    buildMovedPreviewTimeline,
    buildTrimPreview,
    minFrameDuration,
    canApplyProtectedMove,
    warnProtectedRangeBlocked,
  } = helpers;

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

  return {
    onPointerMove,
    onPointerUp,
    onDragStart,
  };
}

function buildSelectionMarqueeRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): { left: number; top: number; right: number; bottom: number } {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  };
}

function findClipIdsIntersectingRect(
  rect: { left: number; top: number; right: number; bottom: number },
): string[] {
  // This will be implemented in the facade
  return [];
}
