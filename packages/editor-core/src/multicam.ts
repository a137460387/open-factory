import {
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  DEFAULT_NESTED_SEQUENCE_NAME,
  createId,
  createNestedSequenceClip,
  createSequence,
  createTrack,
  getProjectActiveSequenceId,
  getProjectSequences,
  normalizeAudioDenoise,
  normalizeChromaKey,
  normalizeMotionTrack,
  normalizeMulticamSequence,
  normalizeSlowMotionMode,
  replaceProjectActiveTimeline,
  type Clip,
  type MulticamAngle,
  type MulticamClip,
  type MulticamClipAngle,
  type MulticamSequence,
  type MulticamSwitch,
  type Project,
  type SwitchPoint,
  type Timeline,
  type Track
} from './model';
import { cloneEffects, normalizeEffects } from './effects';
import { cloneClipKeyframes, normalizeClipKeyframes } from './keyframes';
import { detectOverlap } from './timeline';
import { framesToSeconds, parseTimecodeToSeconds, round, secondsToFrames, secondsToTimecode } from './time';

export interface MulticamCreateOptions {
  sequenceName?: string;
  offsetsByClipId?: Record<string, number>;
}

export interface MulticamCreateResult {
  project: Project;
  multicamClipId: string;
  sequenceId: string;
}

export interface MulticamSwitchHistoryEntry {
  switchId: string;
  time: number;
  endTime: number;
  duration: number;
  angleId: string;
  angleName: string;
  angleIndex: number;
  timecode: string;
  durationTimecode: string;
  tooFrequent: boolean;
}

export interface MulticamSwitchWarning {
  fromSwitchId: string;
  toSwitchId: string;
  frameGap: number;
}

export interface ParsedMulticamTimecode {
  raw: string;
  seconds: number;
  totalFrames: number;
  hours: number;
  minutes: number;
  secondsPart: number;
  frames: number;
}

export interface MulticamTimecodeSyncPoint {
  clipId: string;
  timecode: string;
}

export interface MulticamManualSyncPoint {
  clipId: string;
  markerTime: number;
}

interface ClipLocation {
  clip: Extract<Clip, { mediaId: string }>;
  track: Track;
  index: number;
}

export function calculateAudioAlignmentOffset(
  reference: ArrayLike<number>,
  candidate: ArrayLike<number>,
  sampleRate: number,
  maxOffsetSeconds = 5
): number {
  const rate = Math.max(1, Math.round(sampleRate || 1));
  const maxLag = Math.min(Math.max(reference.length, candidate.length) - 1, Math.max(0, Math.round(maxOffsetSeconds * rate)));
  if (reference.length === 0 || candidate.length === 0 || maxLag <= 0) {
    return 0;
  }
  let bestLag = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let lag = -maxLag; lag <= maxLag; lag += 1) {
    let score = 0;
    let count = 0;
    for (let refIndex = 0; refIndex < reference.length; refIndex += 1) {
      const candidateIndex = refIndex - lag;
      if (candidateIndex < 0 || candidateIndex >= candidate.length) {
        continue;
      }
      score += reference[refIndex] * candidate[candidateIndex];
      count += 1;
    }
    if (count === 0) {
      continue;
    }
    const normalized = score / count;
    if (normalized > bestScore) {
      bestScore = normalized;
      bestLag = lag;
    }
  }
  return round(bestLag / rate);
}

export function parseLtcTimecode(value: string, fps = 30): ParsedMulticamTimecode | undefined {
  const match = /(\d{2}:\d{2}:\d{2})[:;](\d{2})/.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const normalized = `${match[1]}:${match[2]}`;
  const parsed = parseTimecodeToSeconds(normalized, { fps });
  if (!parsed.ok) {
    return undefined;
  }
  return {
    raw: value,
    seconds: parsed.value.seconds,
    totalFrames: parsed.value.totalFrames,
    hours: parsed.value.hours,
    minutes: parsed.value.minutes,
    secondsPart: parsed.value.secondsPart,
    frames: parsed.value.frames
  };
}

export const parseVitcTimecode = parseLtcTimecode;

export function calculateTimecodeAlignmentOffsets(points: MulticamTimecodeSyncPoint[], referenceClipId: string, fps = 30): Record<string, number> {
  const parsed = new Map<string, ParsedMulticamTimecode>();
  for (const point of points) {
    const timecode = parseLtcTimecode(point.timecode, fps);
    if (timecode) {
      parsed.set(point.clipId, timecode);
    }
  }
  const reference = parsed.get(referenceClipId);
  if (!reference) {
    return {};
  }
  return Object.fromEntries(Array.from(parsed.entries()).map(([clipId, timecode]) => [clipId, round(reference.seconds - timecode.seconds)]));
}

