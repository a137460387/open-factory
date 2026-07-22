/**
 * Rhythm Matcher Engine
 *
 * Detects audio beats, analyzes video motion, and aligns rhythm to template
 * keyframes for "beat-sync" editing effects.
 *
 * Pipeline: detectAudioBeats -> analyzeVideoMotion -> matchRhythmToTemplate
 *           -> createRhythmAlignedTemplate (one-shot)
 */

import type {
  EditingTemplate,
  TemplateKeyframe,
  TemplateClip,
} from '../models/template-schema';
import { clamp01 } from '../utils/math';

/** A single beat point detected from audio data. */
export interface AudioBeat {
  /** Time position in seconds */
  time: number;
  /** Beat strength 0-1 (normalized peak amplitude) */
  strength: number;
  /** Dominant frequency band index (0 = low, 1 = mid, 2 = high) */
  frequency: number;
}

/** A single motion analysis point from video frames. */
export interface VideoMotionPoint {
  /** Time position in seconds */
  time: number;
  /** Motion magnitude 0-1 (normalized inter-frame difference) */
  motionMagnitude: number;
  /** Dominant motion direction in radians */
  direction: number;
}

/** Overall rhythm analysis result. */
export interface AudioRhythmProfile {
  /** Detected BPM (beats per minute) */
  bpm: number;
  /** Sorted beat points */
  beats: AudioBeat[];
  /** Average interval between beats in seconds */
  avgBeatInterval: number;
  /** Rhythm classification */
  rhythmType: 'slow' | 'medium' | 'fast' | 'variable';
}

// ─── Constants ────────────────────────────────────────────────────

const ENERGY_WINDOW_SIZE = 1024;
const BEAT_STRENGTH_THRESHOLD = 0.3;
const MIN_BEAT_INTERVAL_SEC = 0.15;
const MOTION_PEAK_WINDOW = 5;
const MOTION_HIGH_THRESHOLD = 0.5;

// ─── Audio Beat Detection ─────────────────────────────────────────

/**
 * Detect beat points from raw PCM audio amplitude data.
 *
 * Uses energy-peak detection: compute windowed RMS energy, normalize,
 * identify local peaks above threshold, filter closely-spaced duplicates.
 *
 * @param audioData - PCM amplitude samples normalized to -1..1
 * @param sampleRate - Sample rate in Hz (default 44100)
 * @returns Sorted array of AudioBeat points
 */
export function detectAudioBeats(
  audioData: readonly number[],
  sampleRate: number = 44100,
): AudioBeat[] {
  if (audioData.length === 0) return [];

  const hopSize = Math.floor(ENERGY_WINDOW_SIZE / 2);
  const windowCount = Math.max(1, Math.floor((audioData.length - ENERGY_WINDOW_SIZE) / hopSize) + 1);

  // Compute windowed RMS energy
  const energies: number[] = [];
  for (let i = 0; i < windowCount; i++) {
    const start = i * hopSize;
    let sum = 0;
    for (let j = 0; j < ENERGY_WINDOW_SIZE && start + j < audioData.length; j++) {
      const s = audioData[start + j];
      sum += s * s;
    }
    energies.push(Math.sqrt(sum / ENERGY_WINDOW_SIZE));
  }

  // Normalize to 0-1
  const maxEnergy = Math.max(...energies, 0.0001);
  const normalized = energies.map((e) => e / maxEnergy);

  // Find local peaks above threshold
  const beats: AudioBeat[] = [];
  for (let i = 1; i < normalized.length - 1; i++) {
    const prev = normalized[i - 1];
    const curr = normalized[i];
    const next = normalized[i + 1];

    if (curr > prev && curr > next && curr >= BEAT_STRENGTH_THRESHOLD) {
      const timeSec = (i * hopSize) / sampleRate;
      const lastBeat = beats[beats.length - 1];

      if (lastBeat && timeSec - lastBeat.time < MIN_BEAT_INTERVAL_SEC) {
        if (curr > lastBeat.strength) {
          beats[beats.length - 1] = {
            time: timeSec,
            strength: curr,
            frequency: classifyFrequencyBand(audioData, i * hopSize),
          };
        }
        continue;
      }

      beats.push({
        time: timeSec,
        strength: curr,
        frequency: classifyFrequencyBand(audioData, i * hopSize),
      });
    }
  }

  return beats;
}

/** Classify frequency band via zero-crossing rate (0=low, 1=mid, 2=high). */
function classifyFrequencyBand(audioData: readonly number[], start: number): number {
  let crossings = 0;
  const end = Math.min(start + ENERGY_WINDOW_SIZE, audioData.length);
  for (let i = start + 1; i < end; i++) {
    if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) crossings++;
  }
  const zcr = crossings / ENERGY_WINDOW_SIZE;
  if (zcr < 0.1) return 0;
  if (zcr < 0.3) return 1;
  return 2;
}

