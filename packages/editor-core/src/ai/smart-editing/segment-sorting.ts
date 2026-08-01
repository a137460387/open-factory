/**
 * Video segment sorting strategies
 */

import type { SegmentSortOptions, VideoSegment } from './types';
import { shuffleArray } from './utils';

/**
 * Sort video segments by strategy
 */
export function sortSegments(segments: VideoSegment[], options: Partial<SegmentSortOptions> = {}): VideoSegment[] {
  const defaultOptions: SegmentSortOptions = {
    strategy: 'narrative',
    preserveOriginalOrder: false,
    considerEmotionContinuity: true,
    considerRhythm: true,
    considerContentRelevance: true,
    weights: {
      chronological: 0.2,
      importance: 0.3,
      emotionContinuity: 0.2,
      rhythmMatch: 0.15,
      contentRelevance: 0.15,
    },
  };

  const mergedOptions = { ...defaultOptions, ...options };

  switch (mergedOptions.strategy) {
    case 'chronological':
      return [...segments].sort((a, b) => a.startTime - b.startTime);

    case 'importance':
      return [...segments].sort((a, b) => b.importance - a.importance);

    case 'emotion':
      return sortByEmotion(segments);

    case 'rhythm':
      return sortByRhythm(segments);

    case 'narrative':
      return sortByNarrative(segments, mergedOptions);

    case 'random':
      return shuffleArray([...segments]);

    default:
      return segments;
  }
}

/**
 * Sort by emotion order (calm -> tense)
 */
function sortByEmotion(segments: VideoSegment[]): VideoSegment[] {
  const emotionOrder: import('./types').EmotionType[] = ['calm', 'neutral', 'happy', 'excited', 'tense', 'angry', 'sad'];

  return [...segments].sort((a, b) => {
    const aIndex = emotionOrder.indexOf(a.emotion);
    const bIndex = emotionOrder.indexOf(b.emotion);
    return aIndex - bIndex;
  });
}

/**
 * Sort by motion intensity
 */
function sortByRhythm(segments: VideoSegment[]): VideoSegment[] {
  return [...segments].sort((a, b) => {
    return b.motionIntensity - a.motionIntensity;
  });
}

/**
 * Sort by narrative structure (weighted scoring)
 */
function sortByNarrative(segments: VideoSegment[], options: SegmentSortOptions): VideoSegment[] {
  const weights = options.weights || {
    chronological: 0.2,
    importance: 0.3,
    emotionContinuity: 0.2,
    rhythmMatch: 0.15,
    contentRelevance: 0.15,
  };

  const scoredSegments = segments.map((segment, index) => {
    let score = 0;

    // Chronological score
    score += (1 - index / segments.length) * weights.chronological;

    // Importance score
    score += segment.importance * weights.importance;

    // Emotion continuity score
    const prevSegment = index > 0 ? segments[index - 1] : null;
    const nextSegment = index < segments.length - 1 ? segments[index + 1] : null;

    let emotionContinuity = 0;
    if (prevSegment && prevSegment.emotion === segment.emotion) {
      emotionContinuity += 0.5;
    }
    if (nextSegment && nextSegment.emotion === segment.emotion) {
      emotionContinuity += 0.5;
    }
    score += emotionContinuity * weights.emotionContinuity;

    // Rhythm match score
    score += segment.motionIntensity * weights.rhythmMatch;

    // Content relevance score
    score += (segment.tags.length / 10) * weights.contentRelevance;

    return { segment, score };
  });

  scoredSegments.sort((a, b) => b.score - a.score);

  return scoredSegments.map((item) => item.segment);
}
