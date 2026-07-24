import { distributeKeyframeTimes } from '../../keyframes';
import { Clip, Keyframe, Timeline } from '../../model';
import { round } from '../../time';
import { BatchKeyframeEditOperation, KeyframeSelectionRef } from './keyframe-edit-commands';
import { findClip } from './utils';

export function uniqueKeyframeRefs(refs: KeyframeSelectionRef[]): KeyframeSelectionRef[] {
  const seen = new Set<string>();
  const output: KeyframeSelectionRef[] = [];
  for (const ref of refs) {
    const key = `${ref.clipId}\0${ref.property}\0${ref.keyframeId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(ref);
  }
  return output;
}

export function groupKeyframeRefsByClip(refs: KeyframeSelectionRef[]): Map<string, KeyframeSelectionRef[]> {
  const output = new Map<string, KeyframeSelectionRef[]>();
  for (const ref of refs) {
    const group = output.get(ref.clipId) ?? [];
    group.push(ref);
    output.set(ref.clipId, group);
  }
  return output;
}

export function calculateKeyframeSelectionCenter(timeline: Timeline, refs: KeyframeSelectionRef[]): number {
  const absoluteTimes = refs.flatMap((ref) => {
    const clip = findClip(timeline, ref.clipId);
    const frame = clip.keyframes?.[ref.property]?.find((item) => item.id === ref.keyframeId);
    return frame ? [clip.start + frame.time] : [];
  });
  if (absoluteTimes.length === 0) {
    return 0;
  }
  return round((Math.min(...absoluteTimes) + Math.max(...absoluteTimes)) / 2);
}

export function keyframeRefKey(ref: KeyframeSelectionRef): string {
  return `${ref.clipId}\0${ref.property}\0${ref.keyframeId}`;
}

export function calculateDistributedKeyframeTimeMap(timeline: Timeline, refs: KeyframeSelectionRef[]): Map<string, number> {
  const entries = refs.flatMap((ref) => {
    const clip = findClip(timeline, ref.clipId);
    const frame = clip.keyframes?.[ref.property]?.find((item) => item.id === ref.keyframeId);
    return frame
      ? [
          {
            ref,
            clip,
            frame: {
              ...frame,
              id: keyframeRefKey(ref),
              time: clip.start + frame.time,
            },
          },
        ]
      : [];
  });
  const distributed = distributeKeyframeTimes(entries.map((entry) => entry.frame));
  const distributedByKey = new Map(distributed.map((frame) => [frame.id, frame.time]));
  const output = new Map<string, number>();
  for (const entry of entries) {
    const absoluteTime = distributedByKey.get(keyframeRefKey(entry.ref));
    if (absoluteTime === undefined) {
      continue;
    }
    output.set(keyframeRefKey(entry.ref), clampKeyframeTime(absoluteTime - entry.clip.start, entry.clip.duration));
  }
  return output;
}

export function getBatchAlignValue(timeline: Timeline, refs: KeyframeSelectionRef[], value: number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  for (const ref of refs) {
    const clip = findClip(timeline, ref.clipId);
    const frame = clip.keyframes?.[ref.property]?.find((item) => item.id === ref.keyframeId);
    if (frame) {
      return frame.value;
    }
  }
  return 0;
}

export function getBatchEditedKeyframeTime(
  clip: Clip,
  frame: Keyframe<number>,
  operation: BatchKeyframeEditOperation,
  center: number,
): number {
  if (operation.type === 'shift') {
    const delta = Number.isFinite(operation.delta) ? operation.delta : 0;
    return clampKeyframeTime(frame.time + delta, clip.duration);
  }
  if (operation.type === 'scale-time') {
    const factor = Math.max(0.01, Number.isFinite(operation.factor) ? operation.factor : 1);
    const absoluteTime = clip.start + frame.time;
    return clampKeyframeTime(center + (absoluteTime - center) * factor - clip.start, clip.duration);
  }
  return frame.time;
}

export function clampKeyframeTime(time: number, duration: number): number {
  return round(Math.min(Math.max(0, time), Math.max(0, duration)));
}
