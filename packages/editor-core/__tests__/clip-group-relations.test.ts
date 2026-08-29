import { describe, expect, it } from 'vitest';
import { findGroupSplitByGap, isRollingTrimBoundaryLocked } from '../src/clip-group-relations';
import type { ClipGroup } from '../src/model-types';
import { makeTimeline, makeVideoClip } from './test-utils';

function makeGroup(id: string, clipIds: string[]): ClipGroup {
  return { id, name: `Group ${id}`, clipIds, color: 'blue' };
}

describe('clip group relations', () => {
  describe('isRollingTrimBoundaryLocked', () => {
    it('returns false when both clips belong to the same group', () => {
      const groups = [makeGroup('g1', ['left', 'right'])];

      expect(isRollingTrimBoundaryLocked(groups, 'left', 'right')).toBe(false);
    });

    it('returns false when neither clip is grouped', () => {
      const groups = [makeGroup('g1', ['other-a', 'other-b'])];

      expect(isRollingTrimBoundaryLocked(groups, 'left', 'right')).toBe(false);
      expect(isRollingTrimBoundaryLocked([], 'left', 'right')).toBe(false);
      expect(isRollingTrimBoundaryLocked(undefined, 'left', 'right')).toBe(false);
    });

    it('returns true when the clips belong to different groups', () => {
      const groups = [makeGroup('g1', ['left', 'x']), makeGroup('g2', ['right', 'y'])];

      expect(isRollingTrimBoundaryLocked(groups, 'left', 'right')).toBe(true);
    });

    it('returns true when exactly one clip is grouped', () => {
      const groups = [makeGroup('g1', ['left', 'x'])];

      expect(isRollingTrimBoundaryLocked(groups, 'left', 'right')).toBe(true);
      expect(isRollingTrimBoundaryLocked(groups, 'right', 'left')).toBe(true);
    });
  });

  describe('findGroupSplitByGap', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'a', start: 0, duration: 2 }),
      makeVideoClip({ id: 'b', start: 2, duration: 2 }),
      makeVideoClip({ id: 'c', start: 6, duration: 2 }),
      makeVideoClip({ id: 'd', start: 8, duration: 2 }),
    ]);

    it('returns the group when members exist on both sides of the gap', () => {
      const group = makeGroup('g1', ['a', 'c']);

      expect(findGroupSplitByGap([group], timeline, 'track-video', 4, 6)).toBe(group);
    });

    it('returns undefined when the group is entirely after the gap', () => {
      const group = makeGroup('g1', ['c', 'd']);

      expect(findGroupSplitByGap([group], timeline, 'track-video', 4, 6)).toBeUndefined();
    });

    it('returns undefined when the group is entirely before the gap', () => {
      const group = makeGroup('g1', ['a', 'b']);

      expect(findGroupSplitByGap([group], timeline, 'track-video', 4, 6)).toBeUndefined();
    });

    it('detects splits across a single-frame gap', () => {
      const frame = 1 / 30;
      const singleFrameTimeline = makeTimeline([
        makeVideoClip({ id: 'a', start: 0, duration: 2 }),
        makeVideoClip({ id: 'b', start: 2 + frame, duration: 2 }),
      ]);
      const group = makeGroup('g1', ['a', 'b']);

      expect(findGroupSplitByGap([group], singleFrameTimeline, 'track-video', 2, 2 + frame)).toBe(group);
    });

    it('returns undefined for empty or missing groups and tracks', () => {
      expect(findGroupSplitByGap([], timeline, 'track-video', 4, 6)).toBeUndefined();
      expect(findGroupSplitByGap(undefined, timeline, 'track-video', 4, 6)).toBeUndefined();
      expect(findGroupSplitByGap([makeGroup('g1', ['a', 'c'])], timeline, 'missing-track', 4, 6)).toBeUndefined();
    });

    it('returns the first split group in array order', () => {
      const first = makeGroup('g1', ['b', 'c']);
      const second = makeGroup('g2', ['a', 'c']);

      expect(findGroupSplitByGap([first, second], timeline, 'track-video', 4, 6)).toBe(first);
    });

    it('treats a clip ending exactly at gapStart as belonging to the left side', () => {
      // clip b: start 2, duration 2 → end 4 === gapStart；贴边归左侧（与 findTrackGapAtTime 容差方向一致）
      const group = makeGroup('g1', ['b', 'c']);

      expect(findGroupSplitByGap([group], timeline, 'track-video', 4, 6)).toBe(group);
    });

    it('ignores group members on other tracks', () => {
      const crossTrackTimeline = makeTimeline([
        makeVideoClip({ id: 'a', start: 0, duration: 2 }),
        makeVideoClip({ id: 'c', start: 6, duration: 2 }),
        makeVideoClip({ id: 'a2', start: 0, duration: 2, trackId: 'track-audio' }),
      ]);
      const group = makeGroup('g1', ['a', 'c', 'a2']);

      // gap 在 video 轨：a（左）与 a2（他轨）不构成撕裂，但 c 在右侧 → 仍撕裂
      expect(findGroupSplitByGap([group], crossTrackTimeline, 'track-video', 2, 6)).toBe(group);
      // gap 在 audio 轨：仅 a2 在该轨（全左）→ 不撕裂
      expect(findGroupSplitByGap([group], crossTrackTimeline, 'track-audio', 2, 6)).toBeUndefined();
    });
  });
});
