import { clamp, round } from './time';

export type EffectType = 'blur' | 'sharpen' | 'vignette' | 'film-grain' | 'chromatic-aberration';

export interface Effect {
  id: string;
  type: EffectType;
  enabled: boolean;
  params: Record<string, number>;
}

export const EFFECT_TYPES: EffectType[] = ['blur', 'sharpen', 'vignette', 'film-grain', 'chromatic-aberration'];

export const DEFAULT_EFFECT_PARAMS: Record<EffectType, Record<string, number>> = {
  blur: { radius: 8 },
  sharpen: { strength: 1 },
  vignette: { intensity: 0.35, radius: 0.6 },
  'film-grain': { strength: 0.2, size: 2 },
  'chromatic-aberration': { strength: 4 }
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

export function normalizeEffectParams(type: EffectType, params: Record<string, number> | undefined): Record<string, number> {
  const defaults = DEFAULT_EFFECT_PARAMS[type];
  if (type === 'blur') {
    return { radius: normalizeParam(params?.radius, defaults.radius, 1, 50) };
  }
  if (type === 'sharpen') {
    return { strength: normalizeParam(params?.strength, defaults.strength, 0, 3) };
  }
  if (type === 'vignette') {
    return {
      intensity: normalizeParam(params?.intensity, defaults.intensity, 0, 1),
      radius: normalizeParam(params?.radius, defaults.radius, 0, 1)
    };
  }
  if (type === 'film-grain') {
    return {
      strength: normalizeParam(params?.strength, defaults.strength, 0, 1),
      size: normalizeParam(params?.size, defaults.size, 1, 5)
    };
  }
  return { strength: normalizeParam(params?.strength, defaults.strength, 0, 20) };
}

function normalizeParam(value: number | undefined, fallback: number, min: number, max: number): number {
  return round(clamp(typeof value === 'number' && Number.isFinite(value) ? value : fallback, min, max));
}
