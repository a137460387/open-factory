import { describe, it, expect } from 'vitest';
import {
  createDefaultHSLQualifierParams,
  validateHSLQualifierParams,
  generateHSLQualifierGLSL,
  toFfmpegSelectiveColor,
} from '../../src/color-grading/hsl-qualifier';
import type { HSLQualifierParams } from '../../src/color-grading/hsl-qualifier';

describe('createDefaultHSLQualifierParams', () => {
  it('should return valid defaults', () => {
    const params = createDefaultHSLQualifierParams();
    expect(params.hueRange.center).toBe(0);
    expect(params.hueRange.width).toBe(120);
    expect(params.saturationRange.min).toBe(20);
    expect(params.saturationRange.max).toBe(100);
    expect(params.luminanceRange.min).toBe(10);
    expect(params.luminanceRange.max).toBe(90);
    expect(params.adjustments.hueShift).toBe(0);
    expect(params.viewMode).toBe('final');
    expect(params.matteClean).toBe(0);
  });

  it('should have all adjustment fields at zero', () => {
    const params = createDefaultHSLQualifierParams();
    expect(params.adjustments.saturation).toBe(0);
    expect(params.adjustments.brightness).toBe(0);
    expect(params.adjustments.contrast).toBe(0);
    expect(params.adjustments.temperature).toBe(0);
    expect(params.adjustments.tint).toBe(0);
  });

  it('should have softness values at 10', () => {
    const params = createDefaultHSLQualifierParams();
    expect(params.hueRange.softness).toBe(10);
    expect(params.saturationRange.softness).toBe(10);
    expect(params.luminanceRange.softness).toBe(10);
  });
});

describe('validateHSLQualifierParams', () => {
  it('should clamp values to valid ranges', () => {
    const params = createDefaultHSLQualifierParams();
    params.hueRange.center = 400;
    params.saturationRange.min = -10;
    params.luminanceRange.max = 150;
    params.adjustments.hueShift = 200;
    params.matteClean = 200;

    const validated = validateHSLQualifierParams(params);
    expect(validated.hueRange.center).toBe(360);
    expect(validated.saturationRange.min).toBe(0);
    expect(validated.luminanceRange.max).toBe(100);
    expect(validated.adjustments.hueShift).toBe(180);
    expect(validated.matteClean).toBe(100);
  });

  it('should handle negative clamps', () => {
    const params = createDefaultHSLQualifierParams();
    params.adjustments.hueShift = -200;
    params.adjustments.saturation = -150;

    const validated = validateHSLQualifierParams(params);
    expect(validated.adjustments.hueShift).toBe(-180);
    expect(validated.adjustments.saturation).toBe(-100);
  });

  it('should preserve valid values', () => {
    const params = createDefaultHSLQualifierParams();
    params.hueRange.center = 180;
    params.adjustments.brightness = 50;

    const validated = validateHSLQualifierParams(params);
    expect(validated.hueRange.center).toBe(180);
    expect(validated.adjustments.brightness).toBe(50);
  });

  it('should clamp softness values', () => {
    const params = createDefaultHSLQualifierParams();
    params.hueRange.softness = 100;
    params.saturationRange.softness = -5;

    const validated = validateHSLQualifierParams(params);
    expect(validated.hueRange.softness).toBe(50);
    expect(validated.saturationRange.softness).toBe(0);
  });

  it('should enforce minimum hue width of 1', () => {
    const params = createDefaultHSLQualifierParams();
    params.hueRange.width = 0;

    const validated = validateHSLQualifierParams(params);
    expect(validated.hueRange.width).toBe(1);
  });

  it('should clamp contrast, temperature, and tint', () => {
    const params = createDefaultHSLQualifierParams();
    params.adjustments.contrast = 150;
    params.adjustments.temperature = -200;
    params.adjustments.tint = 200;

    const validated = validateHSLQualifierParams(params);
    expect(validated.adjustments.contrast).toBe(100);
    expect(validated.adjustments.temperature).toBe(-100);
    expect(validated.adjustments.tint).toBe(100);
  });

  it('should clamp luminanceRange min and max', () => {
    const params = createDefaultHSLQualifierParams();
    params.luminanceRange.min = -20;
    params.luminanceRange.max = 200;

    const validated = validateHSLQualifierParams(params);
    expect(validated.luminanceRange.min).toBe(0);
    expect(validated.luminanceRange.max).toBe(100);
  });

  it('should clamp saturationRange max downward', () => {
    const params = createDefaultHSLQualifierParams();
    params.saturationRange.max = 150;

    const validated = validateHSLQualifierParams(params);
    expect(validated.saturationRange.max).toBe(100);
  });

  it('should clamp luminanceRange softness', () => {
    const params = createDefaultHSLQualifierParams();
    params.luminanceRange.softness = 80;

    const validated = validateHSLQualifierParams(params);
    expect(validated.luminanceRange.softness).toBe(50);
  });

  it('should preserve viewMode', () => {
    const params = createDefaultHSLQualifierParams();
    params.viewMode = 'matte';

    const validated = validateHSLQualifierParams(params);
    expect(validated.viewMode).toBe('matte');
  });

  it('should return a new object (immutable)', () => {
    const params = createDefaultHSLQualifierParams();

    const validated = validateHSLQualifierParams(params);

    expect(validated).not.toBe(params);
    expect(validated.hueRange).not.toBe(params.hueRange);
    expect(validated.adjustments).not.toBe(params.adjustments);
  });

  it('should keep exact boundary values', () => {
    const params = createDefaultHSLQualifierParams();
    params.hueRange.center = 0;
    params.hueRange.width = 360;
    params.hueRange.softness = 0;
    params.saturationRange.min = 0;
    params.saturationRange.max = 100;
    params.matteClean = 0;

    const validated = validateHSLQualifierParams(params);
    expect(validated.hueRange.center).toBe(0);
    expect(validated.hueRange.width).toBe(360);
    expect(validated.hueRange.softness).toBe(0);
    expect(validated.saturationRange.min).toBe(0);
    expect(validated.saturationRange.max).toBe(100);
    expect(validated.matteClean).toBe(0);
  });
});

