import type {Clip} from '@open-factory/editor-core';
import {
  MoveClipCommand,
  MoveClipsCommand,
  TrimClipCommand,
  clampTimelineZoom,
  fitTimelineZoomToWindow,
  getTimelineDuration,
} from '@open-factory/editor-core';
import {buildKeyboardClipMoveStarts, buildKeyboardClipTrim, getKeyboardSelectedClipIds} from '../../timeline-keyboard';
import {commandManager, timelineAccessor} from '../../../../store/commandManager';
import {zhCN} from '../../../../i18n/strings';
import {showToast} from '../../../../lib/toast';
import {LABEL_WIDTH} from '../../TimelineParts';
import type {TimelineHandlerParams} from './types';
import {isEditableKeyboardTarget} from './utils';

export function createKeyboardHandlers(
  params: TimelineHandlerParams,
  helpers: {
    findClipById: (clipId: string) => Clip | undefined;
    canApplyProtectedMove: (startsByClipId: Record<string, number>) => boolean;
    warnProtectedRangeBlocked: () => void;
    applyZoom: (nextZoom: number, anchorViewportX: number) => void;
    splitSelected: () => void;
    createGroupFromSelection: () => void;
    ungroupSelected: () => void;
    minFrameDuration: () => number;
  },
) {
  const {
    project,
    allClips,
    selectedClipIds,
    selectedClipId,
    setSelectedClipId,
    setSelectedClipIds,
    protectedRanges,
    zoom,
    scrollRef,
    playheadTime,
    setPlayheadTime,
    setTimelineZoom,
  } = params;

  const {
    findClipById,
    canApplyProtectedMove,
    warnProtectedRangeBlocked,
    applyZoom,
    splitSelected,
    createGroupFromSelection,
    ungroupSelected,
    minFrameDuration,
  } = helpers;

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

  return {
    onKeyDown,
    moveSelectedClipsByKeyboardFrame,
    trimSelectedClipByKeyboardFrame,
  };
}
