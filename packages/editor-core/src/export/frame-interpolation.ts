import type { Clip, ClipFrameInterpolation, FrameInterpolationMode, FrameInterpolationQualityGrade } from '../model-types';

export const MIN_FRAME_INTERPOLATION_PROTECTION_FRAMES = 0;
export const MAX_FRAME_INTERPOLATION_PROTECTION_FRAMES = 5;
export const DEFAULT_FRAME_INTERPOLATION_PROTECTION_FRAMES = 2;

export interface SceneProtectionFrameRange {
  startFrame: number;
  endFrame: number;
}

export function clampFrameInterpolationProtectionFrames(value: number | undefined, fallback = DEFAULT_FRAME_INTERPOLATION_PROTECTION_FRAMES): number {
  const safeFallback = Number.isFinite(fallback) ? fallback : DEFAULT_FRAME_INTERPOLATION_PROTECTION_FRAMES;
  const source = typeof value === 'number' && Number.isFinite(value) ? value : safeFallback;
  return Math.min(MAX_FRAME_INTERPOLATION_PROTECTION_FRAMES, Math.max(MIN_FRAME_INTERPOLATION_PROTECTION_FRAMES, Math.round(source)));
}

export function buildSceneBoundaryProtectionRanges(sceneTimes: readonly number[] | undefined, fps: number, duration: number, protectionFrames: number): SceneProtectionFrameRange[] {
  const safeFps = Math.max(1, Math.round(Number.isFinite(fps) ? fps : 30));
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const totalFrames = Math.max(1, Math.ceil(safeDuration * safeFps));
  const radius = clampFrameInterpolationProtectionFrames(protectionFrames);
  if (radius === 0 || !sceneTimes || sceneTimes.length === 0) {
    return [];
  }
  const ranges = sceneTimes
    .filter((time) => Number.isFinite(time) && time > 0 && time < safeDuration)
    .map((time) => {
      const frame = Math.round(time * safeFps);
      return {
        startFrame: Math.max(0, frame - radius),
        endFrame: Math.min(totalFrames - 1, frame + radius)
      };
    })
    .sort((left, right) => left.startFrame - right.startFrame);
  return mergeFrameRanges(ranges);
}

export function isFrameProtectedBySceneBoundary(frameNumber: number, ranges: readonly SceneProtectionFrameRange[]): boolean {
  const frame = Math.max(0, Math.round(Number.isFinite(frameNumber) ? frameNumber : 0));
  return ranges.some((range) => frame >= range.startFrame && frame <= range.endFrame);
}

export function selectAdaptiveFrameInterpolationMode(motionScore: number | undefined): Exclude<FrameInterpolationMode, 'adaptive'> {
  const motion = Math.min(1, Math.max(0, Number.isFinite(motionScore) ? motionScore! : 0.35));
  if (motion < 0.22) {
    return 'blend';
  }
  if (motion < 0.78) {
    return 'mci';
  }
  return 'copy';
}

export function resolveFrameInterpolationMode(mode: FrameInterpolationMode, motionScore?: number): Exclude<FrameInterpolationMode, 'adaptive'> {
  return mode === 'adaptive' ? selectAdaptiveFrameInterpolationMode(motionScore) : mode;
}

export function averageClipMotionScore(clip: Pick<Clip, 'contentAnalysis' | 'motionTrack'>): number | undefined {
  const segmentMotion = clip.contentAnalysis?.segments.map((segment) => segment.motion).filter((value) => Number.isFinite(value));
  if (segmentMotion && segmentMotion.length > 0) {
    return round(segmentMotion.reduce((sum, value) => sum + value, 0) / segmentMotion.length);
  }
  const points = clip.motionTrack ?? [];
  if (points.length < 2) {
    return undefined;
  }
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].dx - points[index - 1].dx, points[index].dy - points[index - 1].dy);
  }
  return round(Math.min(1, total / Math.max(1, points.length - 1)));
}

export function buildFrameInterpolationCacheKey(mediaPath: string, settings: Pick<ClipFrameInterpolation, 'targetFps' | 'mode' | 'protectionFrames'>): string {
  const payload = JSON.stringify({
    mediaPath: normalizeMediaPath(mediaPath),
    targetFps: settings.targetFps,
    mode: settings.mode,
    protectionFrames: clampFrameInterpolationProtectionFrames(settings.protectionFrames)
  });
  return `interp-${hashString(payload)}`;
}

export function frameInterpolationCacheDir(appDataDir: string): string {
  return `${appDataDir.replace(/[\\/]+$/, '')}/interp-cache`;
}

export function frameInterpolationCachePath(appDataDir: string, mediaPath: string, settings: Pick<ClipFrameInterpolation, 'targetFps' | 'mode' | 'protectionFrames'>): string {
  return `${frameInterpolationCacheDir(appDataDir)}/${buildFrameInterpolationCacheKey(mediaPath, settings)}`;
}

export function mapSsimToFrameInterpolationQualityGrade(ssim: number | undefined): FrameInterpolationQualityGrade {
  if (!Number.isFinite(ssim)) {
    return 'poor';
  }
  if (ssim! > 0.98) {
    return 'excellent';
  }
  if (ssim! >= 0.9) {
    return 'good';
  }
  return 'poor';
}

export function collectMissingInterpolationFrames(totalFrameCount: number, existingFrameNumbers: Iterable<number>): number[] {
  const total = Math.max(0, Math.round(Number.isFinite(totalFrameCount) ? totalFrameCount : 0));
  const existing = new Set(Array.from(existingFrameNumbers, (value) => Math.max(0, Math.round(value))).filter((value) => value >= 0 && value < total));
  const missing: number[] = [];
  for (let frame = 0; frame < total; frame += 1) {
    if (!existing.has(frame)) {
      missing.push(frame);
    }
  }
  return missing;
}

function mergeFrameRanges(ranges: SceneProtectionFrameRange[]): SceneProtectionFrameRange[] {
  const merged: SceneProtectionFrameRange[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.startFrame <= previous.endFrame + 1) {
      previous.endFrame = Math.max(previous.endFrame, range.endFrame);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function normalizeMediaPath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/\/+/g, '/').toLocaleLowerCase();
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
