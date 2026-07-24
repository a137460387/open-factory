import type {
  Clip,
  ClipGroupBatchPatch,
  ClipMask,
  MediaMetadata,
  Project,
  ProjectAnnotation,
  ProtectedRange,
  ReviewAnnotation,
  Timeline,
  TimelineBookmark,
  TimelineMarker,
  TimelineNote,
  Track,
  Transition,
  CollaborationNote,
  ColorCorrection,
  ChromaKey,
} from '../../model';
import type { ColorGradingGraph } from '../../color-grading/types';
import { createEmptyColorGradingGraph } from '../../color-grading/types';
import { round } from '../../time';
import {
  detectOverlap,
  getClipDisplayDuration,
  getClipSourceVisibleDuration,
  getClipSpeed,
  getTimelineDuration,
  moveClip,
  removeClip,
  replaceClip,
  splitClip,
  trimClip,
  calculateSpeedCurveSourceDuration,
  areClipsAdjacent,
} from '../../timeline';
import { applyProtectedRippleDeleteToTrack } from '../../timeline-protection';
import {
  normalizeColorCorrection,
  normalizeChromaKey,
  normalizeClipProjection,
  normalizeClipPanoramaView,
  normalizeAudioFadeDuration,
  normalizeAudioFadeCurve,
  normalizeAudioChannelRouting,
  normalizeAudioDenoise,
  normalizeAudioPitchSemitones,
  normalizeClipBorder,
  normalizeClipBeatMarkers,
  normalizeCollaborationNotes,
  normalizeDetectedBpm,
  normalizeClipSceneCuts,
  normalizeFrameInterpolation,
  normalizeMask,
  normalizeMasks,
  normalizeMotionTrack,
  normalizeProjectAnnotation,
  normalizeReviewAnnotation,
  normalizeTimelineNote,
  normalizeTimelineNotes,
  normalizeExportRanges,
  normalizeProtectedRanges,
  normalizeMediaMetadataEntry,
  normalizeQualityEnhancement,
  normalizeSequenceFrameRate,
  normalizeSlowMotionMode,
  normalizeStabilization,
  normalizeSubtitleSoundDesc,
  normalizeSubtitleSpeaker,
  normalizeSubtitleTrackType,
  normalizeTextPath,
  normalizeTimelineBookmark,
  normalizeTimelineBookmarks,
  normalizeTimelineMarker,
  normalizeTransform,
  normalizeTrackCompressor,
  normalizeTrackEQ,
  normalizeTrackPan,
  normalizeTrackVolume,
  normalizeVideoRestoration,
  replaceProjectActiveTimeline,
  createTrack,
  createSequence,
  createId,
  createNestedSequenceClip,
  createTimelineMarker,
  DEFAULT_NESTED_SEQUENCE_NAME,
  getProjectSequences,
  normalizeClipKeyframes,
  cloneClipKeyframes,
  type ClipKeyframes,
  type KeyframeProperty,
  type SubtitleTrackType,
  type SubtitleMode,
} from '../../model';

import { normalizeClipBlendMode } from '../../blend-modes';
import { normalizeClipContentAnalysis } from '../../content-analysis';
import { normalizeClipPitchData } from '../../audio-pitch';
import { normalizeDataSubtitleSource } from '../../data-subtitle';
import { normalizeSpatialAudio } from '../../spatial-audio';
import { normalizeMotionGraphic } from '../../motion-graphics';
import { normalizeRichTextDocument, normalizeTextLayout, normalizeTextOpenTypeFeatures, normalizeTextArc } from '../../text-layout';
import { cloneEffects, normalizeEffect, normalizeEffects } from '../../effects';
import { normalizeCreditsRows, normalizeCreditsRollSpeed, normalizeCreditsStyle } from '../../credits-roll';
import {
  setMulticamSwitch,
  trimMulticamSwitch,
  normalizeMulticamSequence,
} from '../../multicam';
import type { SequenceSettings } from '../../model-types';
import { recalculateClipStartsForFrameRate } from '../../sequence-settings';
import { createKeyframe, setKeyframeForProperty, removeKeyframeForProperty } from '../../keyframes';

import { normalizeSubtitleStyleTemplateStyle } from '../../subtitles/style-templates';
import type { TimelineLabelColor } from '../../timeline-color-labels';
import { normalizeTimelineLabelColor } from '../../timeline-color-labels';
import type { ClipSpatialAudio } from '../../spatial-audio';


export interface TimelineAccessor {
  getTimeline(): Timeline;
  setTimeline(timeline: Timeline): void;
}

export interface ProjectAccessor {
  getProject(): Project;
  setProject(project: Project): void;
}

/**
 * Throws if any of the given clip IDs belong to a locked track.
 * Used by clip-modifying commands to prevent editing locked tracks.
 */
