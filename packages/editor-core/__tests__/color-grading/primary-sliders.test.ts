import { describe, it, expect } from 'vitest';
import { PrimarySliders } from '../../src/color-grading/primary-sliders';
import { createDefaultPrimarySliderParams } from '../../src/color-grading/types';

describe('PrimarySliders.toUniforms', () => {
  it('should convert default params to uniforms', () => {
    const params = createDefaultPrimarySliderParams();
    const uniforms = PrimarySliders.toUniforms(params, 'ps');
    expect(uniforms['ps_temperature']).toBe(0);
    expect(uniforms['ps_saturation']).toBe(1);
  });

  it('should normalize values correctly', () => {
    const params = createDefaultPrimarySliderParams();
    params.temperature = 50;
    params.saturation = 150;
    params.hue = 90;

    const uniforms = PrimarySliders.toUniforms(params, 'ps');
    expect(uniforms['ps_temperature']).toBe(0.5);
    expect(uniforms['ps_saturation']).toBe(1.5);
    expect(uniforms['ps_hue']).toBeCloseTo(Math.PI / 2, 5);
  });
});

describe('PrimarySliders.toGlslSnippet', () => {
  it('should generate GLSL snippet', () => {
    const snippet = PrimarySliders.toGlslSnippet('ps');
    expect(snippet).toContain('applyTemperatureTint');
    expect(snippet).toContain('applyContrast');
    expect(snippet).toContain('applySaturation');
    expect(snippet).toContain('applyHueRotation');
  });
});

describe('PrimarySliders.toFfmpegFilter', () => {
  it('should return empty string for defaults', () => {
    const params = createDefaultPrimarySliderParams();
    const filter = PrimarySliders.toFfmpegFilter(params);
    expect(filter).toBe('');
  });

  it('should generate eq filter for contrast/saturation', () => {
    const params = createDefaultPrimarySliderParams();
    params.contrast = 30;
    params.saturation = 120;

    const filter = PrimarySliders.toFfmpegFilter(params);
    expect(filter).toContain('eq=');
  });

  it('should generate colortemperature for temperature', () => {
    const params = createDefaultPrimarySliderParams();
    params.temperature = 50;

    const filter = PrimarySliders.toFfmpegFilter(params);
    expect(filter).toContain('colortemperature');
  });

  it('should generate hue filter for hue rotation', () => {
    const params = createDefaultPrimarySliderParams();
    params.hue = 45;

    const filter = PrimarySliders.toFfmpegFilter(params);
    expect(filter).toContain('hue=');
  });
});