describe('generateHSLQualifierGLSL', () => {
  it('should generate GLSL with given prefix', () => {
    const glsl = generateHSLQualifierGLSL('hsl_q');
    expect(glsl).toContain('uniform vec3 hsl_q_hueRange');
    expect(glsl).toContain('uniform vec3 hsl_q_satRange');
    expect(glsl).toContain('uniform vec3 hsl_q_lumRange');
    expect(glsl).toContain('hslQualifierMask');
    expect(glsl).toContain('applyHSLQualifier');
  });

  it('should contain smoothstep for hue matching', () => {
    const glsl = generateHSLQualifierGLSL('test');
    expect(glsl).toContain('smoothstep');
    expect(glsl).toContain('hueDist');
  });

  it('should include adjustment uniforms', () => {
    const glsl = generateHSLQualifierGLSL('cg');
    expect(glsl).toContain('uniform vec3 cg_adjustments1');
    expect(glsl).toContain('uniform vec3 cg_adjustments2');
    expect(glsl).toContain('uniform float cg_matteClean');
  });

  it('should handle hue wrapping in GLSL', () => {
    const glsl = generateHSLQualifierGLSL('p');
    expect(glsl).toContain('min(hueDist, 360.0 - hueDist)');
  });

  it('should return a non-empty string', () => {
    const glsl = generateHSLQualifierGLSL('x');
    expect(glsl.length).toBeGreaterThan(0);
  });
});

describe('toFfmpegSelectiveColor', () => {
  it('should return empty string for zero adjustments', () => {
    const params = createDefaultHSLQualifierParams();
    expect(toFfmpegSelectiveColor(params)).toBe('');
  });

  it('should generate selectivecolor filter when adjustments are non-zero', () => {
    const params = createDefaultHSLQualifierParams();
    params.adjustments.hueShift = 50;
    params.adjustments.saturation = 30;

    const filter = toFfmpegSelectiveColor(params);
    expect(filter).toContain('selectivecolor=');
    expect(filter).toContain('reds=0.5');
    expect(filter).toContain('yellows=0.3');
  });

  it('should return non-empty when only brightness is non-zero', () => {
    const params = createDefaultHSLQualifierParams();
    params.adjustments.brightness = 50;

    const filter = toFfmpegSelectiveColor(params);
    // brightness is non-zero so the early-return guard does not trigger
    expect(filter).toContain('selectivecolor=');
    expect(filter).toContain('reds=0');
    expect(filter).toContain('yellows=0');
  });

  it('should return empty when all adjustments are zero including after clamping', () => {
    const params = createDefaultHSLQualifierParams();
    params.adjustments.hueShift = 0;
    params.adjustments.saturation = 0;
    params.adjustments.brightness = 0;

    expect(toFfmpegSelectiveColor(params)).toBe('');
  });

  it('should compute correct values for negative hueShift', () => {
    const params = createDefaultHSLQualifierParams();
    params.adjustments.hueShift = -100;
    params.adjustments.saturation = 0;
    params.adjustments.brightness = 0;

    const filter = toFfmpegSelectiveColor(params);
    expect(filter).toContain('reds=-1');
    expect(filter).toContain('yellows=0');
  });
});