export function assertClipsNotOnLockedTrack(timeline: Timeline, clipIds: string[]): void {
  const ids = new Set(clipIds);
  for (const track of timeline.tracks) {
    if (track.locked && track.clips.some((clip) => ids.has(clip.id))) {
      throw new Error(`Cannot modify clips on locked track "${track.name || track.id}". Unlock the track first.`);
    }
  }
}

export function insertClip(timeline: Timeline, clip: Clip, index?: number): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => {
      if (track.id !== clip.trackId) {
        return track;
      }
      const clips = [...track.clips];
      clips.splice(index ?? clips.length, 0, clip);
      return { ...track, clips };
    }),
  };
}

export function findTrack(timeline: Timeline, trackId: string): Track {
  const track = timeline.tracks.find((item) => item.id === trackId);
  if (!track) {
    throw new Error(`Track ${trackId} not found`);
  }
  return track;
}

export function findClip(timeline: Timeline, clipId: string): Clip {
  const clip = timeline.tracks.flatMap((track) => track.clips).find((item) => item.id === clipId);
  if (!clip) {
    throw new Error(`Clip ${clipId} not found`);
  }
  return clip;
}

export function findClipLocation(timeline: Timeline, clipId: string): { clip: Clip; trackId: string; index: number } {
  for (const track of timeline.tracks) {
    const index = track.clips.findIndex((clip) => clip.id === clipId);
    if (index !== -1) {
      return { clip: track.clips[index], trackId: track.id, index };
    }
  }
  throw new Error(`Clip ${clipId} not found`);
}

export function timelineHasOverlaps(timeline: Timeline): boolean {
  return timeline.tracks.some((track) =>
    track.clips.some((clip, index) =>
      track.clips
        .slice(index + 1)
        .some((other) => clip.start < other.start + other.duration && other.start < clip.start + clip.duration),
    ),
  );
}

export function getProjectActiveClipIds(project: Project): string[] {
  return project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.id));
}

export function removeClipsFromTimeline(timeline: Timeline, ids: Set<string>): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({ ...track, clips: track.clips.filter((clip) => !ids.has(clip.id)) })),
    transitions: (timeline.transitions ?? []).filter(
      (transition) => !ids.has(transition.fromClipId) && !ids.has(transition.toClipId),
    ),
  };
}

export function applyClipGroupBatchPatch(clip: Clip, patch: ClipGroupBatchPatch): Clip {
  let next = {
    ...clip,
    colorCorrection: patch.colorCorrection
      ? normalizeColorCorrection({ ...clip.colorCorrection, ...patch.colorCorrection })
      : normalizeColorCorrection(clip.colorCorrection),
  } as Clip;
  if (typeof patch.volume === 'number' && 'volume' in next) {
    next = { ...next, volume: normalizeTrackVolume(patch.volume) } as Clip;
  }
  if (
    typeof patch.speed === 'number' &&
    (next.type === 'video' || next.type === 'audio' || next.type === 'nested-sequence')
  ) {
    const speed = getClipSpeed({ speed: patch.speed });
    const duration = getClipDisplayDuration(getClipSourceVisibleDuration(clip), speed, next.keyframes);
    next = {
      ...next,
      speed,
      duration,
      fadeInDuration: normalizeAudioFadeDuration(next.fadeInDuration, duration),
      fadeOutDuration: normalizeAudioFadeDuration(next.fadeOutDuration, duration),
    } as Clip;
  }
  return next;
}

export interface LocalTimeRange {
  start: number;
  end: number;
}

