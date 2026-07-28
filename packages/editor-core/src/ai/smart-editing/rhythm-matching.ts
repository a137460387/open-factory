/**
 * Rhythm matching: beat detection and rhythm-based editing
 */

import type { BeatInfo, CutSuggestion, SmartEditingConfig, VideoSegment } from './types';
import { average, computeAudioEnergy, detectPeaks, generateId, smoothArray, DEFAULT_SMART_EDITING_CONFIG } from './utils';

/**
 * Detect audio beats
 */
export function detectBeats(audioData: Float32Array, sampleRate: number): BeatInfo {
  const frameSize = Math.floor(sampleRate * 0.025);
  const hopSize = Math.floor(frameSize / 2);
  const energyEnvelope: number[] = [];

  for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
    const frame = audioData.slice(i, i + frameSize);
    energyEnvelope.push(computeAudioEnergy(frame));
  }

  const smoothedEnergy = smoothArray(energyEnvelope, 5);
  const peaks = detectPeaks(smoothedEnergy, 0.3);

  const peakTimes = peaks.map((p) => (p * hopSize) / sampleRate);
  const intervals: number[] = [];

  for (let i = 1; i < peakTimes.length; i++) {
    intervals.push(peakTimes[i] - peakTimes[i - 1]);
  }

  const avgInterval = intervals.length > 0 ? average(intervals) : 0.5;
  const bpm = avgInterval > 0 ? 60 / avgInterval : 120;

  const downbeats: number[] = [];
  for (let i = 0; i < peakTimes.length; i += 4) {
    downbeats.push(peakTimes[i]);
  }

  const beatStrength = peaks.map((p) => smoothedEnergy[p] || 0);

  return {
    bpm: Math.round(bpm),
    beats: peakTimes,
    downbeats,
    beatStrength,
    confidence: 0.8,
  };
}

/**
 * Rhythm-matching edit: generate cut suggestions aligned to beats
 */
export function rhythmMatchEdit(
  videoSegments: VideoSegment[],
  beatInfo: BeatInfo,
  config: Partial<SmartEditingConfig> = {},
): CutSuggestion[] {
  const mergedConfig = { ...DEFAULT_SMART_EDITING_CONFIG, ...config };
  const suggestions: CutSuggestion[] = [];

  let currentBeatIndex = 0;
  let currentVideoIndex = 0;

  while (currentVideoIndex < videoSegments.length && currentBeatIndex < beatInfo.beats.length) {
    const beatTime = beatInfo.beats[currentBeatIndex];
    const videoSegment = videoSegments[currentVideoIndex];

    if (beatTime >= videoSegment.startTime && beatTime <= videoSegment.endTime) {
      suggestions.push({
        id: generateId(),
        time: beatTime,
        type: 'hard-cut',
        confidence: 0.9,
        reason: '节奏匹配',
        relatedTimePoints: [
          {
            time: beatTime,
            confidence: 0.9,
            type: 'beat',
          },
        ],
        suggestedTransition: 'none',
      });

      currentBeatIndex++;
    } else {
      currentVideoIndex++;
    }
  }

  return suggestions;
}
