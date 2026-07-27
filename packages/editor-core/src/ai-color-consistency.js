/**
 * AI cross-clip color/skin-tone consistency checking.
 * Compares adjacent clips within the same scene for skin-tone RGB euclidean
 * distance and white-balance estimate mismatch.
 */
import { DEFAULT_COLOR_WHEEL_VALUE } from './color-grading';
import { identityTranslator } from './ai-module-types';
export const SKIN_TONE_DISTANCE_THRESHOLD = 30;
export const MAX_LIFT_COMPENSATION = 0.5;
export function calculateSkinToneEuclideanDistance(a, b) {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
}
export function checkColorConsistency(input) {
    const { clipAId, clipBId, clipA, clipB } = input;
    const bothHaveSkin = clipA.skinToneRGB !== null && clipB.skinToneRGB !== null;
    const wbMismatch = clipA.whiteBalanceEstimate !== clipB.whiteBalanceEstimate;
    let skinToneInconsistent = false;
    let deltaRGB = null;
    if (bothHaveSkin) {
        deltaRGB = calculateSkinToneEuclideanDistance(clipA.skinToneRGB, clipB.skinToneRGB);
        skinToneInconsistent = deltaRGB > SKIN_TONE_DISTANCE_THRESHOLD;
    }
    if (!skinToneInconsistent && !wbMismatch)
        return null;
    let type;
    let reason;
    if (skinToneInconsistent && wbMismatch) {
        type = 'both';
        reason =
            'skin_tone delta=' +
                (deltaRGB ?? 0).toFixed(1) +
                ' + wb mismatch (' +
                clipA.whiteBalanceEstimate +
                ' vs ' +
                clipB.whiteBalanceEstimate +
                ')';
    }
    else if (skinToneInconsistent) {
        type = 'skin_tone';
        reason = 'skin_tone delta=' + (deltaRGB ?? 0).toFixed(1) + ' > ' + SKIN_TONE_DISTANCE_THRESHOLD;
    }
    else {
        type = 'white_balance';
        reason = 'wb mismatch: ' + clipA.whiteBalanceEstimate + ' vs ' + clipB.whiteBalanceEstimate;
    }
    return { clipAId, clipBId, type, deltaRGB, reason };
}
export function generateCompensationWheel(clipA, clipB) {
    const dr = clipA.r - clipB.r;
    const dg = clipA.g - clipB.g;
    const db = clipA.b - clipB.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < 0.001)
        return { lift: { ...DEFAULT_COLOR_WHEEL_VALUE } };
    const scale = Math.min(MAX_LIFT_COMPENSATION, dist / 255);
    return {
        lift: {
            r: Math.max(-1, Math.min(1, (dr / dist) * scale)),
            g: Math.max(-1, Math.min(1, (dg / dist) * scale)),
            b: Math.max(-1, Math.min(1, (db / dist) * scale)),
            intensity: 1,
        },
    };
}
export async function checkColorConsistencySafe(input, t = identityTranslator) {
    try {
        const data = checkColorConsistency(input);
        return { data, error: null };
    }
    catch {
        return { data: null, error: t('aiModules.error.computationFailed') };
    }
}
//# sourceMappingURL=ai-color-consistency.js.map