import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPATIAL_AUDIO,
  calculateSpatialDistanceGain,
  isDefaultSpatialAudio,
  mapSpatialXToPanGains,
  normalizeSpatialAudio
} from '../src';

describe('spatial audio', () => {
  it('normalizes clip spatial audio position and distance fallback', () => {
    expect(normalizeSpatialAudio({ x: -2, y: 0.25, z: 9, distance: 'invalid' as never })).toEqual({
      x: -1,
      y: 0.25,
      z: 1,
      distance: 'medium'
    });
    expect(isDefaultSpatialAudio(undefined)).toBe(true);
    expect(isDefaultSpatialAudio(DEFAULT_SPATIAL_AUDIO)).toBe(true);
    expect(isDefaultSpatialAudio({ x: 0.1 })).toBe(false);
  });

  it('calculates distance attenuation by falloff preset', () => {
    const position = { x: 1, y: 1, z: 1 } as const;

    const near = calculateSpatialDistanceGain({ ...position, distance: 'near' });
    const medium = calculateSpatialDistanceGain({ ...position, distance: 'medium' });
    const far = calculateSpatialDistanceGain({ ...position, distance: 'far' });

    expect(near).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(far);
    expect(far).toBeGreaterThanOrEqual(0.2);
  });

  it('maps horizontal position to stereo pan gains', () => {
    expect(mapSpatialXToPanGains(-1)).toEqual({ left: 1, right: 0 });
    expect(mapSpatialXToPanGains(0)).toEqual({ left: 1, right: 1 });
    expect(mapSpatialXToPanGains(1)).toEqual({ left: 0, right: 1 });
  });
});
