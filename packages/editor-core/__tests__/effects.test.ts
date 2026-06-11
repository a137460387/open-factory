import { describe, expect, it } from 'vitest';
import { DEFAULT_EFFECT_PARAMS, cloneEffects, normalizeEffect, normalizeEffectParams, normalizeEffects } from '../src';

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