export function normalizeLocalTimeRanges(ranges: LocalTimeRange[], maxDuration: number): LocalTimeRange[] {
  const duration = Math.max(0, maxDuration);
  const sorted = ranges
    .map((range) => ({
      start: round(Math.min(duration, Math.max(0, range.start))),
      end: round(Math.min(duration, Math.max(0, range.end))),
    }))
    .map((range) => ({ start: Math.min(range.start, range.end), end: Math.max(range.start, range.end) }))
    .filter((range) => range.end - range.start > 0.000001)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const merged: LocalTimeRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 0.000001) {
      previous.end = round(Math.max(previous.end, range.end));
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function buildKeptRanges(duration: number, removedRanges: LocalTimeRange[]): LocalTimeRange[] {
  const kept: LocalTimeRange[] = [];
  let cursor = 0;
  for (const range of normalizeLocalTimeRanges(removedRanges, duration)) {
    if (range.start > cursor + 0.000001) {
      kept.push({ start: cursor, end: range.start });
    }
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < duration - 0.000001) {
    kept.push({ start: cursor, end: duration });
  }
  return kept;
}

export function buildSplitRanges(duration: number, splitTimes: number[]): LocalTimeRange[] {
  const points = Array.from(new Set(splitTimes.map((time) => round(Math.min(duration, Math.max(0, time))))))
    .filter((time) => time > 0.000001 && time < duration - 0.000001)
    .sort((left, right) => left - right);
  const ranges: LocalTimeRange[] = [];
  let cursor = 0;
  for (const point of points) {
    ranges.push({ start: cursor, end: point });
    cursor = point;
  }
  ranges.push({ start: cursor, end: duration });
  return ranges.filter((range) => range.end - range.start > 0.000001);
}

export function sliceClipForLocalRange<TClip extends Clip>(clip: TClip, range: LocalTimeRange, nextStart: number): TClip {
  const speed = getClipSpeed(clip);
  const pieceDuration = round(range.end - range.start);
  const sourceDuration = round(clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd);
  const sourceRangeStart = calculateSpeedCurveSourceDuration(range.start, clip.keyframes, speed);
  const sourceRangeEnd = calculateSpeedCurveSourceDuration(range.end, clip.keyframes, speed);
  const pieceSourceDuration = round(Math.max(0, sourceRangeEnd - sourceRangeStart));
  const trimStart = round(clip.trimStart + sourceRangeStart);
  const trimEnd = round(Math.max(0, sourceDuration - trimStart - pieceSourceDuration));
  return {
    ...clip,
    id: createId('clip'),
    start: round(nextStart),
    duration: pieceDuration,
    trimStart,
    trimEnd,
    transform: { ...clip.transform },
    scenecuts: sliceClipSceneCuts(clip.scenecuts, range.start, pieceDuration),
    keyframes: sliceClipKeyframes(clip.keyframes, range.start, pieceDuration),
    effects: cloneEffects(clip.effects),
  } as TClip;
}

export function sliceClipSceneCuts(cuts: number[] | undefined, offset: number, duration: number): number[] | undefined {
  const localCuts = (cuts ?? [])
    .filter((time) => time > offset + 0.000001 && time < offset + duration - 0.000001)
    .map((time) => round(time - offset));
  return normalizeClipSceneCuts(localCuts, duration);
}

export function sliceClipKeyframes(
  keyframes: ClipKeyframes | undefined,
  offset: number,
  duration: number,
): ClipKeyframes | undefined {
  const cloned = cloneClipKeyframes(keyframes);
  if (!cloned) {
    return undefined;
  }
  const sliced: ClipKeyframes = {};
  for (const property of Object.keys(cloned) as KeyframeProperty[]) {
    const frames = cloned[property]?.flatMap((frame) => {
      if (frame.time < offset - 0.000001 || frame.time > offset + duration + 0.000001) {
        return [];
      }
      return [{ ...frame, time: round(Math.max(0, frame.time - offset)) }];
    });
    if (frames?.length) {
      sliced[property] = frames;
    }
  }
  return normalizeClipKeyframes(sliced, duration);
}

export function replaceClipWithSlices(
  timeline: Timeline,
  clipId: string,
  ranges: LocalTimeRange[],
  rippleRemovedGaps: boolean,
): Timeline {
  const { clip, trackId, index } = findClipLocation(timeline, clipId);
  const track = findTrack(timeline, trackId);
  let outputCursor = clip.start;
  const pieces = ranges.map((range) => {
    const start = rippleRemovedGaps ? outputCursor : clip.start + range.start;
    const piece = sliceClipForLocalRange(clip, range, start);
    outputCursor = round(outputCursor + piece.duration);
    return piece;
  });
  const clips = [...track.clips];
  clips.splice(index, 1, ...pieces);
  return {
    ...timeline,
    tracks: timeline.tracks.map((item) => (item.id === trackId ? { ...item, clips } : item)),
    transitions: (timeline.transitions ?? []).filter(
      (transition) => transition.fromClipId !== clip.id && transition.toClipId !== clip.id,
    ),
  };
}

export function rippleDeleteTrackClips(track: Track, selectedIds: Set<string>, protectedRanges: ProtectedRange[] = []): Track {
  if (protectedRanges.length > 0) {
    return applyProtectedRippleDeleteToTrack(track, selectedIds, protectedRanges);
  }
  const removedIntervals = mergeTimelineIntervals(
    track.clips
      .filter((clip) => selectedIds.has(clip.id))
      .map((clip) => ({ start: clip.start, end: round(clip.start + clip.duration) })),
  );
  if (removedIntervals.length === 0) {
    return track;
  }
  return {
    ...track,
    clips: track.clips
      .filter((clip) => !selectedIds.has(clip.id))
      .map((clip) => {
        const shift = removedIntervals.reduce(
          (total, interval) => (clip.start >= interval.end - 0.000001 ? total + interval.end - interval.start : total),
          0,
        );
        return shift > 0 ? moveClip(clip, round(clip.start - shift)) : clip;
      }),
  };
}

export function mergeTimelineIntervals(intervals: LocalTimeRange[]): LocalTimeRange[] {
  const sorted = intervals
    .map((interval) => ({
      start: round(Math.max(0, Math.min(interval.start, interval.end))),
      end: round(Math.max(0, Math.max(interval.start, interval.end))),
    }))
    .filter((interval) => interval.end - interval.start > 0.000001)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: LocalTimeRange[] = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end + 0.000001) {
      previous.end = round(Math.max(previous.end, interval.end));
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

export function findTrackGapAtTime(track: Track, time: number): LocalTimeRange | undefined {
  const sortedClips = [...track.clips].sort(
    (left, right) => left.start - right.start || left.id.localeCompare(right.id),
  );
  const target = round(Math.max(0, time));
  let cursor = 0;
  for (const clip of sortedClips) {
    if (clip.start - cursor > 0.000001 && target >= cursor - 0.000001 && target <= clip.start + 0.000001) {
      return { start: round(cursor), end: round(clip.start) };
    }
    cursor = Math.max(cursor, clip.start + clip.duration);
  }
  return undefined;
}

export function closeTrackGap(track: Track, gapStart: number, gapEnd: number): Track {
  const gapDuration = round(gapEnd - gapStart);
  return {
    ...track,
    clips: track.clips.map((clip) =>
      clip.start >= gapEnd - 0.000001 ? moveClip(clip, round(clip.start - gapDuration)) : clip,
    ),
  };
}

export function buildRollingTrimClips(
  left: Clip,
  right: Clip,
  requestedDelta: number,
  minDuration: number,
): { left: Clip; right: Clip } {
  const minClipDuration = Math.max(0.000001, minDuration);
  const leftSourceDuration = getClipTotalSourceDuration(left);
  const rightSourceDuration = getClipTotalSourceDuration(right);
  const leftMaxDuration = getClipDisplayDuration(
    Math.max(0, leftSourceDuration - left.trimStart),
    getClipSpeed(left),
    left.keyframes,
  );
  const rightMaxDuration = getClipDisplayDuration(
    Math.max(0, rightSourceDuration - right.trimEnd),
    getClipSpeed(right),
    right.keyframes,
  );
  const maxPositive = Math.max(0, Math.min(leftMaxDuration - left.duration, right.duration - minClipDuration));
  const maxNegative = -Math.max(0, Math.min(left.duration - minClipDuration, rightMaxDuration - right.duration));
  const delta = round(Math.min(maxPositive, Math.max(maxNegative, requestedDelta)));
  if (Math.abs(delta) <= 0.000001) {
    throw new Error('Rolling trim has no available media at this boundary');
  }

  const leftDuration = round(left.duration + delta);
  const rightDuration = round(right.duration - delta);
  const leftVisibleSourceDuration = calculateSpeedCurveSourceDuration(leftDuration, left.keyframes, getClipSpeed(left));
  const rightVisibleSourceDuration = calculateSpeedCurveSourceDuration(
    rightDuration,
    right.keyframes,
    getClipSpeed(right),
  );
  const leftTrimEnd = round(Math.max(0, leftSourceDuration - left.trimStart - leftVisibleSourceDuration));
  const rightTrimStart = round(Math.max(0, rightSourceDuration - right.trimEnd - rightVisibleSourceDuration));
  const leftTrimmed = trimClip(left, left.trimStart, leftTrimEnd);
  const rightTrimmed = {
    ...trimClip(right, rightTrimStart, right.trimEnd),
    start: round(left.start + leftTrimmed.duration),
  } as Clip;
  return { left: leftTrimmed, right: rightTrimmed };
}

export interface SlideClipEditResult {
  timeline: Timeline;
  leftClip: Clip;
  clip: Clip;
  rightClip: Clip;
  delta: number;
}

export function buildSlipClip<TClip extends Clip>(clip: TClip, requestedDelta: number): TClip {
  const speed = getClipSpeed(clip);
  const requestedSourceDelta =
    requestedDelta >= 0
      ? calculateSpeedCurveSourceDuration(requestedDelta, clip.keyframes, speed)
      : -calculateSpeedCurveSourceDuration(Math.abs(requestedDelta), clip.keyframes, speed);
  const sourceDelta = round(Math.min(clip.trimEnd, Math.max(-clip.trimStart, requestedSourceDelta)));
  const slipped = trimClip(clip, round(clip.trimStart + sourceDelta), round(clip.trimEnd - sourceDelta));
  return { ...slipped, start: clip.start, duration: clip.duration } as TClip;
}

export function buildSlideClipEdit(
  timeline: Timeline,
  clipId: string,
  requestedDelta: number,
  minDuration = 1 / 30,
): SlideClipEditResult {
  const location = findClipLocation(timeline, clipId);
  const track = findTrack(timeline, location.trackId);
  const sorted = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  const index = sorted.findIndex((clip) => clip.id === clipId);
  const left = sorted[index - 1];
  const clip = sorted[index];
  const right = sorted[index + 1];
  if (!left || !clip || !right || !areClipsAdjacent(left, clip) || !areClipsAdjacent(clip, right)) {
    throw new Error('Slide edit requires adjacent clips on both sides');
  }

  const minClipDuration = Math.max(0.000001, minDuration);
  const leftSourceDuration = getClipTotalSourceDuration(left);
  const rightSourceDuration = getClipTotalSourceDuration(right);
  const leftMaxDuration = getClipDisplayDuration(
    Math.max(0, leftSourceDuration - left.trimStart),
    getClipSpeed(left),
    left.keyframes,
  );
  const rightMaxDuration = getClipDisplayDuration(
    Math.max(0, rightSourceDuration - right.trimEnd),
    getClipSpeed(right),
    right.keyframes,
  );
  const maxPositive = Math.max(0, Math.min(leftMaxDuration - left.duration, right.duration - minClipDuration));
  const maxNegative = -Math.max(0, Math.min(left.duration - minClipDuration, rightMaxDuration - right.duration));
  const delta = round(Math.min(maxPositive, Math.max(maxNegative, requestedDelta)));
  if (Math.abs(delta) <= 0.000001) {
    throw new Error('Slide edit has no available media at this position');
  }

  const nextLeftDuration = round(left.duration + delta);
  const nextRightDuration = round(right.duration - delta);
  const leftVisibleSourceDuration = calculateSpeedCurveSourceDuration(
    nextLeftDuration,
    left.keyframes,
    getClipSpeed(left),
  );
  const rightVisibleSourceDuration = calculateSpeedCurveSourceDuration(
    nextRightDuration,
    right.keyframes,
    getClipSpeed(right),
  );
  const nextLeft = trimClip(
    left,
    left.trimStart,
    round(Math.max(0, leftSourceDuration - left.trimStart - leftVisibleSourceDuration)),
  );
  const nextClip = moveClip(clip, round(clip.start + delta));
  const nextRight = {
    ...trimClip(
      right,
      round(Math.max(0, rightSourceDuration - right.trimEnd - rightVisibleSourceDuration)),
      right.trimEnd,
    ),
    start: round(right.start + delta),
  } as Clip;
  const byId = new Map([
    [nextLeft.id, nextLeft],
    [nextClip.id, nextClip],
    [nextRight.id, nextRight],
  ]);
  const nextTimeline = {
    ...timeline,
    tracks: timeline.tracks.map((item) =>
      item.id === track.id ? { ...item, clips: item.clips.map((itemClip) => byId.get(itemClip.id) ?? itemClip) } : item,
    ),
    transitions: timeline.transitions ?? [],
  };
  if (timelineHasOverlaps(nextTimeline)) {
    throw new Error('Clip overlaps another clip on this track');
  }
  return { timeline: nextTimeline, leftClip: nextLeft, clip: nextClip, rightClip: nextRight, delta };
}

export function getClipTotalSourceDuration(clip: Clip): number {

export function normalizeAssetIdSet(assetIds: string | string[]): Set<string> {
  const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
  const normalized = new Set(ids.map((assetId) => assetId.trim()).filter(Boolean));
  if (normalized.size === 0) {
    throw new Error('No media assets selected');
  }
  return normalized;
}

export function assertMediaAssetsExist(project: Project, assetIds: Set<string>): void {
  const available = new Set(project.media.map((asset) => asset.id));
  const missing = Array.from(assetIds).filter((assetId) => !available.has(assetId));
  if (missing.length > 0) {
    throw new Error(`Media asset not found: ${missing.join(', ')}`);
  }
}

export function collectProjectMediaIds(project: Project): Set<string> {
  const synced = replaceProjectActiveTimeline(project, project.timeline);
  const ids = new Set<string>();
  for (const sequence of getProjectSequences(synced)) {
    for (const clip of sequence.timeline.tracks.flatMap((track) => track.clips)) {
      if ('mediaId' in clip) {
        ids.add(clip.mediaId);
      }
    }
  }
  return ids;
}

export function removeMediaAssets(project: Project, removeIds: Set<string>): Project {
  const mediaMetadata = filterMediaMetadata(project.mediaMetadata, removeIds);
  return touchProject({
    ...project,
    media: project.media.filter((asset) => !removeIds.has(asset.id)),
    mediaMetadata,
  });
}

export function mergeMediaReferences(project: Project, keepAssetId: string, removeIds: Set<string>): Project {
  const synced = replaceProjectActiveTimeline(project, project.timeline);
  const sequences = getProjectSequences(synced).map((sequence) => ({
    ...sequence,
    timeline: replaceTimelineMediaReferences(sequence.timeline, keepAssetId, removeIds),
  }));
  const activeTimeline =
    sequences.find((sequence) => sequence.id === synced.activeSequenceId)?.timeline ?? synced.timeline;
  return touchProject({
    ...synced,
    media: synced.media.filter((asset) => !removeIds.has(asset.id)),
    mediaMetadata: filterMediaMetadata(synced.mediaMetadata, removeIds),
    timeline: activeTimeline,
    sequences,
  });
}

export function replaceTimelineMediaReferences(timeline: Timeline, keepAssetId: string, removeIds: Set<string>): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (!('mediaId' in clip) || !removeIds.has(clip.mediaId)) {
          return clip;
        }
        return { ...clip, mediaId: keepAssetId } as Clip;
      }),
    })),
  };
}

