import { describe, expect, it } from 'vitest';
import { applyStyleToClip, calculateStyleSummary, blendNumericStyleValue, normalizeStyleTransferScope } from '../src';
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

  it('returns empty summary for no clips', () => {
    const summary = calculateStyleSummary([]);
    expect(summary.clipCount).toBe(0);
    expect(summary.color.brightness).toEqual({ mean: 0, stddev: 0, count: 0 });
    expect(summary.color.contrast).toEqual({ mean: 0, stddev: 0, count: 0 });
    expect(summary.effects).toEqual([]);
    expect(summary.lutPath).toBeNull();
  });

  it('returns cloned clip when strength is 0', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'source', colorCorrection: { brightness: 0.5 } })
    ]);
    const target = makeVideoClip({ id: 'target', colorCorrection: { brightness: 0 } });
    const applied = applyStyleToClip(target, summary, { strength: 0 });
    expect(applied.colorCorrection.brightness).toBe(0);
  });

  it('returns cloned clip when summary has 0 clips', () => {
    const summary = calculateStyleSummary([]);
    const target = makeVideoClip({ id: 'target', colorCorrection: { brightness: 0.5 } });
    const applied = applyStyleToClip(target, summary, { strength: 100 });
    expect(applied.colorCorrection.brightness).toBe(0.5);
  });

  it('applies full strength style transfer', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'source', colorCorrection: { brightness: 0.5, contrast: 1.5, saturation: 1.5, hue: 20 } })
    ]);
    const target = makeVideoClip({ id: 'target', colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 } });
    const applied = applyStyleToClip(target, summary, { strength: 100 });
    expect(applied.colorCorrection.brightness).toBe(0.5);
    expect(applied.colorCorrection.contrast).toBe(1.5);
    expect(applied.colorCorrection.saturation).toBe(1.5);
    expect(applied.colorCorrection.hue).toBe(20);
  });

  it('handles NaN strength as 100', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'source', colorCorrection: { brightness: 0.5 } })
    ]);
    const target = makeVideoClip({ id: 'target', colorCorrection: { brightness: 0 } });
    const applied = applyStyleToClip(target, summary, { strength: NaN });
    expect(applied.colorCorrection.brightness).toBe(0.5);
  });

  it('summarizes boolean effect params', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'a', effects: [{ id: 'e1', type: 'audio-spectrum', enabled: true, params: { mirror: true } }] }),
      makeVideoClip({ id: 'b', effects: [{ id: 'e2', type: 'audio-spectrum', enabled: true, params: { mirror: true } }] })
    ]);
    expect(summary.effects[0].params.mirror).toEqual({ kind: 'boolean', value: true, count: 2 });
  });

  it('summarizes string effect params', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'a', effects: [{ id: 'e1', type: 'audio-spectrum', enabled: true, params: { style: 'waveform' } }] }),
      makeVideoClip({ id: 'b', effects: [{ id: 'e2', type: 'audio-spectrum', enabled: true, params: { style: 'waveform' } }] })
    ]);
    expect(summary.effects[0].params.style).toEqual({ kind: 'string', value: 'waveform', count: 2 });
  });

  it('handles mixed effect types in summary', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'a', effects: [{ id: 'e1', type: 'blur', enabled: true, params: { radius: 5 } }] }),
      makeVideoClip({ id: 'b', effects: [{ id: 'e2', type: 'sharpen', enabled: false, params: { strength: 2 } }] })
    ]);
    expect(summary.effects.length).toBe(2);
    expect(summary.effects[0].type).toBe('blur');
    expect(summary.effects[1].type).toBe('sharpen');
  });

  it('applies effect style with boolean params', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'source', effects: [{ id: 'e1', type: 'audio-spectrum', enabled: true, params: { mirror: true } }] })
    ]);
    const target = makeVideoClip({ id: 'target', effects: [{ id: 'e2', type: 'audio-spectrum', enabled: false, params: { mirror: false } }] });
    const applied = applyStyleToClip(target, summary, { strength: 100, scope: { color: false, effects: true, lut: false } });
    expect(applied.effects?.[0].params.mirror).toBe(true);
  });

  it('applies effect style with string params', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'source', effects: [{ id: 'e1', type: 'audio-spectrum', enabled: true, params: { style: 'waveform' } }] })
    ]);
    const target = makeVideoClip({ id: 'target', effects: [{ id: 'e2', type: 'audio-spectrum', enabled: false, params: { style: 'bars' } }] });
    const applied = applyStyleToClip(target, summary, { strength: 100, scope: { color: false, effects: true, lut: false } });
    expect(applied.effects?.[0].params.style).toBe('waveform');
  });

  it('preserves untouched effects when strength < 1', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'source', effects: [{ id: 'e1', type: 'sharpen', enabled: true, params: { strength: 5 } }] })
    ]);
    const target = makeVideoClip({
      id: 'target',
      effects: [
        { id: 'e2', type: 'blur', enabled: true, params: { radius: 3 } },
        { id: 'e3', type: 'sharpen', enabled: true, params: { strength: 1 } }
      ]
    });
    const applied = applyStyleToClip(target, summary, { strength: 50, scope: { color: false, effects: true, lut: false } });
    expect(applied.effects?.length).toBe(2);
    expect(applied.effects?.some((e) => e.type === 'blur')).toBe(true);
  });

  it('blends numeric style value correctly', () => {
    expect(blendNumericStyleValue(0, 10, 0.5)).toBe(5);
    expect(blendNumericStyleValue(0, 10, 0)).toBe(0);
    expect(blendNumericStyleValue(0, 10, 1)).toBe(10);
  });

  it('normalizes style transfer scope', () => {
    expect(normalizeStyleTransferScope(undefined)).toEqual({ color: true, effects: true, lut: true });
    expect(normalizeStyleTransferScope({ color: false })).toEqual({ color: false, effects: true, lut: true });
    expect(normalizeStyleTransferScope({ effects: false, lut: false })).toEqual({ color: true, effects: false, lut: false });
  });

  it('handles negative strength clamped to 0', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'source', colorCorrection: { brightness: 0.5 } })
    ]);
    const target = makeVideoClip({ id: 'target', colorCorrection: { brightness: 0 } });
    const applied = applyStyleToClip(target, summary, { strength: -50 });
    expect(applied.colorCorrection.brightness).toBe(0);
  });

  it('applies lut with high strength', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'source', colorCorrection: { lutPath: 'warm.cube' } })
    ]);
    const target = makeVideoClip({ id: 'target', colorCorrection: { lutPath: 'cool.cube' } });
    const applied = applyStyleToClip(target, summary, { strength: 100, scope: { color: false, effects: false, lut: true } });
    expect(applied.colorCorrection.lutPath).toBe('warm.cube');
  });

  it('keeps current lut with low strength', () => {
    const summary = calculateStyleSummary([
      makeVideoClip({ id: 'source', colorCorrection: { lutPath: 'warm.cube' } })
    ]);
    const target = makeVideoClip({ id: 'target', colorCorrection: { lutPath: 'cool.cube' } });
    const applied = applyStyleToClip(target, summary, { strength: 30, scope: { color: false, effects: false, lut: true } });
    expect(applied.colorCorrection.lutPath).toBe('cool.cube');
  });
});
