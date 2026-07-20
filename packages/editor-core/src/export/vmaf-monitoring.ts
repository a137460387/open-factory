import type { FfmpegExportPlan, ExportSettings } from './export-types';

/**
 * VMAF 质量监控模块
 *
 * 在导出过程中抽样计算 VMAF 分数，若环境不支持实时计算，
 * 则降级为导出完成后生成质量报告。
 */

export type VmafMonitoringMode = 'realtime' | 'post-export' | 'disabled';

export interface VmafSamplePoint {
  /** 时间戳（秒） */
  timestamp: number;
  /** VMAF 分数 (0-100) */
  vmafScore: number;
  /** PSNR 分数 */
  psnrScore?: number;
  /** SSIM 分数 */
  ssimScore?: number;
  /** 样本路径 */
  samplePath?: string;
}

export interface VmafMonitoringConfig {
  /** 监控模式 */
  mode: VmafMonitoringMode;
  /** 抽样间隔（秒） */
  sampleInterval: number;
  /** 最大样本数 */
  maxSamples: number;
  /** 是否启用 PSNR */
  enablePsnr: boolean;
  /** 是否启用 SSIM */
  enableSsim: boolean;
  /** VMAF 模型路径 */
  modelPath?: string;
}

export interface VmafMonitoringResult {
  /** 监控模式 */
  mode: VmafMonitoringMode;
  /** 样本点 */
  samples: VmafSamplePoint[];
  /** 平均 VMAF 分数 */
  averageVmaf: number;
  /** 最小 VMAF 分数 */
  minVmaf: number;
  /** 最大 VMAF 分数 */
  maxVmaf: number;
  /** VMAF 标准差 */
  vmafStdDev: number;
  /** 质量评级 */
  qualityRating: 'excellent' | 'good' | 'fair' | 'poor';
  /** 质量警告 */
  warnings: string[];
  /** 总处理时间（毫秒） */
  processingTimeMs: number;
}

export interface VmafEnvironmentCapabilities {
  /** 是否支持 VMAF */
  vmafAvailable: boolean;
  /** 是否支持实时 VMAF */
  realtimeSupported: boolean;
  /** VMAF 版本 */
  vmafVersion?: string;
  /** 可用的 VMAF 模型 */
  availableModels: string[];
  /** 错误信息 */
  error?: string;
}

const DEFAULT_VMAF_CONFIG: VmafMonitoringConfig = {
  mode: 'post-export',
  sampleInterval: 10,
  maxSamples: 20,
  enablePsnr: true,
  enableSsim: true,
};

const VMAF_QUALITY_THRESHOLDS = {
  excellent: 90,
  good: 75,
  fair: 60,
  poor: 0,
} as const;

/**
 * 检测 VMAF 环境能力
 */
