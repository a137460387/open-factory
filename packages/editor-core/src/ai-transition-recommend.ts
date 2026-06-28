import { round } from './time';
import type { TransitionType } from './model-types';
import { DEFAULT_TRANSITION_TYPE } from './model';

export const CHI_SQUARE_BINS = 16;
export const CHI_SQUARE_THRESHOLD = 0.4;
export const MOTION_HIGH_THRESHOLD = 12;
export const MOTION_LOW_THRESHOLD = 3;

export interface TransitionClipFeatures {
  colorHist: number[];
  motionScore: number;
  sceneTag?: string;
}

export interface TransitionRecommendation {
  transitionType: TransitionType;
  duration: number;
  reason: string;
  confidence: number;
}

export interface TransitionRecommendationResult {
  recommended: TransitionRecommendation[];
}

const VALID_TRANSITION_TYPES: TransitionType[] = [
  'dissolve',
  'fade-black',
  'flash-white',
  'flash-black',
  'wipe-left',
  'wipe-right',
  'wipe-up',
  'wipe-down'
];

export function calculateRGBHistogramChiSquareDistance(histA: readonly number[], histB: readonly number[]): number {
  const length = Math.max(histA.length, histB.length);
  if (length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < length; i++) {
    const a = Math.max(0, histA[i] ?? 0);
    const b = Math.max(0, histB[i] ?? 0);
    const denom = a + b;
    if (denom > 0) {
      sum += ((a - b) * (a - b)) / denom;
    }
  }
  return round(sum);
}

export function estimateMotionFromFrameDifferences(
  framePixels: readonly (readonly number[])[],
  width: number,
  height: number
): number {
  if (framePixels.length < 2) return 0;
  let totalDiff = 0;
  let count = 0;
  for (let f = 0; f < framePixels.length - 1; f++) {
    const curr = framePixels[f];
    const next = framePixels[f + 1];
    const pixelCount = Math.min(curr.length, next.length, width * height);
    for (let p = 0; p < pixelCount; p++) {
      totalDiff += Math.abs(curr[p] - next[p]);
      count++;
    }
  }
  return count > 0 ? round(totalDiff / count) : 0;
}

export function estimateMotionFromLumaDiffs(lumaDiffs: readonly number[]): number {
  if (lumaDiffs.length === 0) return 0;
  let sum = 0;
  for (const diff of lumaDiffs) {
    sum += Math.abs(diff);
  }
  return round(sum / lumaDiffs.length);
}

export function mapToValidTransitionType(type: string): TransitionType {
  const normalized = type.toLowerCase().trim();
  for (const valid of VALID_TRANSITION_TYPES) {
    if (valid === normalized) return valid;
  }
  if (normalized.includes('dissolve') || normalized.includes('cross')) return 'dissolve';
  if (normalized.includes('fade') && normalized.includes('black')) return 'fade-black';
  if (normalized.includes('flash') && normalized.includes('white')) return 'flash-white';
  if (normalized.includes('flash') && normalized.includes('black')) return 'flash-black';
  if (normalized.includes('wipe') && normalized.includes('left')) return 'wipe-left';
  if (normalized.includes('wipe') && normalized.includes('right')) return 'wipe-right';
  if (normalized.includes('wipe') && normalized.includes('up')) return 'wipe-up';
  if (normalized.includes('wipe') && normalized.includes('down')) return 'wipe-down';
  return DEFAULT_TRANSITION_TYPE;
}

export function recommendTransition(
  clipA: TransitionClipFeatures,
  clipB: TransitionClipFeatures
): TransitionRecommendationResult {
  const colorDist = calculateRGBHistogramChiSquareDistance(clipA.colorHist, clipB.colorHist);
  const avgMotion = (clipA.motionScore + clipB.motionScore) / 2;
  const recommendations: TransitionRecommendation[] = [];

  if (colorDist > CHI_SQUARE_THRESHOLD) {
    recommendations.push({
      transitionType: 'dissolve',
      duration: 0.8,
      reason: '颜色差异较大，推荐交叉溶解过渡',
      confidence: round(Math.min(0.95, 0.6 + colorDist * 0.3))
    });
  }

  if (avgMotion > MOTION_HIGH_THRESHOLD) {
    recommendations.push({
      transitionType: 'flash-white',
      duration: 0.3,
      reason: '运动幅度高，推荐闪白过渡',
      confidence: round(Math.min(0.9, 0.5 + avgMotion * 0.02))
    });
  } else if (avgMotion < MOTION_LOW_THRESHOLD) {
    recommendations.push({
      transitionType: 'fade-black',
      duration: 1.0,
      reason: '画面静止，推荐黑场过渡',
      confidence: round(0.7 - avgMotion * 0.05)
    });
  }

  if (clipA.sceneTag && clipB.sceneTag && clipA.sceneTag !== clipB.sceneTag) {
    recommendations.push({
      transitionType: 'wipe-left',
      duration: 0.5,
      reason: '场景类型变化，推荐擦除过渡',
      confidence: 0.75
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      transitionType: 'dissolve',
      duration: 0.5,
      reason: '默认过渡',
      confidence: 0.5
    });
  }

  return {
    recommended: recommendations.sort((a, b) => b.confidence - a.confidence)
  };
}
