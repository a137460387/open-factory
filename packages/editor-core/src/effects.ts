import { clamp, round } from './time';
import { DEFAULT_MOTION_BLUR_PARAMS, normalizeMotionBlurParams, type MotionBlurParams } from './motion-blur';
import { MANUAL_AUDIO_VISUALIZATION_THEME_ID, expandAudioVisualizationTheme } from './audio-visualization-themes';

export type EffectType = 'blur' | 'sharpen' | 'vignette' | 'film-grain' | 'chromatic-aberration' | 'audio-spectrum' | 'custom-shader' | 'motion-blur';
export type EffectParamValue = number | string | boolean;
export type EffectParams = Record<string, EffectParamValue>;
export type AudioSpectrumStyle = 'bars' | 'waveform' | 'circular';
export type AudioSpectrumPosition = 'top' | 'bottom';
export type CustomShaderExampleId = 'pixelate' | 'posterize' | 'old-film';
export type { MotionBlurParams };

export interface AudioSpectrumParams extends EffectParams {
  style: AudioSpectrumStyle;
  color: string;
  colorStart: string;
  colorEnd: string;
  themeId: string;
  height: number;
  position: AudioSpectrumPosition;
  sensitivity: number;
  mirror: boolean;
}

export interface CustomShaderParams extends EffectParams {
  source: string;
  preset: string;
}

export interface CustomShaderExample {
  id: CustomShaderExampleId;
  name: string;
  source: string;
}

export interface Effect {
  id: string;
  type: EffectType;
  enabled: boolean;
  params: EffectParams;
}

export const CUSTOM_SHADER_UNIFORM_NAMES = ['u_texture', 'u_resolution', 'u_time', 'u_progress'] as const;
export const CUSTOM_SHADER_VARYING_NAME = 'v_texCoord';

export const CUSTOM_SHADER_EXAMPLES: readonly CustomShaderExample[] = [
  {
    id: 'pixelate',
    name: 'Pixelate',
    source: `vec2 blockSize = vec2(18.0) / u_resolution;
vec2 uv = floor(v_texCoord / blockSize) * blockSize + blockSize * 0.5;
gl_FragColor = texture2D(u_texture, uv);`
  },
  {
    id: 'posterize',
    name: 'Posterize',
    source: `vec4 color = texture2D(u_texture, v_texCoord);
vec3 levels = floor(color.rgb * 5.0) / 5.0;
gl_FragColor = vec4(levels, color.a);`
  },
  {
    id: 'old-film',
    name: 'Old Film Noise',
    source: `vec4 color = texture2D(u_texture, v_texCoord);
float grain = fract(sin(dot(v_texCoord * u_resolution + u_time, vec2(12.9898, 78.233))) * 43758.5453);
vec3 sepia = vec3(
  dot(color.rgb, vec3(0.393, 0.769, 0.189)),
  dot(color.rgb, vec3(0.349, 0.686, 0.168)),
  dot(color.rgb, vec3(0.272, 0.534, 0.131))
);
float vignette = smoothstep(0.85, 0.25, distance(v_texCoord, vec2(0.5)));
gl_FragColor = vec4(clamp(sepia * vignette + (grain - 0.5) * 0.08, 0.0, 1.0), color.a);`
  }
];

export const DEFAULT_CUSTOM_SHADER_SOURCE = CUSTOM_SHADER_EXAMPLES[0].source;
export const DEFAULT_CUSTOM_SHADER_PRESET: CustomShaderExampleId = CUSTOM_SHADER_EXAMPLES[0].id;

export const EFFECT_TYPES: EffectType[] = ['blur', 'sharpen', 'vignette', 'film-grain', 'chromatic-aberration', 'audio-spectrum', 'custom-shader', 'motion-blur'];
export const AUDIO_SPECTRUM_STYLES: AudioSpectrumStyle[] = ['bars', 'waveform', 'circular'];
export const AUDIO_SPECTRUM_POSITIONS: AudioSpectrumPosition[] = ['bottom', 'top'];

export const DEFAULT_EFFECT_PARAMS: Record<EffectType, EffectParams> = {
  blur: { radius: 8 },
  sharpen: { strength: 1 },
  vignette: { intensity: 0.35, radius: 0.6 },
  'film-grain': { strength: 0.2, size: 2 },
  'chromatic-aberration': { strength: 4 },
  'audio-spectrum': {
    style: 'bars',
    color: '#22d3ee',
    colorStart: '#22d3ee',
    colorEnd: '#22d3ee',
    themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
    height: 25,
    position: 'bottom',
    sensitivity: 1,
    mirror: false
  },
  'custom-shader': { source: DEFAULT_CUSTOM_SHADER_SOURCE, preset: DEFAULT_CUSTOM_SHADER_PRESET },
  'motion-blur': DEFAULT_MOTION_BLUR_PARAMS
};

