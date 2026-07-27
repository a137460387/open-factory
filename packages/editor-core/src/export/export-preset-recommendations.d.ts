import type { Project } from '../model-types';
import type { MediaColorProfile } from '../color-management';
export type ExportRecommendationReasonCode = 'resolution' | 'duration' | 'subtitles' | 'hdr';
export interface ExportPresetRecommendation {
    presetId: string;
    score: number;
    reasons: ExportRecommendationReason[];
}
export interface ExportRecommendationReason {
    code: ExportRecommendationReasonCode;
    label: string;
}
export interface ExportRecommendationContext {
    width: number;
    height: number;
    duration: number;
    hasSubtitles: boolean;
    hasHdrMedia: boolean;
}
export declare function buildExportRecommendationContext(project: Project): ExportRecommendationContext;
export declare function buildExportPresetRecommendations(context: ExportRecommendationContext, labelFn?: (code: ExportRecommendationReasonCode, context: ExportRecommendationContext) => string): ExportPresetRecommendation[];
export declare function checkProjectHasHdrMedia(project: Project): boolean;
export declare function hasSubtitleTracks(project: Project): boolean;
export declare function isHdrMediaProfile(profile: MediaColorProfile | undefined): boolean;
//# sourceMappingURL=export-preset-recommendations.d.ts.map