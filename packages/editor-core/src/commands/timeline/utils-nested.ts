import { ColorGradingGraph, createEmptyColorGradingGraph } from '../../color-grading/types';
import { normalizeCreditsRollSpeed, normalizeCreditsRows, normalizeCreditsStyle } from '../../credits-roll';
import { cloneEffects } from '../../effects';
import { cloneClipKeyframes, normalizeClipKeyframes } from '../../keyframes';
import { CollaborationNote, DEFAULT_NESTED_SEQUENCE_NAME, Project, ProjectAnnotation, ReviewAnnotation, Timeline, TimelineBookmark, TimelineMarker, TimelineNote, Track, createId, createNestedSequenceClip, createSequence, createTrack, normalizeAudioDenoise, normalizeChromaKey, normalizeClipPanoramaView, normalizeClipProjection, normalizeCollaborationNotes, normalizeColorCorrection, normalizeFrameInterpolation, normalizeMasks, normalizeMotionTrack, normalizeQualityEnhancement, normalizeSequenceFrameRate, normalizeSlowMotionMode, normalizeStabilization, normalizeTextPath, normalizeTimelineNotes, normalizeVideoRestoration, replaceProjectActiveTimeline } from '../../model';
import type { Clip } from '../../model';
import { normalizeMotionGraphic } from '../../motion-graphics';
import { setMulticamSwitch, trimMulticamSwitch } from '../../multicam';
import { normalizeRichTextDocument, normalizeTextArc, normalizeTextLayout, normalizeTextOpenTypeFeatures } from '../../text-layout';
import { round } from '../../time';
import { areClipsAdjacent, calculateSpeedCurveSourceDuration, getClipDisplayDuration, getClipSpeed, moveClip, replaceClip, trimClip } from '../../timeline';
import { findClip, findClipLocation, findTrack, getClipTotalSourceDuration, timelineHasOverlaps } from './utils';

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

/** 子剪辑操作命令 */

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

/** 添加调色节点 */