export function isEffectType(type: string | undefined): type is EffectType {
  return EFFECT_TYPES.includes(type as EffectType);
}

export function normalizeEffect(effect: Partial<Effect> | undefined): Effect | undefined {
  if (!effect || !isEffectType(effect.type) || !effect.id?.trim()) {
    return undefined;
  }
  return {
    id: effect.id.trim(),
    type: effect.type,
    enabled: effect.enabled ?? true,
    params: normalizeEffectParams(effect.type, effect.params)
  };
}

export function normalizeEffects(effects: Partial<Effect>[] | undefined): Effect[] | undefined {
  const normalized = (effects ?? []).flatMap((effect) => {
    const nextEffect = normalizeEffect(effect);
    return nextEffect ? [nextEffect] : [];
  });
  return normalized.length > 0 ? normalized : undefined;
}

export function cloneEffects(effects: Partial<Effect>[] | undefined): Effect[] | undefined {
  return normalizeEffects(effects);
}

export function normalizeEffectParams(type: EffectType, params: EffectParams | undefined): EffectParams {
  const defaults = DEFAULT_EFFECT_PARAMS[type];
  if (type === 'blur') {
    return { radius: normalizeParam(params?.radius, numberParam(defaults.radius, 8), 1, 50) };
  }
  if (type === 'sharpen') {
    return { strength: normalizeParam(params?.strength, numberParam(defaults.strength, 1), 0, 3) };
  }
  if (type === 'vignette') {
    return {
      intensity: normalizeParam(params?.intensity, numberParam(defaults.intensity, 0.35), 0, 1),
      radius: normalizeParam(params?.radius, numberParam(defaults.radius, 0.6), 0, 1)
    };
  }
  if (type === 'film-grain') {
    return {
      strength: normalizeParam(params?.strength, numberParam(defaults.strength, 0.2), 0, 1),
      size: normalizeParam(params?.size, numberParam(defaults.size, 2), 1, 5)
    };
  }
  if (type === 'chromatic-aberration') {
    return { strength: normalizeParam(params?.strength, numberParam(defaults.strength, 4), 0, 20) };
  }
  if (type === 'audio-spectrum') {
    return normalizeAudioSpectrumParams(params);
  }
  if (type === 'motion-blur') {
    return normalizeMotionBlurParams(params);
  }
  return normalizeCustomShaderParams(params);
}

export function normalizeAudioSpectrumParams(params: EffectParams | undefined): AudioSpectrumParams {
  const defaults = DEFAULT_EFFECT_PARAMS['audio-spectrum'];
  const themeId = stringParam(params?.themeId, stringParam(defaults.themeId, MANUAL_AUDIO_VISUALIZATION_THEME_ID));
  const theme = expandAudioVisualizationTheme({
    themeId,
    color: stringParam(params?.color, stringParam(defaults.color, '#22d3ee')),
    colorStart: stringParam(params?.colorStart ?? params?.color, stringParam(defaults.colorStart, '#22d3ee')),
    colorEnd: typeof params?.colorEnd === 'string' ? params.colorEnd : undefined
  });
  const colorStart = theme.colorStart;
  const colorEnd = theme.colorEnd;
  return {
    style: normalizeAudioSpectrumStyle(params?.style, stringParam(defaults.style, 'bars')),
    color: colorStart,
    colorStart,
    colorEnd,
    themeId,
    height: normalizeParam(params?.height, numberParam(defaults.height, 25), 0, 50),
    position: normalizeAudioSpectrumPosition(params?.position, stringParam(defaults.position, 'bottom')),
    sensitivity: normalizeParam(params?.sensitivity, numberParam(defaults.sensitivity, 1), 0.1, 4),
    mirror: booleanParam(params?.mirror, booleanParam(defaults.mirror, false))
  };
}