export function filterMediaMetadata(
  metadata: Record<string, MediaMetadata>,
  removeIds: Set<string>,
): Record<string, MediaMetadata> {
  const next = { ...metadata };
  for (const assetId of removeIds) {
    delete next[assetId];
  }
  return next;
}

export function touchProject(project: Project): Project {
  return { ...project, updatedAt: new Date().toISOString() };
}

export function resolveSubtitleImportTarget(timeline: Timeline, targetTrackId: string | undefined): Track | undefined {
  const track = targetTrackId
    ? timeline.tracks.find((item) => item.id === targetTrackId)
    : timeline.tracks.find((item) => item.type === 'subtitle');
  if (track && track.type !== 'subtitle') {
    throw new Error('Subtitle import target must be a subtitle track');
  }
  return track;
}

export function replaceClipWithGeneratedClips(timeline: Timeline, sourceClipId: string, clips: Clip[]): Timeline {
  const withoutSource = removeClip(timeline, sourceClipId).timeline;
  return insertGeneratedClips(withoutSource, clips);
}

export function insertGeneratedClips(timeline: Timeline, clips: Clip[]): Timeline {
  let next = timeline;
  for (const clip of clips) {
    const track = findTrack(next, clip.trackId);
    if (track.clips.some((item) => item.id === clip.id)) {
      throw new Error(`Clip ${clip.id} already exists`);
    }
    if (detectOverlap(track, clip)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    next = insertClip(next, clip);
  }
  return sortTimelineClips(next);
}

export function sortTimelineClips(timeline: Timeline): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id)),
    })),
  };
}

