/**
 * Emotion analysis and cut suggestion generation
 */

import type {
  CutSuggestion,
  EmotionAnalysis,
  EmotionPoint,
  EmotionType,
  SmartEditingConfig,
  TimePoint,
  BeatInfo,
} from './types';
import {
  average,
  computeAudioEnergy,
  computeZeroCrossingRate,
  generateId,
  standardDeviation,
  DEFAULT_SMART_EDITING_CONFIG,
} from './utils';

/**
 * Analyze emotion from audio (and optional video features)
 */
export function analyzeEmotion(
  audioData: Float32Array,
  sampleRate: number,
  videoFeatures?: Array<{ brightness: number; motion: number; color: number }>,
): EmotionAnalysis {
  const timeline: EmotionPoint[] = [];
  const frameSize = Math.floor(sampleRate * 0.1);
  const hopSize = Math.floor(frameSize / 2);

  for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
    const frame = audioData.slice(i, i + frameSize);
    const time = i / sampleRate;

    const energy = computeAudioEnergy(frame);
    const zcr = computeZeroCrossingRate(frame);

    let emotion: EmotionType = 'neutral';
    let intensity = 0;

    if (energy > 0.1 && zcr > 0.1) {
      emotion = 'excited';
      intensity = Math.min(energy * 5, 1);
    } else if (energy > 0.05 && zcr < 0.05) {
      emotion = 'calm';
      intensity = Math.min(energy * 3, 1);
    } else if (energy < 0.01) {
      emotion = 'sad';
      intensity = Math.min((0.01 - energy) * 100, 1);
    } else {
      emotion = 'neutral';
      intensity = 0.5;
    }

    if (videoFeatures && videoFeatures.length > 0) {
      const frameIndex = Math.floor((i / audioData.length) * videoFeatures.length);
      const visual = videoFeatures[Math.min(frameIndex, videoFeatures.length - 1)];

      if (visual.motion > 0.5) {
        emotion = 'excited';
        intensity = Math.max(intensity, visual.motion);
      } else if (visual.brightness < 0.3) {
        emotion = 'sad';
        intensity = Math.max(intensity, 1 - visual.brightness);
      }
    }

    timeline.push({
      time,
      emotion,
      intensity,
      confidence: 0.7,
    });
  }

  const peaks = detectEmotionPeaks(timeline);

  const emotionCounts: Record<EmotionType, number> = {
    neutral: 0,
    happy: 0,
    sad: 0,
    angry: 0,
    fearful: 0,
    surprised: 0,
    disgusted: 0,
    excited: 0,
    calm: 0,
    tense: 0,
  };

  for (const point of timeline) {
    emotionCounts[point.emotion]++;
  }

  const overallEmotion = Object.entries(emotionCounts).sort(([, a], [, b]) => b - a)[0][0] as EmotionType;

  const intensities = timeline.map((p) => p.intensity);
  const emotionalIntensity = standardDeviation(intensities);

  return {
    timeline,
    overallEmotion,
    emotionalIntensity,
    peaks,
  };
}

/**
 * Detect emotion peaks in timeline
 */
function detectEmotionPeaks(timeline: EmotionPoint[]): TimePoint[] {
  const peaks: TimePoint[] = [];
  const windowSize = 10;

  for (let i = windowSize; i < timeline.length - windowSize; i++) {
    const window = timeline.slice(i - windowSize, i + windowSize + 1);
    const avgIntensity = average(window.map((p) => p.intensity));
    const currentIntensity = timeline[i].intensity;

    if (currentIntensity > avgIntensity * 1.5 && currentIntensity > 0.6) {
      peaks.push({
        time: timeline[i].time,
        confidence: currentIntensity,
        type: 'emotion-peak',
        description: `情绪高潮: ${timeline[i].emotion}`,
      });
    }
  }

  return peaks;
}

/**
 * Generate cut suggestions based on beats, emotions, and scene changes
 */
