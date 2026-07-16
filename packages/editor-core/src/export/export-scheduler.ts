import type { FfmpegExportPlan, ExportSettings, ExportProject } from './export-types';
import type { ExportResourceEstimate } from './scheduling';
import { estimateExportResourceNeeds } from './scheduling';

/**
 * 智能导出调度器 - 根据项目复杂度自动选择最优编码参数
 *
 * 基于项目复杂度（片段数量、特效种类、分辨率等）自动选择：
 * - 视频编码 preset（ultrafast/superfast/veryfast/faster/fast/medium/slow/slower/veryslow）
 * - 线程数
 * - 编码质量参数
 * - 硬件加速策略
 */

export interface ExportSchedulerConfig {
  /** 目标导出质量：'speed' | 'balanced' | 'quality' */
  qualityTarget: 'speed' | 'balanced' | 'quality';
  /** 可用硬件并发数 */
  hardwareConcurrency: number;
  /** 可用内存（MB） */
  availableMemoryMb: number;
  /** 是否启用硬件加速 */
  hardwareAccelerationEnabled: boolean;
  /** 硬件编码器 ID */
  hardwareEncoderId?: string;
  /** 最大线程数限制 */
  maxThreads?: number;
  /** 用户自定义 preset 覆盖 */
  presetOverride?: string;
}

export interface ExportSchedulerDecision {
  /** 推荐的编码 preset */
  preset: string;
  /** 推荐的线程数 */
  threads: number;
  /** 推荐的 CRF/CQ 值 */
  crf: number;
  /** 是否建议使用硬件加速 */
  useHardwareAcceleration: boolean;
  /** 调度理由 */
  reasons: string[];
  /** 资源估算 */
  resourceEstimate: ExportResourceEstimate;
  /** 预计编码速度倍数 */
  estimatedSpeedMultiplier: number;
  /** 预计输出文件大小（MB） */
  estimatedFileSizeMb: number;
}

export interface ProjectComplexityMetrics {
  /** 总片段数 */
  totalClips: number;
  /** 视频片段数 */
  videoClips: number;
  /** 图片片段数 */
  imageClips: number;
  /** 文本/字幕片段数 */
  textClips: number;
  /** 嵌套序列数 */
  nestedSequences: number;
  /** 特效数量 */
  effectCount: number;
  /** 转场数量 */
  transitionCount: number;
  /** 分辨率因子（相对于 1080p） */
  resolutionFactor: number;
  /** 帧率因子（相对于 30fps） */
  fpsFactor: number;
  /** 时长（秒） */
  durationSeconds: number;
  /** 是否包含复杂特效 */
  hasComplexEffects: boolean;
  /** 是否包含时间插值 */
  hasTemporalInterpolation: boolean;
  /** 是否包含色彩校正 */
  hasColorCorrection: boolean;
  /** 是否包含遮罩 */
  hasMasks: boolean;
}

const HD_PIXELS = 1920 * 1080;
const PRESET_SPEED_MAP: Record<string, number> = {
  ultrafast: 9,
  superfast: 8,
  veryfast: 7,
  faster: 6,
  fast: 5,
  medium: 4,
  slow: 3,
  slower: 2,
  veryslow: 1,
};

const PRESET_QUALITY_MAP: Record<string, number> = {
  ultrafast: 1,
  superfast: 2,
  veryfast: 3,
  faster: 4,
  fast: 5,
  medium: 6,
  slow: 7,
  slower: 8,
  veryslow: 9,
};

const CRF_DEFAULTS = {
  speed: 28,
  balanced: 23,
  quality: 18,
} as const;

const PRESET_BY_QUALITY_TARGET = {
  speed: 'veryfast',
  balanced: 'medium',
  quality: 'slow',
} as const;

/**
 * 分析项目复杂度
 */
