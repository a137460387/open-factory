/**
 * Quality Inspector - Multi-dimensional quality detection engine
 * Combines traditional CV algorithms with AI-based content analysis
 */
import type { InspectorConfig, QualityReport, InspectorQualityIssue, QualitySummary, FrameAnalysis, AudioAnalysis, PacingSegment, SceneTransition, ComplianceResult } from './types';
export { formatTime } from '../utils/time';
/**
 * Detect black frames by analyzing pixel brightness
 * Returns true if frame is predominantly black
 */
export declare function detectBlackFrame(pixels: Uint8ClampedArray, threshold?: number): boolean;
/**
 * Detect color bars pattern (standard test pattern)
 */
export declare function detectColorBars(pixels: Uint8ClampedArray, width: number, height: number): boolean;
/**
 * Detect static frames (no motion between frames)
 * Returns motion score (0 = static, 1 = high motion)
 */
export declare function calculateMotionScore(prevFrame: Uint8ClampedArray, currFrame: Uint8ClampedArray): number;
/**
 * Analyze audio samples for clipping, silence, and distortion
 */
export declare function analyzeAudioSegment(samples: Float32Array, config?: InspectorConfig): AudioAnalysis;
/**
 * Analyze frame sequence for technical defects
 */
export declare function analyzeFrames(frames: Array<{
    timestamp: number;
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
}>, config?: InspectorConfig): FrameAnalysis[];
/**
 * Detect scene transitions from frame analyses
 */
export declare function detectQualitySceneTransitions(frameAnalyses: FrameAnalysis[], motionThreshold?: number): SceneTransition[];
/**
 * Analyze pacing from scene transitions
 */
export declare function analyzeQualityPacing(transitions: SceneTransition[], totalDuration: number, windowSeconds?: number): PacingSegment[];
/**
 * Check compliance against platform specifications
 */
export declare function checkPlatformCompliance(mediaInfo: {
    width: number;
    height: number;
    frameRate: number;
    duration: number;
    audioSampleRate: number;
    audioChannels: number;
    fileSize?: number;
    videoBitrate?: number;
    audioBitrate?: number;
}, platformId?: string): ComplianceResult;
/**
 * Generate quality issues from analyses
 */
export declare function generateIssues(frameAnalyses: FrameAnalysis[], audioAnalyses: AudioAnalysis[], pacingSegments: PacingSegment[], sceneTransitions: SceneTransition[], complianceResult: ComplianceResult, config: InspectorConfig): InspectorQualityIssue[];
/**
 * Calculate overall quality score and grade
 */
export declare function calculateQualityScore(issues: InspectorQualityIssue[]): QualitySummary;
/**
 * Map score to letter grade
 */
export declare function scoreToGrade(score: number): QualityReport['grade'];
/**
 * Run complete quality inspection
 */
export declare function runQualityInspection(mediaData: {
    frames: Array<{
        timestamp: number;
        pixels: Uint8ClampedArray;
        width: number;
        height: number;
    }>;
    audioSegments: Array<{
        timestamp: number;
        samples: Float32Array;
    }>;
    mediaInfo: {
        width: number;
        height: number;
        frameRate: number;
        duration: number;
        audioSampleRate: number;
        audioChannels: number;
        fileSize?: number;
    };
}, config?: InspectorConfig): Promise<QualityReport>;
//# sourceMappingURL=inspector.d.ts.map