export function calculateManualMarkerAlignmentOffsets(points: MulticamManualSyncPoint[], referenceClipId: string): Record<string, number> {
  const reference = points.find((point) => point.clipId === referenceClipId);
  if (!reference || !Number.isFinite(reference.markerTime)) {
    return {};
  }
  return Object.fromEntries(
    points
      .filter((point) => Number.isFinite(point.markerTime))
      .map((point) => [point.clipId, round(reference.markerTime - Math.max(0, point.markerTime))])
  );
}

export function setMulticamSwitch(multicam: MulticamSequence, time: number, angleId: string, duration: number): MulticamSwitch[] {
  const normalized = normalizeMulticamSequence(multicam, duration);
  if (!normalized || !normalized.angles.some((angle) => angle.id === angleId)) {
    throw new Error('Invalid multicam angle');
  }
  const switchTime = round(Math.min(Math.max(0, time), duration));
  const kept = normalized.switches.filter((item) => Math.abs(item.time - switchTime) > 0.000001);
  return normalizeMulticamSequence(
    {
      ...normalized,
      switches: [...kept, { id: createId('multicam-switch'), time: switchTime, angleId }]
    },
    duration
  )!.switches;
}

export function getActiveMulticamAngle(multicam: MulticamSequence, time: number): MulticamAngle {
  const normalized = normalizeMulticamSequence(multicam);
  if (!normalized) {
    throw new Error('Invalid multicam sequence');
  }
  const switchTime = round(Math.max(0, time));
  const activeSwitch = [...normalized.switches].reverse().find((item) => item.time <= switchTime) ?? normalized.switches[0];
  return normalized.angles.find((angle) => angle.id === activeSwitch.angleId) ?? normalized.angles[0];
}

export function buildMulticamSwitchHistory(multicam: MulticamSequence, duration: number, fps = 30): MulticamSwitchHistoryEntry[] {
  const normalized = normalizeMulticamSequence(multicam, duration);
  if (!normalized) {
    return [];
  }
  const warningTargets = new Set(findFrequentMulticamSwitchWarnings(normalized, duration, fps).map((warning) => warning.toSwitchId));
  return normalized.switches.map((item, index) => {
    const nextTime = normalized.switches[index + 1]?.time ?? duration;
    const angleIndex = Math.max(0, normalized.angles.findIndex((angle) => angle.id === item.angleId));
    const angle = normalized.angles[angleIndex] ?? normalized.angles[0];
    const segmentDuration = round(Math.max(0, nextTime - item.time));
    return {
      switchId: item.id,
      time: item.time,
      endTime: round(Math.max(item.time, nextTime)),
      duration: segmentDuration,
      angleId: item.angleId,
      angleName: angle?.name ?? item.angleId,
      angleIndex,
      timecode: secondsToTimecode(item.time, fps),
      durationTimecode: secondsToTimecode(segmentDuration, fps),
      tooFrequent: warningTargets.has(item.id)
    };
  });
}

export function serializeMulticamSwitchHistory(multicam: MulticamSequence, duration: number, fps = 30): string {
  return JSON.stringify(
    {
      version: 1,
      fps,
      duration: round(Math.max(0, duration)),
      switches: buildMulticamSwitchHistory(multicam, duration, fps)
    },
    null,
    2
  );
}

export function findFrequentMulticamSwitchWarnings(multicam: MulticamSequence, duration: number, fps = 30, minFrames = 12): MulticamSwitchWarning[] {
  const normalized = normalizeMulticamSequence(multicam, duration);
  if (!normalized) {
    return [];
  }
  const warnings: MulticamSwitchWarning[] = [];
  for (let index = 1; index < normalized.switches.length; index += 1) {
    const previous = normalized.switches[index - 1];
    const current = normalized.switches[index];
    const frameGap = secondsToFrames(Math.max(0, current.time - previous.time), fps);
    if (frameGap < minFrames) {
      warnings.push({ fromSwitchId: previous.id, toSwitchId: current.id, frameGap });
    }
  }
  return warnings;
}

