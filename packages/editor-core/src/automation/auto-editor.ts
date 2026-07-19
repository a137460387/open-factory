/**
 * 自动剪辑生成器
 * 接收场景分析结果，根据模板规则筛选素材并计算剪辑点
 * 通过命令对象自动在时间线上生成片段序列
 * 支持与音频节奏（BPM）匹配的卡点剪辑
 * 本地优先：所有处理在本地完成
 */

import type {
  Clip,
  Track,
  Timeline,
  VideoClip,
  Transition,
  TransitionType,
  MediaAsset,
} from '../model-types';
import type { SceneAnalysis, AnalysisReport } from './scene-analyzer';
import type { EditTemplate, RhythmParams, ClipFilterRule } from './template-manager';
import type { PreferenceWeights } from './style-memory';
import { createId } from '../model/clip-normalize';
import { createBaseClip } from '../model/factories';

// ============================================================
// 类型定义
// ============================================================

/** 自动编辑配置 */
export interface AutoEditorConfig {
  /** 目标视频轨道 ID（如不指定则创建新轨道） */
  targetTrackId?: string;
  /** 起始时间偏移（秒） */
  startOffset: number;
  /** 片段间间隔（秒） */
  clipGap: number;
  /** 是否自动添加转场 */
  autoTransitions: boolean;
  /** 是否启用 BPM 卡点 */
  enableBeatSync: boolean;
  /** 自定义 BPM（覆盖模板中的设置） */
  customBpm?: number;
  /** 最大总时长（秒），0 = 不限制 */
  maxTotalDuration: number;
  /** 是否随机选取素材 */
  shuffleMedia: boolean;
  /** 随机种子（用于可复现的随机） */
  randomSeed?: number;
}

/** 候选片段 */
export interface ClipCandidate {
  /** 场景分析 ID */
  sceneAnalysisId: string;
  /** 媒体路径 */
  mediaPath: string;
  /** 媒体资产 ID */
  mediaId: string;
  /** 场景开始时间（秒） */
  sourceStart: number;
  /** 场景结束时间（秒） */
  sourceEnd: number;
  /** 场景时长（秒） */
  duration: number;
  /** 场景类型 */
  sceneType: string;
  /** 综合评分 0-100 */
  score: number;
  /** 质量分 0-100 */
  quality: number;
  /** 关键帧时间点 */
  keyframes: number[];
  /** 是否被选中 */
  selected: boolean;
}

/** 生成的剪辑计划 */
export interface EditPlan {
  id: string;
  /** 使用的模板 ID */
  templateId: string;
  /** 候选片段列表 */
  candidates: ClipCandidate[];
  /** 选中的片段（按播放顺序） */
  selectedClips: ClipCandidate[];
  /** 计划的总时长（秒） */
  totalDuration: number;
  /** 计划的转场列表 */
  transitions: PlannedTransition[];
  /** 生成时间 */
  generatedAt: number;
  /** BPM 节拍点（如启用） */
  beatPoints?: number[];
}

/** 计划的转场 */
export interface PlannedTransition {
  /** 转场类型 */
  type: TransitionType;
  /** 转场时长（秒） */
  duration: number;
  /** 前一个片段 ID */
  fromClipIndex: number;
  /** 后一个片段 ID */
  toClipIndex: number;
}

/** 自动编辑进度回调 */
export type AutoEditProgressCallback = (progress: AutoEditProgress) => void;

/** 自动编辑进度 */
export interface AutoEditProgress {
  /** 当前阶段 */
  phase: 'filtering' | 'scoring' | 'arranging' | 'generating' | 'complete';
  /** 进度 0-1 */
  progress: number;
  /** 描述信息 */
  message: string;
}

/** 自动编辑结果 */
export interface AutoEditResult {
  /** 编辑计划 */
  plan: EditPlan;
  /** 生成的片段列表（可用于命令对象） */
  generatedClips: Clip[];
  /** 生成的转场列表 */
  generatedTransitions: Transition[];
  /** 目标轨道 ID */
  trackId: string;
  /** 总时长（秒） */
  totalDuration: number;
}

// ============================================================
// 工厂函数
// ============================================================

let _planId = 1;
function genPlanId(): string {
  return `plan_${Date.now()}_${_planId++}`;
}

