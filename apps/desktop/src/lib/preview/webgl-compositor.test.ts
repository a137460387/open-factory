import { describe, expect, it } from 'vitest';
import { DEFAULT_CHROMA_KEY, DEFAULT_COLOR_CORRECTION, type ChromaKey, type ClipMask, type Effect } from '@open-factory/editor-core';
import { buildAcesToneMappingShaderInjection, buildBlendModeShaderInjection, resolveWebGlSourceProcessing } from './webgl-compositor';

describe('WebGL preview compositor bypass processing', () => {
  const effects: Effect[] = [{ id: 'effect-blur', type: 'blur', enabled: true, params: { radius: 6 } }];
  const chromaKey: ChromaKey = { ...DEFAULT_CHROMA_KEY, enabled: true, similarity: 0.3, blend: 0.1 };
  const masks: ClipMask[] = [{ id: 'mask-a', type: 'rect', x: 0.1, y: 0.1, w: 0.5, h: 0.5, inverted: false, feather: 0.1, enabled: true }];

  it('keeps color and effect processing for normal preview draws', () => {
    const result = resolveWebGlSourceProcessing({ inputColorSpace: 'slog2', brightness: 0.25 }, effects, chromaKey, masks, { colorPipeline: 'aces' });

    expect(result.correction.inputColorSpace).toBe('slog2');
    expect(result.correction.brightness).toBe(0.25);
    expect(result.colorPipeline).toBe('aces');
    expect(result.effectParams.blur).toBe(6);
    expect(result.key.enabled).toBe(true);
    expect(result.maskUniforms.count).toBe(1);
  });

  it('keeps cheap effects while disabling expensive low quality passes', () => {
    const result = resolveWebGlSourceProcessing(
      { brightness: 0.25 },
      [
        ...effects,
        { id: 'effect-grain', type: 'film-grain', enabled: true, params: { strength: 0.8 } },
        { id: 'effect-chromatic', type: 'chromatic-aberration', enabled: true, params: { strength: 12 } }
      ],
      chromaKey,
      masks,
      { disabledEffectTypes: ['film-grain', 'chromatic-aberration', 'custom-shader'] }
    );

    expect(result.correction.brightness).toBe(0.25);
    expect(result.effectParams.blur).toBe(6);
    expect(result.effectParams.grain).toBe(0);
    expect(result.effectParams.chromatic).toBe(0);
    expect(result.key.enabled).toBe(true);
  });

  it('resets color, effects, chroma key, and masks for bypass draws', () => {
    const result = resolveWebGlSourceProcessing({ brightness: 0.25 }, effects, chromaKey, masks, { bypassProcessing: true });

    expect(result.correction).toMatchObject(DEFAULT_COLOR_CORRECTION);
    expect(result.colorPipeline).toBe('sdr-srgb');
    expect(result.effectParams).toEqual({ blur: 0, grain: 0, vignette: 0, chromatic: 0, sharpen: 0, motionX: 0, motionY: 0, motionSamples: 0, motionJitter: 0 });
    expect(result.key.enabled).toBe(false);
    expect(result.maskUniforms.count).toBe(0);
  });

  it('resolves motion blur preview vector from enabled effects', () => {
    const result = resolveWebGlSourceProcessing(
      undefined,
      [{ id: 'effect-motion-blur', type: 'motion-blur', enabled: true, params: { intensity: 0.5, angle: 90, samples: 16, jitter: 0.25 } }],
      undefined,
      undefined
    );

    expect(result.effectParams.motionX).toBeCloseTo(0, 4);
    expect(result.effectParams.motionY).toBeCloseTo(12, 4);
    expect(result.effectParams.motionSamples).toBe(16);
    expect(result.effectParams.motionJitter).toBe(2);
  });

  it('injects Hill ACES tone mapping shader code only for ACES preview', () => {
    expect(buildAcesToneMappingShaderInjection('aces')).toContain('hillAcesToneMap');
    expect(buildAcesToneMappingShaderInjection('aces')).toContain('0.0245786');
    expect(buildAcesToneMappingShaderInjection('sdr-srgb')).toBe('');
  });

  it('injects blend mode shader functions for WebGL blend passes', () => {
    const source = buildBlendModeShaderInjection();

    expect(source).toContain('applyBlendMode');
    expect(source).toContain('blendOverlayChannel');
    expect(source).toContain('blendSoftLightChannel');
    expect(source).toContain('abs(base - top)');
    expect(source).toContain('base * top');
  });
});
