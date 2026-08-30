import type { ClipGroup } from './model-types';
import type { Timeline } from './model-types';
import { findClipGroupForClip } from './clip-groups';

/**
 * Tolerance used for clip boundary comparisons, matching the gap detection
 * threshold in findTrackGapAtTime (commands/timeline/utils.ts).
 */
const GAP_EPSILON = 0.000001;

/**
 * Whether a rolling trim boundary between two clips is locked by clip groups.
 *
 * Returns true when the two clips belong to different groups, or when exactly
 * one of them is grouped. Editing such a boundary would change the relative
 * timing between grouped clips, which violates the group contract.
 *
 * Clip membership is exclusive: normalizeClipGroup filters clip ids that are
 * already used by a previous group, so a clip belongs to at most one group and
 * "same group" is a simple identity comparison of the resolved groups.
 *
 * @param groups - Clip groups of the project
 * @param leftClipId - Left clip of the trim boundary
 * @param rightClipId - Right clip of the trim boundary
 */
export function isRollingTrimBoundaryLocked(
  groups: readonly ClipGroup[] | undefined,
  leftClipId: string,
  rightClipId: string,
): boolean {
  const leftGroup = findClipGroupForClip(groups, leftClipId);
  const rightGroup = findClipGroupForClip(groups, rightClipId);
  if (!leftGroup && !rightGroup) {
    return false;
  }
  if (leftGroup && rightGroup) {
    return leftGroup.id !== rightGroup.id;
  }
  return true;
}

/**
 * Find the first clip group that would be split by closing the gap
 * [gapStart, gapEnd) on the given track.
 *
 * A group is split when it has at least one member ending at or before the
 * gap start (end <= gapStart + epsilon, clip touching the gap belongs to the
 * left side, matching findTrackGapAtTime's tolerance direction) and at least
 * one member starting at or after the gap end (start >= gapEnd - epsilon).
 * Groups entirely on one side of the gap are not affected.
 *
 * Only clips on the given track are considered, because closing a track gap
 * only shifts clips on that track.
 *
 * @param groups - Clip groups of the project
 * @param timeline - Timeline containing the clips
 * @param trackId - Track the gap belongs to
 * @param gapStart - Gap start time in seconds
 * @param gapEnd - Gap end time in seconds
 * @returns The first split group in array order, or undefined when no group is split
 */
export function findGroupSplitByGap(
  groups: readonly ClipGroup[] | undefined,
  timeline: Timeline,
  trackId: string,
  gapStart: number,
  gapEnd: number,
): ClipGroup | undefined {
  const track = timeline.tracks.find((item) => item.id === trackId);
  if (!track) {
    return undefined;
  }
  for (const group of groups ?? []) {
    let hasLeft = false;
    let hasRight = false;
    for (const clip of track.clips) {
      if (!group.clipIds.includes(clip.id)) {
        continue;
      }
      const clipEnd = clip.start + clip.duration;
      if (clipEnd <= gapStart + GAP_EPSILON) {
        hasLeft = true;
      }
      if (clip.start >= gapEnd - GAP_EPSILON) {
        hasRight = true;
      }
      if (hasLeft && hasRight) {
        return group;
      }
    }
  }
  return undefined;
}