export function cloneCommandValue<T>(value: T): T {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);
}

export function asReplaceableMediaClip(clip: Clip): ReplaceableMediaClip {
  if (!isReplaceableMediaClip(clip)) {
    throw new Error('Media replacement requires a media clip');
  }
  return clip;
}

export function isReplaceableMediaClip(clip: Clip): clip is ReplaceableMediaClip {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'image';
}

export function mergeChromaKeyPatch(before: ChromaKey | undefined, patch: Partial<ChromaKey> | undefined): ChromaKey {
  if (!patch) {
    return normalizeChromaKey(before);
  }
  if (patch.color && !patch.colors) {
    const current = normalizeChromaKey(before);
    return normalizeChromaKey({
      ...current,
      ...patch,
      colors: [patch.color, ...current.colors.slice(1)],
    });
  }
  return normalizeChromaKey({ ...before, ...patch });
}

export function isPiPVisualClip(clip: Clip): boolean {
  return clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence';
}

export function clampTrimValues(
  clip: Clip,
  requestedTrimStart: number,
  requestedTrimEnd: number,
  minDuration: number,
): { trimStart: number; trimEnd: number } {
  const sourceDuration = Math.max(clip.trimStart + getClipSourceVisibleDuration(clip) + clip.trimEnd, 0);
  const minimumDuration = Math.max(0.001, minDuration);
  const maxCombinedTrim = Math.max(0, sourceDuration - minimumDuration);
  let trimStart = round(Math.min(maxCombinedTrim, Math.max(0, requestedTrimStart)));
  let trimEnd = round(Math.min(maxCombinedTrim, Math.max(0, requestedTrimEnd)));
  if (trimStart + trimEnd <= maxCombinedTrim) {
    return { trimStart, trimEnd };
  }
  const trimStartChanged = Math.abs(trimStart - clip.trimStart) >= Math.abs(trimEnd - clip.trimEnd);
  if (trimStartChanged) {
    trimStart = round(Math.max(0, maxCombinedTrim - trimEnd));
  } else {
    trimEnd = round(Math.max(0, maxCombinedTrim - trimStart));
  }
  return { trimStart, trimEnd };
}

