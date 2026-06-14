import type { EffectType } from '@open-factory/editor-core';

export type PreviewQualityMode = 'full' | 'half' | 'quarter' | 'audio-only';
export type PreviewSkipFrames = 1 | 2 | 4;

export interface PreviewPerformanceSettings {
  qualityMode: PreviewQualityMode;
  skipFrames: PreviewSkipFrames;
}

export interface PreviewRenderSize {
  width: number;
  height: number;
  scale: number;
}

export const DEFAULT_PREVIEW_PERFORMANCE_SETTINGS: PreviewPerformanceSettings = {
  qualityMode: 'full',
  skipFrames: 1
};

export const PREVIEW_QUALITY_MODES: PreviewQualityMode[] = ['full', 'half', 'quarter', 'audio-only'];
export const PREVIEW_SKIP_FRAME_OPTIONS: PreviewSkipFrames[] = [1, 2, 4];
export const LOW_QUALITY_DISABLED_EFFECTS: EffectType[] = ['film-grain', 'chromatic-aberration', 'custom-shader'];

export function normalizePreviewQualityMode(value: unknown): PreviewQualityMode {
  return value === 'half' || value === 'quarter' || value === 'audio-only' ? value : 'full';
}

export function normalizePreviewSkipFrames(value: unknown): PreviewSkipFrames {
  const numeric = typeof value === 'number' ? value : Number(value);
  return numeric === 2 || numeric === 4 ? numeric : 1;
}

export function normalizePreviewPerformanceSettings(value: unknown): PreviewPerformanceSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_PREVIEW_PERFORMANCE_SETTINGS };
  }
  const input = value as Partial<PreviewPerformanceSettings>;
  return {
    qualityMode: normalizePreviewQualityMode(input.qualityMode),
    skipFrames: normalizePreviewSkipFrames(input.skipFrames)
  };
}

export function getPreviewQualityScale(mode: PreviewQualityMode): number {
  if (mode === 'half') {
    return 0.5;
  }
  if (mode === 'quarter') {
    return 0.25;
  }
  return 1;
}

export function calculatePreviewRenderSize(width: number, height: number, mode: PreviewQualityMode): PreviewRenderSize {
  const scale = getPreviewQualityScale(mode);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  };
}

export function shouldRenderPreviewFrame(isPlaying: boolean, frame: number, skipFrames: PreviewSkipFrames): boolean {
  if (!isPlaying || skipFrames <= 1) {
    return true;
  }
  return Math.max(0, frame) % skipFrames === 0;
}

export function isPreviewAudioOnly(mode: PreviewQualityMode): boolean {
  return mode === 'audio-only';
}

export function isPreviewLowQuality(settings: PreviewPerformanceSettings): boolean {
  return settings.qualityMode !== 'full';
}

export function getDisabledPreviewEffectTypes(settings: PreviewPerformanceSettings): EffectType[] {
  return isPreviewLowQuality(settings) ? LOW_QUALITY_DISABLED_EFFECTS : [];
}