export function generateCutSuggestions(
  beatInfo: BeatInfo,
  emotionAnalysis: EmotionAnalysis,
  sceneChanges: TimePoint[],
  config: Partial<SmartEditingConfig> = {},
): CutSuggestion[] {
  const mergedConfig = { ...DEFAULT_SMART_EDITING_CONFIG, ...config };
  const suggestions: CutSuggestion[] = [];

  if (mergedConfig.enableRhythmMatching) {
    for (const beat of beatInfo.beats) {
      const nearbyEmotion = findNearestEmotion(emotionAnalysis.timeline, beat);

      suggestions.push({
        id: generateId(),
        time: beat,
        type: 'hard-cut',
        confidence: 0.8 * mergedConfig.rhythmMatchPrecision,
        reason: '节拍匹配',
        relatedTimePoints: [
          {
            time: beat,
            confidence: 0.8,
            type: 'beat',
          },
        ],
        suggestedTransition: 'none',
      });
    }
  }

  if (mergedConfig.enableEmotionAwareness) {
    for (const peak of emotionAnalysis.peaks) {
      suggestions.push({
        id: generateId(),
        time: peak.time,
        type: 'cutaway',
        confidence: peak.confidence * mergedConfig.emotionAnalysisPrecision,
        reason: `情绪变化: ${peak.description}`,
        relatedTimePoints: [peak],
        suggestedTransition: 'cross-dissolve',
      });
    }
  }

  for (const change of sceneChanges) {
    suggestions.push({
      id: generateId(),
      time: change.time,
      type: 'match-cut',
      confidence: change.confidence,
      reason: '场景变化',
      relatedTimePoints: [change],
      suggestedTransition: 'cross-dissolve',
    });
  }

  const uniqueSuggestions = deduplicateSuggestions(suggestions, mergedConfig.minCutInterval);
  uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);

  return uniqueSuggestions;
}

/**
 * Find nearest emotion point to a given time
 */
function findNearestEmotion(timeline: EmotionPoint[], time: number): EmotionPoint | null {
  if (timeline.length === 0) return null;

  let nearest = timeline[0];
  let minDistance = Math.abs(timeline[0].time - time);

  for (const point of timeline) {
    const distance = Math.abs(point.time - time);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = point;
    }
  }

  return nearest;
}

/**
 * Deduplicate cut suggestions by minimum interval
 */
function deduplicateSuggestions(suggestions: CutSuggestion[], minInterval: number): CutSuggestion[] {
  const sorted = [...suggestions].sort((a, b) => a.time - b.time);
  const unique: CutSuggestion[] = [];

  for (const suggestion of sorted) {
    const lastUnique = unique[unique.length - 1];

    if (!lastUnique || suggestion.time - lastUnique.time >= minInterval) {
      unique.push(suggestion);
    } else if (suggestion.confidence > lastUnique.confidence) {
      unique[unique.length - 1] = suggestion;
    }
  }

  return unique;
}

/**
 * Emotion-aware edit: generate cut suggestions at emotion change points
 */
export function emotionAwareEdit(
  videoSegments: import('./types').VideoSegment[],
  emotionAnalysis: EmotionAnalysis,
  config: Partial<SmartEditingConfig> = {},
): CutSuggestion[] {
  const mergedConfig = { ...DEFAULT_SMART_EDITING_CONFIG, ...config };
  const suggestions: CutSuggestion[] = [];

  for (let i = 1; i < emotionAnalysis.timeline.length; i++) {
    const prev = emotionAnalysis.timeline[i - 1];
    const curr = emotionAnalysis.timeline[i];

    if (prev.emotion !== curr.emotion) {
      const intensityChange = Math.abs(curr.intensity - prev.intensity);

      if (intensityChange > 0.3) {
        suggestions.push({
          id: generateId(),
          time: curr.time,
          type: 'cutaway',
          confidence: intensityChange,
          reason: `情绪变化: ${prev.emotion} -> ${curr.emotion}`,
          relatedTimePoints: [
            {
              time: curr.time,
              confidence: intensityChange,
              type: 'emotion-peak',
              description: `情绪从${prev.emotion}变为${curr.emotion}`,
            },
          ],
          suggestedTransition: 'cross-dissolve',
        });
      }
    }
  }

  return suggestions;
}