export function analyzeProjectComplexity(project: ExportProject): ProjectComplexityMetrics {
  const timeline = project.timeline;
  const tracks = timeline.tracks;
  const transitions = timeline.transitions;

  let totalClips = 0;
  let videoClips = 0;
  let imageClips = 0;
  let textClips = 0;
  let effectCount = 0;
  let hasComplexEffects = false;
  let hasTemporalInterpolation = false;
  let hasColorCorrection = false;
  let hasMasks = false;

  for (const track of tracks) {
    for (const clip of track.clips) {
      totalClips++;

      switch (clip.type) {
        case 'video':
        case 'multicam':
          videoClips++;
          break;
        case 'image':
          imageClips++;
          break;
        case 'text':
        case 'subtitle':
        case 'credits':
          textClips++;
          break;
      }

      // 统计特效
      if (clip.effects && clip.effects.length > 0) {
        effectCount += clip.effects.length;
        hasComplexEffects = true;
      }

      // 检查时间插值
      if (clip.frameInterpolation?.enabled) {
        hasTemporalInterpolation = true;
        effectCount += 2; // 时间插值权重更高
      }

      // 检查色彩校正
      if (clip.colorCorrection && (
        clip.colorCorrection.brightness !== 0 ||
        clip.colorCorrection.contrast !== 1 ||
        clip.colorCorrection.saturation !== 1 ||
        clip.colorCorrection.hue !== 0 ||
        clip.colorCorrection.lutPath
      )) {
        hasColorCorrection = true;
        effectCount++;
      }

      // 检查遮罩
      if (clip.masks && clip.masks.length > 0) {
        hasMasks = true;
        effectCount += clip.masks.length;
      }

      // 检查其他复杂特效
      if (clip.chromaKey?.enabled) effectCount += 2;
      if (clip.stabilization?.enabled) effectCount += 1;
      if (clip.videoRestoration && (clip.videoRestoration.deinterlace?.enabled || clip.videoRestoration.temporalDenoise?.preset !== 'off' || clip.videoRestoration.spatialDenoise?.enabled)) effectCount += 2;
      if (clip.qualityEnhancement && (clip.qualityEnhancement.superResolution || clip.qualityEnhancement.deblock || clip.qualityEnhancement.colorBoost)) effectCount += 2;
      if (clip.kenBurns) effectCount += 1;
    }
  }

  const settings = project.settings;
  const width = settings.width || 1920;
  const height = settings.height || 1080;
  const fps = settings.fps || 30;
  const resolutionFactor = Math.max(0.25, (width * height) / HD_PIXELS);
  const fpsFactor = fps / 30;

  return {
    totalClips,
    videoClips,
    imageClips,
    textClips,
    nestedSequences: project.sequences?.length ?? 0,
    effectCount,
    transitionCount: transitions.length,
    resolutionFactor,
    fpsFactor,
    durationSeconds: timeline.duration,
    hasComplexEffects,
    hasTemporalInterpolation,
    hasColorCorrection,
    hasMasks,
  };
}

/**
 * 计算导出复杂度分数（0-100）
 *
 * 注意：此函数与 complexity-score 模块中的 calculateComplexityScore 不同，
 * 专门用于导出调度参数选择。
 */
export function calculateExportComplexityScore(metrics: ProjectComplexityMetrics): number {
  let score = 0;

  // 基础分数：片段数量
  score += Math.min(20, metrics.totalClips * 0.5);

  // 特效分数
  score += Math.min(30, metrics.effectCount * 2);

  // 分辨率分数
  score += Math.min(20, (metrics.resolutionFactor - 1) * 15);

  // 帧率分数
  score += Math.min(10, (metrics.fpsFactor - 1) * 10);

  // 复杂特效加分
  if (metrics.hasTemporalInterpolation) score += 10;
  if (metrics.hasMasks) score += 5;
  if (metrics.hasComplexEffects) score += 5;

  // 转场分数
  score += Math.min(10, metrics.transitionCount * 0.5);

  return Math.min(100, Math.max(0, score));
}

/**
 * 根据复杂度选择最优 preset
 */
