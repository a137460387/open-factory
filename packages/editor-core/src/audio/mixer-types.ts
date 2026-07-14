/** 音频效果类型 */
export type AudioEffectType =
  | 'eq-4band' // 4频段参量EQ
  | 'eq-8band' // 8频段参量EQ
  | 'compressor' // 压缩器
  | 'limiter' // 限制器
  | 'gate' // 噪声门
  | 'expander' // 扩展器
  | 'reverb' // 混响
  | 'delay' // 延迟
  | 'chorus' // 合唱
  | 'flanger' // 镶边
  | 'distortion' // 失真
  | 'de-esser' // 齿音消除
  | 'noise-reduction' // 降噪
  | 'pitch-shift' // 变调
  | 'stereo-widener' // 立体声增强
  | 'mid-side' // M/S处理
  | 'gain' // 增益
  | 'phase-invert' // 相位反转
  | 'high-pass' // 高通滤波
  | 'low-pass'; // 低通滤波

/** 音频效果槽 */
export interface AudioEffectSlot {
  id: string;
  effectType: AudioEffectType;
  enabled: boolean;
  params: Record<string, number>;
  wetDry: number; // 0 ~ 1 干湿比
  order: number; // 在效果链中的顺序
}

/** 总线类型 */
export type BusType = 'submix' | 'send' | 'aux' | 'master';

/** 总线分配 */
export interface BusAssignment {
  busId: string;
  level: number; // 0 ~ 1
  enabled: boolean;
}

/** 音频总线 */
export interface AudioBus {
  id: string;
  name: string;
  type: BusType;
  effectsChain: AudioEffectSlot[];
  volume: number;
  pan: number;
  muted: boolean;
  sendLevel?: number; // 发送电平 0~1（发送总线特有）
  sendPrePost?: 'pre' | 'post';
  outputBusId: string | null; // 输出到哪条总线（master为null）
}

/** 自动化点 */
export interface AutomationPoint {
  time: number;
  value: number;
  curve: 'linear' | 'bezier' | 'step' | 'smooth';
  handleIn?: { time: number; value: number };
  handleOut?: { time: number; value: number };
}

/** 自动化曲线 */
export interface AutomationCurve {
  points: AutomationPoint[];
  mode: 'read' | 'write' | 'touch' | 'latch';
}

/** 通道自动化 */
export interface ChannelAutomation {
  volume?: AutomationCurve;
  pan?: AutomationCurve;
  [effectParam: string]: AutomationCurve | undefined;
}

/** 混音器通道条 */
export interface MixerChannel {
  trackId: string;
  name: string;
  volume: number; // dB (-∞ ~ +12)
  pan: number; // -100 ~ 100 (L/R)
  muted: boolean;
  solo: boolean;
  busAssignments: BusAssignment[];
  inputBus: string | null;
  effectsChain: AudioEffectSlot[];
  automation: ChannelAutomation;
  metering: {
    peakLevel: number; // dB
    rmsLevel: number; // dB
    clipCount: number;
  };
}

/** 混音器状态 */
export interface MixerState {
  channels: MixerChannel[];
  buses: AudioBus[];
  masterBus: AudioBus;
}

// ─── 工厂函数 ───────────────────────────────────────────────

/** 创建默认效果参数 */
export function createDefaultEffectParams(effectType: AudioEffectType): Record<string, number> {
  switch (effectType) {
    case 'eq-4band':
      return {
        lowFreq: 80,
        lowGain: 0,
        lowMidFreq: 500,
        lowMidGain: 0,
        highMidFreq: 2000,
        highMidGain: 0,
        highFreq: 8000,
        highGain: 0,
      };
    case 'eq-8band':
      return {
        freq1: 31,
        gain1: 0,
        freq2: 63,
        gain2: 0,
        freq3: 125,
        gain3: 0,
        freq4: 250,
        gain4: 0,
        freq5: 500,
        gain5: 0,
        freq6: 1000,
        gain6: 0,
        freq7: 4000,
        gain7: 0,
        freq8: 16000,
        gain8: 0,
      };
    case 'compressor':
      return { threshold: -20, ratio: 4, attack: 10, release: 100, makeup: 0 };
    case 'limiter':
      return { threshold: -1, release: 100 };
    case 'gate':
      return { threshold: -40, attack: 1, release: 100, range: -60 };
    case 'expander':
      return { threshold: -30, ratio: 2, attack: 1, release: 100 };
    case 'reverb':
      return { roomSize: 50, damping: 50, wetLevel: 30, dryLevel: 70, width: 100 };
    case 'delay':
      return { time: 250, feedback: 30, mix: 30 };
    case 'chorus':
      return { rate: 1.5, depth: 50, feedback: 25, mix: 50 };
    case 'flanger':
      return { rate: 0.5, depth: 70, feedback: 50, delay: 5, mix: 50 };
    case 'distortion':
      return { drive: 50, tone: 50, level: 80 };
    case 'de-esser':
      return { frequency: 6000, threshold: -20, ratio: 4 };
    case 'noise-reduction':
      return { threshold: -40, reduction: 50, attack: 1, release: 100 };
    case 'pitch-shift':
      return { semitones: 0, cents: 0, formantPreserve: 1 };
    case 'stereo-widener':
      return { width: 100 };
    case 'mid-side':
      return { midGain: 0, sideGain: 0 };
    case 'gain':
      return { gain: 0 };
    case 'phase-invert':
      return { invert: 1 };
    case 'high-pass':
      return { frequency: 80, resonance: 0.707 };
    case 'low-pass':
      return { frequency: 18000, resonance: 0.707 };
    default:
      return {};
  }
}

/** 创建默认效果槽 */
export function createEffectSlot(effectType: AudioEffectType): AudioEffectSlot {
  return {
    id: `effect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    effectType,
    enabled: true,
    params: createDefaultEffectParams(effectType),
    wetDry: 1,
    order: 0,
  };
}

/** 创建默认总线 */
export function createBus(name: string, type: BusType): AudioBus {
  return {
    id: `bus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    type,
    effectsChain: [],
    volume: 0,
    pan: 0,
    muted: false,
    outputBusId: null,
  };
}

/** 创建默认混音器通道 */
export function createMixerChannel(trackId: string, name: string): MixerChannel {
  return {
    trackId,
    name,
    volume: 0,
    pan: 0,
    muted: false,
    solo: false,
    busAssignments: [],
    inputBus: null,
    effectsChain: [],
    automation: {},
    metering: { peakLevel: -Infinity, rmsLevel: -Infinity, clipCount: 0 },
  };
}

/** 创建默认混音器状态 */
export function createDefaultMixerState(): MixerState {
  const masterBus = createBus('Master', 'master');
  return {
    channels: [],
    buses: [],
    masterBus,
  };
}
