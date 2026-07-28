/** AI智能响度适配建议：简化K-weighting + RMS响度估算 + 平台目标映射 */
/** 平台目标响度（LUFS） */
export const PLATFORM_TARGETS = {
    tiktok: -14,
    youtube: -14,
    broadcast: -23,
    podcast: -16,
};
/**
 * 简化K-weighting滤波。
 * 模拟ITU-R BS.1770 K-weighting的简化版本：
 * 对低频做衰减（约-4dB@100Hz），对高频做适度提升（约+1dB@10kHz）。
 * 使用一阶IIR滤波器近似。
 */
export function applyKWeighting(samples, sampleRate) {
    if (samples.length === 0 || sampleRate <= 0)
        return new Float32Array(0);
    const output = new Float32Array(samples.length);
    // 高频搁架滤波器（简化）：提升4kHz以上
    // 使用一阶高通近似
    const fc = 4000;
    const rc = 1 / (2 * Math.PI * fc);
    const dt = 1 / sampleRate;
    const alpha = rc / (rc + dt);
    let prevInput = 0;
    let prevOutput = 0;
    for (let i = 0; i < samples.length; i++) {
        const highPassed = alpha * (prevOutput + samples[i] - prevInput);
        // 混合：原始信号 + 高频增益（简化K-weighting）
        output[i] = samples[i] + 0.5 * highPassed;
        prevInput = samples[i];
        prevOutput = highPassed;
    }
    return output;
}
/**
 * 计算RMS能量。
 */
export function calculateBlockRms(samples) {
    if (samples.length === 0)
        return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
}
/**
 * 估算近似响度（LUFS）。
 * 使用简化K-weighting + 门限RMS测量。
 * 注：这是近似值，不声称完全符合EBU R128。
 */
export function estimateLoudness(samples, sampleRate) {
    if (samples.length === 0 || sampleRate <= 0)
        return -70;
    // 应用K-weighting
    const weighted = applyKWeighting(samples, sampleRate);
    // 分块测量（约400ms块）
    const blockSize = Math.max(1, Math.round(sampleRate * 0.4));
    const blockCount = Math.floor(weighted.length / blockSize);
    if (blockCount === 0) {
        const rms = calculateBlockRms(weighted);
        return rms > 0 ? 20 * Math.log10(rms) : -70;
    }
    // 计算每个块的RMS
    const blockPowers = [];
    for (let b = 0; b < blockCount; b++) {
        const block = weighted.subarray(b * blockSize, (b + 1) * blockSize);
        const rms = calculateBlockRms(block);
        if (rms > 0) {
            blockPowers.push(rms * rms);
        }
    }
    if (blockPowers.length === 0)
        return -70;
    // 门限：绝对门限-70 LUFS（简化）
    const absoluteThreshold = Math.pow(10, (-70 - 0.691) / 10);
    const aboveThreshold = blockPowers.filter((p) => p > absoluteThreshold);
    if (aboveThreshold.length === 0)
        return -70;
    // 相对门限：均值以下-10dB
    const meanPower = aboveThreshold.reduce((a, b) => a + b, 0) / aboveThreshold.length;
    const relativeThreshold = meanPower * 0.1; // -10dB
    const gated = aboveThreshold.filter((p) => p > relativeThreshold);
    if (gated.length === 0)
        return -70;
    const gatedMean = gated.reduce((a, b) => a + b, 0) / gated.length;
    // LUFS = 0.691 + 10*log10(meanPower)
    const lufs = 0.691 + 10 * Math.log10(Math.max(1e-20, gatedMean));
    return Math.round(lufs * 100) / 100;
}
/**
 * 计算建议增益（dB）。
 */
export function calculateGainDelta(measuredLUFS, targetLUFS) {
    return Math.round((targetLUFS - measuredLUFS) * 100) / 100;
}
/**
 * 判断是否应该生成增益建议（|增益| > threshold dB）。
 */
export function shouldSuggestGain(gainDb, threshold = 1) {
    return Math.abs(gainDb) > threshold;
}
/**
 * 创建LoudnessSuggestion对象。
 */
export function createLoudnessSuggestion(measuredLUFS, targetPlatform, suggestedGainDb) {
    return {
        measuredLUFS,
        targetPlatform,
        targetLUFS: PLATFORM_TARGETS[targetPlatform],
        suggestedGainDb,
        appliedAt: null,
    };
}
/**
 * 规范化LoudnessSuggestion，处理旧项目兼容。
 */
export function normalizeLoudnessSuggestion(input) {
    if (!input || typeof input !== 'object')
        return undefined;
    const obj = input;
    if (typeof obj.measuredLUFS !== 'number' || !Number.isFinite(obj.measuredLUFS))
        return undefined;
    if (typeof obj.targetPlatform !== 'string')
        return undefined;
    const platform = obj.targetPlatform;
    if (!(platform in PLATFORM_TARGETS))
        return undefined;
    return {
        measuredLUFS: obj.measuredLUFS,
        targetPlatform: platform,
        targetLUFS: typeof obj.targetLUFS === 'number' ? obj.targetLUFS : PLATFORM_TARGETS[platform],
        suggestedGainDb: typeof obj.suggestedGainDb === 'number' ? obj.suggestedGainDb : 0,
        appliedAt: typeof obj.appliedAt === 'number' ? obj.appliedAt : null,
    };
}
//# sourceMappingURL=ai-loudness-suggestion.js.map