import type {Clip, ClipGroup, KeyframeProperty} from '@open-factory/editor-core';
import {canMoveClipWithProtectedRanges} from '@open-factory/editor-core';
import {keyframeRefKey} from '../../TimelineOverlays';
import type {SelectedKeyframeRef} from '../../../../store/editorStore';
import {showToast} from '../../../../lib/toast';
import {zhCN} from '../../../../i18n/strings';
import type {TimelineHandlerParams} from './types';

export function createSelectionHandlers(
  params: TimelineHandlerParams,
  helpers: {
    findClipById: (clipId: string) => Clip | undefined;
  },
) {
  const {
    allClips,
    clipGroupByClipId,
    selectedClipIds,
    selectedClipId,
    setSelectedClipId,
    setSelectedClipIds,
    setSelectedKeyframe,
    toggleSelectedClipId,
    toggleSelectedKeyframe,
    protectedRanges,
  } = params;

  const {findClipById} = helpers;

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

  return {
    selectClip,
    canApplyProtectedMove,
    warnProtectedRangeBlocked,
    getKeyframeTime,
    buildKeyframeStartTimes,
    selectKeyframe,
  };
}
