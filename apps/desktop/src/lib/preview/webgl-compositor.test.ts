import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOR_CORRECTION, type ChromaKey, type ClipMask, type Effect } from '@open-factory/editor-core';
import { resolveWebGlSourceProcessing } from './webgl-compositor';

describe('WebGL preview compositor bypass processing', () => {
  const effects: Effect[] = [{ id: 'effect-blur', type: 'blur', enabled: true, params: { radius: 6 } }];
  const chromaKey: ChromaKey = { enabled: true, color: [0, 255, 0], colors: [[0, 255, 0]], similarity: 0.3, blend: 0.1, spillSuppression: false, erosion: 0 };
  const masks: ClipMask[] = [{ id: 'mask-a', type: 'rect', x: 0.1, y: 0.1, w: 0.5, h: 0.5, inverted: false, feather: 0.1, enabled: true }];

  it('keeps color and effect processing for normal preview draws', () => {
    const result = resolveWebGlSourceProcessing({ inputColorSpace: 'slog2', brightness: 0.25 }, effects, chromaKey, masks);

    expect(result.correction.inputColorSpace).toBe('slog2');
    expect(result.correction.brightness).toBe(0.25);
    expect(result.effectParams.blur).toBe(6);
    expect(result.key.enabled).toBe(true);
    expect(result.maskUniforms.count).toBe(1);
  });

  it('resets color, effects, chroma key, and masks for bypass draws', () => {
    const result = resolveWebGlSourceProcessing({ brightness: 0.25 }, effects, chromaKey, masks, { bypassProcessing: true });

    expect(result.correction).toMatchObject(DEFAULT_COLOR_CORRECTION);
    expect(result.effectParams).toEqual({ blur: 0, grain: 0, vignette: 0, chromatic: 0, sharpen: 0 });
    expect(result.key.enabled).toBe(false);
    expect(result.maskUniforms.count).toBe(0);
  });
});
