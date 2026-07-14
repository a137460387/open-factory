import type { KeyframeEasing } from './model-types';

export type AudioFadeCurveType = 'linear' | 'logarithmic' | 'exponential' | 's-curve';

export const AUDIO_FADE_CURVE_TYPES: readonly AudioFadeCurveType[] = [
  'linear',
  'logarithmic',
  'exponential',
  's-curve',
];

export interface AudioFadeCurveMapping {
  curveType: AudioFadeCurveType;
  ffmpegCurve: string;
  label: string;
}

export const AUDIO_FADE_CURVE_MAPPINGS: readonly AudioFadeCurveMapping[] = [
  { curveType: 'linear', ffmpegCurve: 'tri', label: '线性' },
  { curveType: 'logarithmic', ffmpegCurve: 'log', label: '对数' },
  { curveType: 'exponential', ffmpegCurve: 'exp', label: '指数' },
  { curveType: 's-curve', ffmpegCurve: 'qsin', label: 'S形' },
];

const CURVE_TO_FFMPEG: Record<AudioFadeCurveType, string> = Object.fromEntries(
  AUDIO_FADE_CURVE_MAPPINGS.map((m) => [m.curveType, m.ffmpegCurve]),
) as Record<AudioFadeCurveType, string>;

export function mapAudioFadeCurveToFfmpeg(curve: AudioFadeCurveType): string {
  return CURVE_TO_FFMPEG[curve] ?? 'tri';
}

export function mapFfmpegCurveToAudioFadeCurve(ffmpegCurve: string): AudioFadeCurveType {
  const mapping = AUDIO_FADE_CURVE_MAPPINGS.find((m) => m.ffmpegCurve === ffmpegCurve);
  return mapping?.curveType ?? 'linear';
}

export function getAudioFadeCurveLabel(curve: AudioFadeCurveType): string {
  const mapping = AUDIO_FADE_CURVE_MAPPINGS.find((m) => m.curveType === curve);
  return mapping?.label ?? '线性';
}

export function inferCurveTypeFromHandleAngle(angleDegrees: number): AudioFadeCurveType {
  const normalized = ((angleDegrees % 360) + 360) % 360;
  if (normalized >= 315 || normalized < 45) {
    return 'linear';
  }
  if (normalized >= 45 && normalized < 135) {
    return 'logarithmic';
  }
  if (normalized >= 135 && normalized < 225) {
    return 's-curve';
  }
  return 'exponential';
}

export function getFadeCurveSamplePoints(
  curve: AudioFadeCurveType,
  steps: number = 50,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = evaluateFadeCurve(curve, t);
    points.push({ x: t, y });
  }
  return points;
}

export function evaluateFadeCurve(curve: AudioFadeCurveType, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (curve) {
    case 'linear':
      return clamped;
    case 'logarithmic':
      return Math.log1p(clamped * 9) / Math.log1p(9);
    case 'exponential':
      return (Math.exp(clamped * 2) - 1) / (Math.exp(2) - 1);
    case 's-curve':
      return 0.5 * (1 + Math.sin(Math.PI * (clamped - 0.5)));
  }
}

export function normalizeAudioFadeCurveType(value: unknown): AudioFadeCurveType {
  if (value === 'linear' || value === 'logarithmic' || value === 'exponential' || value === 's-curve') {
    return value;
  }
  return 'linear';
}