export function applySpeedKeyframeDuration(before: Clip, after: Clip, property: KeyframeProperty): Clip {
  if (property !== 'speed') {
    return after;
  }
  const duration = getClipDisplayDuration(getClipSourceVisibleDuration(before), after.speed, after.keyframes);
  return {
    ...after,
    duration,
    keyframes: normalizeClipKeyframes(cloneClipKeyframes(after.keyframes), duration),
  } as Clip;
}

export function packNestedSequence(project: Project, clipIds: string[], sequenceName: string): Project {
  const uniqueIds = Array.from(new Set(clipIds));
  if (uniqueIds.length === 0) {
    throw new Error('No clips selected for nested sequence');
  }
  const timeline = project.timeline;
  const selectedIds = new Set(uniqueIds);
  const trackIndexById = new Map(timeline.tracks.map((track, index) => [track.id, index]));
  const locations = uniqueIds
    .map((id) => findClipLocation(timeline, id))
    .sort((left, right) => {
      return (
        (trackIndexById.get(left.trackId) ?? 0) - (trackIndexById.get(right.trackId) ?? 0) ||
        left.clip.start - right.clip.start
      );
    });
  const start = round(Math.min(...locations.map((location) => location.clip.start)));
  const end = round(Math.max(...locations.map((location) => location.clip.start + location.clip.duration)));
  const duration = round(Math.max(0.001, end - start));
  const sequenceId = createId('sequence');
  const name = sequenceName.trim() || DEFAULT_NESTED_SEQUENCE_NAME;
  const target = locations[0];
  const targetTrack = timeline.tracks.find((track) => track.id === target.trackId);
  if (!targetTrack) {
    throw new Error(`Track ${target.trackId} not found`);
  }
  const blocked = targetTrack.clips.some(
    (clip) => !selectedIds.has(clip.id) && clip.start < end && clip.start + clip.duration > start,
  );
  if (blocked) {
    throw new Error('Nested sequence would overlap an unselected clip');
  }

  const nestedTimeline = {
    tracks: timeline.tracks
      .map((track) =>
        createTrack({
          ...track,
          clips: track.clips
            .filter((clip) => selectedIds.has(clip.id))
            .map((clip) => ({
              ...cloneClipForNestedSequence(clip),
              start: round(clip.start - start),
              trackId: track.id,
            })),
        }),
      )
      .filter((track) => track.clips.length > 0),
    transitions: (timeline.transitions ?? []).filter(
      (transition) => selectedIds.has(transition.fromClipId) && selectedIds.has(transition.toClipId),
    ),
    markers: (timeline.markers ?? [])
      .filter((marker) => marker.time >= start && marker.time <= end)
      .map((marker) => ({ ...marker, time: round(marker.time - start) })),
  };

  const nestedClip = createNestedSequenceClip({
    id: createId('clip'),
    type: 'nested-sequence',
    name,
    trackId: target.trackId,
    sequenceId,
    start,
    duration,
    trimStart: 0,
    trimEnd: 0,
  });
  const nextTimeline = {
    ...timeline,
    tracks: timeline.tracks.map((track) => {
      const kept = track.clips.filter((clip) => !selectedIds.has(clip.id));
      if (track.id !== target.trackId) {
        return { ...track, clips: kept };
      }
      const insertIndex = kept.findIndex((clip) => clip.start > nestedClip.start);
      const clips =
        insertIndex === -1
          ? [...kept, nestedClip]
          : [...kept.slice(0, insertIndex), nestedClip, ...kept.slice(insertIndex)];
      return { ...track, clips };
    }),
    transitions: (timeline.transitions ?? []).filter(
      (transition) => !selectedIds.has(transition.fromClipId) && !selectedIds.has(transition.toClipId),
    ),
  };
  if (timelineHasOverlaps(nextTimeline)) {
    throw new Error('Nested sequence would overlap another clip');
  }

  const syncedProject = replaceProjectActiveTimeline(project, nextTimeline);
  return {
    ...syncedProject,
    sequences: [
      ...syncedProject.sequences,
      createSequence({
        id: sequenceId,
        name,
        timeline: nestedTimeline,
      }),
    ],
  };
}

