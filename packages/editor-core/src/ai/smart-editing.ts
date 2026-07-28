/**
 * Smart editing module - entry point
 *
 * Re-exports all public APIs from sub-modules for backward compatibility.
 */

// Types
export type {
  TimePoint,
  TimePointType,
  BeatInfo,
  AudioFeatures,
  SpectralFeatures,
  EmotionAnalysis,
  EmotionPoint,
  EmotionType,
  CutSuggestion,
  CutType,
  TransitionType,
  TrailerConfig,
  TrailerStyle,
  TrailerTempo,
  TrailerSegment,
  TrailerSegmentType,
  TrailerResult,
  SegmentSortOptions,
  SortStrategy,
  SortWeights,
  VideoSegment,
  SmartEditingConfig,
} from './smart-editing/types';

// Utilities
export {
  generateId,
  average,
  standardDeviation,
  smoothArray,
  detectPeaks,
  computeSimilarity,
  computeAudioEnergy,
  computeZeroCrossingRate,
  detectSilence,
  DEFAULT_SMART_EDITING_CONFIG,
  createDefaultSmartEditingConfig,
  validateSmartEditingConfig,
  shuffleArray,
} from './smart-editing/utils';

// Rhythm matching
export { detectBeats, rhythmMatchEdit } from './smart-editing/rhythm-matching';

// Emotion analysis & cut suggestions
export { analyzeEmotion, generateCutSuggestions, emotionAwareEdit } from './smart-editing/emotion-analysis';

// Trailer generation
export { generateTrailer } from './smart-editing/trailer-generation';

// Segment sorting
export { sortSegments } from './smart-editing/segment-sorting';
