import { round } from './time';

/** 合规判定级别 */
export type ComplianceLevel = 'pass' | 'warn' | 'fail';

/** 单项检查结果 */
export interface ComplianceCheckResult {
  name: string;
  level: ComplianceLevel;
  message: string;
  /** 可自动修复的操作 */
  autoFix?: ComplianceAutoFix;
}

/** 自动修复操作 */
export interface ComplianceAutoFix {
  type: 'loudness' | 'codec-suggest' | 'duration-notify';
  /** 修复参数 */
  params: Record<string, unknown>;
  /** 用户确认描述 */
  confirmMessage?: string;
}

/** 广播规格定义 */
export interface BroadcastSpec {
  id: string;
  name: string;
  description: string;
  videoCodec?: string[];
  videoCodecProfile?: string;
  videoBitrateMinMbps?: number;
  videoBitrateMaxMbps?: number;
  width?: number;
  height?: number;
  aspectRatio?: string;
  fps?: number;
  fpsTolerance?: number;
  audioCodec?: string[];
  audioBitrateMinKbps?: number;
  audioChannels?: number;
  loudnessTargetLufs?: number;
  loudnessToleranceLu?: number;
  truePeakMaxDbtp?: number;
  maxDurationSec?: number;
  subtitleFormat?: string;
  colorSpace?: string;
}

/** 导出参数快照（用于合规检查） */
export interface ExportComplianceParams {
  videoCodec?: string;
  videoProfile?: string;
  videoBitrateMbps?: number;
  width?: number;
  height?: number;
  fps?: number;
  audioCodec?: string;
  audioBitrateKbps?: number;
  audioChannels?: number;
  loudnessLufs?: number;
  truePeakDbtp?: number;
  durationSec?: number;
  subtitleFormat?: string;
  colorSpace?: string;
}

/** 一键修复结果 */
export interface ComplianceFixResult {
  loudnorm?: { enabled: boolean; targetLufs: number };
  codecSuggestion?: string;
  durationOverflowSec?: number;
}

// ── 内置规格库（6 套） ──

export const BUILTIN_BROADCAST_SPECS: readonly BroadcastSpec[] = [
  {
    id: 'netflix-1080p',
    name: 'Netflix 1080p',
    description: 'Netflix HD 交付规格',
    videoCodec: ['h264'],
    videoCodecProfile: 'high',
    videoBitrateMinMbps: 8,
    videoBitrateMaxMbps: 40,
    width: 1920,
    height: 1080,
    fps: 24,
    fpsTolerance: 1,
    audioCodec: ['aac', 'eac3'],
    loudnessTargetLufs: -27,
    loudnessToleranceLu: 2,
    truePeakMaxDbtp: -2,
  },
  {
    id: 'youtube-1080p',
    name: 'YouTube 1080p',
    description: 'YouTube 横版 HD 规格',
    videoCodec: ['h264'],
    videoBitrateMinMbps: 8,
    width: 1920,
    height: 1080,
    audioCodec: ['aac'],
    audioBitrateMinKbps: 128,
    loudnessTargetLufs: -14,
    loudnessToleranceLu: 1,
  },
  {
    id: 'ebu-r103',
    name: 'EBU R103 广播',
    description: 'EBU R103 欧洲广播标准',
    fps: 25,
    fpsTolerance: 0,
    audioCodec: ['aac', 'pcm_s16le', 'pcm_s24le'],
    loudnessTargetLufs: -23,
    loudnessToleranceLu: 1,
    truePeakMaxDbtp: -1,
  },
  {
    id: 'douyin-bilibili',
    name: '抖音/B站',
    description: '国内短视频平台规格',
    videoCodec: ['h264'],
    videoBitrateMinMbps: 6,
    videoBitrateMaxMbps: 10,
    audioCodec: ['aac'],
    loudnessTargetLufs: -14,
    loudnessToleranceLu: 1,
    maxDurationSec: 900,
  },
  {
    id: 'youtube-shorts',
    name: 'YouTube Shorts 竖版',
    description: 'YouTube Shorts 9:16 竖版',
    videoCodec: ['h264'],
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    audioCodec: ['aac'],
    loudnessTargetLufs: -14,
    loudnessToleranceLu: 1,
  },
  {
    id: 'itunes-apple-tv',
    name: 'iTunes/Apple TV',
    description: 'Apple 平台交付规格',
    videoCodec: ['h264', 'prores'],
    audioCodec: ['aac'],
    audioChannels: 2,
    loudnessTargetLufs: -16,
    loudnessToleranceLu: 1,
  },
] as const;

/**
 * 获取所有内置规格 ID 列表。
 */