export function cutMulticamClip(project: Project, clipId: string, sceneTime: number, angleId: string): Project {
  const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
  const timeline = syncedProject.timeline;
  const clip = findClip(timeline, clipId);
  if (clip.type !== 'nested-sequence' || !clip.multicam) {
    throw new Error('Clip is not a multicam sequence');
  }
  if (sceneTime < clip.start - 0.000001 || sceneTime > clip.start + clip.duration + 0.000001) {
    throw new Error('Multicam cut time must be inside the clip bounds');
  }
  const localTime = round(Math.min(clip.duration, Math.max(0, sceneTime - clip.start + clip.trimStart)));
  const switches = setMulticamSwitch(clip.multicam, localTime, angleId, clip.duration);
  return replaceProjectActiveTimeline(
    syncedProject,
    replaceClip(timeline, {
      ...clip,
      multicam: {
        ...clip.multicam,
        switches,
      },
    }),
  );
}

export function trimMulticamClip(
  project: Project,
  clipId: string,
  switchId: string,
  frameDelta: number,
  fps: number,
): Project {
  const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
  const timeline = syncedProject.timeline;
  const clip = findClip(timeline, clipId);
  if (clip.type !== 'nested-sequence' || !clip.multicam) {
    throw new Error('Clip is not a multicam sequence');
  }
  const switches = trimMulticamSwitch(clip.multicam, switchId, frameDelta, fps, clip.duration);
  return replaceProjectActiveTimeline(
    syncedProject,
    replaceClip(timeline, {
      ...clip,
      multicam: {
        ...clip.multicam,
        switches,
      },
    }),
  );
}

