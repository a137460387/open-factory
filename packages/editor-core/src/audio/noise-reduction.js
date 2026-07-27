/**
 * 智能降噪参数处理模块
 * 基于 FFmpeg afftdn 滤镜提供降噪参数生成和预设管理
 */
/** 降噪预设定义 */
const PRESETS = {
    light: {
        noiseFloor: -20,
        nrType: 0,
        autoNoiseSampling: false,
        noiseSampleStart: 0,
        noiseSampleEnd: 0,
    },
    medium: {
        noiseFloor: -30,
        nrType: 1,
        autoNoiseSampling: false,
        noiseSampleStart: 0,
        noiseSampleEnd: 0,
    },
    heavy: {
        noiseFloor: -45,
        nrType: 2,
        autoNoiseSampling: true,
        noiseSampleStart: 0,
        noiseSampleEnd: 1,
    },
    custom: {
        noiseFloor: -25,
        nrType: 1,
        autoNoiseSampling: false,
        noiseSampleStart: 0,
        noiseSampleEnd: 0,
    },
};
/** 获取预设参数 */
export function getNoiseReductionPreset(preset) {
    return { ...PRESETS[preset] };
}
/** 获取所有预设名称 */
export function getNoiseReductionPresets() {
    return ['light', 'medium', 'heavy', 'custom'];
}
/** 获取预设的显示名称 */
export function getNoiseReductionPresetLabel(preset) {
    const labels = {
        light: '轻度降噪',
        medium: '中度降噪',
        heavy: '强力降噪',
        custom: '自定义',
    };
    return labels[preset];
}
/** 验证并规范化降噪参数 */
export function normalizeNoiseReductionParams(params) {
    return {
        noiseFloor: clampNumber(params.noiseFloor ?? -25, -60, 0),
        nrType: clampNumber(params.nrType ?? 1, 0, 2),
        autoNoiseSampling: params.autoNoiseSampling ?? false,
        noiseSampleStart: Math.max(0, params.noiseSampleStart ?? 0),
        noiseSampleEnd: Math.max(0, params.noiseSampleEnd ?? 0),
    };
}
/**
 * 生成 FFmpeg afftdn 滤镜参数数组
 * 严格使用参数数组风格，不拼接 shell 字符串
 */
export function buildNoiseReductionFfmpegArgs(params) {
    const normalized = normalizeNoiseReductionParams(params);
    const args = [];
    // 基础 afftdn 滤镜
    const filterParts = [];
    // nf = noise floor (降噪强度)
    filterParts.push(`nf=${normalized.noiseFloor}`);
    // nr = noise reduction type (0=弱, 1=中, 2=强)
    filterParts.push(`nr=${normalized.nrType}`);
    // 如果启用自动噪声采样
    if (normalized.autoNoiseSampling && normalized.noiseSampleEnd > normalized.noiseSampleStart) {
        filterParts.push(`nt=w`);
        // 使用 anlmdn 作为补充降噪
        args.push('afftdn', ...filterParts.map((p) => `-af`), `afftdn=${filterParts.join(':')}`);
    }
    else {
        args.push(`afftdn=${filterParts.join(':')}`);
    }
    return args;
}
/**
 * 生成用于 FFmpeg -af 参数的滤镜字符串
 * 这是用于命令数组风格的单个滤镜参数
 */
export function buildNoiseReductionFilterString(params) {
    const normalized = normalizeNoiseReductionParams(params);
    const parts = [];
    parts.push(`nf=${normalized.noiseFloor}`);
    parts.push(`nr=${normalized.nrType}`);
    return `afftdn=${parts.join(':')}`;
}
/**
 * 计算降噪效果预估
 * 基于输入参数估算降噪后的改善程度
 */
export function estimateNoiseReduction(params, inputPeakDb = 0) {
    const normalized = normalizeNoiseReductionParams(params);
    // 降噪强度越大，峰值衰减越多
    const reductionFactor = Math.abs(normalized.noiseFloor) / 60;
    const peakReduction = reductionFactor * 3; // 预估峰值衰减
    const afterPeakDb = Math.max(-60, inputPeakDb - peakReduction);
    const snrImprovement = Math.abs(normalized.noiseFloor) * 0.6; // 估算 SNR 改善
    return {
        beforePeakDb: inputPeakDb,
        afterPeakDb,
        snrImprovement: Math.round(snrImprovement * 10) / 10,
        filterArgs: buildNoiseReductionFfmpegArgs(normalized),
    };
}
/**
 * 检查参数是否表示有效的降噪配置
 */
export function isValidNoiseReductionParams(params) {
    if (params.noiseFloor !== undefined && (params.noiseFloor < -60 || params.noiseFloor > 0)) {
        return false;
    }
    if (params.nrType !== undefined && (params.nrType < 0 || params.nrType > 2)) {
        return false;
    }
    if (params.noiseSampleStart !== undefined &&
        params.noiseSampleEnd !== undefined &&
        params.noiseSampleEnd <= params.noiseSampleStart) {
        return false;
    }
    return true;
}
/**
 * 根据强度百分比 (0-100) 生成降噪参数
 * 0 = 无降噪，100 = 最强降噪
 */
export function strengthToNoiseReductionParams(strength) {
    const clamped = Math.max(0, Math.min(100, strength));
    const normalized = clamped / 100;
    // 将 0-100 映射到 -60 ~ 0 dB 的噪声底限
    const noiseFloor = -60 + normalized * 60;
    // 根据强度选择降噪类型
    let nrType;
    if (normalized < 0.33) {
        nrType = 0; // 弱
    }
    else if (normalized < 0.66) {
        nrType = 1; // 中
    }
    else {
        nrType = 2; // 强
    }
    return normalizeNoiseReductionParams({
        noiseFloor,
        nrType,
        autoNoiseSampling: normalized > 0.7,
        noiseSampleStart: 0,
        noiseSampleEnd: normalized > 0.7 ? 1 : 0,
    });
}
/**
 * 将降噪参数转换为效果槽参数格式
 * 用于与 mixer-types 的 AudioEffectSlot 集成
 */
export function noiseReductionToEffectParams(params) {
    const normalized = normalizeNoiseReductionParams(params);
    return {
        threshold: normalized.noiseFloor,
        reduction: (Math.abs(normalized.noiseFloor) / 60) * 100,
        attack: 1,
        release: 100,
    };
}
function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(max, Math.max(min, value));
}
//# sourceMappingURL=noise-reduction.js.map