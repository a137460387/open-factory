import { describe, it, expect } from 'vitest';
import {
  createDefaultHSLQualifierParams,
  validateHSLQualifierParams,
  generateHSLQualifierGLSL,
  toFfmpegSelectiveColor,
} from '../../src/color-grading/hsl-qualifier';

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
});
