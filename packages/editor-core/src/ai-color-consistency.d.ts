/**
 * AI cross-clip color/skin-tone consistency checking.
 * Compares adjacent clips within the same scene for skin-tone RGB euclidean
 * distance and white-balance estimate mismatch.
 */
import type { ColorWheelValue } from './color-grading';
import type { AiModuleResult, TranslateFn } from './ai-module-types';
export declare const SKIN_TONE_DISTANCE_THRESHOLD = 30;
export declare const MAX_LIFT_COMPENSATION = 0.5;
export interface SkinToneSample {
    r: number;
    g: number;
    b: number;
}
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
export declare function calculateSkinToneEuclideanDistance(a: SkinToneSample, b: SkinToneSample): number;
export declare function checkColorConsistency(input: ColorConsistencyInput): ColorConsistencyResult | null;
export declare function generateCompensationWheel(clipA: SkinToneSample, clipB: SkinToneSample): {
    lift: ColorWheelValue;
};
export declare function checkColorConsistencySafe(input: ColorConsistencyInput, t?: TranslateFn): Promise<AiModuleResult<ColorConsistencyResult | null>>;
//# sourceMappingURL=ai-color-consistency.d.ts.map