export function selectOptimalPreset(
  complexityScore: number,
  qualityTarget: 'speed' | 'balanced' | 'quality',
  hardwareAcceleration: boolean,
): string {
  // 硬件加速时使用固定 preset
  if (hardwareAcceleration) {
    return 'medium'; // 硬件编码器通常使用固定 preset
  }

  const basePreset = PRESET_BY_QUALITY_TARGET[qualityTarget];
  const basePresetSpeed = PRESET_SPEED_MAP[basePreset] || 4;

  // 根据复杂度调整 preset
  // 注意：速度值越高表示越快（ultrafast=9, veryslow=1）
  let adjustedSpeed: number;
  if (complexityScore < 20) {
    // 低复杂度：可以使用更慢的 preset（更高质量）
    adjustedSpeed = Math.max(1, basePresetSpeed - 2);
  } else if (complexityScore < 40) {
    // 中低复杂度：略微提升质量
    adjustedSpeed = Math.max(1, basePresetSpeed - 1);
  } else if (complexityScore < 60) {
    // 中等复杂度：保持基准
    adjustedSpeed = basePresetSpeed;
  } else if (complexityScore < 80) {
    // 中高复杂度：略微提升速度
    adjustedSpeed = Math.min(9, basePresetSpeed + 1);
  } else {
    // 高复杂度：优先速度
    adjustedSpeed = Math.min(9, basePresetSpeed + 2);
  }

  // 从速度值反向查找 preset 名称
  const presetMap: Record<number, string> = {
    1: 'veryslow',
    2: 'slower',
    3: 'slow',
    4: 'medium',
    5: 'fast',
    6: 'faster',
    7: 'veryfast',
    8: 'superfast',
    9: 'ultrafast',
  };

  return presetMap[adjustedSpeed] || 'medium';
}

/**
 * 计算最优线程数
 */
export function calculateOptimalThreads(
  complexityScore: number,
  hardwareConcurrency: number,
  availableMemoryMb: number,
  resourceEstimate: ExportResourceEstimate,
  maxThreads?: number,
): number {
  const cores = Math.max(1, hardwareConcurrency);
  const memoryPerThread = resourceEstimate.memoryMb / Math.max(1, cores);

  // 基于可用内存计算最大线程数
  const memoryBasedThreads = Math.floor(availableMemoryMb / Math.max(100, memoryPerThread));

  // 基于 CPU 核心数计算
  let cpuBasedThreads: number;
  if (complexityScore < 30) {
    // 低复杂度：可以使用更多线程
    cpuBasedThreads = Math.ceil(cores * 0.75);
  } else if (complexityScore < 60) {
    // 中等复杂度：使用一半核心
    cpuBasedThreads = Math.ceil(cores * 0.5);
  } else {
    // 高复杂度：限制线程数避免内存压力
    cpuBasedThreads = Math.ceil(cores * 0.35);
  }

  // 取最小值并限制范围
  let threads = Math.min(memoryBasedThreads, cpuBasedThreads, cores);
  threads = Math.max(1, Math.min(threads, 16)); // 限制在 1-16 范围

  // 应用用户限制
  if (maxThreads && maxThreads > 0) {
    threads = Math.min(threads, maxThreads);
  }

  return threads;
}

/**
 * 计算最优 CRF/CQ 值
 */
export function calculateOptimalCrf(
  complexityScore: number,
  qualityTarget: 'speed' | 'balanced' | 'quality',
): number {
  const baseCrf = CRF_DEFAULTS[qualityTarget];

  // 根据复杂度调整 CRF
  if (complexityScore < 20) {
    // 低复杂度：可以使用更低 CRF（更高质量）
    return Math.max(15, baseCrf - 3);
  } else if (complexityScore < 40) {
    return Math.max(17, baseCrf - 1);
  } else if (complexityScore < 60) {
    return baseCrf;
  } else if (complexityScore < 80) {
    return Math.min(30, baseCrf + 2);
  } else {
    // 高复杂度：使用更高 CRF（更快编码）
    return Math.min(35, baseCrf + 5);
  }
}

/**
 * 估算编码速度倍数
 */
