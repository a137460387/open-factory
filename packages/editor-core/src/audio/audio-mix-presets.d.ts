import type { AudioEffectSlot } from './mixer-types';
/** 音频预设 */
export interface AudioMixPreset {
    id: string;
    name: string;
    author: string;
    description?: string;
    tags: string[];
    chain: AudioEffectSlot[];
    createdAt: string;
    updatedAt: string;
}
/** 预设文件格式 */
export interface AudioMixPresetFile {
    schemaVersion: 1;
    kind: 'open-factory.audio-mix-preset';
    preset: AudioMixPreset;
}
/** 创建音频预设 */
export declare function createAudioMixPreset(name: string, chain: AudioEffectSlot[], options?: Partial<Omit<AudioMixPreset, 'id' | 'name' | 'chain' | 'createdAt' | 'updatedAt'>>): AudioMixPreset;
/** 序列化预设 */
export declare function serializeAudioMixPreset(preset: AudioMixPreset): string;
/** 反序列化预设 */
export declare function deserializeAudioMixPreset(json: string): AudioMixPreset | null;
/** 内置音频预设 */
export declare const BUILTIN_AUDIO_PRESETS: AudioMixPreset[];
//# sourceMappingURL=audio-mix-presets.d.ts.map