/**
 * Social Media Export Presets
 *
 * Platform-specific encoding presets for B站, YouTube, 抖音/TikTok, 小红书.
 * Pure functions — no side effects, no external dependencies.
 */

// ─── Types ──────────────────────────────────────────────

export type SocialPlatform = 'bilibili' | 'youtube' | 'douyin' | 'tiktok' | 'xiaohongshu';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '21:9' | '3:4';

export interface SocialMediaPreset {
  id: string;
  platform: SocialPlatform;
  label: string;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  fps: number;
  codec: 'h264' | 'h265';
  maxDurationSeconds?: number;
  description: string;
}

export interface UserCustomPreset {
  id: string;
  name: string;
  basePresetId: string;
  overrides: Partial<Omit<SocialMediaPreset, 'id' | 'platform' | 'label'>>;
  createdAt: string;
}

export interface CoverFrameExtractionOptions {
  /** Time in seconds to extract cover frame. Default: auto-select best */
  timeSeconds?: number;
  /** Width of cover image */
  width?: number;
  /** Height of cover image */
  height?: number;
}

export interface SocialExportConfig {
  preset: SocialMediaPreset;
  customPreset?: UserCustomPreset;
  coverFrame?: CoverFrameExtractionOptions;
  outputPath: string;
}

// ─── Platform Presets ──────────────────────────────────

export const SOCIAL_MEDIA_PRESETS: SocialMediaPreset[] = [
  // ── B站 ──
  {
    id: 'bili-1080p',
    platform: 'bilibili',
    label: 'B站 1080p',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    videoBitrateKbps: 6000,
    audioBitrateKbps: 320,
    fps: 30,
    codec: 'h264',
    description: 'B站高清投稿，推荐码率',
  },
  {
    id: 'bili-4k',
    platform: 'bilibili',
    label: 'B站 4K',
    aspectRatio: '16:9',
    width: 3840,
    height: 2160,
    videoBitrateKbps: 20000,
    audioBitrateKbps: 320,
    fps: 30,
    codec: 'h265',
    description: 'B站超高清投稿',
  },
  {
    id: 'bili-vertical',
    platform: 'bilibili',
    label: 'B站竖屏',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    videoBitrateKbps: 4000,
    audioBitrateKbps: 256,
    fps: 30,
    codec: 'h264',
    description: 'B站竖屏视频',
  },
  {
    id: 'bili-square',
    platform: 'bilibili',
    label: 'B站方形',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    videoBitrateKbps: 4000,
    audioBitrateKbps: 256,
    fps: 30,
    codec: 'h264',
    description: 'B站方形视频',
  },

  // ── YouTube ──
  {
    id: 'yt-1080p',
    platform: 'youtube',
    label: 'YouTube 1080p',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    videoBitrateKbps: 8000,
    audioBitrateKbps: 256,
    fps: 30,
    codec: 'h264',
    description: 'YouTube 标准高清',
  },
  {
    id: 'yt-4k',
    platform: 'youtube',
    label: 'YouTube 4K',
    aspectRatio: '16:9',
    width: 3840,
    height: 2160,
    videoBitrateKbps: 35000,
    audioBitrateKbps: 256,
    fps: 30,
    codec: 'h265',
    description: 'YouTube 超高清',
  },
  {
    id: 'yt-shorts',
    platform: 'youtube',
    label: 'YouTube Shorts',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    videoBitrateKbps: 5000,
    audioBitrateKbps: 256,
    fps: 30,
    codec: 'h264',
    maxDurationSeconds: 60,
    description: 'YouTube 短视频（≤60s）',
  },

  // ── 抖音 ──
  {
    id: 'douyin-vertical',
    platform: 'douyin',
    label: '抖音竖屏',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    videoBitrateKbps: 4000,
    audioBitrateKbps: 192,
    fps: 30,
    codec: 'h264',
    maxDurationSeconds: 900,
    description: '抖音标准竖屏（最长15分钟）',
  },
  {
    id: 'douyin-horizontal',
    platform: 'douyin',
    label: '抖音横屏',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    videoBitrateKbps: 6000,
    audioBitrateKbps: 192,
    fps: 30,
    codec: 'h264',
    description: '抖音横屏视频',
  },
  {
    id: 'douyin-square',
    platform: 'douyin',
    label: '抖音方形',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    videoBitrateKbps: 4000,
    audioBitrateKbps: 192,
    fps: 30,
    codec: 'h264',
    description: '抖音方形视频',
  },

  // ── TikTok ──
  {
    id: 'tiktok-vertical',
    platform: 'tiktok',
    label: 'TikTok',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    videoBitrateKbps: 4000,
    audioBitrateKbps: 192,
    fps: 30,
    codec: 'h264',
    maxDurationSeconds: 600,
    description: 'TikTok 标准竖屏',
  },

  // ── 小红书 ──
  {
    id: 'xhs-vertical',
    platform: 'xiaohongshu',
    label: '小红书竖屏',
    aspectRatio: '3:4',
    width: 1080,
    height: 1440,
    videoBitrateKbps: 4000,
    audioBitrateKbps: 192,
    fps: 30,
    codec: 'h264',
    maxDurationSeconds: 900,
    description: '小红书标准竖屏',
  },
  {
    id: 'xhs-square',
    platform: 'xiaohongshu',
    label: '小红书方形',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    videoBitrateKbps: 4000,
    audioBitrateKbps: 192,
    fps: 30,
    codec: 'h264',
    description: '小红书方形视频',
  },
  {
    id: 'xhs-horizontal',
    platform: 'xiaohongshu',
    label: '小红书横屏',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    videoBitrateKbps: 6000,
    audioBitrateKbps: 192,
    fps: 30,
    codec: 'h264',
    description: '小红书横屏视频',
  },
];

