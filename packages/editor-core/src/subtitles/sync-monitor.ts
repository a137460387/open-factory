import type { Clip, SubtitleClip, Track } from '../model-types';
import { round } from '../time';

export type SubtitleSyncSensitivity = 'strict' | 'standard' | 'loose';

export interface SubtitleSyncWarning {
  subtitleClipId: string;
  trackId: string;
  expectedStart: number;
  actualStart: number;
  offsetMs: number;
  severity: 'minor' | 'major';
}

export interface SubtitleSyncReport {
  totalSubtitles: number;
  alignedCount: number;
  warningCount: number;
  warnings: SubtitleSyncWarning[];
}

export interface SubtitleTimingReference {
  clipId: string;
  originalStart: number;
  originalDuration: number;
  originalSpeed: number;
  currentStart: number;
  currentDuration: number;
  currentSpeed: number;
}

const SENSITIVITY_THRESHOLDS: Record<SubtitleSyncSensitivity, { minorMs: number; majorMs: number }> = {
  strict: { minorMs: 50, majorMs: 150 },
  standard: { minorMs: 150, majorMs: 500 },
  loose: { minorMs: 500, majorMs: 1500 },
};

export function getSensitivityThresholds(sensitivity: SubtitleSyncSensitivity): { minorMs: number; majorMs: number } {
  return SENSITIVITY_THRESHOLDS[sensitivity];
}

export function mapSensitivityLabel(label: string): SubtitleSyncSensitivity {
  const normalized = label.trim().toLowerCase();
  if (normalized === 'strict' || normalized === '严格') return 'strict';
  if (normalized === 'loose' || normalized === '宽松') return 'loose';
  return 'standard';
}

export function calculateClipTimingDelta(ref: SubtitleTimingReference): {
  startDelta: number;
  durationDelta: number;
  speedChanged: boolean;
} {
  const startDelta = ref.currentStart - ref.originalStart;
  const durationDelta = ref.currentDuration - ref.originalDuration;
  const speedChanged = Math.abs(ref.currentSpeed - ref.originalSpeed) > 0.001;
  return { startDelta, durationDelta, speedChanged };
}

export function detectSubtitleSyncOffset(
  subtitleClip: SubtitleClip,
  ref: SubtitleTimingReference,
): number {
  const { startDelta, durationDelta, speedChanged } = calculateClipTimingDelta(ref);
  if (!speedChanged && Math.abs(startDelta) < 0.001 && Math.abs(durationDelta) < 0.001) {
    return 0;
  }
  let expectedStart: number;
  if (speedChanged) {
    const speedRatio = ref.originalSpeed / ref.currentSpeed;
    const subtitleRelativeStart = subtitleClip.start - ref.originalStart;
    expectedStart = ref.currentStart + subtitleRelativeStart * speedRatio;
  } else {
    expectedStart = subtitleClip.start + startDelta;
  }
  return round(expectedStart - subtitleClip.start);
}

export function shouldTriggerSyncWarning(
  offsetSeconds: number,
  sensitivity: SubtitleSyncSensitivity,
): boolean {
  const thresholds = SENSITIVITY_THRESHOLDS[sensitivity];
  const offsetMs = Math.abs(offsetSeconds * 1000);
  return offsetMs >= thresholds.minorMs;
}

export function buildSyncWarning(
  subtitleClipId: string,
  trackId: string,
  offsetSeconds: number,
  expectedStart: number,
  sensitivity: SubtitleSyncSensitivity,
): SubtitleSyncWarning | undefined {
  const thresholds = SENSITIVITY_THRESHOLDS[sensitivity];
  const offsetMs = Math.round(Math.abs(offsetSeconds) * 1000);
  if (offsetMs < thresholds.minorMs) return undefined;
  return {
    subtitleClipId,
    trackId,
    expectedStart: round(expectedStart),
    actualStart: round(expectedStart - offsetSeconds),
    offsetMs,
    severity: offsetMs >= thresholds.majorMs ? 'major' : 'minor',
  };
}

