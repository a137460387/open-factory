import type { Clip, Timeline, Track } from './model';
import { round } from './time';

export type SyncCompareAlignMode = 'start' | 'in' | 'manual';
export type SyncCompareSide = 'left' | 'right';

export interface SyncCompareClipRef {
  clip: Clip;
  track: Track;
  trackIndex: number;
  selectedIndex: number;
}

export interface SyncCompareOffsetOptions {
  mode: SyncCompareAlignMode;
  manualOffsetSeconds?: number;
}

export interface SyncComparePlaybackInput extends SyncCompareOffsetOptions {
  left: Clip;
  right: Clip;
  playheadTime: number;
  playing?: boolean;
  leftPaused?: boolean;
  rightPaused?: boolean;
  heldLeftTime?: number;
  heldRightTime?: number;
}

export interface SyncComparePlaybackState {
  leftTime: number;
  rightTime: number;
  leftPlaying: boolean;
  rightPlaying: boolean;
  offsetSeconds: number;
}

export function findSyncCompareClipRefs(timeline: Timeline, selectedClipIds: string[]): SyncCompareClipRef[] {
  if (selectedClipIds.length !== 2) {
    return [];
  }
  const selectedOrder = new Map(selectedClipIds.map((id, index) => [id, index]));
  const refs = timeline.tracks
    .flatMap((track, trackIndex) =>
      track.clips.map((clip) => ({
        clip,
        track,
        trackIndex,
        selectedIndex: selectedOrder.get(clip.id),
      })),
    )
    .filter(
      (item): item is SyncCompareClipRef => item.selectedIndex !== undefined && isSyncCompareVisualClip(item.clip),
    )
    .sort((left, right) => left.selectedIndex - right.selectedIndex);
  return refs.length === 2 ? refs : [];
}

export function calculateSyncCompareRightOffsetSeconds(
  left: Clip,
  right: Clip,
  options: SyncCompareOffsetOptions,
): number {
  const startAlignedOffset = right.start - left.start;
  if (options.mode === 'in') {
    return round(startAlignedOffset + left.trimStart - right.trimStart);
  }
  if (options.mode === 'manual') {
    return round(startAlignedOffset + finiteOrZero(options.manualOffsetSeconds));
  }
  return round(startAlignedOffset);
}

export function resolveSyncComparePlaybackState(input: SyncComparePlaybackInput): SyncComparePlaybackState {
  const offsetSeconds = calculateSyncCompareRightOffsetSeconds(input.left, input.right, input);
  const liveLeftTime = clampClipDisplayTime(input.playheadTime - input.left.start, input.left);
  const liveRightTime = clampClipDisplayTime(input.playheadTime - input.right.start + offsetSeconds, input.right);
  return {
    leftTime: input.leftPaused ? clampClipDisplayTime(input.heldLeftTime ?? liveLeftTime, input.left) : liveLeftTime,
    rightTime: input.rightPaused
      ? clampClipDisplayTime(input.heldRightTime ?? liveRightTime, input.right)
      : liveRightTime,
    leftPlaying: (input.playing ?? true) && !input.leftPaused,
    rightPlaying: (input.playing ?? true) && !input.rightPaused,
    offsetSeconds,
  };
}

export function clampClipDisplayTime(time: number, clip: Clip): number {
  return round(Math.min(Math.max(0, finiteOrZero(time)), Math.max(0, clip.duration)));
}

export function isSyncCompareVisualClip(clip: Clip): boolean {
  return clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence';
}

function finiteOrZero(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