export function getBuiltinSpecIds(): string[] {
  return BUILTIN_BROADCAST_SPECS.map((s) => s.id);
}

/**
 * 根据 ID 获取内置规格。
 */
export function getBuiltinSpec(id: string): BroadcastSpec | undefined {
  return BUILTIN_BROADCAST_SPECS.find((s) => s.id === id);
}

/**
 * 对导出参数执行完整合规检查。
 */
export function checkCompliance(spec: BroadcastSpec, params: ExportComplianceParams): ComplianceCheckResult[] {
  const results: ComplianceCheckResult[] = [];
  if (spec.videoCodec) results.push(checkVideoCodec(spec, params));
  if (spec.videoBitrateMinMbps !== undefined || spec.videoBitrateMaxMbps !== undefined)
    results.push(checkVideoBitrate(spec, params));
  if (spec.width || spec.height) results.push(checkResolution(spec, params));
  if (spec.fps !== undefined) results.push(checkFps(spec, params));
  if (spec.audioCodec) results.push(checkAudioCodec(spec, params));
  if (spec.audioBitrateMinKbps !== undefined) results.push(checkAudioBitrate(spec, params));
  if (spec.loudnessTargetLufs !== undefined) results.push(checkLoudness(spec, params));
  if (spec.truePeakMaxDbtp !== undefined) results.push(checkTruePeak(spec, params));
  if (spec.maxDurationSec !== undefined) results.push(checkDuration(spec, params));
  if (spec.aspectRatio) results.push(checkAspectRatio(spec, params));
  return results;
}

/**
 * 从合规检查结果中提取一键修复建议。
 */
export function buildComplianceFix(spec: BroadcastSpec, results: ComplianceCheckResult[]): ComplianceFixResult {
  const fix: ComplianceFixResult = {};
  const loudnessResult = results.find((r) => r.autoFix?.type === 'loudness' && r.level === 'fail');
  if (loudnessResult?.autoFix && spec.loudnessTargetLufs !== undefined) {
    fix.loudnorm = { enabled: true, targetLufs: spec.loudnessTargetLufs };
  }
  const codecResult = results.find((r) => r.autoFix?.type === 'codec-suggest');
  if (codecResult?.autoFix) {
    fix.codecSuggestion = codecResult.autoFix.params['suggestedCodec'] as string;
  }
  const durationResult = results.find((r) => r.autoFix?.type === 'duration-notify');
  if (durationResult?.autoFix) {
    fix.durationOverflowSec = durationResult.autoFix.params['overflowSec'] as number;
  }
  return fix;
}

/**
 * 计算时长超出限制的秒数（0 表示未超出）。
 */
export function calculateDurationOverflowSec(duration: number, maxDuration: number): number {
  if (maxDuration <= 0) return 0;
  return round(Math.max(0, duration - maxDuration));
}

// ── 内部检查函数 ──

function checkVideoCodec(spec: BroadcastSpec, params: ExportComplianceParams): ComplianceCheckResult {
  const codec = (params.videoCodec ?? '').toLowerCase();
  const allowed = spec.videoCodec!;
  if (allowed.some((c) => codec.includes(c))) {
    return { name: '视频编码', level: 'pass', message: `${params.videoCodec} 符合要求` };
  }
  return {
    name: '视频编码',
    level: 'fail',
    message: `${params.videoCodec ?? '未设置'} 不符合要求，建议: ${allowed.join('/')}`,
    autoFix: {
      type: 'codec-suggest',
      params: { suggestedCodec: allowed[0] },
      confirmMessage: `建议切换为 ${allowed[0]}，是否确认？`,
    },
  };
}

function checkVideoBitrate(spec: BroadcastSpec, params: ExportComplianceParams): ComplianceCheckResult {
  const bitrate = params.videoBitrateMbps ?? 0;
  const min = spec.videoBitrateMinMbps ?? 0;
  const max = spec.videoBitrateMaxMbps ?? Infinity;
  if (bitrate >= min && bitrate <= max) {
    return { name: '视频码率', level: 'pass', message: `${bitrate} Mbps 符合 ${min}-${max} Mbps` };
  }
  if (bitrate < min * 0.8) {
    return { name: '视频码率', level: 'fail', message: `${bitrate} Mbps 过低，要求 ${min}-${max} Mbps` };
  }
  return { name: '视频码率', level: 'warn', message: `${bitrate} Mbps 接近边界，建议 ${min}-${max} Mbps` };
}

