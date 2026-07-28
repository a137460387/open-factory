import { type SubtitleStyle } from '../model';
export type BuiltinSubtitleStyleTemplateId = 'news-lower-third' | 'cinema-white' | 'karaoke' | 'variety-bold' | 'documentary' | 'social-bold' | 'game-hud' | 'handwritten';
export type SubtitleStyleTemplateKind = 'builtin' | 'custom';
export interface SubtitleStyleTemplate {
    id: string;
    kind: SubtitleStyleTemplateKind;
    name: string;
    style: SubtitleStyle;
}
export declare const SUBTITLE_STYLE_TEMPLATE_PREVIEW_TEXT = "\u793A\u4F8B\u5B57\u5E55";
export declare const BUILTIN_SUBTITLE_STYLE_TEMPLATES: SubtitleStyleTemplate[];
export declare function normalizeSubtitleStyleTemplateStyle(style: Partial<SubtitleStyle>): SubtitleStyle;
export declare function renderSubtitleStyleTemplatePreview(template: Pick<SubtitleStyleTemplate, 'style'>, text?: string): string;
export declare function getBuiltinSubtitleStyleTemplate(id: BuiltinSubtitleStyleTemplateId | string): SubtitleStyleTemplate | undefined;
//# sourceMappingURL=style-templates.d.ts.map