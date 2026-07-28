import type { ExportClip, ExportKeyframe, ExportProject, ExportSettings, FfmpegCapabilities, HardwareEncoderSettings } from '../export-types';
export declare function buildBitrateArgs(flag: '-b:v' | '-b:a', bitrate: string | null | undefined): string[];
export declare function buildVideoEncodingArgs(settings: ExportSettings, capabilities: FfmpegCapabilities | undefined, warnings: string[], skipVideoCodec: boolean): string[];
export declare function buildVideoProfileArgs(settings: ExportSettings): string[];
export declare function buildContainerArgs(settings: ExportSettings): string[];
export declare function buildExportColorMetadataArgs(settings: ExportSettings): string[];
export declare function buildExportContainerMetadataArgs(metadata: ExportProject['metadata']): string[];
export declare function buildExportColorManagementFilters(settings: ExportSettings): string[];
export declare function shouldGenerateIccProfile(settings: ExportSettings): boolean;
export declare function buildSourceColorSpaceConversionFilters(clip: ExportClip, settings: ExportSettings): string[];
export type AnimatedProperty = keyof NonNullable<ExportClip['keyframes']>;
export declare function getAnimatedFrames(clip: ExportClip, property: AnimatedProperty): ExportKeyframe[];
export declare function buildLocalExpression(frames: Array<{
    time: number;
    value: number;
    easing?: ExportKeyframe['easing'];
}>, fallback: number, variable?: string): string;
export declare function buildTimelineExpression(frames: Array<{
    time: number;
    value: number;
    easing?: ExportKeyframe['easing'];
}>, clipStart: number, fallback: number, variable?: string): string;
export declare function buildSegmentExpression(left: {
    time: number;
    value: number;
    easing?: ExportKeyframe['easing'];
}, right: {
    time: number;
    value: number;
}, variable: string): string;
export declare function buildEasingExpression(progress: string, easing: ExportKeyframe['easing']): string;
export declare function buildBounceEasingExpression(progress: string): string;
export declare function formatAtempo(value: number): string;
export declare function formatPitchRatio(semitones: number): string;
export declare function formatFfmpegNumber(value: number): string;
export declare function safeLabel(value: string): string;
export declare function nestedInputPlaceholder(sequenceId: string): string;
export declare function formatScale(value: number): string;
export declare function formatOpacity(value: number): string;
export declare function formatVolume(value: number): string;
export declare function formatPan(value: number): string;
export declare function formatCompressorLinear(db: number): string;
export declare function formatSigned(value: number): string;
export declare function formatOffsetExpression(value: number): string;
export declare function cssColorToAssColor(value: string, opacity?: number): string;
export declare function buildHardwareEncoderArgs(settings: HardwareEncoderSettings, fps: number, capabilities: FfmpegCapabilities, warnings: string[]): string[];
//# sourceMappingURL=utils.d.ts.map