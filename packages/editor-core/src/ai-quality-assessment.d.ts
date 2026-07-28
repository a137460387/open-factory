import type { AiModuleResult, TranslateFn } from './ai-module-types';
export type QualitySeverity = 'low' | 'medium' | 'high';
export type QualityGrade = 'green' | 'yellow' | 'red';
export interface QualityAssessmentIssue {
    type: string;
    severity: QualitySeverity;
    description: string;
    suggestedFix: string;
}
export interface QualityAssessmentResult {
    overallScore: number;
    issues: QualityAssessmentIssue[];
}
export interface QualityEditorParams {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    sharpness?: number;
    denoise?: boolean;
    stabilization?: boolean;
    volume?: number;
    noiseReduction?: boolean;
}
/** Map a 0-100 score to a grade bucket. */
export declare function mapScoreToGrade(score: number): QualityGrade;
/** Parse and validate an AI quality assessment response. */
export declare function parseQualityAssessmentResponse(json: unknown): QualityAssessmentResult;
/**
 * Map an issue's suggestedFix string to concrete editor parameters.
 * Returns undefined if no mapping is found.
 */
export declare function mapSuggestedFixToEditorParams(fix: string): QualityEditorParams | undefined;
export declare function buildQualityAssessmentSystemPrompt(): string;
export declare function buildQualityAssessmentUserPrompt(mediaInfo: {
    name: string;
    type: string;
    width?: number;
    height?: number;
    duration?: number;
    hasAudio?: boolean;
}): string;
/**
 * Detect frame shake by computing pixel-difference variance between consecutive frames.
 * Each frame is a flat array of grayscale pixel values (0-255).
 * Returns true if shake is detected (high variance in frame-to-frame differences).
 */
export declare function detectFrameShake(frames: Uint8Array[], threshold?: number): boolean;
/**
 * Analyze audio RMS level to determine if it's in a normal range.
 * Returns { rms, isQuiet, isClipping }.
 */
export declare function analyzeAudioRms(samples: Float32Array, quietDb?: number, clipDb?: number): {
    rms: number;
    rmsDb: number;
    isQuiet: boolean;
    isClipping: boolean;
};
export declare function parseQualityAssessmentResponseSafe(json: unknown, t?: TranslateFn): Promise<AiModuleResult<QualityAssessmentResult>>;
//# sourceMappingURL=ai-quality-assessment.d.ts.map