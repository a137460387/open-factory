/**
 * Trailer generation from video segments
 */

import type {
  BeatInfo,
  EmotionPoint,
  TrailerConfig,
  TrailerResult,
  TrailerSegment,
  VideoSegment,
} from './types';
import { generateId } from './utils';

/**
 * Generate a trailer from video segments
 */
export function generateTrailer(segments: VideoSegment[], config: Partial<TrailerConfig> = {}): TrailerResult {
  const defaultConfig: TrailerConfig = {
    targetDuration: 120,
    style: 'official',
    tempo: 'dynamic',
    includeDialogue: true,
    includeMusic: true,
    includeNarration: false,
    emotionCurve: ['excited', 'calm', 'excited', 'tense', 'excited'],
    climaxCount: 3,
  };

  const mergedConfig = { ...defaultConfig, ...config };

  const sortedSegments = [...segments].sort((a, b) => b.importance - a.importance);

  const climaxSegments = sortedSegments
    .filter((s) => s.emotion === 'excited' || s.emotion === 'tense')
    .slice(0, mergedConfig.climaxCount);

  const setupSegments = sortedSegments.filter((s) => s.emotion === 'calm' || s.emotion === 'neutral').slice(0, 3);

  const trailerSegments: TrailerSegment[] = [];
  let currentDuration = 0;

  // Opening
  if (setupSegments.length > 0) {
    const opening = setupSegments[0];
    trailerSegments.push({
      id: generateId(),
      sourceId: opening.id,
      startTime: opening.startTime,
      endTime: Math.min(opening.endTime, opening.startTime + 10),
      type: 'opening',
      emotion: opening.emotion,
      importance: opening.importance,
      transition: 'fade-in',
    });
    currentDuration += 10;
  }

  // Climax
  for (let i = 0; i < climaxSegments.length && currentDuration < mergedConfig.targetDuration; i++) {
    const climax = climaxSegments[i];
    const segmentDuration = Math.min(climax.duration, 15);

    trailerSegments.push({
      id: generateId(),
      sourceId: climax.id,
      startTime: climax.startTime,
      endTime: climax.startTime + segmentDuration,
      type: 'climax',
      emotion: climax.emotion,
      importance: climax.importance,
      transition: i === 0 ? 'cross-dissolve' : 'none',
    });

    currentDuration += segmentDuration;
  }

  // Closing
  if (setupSegments.length > 1) {
    const closing = setupSegments[setupSegments.length - 1];
    trailerSegments.push({
      id: generateId(),
      sourceId: closing.id,
      startTime: closing.startTime,
      endTime: Math.min(closing.endTime, closing.startTime + 10),
      type: 'closing',
      emotion: closing.emotion,
      importance: closing.importance,
      transition: 'fade-out',
    });
    currentDuration += 10;
  }

  // Emotion curve
  const emotionCurve: EmotionPoint[] = trailerSegments.map((segment, index) => ({
    time: index * 10,
    emotion: segment.emotion,
    intensity: segment.importance,
    confidence: 0.8,
  }));

  // Beat info
  const beatInfo: BeatInfo = {
    bpm: 120,
    beats: trailerSegments.map((_, index) => index * 0.5),
    downbeats: trailerSegments.filter((_, index) => index % 4 === 0).map((_, index) => index * 2),
    beatStrength: trailerSegments.map((s) => s.importance),
    confidence: 0.8,
  };

  const qualityScore = computeTrailerQuality(trailerSegments, mergedConfig);

  return {
    segments: trailerSegments,
    totalDuration: currentDuration,
    emotionCurve,
    beatInfo,
    qualityScore,
  };
}

/**
 * Compute trailer quality score
 */
function computeTrailerQuality(segments: TrailerSegment[], config: TrailerConfig): number {
  let score = 0;

  const durationRatio = (segments.length * 10) / config.targetDuration;
  score += 1 - Math.abs(1 - durationRatio);

  const emotions = new Set(segments.map((s) => s.emotion));
  score += emotions.size / 5;

  const hasOpening = segments.some((s) => s.type === 'opening');
  const hasClosing = segments.some((s) => s.type === 'closing');
  const hasClimax = segments.some((s) => s.type === 'climax');

  if (hasOpening) score += 0.2;
  if (hasClosing) score += 0.2;
  if (hasClimax) score += 0.2;

  return Math.min(score / 2, 1);
}
