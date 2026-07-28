import { type ClipBlendMode } from './blend-modes';
import { type Effect } from './effects';
import { type Clip, type ClipKeyframes, type ColorCorrection } from './model';
export declare const EFFECT_PRESET_SCHEMA_VERSION = 1;
export declare const EFFECT_PRESET_FILE_KIND = "open-factory.effect-preset";
export type EffectPresetStyleTag = 'cinematic' | 'fresh' | 'retro' | 'bw' | 'cyber';
export type EffectPresetUseTag = 'portrait' | 'landscape' | 'food' | 'sport';
export type EffectPresetTag = EffectPresetStyleTag | EffectPresetUseTag | string;
export declare const EFFECT_PRESET_STYLE_TAGS: readonly EffectPresetStyleTag[];
export declare const EFFECT_PRESET_USE_TAGS: readonly EffectPresetUseTag[];
export interface EffectPresetStack {
    colorCorrection: ColorCorrection;
    effects?: Effect[];
    blendMode: ClipBlendMode;
    keyframes?: ClipKeyframes;
}
export interface EffectPreset {
    id: string;
    name: string;
    author: string;
    description?: string;
    tags: EffectPresetTag[];
    thumbnail?: string;
    createdAt: string;
    updatedAt: string;
    stack: EffectPresetStack;
}
export interface EffectPresetFile {
    schemaVersion: typeof EFFECT_PRESET_SCHEMA_VERSION;
    kind: typeof EFFECT_PRESET_FILE_KIND;
    preset: EffectPreset;
}
export interface EffectPresetCreateInput {
    id?: string;
    name: string;
    author?: string;
    description?: string;
    tags?: EffectPresetTag[];
    thumbnail?: string;
    now?: string;
}
export interface EffectPresetFilters {
    style?: 'all' | EffectPresetStyleTag | string;
    use?: 'all' | EffectPresetUseTag | string;
}
export interface EffectPresetPreviewArgsOptions {
    inputPath?: string;
    outputPath: string;
    width?: number;
    height?: number;
}
export declare function createEffectPresetFromClip(clip: Clip, input: EffectPresetCreateInput): EffectPreset;
export declare function extractEffectPresetStack(clip: Clip): EffectPresetStack;
export declare function buildEffectPresetClipPatch(preset: EffectPreset | EffectPresetFile, clipDuration: number): {
    colorCorrection: ColorCorrection;
    effects?: Effect[];
    blendMode: ClipBlendMode;
    keyframes?: ClipKeyframes;
};
export declare function serializeEffectPresetFile(preset: EffectPreset): string;
export declare function parseEffectPresetJson(contents: string): EffectPreset;
export declare function normalizeEffectPreset(input: unknown): EffectPreset;
export declare function filterEffectPresets<T extends Pick<EffectPreset, 'tags'>>(presets: T[], filters?: EffectPresetFilters): T[];
export declare function buildEffectPresetPreviewArgs(preset: EffectPreset | EffectPresetFile, options: EffectPresetPreviewArgsOptions): string[];
//# sourceMappingURL=effect-presets.d.ts.map