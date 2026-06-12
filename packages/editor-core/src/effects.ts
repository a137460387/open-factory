import { clamp, round } from './time';

export type EffectType = 'blur' | 'sharpen' | 'vignette' | 'film-grain' | 'chromatic-aberration' | 'audio-spectrum';
export type EffectParamValue = number | string;
export type EffectParams = Record<string, EffectParamValue>;
export type AudioSpectrumStyle = 'bars' | 'waveform' | 'circle';
export type AudioSpectrumPosition = 'top' | 'bottom';

export interface AudioSpectrumParams extends EffectParams {
  style: AudioSpectrumStyle;
  color: string;
  height: number;
  position: AudioSpectrumPosition;
  sensitivity: number;
}

export interface Effect {
  id: string;
  type: EffectType;
  enabled: boolean;
  params: EffectParams;
}

export const EFFECT_TYPES: EffectType[] = ['blur', 'sharpen', 'vignette', 'film-grain', 'chromatic-aberration', 'audio-spectrum'];
export const AUDIO_SPECTRUM_STYLES: AudioSpectrumStyle[] = ['bars', 'waveform', 'circle'];
export const AUDIO_SPECTRUM_POSITIONS: AudioSpectrumPosition[] = ['bottom', 'top'];

export const DEFAULT_EFFECT_PARAMS: Record<EffectType, EffectParams> = {
  blur: { radius: 8 },
  sharpen: { strength: 1 },
  vignette: { intensity: 0.35, radius: 0.6 },
  'film-grain': { strength: 0.2, size: 2 },
  'chromatic-aberration': { strength: 4 },
  'audio-spectrum': { style: 'bars', color: '#22d3ee', height: 25, position: 'bottom', sensitivity: 1 }
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
  return normalizeAudioSpectrumParams(params);
}

export function normalizeAudioSpectrumParams(params: EffectParams | undefined): AudioSpectrumParams {
  const defaults = DEFAULT_EFFECT_PARAMS['audio-spectrum'];
  return {
    style: normalizeAudioSpectrumStyle(params?.style, stringParam(defaults.style, 'bars')),
    color: normalizeHexColor(params?.color, stringParam(defaults.color, '#22d3ee')),
    height: normalizeParam(params?.height, numberParam(defaults.height, 25), 0, 50),
    position: normalizeAudioSpectrumPosition(params?.position, stringParam(defaults.position, 'bottom')),
    sensitivity: normalizeParam(params?.sensitivity, numberParam(defaults.sensitivity, 1), 0.1, 4)
  };
}

export function getEffectNumberParam(params: EffectParams | undefined, key: string, fallback: number): number {
  return normalizeParam(params?.[key], fallback, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
}

export function getEffectStringParam(params: EffectParams | undefined, key: string, fallback: string): string {
  return stringParam(params?.[key], fallback);
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

function normalizeAudioSpectrumStyle(value: EffectParamValue | undefined, fallback: string): AudioSpectrumStyle {
  return AUDIO_SPECTRUM_STYLES.includes(value as AudioSpectrumStyle) ? (value as AudioSpectrumStyle) : normalizeFallbackStyle(fallback);
}

function normalizeFallbackStyle(value: string): AudioSpectrumStyle {
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