export function estimateSpeedMultiplier(
  preset: string,
  threads: number,
  complexityScore: number,
): number {
  const presetSpeed = PRESET_SPEED_MAP[preset] || 6;
  const baseSpeed = presetSpeed / 6; // 相对于 medium 的速度

  // 线程数加成（边际递减）
  const threadBonus = 1 + Math.log2(Math.max(1, threads)) * 0.2;

  // 复杂度惩罚
  const complexityPenalty = 1 - (complexityScore / 100) * 0.3;

  return baseSpeed * threadBonus * complexityPenalty;
}

/**
 * 估算输出文件大小（MB）
 */
export function estimateFileSizeMb(
  settings: ExportSettings,
  durationSeconds: number,
  crf: number,
): number {
  const width = settings.width || 1920;
  const height = settings.height || 1080;
  const fps = settings.fps || 30;

  // 基础比特率估算（基于 CRF）
  // CRF 每增加 6，比特率大约减半
  const baseBitrateKbps = 8000; // 1080p@30fps 的基准比特率
  const crfFactor = Math.pow(2, (23 - crf) / 6);
  const resolutionFactor = (width * height) / HD_PIXELS;
  const fpsFactor = fps / 30;

  const estimatedBitrateKbps = baseBitrateKbps * crfFactor * resolutionFactor * fpsFactor;
  const estimatedFileSizeKbps = estimatedBitrateKbps * durationSeconds;

  return Math.round(estimatedFileSizeKbps / 8 / 1024); // 转换为 MB
}

/**
 * 智能导出调度主函数
 */
export function scheduleExport(
  plan: FfmpegExportPlan,
  project: ExportProject,
  config: ExportSchedulerConfig,
): ExportSchedulerDecision {
  const reasons: string[] = [];

  // 1. 分析项目复杂度
  const metrics = analyzeProjectComplexity(project);
  const complexityScore = calculateExportComplexityScore(metrics);

  reasons.push(`项目复杂度分数: ${complexityScore.toFixed(1)}/100`);
  reasons.push(`片段数: ${metrics.totalClips}, 特效数: ${metrics.effectCount}`);

  // 2. 估算资源需求
  const resourceEstimate = estimateExportResourceNeeds(plan);
  reasons.push(`内存需求: ${resourceEstimate.memoryMb}MB, CPU 成本: ${resourceEstimate.cpuCost}`);

  // 3. 选择最优 preset
  let preset: string;
  if (config.presetOverride) {
    preset = config.presetOverride;
    reasons.push(`使用用户自定义 preset: ${preset}`);
  } else {
    preset = selectOptimalPreset(
      complexityScore,
      config.qualityTarget,
      config.hardwareAccelerationEnabled,
    );
    reasons.push(`根据质量目标 "${config.qualityTarget}" 和复杂度选择 preset: ${preset}`);
  }

  // 4. 计算最优线程数
  const threads = calculateOptimalThreads(
    complexityScore,
    config.hardwareConcurrency,
    config.availableMemoryMb,
    resourceEstimate,
    config.maxThreads,
  );
  reasons.push(`根据 ${config.hardwareConcurrency} 核心和 ${config.availableMemoryMb}MB 可用内存设置线程数: ${threads}`);

  // 5. 计算最优 CRF
  const crf = calculateOptimalCrf(complexityScore, config.qualityTarget);
  reasons.push(`根据质量目标设置 CRF: ${crf}`);

  // 6. 硬件加速决策
  const shouldUseHardwareAcceleration = Boolean(
    config.hardwareAccelerationEnabled &&
    config.hardwareEncoderId &&
    resourceEstimate.memoryClass !== 'heavy'
  );

  if (shouldUseHardwareAcceleration) {
    reasons.push(`启用硬件加速: ${config.hardwareEncoderId}`);
  } else if (config.hardwareAccelerationEnabled) {
    reasons.push('硬件加速已禁用：内存需求过高或未指定编码器');
  }

  // 7. 估算性能指标
  const estimatedSpeedMultiplier = estimateSpeedMultiplier(preset, threads, complexityScore);
  const estimatedFileSizeMb = estimateFileSizeMb(
    project.settings,
    metrics.durationSeconds,
    crf,
  );

  reasons.push(`预计编码速度: ${estimatedSpeedMultiplier.toFixed(2)}x`);
  reasons.push(`预计文件大小: ${estimatedFileSizeMb}MB`);

  return {
    preset,
    threads,
    crf,
    useHardwareAcceleration: shouldUseHardwareAcceleration,
    reasons,
    resourceEstimate,
    estimatedSpeedMultiplier,
    estimatedFileSizeMb,
  };
}