export function trimMulticamSwitch(multicam: MulticamSequence, switchId: string, frameDelta: number, fps: number, duration: number): MulticamSwitch[] {
  const normalized = normalizeMulticamSequence(multicam, duration);
  if (!normalized) {
    throw new Error('Invalid multicam sequence');
  }
  const index = normalized.switches.findIndex((item) => item.id === switchId);
  if (index < 0) {
    throw new Error('Invalid multicam switch');
  }
  const frameDuration = framesToSeconds(1, fps);
  const previous = normalized.switches[index - 1];
  const next = normalized.switches[index + 1];
  const minTime = previous ? previous.time + frameDuration : 0;
  const maxTime = next ? next.time - frameDuration : duration;
  const current = normalized.switches[index];
  const time = round(Math.min(Math.max(current.time + framesToSeconds(frameDelta, fps), minTime), Math.max(minTime, maxTime)));
  return normalizeMulticamSequence(
    {
      ...normalized,
      switches: normalized.switches.map((item) => (item.id === switchId ? { ...item, time } : item))
    },
    duration
  )!.switches;
}

export function createMulticamSequenceProject(project: Project, clipIds: string[], options: MulticamCreateOptions = {}): MulticamCreateResult {
  const uniqueIds = Array.from(new Set(clipIds));
  if (uniqueIds.length < 2 || uniqueIds.length > 8) {
    throw new Error('Multicam requires 2 to 8 clips');
  }

  const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
  const activeSequenceId = getProjectActiveSequenceId(syncedProject);
  const activeTimeline = syncedProject.timeline;
  const locations = uniqueIds.map((id) => findVisualClipLocation(activeTimeline, id));
  const minStart = Math.min(...locations.map(({ clip }) => clip.start));
  const sequenceId = createId('sequence');
  const sequenceName = options.sequenceName?.trim() || DEFAULT_NESTED_SEQUENCE_NAME;
  const selected = new Set(uniqueIds);

  const angles: MulticamAngle[] = [];
  const sequenceTracks = locations.map(({ clip }, index) => {
    const offset = round(Math.max(0, clip.start - minStart + (options.offsetsByClipId?.[clip.id] ?? 0)));
    const trackId = `multicam-track-${index + 1}`;
    const nestedClip = cloneAngleClip(clip, trackId, offset);
    angles.push({
      id: `angle-${index + 1}`,
      clipId: nestedClip.id,
      trackId,
      name: clip.name || `Camera ${index + 1}`,
      offset
    });
    return createTrack({ id: trackId, type: 'video', name: `Camera ${index + 1}`, clips: [nestedClip] });
  });
  const duration = round(Math.max(...sequenceTracks.flatMap((track) => track.clips.map((clip) => clip.start + clip.duration))));
  const targetTrack = locations[0].track;
  const multicamClip = createNestedSequenceClip({
    id: createId('clip'),
    type: 'nested-sequence',
    name: sequenceName,
    trackId: targetTrack.id,
    sequenceId,
    start: minStart,
    duration,
    trimStart: 0,
    trimEnd: 0,
    multicam: {
      angles,
      switches: [{ id: createId('multicam-switch'), time: 0, angleId: angles[0].id }]
    }
  });
  const nextTimeline: Timeline = {
    ...activeTimeline,
    tracks: activeTimeline.tracks.map((track) => {
      const clips = track.clips.filter((clip) => !selected.has(clip.id));
      const nextClips = track.id === targetTrack.id ? [...clips, multicamClip].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id)) : clips;
      if (track.id === targetTrack.id && detectOverlap({ ...track, clips }, multicamClip)) {
        throw new Error('Multicam sequence would overlap an unselected clip');
      }
      return { ...track, clips: nextClips };
    }),
    transitions: (activeTimeline.transitions ?? []).filter((transition) => !selected.has(transition.fromClipId) && !selected.has(transition.toClipId))
  };
  const sequence = createSequence({ id: sequenceId, name: sequenceName, timeline: { tracks: sequenceTracks, transitions: [], markers: [] } });
  const withTimeline = replaceProjectActiveTimeline(syncedProject, nextTimeline);
  return {
    project: {
      ...withTimeline,
      sequences: [...getProjectSequences(withTimeline), sequence],
      activeSequenceId
    },
    multicamClipId: multicamClip.id,
    sequenceId
  };
}

export function flattenMulticamProjectForExport(project: Project): Project {
  const flattenedTimeline = flattenMulticamTimeline(project.timeline, project);
  const flattenedSequences = getProjectSequences(project).map((sequence) =>
    sequence.id === getProjectActiveSequenceId(project)
      ? createSequence({ ...sequence, timeline: flattenedTimeline })
      : createSequence({ ...sequence, timeline: flattenMulticamTimeline(sequence.timeline, project) })
  );
  return {
    ...project,
    timeline: flattenedTimeline,
    sequences: flattenedSequences
  };
}

