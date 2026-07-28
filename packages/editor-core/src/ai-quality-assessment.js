import { identityTranslator } from './ai-module-types';
/** Map a 0-100 score to a grade bucket. */
export function mapScoreToGrade(score) {
    if (score >= 80)
        return 'green';
    if (score >= 60)
        return 'yellow';
    return 'red';
}
/** Clamp and validate a score coming from AI. */
function clampScore(raw) {
    if (typeof raw !== 'number' || Number.isNaN(raw))
        return 0;
    return Math.round(Math.min(100, Math.max(0, raw)));
}
function isValidSeverity(v) {
    return v === 'low' || v === 'medium' || v === 'high';
}
/** Parse and validate an AI quality assessment response. */
export function parseQualityAssessmentResponse(json) {
    const empty = { overallScore: 0, issues: [] };
    if (!json || typeof json !== 'object')
        return empty;
    const obj = json;
    const overallScore = clampScore(obj.overallScore);
    if (!Array.isArray(obj.issues))
        return { overallScore, issues: [] };
    const issues = obj.issues
        .filter((item) => item !== null &&
        typeof item === 'object' &&
        typeof item.type === 'string' &&
        isValidSeverity(item.severity) &&
        typeof item.description === 'string' &&
        typeof item.suggestedFix === 'string')
        .map((item) => ({
        type: item.type.trim(),
        severity: item.severity,
        description: item.description.trim(),
        suggestedFix: item.suggestedFix.trim(),
    }));
    return { overallScore, issues };
}
/**
 * Map an issue's suggestedFix string to concrete editor parameters.
 * Returns undefined if no mapping is found.
 */
export function mapSuggestedFixToEditorParams(fix) {
    const lower = fix.toLowerCase();
    const params = {};
    let matched = false;
    if (lower.includes('亮度') || lower.includes('brightness')) {
        params.brightness = lower.includes('欠曝') || lower.includes('暗') || lower.includes('under') ? 0.3 : 0;
        matched = true;
    }
    if (lower.includes('对比度') || lower.includes('contrast')) {
        params.contrast = 1.2;
        matched = true;
    }
    if (lower.includes('饱和') || lower.includes('saturation')) {
        params.saturation = 1.2;
        matched = true;
    }
    if (lower.includes('锐') || lower.includes('sharp')) {
        params.sharpness = 1.5;
        matched = true;
    }
    if (lower.includes('去噪') || lower.includes('denoise')) {
        params.denoise = true;
        matched = true;
    }
    if (lower.includes('稳定') || lower.includes('stabili')) {
        params.stabilization = true;
        matched = true;
    }
    if (lower.includes('响度') || lower.includes('音量') || lower.includes('loudness') || lower.includes('volume')) {
        params.volume = 1.5;
        matched = true;
    }
    if (lower.includes('噪音') || lower.includes('noise')) {
        params.noiseReduction = true;
        matched = true;
    }
    return matched ? params : undefined;
}
export function buildQualityAssessmentSystemPrompt() {
    return '你是一个专业的视频素材质量评估助手。分析视频截帧画面和媒体信息，找出画面/音频质量问题并给出修复建议。\n\n返回格式必须是JSON对象：\n{"overallScore":0~100,"issues":[{"type":"问题类型","severity":"low|medium|high","description":"问题描述","suggestedFix":"修复建议"}]}\n\n评估维度：\n- 画面曝光（过曝/欠曝）\n- 对焦（模糊/锐利）\n- 构图（主体居中/偏移）\n- 色彩（偏色/正常）\n\nseverity含义：\n- low: 轻微问题，不影响观看\n- medium: 明显问题，建议修复\n- high: 严重问题，强烈建议修复\n\nsuggestedFix应直接映射到编辑器功能，如"建议调整亮度+0.3"/"建议开启去噪"/"建议增加对比度"等。\n\n如果素材质量良好，overallScore可以给高分(80+)，issues可以为空数组。';
}
export function buildQualityAssessmentUserPrompt(mediaInfo) {
    const parts = [`媒体名称：${mediaInfo.name}`, `类型：${mediaInfo.type}`];
    if (mediaInfo.width && mediaInfo.height) {
        parts.push(`分辨率：${mediaInfo.width}x${mediaInfo.height}`);
    }
    if (mediaInfo.duration !== undefined) {
        parts.push(`时长：${mediaInfo.duration.toFixed(1)}秒`);
    }
    if (mediaInfo.hasAudio) {
        parts.push('包含音频轨道：是');
    }
    parts.push('\n请对这段素材进行质量评估，返回JSON。');
    return parts.join('\n');
}
/**
 * Detect frame shake by computing pixel-difference variance between consecutive frames.
 * Each frame is a flat array of grayscale pixel values (0-255).
 * Returns true if shake is detected (high variance in frame-to-frame differences).
 */
export function detectFrameShake(frames, threshold = 30) {
    if (frames.length < 2)
        return false;
    const diffs = [];
    for (let i = 1; i < frames.length; i++) {
        const prev = frames[i - 1];
        const curr = frames[i];
        const len = Math.min(prev.length, curr.length);
        if (len === 0)
            continue;
        let sum = 0;
        for (let j = 0; j < len; j++) {
            sum += Math.abs(curr[j] - prev[j]);
        }
        diffs.push(sum / len);
    }
    if (diffs.length === 0)
        return false;
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    // High mean absolute difference suggests shake
    return mean > threshold;
}
/**
 * Analyze audio RMS level to determine if it's in a normal range.
 * Returns { rms, isQuiet, isClipping }.
 */
export function analyzeAudioRms(samples, quietDb = -40, clipDb = -1) {
    if (samples.length === 0) {
        return { rms: 0, rmsDb: -Infinity, isQuiet: true, isClipping: false };
    }
    let sumSq = 0;
    for (let i = 0; i < samples.length; i++) {
        sumSq += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sumSq / samples.length);
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    return {
        rms,
        rmsDb,
        isQuiet: rmsDb < quietDb,
        isClipping: rmsDb > clipDb,
    };
}
export async function parseQualityAssessmentResponseSafe(json, t = identityTranslator) {
    try {
        const data = parseQualityAssessmentResponse(json);
        return { data, error: null };
    }
    catch {
        return { data: { overallScore: 0, issues: [] }, error: t('aiModules.error.parseFailed') };
    }
}
//# sourceMappingURL=ai-quality-assessment.js.map