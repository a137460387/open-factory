import { describe, expect, it } from 'vitest';
import { applyStyleToClip, calculateStyleSummary } from '../src';
import { makeVideoClip } from './test-utils';

describe('style transfer', () => {
  it('calculates color style summary with mean and standard deviation', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'source-a', colorCorrection: { brightness: 0, contrast: 1, saturation: 1.2, hue: -10 } }),
      makeVideoClip({ id: 'source-b', colorCorrection: { brightness: 0.5, contrast: 1.5, saturation: 1.6, hue: 10 } })
    ]);

    expect(summary.clipCount).toBe(2);
    expect(summary.color.brightness).toEqual({ mean: 0.25, stddev: 0.25, count: 2 });
    expect(summary.color.contrast).toEqual({ mean: 1.25, stddev: 0.25, count: 2 });
    expect(summary.color.saturation).toEqual({ mean: 1.4, stddev: 0.2, count: 2 });
    expect(summary.color.hue).toEqual({ mean: 0, stddev: 10, count: 2 });
  });

  it('blends source style into target clip by strength', () => {
    const summary = calculateStyleSummary([makeVideoClip({ id: 'source', colorCorrection: { brightness: 0.6, contrast: 1.6, saturation: 1.6, hue: 20 } })]);
    const target = makeVideoClip({ id: 'target', colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 } });

    const applied = applyStyleToClip(target, summary, { strength: 50 });

    expect(applied.colorCorrection).toMatchObject({
      brightness: 0.3,
      contrast: 1.3,
      saturation: 1.3,
      hue: 10
    });
  });

  it('applies only selected style scopes', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({
        id: 'source',
        colorCorrection: { brightness: 0.5, lutPath: 'warm-look.cube' },
        effects: [{ id: 'source-sharpen', type: 'sharpen', enabled: true, params: { strength: 2 } }]
      })
    ]);
    const target = makeVideoClip({
      id: 'target',
      colorCorrection: { brightness: -0.2, lutPath: 'cool-look.cube' },
      effects: [{ id: 'target-blur', type: 'blur', enabled: true, params: { radius: 4 } }]
    });

    const lutOnly = applyStyleToClip(target, summary, { strength: 100, scope: { color: false, effects: false, lut: true } });
    expect(lutOnly.colorCorrection.brightness).toBe(-0.2);
    expect(lutOnly.colorCorrection.lutPath).toBe('warm-look.cube');
    expect(lutOnly.effects).toEqual(target.effects);

    const effectsOnly = applyStyleToClip(target, summary, { strength: 100, scope: { color: false, effects: true, lut: false } });
    expect(effectsOnly.colorCorrection.lutPath).toBe('cool-look.cube');
    expect(effectsOnly.effects?.map((effect) => effect.type)).toEqual(['sharpen']);
    expect(effectsOnly.effects?.[0].params).toEqual({ strength: 2 });
  });

  it('summarizes and blends numeric effect params', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'source-a', effects: [{ id: 'blur-a', type: 'blur', enabled: true, params: { radius: 10 } }] }),
      makeVideoClip({ id: 'source-b', effects: [{ id: 'blur-b', type: 'blur', enabled: true, params: { radius: 20 } }] })
    ]);
    const target = makeVideoClip({ id: 'target', effects: [{ id: 'blur-target', type: 'blur', enabled: true, params: { radius: 5 } }] });

    const applied = applyStyleToClip(target, summary, { strength: 50, scope: { color: false, effects: true, lut: false } });

    expect(summary.effects[0]).toMatchObject({ type: 'blur', params: { radius: { kind: 'number', mean: 15, stddev: 5, count: 2 } } });
    expect(applied.effects?.[0]).toMatchObject({ id: 'blur-target', type: 'blur', params: { radius: 10 } });
  });
});