function findVisualClipLocation(timeline: Timeline, clipId: string): ClipLocation {
  for (const track of timeline.tracks) {
    const index = track.clips.findIndex((clip) => clip.id === clipId);
    if (index < 0) {
      continue;
    }
    const clip = track.clips[index];
    if (track.type !== 'video' || (clip.type !== 'video' && clip.type !== 'image')) {
      throw new Error('Multicam clips must be visual clips on video tracks');
    }
    return { clip, track, index };
  }
  throw new Error(`Clip ${clipId} not found`);
}

function cloneAngleClip(clip: Extract<Clip, { mediaId: string }>, trackId: string, start: number): Extract<Clip, { mediaId: string }> {
  return {
    ...clip,
    id: createId('clip'),
    trackId,
    start,
    speed: clip.speed ?? DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION, ...clip.colorCorrection },
    transform: { ...DEFAULT_TRANSFORM, ...clip.transform },
    chromaKey: normalizeChromaKey(clip.chromaKey),
    stabilization: clip.stabilization ? { ...clip.stabilization } : clip.stabilization,
    frameInterpolation: clip.frameInterpolation ? { ...clip.frameInterpolation } : clip.frameInterpolation,
    slowMotionMode: normalizeSlowMotionMode(clip.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(clip.audioDenoise),
    masks: clip.masks ? clip.masks.map((mask) => ({ ...mask })) : undefined,
    motionTrack: normalizeMotionTrack(clip.motionTrack, clip.duration),
    keyframes: normalizeClipKeyframes(cloneClipKeyframes(clip.keyframes), clip.duration),
    effects: normalizeEffects(cloneEffects(clip.effects))
  } as Extract<Clip, { mediaId: string }>;
}

function flattenMulticamTimeline(timeline: Timeline, project: Project): Timeline {
  let changed = false;
  const tracks = timeline.tracks.map((track) => {
    if (track.type !== 'video') {
      return track;
    }
    const clips = track.clips.flatMap((clip) => {
      if (clip.type !== 'nested-sequence' || !clip.multicam) {
        return [clip];
      }
      const flattened = flattenMulticamClip(clip, project);
      if (flattened.length === 0) {
        return [clip];
      }
      changed = true;
      return flattened;
    });
    return { ...track, clips: clips.sort((left, right) => left.start - right.start || left.id.localeCompare(right.id)) };
  });
  if (!changed) {
    return timeline;
  }
  const removedClipIds = new Set(
    timeline.tracks.flatMap((track) => track.clips.filter((clip) => clip.type === 'nested-sequence' && clip.multicam).map((clip) => clip.id))
  );
  return {
    ...timeline,
    tracks,
    transitions: (timeline.transitions ?? []).filter((transition) => !removedClipIds.has(transition.fromClipId) && !removedClipIds.has(transition.toClipId))
  };
}

function flattenMulticamClip(clip: Extract<Clip, { type: 'nested-sequence' }>, project: Project): Extract<Clip, { mediaId: string }>[] {
  const multicam = normalizeMulticamSequence(clip.multicam, clip.duration);
  const sequence = getProjectSequences(project).find((item) => item.id === clip.sequenceId);
  if (!multicam || !sequence) {
    return [];
  }
  const angleClipById = new Map<string, Extract<Clip, { mediaId: string }>>();
  for (const track of sequence.timeline.tracks) {
    for (const nestedClip of track.clips) {
      if ('mediaId' in nestedClip) {
        angleClipById.set(nestedClip.id, nestedClip);
      }
    }
  }

  const switches = multicam.switches
    .filter((item) => item.time < clip.duration - 0.000001)
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
  const segments: Extract<Clip, { mediaId: string }>[] = [];
  for (let index = 0; index < switches.length; index += 1) {
    const current = switches[index];
    const next = switches[index + 1];
    const angle = multicam.angles.find((item) => item.id === current.angleId);
    const angleClip = angle ? angleClipById.get(angle.clipId) : undefined;
    if (!angleClip) {
      continue;
    }
    const localStart = Math.max(current.time, angleClip.start);
    const localEnd = Math.min(next?.time ?? clip.duration, angleClip.start + angleClip.duration, clip.duration);
    if (localEnd - localStart <= 0.000001) {
      continue;
    }
    segments.push(cloneAngleSegment(angleClip, clip, localStart, localEnd, index));
  }
  return segments;
}

