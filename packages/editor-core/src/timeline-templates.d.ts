import { type AssetType, type Clip, type MediaAsset, type Project, type ProjectSettings, type Timeline, type Track, type TrackType } from './model';
export declare const TIMELINE_TEMPLATE_SCHEMA_VERSION = 1;
export type TimelineTemplateId = string;
export interface TimelineTemplatePlaceholder {
    id: string;
    name: string;
    assetType: AssetType;
    originalPath?: string;
    duration?: number;
    width?: number;
    height?: number;
}
export interface TimelineTemplateClip {
    id: string;
    sourceClipId: string;
    mediaPlaceholderId?: string;
    clip: Clip;
}
export interface TimelineTemplateTrack {
    id: string;
    sourceTrackId: string;
    type: TrackType;
    name: string;
    language?: string;
    subtitleType?: 'subtitle' | 'cc';
    color?: Track['color'];
    muted?: boolean;
    solo?: boolean;
    locked?: boolean;
    volume?: number;
    pan?: number;
    clips: TimelineTemplateClip[];
}
export interface TimelineTemplateDefinition {
    schemaVersion: typeof TIMELINE_TEMPLATE_SCHEMA_VERSION;
    id: TimelineTemplateId;
    name: string;
    description?: string;
    settings?: ProjectSettings;
    duration: number;
    placeholders: TimelineTemplatePlaceholder[];
    tracks: TimelineTemplateTrack[];
    createdAt?: string;
}
export interface SerializeTimelineTemplateOptions {
    id?: string;
    name: string;
    description?: string;
    clipIds?: string[];
    createdAt?: string;
}
export interface TimelineTemplatePlaceholderBinding {
    path: string;
    name?: string;
    assetType?: AssetType;
    duration?: number;
    width?: number;
    height?: number;
    size?: number;
}
export type TimelineTemplatePlaceholderBindings = Record<string, string | TimelineTemplatePlaceholderBinding>;
export interface InstantiatedTimelineTemplate {
    timeline: Timeline;
    media: MediaAsset[];
    placeholderAssetIds: Record<string, string>;
}
export declare const BUILT_IN_TIMELINE_TEMPLATES: readonly TimelineTemplateDefinition[];
export declare function serializeTimelineTemplate(project: Project, options: SerializeTimelineTemplateOptions): TimelineTemplateDefinition;
export declare function instantiateTimelineTemplate(template: TimelineTemplateDefinition, bindings?: TimelineTemplatePlaceholderBindings): InstantiatedTimelineTemplate;
export declare function instantiateTimelineTemplateProject(template: TimelineTemplateDefinition, bindings?: TimelineTemplatePlaceholderBindings, options?: {
    name?: string;
}): Project;
export declare function getMissingTimelineTemplatePlaceholders(template: TimelineTemplateDefinition, bindings?: TimelineTemplatePlaceholderBindings): TimelineTemplatePlaceholder[];
export declare function fillTimelineTemplatePlaceholders(template: TimelineTemplateDefinition, bindings: TimelineTemplatePlaceholderBindings): Record<string, TimelineTemplatePlaceholderBinding>;
export declare function renderTimelineTemplatePreviewSvg(template: TimelineTemplateDefinition, options?: {
    width?: number;
    trackHeight?: number;
}): string;
export declare function normalizeTimelineTemplateDefinition(value: unknown): TimelineTemplateDefinition | undefined;
//# sourceMappingURL=timeline-templates.d.ts.map