export function getEffectNumberParam(params: EffectParams | undefined, key: string, fallback: number): number {
  return normalizeParam(params?.[key], fallback, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
}

export function getEffectStringParam(params: EffectParams | undefined, key: string, fallback: string): string {
  return stringParam(params?.[key], fallback);
}

export function normalizeCustomShaderParams(params: EffectParams | undefined): CustomShaderParams {
  return {
    source: normalizeShaderSource(params?.source),
    preset: normalizeShaderPreset(params?.preset)
  };
}

export function getCustomShaderSource(effect: Pick<Effect, 'type' | 'params'>): string | undefined {
  if (effect.type !== 'custom-shader') {
    return undefined;
  }
  return normalizeCustomShaderParams(effect.params).source;
}

export function getEnabledCustomShaderEffect(effects: Effect[] | undefined): Effect | undefined {
  return (effects ?? []).find((effect) => effect.enabled && effect.type === 'custom-shader' && normalizeCustomShaderParams(effect.params).source.trim().length > 0);
}

export function buildCustomShaderFragmentSource(source: string): string {
  const body = normalizeShaderSource(source);
  const declarations = [
    'precision mediump float;',
    'uniform sampler2D u_texture;',
    'uniform vec2 u_resolution;',
    'uniform float u_time;',
    'uniform float u_progress;',
    'varying vec2 v_texCoord;'
  ];
  const withDeclarations = declarations.reduce((current, declaration) => {
    const key = declaration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+');
    return new RegExp(key).test(current) ? current : `${declaration}\n${current}`;
  }, body);
  if (/void\s+main\s*\(\s*\)/.test(withDeclarations)) {
    return withDeclarations;
  }
  const shaderBody = declarations.reduce((current, declaration) => {
    const key = declaration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+');
    return current.replace(new RegExp(`^\\s*${key}\\s*\\n?`, 'm'), '');
  }, body);
  return `${declarations.join('\n')}\nvoid main() {\n${shaderBody.trim()}\n}`;
}

export function getCustomShaderExample(id: string | undefined): CustomShaderExample {
  return CUSTOM_SHADER_EXAMPLES.find((example) => example.id === id) ?? CUSTOM_SHADER_EXAMPLES[0];
}

function normalizeParam(value: EffectParamValue | undefined, fallback: number, min: number, max: number): number {
  return round(clamp(typeof value === 'number' && Number.isFinite(value) ? value : fallback, min, max));
}

function numberParam(value: EffectParamValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringParam(value: EffectParamValue | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function booleanParam(value: EffectParamValue | undefined, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'on') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'off') {
      return false;
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }
  return fallback;
}

function normalizeAudioSpectrumStyle(value: EffectParamValue | undefined, fallback: string): AudioSpectrumStyle {
  if (value === 'circle') {
    return 'circular';
  }
  return AUDIO_SPECTRUM_STYLES.includes(value as AudioSpectrumStyle) ? (value as AudioSpectrumStyle) : normalizeFallbackStyle(fallback);
}

function normalizeFallbackStyle(value: string): AudioSpectrumStyle {
  if (value === 'circle') {
    return 'circular';
  }
  return AUDIO_SPECTRUM_STYLES.includes(value as AudioSpectrumStyle) ? (value as AudioSpectrumStyle) : 'bars';
}

function normalizeAudioSpectrumPosition(value: EffectParamValue | undefined, fallback: string): AudioSpectrumPosition {
  return AUDIO_SPECTRUM_POSITIONS.includes(value as AudioSpectrumPosition) ? (value as AudioSpectrumPosition) : normalizeFallbackPosition(fallback);
}

function normalizeFallbackPosition(value: string): AudioSpectrumPosition {
  return AUDIO_SPECTRUM_POSITIONS.includes(value as AudioSpectrumPosition) ? (value as AudioSpectrumPosition) : 'bottom';
}

function normalizeHexColor(value: EffectParamValue | undefined, fallback: string): string {
  const candidate = stringParam(value, fallback);
  const match = /^#?([0-9a-fA-F]{6})$/.exec(candidate);
  return match ? `#${match[1].toLowerCase()}` : fallback;
}

function normalizeShaderSource(value: EffectParamValue | undefined): string {
  const source = typeof value === 'string' ? value.trim() : '';
  return source || DEFAULT_CUSTOM_SHADER_SOURCE;
}

function normalizeShaderPreset(value: EffectParamValue | undefined): string {
  if (typeof value !== 'string' || !value.trim()) {
    return DEFAULT_CUSTOM_SHADER_PRESET;
  }
  const preset = value.trim();
  return CUSTOM_SHADER_EXAMPLES.some((example) => example.id === preset) || preset === 'custom' ? preset : 'custom';
}
