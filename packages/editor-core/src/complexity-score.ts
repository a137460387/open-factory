import { DEFAULT_COLOR_CORRECTION, normalizeColorCorrection } from './model';
import { isDefaultSpatialAudio } from './spatial-audio';
import { getTimelineDuration } from './timeline';
import { round } from './time';
import type { Clip, Project, Timeline, Track } from './model-types';
import type { EffectType } from './effects';

export type ComplexityDimensionId = 'timelineDensity' | 'effectComplexity' | 'colorDepth' | 'audioComplexity' | 'keyframeDensity';
export type ComplexityLevel = 'beginner' | 'intermediate' | 'professional' | 'master';

export interface ComplexityDimensionScore {
  id: ComplexityDimensionId;
  score: number;
  weight: number;
  rawValue: number;
  detail: string;
}

export interface ComplexityScoreResult {
  totalScore: number;
  level: ComplexityLevel;
  dimensions: Record<ComplexityDimensionId, ComplexityDimensionScore>;
}

export interface ComplexityReferenceProject {
  id: string;
  name: string;
  score: number;
}

export interface ComplexityReport {
  projectId: string;
  projectName: string;
  generatedAt: string;
  totalScore: number;
  level: ComplexityLevel;
  dimensions: ComplexityDimensionScore[];
  references: ComplexityReferenceProject[];
}

export const COMPLEXITY_WEIGHTS: Record<ComplexityDimensionId, number> = {
  timelineDensity: 0.2,
  effectComplexity: 0.25,
  colorDepth: 0.2,
  audioComplexity: 0.15,
  keyframeDensity: 0.2
};

export const COMPLEXITY_EFFECT_TYPE_FACTORS: Record<EffectType, number> = {
  blur: 1,
  sharpen: 1,
  vignette: 1,
  'film-grain': 1.2,
  'chromatic-aberration': 1.3,
  'audio-spectrum': 1.6,
  'custom-shader': 2.2,
  'motion-blur': 1.8
};

export const REFERENCE_COMPLEXITY_PROJECTS: ComplexityReferenceProject[] = [
  { id: 'simple-vlog', name: '简单 Vlog', score: 35 },
  { id: 'documentary', name: '纪录片', score: 62 },
  { id: 'commercial', name: '商业广告', score: 78 }
];

export function calculateTimelineDensityScore(timeline: Timeline): ComplexityDimensionScore {
  const durationMinutes = Math.max(getTimelineDuration(timeline) / 60, 1 / 60);
  const clipCount = getTimelineClips(timeline).length;
  const clipsPerMinute = clipCount / durationMinutes;
  return makeDimensionScore('timelineDensity', clipsPerMinute, clipsPerMinuteToScore(clipsPerMinute), `${round(clipsPerMinute)} clips/min`);
}

export function calculateEffectComplexityScore(timeline: Timeline): ComplexityDimensionScore {
  const weightedEffects = getTimelineClips(timeline).reduce((sum, clip) => {
    const effects = clip.effects ?? [];
    return sum + effects.filter((effect) => effect.enabled !== false).reduce((effectSum, effect) => effectSum + (COMPLEXITY_EFFECT_TYPE_FACTORS[effect.type] ?? 1), 0);
  }, 0);
  return makeDimensionScore('effectComplexity', weightedEffects, Math.min(100, weightedEffects * 12.5), `${round(weightedEffects)} weighted effects`);
}

export function calculateColorDepthScore(timeline: Timeline): ComplexityDimensionScore {
  const visualClips = getTimelineClips(timeline).filter(isVisualClip);
  if (visualClips.length === 0) {
    return makeDimensionScore('colorDepth', 0, 0, '0% adjusted');
  }
  const adjustedRatio =
    visualClips.reduce((sum, clip) => {
      const correction = normalizeColorCorrection(clip.colorCorrection);
      const adjustedFields = [
        correction.brightness !== DEFAULT_COLOR_CORRECTION.brightness,
        correction.contrast !== DEFAULT_COLOR_CORRECTION.contrast,
        correction.saturation !== DEFAULT_COLOR_CORRECTION.saturation,
        correction.hue !== DEFAULT_COLOR_CORRECTION.hue,
        Boolean(correction.lutPath),
        JSON.stringify(correction.colorCurves) !== JSON.stringify(DEFAULT_COLOR_CORRECTION.colorCurves),
        JSON.stringify(correction.threeWayColor) !== JSON.stringify(DEFAULT_COLOR_CORRECTION.threeWayColor)
      ].filter(Boolean).length;
      return sum + adjustedFields / 7;
    }, 0) / visualClips.length;
  return makeDimensionScore('colorDepth', adjustedRatio, adjustedRatio * 100, `${Math.round(adjustedRatio * 100)}% adjusted`);
}