// ─── Platform Config ──────────────────────────────────

export const PLATFORM_CONFIG: Record<SocialPlatform, { name: string; icon: string; maxUploadSizeMb: number }> = {
  bilibili: { name: 'B站', icon: '📺', maxUploadSizeMb: 8192 },
  youtube: { name: 'YouTube', icon: '▶️', maxUploadSizeMb: 12288 },
  douyin: { name: '抖音', icon: '🎵', maxUploadSizeMb: 4096 },
  tiktok: { name: 'TikTok', icon: '🎵', maxUploadSizeMb: 4096 },
  xiaohongshu: { name: '小红书', icon: '📕', maxUploadSizeMb: 2048 },
};

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  '16:9': '横屏 16:9',
  '9:16': '竖屏 9:16',
  '1:1': '方形 1:1',
  '4:3': '经典 4:3',
  '21:9': '超宽 21:9',
  '3:4': '竖屏 3:4',
};

// ─── API ──────────────────────────────────────────────

export function getPresetsByPlatform(platform: SocialPlatform): SocialMediaPreset[] {
  return SOCIAL_MEDIA_PRESETS.filter((p) => p.platform === platform);
}

export function getPresetById(id: string): SocialMediaPreset | undefined {
  return SOCIAL_MEDIA_PRESETS.find((p) => p.id === id);
}

export function getAllPlatforms(): SocialPlatform[] {
  return ['bilibili', 'youtube', 'douyin', 'tiktok', 'xiaohongshu'];
}

export function buildFfmpegArgsForPreset(
  preset: SocialMediaPreset,
  inputPath: string,
  outputPath: string,
): string[] {
  const args = [
    '-i', inputPath,
    '-vf', `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2`,
    '-c:v', preset.codec === 'h265' ? 'libx265' : 'libx264',
    '-b:v', `${preset.videoBitrateKbps}k`,
    '-maxrate', `${Math.round(preset.videoBitrateKbps * 1.5)}k`,
    '-bufsize', `${preset.videoBitrateKbps * 2}k`,
    '-c:a', 'aac',
    '-b:a', `${preset.audioBitrateKbps}k`,
    '-r', String(preset.fps),
    '-movflags', '+faststart',
  ];

  if (preset.maxDurationSeconds) {
    args.push('-t', String(preset.maxDurationSeconds));
  }

  args.push(outputPath);
  return args;
}

export function createCustomPreset(
  basePresetId: string,
  name: string,
  overrides: Partial<Omit<SocialMediaPreset, 'id' | 'platform' | 'label'>>,
): UserCustomPreset | undefined {
  const base = getPresetById(basePresetId);
  if (!base) return undefined;

  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    basePresetId,
    overrides,
    createdAt: new Date().toISOString(),
  };
}

export function resolvePresetWithCustom(
  preset: SocialMediaPreset,
  custom?: UserCustomPreset,
): SocialMediaPreset {
  if (!custom?.overrides) return preset;
  return { ...preset, ...custom.overrides, id: preset.id };
}

export function estimateOutputFileSizeMb(preset: SocialMediaPreset, durationSeconds: number): number {
  const totalBitrateKbps = preset.videoBitrateKbps + preset.audioBitrateKbps;
  const bytesPerSecond = (totalBitrateKbps * 1000) / 8;
  return Math.round((bytesPerSecond * durationSeconds) / (1024 * 1024) * 10) / 10;
}

export function validateDurationForPlatform(
  preset: SocialMediaPreset,
  durationSeconds: number,
): { valid: boolean; maxDuration?: number; message?: string } {
  if (!preset.maxDurationSeconds) return { valid: true };
  if (durationSeconds <= preset.maxDurationSeconds) return { valid: true };

  return {
    valid: false,
    maxDuration: preset.maxDurationSeconds,
    message: `${PLATFORM_CONFIG[preset.platform].name} 限制最长 ${preset.maxDurationSeconds}s，当前 ${Math.round(durationSeconds)}s`,
  };
}