export function cloneClipForNestedSequence<TClip extends Clip>(clip: TClip): TClip {
  const cloned = {
    ...clip,
    colorCorrection: normalizeColorCorrection(clip.colorCorrection),
    transform: { ...clip.transform },
    chromaKey: normalizeChromaKey(clip.chromaKey),
    stabilization: normalizeStabilization(clip.stabilization),
    frameInterpolation: normalizeFrameInterpolation(clip.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(clip.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(clip.audioDenoise),
    videoRestoration: normalizeVideoRestoration(clip.videoRestoration),
    qualityEnhancement: normalizeQualityEnhancement(clip.qualityEnhancement),
    projection: normalizeClipProjection(clip.projection),
    panorama: normalizeClipPanoramaView(clip.panorama),
    masks: normalizeMasks(clip.masks),
    motionTrack: normalizeMotionTrack(clip.motionTrack, clip.duration),
    sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
    keyframes: normalizeClipKeyframes(cloneClipKeyframes(clip.keyframes), clip.duration),
    effects: cloneEffects(clip.effects),
  };
  if (clip.type === 'credits') {
    return {
      ...cloned,
      rows: normalizeCreditsRows(clip.rows, clip.text),
      rollSpeed: normalizeCreditsRollSpeed(clip.rollSpeed),
      style: normalizeCreditsStyle(clip.style),
    } as TClip;
  }
  if (clip.type === 'motion-graphic') {
    return {
      ...cloned,
      motionGraphic: normalizeMotionGraphic(clip.motionGraphic, clip.duration),
    } as TClip;
  }
  if (clip.type === 'text' || clip.type === 'subtitle') {
    if (clip.type === 'text') {
      return {
        ...cloned,
        text: clip.text,
        style: { ...clip.style },
        richText: normalizeRichTextDocument(clip.richText, clip.text),
        textLayout: normalizeTextLayout(clip.textLayout),
        openTypeFeatures: normalizeTextOpenTypeFeatures(clip.openTypeFeatures),
        arcText: normalizeTextArc(clip.arcText),
        pathText: normalizeTextPath(clip.pathText),
      } as TClip;
    }
    return { ...cloned, style: { ...clip.style } } as TClip;
  }
  return cloned as TClip;
}

export function sortMarkers(markers: TimelineMarker[]): TimelineMarker[] {
  return [...markers].sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function sortAnnotations(annotations: ProjectAnnotation[]): ProjectAnnotation[] {
  return [...annotations].sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function sortReviewAnnotations(annotations: ReviewAnnotation[]): ReviewAnnotation[] {
  return [...annotations].sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function sortCollaborationNotes(notes: CollaborationNote[]): CollaborationNote[] {
  return normalizeCollaborationNotes(notes);
}

export function sortTimelineNotes(notes: TimelineNote[]): TimelineNote[] {
  return normalizeTimelineNotes(notes);
}

export function sortBookmarks(bookmarks: TimelineBookmark[]): TimelineBookmark[] {
  return [...bookmarks].sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function updateClipColorGradingGraph(
  project: Project,
  clipId: string,
  updater: (graph: ColorGradingGraph) => ColorGradingGraph,
): Project {
  const timeline = project.timeline;
  const tracks = timeline.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (clip.id !== clipId) return clip;
      const currentGraph = clip.colorGradingGraph ?? createEmptyColorGradingGraph();
      return { ...clip, colorGradingGraph: updater(currentGraph) };
    }),
  }));
  return { ...project, timeline: { ...timeline, tracks } };
}