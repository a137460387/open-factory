/**
 * Social Media Export Presets
 *
 * Platform-specific encoding presets for B站, YouTube, 抖音/TikTok, 小红书.
 * Pure functions — no side effects, no external dependencies.
 */
export type SocialPlatform = 'bilibili' | 'youtube' | 'douyin' | 'tiktok' | 'xiaohongshu';
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '21:9' | '3:4';
export interface SocialMediaPreset {
    id: string;
    platform: SocialPlatform;
    label: string;
    aspectRatio: AspectRatio;
    width: number;
    height: number;
    videoBitrateKbps: number;
    audioBitrateKbps: number;
    fps: number;
    codec: 'h264' | 'h265';
    maxDurationSeconds?: number;
    description: string;
}
export interface UserCustomPreset {
    id: string;
    name: string;
    basePresetId: string;
    overrides: Partial<Omit<SocialMediaPreset, 'id' | 'platform' | 'label'>>;
    createdAt: string;
}
export interface CoverFrameExtractionOptions {
    /** Time in seconds to extract cover frame. Default: auto-select best */
    timeSeconds?: number;
    /** Width of cover image */
    width?: number;
    /** Height of cover image */
    height?: number;
}
export interface SocialExportConfig {
    preset: SocialMediaPreset;
    customPreset?: UserCustomPreset;
    coverFrame?: CoverFrameExtractionOptions;
    outputPath: string;
}
export declare const SOCIAL_MEDIA_PRESETS: SocialMediaPreset[];
export declare const PLATFORM_CONFIG: Record<SocialPlatform, {
    name: string;
    icon: string;
    maxUploadSizeMb: number;
}>;
export declare const ASPECT_RATIO_LABELS: Record<AspectRatio, string>;
export declare function getPresetsByPlatform(platform: SocialPlatform): SocialMediaPreset[];
export declare function getPresetById(id: string): SocialMediaPreset | undefined;
export declare function getAllPlatforms(): SocialPlatform[];
export declare function buildFfmpegArgsForPreset(preset: SocialMediaPreset, inputPath: string, outputPath: string): string[];
export declare function createCustomPreset(basePresetId: string, name: string, overrides: Partial<Omit<SocialMediaPreset, 'id' | 'platform' | 'label'>>): UserCustomPreset | undefined;
export declare function resolvePresetWithCustom(preset: SocialMediaPreset, custom?: UserCustomPreset): SocialMediaPreset;
export declare function estimateOutputFileSizeMb(preset: SocialMediaPreset, durationSeconds: number): number;
export declare function validateDurationForPlatform(preset: SocialMediaPreset, durationSeconds: number): {
    valid: boolean;
    maxDuration?: number;
    message?: string;
};
//# sourceMappingURL=social-media-presets.d.ts.map