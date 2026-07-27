/** 音频效果类型 */
export type AudioEffectType = 'eq-4band' | 'eq-8band' | 'compressor' | 'limiter' | 'gate' | 'expander' | 'reverb' | 'delay' | 'chorus' | 'flanger' | 'distortion' | 'de-esser' | 'noise-reduction' | 'pitch-shift' | 'stereo-widener' | 'mid-side' | 'gain' | 'phase-invert' | 'high-pass' | 'low-pass';
/** 音频效果槽 */
export interface AudioEffectSlot {
    id: string;
    effectType: AudioEffectType;
    enabled: boolean;
    params: Record<string, number>;
    wetDry: number;
    order: number;
}
/** 总线类型 */
export type BusType = 'submix' | 'send' | 'aux' | 'master';
/** 总线分配 */
export interface BusAssignment {
    busId: string;
    level: number;
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
    sendLevel?: number;
    sendPrePost?: 'pre' | 'post';
    outputBusId: string | null;
}
/** 自动化点 */
export interface AutomationPoint {
    time: number;
    value: number;
    curve: 'linear' | 'bezier' | 'step' | 'smooth';
    handleIn?: {
        time: number;
        value: number;
    };
    handleOut?: {
        time: number;
        value: number;
    };
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
    volume: number;
    pan: number;
    muted: boolean;
    solo: boolean;
    busAssignments: BusAssignment[];
    inputBus: string | null;
    effectsChain: AudioEffectSlot[];
    automation: ChannelAutomation;
    metering: {
        peakLevel: number;
        rmsLevel: number;
        clipCount: number;
    };
}
/** 混音器状态 */
export interface MixerState {
    channels: MixerChannel[];
    buses: AudioBus[];
    masterBus: AudioBus;
}
/** 创建默认效果参数 */
export declare function createDefaultEffectParams(effectType: AudioEffectType): Record<string, number>;
/** 创建默认效果槽 */
export declare function createEffectSlot(effectType: AudioEffectType): AudioEffectSlot;
/** 创建默认总线 */
export declare function createBus(name: string, type: BusType): AudioBus;
/** 创建默认混音器通道 */
export declare function createMixerChannel(trackId: string, name: string): MixerChannel;
/** 创建默认混音器状态 */
export declare function createDefaultMixerState(): MixerState;
//# sourceMappingURL=mixer-types.d.ts.map