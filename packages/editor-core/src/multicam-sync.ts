import type { MulticamClipAngle, MediaMetadata } from './model-types';
import { syncMulticamAudio } from './audio/multicam-audio-sync';

export interface MulticamSyncResult {
  offsets: Map<string, number>;
  confidence: number;
  driftDetected: boolean;
  driftRate?: number;
}
export interface ManualSyncMarker {
  angleId: string;
  time: number;
}

export async function syncMulticamByAudio(
  angles: MulticamClipAngle[],
  audioSamplesMap: Map<string, ArrayLike<number>>,
): Promise<MulticamSyncResult> {
  if (angles.length === 0) return { offsets: new Map(), confidence: 0, driftDetected: false };
  const offsets = new Map<string, number>();
  const reference = angles[0];
  offsets.set(reference.id, 0);
  if (angles.length === 1) return { offsets, confidence: 1, driftDetected: false };
  const refSamples = audioSamplesMap.get(reference.id) ?? new Float32Array(0);
  const confidenceValues: number[] = [];
  let anyDriftDetected = false;
  let totalDriftRate = 0;
  let driftCount = 0;
  for (let i = 1; i < angles.length; i++) {
    const candidate = angles[i];
    const candidateSamples = audioSamplesMap.get(candidate.id) ?? new Float32Array(0);
    const report = syncMulticamAudio(refSamples, candidateSamples, candidate.id);
    offsets.set(candidate.id, report.medianOffsetSeconds);
    confidenceValues.push(report.confidence === 'high' ? 0.9 : report.confidence === 'medium' ? 0.6 : 0.3);
    if (report.drift.hasDrift) {
      anyDriftDetected = true;
      totalDriftRate += (report.drift.driftRateMsPerMin / 1000) * 60;
      driftCount++;
    }
  }
  const avg = confidenceValues.length > 0 ? confidenceValues.reduce((s, v) => s + v, 0) / confidenceValues.length : 1;
  return {
    offsets,
    confidence: avg,
    driftDetected: anyDriftDetected,
    driftRate: driftCount > 0 ? totalDriftRate / driftCount : 0,
  };
}

export function syncMulticamByTimecode(
  angles: MulticamClipAngle[],
  metadata: Record<string, MediaMetadata>,
): MulticamSyncResult {
  if (angles.length === 0) return { offsets: new Map(), confidence: 1, driftDetected: false };
  const offsets = new Map<string, number>();
  let earliestTime = Infinity;
  const timestamps = new Map<string, number>();
  for (const angle of angles) {
    const md = metadata[angle.mediaId];
    if (md?.date) {
      const t = new Date(md.date).getTime();
      timestamps.set(angle.id, t);
      if (t < earliestTime) earliestTime = t;
    }
  }
  if (earliestTime === Infinity) {
    for (const a of angles) offsets.set(a.id, 0);
    return { offsets, confidence: 1, driftDetected: false };
  }
  for (const angle of angles) {
    const t = timestamps.get(angle.id);
    offsets.set(angle.id, t !== undefined ? (earliestTime - t) / 1000 : 0);
  }
  return { offsets, confidence: 1, driftDetected: false };
}

export function syncMulticamByManual(angles: MulticamClipAngle[], markers: ManualSyncMarker[]): MulticamSyncResult {
  const offsets = new Map<string, number>();
  const ref = markers[0];
  if (!ref) {
    for (const a of angles) offsets.set(a.id, 0);
    return { offsets, confidence: 1, driftDetected: false };
  }
  for (const angle of angles) {
    const m = markers.find((mk) => mk.angleId === angle.id);
    offsets.set(angle.id, m ? ref.time - m.time : 0);
  }
  return { offsets, confidence: 1, driftDetected: false };
}

export async function detectMulticamDrift(
  angles: MulticamClipAngle[],
  audioSamplesMap?: Map<string, ArrayLike<number>>,
): Promise<{ driftDetected: boolean; driftRate: number }> {
  if (angles.length < 2) return { driftDetected: false, driftRate: 0 };
  const ref = angles[0];
  const cand = angles[1];
  const refS = audioSamplesMap?.get(ref.id) ?? new Float32Array(0);
  const candS = audioSamplesMap?.get(cand.id) ?? new Float32Array(0);
  const report = syncMulticamAudio(refS, candS, cand.id);
  return {
    driftDetected: report.drift.hasDrift,
    driftRate: report.drift.hasDrift ? (report.drift.driftRateMsPerMin / 1000) * 60 : 0,
  };
}
