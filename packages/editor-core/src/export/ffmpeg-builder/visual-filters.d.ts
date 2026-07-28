import { normalizeChromaKey } from '../../model';
import { type ColorWheelValue, type ColorGradingGraph, type WindowMaskParams, type ThreeWayColor } from '../../color-grading';
import { type ClipBlendMode } from '../../blend-modes';
import type { Effect } from '../../effects';
import type { ExportClip, ExportTransition, ExportTimeline, ExportTrack, ExportSettings, FfmpegCapabilities, TextArtifact } from '../export-types';
export type AnimatedProperty = 'x' | 'y' | 'scaleX' | 'scaleY' | 'speed' | 'opacity';
export type VisualItem = {
    kind: 'text';
    trackIndex: number;
    start: number;
    duration: number;
    clip: ExportClip;
} | {
    kind: 'credits';
    trackIndex: number;
    start: number;
    duration: number;
    clip: ExportClip;
} | {
    kind: 'adjustment';
    trackIndex: number;
    start: number;
    duration: number;
    clip: ExportClip;
} | {
    kind: 'media';
    trackIndex: number;
    start: number;
    duration: number;
    label: string;
    xExpression: string;
    yExpression: string;
    blendMode: ClipBlendMode;
};
export declare function buildVisualItems(timeline: ExportTimeline, orderedPlaybackClips: ExportClip[], playbackStartByClipId: Map<string, number>, renderableTrackIndexes: Set<number>, inputByClipId: Map<string, number>, customShaderSequenceClips: Map<string, ExportClip>, settings: ExportSettings, filters: string[], warnings: string[], textArtifacts: TextArtifact[], capabilities: FfmpegCapabilities | undefined): VisualItem[];
export declare function buildPlaybackStartByClipId(timeline: ExportTimeline): Map<string, number>;
export declare function findExportTransitionPair(timeline: ExportTimeline, transition: ExportTransition): {
    track: ExportTrack;
    fromClip: ExportClip;
    toClip: ExportClip;
} | undefined;
export declare function buildTransitionClipFilter(inputIndex: number, clip: ExportClip, label: string, settings: ExportSettings, textArtifacts: TextArtifact[], warnings: string[], capabilities: FfmpegCapabilities | undefined): string;
export declare function isTransitionVisualClip(clip: ExportClip): boolean;
export declare function areExportClipsAdjacent(fromClip: ExportClip, toClip: ExportClip): boolean;
export declare function clampExportTransitionDuration(transition: ExportTransition, fromClip: ExportClip, toClip: ExportClip): number;
export declare function buildSmartTransitionFilters(transition: ExportTransition, label: string, duration: number, offset: number, settings: ExportSettings): string[];
export declare function mapTransitionType(type: ExportTransition['type']): string;
export declare function buildShapeWipeGeqExpression(type: Extract<ExportTransition['type'], 'shape-heart' | 'shape-star'>): string;
export interface TransitionPreviewArgsOptions {
    width?: number;
    height?: number;
    fps?: number;
    duration?: number;
}
export declare function buildTransitionPreviewArgs(type: ExportTransition['type'], options?: TransitionPreviewArgsOptions): string[];
export declare function visualKindOrder(item: VisualItem): number;
export declare function buildMediaCompositeFilter(currentVideo: string, nextVideo: string, item: Extract<VisualItem, {
    kind: 'media';
}>, settings: ExportSettings, duration: number): string;
export declare function buildAdjustmentLayerFilters(inputLabel: string, outputLabel: string, clip: ExportClip, textArtifacts: TextArtifact[], settings: ExportSettings): string[];
export declare function buildVisualClipFilter(inputIndex: number, clip: ExportClip, label: string, settings: ExportSettings, textArtifacts: TextArtifact[], warnings: string[], capabilities: FfmpegCapabilities | undefined): string;
export declare function buildColorNodeGraphVisualFilter(inputIndex: number, clip: ExportClip, label: string, settings: ExportSettings, textArtifacts: TextArtifact[], warnings: string[], capabilities: FfmpegCapabilities | undefined, trim: string): string | null;
export declare function buildColorGradingGraphVisualFilter(inputIndex: number, clip: ExportClip, label: string, settings: ExportSettings, textArtifacts: TextArtifact[], warnings: string[], capabilities: FfmpegCapabilities | undefined, trim: string): string | null;
export declare function buildVisualPreColorFilters(clip: ExportClip, settings: ExportSettings, warnings: string[], capabilities: FfmpegCapabilities | undefined): string[];
export declare function buildVisualPostColorFilters(clip: ExportClip, settings: ExportSettings, textArtifacts: TextArtifact[], label: string, includeColorCorrection?: boolean): string[];
export declare function buildVisualPostKeyFilters(clip: ExportClip, settings: ExportSettings, textArtifacts: TextArtifact[], warnings: string[], capabilities: FfmpegCapabilities | undefined, label: string): string[];
export declare function buildPanoramaProjectionFilters(clip: ExportClip): string[];
export declare function hasSphericalVideoClips(clips: ExportClip[]): boolean;
export declare function buildDifferenceMatteClipFilter(inputIndex: number, clip: ExportClip, label: string, settings: ExportSettings, textArtifacts: TextArtifact[], warnings: string[], capabilities: FfmpegCapabilities | undefined, trim: string, key: ReturnType<typeof normalizeChromaKey>): string;
export declare function buildPrivacyBlurClipFilter(inputIndex: number, clip: ExportClip, label: string, settings: ExportSettings, textArtifacts: TextArtifact[], warnings: string[], capabilities: FfmpegCapabilities | undefined, trim: string): string;
export declare function buildPrivacyBlurMaskGraph(inputLabel: string, outputLabel: string, mask: ExportClip['masks'][number], index: number): string[];
export declare function buildPrivacyBlurEffectFilter(mask: ExportClip['masks'][number]): string;
export declare function buildMaskTimelineExpression(mask: ExportClip['masks'][number], property: 'x' | 'y' | 'w' | 'h'): string;
export declare function hasPrivacyBlurMasks(clip: ExportClip): boolean;
export declare function getPrivacyBlurMasks(clip: ExportClip): ExportClip['masks'];
export declare function isKenBurnsAnimatedScaleClip(clip: ExportClip): boolean;
export declare function buildReframeFilters(settings: ExportSettings): string[];
export declare function buildChromaKeyFilters(clip: ExportClip): string[];
export declare function isDifferenceMatteEnabled(key: ReturnType<typeof normalizeChromaKey>): boolean;
export declare function formatChromaKeyColor(color: [number, number, number]): string;
export declare function buildStabilizationFilters(clip: ExportClip): string[];
export declare function buildSlowMotionFilters(clip: ExportClip, settings: ExportSettings, capabilities: FfmpegCapabilities | undefined, warnings: string[]): string[];
export declare function buildFrameInterpolationFilters(clip: ExportClip, capabilities: FfmpegCapabilities | undefined, warnings: string[]): string[];
export declare function buildFrameInterpolationFilterArg(fps: number, mode: 'blend' | 'mci', sceneProtected: boolean): string;
export declare function buildVideoRestorationFilters(clip: ExportClip): string[];
export declare function buildQualityEnhancementFilters(clip: ExportClip): string[];
export declare function getMinimumClipSpeed(clip: ExportClip): number;
export declare function buildMaskFilters(clip: ExportClip): string[];
export declare function buildClipBorderFilters(clip: ExportClip): string[];
export declare function isSimpleRectMask(mask: ExportClip['masks'][number]): boolean;
export declare function buildSimpleRectMaskFilter(mask: ExportClip['masks'][number]): string;
export declare function buildGeqMaskFilter(masks: ExportClip['masks']): string;
export declare function buildRectMaskExpression(mask: ExportClip['masks'][number]): string;
export declare function buildEllipseMaskExpression(mask: ExportClip['masks'][number]): string;
export declare function buildPathMaskExpression(mask: ExportClip['masks'][number]): string;
export declare function getPathVertex(vertices: number[], index: number): {
    x: number;
    y: number;
};
export declare function buildPathTriangleExpression(a: {
    x: number;
    y: number;
}, b: {
    x: number;
    y: number;
}, c: {
    x: number;
    y: number;
}): string;
export declare function buildPathEdgeExpression(from: {
    x: number;
    y: number;
}, to: {
    x: number;
    y: number;
}, comparator: 'gte' | 'lte'): string;
export declare function triangleArea(a: {
    x: number;
    y: number;
}, b: {
    x: number;
    y: number;
}, c: {
    x: number;
    y: number;
}): number;
export declare function buildSetptsFilter(clip: ExportClip, includeStartOffset: boolean, warnings?: string[]): string;
export declare function buildStaticSetptsFilter(clip: ExportClip, includeStartOffset: boolean, speed: number): string;
export declare function buildSpeedRampSetptsExpression(clip: ExportClip, includeStartOffset: boolean): string;
export declare function buildSpeedRampSegments(clip: ExportClip): Array<{
    displayStart: number;
    displayEnd: number;
    sourceStart: number;
    sourceEnd: number;
    speed: number;
}>;
export declare function getAverageClipSpeed(clip: ExportClip): number;
export declare function buildScaleFilter(clip: ExportClip): string;
export declare function buildKenBurnsZoompanFilter(clip: ExportClip, settings: ExportSettings): string;
export declare function buildOpacityFilters(clip: ExportClip, label: string): string[];
export declare function buildOverlayXExpression(clip: ExportClip): string;
export declare function buildOverlayYExpression(clip: ExportClip): string;
export declare function buildColorCorrectionFilters(clip: ExportClip, textArtifacts: TextArtifact[]): string[];
export declare function buildThreeWayColorFilter(value: ThreeWayColor | undefined): string;
export declare function colorBalanceValue(value: ColorWheelValue, channel: 'r' | 'g' | 'b'): number;
export declare function buildEffectFilters(effects: Effect[], fps?: number): string[];
/**
 * 构建调色节点图的 FFmpeg 滤镜链
 */
export declare function buildColorGradingFilters(graph: ColorGradingGraph | undefined): string[];
/**
 * 将窗口遮罩参数转换为 FFmpeg geq 滤镜
 */
export declare function buildWindowMaskFfmpegFilter(params: WindowMaskParams): string;
export declare function buildSourceColorSpaceConversionFilters(clip: ExportClip, settings: ExportSettings): string[];
export declare function getExportClipSourceDuration(clip: ExportClip): number;
//# sourceMappingURL=visual-filters.d.ts.map