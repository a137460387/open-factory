import { round } from './time';

export type SpatialAudioDistance = 'near' | 'medium' | 'far';

export interface ClipSpatialAudio {
  x: number;
  y: number;
  z: number;
  distance: SpatialAudioDistance;
}

export const DEFAULT_SPATIAL_AUDIO: ClipSpatialAudio = {
  x: 0,
  y: 0,
  z: 0,
  distance: 'medium'
};

export function normalizeSpatialAudio(input: Partial<ClipSpatialAudio> | undefined): ClipSpatialAudio {
  return {
    x: normalizeAxis(input?.x),
    y: normalizeAxis(input?.y),
    z: normalizeAxis(input?.z),
    distance: normalizeSpatialAudioDistance(input?.distance)
  };
}

export function isDefaultSpatialAudio(input: Partial<ClipSpatialAudio> | undefined): boolean {
  const spatial = normalizeSpatialAudio(input);
  return (
    spatial.x === DEFAULT_SPATIAL_AUDIO.x &&
    spatial.y === DEFAULT_SPATIAL_AUDIO.y &&
    spatial.z === DEFAULT_SPATIAL_AUDIO.z &&
    spatial.distance === DEFAULT_SPATIAL_AUDIO.distance
  );
}

export function calculateSpatialDistanceGain(input: Partial<ClipSpatialAudio> | undefined): number {
  const spatial = normalizeSpatialAudio(input);
  const distance = Math.min(1, Math.hypot(spatial.x, spatial.y, spatial.z) / Math.sqrt(3));
  const attenuation = spatial.distance === 'near' ? 0.18 : spatial.distance === 'far' ? 0.62 : 0.38;
  return round(Math.max(0.2, 1 - distance * attenuation));
}

export function mapSpatialXToPanGains(x: number): { left: number; right: number } {
  const normalized = normalizeAxis(x);
  return {
    left: round(normalized <= 0 ? 1 : 1 - normalized),
    right: round(normalized >= 0 ? 1 : 1 + normalized)
  };
}

function normalizeAxis(value: number | undefined): number {
  return round(Math.min(1, Math.max(-1, typeof value === 'number' && Number.isFinite(value) ? value : 0)));
}

function normalizeSpatialAudioDistance(value: unknown): SpatialAudioDistance {
  return value === 'near' || value === 'far' ? value : 'medium';
}
