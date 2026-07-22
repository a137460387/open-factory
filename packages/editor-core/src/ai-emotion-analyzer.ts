/**
 * AI Emotion Analyzer.
 *
 * Analyzes emotional content from audio and visual features,
 * generating emotion curves and identifying emotional peaks.
 * Combines audio energy analysis with visual feature mapping.
 */

import type { ContentAnalysisVisualSample, ContentAnalysisAudioSample, ContentEmotionPoint } from './content-analysis';
import { clamp } from './utils/math';

// ─── Types ────────────────────────────────────────────────

export interface EmotionAnalysisResult {
  curve: EmotionPoint[];
  peaks: EmotionPeak[];
  overallMood: string;
  emotionalArc: 'rising' | 'falling' | 'stable' | 'peak' | 'valley';
}

export interface EmotionPoint {
  time: number;
  value: number; // -1 to 1, negative to positive
  arousal: number; // 0 to 1, calm to excited
  source: 'audio' | 'visual' | 'fused';
}

export interface EmotionPeak {
  time: number;
  value: number;
  type: 'positive' | 'negative' | 'neutral';
}

export interface EmotionAnalysisOptions {
  windowSize?: number;
  peakThreshold?: number;
  audioWeight?: number;
  visualWeight?: number;
}

// ─── Core Functions ────────────────────────────────────────

/**
 * Analyze emotion from visual and audio samples.
 *
 * Fuses audio energy analysis with visual feature mapping to produce
 * a comprehensive emotion curve with identified peaks.
 */
export function analyzeEmotion(
  visualSamples: ContentAnalysisVisualSample[],
  audioSamples?: ContentAnalysisAudioSample[],
  options: EmotionAnalysisOptions = {},
): EmotionAnalysisResult {
  const { windowSize = 5, peakThreshold = 0.3, audioWeight = 0.6, visualWeight = 0.4 } = options;

  // Generate visual emotion points
  const visualEmotions = visualSamples.map((sample) => mapVisualToEmotion(sample));

  // Generate audio emotion points if available
  const audioEmotions = audioSamples?.map((sample) => mapAudioToEmotion(sample));

  // Fuse emotions
  const curve = fuseEmotions(visualEmotions, audioEmotions, audioWeight, visualWeight);

  // Smooth the curve
  const smoothedCurve = smoothCurve(curve, windowSize);

  // Detect peaks
  const peaks = detectPeaks(smoothedCurve, peakThreshold);

  // Determine overall mood and arc
  const overallMood = determineOverallMood(smoothedCurve);
  const emotionalArc = determineEmotionalArc(smoothedCurve, peaks);

  return {
    curve: smoothedCurve,
    peaks,
    overallMood,
    emotionalArc,
  };
}

// ─── Visual Emotion Mapping ────────────────────────────────

function mapVisualToEmotion(sample: ContentAnalysisVisualSample): EmotionPoint {
  // Map brightness to valence (brighter = more positive)
  const brightnessValence = (sample.brightness - 0.5) * 1.2;

  // Map saturation to arousal (more saturated = more aroused)
  const saturationArousal = sample.saturation * 0.8;

  // Map motion to arousal (more motion = more aroused)
  const motionArousal = sample.motion * 0.6;

  // Combine factors
  const value = clamp(brightnessValence, -1, 1);
  const arousal = clamp(saturationArousal + motionArousal, 0, 1);

  return {
    time: sample.time,
    value,
    arousal,
    source: 'visual',
  };
}

// ─── Audio Emotion Mapping ─────────────────────────────────

function mapAudioToEmotion(sample: ContentAnalysisAudioSample): EmotionPoint {
  // Map loudness to arousal (louder = more aroused)
  const arousal = clamp(sample.loudness * 1.5, 0, 1);

  // Moderate loudness suggests positive emotion
  // Very loud or very quiet suggests neutral/negative
  const optimalLoudness = 0.5;
  const loudnessDiff = Math.abs(sample.loudness - optimalLoudness);
  const value = clamp(1 - loudnessDiff * 2, -1, 1);

  return {
    time: sample.time,
    value,
    arousal,
    source: 'audio',
  };
}

// ─── Emotion Fusion ────────────────────────────────────────

