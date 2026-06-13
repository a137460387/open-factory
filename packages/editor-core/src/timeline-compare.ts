import type { Clip, Timeline } from './model';
import { getTimelineDuration } from './timeline';
import { round } from './time';

export interface TimelineDiffRange {
  start: number;
  end: number;
}

export function diffTimelineSnapshots(current: Timeline, snapshot: Timeline): TimelineDiffRange[] {
  const duration = Math.max(getTimelineDuration(current), getTimelineDuration(snapshot));
  const boundaries = collectTimelineBoundaries(current, snapshot, duration);
  const ranges: TimelineDiffRange[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (end - start <= 0.000001) {
      continue;
    }
    const sampleTime = start + (end - start) / 2;
    if (timelineSignatureAt(current, sampleTime) !== timelineSignatureAt(snapshot, sampleTime)) {
      ranges.push({ start, end });
    }
  }
  return mergeDiffRanges(ranges);
}

function collectTimelineBoundaries(current: Timeline, snapshot: Timeline, duration: number): number[] {
  const points = [0, duration];
  for (const timeline of [current, snapshot]) {
    for (const clip of timeline.tracks.flatMap((track) => track.clips)) {
      points.push(clip.start, clip.start + clip.duration);
    }
  }
  return Array.from(new Set(points.map((time) => round(Math.max(0, time)))))
    .filter((time) => time >= 0 && time <= duration)
    .sort((left, right) => left - right);
}

function timelineSignatureAt(timeline: Timeline, time: number): string {
  return timeline.tracks
    .map((track, trackIndex) => {
      const clips = track.clips
        .filter((clip) => time >= clip.start && time < clip.start + clip.duration)
        .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id))
        .map((clip) => clipSignature(clip));
      return `${trackIndex}:${track.type}:${track.muted === true ? 'muted' : 'live'}:${clips.join('|')}`;
    })
    .join('::');
}

function clipSignature(clip: Clip): string {
  return JSON.stringify({
    id: clip.id,
    type: clip.type,
    name: clip.name,
    start: clip.start,
    duration: clip.duration,
    trimStart: clip.trimStart,
    trimEnd: clip.trimEnd,
    speed: clip.speed,
    transform: clip.transform,
    colorCorrection: clip.colorCorrection,
    chromaKey: clip.chromaKey,
    masks: clip.masks,
    effects: clip.effects,
    mediaId: 'mediaId' in clip ? clip.mediaId : undefined,
    sequenceId: 'sequenceId' in clip ? clip.sequenceId : undefined,
    text: 'text' in clip ? clip.text : undefined,
    style: 'style' in clip ? clip.style : undefined,
    pathText: clip.type === 'text' ? clip.pathText : undefined,
    volume: 'volume' in clip ? clip.volume : undefined,
    muted: 'muted' in clip ? clip.muted : undefined,
    keyframes: clip.keyframes
  });
}

function mergeDiffRanges(ranges: TimelineDiffRange[]): TimelineDiffRange[] {
  const output: TimelineDiffRange[] = [];
  for (const range of ranges) {
    const previous = output.at(-1);
    if (previous && Math.abs(previous.end - range.start) <= 0.000001) {
      previous.end = range.end;
    } else {
      output.push({ ...range });
    }
  }
  return output.map((range) => ({ start: round(range.start), end: round(range.end) }));
}
