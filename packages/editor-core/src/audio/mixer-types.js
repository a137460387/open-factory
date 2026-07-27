// ─── 工厂函数 ───────────────────────────────────────────────
/** 创建默认效果参数 */
export function createDefaultEffectParams(effectType) {
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
export function createEffectSlot(effectType) {
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
export function createBus(name, type) {
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
export function createMixerChannel(trackId, name) {
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
export function createDefaultMixerState() {
    const masterBus = createBus('Master', 'master');
    return {
        channels: [],
        buses: [],
        masterBus,
    };
}
//# sourceMappingURL=mixer-types.js.map