function fuseEmotions(
  visualEmotions: EmotionPoint[],
  audioEmotions: EmotionPoint[] | undefined,
  audioWeight: number,
  visualWeight: number,
): EmotionPoint[] {
  if (!audioEmotions || audioEmotions.length === 0) {
    return visualEmotions;
  }

  // Align timestamps and fuse
  const fused: EmotionPoint[] = [];
  const allTimes = new Set<number>();

  for (const v of visualEmotions) allTimes.add(v.time);
  for (const a of audioEmotions) allTimes.add(a.time);

  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

  for (const time of sortedTimes) {
    const visual = findClosestPoint(visualEmotions, time);
    const audio = findClosestPoint(audioEmotions, time);

    if (visual && audio) {
      fused.push({
        time,
        value: visual.value * visualWeight + audio.value * audioWeight,
        arousal: visual.arousal * visualWeight + audio.arousal * audioWeight,
        source: 'fused',
      });
    } else if (visual) {
      fused.push(visual);
    } else if (audio) {
      fused.push(audio);
    }
  }

  return fused;
}

function findClosestPoint(points: EmotionPoint[], time: number): EmotionPoint | undefined {
  let closest: EmotionPoint | undefined;
  let minDist = Infinity;

  for (const point of points) {
    const dist = Math.abs(point.time - time);
    if (dist < minDist) {
      minDist = dist;
      closest = point;
    }
  }

  return minDist < 1 ? closest : undefined;
}

// ─── Curve Smoothing ───────────────────────────────────────

function smoothCurve(curve: EmotionPoint[], windowSize: number): EmotionPoint[] {
  if (curve.length <= windowSize) return curve;

  const smoothed: EmotionPoint[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < curve.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(curve.length - 1, i + halfWindow);

    let sumValue = 0;
    let sumArousal = 0;
    let count = 0;

    for (let j = start; j <= end; j++) {
      sumValue += curve[j].value;
      sumArousal += curve[j].arousal;
      count++;
    }

    smoothed.push({
      time: curve[i].time,
      value: sumValue / count,
      arousal: sumArousal / count,
      source: curve[i].source,
    });
  }

  return smoothed;
}

// ─── Peak Detection ────────────────────────────────────────

function detectPeaks(curve: EmotionPoint[], threshold: number): EmotionPeak[] {
  if (curve.length < 3) return [];

  const peaks: EmotionPeak[] = [];

  for (let i = 1; i < curve.length - 1; i++) {
    const prev = curve[i - 1];
    const curr = curve[i];
    const next = curve[i + 1];

    // Check if current point is a local maximum or minimum
    const isLocalMax = curr.value > prev.value && curr.value > next.value;
    const isLocalMin = curr.value < prev.value && curr.value < next.value;

    if (isLocalMax && Math.abs(curr.value) > threshold) {
      peaks.push({
        time: curr.time,
        value: curr.value,
        type: curr.value > 0.3 ? 'positive' : curr.value < -0.3 ? 'negative' : 'neutral',
      });
    } else if (isLocalMin && Math.abs(curr.value) > threshold) {
      peaks.push({
        time: curr.time,
        value: curr.value,
        type: curr.value > 0.3 ? 'positive' : curr.value < -0.3 ? 'negative' : 'neutral',
      });
    }
  }

  return peaks;
}

// ─── Mood and Arc Determination ────────────────────────────

function determineOverallMood(curve: EmotionPoint[]): string {
  if (curve.length === 0) return 'neutral';

  const avgValue = curve.reduce((sum, p) => sum + p.value, 0) / curve.length;
  const avgArousal = curve.reduce((sum, p) => sum + p.arousal, 0) / curve.length;

  if (avgValue > 0.3 && avgArousal > 0.5) return 'energetic';
  if (avgValue > 0.3 && avgArousal <= 0.5) return 'happy';
  if (avgValue < -0.3 && avgArousal > 0.5) return 'tense';
  if (avgValue < -0.3 && avgArousal <= 0.5) return 'sad';
  if (avgArousal > 0.6) return 'excited';
  if (avgArousal < 0.3) return 'calm';
  return 'neutral';
}

function determineEmotionalArc(
  curve: EmotionPoint[],
  peaks: EmotionPeak[],
): 'rising' | 'falling' | 'stable' | 'peak' | 'valley' {
  if (curve.length < 2) return 'stable';

  const firstHalf = curve.slice(0, Math.floor(curve.length / 2));
  const secondHalf = curve.slice(Math.floor(curve.length / 2));

  const firstAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;

  if (diff > 0.2) return 'rising';
  if (diff < -0.2) return 'falling';

  // Check for peak or valley pattern
  const hasPositivePeak = peaks.some((p) => p.type === 'positive');
  const hasNegativePeak = peaks.some((p) => p.type === 'negative');

  if (hasPositivePeak && !hasNegativePeak) return 'peak';
  if (hasNegativePeak && !hasPositivePeak) return 'valley';

  return 'stable';
}

// ─── Utility ───────────────────────────────────────────────
