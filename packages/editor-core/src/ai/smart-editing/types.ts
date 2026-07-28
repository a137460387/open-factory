/**
 * Smart editing type definitions
 */

// ==================== Time Point ====================

export interface TimePoint {
  time: number;
  confidence: number;
  type: TimePointType;
  description?: string;
}

export type TimePointType =
  | 'beat'
  | 'downbeat'
  | 'silence'
  | 'scene-change'
  | 'motion-change'
  | 'emotion-peak'
  | 'narrative-turn'
  | 'highlight'
  | 'cut-point';

// ==================== Audio ====================

export interface BeatInfo {
  bpm: number;
  beats: number[];
  downbeats: number[];
  beatStrength: number[];
  confidence: number;
}

export interface AudioFeatures {
  volume: number;
  hasSpeech: boolean;
  hasMusic: boolean;
  bpm?: number;
  spectralFeatures: SpectralFeatures;
}

export interface SpectralFeatures {
  lowEnergy: number;
  midEnergy: number;
  highEnergy: number;
  spectralCentroid: number;
  spectralRolloff: number;
}

// ==================== Emotion ====================

export interface EmotionAnalysis {
  timeline: EmotionPoint[];
  overallEmotion: EmotionType;
  emotionalIntensity: number;
  peaks: TimePoint[];
}

export interface EmotionPoint {
  time: number;
  emotion: EmotionType;
  intensity: number;
  confidence: number;
}

export type EmotionType =
  'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised' | 'disgusted' | 'excited' | 'calm' | 'tense';

// ==================== Cut ====================

export interface CutSuggestion {
  id: string;
  time: number;
  type: CutType;
  confidence: number;
  reason: string;
  relatedTimePoints: TimePoint[];
  suggestedTransition?: TransitionType;
}

export type CutType =
  | 'hard-cut'
  | 'soft-cut'
  | 'jump-cut'
  | 'match-cut'
  | 'cross-cut'
  | 'cutaway'
  | 'reaction-shot'
  | 'insert'
  | 'transition';

export type TransitionType =
  | 'fade-in'
  | 'fade-out'
  | 'cross-dissolve'
  | 'wipe'
  | 'zoom'
  | 'blur'
  | 'slide'
  | 'dip-to-black'
  | 'dip-to-white'
  | 'none';

// ==================== Trailer ====================

export interface TrailerConfig {
  targetDuration: number;
  style: TrailerStyle;
  tempo: TrailerTempo;
  includeDialogue: boolean;
  includeMusic: boolean;
  includeNarration: boolean;
  emotionCurve: EmotionType[];
  climaxCount: number;
}

export type TrailerStyle =
  | 'action'
  | 'drama'
  | 'comedy'
  | 'horror'
  | 'romance'
  | 'documentary'
  | 'teaser'
  | 'official';

export type TrailerTempo = 'slow' | 'medium' | 'fast' | 'dynamic';

export interface TrailerSegment {
  id: string;
  sourceId: string;
  startTime: number;
  endTime: number;
  type: TrailerSegmentType;
  emotion: EmotionType;
  importance: number;
  transition: TransitionType;
}

export type TrailerSegmentType =
  | 'opening'
  | 'setup'
  | 'buildup'
  | 'climax'
  | 'resolution'
  | 'closing'
  | 'title-card'
  | 'quote';

export interface TrailerResult {
  segments: TrailerSegment[];
  totalDuration: number;
  emotionCurve: EmotionPoint[];
  beatInfo: BeatInfo;
  qualityScore: number;
}

// ==================== Segment Sorting ====================

export interface SegmentSortOptions {
  strategy: SortStrategy;
  preserveOriginalOrder: boolean;
  considerEmotionContinuity: boolean;
  considerRhythm: boolean;
  considerContentRelevance: boolean;
  weights?: SortWeights;
}

export type SortStrategy =
  | 'chronological'
  | 'importance'
  | 'emotion'
  | 'rhythm'
  | 'narrative'
  | 'random'
  | 'custom';

export interface SortWeights {
  chronological: number;
  importance: number;
  emotionContinuity: number;
  rhythmMatch: number;
  contentRelevance: number;
}

// ==================== Video Segment ====================

export interface VideoSegment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  emotion: EmotionType;
  importance: number;
  tags: string[];
  sceneType: string;
  motionIntensity: number;
  audioFeatures: AudioFeatures;
}

// ==================== Config ====================

export interface SmartEditingConfig {
  enableRhythmMatching: boolean;
  enableEmotionAwareness: boolean;
  enableAutoTrailer: boolean;
  enableSmartSorting: boolean;
  rhythmMatchPrecision: number;
  emotionAnalysisPrecision: number;
  minCutInterval: number;
  maxCutInterval: number;
  defaultTransition: TransitionType;
}
