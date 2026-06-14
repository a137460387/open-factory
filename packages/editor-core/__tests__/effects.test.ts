import { describe, expect, it } from 'vitest';
import { DEFAULT_EFFECT_PARAMS, cloneEffects, normalizeAudioSpectrumParams, normalizeEffect, normalizeEffectParams, normalizeEffects } from '../src';

describe('effect stack helpers', () => {
  it('normalizes a valid effect with default params', () => {
    expect(normalizeEffect({ id: 'effect-blur', type: 'blur' })).toEqual({
      id: 'effect-blur',
      type: 'blur',
      enabled: true,
      params: DEFAULT_EFFECT_PARAMS.blur
    });
  });

  it('skips invalid effects and returns undefined for an empty stack', () => {
    expect(normalizeEffect({ id: 'missing-type' })).toBeUndefined();
    expect(normalizeEffect({ id: 'bad-type', type: 'glitch' as never })).toBeUndefined();
    expect(normalizeEffects([{ id: 'bad-type', type: 'glitch' as never }])).toBeUndefined();
  });

  it('clamps built-in effect params to their supported ranges', () => {
    expect(normalizeEffectParams('blur', { radius: 99 })).toEqual({ radius: 50 });
    expect(normalizeEffectParams('sharpen', { strength: -1 })).toEqual({ strength: 0 });
    expect(normalizeEffectParams('vignette', { intensity: -1, radius: 2 })).toEqual({ intensity: 0, radius: 1 });
    expect(normalizeEffectParams('film-grain', { strength: 2, size: 9 })).toEqual({ strength: 1, size: 5 });
    expect(normalizeEffectParams('chromatic-aberration', { strength: 99 })).toEqual({ strength: 20 });
  });

  it('normalizes audio spectrum params with string options and clamped numeric ranges', () => {
    expect(
      normalizeEffect({
        id: 'effect-spectrum',
        type: 'audio-spectrum',
        params: { style: 'waveform', color: 'FFAA00', colorEnd: '00AAFF', height: 99, position: 'top', sensitivity: 9, mirror: 'true' }
      })
    ).toEqual({
      id: 'effect-spectrum',
      type: 'audio-spectrum',
      enabled: true,
      params: { style: 'waveform', color: '#ffaa00', colorStart: '#ffaa00', colorEnd: '#00aaff', height: 50, position: 'top', sensitivity: 4, mirror: true }
    });
    expect(normalizeAudioSpectrumParams({ style: 'bad', color: 'not-a-color', height: -5, position: 'middle', sensitivity: 0 })).toEqual({
      style: 'bars',
      color: '#22d3ee',
      colorStart: '#22d3ee',
      colorEnd: '#22d3ee',
      height: 0,
      position: 'bottom',
      sensitivity: 0.1,
      mirror: false
    });
    expect(normalizeAudioSpectrumParams({ style: 'circle', colorStart: '#123456', colorEnd: '#abcdef', mirror: 1 })).toEqual({
      style: 'circular',
      color: '#123456',
      colorStart: '#123456',
      colorEnd: '#abcdef',
      height: 25,
      position: 'bottom',
      sensitivity: 1,
      mirror: true
    });
  });

  it('clones normalized effect stacks without sharing normalized objects', () => {
    const effects = cloneEffects([{ id: ' effect-vignette ', type: 'vignette', enabled: false, params: { intensity: 0.8 } }]);

    expect(effects).toEqual([
      {
        id: 'effect-vignette',
        type: 'vignette',
        enabled: false,
        params: { intensity: 0.8, radius: DEFAULT_EFFECT_PARAMS.vignette.radius }
      }
    ]);
    expect(cloneEffects(undefined)).toBeUndefined();
  });
});