function cloneAngleSegment(
  source: Extract<Clip, { mediaId: string }>,
  parent: Extract<Clip, { type: 'nested-sequence' }>,
  localStart: number,
  localEnd: number,
  index: number
): Extract<Clip, { mediaId: string }> {
  const sourceOffset = round(Math.max(0, localStart - source.start) * (source.speed ?? DEFAULT_CLIP_SPEED));
  const duration = round(localEnd - localStart);
  const segment = cloneAngleClip(source, parent.trackId, round(parent.start + localStart));
  return {
    ...segment,
    id: createId('clip'),
    name: `${parent.name} angle ${index + 1}`,
    start: round(parent.start + localStart),
    duration,
    trimStart: round(source.trimStart + sourceOffset),
    trimEnd: round(Math.max(0, source.trimEnd + Math.max(0, source.duration - (localEnd - source.start)))),
    transform: { ...DEFAULT_TRANSFORM, ...source.transform, ...parent.transform },
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION, ...source.colorCorrection, ...parent.colorCorrection },
    effects: normalizeEffects([...(cloneEffects(source.effects) ?? []), ...(cloneEffects(parent.effects) ?? [])]),
    volume: 'volume' in source ? source.volume : 1,
    muted: 'muted' in source ? source.muted : undefined
  } as Extract<Clip, { mediaId: string }>;
}

// ── MulticamClip (independent multicam) algorithms ──

/**
 * Get the active angle at a given time for a MulticamClip.
 * Switch points are assumed to be sorted by time.
 */
export function getActiveAngleAtTime(multicamClip: MulticamClip, time: number): MulticamClipAngle {
  const { angles, switchPoints, activeAngle } = multicamClip;

  if (angles.length === 0) {
    throw new Error('MulticamClip has no angles');
  }

  // No switch points: return the default active angle
  if (switchPoints.length === 0) {
    return angles[activeAngle];
  }

  // Find the last switch point at or before the given time.
  // Switch points are sorted by time.
  let targetAngle = activeAngle;
  for (const switchPoint of switchPoints) {
    if (switchPoint.time <= time) {
      targetAngle = switchPoint.targetAngle;
    } else {
      break;
    }
  }

  // Validate targetAngle range
  if (targetAngle < 0 || targetAngle >= angles.length) {
    return angles[activeAngle];
  }

  return angles[targetAngle];
}

/**
 * Add a switch point to the array, maintaining sorted order by time.
 * If a switch point at the same time already exists, it is replaced.
 * Returns a new array (immutable).
 */
export function addSwitchPoint(switchPoints: SwitchPoint[], switchPoint: SwitchPoint): SwitchPoint[] {
  // Find insertion index to maintain sorted order
  let insertIndex = switchPoints.length;
  for (let i = 0; i < switchPoints.length; i++) {
    if (switchPoints[i].time >= switchPoint.time) {
      insertIndex = i;
      break;
    }
  }

  // If there's already a switch point at the same time, replace it
  if (insertIndex < switchPoints.length && switchPoints[insertIndex].time === switchPoint.time) {
    const result = [...switchPoints];
    result[insertIndex] = switchPoint;
    return result;
  }

  // Insert at the correct position
  const result = [...switchPoints];
  result.splice(insertIndex, 0, switchPoint);
  return result;
}

/**
 * Delete a switch point by index.
 * Returns a new array (immutable).
 * Throws if the index is out of range.
 */
export function deleteSwitchPoint(switchPoints: SwitchPoint[], index: number): SwitchPoint[] {
  if (index < 0 || index >= switchPoints.length) {
    throw new Error('Switch point index out of range');
  }

  const result = [...switchPoints];
  result.splice(index, 1);
  return result;
}

/**
 * Update a switch point at the given index with partial updates.
 * If the time is changed, the array is re-sorted.
 * Returns a new array (immutable).
 * Throws if the index is out of range.
 */
export function updateSwitchPoint(
  switchPoints: SwitchPoint[],
  index: number,
  updates: Partial<SwitchPoint>
): SwitchPoint[] {
  if (index < 0 || index >= switchPoints.length) {
    throw new Error('Switch point index out of range');
  }

  const result = [...switchPoints];
  result[index] = { ...result[index], ...updates };

  // If time was updated, re-sort to maintain order
  if (updates.time !== undefined) {
    result.sort((a, b) => a.time - b.time);
  }

  return result;
}
