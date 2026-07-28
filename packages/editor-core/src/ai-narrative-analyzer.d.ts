/**
 * AI narrative structure analyzer.
 *
 * Analyzes a sequence of content segments and emotion curves to identify
 * three-act story structure, generate narrative arcs, score completeness,
 * and produce improvement suggestions.
 */
import type { ContentAnalysisSegment, ContentEmotionPoint } from './content-analysis';
/** One narrative act within a three-act (or four-part) structure */
export interface NarrativeAct {
    label: 'setup' | 'development' | 'climax' | 'resolution';
    start: number;
    end: number;
    segmentIndices: number[];
}
/** Identified story structure built from segment / emotion data */
export interface NarrativeStructure {
    acts: NarrativeAct[];
    peakIndex: number;
    troughIndex: number;
    hasClimax: boolean;
}
/** A single point on the visual narrative arc */
export interface ArcPoint {
    time: number;
    tension: number;
    act: NarrativeAct['label'];
}
/** Full narrative arc suitable for charting */
export interface NarrativeArc {
    points: ArcPoint[];
    peakTime: number;
    troughTime: number;
}
/** One actionable suggestion for improving narrative quality */
export interface NarrativeSuggestion {
    category: 'pacing' | 'structure' | 'emotion' | 'engagement';
    severity: 'info' | 'warning' | 'critical';
    message: string;
}
/** Complete result of narrative analysis */
export interface NarrativeAnalysisResult {
    structure: NarrativeStructure;
    arc: NarrativeArc;
    score: number;
    suggestions: NarrativeSuggestion[];
}
/**
 * Analyse the narrative structure of a clip given its content segments
 * and emotion curve.
 *
 * Pure function -- no side effects.
 *
 * @param segments  - Ordered content analysis segments from `content-analysis.ts`
 * @param emotionCurve - Sampled emotion points from `content-analysis.ts`
 * @returns Full narrative analysis result
 */
export declare function analyzeNarrative(segments: ContentAnalysisSegment[], emotionCurve: ContentEmotionPoint[]): NarrativeAnalysisResult;
//# sourceMappingURL=ai-narrative-analyzer.d.ts.map