import { round } from '../time';
import { createId, createNestedSequenceClip, createSequence, createTrack, DEFAULT_NESTED_SEQUENCE_NAME, normalizeColorCorrection, normalizeChromaKey, normalizeClipPanoramaView, normalizeClipProjection, normalizeFrameInterpolation, normalizeMasks, normalizeMotionTrack, normalizeQualityEnhancement, normalizeSequenceFrameRate, normalizeSlowMotionMode, normalizeStabilization, normalizeVideoRestoration, normalizeAudioDenoise, replaceProjectActiveTimeline, type Clip, type Project } from '../model';
import { normalizeClipKeyframes, cloneClipKeyframes } from '../keyframes';
import { cloneEffects } from '../effects';
import { normalizeRichTextDocument, normalizeTextArc, normalizeTextLayout, normalizeTextOpenTypeFeatures } from '../text-layout';
import { normalizeCreditsRollSpeed, normalizeCreditsRows, normalizeCreditsStyle } from '../credits-roll';
import { normalizeMotionGraphic } from '../motion-graphics';
import type { Command } from './command';
import { type ProjectAccessor, findClip, findClipLocation, findTrack, timelineHasOverlaps, insertClip, touchProject } from './helpers';

function cloneClipForNestedSequence<TClip extends Clip>(clip: TClip): TClip {
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

function packNestedSequence(project: Project, clipIds: string[], sequenceName: string): Project {
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

export class PackNestedSequenceCommand implements Command {
  readonly description = 'Pack nested sequence';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipIds: string[],
    private readonly sequenceName = DEFAULT_NESTED_SEQUENCE_NAME,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.after ??= packNestedSequence(this.before, this.clipIds, this.sequenceName);
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}
