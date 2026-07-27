export declare const TARGET_ASPECT_RATIOS: readonly ["source", "16:9", "9:16", "1:1", "4:5", "21:9"];
export type TargetAspectRatio = (typeof TARGET_ASPECT_RATIOS)[number];
export interface ReframeSettings {
    targetAspectRatio?: TargetAspectRatio;
    reframeOffsetX?: number;
    reframeOffsetY?: number;
}
export interface ReframeCrop {
    targetAspectRatio: Exclude<TargetAspectRatio, 'source'>;
    ratio: number;
    offsetX: number;
    offsetY: number;
    cropWidthExpression: string;
    cropHeightExpression: string;
    cropXExpression: string;
    cropYExpression: string;
}
export declare function normalizeTargetAspectRatio(value: unknown): TargetAspectRatio;
export declare function isReframeEnabled(value: unknown): value is Exclude<TargetAspectRatio, 'source'>;
export declare function clampReframeOffset(value: unknown): number;
export declare function getTargetAspectRatioValue(value: Exclude<TargetAspectRatio, 'source'>): number;
export declare function resolveReframeDimensions(width: number, height: number, targetAspectRatio: TargetAspectRatio | undefined): {
    width: number;
    height: number;
};
export declare function calculateReframeCrop(settings: ReframeSettings): ReframeCrop | undefined;
export declare function buildReframeCropFilter(settings: ReframeSettings): string | undefined;
//# sourceMappingURL=reframe.d.ts.map