import type { RichTextDocument, TextArcOptions, TextLayoutOptions, TextOpenTypeFeatures, TextStyle } from './model-types';
export declare const DEFAULT_TEXT_LAYOUT: TextLayoutOptions;
export declare const DEFAULT_TEXT_OPEN_TYPE_FEATURES: TextOpenTypeFeatures;
export declare const DEFAULT_TEXT_ARC: TextArcOptions;
export interface RichTextDrawSegment {
    text: string;
    paragraphIndex: number;
    runIndex: number;
    xOffset: number;
    yOffset: number;
    style: {
        fontSize: number;
        color: string;
        bold: boolean;
        italic: boolean;
        underline: boolean;
    };
}
export interface TextAutoLayoutResult {
    fitMode: TextLayoutOptions['fitMode'];
    width: number;
    height: number;
    scale: number;
    paragraphCount: number;
}
export interface ArcTextCharacterLayout {
    char: string;
    index: number;
    angle: number;
    rotation: number;
    x: number;
    y: number;
}
export declare function normalizeRichTextDocument(value: Partial<RichTextDocument> | undefined, fallbackText?: string): RichTextDocument;
export declare function serializeRichTextDocument(value: Partial<RichTextDocument> | undefined, fallbackText?: string): string;
export declare function richTextToPlainText(value: Partial<RichTextDocument> | undefined, fallbackText?: string): string;
export declare function plainTextToRichTextDocument(text: string): RichTextDocument;
export declare function normalizeTextLayout(value: Partial<TextLayoutOptions> | undefined): TextLayoutOptions;
export declare function normalizeTextOpenTypeFeatures(value: Partial<TextOpenTypeFeatures> | undefined): TextOpenTypeFeatures;
export declare function normalizeTextArc(value: Partial<TextArcOptions> | undefined): TextArcOptions;
export declare function buildRichTextDrawSegments(input: {
    richText?: Partial<RichTextDocument>;
    plainText: string;
    baseStyle: TextStyle;
    layout?: Partial<TextLayoutOptions>;
}): RichTextDrawSegment[];
export declare function calculateTextAutoLayout(input: {
    richText?: Partial<RichTextDocument>;
    plainText: string;
    baseStyle: TextStyle;
    layout?: Partial<TextLayoutOptions>;
}): TextAutoLayoutResult;
export declare function buildArcTextLayout(input: {
    text: string;
    arc: Partial<TextArcOptions>;
    fontSize: number;
    letterSpacing?: number;
    centerX?: number;
    centerY?: number;
}): ArcTextCharacterLayout[];
export declare function formatOpenTypeFeatureList(features: Partial<TextOpenTypeFeatures> | undefined): string;
//# sourceMappingURL=text-layout.d.ts.map