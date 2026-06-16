import type { EffectType } from '@open-factory/editor-core';

export type PreviewQualityMode = 'full' | 'half' | 'quarter' | 'audio-only';
export type PreviewSkipFrames = 1 | 2 | 4;
export type PreviewAdaptiveQualityStatus = 'full' | 'degraded' | 'low';

export interface PreviewPerformanceSettings {
  qualityMode: PreviewQualityMode;
  skipFrames: PreviewSkipFrames;
  adaptiveEnabled?: boolean;
}

export interface PreviewRenderSize {
  width: number;
  height: number;
  scale: number;
}

export interface PreviewFpsSample {
  timestampMs: number;
  fps: number;
}

export interface PreviewAdaptiveQualityState {
  qualityMode: Exclude<PreviewQualityMode, 'audio-only'>;
  skipFrames: PreviewSkipFrames;
  averageFps: number;
  stableMs: number;
  status: PreviewAdaptiveQualityStatus;
}

export const DEFAULT_PREVIEW_PERFORMANCE_SETTINGS: PreviewPerformanceSettings = {
  qualityMode: 'full',
  skipFrames: 1,
  adaptiveEnabled: true
};

export const DEFAULT_PREVIEW_ADAPTIVE_QUALITY_STATE: PreviewAdaptiveQualityState = {
  qualityMode: 'full',
  skipFrames: 1,
  averageFps: 60,
  stableMs: 0,
  status: 'full'
};

export const PREVIEW_QUALITY_MODES: PreviewQualityMode[] = ['full', 'half', 'quarter', 'audio-only'];
export const PREVIEW_SKIP_FRAME_OPTIONS: PreviewSkipFrames[] = [1, 2, 4];
export const LOW_QUALITY_DISABLED_EFFECTS: EffectType[] = ['film-grain', 'chromatic-aberration', 'custom-shader'];
export const PREVIEW_FPS_WINDOW_MS = 3000;
export const PREVIEW_STABLE_UPGRADE_MS = 3000;

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
    skipFrames: normalizePreviewSkipFrames(input.skipFrames),
    adaptiveEnabled: input.adaptiveEnabled !== false
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

export function resolveEffectivePreviewPerformance(settings: PreviewPerformanceSettings, adaptiveState: PreviewAdaptiveQualityState): PreviewPerformanceSettings {
  const normalized = normalizePreviewPerformanceSettings(settings);
  if (normalized.adaptiveEnabled === false) {
    return normalized;
  }
  return {
    qualityMode: adaptiveState.qualityMode,
    skipFrames: adaptiveState.skipFrames,
    adaptiveEnabled: true
  };
}

export function appendPreviewFpsSample(samples: PreviewFpsSample[], sample: PreviewFpsSample, windowMs = PREVIEW_FPS_WINDOW_MS): PreviewFpsSample[] {
  const fps = Number.isFinite(sample.fps) ? Math.max(0, Math.min(240, sample.fps)) : 0;
  const timestampMs = Number.isFinite(sample.timestampMs) ? sample.timestampMs : 0;
  const cutoff = timestampMs - Math.max(0, windowMs);
  return [...samples, { timestampMs, fps }].filter((item) => item.timestampMs >= cutoff);
}

export function calculatePreviewFpsAverage(samples: PreviewFpsSample[]): number {
  const valid = samples.filter((sample) => Number.isFinite(sample.fps) && sample.fps >= 0);
  if (valid.length === 0) {
    return 0;
  }
  return valid.reduce((total, sample) => total + sample.fps, 0) / valid.length;
}

export function getPreviewAdaptiveQualityStatus(mode: PreviewQualityMode): PreviewAdaptiveQualityStatus {
  if (mode === 'half') {
    return 'degraded';
  }
  if (mode === 'quarter' || mode === 'audio-only') {
    return 'low';
  }
  return 'full';
}

export function resolveAdaptivePreviewPerformance(input: {
  averageFps: number;
  current: PreviewAdaptiveQualityState;
  elapsedMs: number;
  adaptiveEnabled?: boolean;
}): PreviewAdaptiveQualityState {
  const averageFps = Number.isFinite(input.averageFps) ? Math.max(0, input.averageFps) : 0;
  const elapsedMs = Number.isFinite(input.elapsedMs) ? Math.max(0, input.elapsedMs) : 0;
  if (input.adaptiveEnabled === false) {
    return {
      ...DEFAULT_PREVIEW_ADAPTIVE_QUALITY_STATE,
      averageFps,
      status: 'full'
    };
  }
  if (averageFps < 15) {
    return {
      qualityMode: 'quarter',
      skipFrames: 4,
      averageFps,
      stableMs: 0,
      status: 'low'
    };
  }
  if (averageFps <= 25) {
    if (input.current.qualityMode === 'quarter') {
      return maybeUpgradeAdaptivePreview(input.current, averageFps, elapsedMs, 'half', 2);
    }
    return {
      qualityMode: 'half',
      skipFrames: 2,
      averageFps,
      stableMs: 0,
      status: 'degraded'
    };
  }
  if (input.current.qualityMode === 'quarter') {
    return maybeUpgradeAdaptivePreview(input.current, averageFps, elapsedMs, 'half', 2);
  }
  if (input.current.qualityMode === 'half') {
    return maybeUpgradeAdaptivePreview(input.current, averageFps, elapsedMs, 'full', 1);
  }
  return {
    qualityMode: 'full',
    skipFrames: 1,
    averageFps,
    stableMs: 0,
    status: 'full'
  };
}

function maybeUpgradeAdaptivePreview(
  current: PreviewAdaptiveQualityState,
  averageFps: number,
  elapsedMs: number,
  nextQualityMode: Exclude<PreviewQualityMode, 'audio-only'>,
  nextSkipFrames: PreviewSkipFrames
): PreviewAdaptiveQualityState {
  const stableMs = current.stableMs + elapsedMs;
  if (stableMs >= PREVIEW_STABLE_UPGRADE_MS) {
    return {
      qualityMode: nextQualityMode,
      skipFrames: nextSkipFrames,
      averageFps,
      stableMs: 0,
      status: getPreviewAdaptiveQualityStatus(nextQualityMode)
    };
  }
  return {
    ...current,
    averageFps,
    stableMs,
    status: getPreviewAdaptiveQualityStatus(current.qualityMode)
  };
}
