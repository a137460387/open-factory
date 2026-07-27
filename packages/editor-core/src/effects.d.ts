import { type MotionBlurParams } from './motion-blur';
import type { EffectParamValue, EffectParams } from './effect-types';
export type { EffectParamValue, EffectParams };
export type EffectType = 'blur' | 'sharpen' | 'vignette' | 'film-grain' | 'chromatic-aberration' | 'audio-spectrum' | 'custom-shader' | 'motion-blur';
export type AudioSpectrumStyle = 'bars' | 'waveform' | 'circular';
export type AudioSpectrumPosition = 'top' | 'bottom';
export type CustomShaderExampleId = 'pixelate' | 'posterize' | 'old-film';
export type { MotionBlurParams };
export interface AudioSpectrumParams extends EffectParams {
    style: AudioSpectrumStyle;
    color: string;
    colorStart: string;
    colorEnd: string;
    themeId: string;
    height: number;
    position: AudioSpectrumPosition;
    sensitivity: number;
    mirror: boolean;
}
export interface CustomShaderParams extends EffectParams {
    source: string;
    preset: string;
}
export interface CustomShaderExample {
    id: CustomShaderExampleId;
    name: string;
    source: string;
}
export interface Effect {
    id: string;
    type: EffectType;
    enabled: boolean;
    params: EffectParams;
}
export declare const CUSTOM_SHADER_UNIFORM_NAMES: readonly ["u_texture", "u_resolution", "u_time", "u_progress"];
export declare const CUSTOM_SHADER_VARYING_NAME = "v_texCoord";
export declare const CUSTOM_SHADER_EXAMPLES: readonly CustomShaderExample[];
export declare const DEFAULT_CUSTOM_SHADER_SOURCE: string;
export declare const DEFAULT_CUSTOM_SHADER_PRESET: CustomShaderExampleId;
export declare const EFFECT_TYPES: EffectType[];
export declare const AUDIO_SPECTRUM_STYLES: AudioSpectrumStyle[];
export declare const AUDIO_SPECTRUM_POSITIONS: AudioSpectrumPosition[];
export declare const DEFAULT_EFFECT_PARAMS: Record<EffectType, EffectParams>;
export declare function isEffectType(type: string | undefined): type is EffectType;
export declare function normalizeEffect(effect: Partial<Effect> | undefined): Effect | undefined;
export declare function normalizeEffects(effects: Partial<Effect>[] | undefined): Effect[] | undefined;
export declare function cloneEffects(effects: Partial<Effect>[] | undefined): Effect[] | undefined;
export declare function normalizeEffectParams(type: EffectType, params: EffectParams | undefined): EffectParams;
export declare function normalizeAudioSpectrumParams(params: EffectParams | undefined): AudioSpectrumParams;
export declare function getEffectNumberParam(params: EffectParams | undefined, key: string, fallback: number): number;
export declare function getEffectStringParam(params: EffectParams | undefined, key: string, fallback: string): string;
export declare function normalizeCustomShaderParams(params: EffectParams | undefined): CustomShaderParams;
export declare function getCustomShaderSource(effect: Pick<Effect, 'type' | 'params'>): string | undefined;
export declare function getEnabledCustomShaderEffect(effects: Effect[] | undefined): Effect | undefined;
export declare function buildCustomShaderFragmentSource(source: string): string;
export declare function getCustomShaderExample(id: string | undefined): CustomShaderExample;
//# sourceMappingURL=effects.d.ts.map