export function scanSubtitleTrackSync(
  subtitleClips: SubtitleClip[],
  subtitleTrackId: string,
  timingRefs: SubtitleTimingReference[],
  sensitivity: SubtitleSyncSensitivity = 'standard',
): SubtitleSyncReport {
  const warnings: SubtitleSyncWarning[] = [];
  for (const subtitle of subtitleClips) {
    const ref = findBestTimingRef(subtitle, timingRefs);
    if (!ref) continue;
    const offset = detectSubtitleSyncOffset(subtitle, ref);
    if (Math.abs(offset) < 0.001) continue;
    const warning = buildSyncWarning(
      subtitle.id,
      subtitleTrackId,
      offset,
      subtitle.start + offset,
      sensitivity,
    );
    if (warning) warnings.push(warning);
  }
  return {
    totalSubtitles: subtitleClips.length,
    alignedCount: subtitleClips.length - warnings.length,
    warningCount: warnings.length,
    warnings,
  };
}

export function batchScanSubtitleSync(
  tracks: Track[],
  timingRefs: SubtitleTimingReference[],
  sensitivity: SubtitleSyncSensitivity = 'standard',
): SubtitleSyncReport {
  const subtitleClips: SubtitleClip[] = [];
  const subtitleTrackIds: string[] = [];
  for (const track of tracks) {
    if (track.type !== 'subtitle') continue;
    for (const clip of track.clips) {
      if (clip.type === 'subtitle') {
        subtitleClips.push(clip);
        subtitleTrackIds.push(track.id);
      }
    }
  }
  const allWarnings: SubtitleSyncWarning[] = [];
  for (let i = 0; i < subtitleClips.length; i++) {
    const ref = findBestTimingRef(subtitleClips[i], timingRefs);
    if (!ref) continue;
    const offset = detectSubtitleSyncOffset(subtitleClips[i], ref);
    if (Math.abs(offset) < 0.001) continue;
    const warning = buildSyncWarning(
      subtitleClips[i].id,
      subtitleTrackIds[i],
      offset,
      subtitleClips[i].start + offset,
      sensitivity,
    );
    if (warning) allWarnings.push(warning);
  }
  return {
    totalSubtitles: subtitleClips.length,
    alignedCount: subtitleClips.length - allWarnings.length,
    warningCount: allWarnings.length,
    warnings: allWarnings,
  };
}

export function calculateSingleSubtitleRepair(
  subtitleClip: SubtitleClip,
  timingRef: SubtitleTimingReference,
  projectDuration: number,
): { start: number; duration: number } | undefined {
  const offset = detectSubtitleSyncOffset(subtitleClip, timingRef);
  if (Math.abs(offset) < 0.001) return undefined;
  const newStart = round(Math.max(0, Math.min(projectDuration - subtitleClip.duration, subtitleClip.start + offset)));
  return { start: newStart, duration: subtitleClip.duration };
}

export function needsSyncRecheck(
  clipBefore: { start: number; duration: number; speed: number },
  clipAfter: { start: number; duration: number; speed: number },
): boolean {
  return (
    Math.abs(clipBefore.start - clipAfter.start) > 0.001 ||
    Math.abs(clipBefore.duration - clipAfter.duration) > 0.001 ||
    Math.abs(clipBefore.speed - clipAfter.speed) > 0.001
  );
}

function findBestTimingRef(
  subtitle: SubtitleClip,
  refs: SubtitleTimingReference[],
): SubtitleTimingReference | undefined {
  let best: SubtitleTimingReference | undefined;
  let bestOverlap = 0;
  for (const ref of refs) {
    const overlap = calculateTimeOverlap(
      ref.currentStart,
      ref.currentStart + ref.currentDuration,
      subtitle.start,
      subtitle.start + subtitle.duration,
    );
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = ref;
    }
  }
  return best;
}

function calculateTimeOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}
