import type { AudioEffectSlot } from '../../audio/mixer-types';
import { type NoiseReductionParams } from '../../audio/noise-reduction';
import type { ExportClip, ExportKeyframe, ExportLoudnessNormalization, ExportMasterEq, ExportSettings, FfmpegCapabilities } from '../export-types';
import { type LoudnessNormalizationPreset } from './settings-normalize';
export type AnimatedProperty = keyof NonNullable<ExportClip['keyframes']>;
/** @internal */
export declare function getAnimatedFrames(clip: ExportClip, property: AnimatedProperty): ExportKeyframe[];
/** @internal */
export declare function getAverageClipSpeed(clip: ExportClip): number;
/** @internal */
export declare function getExportClipSourceDuration(clip: ExportClip): number;
/** @internal */
export declare function buildLocalExpression(frames: Array<{
    time: number;
    value: number;
    easing?: ExportKeyframe['easing'];
}>, fallback: number, variable?: string): string;
/** @internal */
export declare function buildSegmentExpression(left: {
    time: number;
    value: number;
    easing?: ExportKeyframe['easing'];
}, right: {
    time: number;
    value: number;
}, variable: string): string;
/** @internal */
export declare function buildEasingExpression(progress: string, easing: ExportKeyframe['easing']): string;
/** @internal */
export declare function buildBounceEasingExpression(progress: string): string;
/**
 * 构建音频效果链的 FFmpeg 滤镜
 */
export declare function buildAudioEffectChainFilters(effects: AudioEffectSlot[]): string[];
/**
 * 构建混音器通道的完整音频滤镜链
 */
export declare function buildMixerChannelAudioFilters(channelVolume: number, channelPan: number, effects: AudioEffectSlot[]): string[];
export declare function buildAudioFilters(clips: ExportClip[], inputByClipId: Map<string, number>, settings: ExportSettings, filters: string[], capabilities: FfmpegCapabilities | undefined, warnings: string[]): string[];
export declare function buildPitchAndReverseAudioFilters(clip: ExportClip, sampleRate: number): string[];
export declare function getLoudnessNormalizationPreset(mode: ExportLoudnessNormalization | undefined): LoudnessNormalizationPreset | undefined;
export declare function buildLoudnormAnalysisFilter(preset: LoudnessNormalizationPreset): string;
export declare function buildLoudnormRenderFilter(preset: LoudnessNormalizationPreset): string;
export declare function buildAudioDenoiseFilters(clip: ExportClip, capabilities: FfmpegCapabilities | undefined, warnings: string[]): string;
/**
 * 生成基于 afftdn 的降噪滤镜
 * 用于混音器面板的"一键降噪"功能
 * 使用参数数组风格，不拼接 shell 字符串
 * @internal
 */
export declare function buildAfftdnNoiseReductionFilter(params: NoiseReductionParams): string;
/**
 * 从混音器通道效果链中提取降噪滤镜
 * 将 noise-reduction 效果类型转换为 afftdn FFmpeg 滤镜
 * @internal
 */
export declare function buildMixerChannelNoiseReductionFilter(effects: AudioEffectSlot[]): string;
export declare function buildAudioRestorationFilters(clip: ExportClip): string;
export declare function buildPanFilter(clip: ExportClip): string;
export declare function buildAutomationFilters(clip: ExportClip): string;
export declare function buildSpatialAudioFilter(clip: ExportClip, settings: ExportSettings): string;
export declare function escapeSofalizerArg(arg: string): string;
export declare function escapeFilterFileValue(value: string): string;
export declare function buildSpatialPanGainExpression(frames: Array<{
    time: number;
    value: number;
    easing?: ExportKeyframe['easing'];
}>, fallbackX: number, channel: 'left' | 'right'): string;
export declare function buildSpatialVolumeExpression(frames: Array<{
    time: number;
    value: number;
    easing?: ExportKeyframe['easing'];
}>, spatial: ExportClip['spatialAudio']): string;
export declare function buildAudioChannelRoutingFilter(clip: ExportClip): string;
export declare function buildTrackAudioFilters(clip: ExportClip): string;
export declare function buildMasterAudioFilters(masterProcessing: ExportSettings['masterProcessing'] | undefined): string[];
export declare function buildEqualizerFilters(eq: Pick<ExportMasterEq, 'bands'>): string[];
export declare function buildAudioFadeFilters(clip: ExportClip): string;
export declare function formatAudioFadeCurve(curve: ExportClip['fadeInCurve']): string;
export declare function buildVolumeFilter(clip: ExportClip): string;
export declare function buildAtempoFilters(speed: number): string[];
/** @internal */
export declare function safeLabel(value: string): string;
//# sourceMappingURL=audio-filters.d.ts.map