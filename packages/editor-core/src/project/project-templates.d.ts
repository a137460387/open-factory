import { type Project, type ProjectSettings, type TrackType } from '../model';
import type { ExportSettings } from '../export/export-types';
export interface MediaFeatureInput {
    width: number;
    height: number;
    durationSeconds: number;
    hasAudio: boolean;
}
export type MediaAspectClass = 'vertical' | 'horizontal' | 'square' | 'unknown';
export interface MediaFeatureSummary {
    count: number;
    hasAudio: boolean;
    avgWidth: number;
    avgHeight: number;
    avgDuration: number;
    totalDuration: number;
    aspectClass: MediaAspectClass;
}
export interface TemplateRecommendation {
    templateId: ProjectTemplateId;
    score: number;
    suggestedVideoTracks: number;
    suggestedAudioTracks: number;
    reasonKey: string;
    reasonParams: Record<string, string | number>;
}
export type ProjectTemplateId = 'vertical-short' | 'youtube-horizontal' | 'square-social' | 'podcast' | 'cinema';
export type ProjectTemplateExportSettings = Partial<Omit<ExportSettings, 'outputPath'>>;
export interface ProjectTemplateTrackDefinition {
    id: string;
    type: TrackType;
    name: string;
}
export interface ProjectTemplateDefinition {
    id: ProjectTemplateId;
    defaultName: string;
    settings: ProjectSettings;
    tracks: ProjectTemplateTrackDefinition[];
    exportSettings: ProjectTemplateExportSettings;
}
export interface InstantiatedProjectTemplate {
    template: ProjectTemplateDefinition;
    project: Project;
    exportSettings: ProjectTemplateExportSettings;
}
export declare const PROJECT_TEMPLATES: readonly ProjectTemplateDefinition[];
export declare function classifyMediaAspect(width: number, height: number): MediaAspectClass;
export declare function detectMediaFeatures(media: MediaFeatureInput[]): MediaFeatureSummary;
export declare function suggestTrackCount(mediaCount: number, template: ProjectTemplateDefinition): {
    videoTracks: number;
    audioTracks: number;
};
export declare function recommendTemplate(media: MediaFeatureInput[]): TemplateRecommendation;
export declare function buildRecommendationReason(recommendation: TemplateRecommendation, translations: Record<string, string | ((params: Record<string, string | number>) => string)>): string;
export declare function getProjectTemplate(id: ProjectTemplateId): ProjectTemplateDefinition;
export declare function instantiateProjectTemplate(id: ProjectTemplateId, options?: {
    name?: string;
}): InstantiatedProjectTemplate;
//# sourceMappingURL=project-templates.d.ts.map