// ─── Video Motion Analysis ────────────────────────────────────────

/**
 * Analyze video motion from per-frame motion magnitude data.
 *
 * Normalizes magnitudes and estimates direction from inter-frame gradients.
 *
 * @param frames - Array of { time, motionMagnitude } per frame
 * @param fps - Frames per second (default 30)
 * @returns Array of VideoMotionPoint with direction estimates
 */
export function analyzeVideoMotion(
  frames: readonly { time: number; motionMagnitude: number }[],
  fps: number = 30,
): VideoMotionPoint[] {
  if (frames.length === 0) return [];

  const maxMag = Math.max(...frames.map((f) => f.motionMagnitude), 0.0001);

  return frames.map((frame, i) => {
    const normalized = frame.motionMagnitude / maxMag;
    const prev = i > 0 ? frames[i - 1].motionMagnitude / maxMag : normalized;
    const next = i < frames.length - 1 ? frames[i + 1].motionMagnitude / maxMag : normalized;
    return {
      time: frame.time,
      motionMagnitude: normalized,
      direction: Math.atan2(next - prev, 1),
    };
  });
}

/**
 * Find high-motion turning points from analyzed motion data.
 *
 * A turning point is a local maximum above MOTION_HIGH_THRESHOLD
 * within a sliding window.
 *
 * @param motionPoints - Output from analyzeVideoMotion
 * @returns Subset of points that are high-motion peaks
 */
export function findMotionPeaks(motionPoints: readonly VideoMotionPoint[]): VideoMotionPoint[] {
  if (motionPoints.length === 0) return [];

  const peaks: VideoMotionPoint[] = [];
  const halfWindow = Math.floor(MOTION_PEAK_WINDOW / 2);

  for (let i = halfWindow; i < motionPoints.length - halfWindow; i++) {
    const point = motionPoints[i];
    if (point.motionMagnitude < MOTION_HIGH_THRESHOLD) continue;

    let isPeak = true;
    for (let j = i - halfWindow; j <= i + halfWindow; j++) {
      if (j === i) continue;
      if (motionPoints[j].motionMagnitude > point.motionMagnitude) {
        isPeak = false;
        break;
      }
    }
    if (isPeak) peaks.push(point);
  }

  return peaks;
}

// ─── Rhythm-Template Alignment ────────────────────────────────────

/**
 * Match a rhythm profile to an editing template.
 *
 * Maps beat times to normalizedTime (0-1), then generates scale-punch,
 * opacity-pulse, and position-shift keyframes at each beat for a
 * "beat-sync" effect.
 *
 * @param rhythmProfile - Analyzed rhythm data
 * @param template - Source editing template
 * @returns New template with rhythm-aligned keyframes injected
 */
export function matchRhythmToTemplate(
  rhythmProfile: AudioRhythmProfile,
  template: EditingTemplate,
): EditingTemplate {
  const totalDuration = template.metadata.estimatedDurationSec;
  if (totalDuration <= 0 || rhythmProfile.beats.length === 0) return template;

  const normalizedBeats = rhythmProfile.beats
    .filter((b) => b.time <= totalDuration)
    .map((beat) => ({
      normalizedTime: beat.time / totalDuration,
      strength: beat.strength,
    }));

  const updatedTracks = template.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => injectRhythmKeyframes(clip, normalizedBeats)),
  }));

  return { ...template, tracks: updatedTracks };
}

/** Inject rhythm keyframes into a clip (scale punch + opacity pulse + position shift). */
function injectRhythmKeyframes(
  clip: TemplateClip,
  beats: readonly { normalizedTime: number; strength: number }[],
): TemplateClip {
  const rhythmKeyframes: TemplateKeyframe[] = [];

  for (const beat of beats) {
    const t = clamp01(beat.normalizedTime);

    // Scale punch on strong beats
    if (beat.strength > 0.5) {
      rhythmKeyframes.push({ normalizedTime: t, property: 'scale', value: 1.0 + beat.strength * 0.15, interpolation: 'ease-out' });
      rhythmKeyframes.push({ normalizedTime: clamp01(t + 0.03), property: 'scale', value: 1.0, interpolation: 'ease-in' });
    }

    // Opacity pulse on medium+ beats
    if (beat.strength > 0.3) {
      rhythmKeyframes.push({ normalizedTime: t, property: 'opacity', value: Math.min(1, clip.opacity + beat.strength * 0.2), interpolation: 'ease-out' });
    }

    // Position micro-shift on very strong beats
    if (beat.strength > 0.6) {
      rhythmKeyframes.push({ normalizedTime: t, property: 'positionX', value: (beat.strength - 0.5) * 10, interpolation: 'ease-out' });
      rhythmKeyframes.push({ normalizedTime: clamp01(t + 0.02), property: 'positionX', value: 0, interpolation: 'ease-in-out' });
    }
  }

  const merged = [...clip.keyframes, ...rhythmKeyframes].sort(
    (a, b) => a.normalizedTime - b.normalizedTime,
  );

  return { ...clip, keyframes: merged };
}

