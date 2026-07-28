import type { Project, Timeline } from './model-types';
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
export declare const COMPLEXITY_WEIGHTS: Record<ComplexityDimensionId, number>;
export declare const COMPLEXITY_EFFECT_TYPE_FACTORS: Record<EffectType, number>;
export declare const REFERENCE_COMPLEXITY_PROJECTS: ComplexityReferenceProject[];
export declare function calculateTimelineDensityScore(timeline: Timeline): ComplexityDimensionScore;
export declare function calculateEffectComplexityScore(timeline: Timeline): ComplexityDimensionScore;
export declare function calculateColorDepthScore(timeline: Timeline): ComplexityDimensionScore;
export declare function calculateAudioComplexityScore(timeline: Timeline): ComplexityDimensionScore;
export declare function calculateKeyframeDensityScore(timeline: Timeline): ComplexityDimensionScore;
export declare function calculateComplexityScore(project: Pick<Project, 'timeline'>): ComplexityScoreResult;
export declare function getComplexityLevel(score: number): ComplexityLevel;
export declare function createComplexityReport(project: Pick<Project, 'id' | 'name' | 'timeline'>, generatedAt?: string): ComplexityReport;
//# sourceMappingURL=complexity-score.d.ts.map