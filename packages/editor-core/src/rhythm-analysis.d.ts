import type { Project, Timeline } from './model';
export type RhythmReferenceType = 'advertising' | 'documentary' | 'variety' | 'short-video';
export interface RhythmShot {
    clipId: string;
    name: string;
    start: number;
    duration: number;
}
export interface RhythmCurvePoint {
    time: number;
    cutsPerSecond: number;
}
export interface RhythmChangePoint {
    time: number;
    previousClipId: string;
    nextClipId: string;
    previousDuration: number;
    nextDuration: number;
    ratio: number;
}
export interface RepeatedRhythmSegment {
    start: number;
    end: number;
    clipCount: number;
    averageDuration: number;
}
export interface RhythmReferenceProfile {
    type: RhythmReferenceType;
    averageShotDuration: number;
    typicalCutFrequency: number;
}
export interface RhythmAnalysisReport {
    projectName: string;
    generatedAt: string;
    duration: number;
    shotCount: number;
    averageShotDuration: number;
    shortestShotDuration: number;
    longestShotDuration: number;
    cutFrequencyCurve: RhythmCurvePoint[];
    changePoints: RhythmChangePoint[];
    repeatedSegments: RepeatedRhythmSegment[];
    references: RhythmReferenceProfile[];
    suggestions: string[];
}
export interface RhythmAnalysisOptions {
    generatedAt?: string;
    bucketSeconds?: number;
}
export declare const RHYTHM_REFERENCE_PROFILES: RhythmReferenceProfile[];
export declare function analyzeClipRhythm(project: Project, options?: RhythmAnalysisOptions): RhythmAnalysisReport;
export declare function collectRhythmShots(timeline: Timeline): RhythmShot[];
export declare function calculateCutFrequencyCurve(shots: RhythmShot[], bucketSeconds?: number): RhythmCurvePoint[];
export declare function detectRhythmChangePoints(shots: RhythmShot[]): RhythmChangePoint[];
export declare function detectRepeatedRhythmSegments(shots: RhythmShot[], minClipCount?: number, tolerance?: number): RepeatedRhythmSegment[];
export declare function serializeRhythmAnalysisJson(report: RhythmAnalysisReport): string;
export declare function buildRhythmAnalysisHtml(report: RhythmAnalysisReport, localeInput?: string): string;
//# sourceMappingURL=rhythm-analysis.d.ts.map