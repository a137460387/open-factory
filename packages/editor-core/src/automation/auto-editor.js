/**
 * 自动剪辑生成器
 * 接收场景分析结果，根据模板规则筛选素材并计算剪辑点
 * 通过命令对象自动在时间线上生成片段序列
 * 支持与音频节奏（BPM）匹配的卡点剪辑
 * 本地优先：所有处理在本地完成
 */
import { createId } from '../model/clip-normalize';
import { createBaseClip } from '../model/factories';
// ============================================================
// 工厂函数
// ============================================================
let _planId = 1;
function genPlanId() {
    return `plan_${Date.now()}_${_planId++}`;
}
/** 创建默认自动编辑配置 */
export function createDefaultAutoEditorConfig() {
    return {
        startOffset: 0,
        clipGap: 0,
        autoTransitions: true,
        enableBeatSync: false,
        maxTotalDuration: 0,
        shuffleMedia: false,
    };
}
// ============================================================
// 片段筛选与评分
// ============================================================
/**
 * 根据模板筛选规则过滤场景
 */
export function filterScenes(scenes, filter) {
    return scenes.filter((scene) => {
        // 排除黑场和未知
        if (filter.excludeSceneTypes.includes(scene.sceneType))
            return false;
        // 质量阈值
        if (scene.quality.overall < filter.minQuality)
            return false;
        // 时长范围
        if (scene.duration < filter.minClipDuration)
            return false;
        if (scene.duration > filter.maxClipDuration)
            return false;
        return true;
    });
}
/**
 * 对候选片段评分
 * 综合考虑质量、场景类型偏好、关键帧等因素
 */
export function scoreCandidate(scene, rhythm, preferSceneTypes, weights) {
    let score = 0;
    // 质量分（权重可调）
    const qualityNorm = scene.quality.overall / 100;
    score += qualityNorm * rhythm.qualityWeight * 100;
    // 场景类型偏好
    const isPreferred = preferSceneTypes.includes(scene.sceneType);
    const sceneTypeBase = isPreferred ? 80 : 40;
    // 应用风格记忆的场景类型权重
    const sceneTypeAdjust = weights?.sceneTypeWeights[scene.sceneType] ?? 0;
    score += (sceneTypeBase + sceneTypeAdjust * 20) * (1 - rhythm.qualityWeight);
    // 关键帧密度（关键帧越多，剪辑点越丰富）
    const keyframeDensity = scene.keyframes.length / Math.max(1, scene.duration);
    score += Math.min(20, keyframeDensity * 5) * rhythm.keyframeWeight;
    // 场景切换置信度
    score += scene.sceneTypeConfidence * 20 * rhythm.sceneChangeWeight;
    return Math.min(100, Math.max(0, score));
}
/**
 * 计算目标片段时长
 * 考虑模板偏好和风格记忆
 */
export function calculateTargetDuration(scene, rhythm, weights) {
    const range = rhythm.clipDurationRange;
    let target = range.preferred;
    // 根据场景实际时长调整
    if (scene.duration < target) {
        target = scene.duration;
    }
    // 应用风格记忆的时长偏好
    if (weights && weights.sampleCount >= 3) {
        const bias = weights.clipDurationBias * 0.3;
        target *= 1 + bias;
    }
    return Math.max(range.min, Math.min(range.max, target));
}
// ============================================================
// BPM 卡点计算
// ============================================================
/**
 * 根据 BPM 计算节拍时间点
 * @param bpm 每分钟节拍数
 * @param duration 总时长（秒）
 * @param offset 起始偏移（秒）
 */
export function calculateBeatPoints(bpm, duration, offset = 0) {
    if (bpm <= 0 || duration <= 0)
        return [];
    const beatInterval = 60 / bpm; // 秒/拍
    const points = [];
    let t = offset;
    while (t < duration) {
        points.push(t);
        t += beatInterval;
    }
    return points;
}
/**
 * 将片段对齐到最近的节拍点
 * 返回调整后的开始时间和时长
 */
export function alignClipToBeat(clipStart, clipDuration, beatPoints) {
    if (beatPoints.length === 0)
        return { start: clipStart, duration: clipDuration };
    // 找到最近的节拍点作为开始
    let nearestStart = beatPoints[0];
    let minDist = Math.abs(clipStart - nearestStart);
    for (const beat of beatPoints) {
        const dist = Math.abs(clipStart - beat);
        if (dist < minDist) {
            minDist = dist;
            nearestStart = beat;
        }
    }
    // 找到最接近 clipEnd 的节拍点作为结束
    const clipEnd = clipStart + clipDuration;
    let nearestEnd = beatPoints[0];
    let minEndDist = Math.abs(clipEnd - nearestEnd);
    for (const beat of beatPoints) {
        const dist = Math.abs(clipEnd - beat);
        if (dist < minEndDist) {
            minEndDist = dist;
            nearestEnd = beat;
        }
    }
    const newDuration = Math.max(0.5, nearestEnd - nearestStart);
    return { start: nearestStart, duration: newDuration };
}
// ============================================================
// 编辑计划生成
// ============================================================
/**
 * 从场景分析和模板生成编辑计划
 */
