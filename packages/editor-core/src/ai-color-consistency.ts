/**
 * AI cross-clip color/skin-tone consistency checking.
 * Compares adjacent clips within the same scene for skin-tone RGB euclidean
 * distance and white-balance estimate mismatch.
 */

import type { ColorWheelValue } from './color-grading';
import { DEFAULT_COLOR_WHEEL_VALUE } from './color-grading';

export const SKIN_TONE_DISTANCE_THRESHOLD = 30;
export const MAX_LIFT_COMPENSATION = 0.5;

export interface SkinToneSample { r: number; g: number; b: number; }
export type WhiteBalanceEstimate = 'warm' | 'neutral' | 'cool';

export interface ClipColorInfo {
  skinToneRGB: SkinToneSample | null;
  whiteBalanceEstimate: WhiteBalanceEstimate;
}

export interface ColorConsistencyInput {
  clipAId: string;
  clipBId: string;
  clipA: ClipColorInfo;
  clipB: ClipColorInfo;
}

export interface ColorConsistencyResult {
  clipAId: string;
  clipBId: string;
  type: 'skin_tone' | 'white_balance' | 'both';
  deltaRGB: number | null;
  reason: string;
}

export function calculateSkinToneEuclideanDistance(
  a: SkinToneSample, b: SkinToneSample
): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function checkColorConsistency(
  input: ColorConsistencyInput
): ColorConsistencyResult | null {
  const { clipAId, clipBId, clipA, clipB } = input;
  const bothHaveSkin = clipA.skinToneRGB !== null && clipB.skinToneRGB !== null;
  const wbMismatch = clipA.whiteBalanceEstimate !== clipB.whiteBalanceEstimate;

  let skinToneInconsistent = false;
  let deltaRGB: number | null = null;

  if (bothHaveSkin) {
    deltaRGB = calculateSkinToneEuclideanDistance(clipA.skinToneRGB!, clipB.skinToneRGB!);
    skinToneInconsistent = deltaRGB > SKIN_TONE_DISTANCE_THRESHOLD;
  }

  if (!skinToneInconsistent && !wbMismatch) return null;

  let type: ColorConsistencyResult['type'];
  let reason: string;

  if (skinToneInconsistent && wbMismatch) {
    type = 'both';
    reason = 'skin_tone delta=' + (deltaRGB ?? 0).toFixed(1) + ' + wb mismatch (' + clipA.whiteBalanceEstimate + ' vs ' + clipB.whiteBalanceEstimate + ')';
  } else if (skinToneInconsistent) {
    type = 'skin_tone';
    reason = 'skin_tone delta=' + (deltaRGB ?? 0).toFixed(1) + ' > ' + SKIN_TONE_DISTANCE_THRESHOLD;
  } else {
    type = 'white_balance';
    reason = 'wb mismatch: ' + clipA.whiteBalanceEstimate + ' vs ' + clipB.whiteBalanceEstimate;
  }

  return { clipAId, clipBId, type, deltaRGB, reason };
}

export function generateCompensationWheel(
  clipA: SkinToneSample, clipB: SkinToneSample
): { lift: ColorWheelValue } {
  const dr = clipA.r - clipB.r;
  const dg = clipA.g - clipB.g;
  const db = clipA.b - clipB.b;
  const dist = Math.sqrt(dr * dr + dg * dg + db * db);
  if (dist < 0.001) return { lift: { ...DEFAULT_COLOR_WHEEL_VALUE } };
  const scale = Math.min(MAX_LIFT_COMPENSATION, dist / 255);
  return {
    lift: {
      r: Math.max(-1, Math.min(1, (dr / dist) * scale)),
      g: Math.max(-1, Math.min(1, (dg / dist) * scale)),
      b: Math.max(-1, Math.min(1, (db / dist) * scale)),
      intensity: 1
    }
  };
}
