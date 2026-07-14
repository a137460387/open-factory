import type { ClipSlowMotionMode } from '../model-types';

export type FrameInterpolationCompareMode = 'original' | 'blend' | 'mci' | 'optical-flow';

export const FRAME_INTERPOLATION_COMPARE_MODES: readonly FrameInterpolationCompareMode[] = [
  'original',
  'blend',
  'mci',
  'optical-flow',
];

export const FRAME_INTERPOLATION_ESTIMATE_COEFFICIENTS: Record<FrameInterpolationCompareMode, number> = {
  original: 0.3,
  blend: 0.9,
  mci: 1.8,
  'optical-flow': 2.4,
};

export function buildFrameInterpolationCompareArgs(mode: FrameInterpolationCompareMode, targetFps: number): string[] {
  const fps = Math.max(1, Math.round(Number.isFinite(targetFps) ? targetFps : 30));
  if (mode === 'original') {
    return [];
  }
  if (mode === 'blend') {
    return [`minterpolate=fps=${fps}:mi_mode=blend`];
  }
  if (mode === 'mci') {
    return [`minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc`];
  }
  return [`minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1`];
}

export function estimateFrameInterpolationModeDurationMs(
  frameCount: number,
  mode: FrameInterpolationCompareMode,
): number {
  const safeFrameCount = Math.max(0, Math.round(Number.isFinite(frameCount) ? frameCount : 0));
  return Math.round(safeFrameCount * FRAME_INTERPOLATION_ESTIMATE_COEFFICIENTS[mode]);
}

export function frameInterpolationCompareModeToSlowMotionMode(mode: FrameInterpolationCompareMode): ClipSlowMotionMode {
  if (mode === 'blend') {
    return 'blend';
  }
  if (mode === 'mci') {
    return 'mci';
  }
  if (mode === 'optical-flow') {
    return 'optical-flow';
  }
  return 'none';
}

export function buildFrameInterpolationCompareFrameTimes(
  clipStart: number,
  clipDuration: number,
  playheadTime: number,
  fps: number,
): number[] {
  const safeFps = Math.max(1, Math.round(Number.isFinite(fps) ? fps : 30));
  const duration = Math.max(0, Number.isFinite(clipDuration) ? clipDuration : 0);
  const start = Math.max(0, Number.isFinite(clipStart) ? clipStart : 0);
  const end = start + duration;
  const center = Math.min(Math.max(Number.isFinite(playheadTime) ? playheadTime : start, start), Math.max(start, end));
  const frameDuration = 1 / safeFps;
  return [-2, -1, 0, 1, 2].map((offset) => Math.min(end, Math.max(start, roundTime(center + offset * frameDuration))));
}

function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000;
}