export function generateEditPlan(scenes, template, config, weights, bpm) {
    // 1. 筛选场景
    const filtered = filterScenes(scenes, template.filter);
    // 2. 评分和创建候选片段
    const candidates = filtered.map((scene) => ({
        sceneAnalysisId: scene.id,
        mediaPath: scene.mediaPath,
        mediaId: scene.mediaPath, // 使用路径作为媒体 ID
        sourceStart: scene.startTime,
        sourceEnd: scene.endTime,
        duration: scene.duration,
        sceneType: scene.sceneType,
        score: scoreCandidate(scene, template.rhythm, template.filter.preferSceneTypes, weights),
        quality: scene.quality.overall,
        keyframes: scene.keyframes,
        selected: false,
    }));
    // 3. 排序：按评分降序
    candidates.sort((a, b) => b.score - a.score);
    // 4. 可选：打乱顺序
    if (config.shuffleMedia) {
        shuffleArray(candidates, config.randomSeed);
    }
    // 5. 选择片段，考虑总时长限制
    const selected = [];
    let totalDur = config.startOffset;
    const maxDur = config.maxTotalDuration > 0 ? config.maxTotalDuration : Infinity;
    const maxPerMedia = template.maxClipsPerMedia;
    const mediaCounts = {};
    for (const candidate of candidates) {
        if (totalDur >= maxDur)
            break;
        // 每素材最大片段数限制
        const mediaCount = mediaCounts[candidate.mediaPath] ?? 0;
        if (mediaCount >= maxPerMedia)
            continue;
        // 计算目标时长
        const targetDur = calculateTargetDuration({
            id: candidate.mediaPath,
            mediaPath: candidate.mediaPath,
            startTime: 0,
            endTime: candidate.duration,
            duration: candidate.duration,
            sceneType: 'unknown',
            sceneTypeConfidence: 0,
            tags: [],
            quality: {
                overall: candidate.quality,
                sharpness: 50,
                exposure: 50,
                colorSaturation: 50,
                stability: 50,
                audioQuality: 50,
                noiseLevel: 50,
            },
            keyframes: [],
            analyzedAt: Date.now(),
        }, template.rhythm, weights);
        const actualDur = Math.min(targetDur, maxDur - totalDur);
        if (actualDur < template.filter.minClipDuration)
            continue;
        candidate.duration = actualDur;
        candidate.selected = true;
        selected.push(candidate);
        mediaCounts[candidate.mediaPath] = mediaCount + 1;
        totalDur += actualDur + config.clipGap;
    }
    // 6. BPM 卡点对齐
    const effectiveBpm = config.customBpm ?? template.rhythm.targetBpm;
    let beatPoints;
    if (config.enableBeatSync && template.rhythm.beatSync && effectiveBpm) {
        beatPoints = calculateBeatPoints(effectiveBpm, totalDur, config.startOffset);
        let currentTime = config.startOffset;
        for (const clip of selected) {
            const aligned = alignClipToBeat(currentTime, clip.duration, beatPoints);
            clip.duration = aligned.duration;
            currentTime = aligned.start + aligned.duration + config.clipGap;
        }
    }
    // 7. 计划转场
    const transitions = [];
    if (config.autoTransitions && template.transition.autoAddTransitions && selected.length > 1) {
        for (let i = 0; i < selected.length - 1; i++) {
            const fromClip = selected[i];
            const toClip = selected[i + 1];
            const transType = template.transition.sceneTypeOverrides[toClip.sceneType] ?? template.transition.defaultType;
            transitions.push({
                type: transType,
                duration: template.transition.defaultDuration,
                fromClipIndex: i,
                toClipIndex: i + 1,
            });
        }
    }
    return {
        id: genPlanId(),
        templateId: template.id,
        candidates,
        selectedClips: selected,
        totalDuration: totalDur,
        transitions,
        generatedAt: Date.now(),
        beatPoints,
    };
}
// ============================================================
// 时间线生成
// ============================================================
/**
 * 从编辑计划生成可用于时间线的片段和转场
 * 返回值可直接用于 AddClipCommand 等命令对象
 */
export function generateTimelineElements(plan, trackId, config) {
    const generatedClips = [];
    const generatedTransitions = [];
    let currentTime = config.startOffset;
    for (let i = 0; i < plan.selectedClips.length; i++) {
        const candidate = plan.selectedClips[i];
        const clipId = createId('auto-clip');
        const base = createBaseClip({
            id: clipId,
            name: `自动-${candidate.sceneType}-${i + 1}`,
            trackId,
            start: currentTime,
            duration: candidate.duration,
            trimStart: 0,
            trimEnd: 0,
            speed: 1,
        });
        const clip = {
            ...base,
            type: 'video',
            mediaId: candidate.mediaId,
            volume: 1,
            muted: false,
        };
        generatedClips.push(clip);
        currentTime += candidate.duration + config.clipGap;
    }
    // 生成转场
    for (const planned of plan.transitions) {
        const fromClip = generatedClips[planned.fromClipIndex];
        const toClip = generatedClips[planned.toClipIndex];
        if (fromClip && toClip) {
            generatedTransitions.push({
                id: createId('trans'),
                type: planned.type,
                duration: planned.duration,
                fromClipId: fromClip.id,
                toClipId: toClip.id,
            });
        }
    }
    return {
        plan,
        generatedClips,
        generatedTransitions,
        trackId,
        totalDuration: currentTime - config.startOffset,
    };
}
/**
 * 完整的自动编辑流程
 * 从场景分析结果直接生成时间线元素
 */
export function autoEdit(report, template, config, weights, trackId) {
    const fullConfig = { ...createDefaultAutoEditorConfig(), ...config };
    const effectiveTrackId = trackId ?? fullConfig.targetTrackId ?? createId('auto-track');
    const plan = generateEditPlan(report.scenes, template, fullConfig, weights, fullConfig.customBpm);
    return generateTimelineElements(plan, effectiveTrackId, fullConfig);
}
// ============================================================
// 工具函数
// ============================================================
/** Fisher-Yates 洗牌（带可选种子） */
function shuffleArray(arr, seed) {
    let s = seed ?? Math.random() * 2147483647;
    for (let i = arr.length - 1; i > 0; i--) {
        s = (s * 16807) % 2147483647;
        const j = Math.floor((s / 2147483647) * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
//# sourceMappingURL=auto-editor.js.map