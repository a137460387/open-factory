import type { AudioEffectSlot, AudioEffectType } from './mixer-types';

/** 效果链执行计划 */
export interface EffectChainPlan {
  effects: AudioEffectSlot[];
  totalLatency: number;  // 预估延迟（ms）
}

/** FFmpeg 滤镜描述 */
export interface FfmpegAudioFilter {
  filterName: string;
  params: Record<string, string | number>;
}

/** Web Audio 节点描述 */
export interface AudioNodeDescription {
  type: AudioEffectType;
  params: Record<string, number>;
  wetDry: number;
}

/** 参数范围定义 */
const PARAM_RANGES: Partial<Record<AudioEffectType, Record<string, [number, number]>>> = {
  'compressor': { threshold: [-60, 0], ratio: [1, 20], attack: [0.1, 100], release: [1, 1000], makeup: [0, 24] },
  'limiter':    { threshold: [-12, 0], release: [1, 1000] },
  'gate':       { threshold: [-80, 0], attack: [0.01, 100], release: [1, 1000], range: [-80, 0] },
  'reverb':     { roomSize: [0, 100], damping: [0, 100], wetLevel: [0, 100], dryLevel: [0, 100] },
  'delay':      { time: [1, 2000], feedback: [0, 95], mix: [0, 100] },
  'eq-4band':   { lowGain: [-24, 24], lowMidGain: [-24, 24], highMidGain: [-24, 24], highGain: [-24, 24] },
};

export class EffectChainEngine {
  /**
   * 排序效果链：过滤掉已禁用的效果，按 order 升序排列
   */
  static sortChain(effects: AudioEffectSlot[]): AudioEffectSlot[] {
    return [...effects]
      .filter(e => e.enabled)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * 验证效果参数：将每个参数值钳制到定义的有效范围内
   */
  static validateParams(effectType: AudioEffectType, params: Record<string, number>): Record<string, number> {
    const validated = { ...params };
    const ranges = PARAM_RANGES[effectType];
    if (!ranges) return validated;

    for (const [key, [min, max]] of Object.entries(ranges)) {
      if (key in validated) {
        validated[key] = Math.max(min, Math.min(max, validated[key]));
      }
    }
    return validated;
  }

  /**
   * 生成 FFmpeg 滤镜链
   */
  static toFfmpegFilters(effects: AudioEffectSlot[]): FfmpegAudioFilter[] {
    return this.sortChain(effects).map(effect => {
      const params = this.validateParams(effect.effectType, effect.params);
      return this.effectToFfmpeg(effect.effectType, params, effect.wetDry);
    });
  }

  /**
   * 描述 Web Audio 节点图
   */
  static describeNodeGraph(effects: AudioEffectSlot[]): AudioNodeDescription[] {
    return this.sortChain(effects).map(effect => ({
      type: effect.effectType,
      params: this.validateParams(effect.effectType, effect.params),
      wetDry: effect.wetDry,
    }));
  }

  private static effectToFfmpeg(
    type: AudioEffectType,
    params: Record<string, number>,
    wetDry: number,
  ): FfmpegAudioFilter {
    switch (type) {
      case 'eq-4band':
        return {
          filterName: 'equalizer',
          params: {
            frequency: params.lowFreq || 80,
            gain: params.lowGain || 0,
            width_type: 'o',
            width: 0.5,
          },
        };
      case 'compressor':
        return {
          filterName: 'acompressor',
          params: {
            threshold: params.threshold || -20,
            ratio: params.ratio || 4,
            attack: params.attack || 10,
            release: params.release || 100,
            makeup: params.makeup || 0,
          },
        };
      case 'limiter':
        return {
          filterName: 'alimiter',
          params: {
            limit: params.threshold || -1,
            release: params.release || 100,
          },
        };
      case 'gate':
        return {
          filterName: 'agate',
          params: {
            threshold: params.threshold || -40,
            attack: params.attack || 1,
            release: params.release || 100,
            range: params.range || -60,
          },
        };
      case 'reverb':
        return {
          filterName: 'aecho',
          params: {
            in_gain: 0.8,
            out_gain: 0.9,
            delays: Math.round((params.roomSize || 50) * 2),
            decays: (params.damping || 50) / 100,
          },
        };
      case 'delay':
        return {
          filterName: 'aecho',
          params: {
            in_gain: 1,
            out_gain: wetDry,
            delays: Math.round(params.time || 250),
            decays: (params.feedback || 30) / 100,
          },
        };
      case 'high-pass':
        return {
          filterName: 'highpass',
          params: { f: params.frequency || 80 },
        };
      case 'low-pass':
        return {
          filterName: 'lowpass',
          params: { f: params.frequency || 8000 },
        };
      case 'gain':
        return {
          filterName: 'volume',
          params: { volume: `${params.gain || 0}dB` },
        };
      default:
        return { filterName: 'anull', params: {} };
    }
  }
}
