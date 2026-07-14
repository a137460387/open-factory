import type { AudioEffectSlot, AudioEffectType } from './mixer-types';

/** 效果链执行计划 */
export interface EffectChainPlan {
  effects: AudioEffectSlot[];
  totalLatency: number; // 预估延迟（ms）
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
  compressor: { threshold: [-60, 0], ratio: [1, 20], attack: [0.1, 100], release: [1, 1000], makeup: [0, 24] },
  limiter: { threshold: [-12, 0], release: [1, 1000] },
  gate: { threshold: [-80, 0], attack: [0.01, 100], release: [1, 1000], range: [-80, 0] },
  reverb: { roomSize: [0, 100], damping: [0, 100], wetLevel: [0, 100], dryLevel: [0, 100] },
  delay: { time: [1, 2000], feedback: [0, 95], mix: [0, 100] },
  'eq-4band': { lowGain: [-24, 24], lowMidGain: [-24, 24], highMidGain: [-24, 24], highGain: [-24, 24] },
  'eq-8band': {
    band1: [-12, 12],
    band2: [-12, 12],
    band3: [-12, 12],
    band4: [-12, 12],
    band5: [-12, 12],
    band6: [-12, 12],
    band7: [-12, 12],
    band8: [-12, 12],
  },
  expander: { threshold: [-60, 0], ratio: [0.1, 1], attack: [0.1, 100], release: [10, 1000] },
  chorus: {},
  flanger: { delay: [0, 30], depth: [0, 10], regen: [-95, 95], speed: [0.1, 10] },
  distortion: { gain: [1, 20] },
  'de-esser': { threshold: [-60, 0], reduction: [0, 30] },
  'noise-reduction': { reduction: [-60, 0] },
  'pitch-shift': { semitones: [-12, 12] },
  'stereo-widener': { width: [0, 2] },
  'mid-side': {},
  'phase-invert': {},
};

export class EffectChainEngine {
  /**
   * 排序效果链：过滤掉已禁用的效果，按 order 升序排列
   */
  static sortChain(effects: AudioEffectSlot[]): AudioEffectSlot[] {
    return [...effects].filter((e) => e.enabled).sort((a, b) => a.order - b.order);
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
    return this.sortChain(effects).flatMap((effect) => {
      const params = this.validateParams(effect.effectType, effect.params);
      return this.effectToFfmpeg(effect.effectType, params, effect.wetDry);
    });
  }

  /**
   * 描述 Web Audio 节点图
   */
  static describeNodeGraph(effects: AudioEffectSlot[]): AudioNodeDescription[] {
    return this.sortChain(effects).map((effect) => ({
      type: effect.effectType,
      params: this.validateParams(effect.effectType, effect.params),
      wetDry: effect.wetDry,
    }));
  }

  private static effectToFfmpeg(
    type: AudioEffectType,
    params: Record<string, number>,
    wetDry: number,
  ): FfmpegAudioFilter | FfmpegAudioFilter[] {
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
      case 'eq-8band': {
        const bands = [
          { f: 32, key: 'band1' },
          { f: 64, key: 'band2' },
          { f: 125, key: 'band3' },
          { f: 250, key: 'band4' },
          { f: 500, key: 'band5' },
          { f: 1000, key: 'band6' },
          { f: 2000, key: 'band7' },
          { f: 4000, key: 'band8' },
        ];
        return bands.map((b) => ({
          filterName: 'equalizer',
          params: {
            f: b.f,
            width_type: 'h',
            width: b.f * 0.5,
            g: params[b.key] ?? 0,
          },
        }));
      }
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
      case 'expander':
        return [
          {
            filterName: 'acompressor',
            params: {
              threshold: params.threshold ?? -20,
              ratio: params.ratio ?? 0.5,
              attack: params.attack ?? 10,
              release: params.release ?? 100,
            },
          },
        ];
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
      case 'chorus':
        return [
          {
            filterName: 'chorus',
            params: {
              in_gain: 0.5,
              out_gain: 0.9,
              delays: '50|60',
              decays: '0.4|0.32',
              speeds: '0.25|0.4',
              depths: '2|2.3',
            },
          },
        ];
      case 'flanger':
        return [
          {
            filterName: 'flanger',
            params: {
              delay: params.delay ?? 0,
              depth: params.depth ?? 2,
              regen: params.regen ?? 0,
              speed: params.speed ?? 0.5,
            },
          },
        ];
      case 'distortion':
        return [
          {
            filterName: 'aeval',
            params: {
              exprs: `val(0)*clip(${params.gain ?? 2}, -1, 1)`,
              c: 'same',
            },
          },
        ];
      case 'de-esser':
        return [
          {
            filterName: 'equalizer',
            params: { f: 6000, width_type: 'h', width: 2000, g: -(params.reduction ?? 10) },
          },
          {
            filterName: 'acompressor',
            params: {
              threshold: params.threshold ?? -20,
              ratio: 4,
              attack: 1,
              release: 50,
            },
          },
        ];
      case 'noise-reduction':
        return [
          {
            filterName: 'afftdn',
            params: { nf: params.reduction ?? -25 },
          },
        ];
      case 'pitch-shift': {
        const semitones = params.semitones ?? 0;
        const ratio = Math.pow(2, semitones / 12);
        return [
          {
            filterName: 'asetrate',
            params: { r: `${ratio}*48000` },
          },
          {
            filterName: 'aresample',
            params: { r: 48000 },
          },
        ];
      }
      case 'stereo-widener':
        return [
          {
            filterName: 'stereotools',
            params: {
              mlev: 1,
              slev: params.width ?? 1,
            },
          },
        ];
      case 'mid-side':
        return [
          {
            filterName: 'stereotools',
            params: { mode: 'ms' },
          },
        ];
      case 'phase-invert':
        return [
          {
            filterName: 'aeval',
            params: { exprs: '-val(0)', c: 'same' },
          },
        ];
      default:
        return { filterName: 'anull', params: {} };
    }
  }
}
