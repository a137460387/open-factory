import type { Keyframe, KeyframeEasing } from './model-types-primitives';
export declare const MOTION_GRAPHIC_FILE_FORMAT = "open-factory-motion-graphic";
export declare const MOTION_GRAPHIC_SEQUENCE_KIND = "motion-graphic-sequence";
export declare const MOTION_GRAPHIC_TEMPLATE_TYPES: readonly ["scoreboard", "progress-bar", "data-chart", "countdown", "social-lower-third", "map-route"];
export type MotionGraphicTemplateType = (typeof MOTION_GRAPHIC_TEMPLATE_TYPES)[number];
export declare const MOTION_GRAPHIC_CHART_KINDS: readonly ["bar", "line", "pie"];
export type MotionGraphicChartKind = (typeof MOTION_GRAPHIC_CHART_KINDS)[number];
export type MotionGraphicParamType = 'string' | 'number' | 'boolean' | 'color' | 'select' | 'number-list';
export type MotionGraphicParamValue = string | number | boolean | number[];
export type MotionGraphicParams = Record<string, MotionGraphicParamValue>;
export type MotionGraphicParamKeyframes = Record<string, Keyframe<number>[]>;
export interface MotionGraphicParamDefinition {
    key: string;
    type: MotionGraphicParamType;
    defaultValue: MotionGraphicParamValue;
    min?: number;
    max?: number;
    step?: number;
    maxItems?: number;
    keyframeable?: boolean;
    options?: readonly string[];
}
export interface MotionGraphicTemplateDefinition {
    type: MotionGraphicTemplateType;
    params: MotionGraphicParamDefinition[];
}
export interface MotionGraphic {
    version: 1;
    templateType: MotionGraphicTemplateType;
    params: MotionGraphicParams;
    paramKeyframes?: MotionGraphicParamKeyframes;
}
export interface MotionGraphicTemplateFile {
    format: typeof MOTION_GRAPHIC_FILE_FORMAT;
    version: 1;
    templateType: MotionGraphicTemplateType;
    params: MotionGraphicParams;
    paramKeyframes?: MotionGraphicParamKeyframes;
    duration?: number;
    width?: number;
    height?: number;
}
export declare const MOTION_GRAPHIC_TEMPLATE_DEFINITIONS: Record<MotionGraphicTemplateType, MotionGraphicTemplateDefinition>;
export declare function isMotionGraphicTemplateType(value: unknown): value is MotionGraphicTemplateType;
export declare function getMotionGraphicTemplateDefinition(type: unknown): MotionGraphicTemplateDefinition;
export declare function createDefaultMotionGraphic(templateType?: MotionGraphicTemplateType): MotionGraphic;
export declare function normalizeMotionGraphic(input: Partial<MotionGraphic> | undefined, duration?: number): MotionGraphic;
export declare function getMotionGraphicNumericParamKeys(graphic: Partial<MotionGraphic> | undefined): string[];
export declare function setMotionGraphicParam(graphic: Partial<MotionGraphic> | undefined, key: string, value: MotionGraphicParamValue, duration?: number): MotionGraphic;
export declare function setMotionGraphicParamKeyframe(graphic: Partial<MotionGraphic> | undefined, key: string, input: {
    id?: string;
    time: number;
    value: number;
    easing?: KeyframeEasing;
}, duration: number): MotionGraphic;
export declare function getMotionGraphicParamValueAtTime(graphic: Partial<MotionGraphic> | undefined, key: string, time: number, duration?: number): MotionGraphicParamValue | undefined;
export declare function buildMotionGraphicTemplateFile(graphic: Partial<MotionGraphic> | undefined, options?: {
    duration?: number;
    width?: number;
    height?: number;
}): MotionGraphicTemplateFile;
export declare function serializeMotionGraphicTemplate(graphic: Partial<MotionGraphic> | undefined, options?: {
    duration?: number;
    width?: number;
    height?: number;
}): string;
export declare function parseMotionGraphicTemplate(contents: string): MotionGraphicTemplateFile;
//# sourceMappingURL=motion-graphics.d.ts.map