export function calculateAudioComplexityScore(timeline: Timeline): ComplexityDimensionScore {
  const audioTracks = timeline.tracks.filter((track) => track.type === 'audio');
  const audioClips = audioTracks.flatMap((track) => track.clips);
  const trackProcessingNodes = audioTracks.reduce((sum, track) => sum + countTrackAudioProcessingNodes(track), 0);
  const clipProcessingNodes = audioClips.reduce((sum, clip) => sum + countClipAudioProcessingNodes(clip), 0);
  const rawValue = audioTracks.length * 2 + trackProcessingNodes * 2 + clipProcessingNodes;
  return makeDimensionScore('audioComplexity', rawValue, Math.min(100, rawValue * 10), `${rawValue} audio nodes`);
}

export function calculateKeyframeDensityScore(timeline: Timeline): ComplexityDimensionScore {
  const clips = getTimelineClips(timeline);
  if (clips.length === 0) {
    return makeDimensionScore('keyframeDensity', 0, 0, '0 keyframes/clip');
  }
  const keyframeCount = clips.reduce((sum, clip) => sum + countClipKeyframes(clip), 0);
  const keyframesPerClip = keyframeCount / clips.length;
  return makeDimensionScore('keyframeDensity', keyframesPerClip, Math.min(100, keyframesPerClip * 20), `${round(keyframesPerClip)} keyframes/clip`);
}

export function calculateComplexityScore(project: Pick<Project, 'timeline'>): ComplexityScoreResult {
  const dimensions = {
    timelineDensity: calculateTimelineDensityScore(project.timeline),
    effectComplexity: calculateEffectComplexityScore(project.timeline),
    colorDepth: calculateColorDepthScore(project.timeline),
    audioComplexity: calculateAudioComplexityScore(project.timeline),
    keyframeDensity: calculateKeyframeDensityScore(project.timeline)
  } satisfies Record<ComplexityDimensionId, ComplexityDimensionScore>;
  const totalScore = round(
    Object.values(dimensions).reduce((sum, dimension) => sum + dimension.score * dimension.weight, 0)
  );
  return {
    totalScore,
    level: getComplexityLevel(totalScore),
    dimensions
  };
}

export function getComplexityLevel(score: number): ComplexityLevel {
  const normalized = Number.isFinite(score) ? score : 0;
  if (normalized >= 80) {
    return 'master';
  }
  if (normalized >= 65) {
    return 'professional';
  }
  if (normalized >= 40) {
    return 'intermediate';
  }
  return 'beginner';
}

export function createComplexityReport(project: Pick<Project, 'id' | 'name' | 'timeline'>, generatedAt = new Date().toISOString()): ComplexityReport {
  const result = calculateComplexityScore(project);
  return {
    projectId: project.id,
    projectName: project.name,
    generatedAt,
    totalScore: result.totalScore,
    level: result.level,
    dimensions: Object.values(result.dimensions),
    references: REFERENCE_COMPLEXITY_PROJECTS
  };
}

function clipsPerMinuteToScore(clipsPerMinute: number): number {
  return Math.min(100, clipsPerMinute * 5);
}

function makeDimensionScore(id: ComplexityDimensionId, rawValue: number, score: number, detail: string): ComplexityDimensionScore {
  return {
    id,
    score: round(Math.min(100, Math.max(0, Number.isFinite(score) ? score : 0))),
    weight: COMPLEXITY_WEIGHTS[id],
    rawValue: round(Number.isFinite(rawValue) ? rawValue : 0),
    detail
  };
}

function getTimelineClips(timeline: Timeline): Clip[] {
  return timeline.tracks.flatMap((track) => track.clips);
}

function isVisualClip(clip: Clip): boolean {
  return clip.type === 'video' || clip.type === 'image' || clip.type === 'adjustment' || clip.type === 'nested-sequence';
}

function countTrackAudioProcessingNodes(track: Track): number {
  let count = 0;
  if (track.volume !== undefined && track.volume !== 1) {
    count += 1;
  }
  if (track.pan !== undefined && track.pan !== 0) {
    count += 1;
  }
  if (track.eq?.enabled) {
    count += Math.max(1, track.eq.bands.filter((band) => band.gain !== 0).length);
  }
  if (track.compressor?.enabled) {
    count += 1;
  }
  return count;
}

function countClipAudioProcessingNodes(clip: Clip): number {
  if (clip.type !== 'audio' && clip.type !== 'video' && clip.type !== 'nested-sequence') {
    return 0;
  }
  let count = 0;
  if (clip.volume !== undefined && clip.volume !== 1) {
    count += 1;
  }
  if (clip.audioDenoise?.enabled) {
    count += 1;
  }
  if (!isDefaultSpatialAudio(clip.spatialAudio)) {
    count += 1;
  }
  if (clip.pitchSemitones !== undefined && clip.pitchSemitones !== 0) {
    count += 1;
  }
  if ((clip.fadeInDuration ?? 0) > 0) {
    count += 1;
  }
  if ((clip.fadeOutDuration ?? 0) > 0) {
    count += 1;
  }
  return count;
}

function countClipKeyframes(clip: Clip): number {
  return Object.values(clip.keyframes ?? {}).reduce((sum, keyframes) => sum + (Array.isArray(keyframes) ? keyframes.length : 0), 0);
}