export async function detectVmafCapabilities(): Promise<VmafEnvironmentCapabilities> {
  try {
    // 检查 FFmpeg 是否支持 VMAF
    // 这里应该调用 Tauri 后端检测 FFmpeg 的 libvmaf 支持
    // 暂时返回模拟数据
    return {
      vmafAvailable: true,
      realtimeSupported: false, // 实时 VMAF 需要高性能硬件
      vmafVersion: '2.3.1',
      availableModels: ['vmaf_v0.6.1', 'vmaf_4k_v0.6.1'],
    };
  } catch (error) {
    return {
      vmafAvailable: false,
      realtimeSupported: false,
      availableModels: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 确定最佳监控模式
 */
export function determineMonitoringMode(
  capabilities: VmafEnvironmentCapabilities,
  config: Partial<VmafMonitoringConfig> = {},
): VmafMonitoringMode {
  if (!capabilities.vmafAvailable) {
    return 'disabled';
  }

  if (config.mode === 'realtime' && !capabilities.realtimeSupported) {
    // 降级到后处理模式
    return 'post-export';
  }

  return config.mode ?? 'post-export';
}

/**
 * 生成 VMAF 采样计划
 */
export function generateVmafSamplePlan(duration: number, config: VmafMonitoringConfig): number[] {
  if (config.mode === 'disabled' || duration <= 0) {
    return [];
  }

  const samples: number[] = [];
  const interval = config.sampleInterval;
  const maxSamples = config.maxSamples;

  // 避免在开头和结尾采样（通常是黑帧或过渡）
  const startOffset = Math.min(interval, duration * 0.1);
  const endOffset = Math.min(interval, duration * 0.1);

  let currentTime = startOffset;
  while (currentTime < duration - endOffset && samples.length < maxSamples) {
    samples.push(Math.round(currentTime * 1000) / 1000);
    currentTime += interval;
  }

  return samples;
}

/**
 * 构建 VMAF 采样 FFmpeg 命令
 */
export function buildVmafSampleCommand(
  sourcePath: string,
  outputPath: string,
  timestamp: number,
  config: VmafMonitoringConfig,
): string[] {
  const args: string[] = [
    'ffmpeg',
    '-ss',
    String(timestamp),
    '-i',
    sourcePath,
    '-ss',
    String(timestamp),
    '-i',
    outputPath,
    '-t',
    '1', // 只采样 1 秒
    '-lavfi',
  ];

  // 构建 VMAF 滤镜
  let filter = `libvmaf=n_threads=4`;

  if (config.modelPath) {
    filter += `:model_path=${config.modelPath}`;
  }

  if (config.enablePsnr) {
    filter += ':psnr=1';
  }

  if (config.enableSsim) {
    filter += ':ssim=1';
  }

  filter += ':log_fmt=json';

  args.push(filter);
  args.push('-f', 'null', '-');

  return args;
}

/**
 * 解析 VMAF 结果
 */
export function parseVmafResult(jsonOutput: string): Partial<VmafSamplePoint> {
  try {
    const result = JSON.parse(jsonOutput);
    const frames = result.frames ?? [];

    if (frames.length === 0) {
      return {};
    }

    // 取平均值
    const vmafScores = frames.map((f: { metrics?: { vmaf?: number } }) => f.metrics?.vmaf ?? 0);
    const psnrScores = frames.map((f: { metrics?: { psnr?: number } }) => f.metrics?.psnr).filter(Boolean);
    const ssimScores = frames.map((f: { metrics?: { ssim?: number } }) => f.metrics?.ssim).filter(Boolean);

    return {
      vmafScore: average(vmafScores),
      psnrScore: psnrScores.length > 0 ? average(psnrScores) : undefined,
      ssimScore: ssimScores.length > 0 ? average(ssimScores) : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * 分析 VMAF 监控结果
 */
export function analyzeVmafResults(
  samples: VmafSamplePoint[],
): Omit<VmafMonitoringResult, 'mode' | 'processingTimeMs'> {
  if (samples.length === 0) {
    return {
      samples: [],
      averageVmaf: 0,
      minVmaf: 0,
      maxVmaf: 0,
      vmafStdDev: 0,
      qualityRating: 'poor',
      warnings: ['没有可用的 VMAF 样本'],
    };
  }

  const vmafScores = samples.map((s) => s.vmafScore);
  const averageVmaf = average(vmafScores);
  const minVmaf = Math.min(...vmafScores);
  const maxVmaf = Math.max(...vmafScores);
  const vmafStdDev = standardDeviation(vmafScores);

  // 确定质量评级
  let qualityRating: VmafMonitoringResult['qualityRating'];
  if (averageVmaf >= VMAF_QUALITY_THRESHOLDS.excellent) {
    qualityRating = 'excellent';
  } else if (averageVmaf >= VMAF_QUALITY_THRESHOLDS.good) {
    qualityRating = 'good';
  } else if (averageVmaf >= VMAF_QUALITY_THRESHOLDS.fair) {
    qualityRating = 'fair';
  } else {
    qualityRating = 'poor';
  }

  // 生成警告
  const warnings: string[] = [];
  if (averageVmaf < VMAF_QUALITY_THRESHOLDS.fair) {
    warnings.push(`平均 VMAF 分数过低: ${averageVmaf.toFixed(1)}`);
  }
  if (vmafStdDev > 10) {
    warnings.push(`VMAF 分数波动过大: ${vmafStdDev.toFixed(1)}`);
  }
  if (minVmaf < 50) {
    warnings.push(`存在质量极低的片段: ${minVmaf.toFixed(1)}`);
  }

  return {
    samples,
    averageVmaf,
    minVmaf,
    maxVmaf,
    vmafStdDev,
    qualityRating,
    warnings,
  };
}

/**
 * 生成 VMAF 质量报告
 */
export function generateVmafReport(result: VmafMonitoringResult, projectName?: string): string {
  const lines: string[] = [];

  lines.push('# VMAF 质量监控报告');
  lines.push('');
  if (projectName) {
    lines.push(`**项目名称**: ${projectName}`);
  }
  lines.push(`**监控模式**: ${result.mode}`);
  lines.push(`**处理时间**: ${(result.processingTimeMs / 1000).toFixed(1)} 秒`);
  lines.push('');

  lines.push('## 质量摘要');
  lines.push('');
  lines.push(`- **平均 VMAF**: ${result.averageVmaf.toFixed(1)}`);
  lines.push(`- **最小 VMAF**: ${result.minVmaf.toFixed(1)}`);
  lines.push(`- **最大 VMAF**: ${result.maxVmaf.toFixed(1)}`);
  lines.push(`- **标准差**: ${result.vmafStdDev.toFixed(1)}`);
  lines.push(`- **质量评级**: ${getQualityRatingLabel(result.qualityRating)}`);
  lines.push('');

  if (result.warnings.length > 0) {
    lines.push('## 警告');
    lines.push('');
    result.warnings.forEach((warning) => {
      lines.push(`- ⚠️ ${warning}`);
    });
    lines.push('');
  }

  lines.push('## 采样详情');
  lines.push('');
  lines.push('| 时间戳 | VMAF | PSNR | SSIM |');
  lines.push('|--------|------|------|------|');

  result.samples.forEach((sample) => {
    const timestamp = formatTimestamp(sample.timestamp);
    const vmaf = sample.vmafScore.toFixed(1);
    const psnr = sample.psnrScore?.toFixed(1) ?? '-';
    const ssim = sample.ssimScore?.toFixed(3) ?? '-';
    lines.push(`| ${timestamp} | ${vmaf} | ${psnr} | ${ssim} |`);
  });

  lines.push('');
  lines.push('## 建议');
  lines.push('');

  if (result.averageVmaf >= VMAF_QUALITY_THRESHOLDS.excellent) {
    lines.push('✅ 视频质量优秀，无需调整编码参数。');
  } else if (result.averageVmaf >= VMAF_QUALITY_THRESHOLDS.good) {
    lines.push('✅ 视频质量良好，适合大多数用途。');
  } else if (result.averageVmaf >= VMAF_QUALITY_THRESHOLDS.fair) {
    lines.push('⚠️ 视频质量一般，建议降低 CRF 值或使用更慢的 preset。');
  } else {
    lines.push('❌ 视频质量较差，建议：');
    lines.push('  - 降低 CRF 值（如从 23 降到 18）');
    lines.push('  - 使用更慢的 preset（如从 medium 改为 slow）');
    lines.push('  - 检查源素材质量');
  }

  return lines.join('\n');
}

/**
 * 创建降级质量报告（当 VMAF 不可用时）
 */
export function createDegradedQualityReport(
  plan: FfmpegExportPlan,
  settings: ExportSettings,
  duration: number,
): VmafMonitoringResult {
  // 基于编码参数估算质量
  const estimatedQuality = estimateQualityFromSettings(settings);

  return {
    mode: 'disabled',
    samples: [],
    averageVmaf: estimatedQuality,
    minVmaf: estimatedQuality,
    maxVmaf: estimatedQuality,
    vmafStdDev: 0,
    qualityRating: getQualityRating(estimatedQuality),
    warnings: ['VMAF 不可用，使用基于编码参数的估算值', '建议安装 libvmaf 以获得精确的质量评估'],
    processingTimeMs: 0,
  };
}

/**
 * 基于编码参数估算质量分数
 */
function estimateQualityFromSettings(settings: ExportSettings): number {
  let score = 70; // 基础分数

  // CRF 影响
  const crf = getCrfFromSettings(settings);
  if (crf !== null) {
    // CRF 越低质量越高
    score += Math.max(0, (23 - crf) * 1.5);
  }

  // 分辨率影响
  const pixels = (settings.width ?? 1920) * (settings.height ?? 1080);
  if (pixels > 1920 * 1080) {
    score += 5; // 4K 加分
  }

  // 帧率影响
  const fps = settings.fps ?? 30;
  if (fps >= 60) {
    score += 3;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * 从设置中提取 CRF 值
 */
function getCrfFromSettings(settings: ExportSettings): number | null {
  // 这里需要从实际的 FFmpeg 参数中提取 CRF
  // 暂时返回默认值
  return 23;
}

/**
 * 获取质量评级
 */
function getQualityRating(score: number): VmafMonitoringResult['qualityRating'] {
  if (score >= VMAF_QUALITY_THRESHOLDS.excellent) return 'excellent';
  if (score >= VMAF_QUALITY_THRESHOLDS.good) return 'good';
  if (score >= VMAF_QUALITY_THRESHOLDS.fair) return 'fair';
  return 'poor';
}

/**
 * 获取质量评级标签
 */
function getQualityRatingLabel(rating: VmafMonitoringResult['qualityRating']): string {
  const labels: Record<VmafMonitoringResult['qualityRating'], string> = {
    excellent: '优秀 (≥90)',
    good: '良好 (≥75)',
    fair: '一般 (≥60)',
    poor: '较差 (<60)',
  };
  return labels[rating];
}

/**
 * 格式化时间戳
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 计算平均值
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * 计算标准差
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = average(values);
  const squaredDiffs = values.map((val) => Math.pow(val - avg, 2));
  return Math.sqrt(average(squaredDiffs));
}
