import {
  calculateSpeedCurveSourceDuration,
  getClipSpeed,
  round,
  type Clip
} from '@open-factory/editor-core';

export type TimelineKeyboardTrimEdge = 'in' | 'out';

export function getTimelineKeyboardFrameDuration(fps: number): number {
  return 1 / Math.max(1, Math.round(Number.isFinite(fps) ? fps : 30));
}

export function getKeyboardSelectedClipIds(selectedClipIds: readonly string[], selectedClipId?: string): string[] {
  if (selectedClipIds.length > 0) {
    return Array.from(new Set(selectedClipIds));
  }
  return selectedClipId ? [selectedClipId] : [];
}

export function buildKeyboardClipMoveStarts(input: {
  clips: readonly Clip[];
  selectedClipIds: readonly string[];
  selectedClipId?: string;
  direction: -1 | 1;
  fps: number;
}): Record<string, number> {
  const frame = getTimelineKeyboardFrameDuration(input.fps);
  const selectedIds = getKeyboardSelectedClipIds(input.selectedClipIds, input.selectedClipId);
  const clipsById = new Map(input.clips.map((clip) => [clip.id, clip]));
  return Object.fromEntries(
    selectedIds.flatMap((clipId) => {
      const clip = clipsById.get(clipId);
      if (!clip) {
        return [];
      }
      return [[clipId, round(Math.max(0, clip.start + input.direction * frame))]];
    })
  );
}

export function buildKeyboardClipTrim(input: {
  clip: Clip;
  edge: TimelineKeyboardTrimEdge;
  fps: number;
}): { trimStart: number; trimEnd: number } {
  const frame = getTimelineKeyboardFrameDuration(input.fps);
  const sourceDelta = calculateSpeedCurveSourceDuration(frame, input.clip.keyframes, getClipSpeed(input.clip));
  if (input.edge === 'in') {
    return {
      trimStart: round(input.clip.trimStart + sourceDelta),
      trimEnd: input.clip.trimEnd
    };
  }
  return {
    trimStart: input.clip.trimStart,
    trimEnd: round(input.clip.trimEnd + sourceDelta)
  };
}