/** 创建默认自动编辑配置 */
export function createDefaultAutoEditorConfig(): AutoEditorConfig {
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
export function filterScenes(
  scenes: SceneAnalysis[],
  filter: ClipFilterRule,
): SceneAnalysis[] {
  return scenes.filter((scene) => {
    // 排除黑场和未知
    if (filter.excludeSceneTypes.includes(scene.sceneType)) return false;
    // 质量阈值
    if (scene.quality.overall < filter.minQuality) return false;
    // 时长范围
    if (scene.duration < filter.minClipDuration) return false;
    if (scene.duration > filter.maxClipDuration) return false;
    return true;
  });
}

/**
 * 对候选片段评分
 * 综合考虑质量、场景类型偏好、关键帧等因素
 */
export function scoreCandidate(
  scene: SceneAnalysis,
  rhythm: RhythmParams,
  preferSceneTypes: string[],
  weights?: PreferenceWeights,
): number {
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
export function calculateTargetDuration(
  scene: SceneAnalysis,
  rhythm: RhythmParams,
  weights?: PreferenceWeights,
): number {
  const range = rhythm.clipDurationRange;
  let target = range.preferred;

  // 根据场景实际时长调整
  if (scene.duration < target) {
    target = scene.duration;
  }

  // 应用风格记忆的时长偏好
  if (weights && weights.sampleCount >= 3) {
    const bias = weights.clipDurationBias * 0.3;
    target *= (1 + bias);
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
export function calculateBeatPoints(bpm: number, duration: number, offset: number = 0): number[] {
  if (bpm <= 0 || duration <= 0) return [];
  const beatInterval = 60 / bpm; // 秒/拍
  const points: number[] = [];
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
export function alignClipToBeat(
  clipStart: number,
  clipDuration: number,
  beatPoints: number[],
): { start: number; duration: number } {
  if (beatPoints.length === 0) return { start: clipStart, duration: clipDuration };

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
export function generateEditPlan(
  scenes: SceneAnalysis[],
  template: EditTemplate,
  config: AutoEditorConfig,
  weights?: PreferenceWeights,
  bpm?: number,
): EditPlan {
  // 1. 筛选场景
  const filtered = filterScenes(scenes, template.filter);

  // 2. 评分和创建候选片段
  const candidates: ClipCandidate[] = filtered.map((scene) => ({
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
  const selected: ClipCandidate[] = [];
  let totalDur = config.startOffset;
  const maxDur = config.maxTotalDuration > 0 ? config.maxTotalDuration : Infinity;
  const maxPerMedia = template.maxClipsPerMedia;
  const mediaCounts: Record<string, number> = {};

  for (const candidate of candidates) {
    if (totalDur >= maxDur) break;

    // 每素材最大片段数限制
    const mediaCount = mediaCounts[candidate.mediaPath] ?? 0;
    if (mediaCount >= maxPerMedia) continue;

    // 计算目标时长
    const targetDur = calculateTargetDuration(
      {
        ...({} as SceneAnalysis),
        duration: candidate.duration,
        quality: { overall: candidate.quality } as any,
      } as any,
      template.rhythm,
      weights,
    );

    const actualDur = Math.min(targetDur, maxDur - totalDur);
    if (actualDur < template.filter.minClipDuration) continue;

    candidate.duration = actualDur;
    candidate.selected = true;
    selected.push(candidate);
    mediaCounts[candidate.mediaPath] = mediaCount + 1;
    totalDur += actualDur + config.clipGap;
  }

  // 6. BPM 卡点对齐
  const effectiveBpm = config.customBpm ?? template.rhythm.targetBpm;
  let beatPoints: number[] | undefined;
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
  const transitions: PlannedTransition[] = [];
  if (config.autoTransitions && template.transition.autoAddTransitions && selected.length > 1) {
    for (let i = 0; i < selected.length - 1; i++) {
      const fromClip = selected[i];
      const toClip = selected[i + 1];
      const transType = template.transition.sceneTypeOverrides[toClip.sceneType]
        ?? template.transition.defaultType;
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
export function generateTimelineElements(
  plan: EditPlan,
  trackId: string,
  config: AutoEditorConfig,
): AutoEditResult {
  const generatedClips: Clip[] = [];
  const generatedTransitions: Transition[] = [];

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

    const clip: VideoClip = {
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
export function autoEdit(
  report: AnalysisReport,
  template: EditTemplate,
  config?: Partial<AutoEditorConfig>,
  weights?: PreferenceWeights,
  trackId?: string,
): AutoEditResult {
  const fullConfig = { ...createDefaultAutoEditorConfig(), ...config };
  const effectiveTrackId = trackId ?? fullConfig.targetTrackId ?? createId('auto-track');

  const plan = generateEditPlan(report.scenes, template, fullConfig, weights, fullConfig.customBpm);
  return generateTimelineElements(plan, effectiveTrackId, fullConfig);
}

// ============================================================
// 工具函数
// ============================================================

/** Fisher-Yates 洗牌（带可选种子） */
function shuffleArray<T>(arr: T[], seed?: number): void {
  let s = seed ?? Math.random() * 2147483647;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = Math.floor((s / 2147483647) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
