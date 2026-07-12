import { describe, it, expect } from 'vitest';
import { PrimaryWheels } from '../../src/color-grading/primary-wheels';
import { createDefaultPrimaryWheelParams } from '../../src/color-grading/types';

describe('PrimaryWheels.toUniforms', () => {
  it('should convert default params to zero uniforms', () => {
    const params = createDefaultPrimaryWheelParams();
    const uniforms = PrimaryWheels.toUniforms(params, 'test');
    expect(uniforms['test_lift']).toEqual([0, 0, 0, 0]);
    expect(uniforms['test_gamma']).toEqual([0, 0, 0, 0]);
    expect(uniforms['test_gain']).toEqual([0, 0, 0, 0]);
    expect(uniforms['test_offset']).toEqual([0, 0, 0, 0]);
  });

  it('should convert non-zero params correctly', () => {
    const params = createDefaultPrimaryWheelParams();
    params.lift.r = 0.5;
    params.gain.g = -0.3;
    params.gammaMaster = 0.2;

    const uniforms = PrimaryWheels.toUniforms(params, 'pw');
    expect(uniforms['pw_lift'][0]).toBe(0.5);
    expect(uniforms['pw_gain'][1]).toBe(-0.3);
    expect(uniforms['pw_gamma'][3]).toBe(0.2);
  });
});

describe('PrimaryWheels.toGlslSnippet', () => {
  it('should generate GLSL function call', () => {
    const snippet = PrimaryWheels.toGlslSnippet('pw');
    expect(snippet).toContain('applyLiftGammaGain');
    expect(snippet).toContain('pw_lift');
    expect(snippet).toContain('pw_gamma');
    expect(snippet).toContain('pw_gain');
    expect(snippet).toContain('pw_offset');
  });
});

describe('PrimaryWheels.toFfmpegFilter', () => {
  it('should return empty string for default params', () => {
    const params = createDefaultPrimaryWheelParams();
    const filter = PrimaryWheels.toFfmpegFilter(params);
    expect(filter).toBe('');
  });

  it('should generate colorbalance filter for lift/gamma/gain', () => {
    const params = createDefaultPrimaryWheelParams();
    params.lift.r = 0.5;
    params.gain.b = -0.3;

    const filter = PrimaryWheels.toFfmpegFilter(params);
    expect(filter).toContain('colorbalance');
    expect(filter).toContain('rs='); // red shadows (lift)
  });

  it('should generate curves filter for offset', () => {
    const params = createDefaultPrimaryWheelParams();
    params.offset.r = 0.2;

    const filter = PrimaryWheels.toFfmpegFilter(params);
    expect(filter.length).toBeGreaterThan(0);
  });
});

describe('PrimaryWheels.generateGlslFunction', () => {
  it('should generate valid GLSL function', () => {
    const glsl = PrimaryWheels.generateGlslFunction();
    expect(glsl).toContain('vec4 applyLiftGammaGain');
    expect(glsl).toContain('lift');
    expect(glsl).toContain('gamma');
    expect(glsl).toContain('gain');
    expect(glsl).toContain('offset');
  });
});