// ─── One-Shot Pipeline ────────────────────────────────────────────

/**
 * One-shot pipeline: detect beats, analyze motion, merge, and align to template.
 *
 * Combines audio beat detection with video motion analysis. Motion peaks that
 * don't coincide with audio beats are added as supplemental beats weighted by
 * the audioWeight parameter.
 *
 * @param template - Base editing template to align
 * @param audioData - PCM audio amplitude samples (-1..1)
 * @param videoFrames - Per-frame motion data with timestamps
 * @param options - Optional sampleRate, fps, audioWeight (0-1, default 0.7)
 * @returns Rhythm-aligned template with sync keyframes
 */
export function createRhythmAlignedTemplate(
  template: EditingTemplate,
  audioData: readonly number[],
  videoFrames: readonly { time: number; motionMagnitude: number }[],
  options?: { sampleRate?: number; fps?: number; audioWeight?: number },
): EditingTemplate {
  const sampleRate = options?.sampleRate ?? 44100;
  const fps = options?.fps ?? 30;
  const audioWeight = options?.audioWeight ?? 0.7;

  const beats = detectAudioBeats(audioData, sampleRate);
  const motionPeaks = findMotionPeaks(analyzeVideoMotion(videoFrames, fps));
  const rhythmProfile = buildAudioRhythmProfile(beats);
  const mergedBeats = mergeBeatsWithMotion(beats, motionPeaks, audioWeight);

  return matchRhythmToTemplate({ ...rhythmProfile, beats: mergedBeats }, template);
}

// ─── Internal Helpers ─────────────────────────────────────────────

/** Build a AudioRhythmProfile from detected beats (BPM, avg interval, type). */
function buildAudioRhythmProfile(beats: readonly AudioBeat[]): AudioRhythmProfile {
  if (beats.length < 2) {
    return { bpm: 0, beats: [...beats], avgBeatInterval: 0, rhythmType: 'variable' };
  }

  const intervals: number[] = [];
  for (let i = 1; i < beats.length; i++) intervals.push(beats[i].time - beats[i - 1].time);

  const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  const bpm = avgInterval > 0 ? 60 / avgInterval : 0;

  let rhythmType: AudioRhythmProfile['rhythmType'];
  if (bpm < 80) rhythmType = 'slow';
  else if (bpm < 120) rhythmType = 'medium';
  else if (bpm < 160) rhythmType = 'fast';
  else rhythmType = 'variable';

  // High variance => variable regardless of BPM
  if (intervals.length > 2) {
    const variance = intervals.reduce((s, v) => s + (v - avgInterval) ** 2, 0) / intervals.length;
    if (Math.sqrt(variance) / (avgInterval || 1) > 0.4) rhythmType = 'variable';
  }

  return { bpm: Math.round(bpm), beats: [...beats], avgBeatInterval: avgInterval, rhythmType };
}

/** Merge audio beats with motion peaks, boosting coincident beats. */
function mergeBeatsWithMotion(
  audioBeats: readonly AudioBeat[],
  motionPeaks: readonly VideoMotionPoint[],
  audioWeight: number,
): AudioBeat[] {
  const motionWeight = 1 - audioWeight;
  const merged: AudioBeat[] = audioBeats.map((b) => ({ ...b }));
  const beatTimes = new Set(audioBeats.map((b) => Math.round(b.time * 100) / 100));

  for (const peak of motionPeaks) {
    const rounded = Math.round(peak.time * 100) / 100;
    if (beatTimes.has(rounded)) {
      const idx = merged.findIndex((b) => Math.abs(b.time - peak.time) < 0.05);
      if (idx >= 0) {
        merged[idx] = {
          ...merged[idx],
          strength: Math.min(1, merged[idx].strength * audioWeight + peak.motionMagnitude * motionWeight),
        };
      }
    } else {
      merged.push({ time: peak.time, strength: peak.motionMagnitude * motionWeight, frequency: 1 });
    }
  }

  return merged.sort((a, b) => a.time - b.time);
}
