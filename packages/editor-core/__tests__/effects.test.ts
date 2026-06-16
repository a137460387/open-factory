import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CUSTOM_SHADER_SOURCE,
  DEFAULT_EFFECT_PARAMS,
  MANUAL_AUDIO_VISUALIZATION_THEME_ID,
  buildCustomShaderFragmentSource,
  cloneEffects,
  getCustomShaderExample,
  getCustomShaderSource,
  getEffectNumberParam,
  getEffectStringParam,
  normalizeAudioSpectrumParams,
  normalizeCustomShaderParams,
  normalizeEffect,
  normalizeEffectParams,
  normalizeEffects
} from '../src';

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
    expect(normalizeEffectParams('motion-blur', { intensity: 2, angle: -30, samples: 12, jitter: -1 })).toEqual({ intensity: 1, angle: 330, samples: 8, jitter: 0 });
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
      params: {
        style: 'waveform',
        color: '#ffaa00',
        colorStart: '#ffaa00',
        colorEnd: '#00aaff',
        themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
        height: 50,
        position: 'top',
        sensitivity: 4,
        mirror: true
      }
    });
    expect(normalizeAudioSpectrumParams({ style: 'bad', color: 'not-a-color', height: -5, position: 'middle', sensitivity: 0 })).toEqual({
      style: 'bars',
      color: '#22d3ee',
      colorStart: '#22d3ee',
      colorEnd: '#22d3ee',
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
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
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
      height: 25,
      position: 'bottom',
      sensitivity: 1,
      mirror: true
    });
    expect(normalizeAudioSpectrumParams({ themeId: 'retro-vu', colorStart: '#ffffff' })).toMatchObject({
      themeId: 'retro-vu',
      color: '#40d650',
      colorStart: '#40d650',
      colorEnd: '#facc15'
    });
  });

  it('normalizes effect helper params and shader lookups', () => {
    expect(getEffectNumberParam({ strength: Number.NaN }, 'strength', 1.5)).toBe(1.5);
    expect(getEffectStringParam({ label: '  clean  ' }, 'label', 'fallback')).toBe('clean');
    expect(getEffectStringParam({ label: '' }, 'label', 'fallback')).toBe('fallback');
    expect(getCustomShaderSource({ type: 'blur', params: {} })).toBeUndefined();
    expect(getCustomShaderSource({ type: 'custom-shader', params: { source: '  gl_FragColor = vec4(1.0);  ' } })).toBe('gl_FragColor = vec4(1.0);');
    expect(normalizeCustomShaderParams({ source: '', preset: '' })).toEqual({
      source: DEFAULT_CUSTOM_SHADER_SOURCE,
      preset: 'pixelate'
    });
    expect(normalizeCustomShaderParams({ source: 'void main() {}', preset: 'unknown' })).toEqual({
      source: 'void main() {}',
      preset: 'custom'
    });
    expect(getCustomShaderExample('missing')).toEqual(getCustomShaderExample(undefined));
    expect(buildCustomShaderFragmentSource('uniform sampler2D u_texture;\n gl_FragColor = texture2D(u_texture, v_texCoord);')).toContain('void main()');
  });

  it('normalizes audio spectrum fallback aliases and false-like mirror values', () => {
    const defaults = DEFAULT_EFFECT_PARAMS['audio-spectrum'];
    const originalStyle = defaults.style;
    const originalPosition = defaults.position;
    defaults.style = 'circle';
    defaults.position = 'top';
    try {
      expect(normalizeAudioSpectrumParams({ style: 'bad', mirror: 'off' })).toMatchObject({
        style: 'circular',
        position: 'top',
        mirror: false
      });
    } finally {
      defaults.style = originalStyle;
      defaults.position = originalPosition;
    }
    expect(normalizeAudioSpectrumParams({ color: '#ABCDEF', colorEnd: 'not-a-color', themeId: '  ' })).toMatchObject({
      color: '#abcdef',
      colorStart: '#abcdef',
      colorEnd: '#abcdef',
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID
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