/**
 * 将调度决策应用到导出计划
 */
export function applySchedulerDecision(
  plan: FfmpegExportPlan,
  decision: ExportSchedulerDecision,
): FfmpegExportPlan {
  const outputArgs = [...(plan.outputArgs ?? [])];
  const fullArgs = [...(plan.fullArgs ?? [])];

  // 应用 preset
  replaceOrAddArg(outputArgs, '-preset', decision.preset);
  replaceOrAddArg(fullArgs, '-preset', decision.preset);

  // 应用线程数
  replaceOrAddArg(outputArgs, '-threads', String(decision.threads));
  replaceOrAddArg(fullArgs, '-threads', String(decision.threads));

  // 应用 CRF（仅软件编码）
  if (decision.useHardwareAcceleration) {
    // 硬件加速时移除 CRF 参数
    removeArg(outputArgs, '-crf');
    removeArg(fullArgs, '-crf');
  } else {
    replaceOrAddArg(outputArgs, '-crf', String(decision.crf));
    replaceOrAddArg(fullArgs, '-crf', String(decision.crf));
  }

  // 递归处理嵌套计划
  const nestedPlans = (plan.nestedPlans ?? []).map((nested) => ({
    ...nested,
    plan: applySchedulerDecision(nested.plan, decision),
  }));

  // 处理多 pass
  const passes = plan.passes?.map((pass) => {
    const passArgs = [...pass.fullArgs];
    replaceOrAddArg(passArgs, '-preset', decision.preset);
    replaceOrAddArg(passArgs, '-threads', String(decision.threads));
    if (decision.useHardwareAcceleration) {
      removeArg(passArgs, '-crf');
    } else {
      replaceOrAddArg(passArgs, '-crf', String(decision.crf));
    }
    return { ...pass, fullArgs: passArgs };
  });

  return {
    ...plan,
    outputArgs,
    fullArgs,
    nestedPlans,
    passes,
  };
}

/**
 * 替换或添加命令行参数
 */
function replaceOrAddArg(args: string[], key: string, value: string): void {
  const index = args.indexOf(key);
  if (index >= 0 && index + 1 < args.length) {
    args[index + 1] = value;
  } else {
    args.push(key, value);
  }
}

/**
 * 移除命令行参数及其值
 */
function removeArg(args: string[], key: string): void {
  const index = args.indexOf(key);
  if (index >= 0) {
    args.splice(index, 2); // 移除 key 和 value
  }
}

/**
 * 获取推荐的导出配置
 */
export function getRecommendedExportConfig(
  project: ExportProject,
  hardwareConcurrency: number = navigator.hardwareConcurrency || 4,
  availableMemoryMb: number = 4096,
): ExportSchedulerConfig {
  const metrics = analyzeProjectComplexity(project);
  const complexityScore = calculateExportComplexityScore(metrics);

  // 根据复杂度推荐质量目标
  let qualityTarget: 'speed' | 'balanced' | 'quality';
  if (complexityScore > 70) {
    qualityTarget = 'speed';
  } else if (complexityScore > 40) {
    qualityTarget = 'balanced';
  } else {
    qualityTarget = 'quality';
  }

  return {
    qualityTarget,
    hardwareConcurrency,
    availableMemoryMb,
    hardwareAccelerationEnabled: false, // 默认禁用，由用户手动启用
  };
}