function checkResolution(spec: BroadcastSpec, params: ExportComplianceParams): ComplianceCheckResult {
  const w = params.width ?? 0;
  const h = params.height ?? 0;
  if ((!spec.width || w === spec.width) && (!spec.height || h === spec.height)) {
    return { name: '分辨率', level: 'pass', message: `${w}x${h} 符合要求` };
  }
  return { name: '分辨率', level: 'fail', message: `${w}x${h} 不符合 ${spec.width ?? '*'}x${spec.height ?? '*'}` };
}

function checkFps(spec: BroadcastSpec, params: ExportComplianceParams): ComplianceCheckResult {
  const fps = params.fps ?? 0;
  const target = spec.fps!;
  const tol = spec.fpsTolerance ?? 0.1;
  if (Math.abs(fps - target) <= tol) {
    return { name: '帧率', level: 'pass', message: `${fps}fps 符合 ${target}fps` };
  }
  return { name: '帧率', level: 'fail', message: `${fps}fps 不符合 ${target}fps (容差 ${tol})` };
}

function checkAudioCodec(spec: BroadcastSpec, params: ExportComplianceParams): ComplianceCheckResult {
  const codec = (params.audioCodec ?? '').toLowerCase();
  const allowed = spec.audioCodec!;
  if (allowed.some((c) => codec.includes(c))) {
    return { name: '音频编码', level: 'pass', message: `${params.audioCodec} 符合要求` };
  }
  return {
    name: '音频编码',
    level: 'fail',
    message: `${params.audioCodec ?? '未设置'} 不符合要求，建议: ${allowed.join('/')}`,
    autoFix: {
      type: 'codec-suggest',
      params: { suggestedCodec: allowed[0] },
      confirmMessage: `建议切换为 ${allowed[0]}，是否确认？`,
    },
  };
}

function checkAudioBitrate(spec: BroadcastSpec, params: ExportComplianceParams): ComplianceCheckResult {
  const bitrate = params.audioBitrateKbps ?? 0;
  const min = spec.audioBitrateMinKbps!;
  if (bitrate >= min) {
    return { name: '音频码率', level: 'pass', message: `${bitrate}kbps >= ${min}kbps` };
  }
  return { name: '音频码率', level: 'fail', message: `${bitrate}kbps 低于最低要求 ${min}kbps` };
}

function checkLoudness(spec: BroadcastSpec, params: ExportComplianceParams): ComplianceCheckResult {
  const lufs = params.loudnessLufs ?? 0;
  const target = spec.loudnessTargetLufs!;
  const tol = spec.loudnessToleranceLu ?? 1;
  const diff = Math.abs(lufs - target);
  if (diff <= tol) {
    return { name: '响度', level: 'pass', message: `${lufs} LUFS 符合 ${target} ± ${tol} LUFS` };
  }
  const level: ComplianceLevel = diff <= tol * 2 ? 'warn' : 'fail';
  return {
    name: '响度',
    level,
    message: `${lufs} LUFS 不符合 ${target} ± ${tol} LUFS (偏差 ${round(diff)} LU)`,
    autoFix: { type: 'loudness', params: { targetLufs: target } },
  };
}

function checkTruePeak(spec: BroadcastSpec, params: ExportComplianceParams): ComplianceCheckResult {
  const tp = params.truePeakDbtp ?? 0;
  const max = spec.truePeakMaxDbtp!;
  if (tp <= max) {
    return { name: 'True Peak', level: 'pass', message: `${tp} dBTP <= ${max} dBTP` };
  }
  return { name: 'True Peak', level: 'fail', message: `${tp} dBTP 超过限制 ${max} dBTP` };
}

function checkDuration(spec: BroadcastSpec, params: ExportComplianceParams): ComplianceCheckResult {
  const duration = params.durationSec ?? 0;
  const max = spec.maxDurationSec!;
  const overflow = calculateDurationOverflowSec(duration, max);
  if (overflow === 0) {
    return { name: '时长限制', level: 'pass', message: `${round(duration)}s <= ${max}s` };
  }
  return {
    name: '时长限制',
    level: 'warn',
    message: `超出 ${round(overflow)}s (${round(duration)}s / 上限 ${max}s)`,
    autoFix: { type: 'duration-notify', params: { overflowSec: overflow } },
  };
}

function checkAspectRatio(spec: BroadcastSpec, params: ExportComplianceParams): ComplianceCheckResult {
  const w = params.width ?? 0;
  const h = params.height ?? 0;
  const expected = spec.aspectRatio!;
  const actual = w > 0 && h > 0 ? simplifyRatio(w, h) : '未知';
  if (actual === expected) {
    return { name: '宽高比', level: 'pass', message: `${actual} 符合 ${expected}` };
  }
  return { name: '宽高比', level: 'fail', message: `${actual} 不符合 ${expected}` };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function simplifyRatio(w: number, h: number): string {
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}
