import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPATIAL_AUDIO,
  buildKemarHrtfPath,
  buildRoomImpulseResponsePath,
  buildSofalizerArgs,
  calculateSpatialDistanceGain,
  isDefaultSpatialAudio,
  mapSpatialXToPanGains,
  normalizeSpatialAudio,
  resolveKemarHrtfGridSample,
  resolveSpatialAudioPreviewMode,
  resolveSpatialCartesianPosition,
  shouldCopyKemarHrtfAsset
} from '../src';

describe('spatial audio', () => {
  it('normalizes clip spatial audio position and distance fallback', () => {
    expect(normalizeSpatialAudio({ x: -2, y: 0.25, z: 9, distance: 'invalid' as never })).toEqual({
      x: -1,
      y: 0.25,
      z: 1,
      distance: 'medium',
      azimuth: 0,
      elevation: 0,
      distanceMeters: 1,
      renderMode: 'panner',
      roomModel: 'none'
    });
    expect(normalizeSpatialAudio({ azimuth: 270, elevation: 120, distanceMeters: -5, renderMode: 'binaural', roomModel: 'hall' })).toMatchObject({
      azimuth: -90,
      elevation: 90,
      distanceMeters: 0.1,
      renderMode: 'binaural',
      roomModel: 'hall'
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

  it('calculates KEMAR HRTF interpolation neighbors for non-grid angles', () => {
    const sample = resolveKemarHrtfGridSample({ azimuth: 92, elevation: 11 });

    expect(sample.azimuth.lowerIndex).toBe(18);
    expect(sample.azimuth.upperIndex).toBe(19);
    expect(sample.azimuth.nearestIndex).toBe(18);
    expect(sample.azimuth.weight).toBeCloseTo(0.4);
    expect(sample.elevation.upperIndex).toBe(sample.elevation.lowerIndex + 1);
    expect(sample.elevation.weight).toBeGreaterThan(0);
    expect(sample.elevation.weight).toBeLessThan(1);
  });

  it('builds HRTF and room IR paths under app data', () => {
    const root = 'C:/Users/Test/AppData/Roaming/open-factory';

    expect(buildKemarHrtfPath(root)).toBe('C:/Users/Test/AppData/Roaming/open-factory/hrtf/kemar.bin');
    expect(buildRoomImpulseResponsePath(root, 'small-room')).toBe('C:/Users/Test/AppData/Roaming/open-factory/hrtf/ir/small-room.wav');
    expect(buildRoomImpulseResponsePath(root, 'hall')).toBe('C:/Users/Test/AppData/Roaming/open-factory/hrtf/ir/hall.wav');
    expect(buildRoomImpulseResponsePath(root, 'outdoor')).toBe('C:/Users/Test/AppData/Roaming/open-factory/hrtf/ir/outdoor.wav');
    expect(buildRoomImpulseResponsePath(root, 'none')).toBeNull();
  });

  it('maps binaural spatial audio to sofalizer args', () => {
    expect(buildSofalizerArgs({ renderMode: 'panner', azimuth: 90 }, 'C:/hrtf/kemar.bin')).toEqual([]);
    expect(buildSofalizerArgs({ renderMode: 'binaural', azimuth: 90, elevation: 12 }, 'C:/hrtf/kemar.bin')).toEqual([
      'sofa=C:/hrtf/kemar.bin',
      'azi=90',
      'ele=12'
    ]);
  });

  it('downgrades binaural preview to panner for stereo output or missing HRTF', () => {
    expect(resolveSpatialAudioPreviewMode({ renderMode: 'binaural' }, { outputChannelCount: 2, hrtfAvailable: true })).toBe('panner');
    expect(resolveSpatialAudioPreviewMode({ renderMode: 'binaural' }, { outputChannelCount: 6, hrtfAvailable: false })).toBe('panner');
    expect(resolveSpatialAudioPreviewMode({ renderMode: 'binaural' }, { outputChannelCount: 6, hrtfAvailable: true })).toBe('binaural');
  });

  it('checks KEMAR file copy trigger conditions', () => {
    expect(shouldCopyKemarHrtfAsset(false, undefined)).toBe(true);
    expect(shouldCopyKemarHrtfAsset(true, 128)).toBe(true);
    expect(shouldCopyKemarHrtfAsset(true, 2 * 1024 * 1024)).toBe(false);
  });

  it('converts binaural angles to a normalized panner position', () => {
    expect(resolveSpatialCartesianPosition({ renderMode: 'binaural', azimuth: 90, elevation: 0, distanceMeters: 10 })).toEqual({ x: 1, y: 0, z: 0 });
  });
});
