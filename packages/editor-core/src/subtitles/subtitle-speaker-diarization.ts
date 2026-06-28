import { round } from '../time';

export const DEFAULT_PAUSE_THRESHOLD = 1.2;
export const DEFAULT_ZCR_DIFF_THRESHOLD = 0.15;
export const DEFAULT_SPEAKER_NAME_PREFIX = '说话人';

export interface SubtitleSegmentInput {
  id: string;
  start: number;
  end: number;
  text: string;
  zeroCrossingRate?: number;
}

export interface SpeakerAssignment {
  segmentId: string;
  speakerId: number;
}

export interface SpeakerDiarizationResult {
  assignments: SpeakerAssignment[];
  speakerLabels: Record<number, string>;
}

export function detectPauseBoundaries(
  segments: readonly SubtitleSegmentInput[],
  pauseThreshold = DEFAULT_PAUSE_THRESHOLD
): boolean[] {
  if (segments.length <= 1) return segments.length === 1 ? [false] : [];
  const boundaries: boolean[] = [false];
  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end;
    boundaries.push(gap > pauseThreshold);
  }
  return boundaries;
}

export function detectSpeakerChange(
  currentZcr: number,
  previousZcr: number,
  zcrThreshold = DEFAULT_ZCR_DIFF_THRESHOLD
): boolean {
  return Math.abs(currentZcr - previousZcr) > zcrThreshold;
}

export function assignSpeakerIds(
  segments: readonly SubtitleSegmentInput[],
  pauseThreshold = DEFAULT_PAUSE_THRESHOLD,
  zcrThreshold = DEFAULT_ZCR_DIFF_THRESHOLD
): SpeakerAssignment[] {
  if (segments.length === 0) return [];
  const assignments: SpeakerAssignment[] = [{ segmentId: segments[0].id, speakerId: 0 }];
  let currentSpeaker = 0;

  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end;
    const isPauseBoundary = gap > pauseThreshold;
    const hasZcrChange = detectSpeakerChange(
      segments[i].zeroCrossingRate ?? 0,
      segments[i - 1].zeroCrossingRate ?? 0,
      zcrThreshold
    );

    if (isPauseBoundary && hasZcrChange) {
      currentSpeaker++;
    }
    assignments.push({ segmentId: segments[i].id, speakerId: currentSpeaker });
  }
  return assignments;
}

export function buildSpeakerLabels(count: number, prefix = DEFAULT_SPEAKER_NAME_PREFIX): Record<number, string> {
  const labels: Record<number, string> = {};
  for (let i = 0; i < count; i++) {
    labels[i] = `${prefix}${i + 1}`;
  }
  return labels;
}

export function renameSpeaker(
  labels: Record<number, string>,
  oldId: number,
  newName: string
): Record<number, string> {
  if (!(oldId in labels)) return { ...labels };
  return { ...labels, [oldId]: newName };
}

export function batchRenameSpeakers(
  labels: Record<number, string>,
  renames: Record<number, string>
): Record<number, string> {
  const result = { ...labels };
  for (const [id, name] of Object.entries(renames)) {
    const numId = Number(id);
    if (numId in result && typeof name === 'string' && name.trim()) {
      result[numId] = name.trim();
    }
  }
  return result;
}

export function performSpeakerDiarization(
  segments: readonly SubtitleSegmentInput[],
  pauseThreshold = DEFAULT_PAUSE_THRESHOLD,
  zcrThreshold = DEFAULT_ZCR_DIFF_THRESHOLD
): SpeakerDiarizationResult {
  const assignments = assignSpeakerIds(segments, pauseThreshold, zcrThreshold);
  const maxSpeaker = assignments.reduce((max, a) => Math.max(max, a.speakerId), 0);
  return {
    assignments,
    speakerLabels: buildSpeakerLabels(maxSpeaker + 1)
  };
}
