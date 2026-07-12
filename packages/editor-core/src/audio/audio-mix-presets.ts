// packages/editor-core/src/audio/audio-mix-presets.ts
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
export function createAudioMixPreset(
  name: string,
  chain: AudioEffectSlot[],
  options?: Partial<Omit<AudioMixPreset, 'id' | 'name' | 'chain' | 'createdAt' | 'updatedAt'>>
): AudioMixPreset {
  const now = new Date().toISOString();
  return {
    id: `audio-preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    author: options?.author || 'User',
    description: options?.description,
    tags: options?.tags || [],
    chain,
    createdAt: now,
    updatedAt: now,
  };
}

/** 序列化预设 */
export function serializeAudioMixPreset(preset: AudioMixPreset): string {
  const file: AudioMixPresetFile = {
    schemaVersion: 1,
    kind: 'open-factory.audio-mix-preset',
    preset,
  };
  return JSON.stringify(file, null, 2);
}

/** 反序列化预设 */
export function deserializeAudioMixPreset(json: string): AudioMixPreset | null {
  try {
    const file = JSON.parse(json);
    if (file.schemaVersion !== 1 || file.kind !== 'open-factory.audio-mix-preset') {
      return null;
    }
    return file.preset as AudioMixPreset;
  } catch {
    return null;
  }
}

/** 内置音频预设 */
export const BUILTIN_AUDIO_PRESETS: AudioMixPreset[] = [
  {
    id: 'builtin-podcast',
    name: '播客优化',
    author: 'open-factory',
    description: '对白优化，降噪+压缩+EQ',
    tags: ['podcast', 'dialogue', 'voice'],
    chain: [
      { id: 'hp', effectType: 'high-pass', enabled: true, params: { frequency: 80 }, wetDry: 1, order: 0 },
      { id: 'comp', effectType: 'compressor', enabled: true, params: { threshold: -20, ratio: 4, attack: 10, release: 100, makeup: 6 }, wetDry: 1, order: 1 },
      { id: 'eq', effectType: 'eq-4band', enabled: true, params: { lowFreq: 80, lowGain: -3, lowMidFreq: 250, lowMidGain: -2, highMidFreq: 3000, highMidGain: 3, highFreq: 8000, highGain: 1 }, wetDry: 1, order: 2 },
      { id: 'lim', effectType: 'limiter', enabled: true, params: { threshold: -1, release: 50 }, wetDry: 1, order: 3 },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-music',
    name: '音乐增强',
    author: 'open-factory',
    description: '音乐混音优化，立体声增强',
    tags: ['music', 'stereo', 'enhance'],
    chain: [
      { id: 'eq', effectType: 'eq-4band', enabled: true, params: { lowFreq: 60, lowGain: 2, lowMidFreq: 400, lowMidGain: 0, highMidFreq: 4000, highMidGain: 2, highFreq: 12000, highGain: 1 }, wetDry: 1, order: 0 },
      { id: 'comp', effectType: 'compressor', enabled: true, params: { threshold: -15, ratio: 3, attack: 20, release: 200, makeup: 3 }, wetDry: 1, order: 1 },
      { id: 'stereo', effectType: 'stereo-widener', enabled: true, params: { width: 120 }, wetDry: 1, order: 2 },
      { id: 'lim', effectType: 'limiter', enabled: true, params: { threshold: -0.5, release: 50 }, wetDry: 1, order: 3 },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];
