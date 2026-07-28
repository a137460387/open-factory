import { type ClipKeyframes, type TextClip, type TextStyle, type Timeline, type Track, type Transform } from './model';
export type TitleTemplateId = 'lower-third' | 'fullscreen-title' | 'caption-bar' | 'corner-bug' | 'counter';
export interface TitleTemplateDefinition {
    id: TitleTemplateId;
    defaultDuration: number;
    defaultText: string;
    transform: Transform;
    style: TextStyle;
    keyframes: ClipKeyframes;
}
export interface InstantiateTitleTemplateOptions {
    id?: string;
    name?: string;
    text?: string;
    start?: number;
    duration?: number;
    color?: string;
}
export declare const TITLE_TEMPLATE_IDS: TitleTemplateId[];
export declare const TITLE_TEMPLATES: TitleTemplateDefinition[];
export declare function getTitleTemplate(templateId: TitleTemplateId): TitleTemplateDefinition;
export declare function instantiateTitleTemplate(templateId: TitleTemplateId, track: Track, timeline: Timeline, options?: InstantiateTitleTemplateOptions): TextClip;
//# sourceMappingURL=title-templates.d.ts.map