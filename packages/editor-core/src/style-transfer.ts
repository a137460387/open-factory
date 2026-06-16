import { cloneEffects, DEFAULT_EFFECT_PARAMS, normalizeEffect, normalizeEffectParams, type Effect, type EffectParamValue, type EffectParams, type EffectType } from './effects';
import { createId, normalizeColorCorrection } from './model';
import type { Clip, ColorCorrection } from './model-types';
import { clamp, round } from './time';

export type StyleTransferScope = {
  color: boolean;
  effects: boolean;
  lut: boolean;
};

export interface NumericStyleStat {
  mean: number;
  stddev: number;
  count: number;
}

export type ColorStyleKey = 'brightness' | 'contrast' | 'saturation' | 'hue';

export type EffectParamStyleSummary =
  | ({ kind: 'number' } & NumericStyleStat)
  | { kind: 'string'; value: string; count: number }
  | { kind: 'boolean'; value: boolean; count: number };

export interface EffectStyleSummary {
  type: EffectType;
  count: number;
  enabledRatio: number;
  params: Record<string, EffectParamStyleSummary>;
}

export interface StyleSummary {
  clipCount: number;
  color: Record<ColorStyleKey, NumericStyleStat>;
  lutPath?: string | null;
  effects: EffectStyleSummary[];
}

export interface ApplyStyleTransferOptions {
  strength: number;
  scope?: Partial<StyleTransferScope>;
}

const COLOR_KEYS: ColorStyleKey[] = ['brightness', 'contrast', 'saturation', 'hue'];
const DEFAULT_SCOPE: StyleTransferScope = { color: true, effects: true, lut: true };

export function calculateStyleSummary(clips: readonly Clip[]): StyleSummary {
  const normalizedClips = clips.filter(Boolean);
  const colorCorrections = normalizedClips.map((clip) => normalizeColorCorrection(clip.colorCorrection));
  const color = Object.fromEntries(COLOR_KEYS.map((key) => [key, calculateNumericStat(colorCorrections.map((correction) => correction[key]))])) as Record<ColorStyleKey, NumericStyleStat>;
  const lutPath = calculateMode(
    colorCorrections
      .map((correction) => correction.lutPath)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim())
  );
  return {
    clipCount: normalizedClips.length,
    color,
    lutPath: lutPath ?? null,
    effects: summarizeEffects(normalizedClips.flatMap((clip) => cloneEffects(clip.effects) ?? []))
  };
}

export function applyStyleToClip<TClip extends Clip>(clip: TClip, summary: StyleSummary, options: ApplyStyleTransferOptions): TClip {
  const strength = normalizeStrength(options.strength);
  if (strength <= 0 || summary.clipCount === 0) {
    return cloneClipStyleFields(clip);
  }
  const scope = normalizeStyleTransferScope(options.scope);
  let next = cloneClipStyleFields(clip);
  if (scope.color || scope.lut) {
    next = {
      ...next,
      colorCorrection: applyColorStyle(next.colorCorrection, summary, strength, scope)
    };
  }
  if (scope.effects) {
    next = {
      ...next,
      effects: applyEffectStyle(next.effects, summary.effects, strength)
    };
  }
  return next;
}

export function blendNumericStyleValue(current: number, target: number, strengthFactor: number): number {
  return round(current + (target - current) * clamp(Number.isFinite(strengthFactor) ? strengthFactor : 1, 0, 1));
}

export function normalizeStyleTransferScope(scope: Partial<StyleTransferScope> | undefined): StyleTransferScope {
  return {
    color: scope?.color ?? DEFAULT_SCOPE.color,
    effects: scope?.effects ?? DEFAULT_SCOPE.effects,
    lut: scope?.lut ?? DEFAULT_SCOPE.lut
  };
}

function summarizeEffects(effects: Effect[]): EffectStyleSummary[] {
  const byType = new Map<EffectType, Effect[]>();
  for (const effect of effects) {
    byType.set(effect.type, [...(byType.get(effect.type) ?? []), effect]);
  }
  return Array.from(byType.entries())
    .map(([type, entries]) => ({
      type,
      count: entries.length,
      enabledRatio: entries.filter((effect) => effect.enabled).length / Math.max(1, entries.length),
      params: summarizeEffectParams(entries)
    }))
    .sort((left, right) => left.type.localeCompare(right.type));
}

function summarizeEffectParams(effects: Effect[]): Record<string, EffectParamStyleSummary> {
  const valuesByKey = new Map<string, EffectParamValue[]>();
  for (const effect of effects) {
    for (const [key, value] of Object.entries(effect.params)) {
      valuesByKey.set(key, [...(valuesByKey.get(key) ?? []), value]);
    }
  }
  const output: Record<string, EffectParamStyleSummary> = {};
  for (const [key, values] of valuesByKey.entries()) {
    const numeric = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (numeric.length > 0) {
      output[key] = { kind: 'number', ...calculateNumericStat(numeric) };
      continue;
    }
    const booleans = values.filter((value): value is boolean => typeof value === 'boolean');
    if (booleans.length > 0) {
      const mode = calculateMode(booleans.map(String));
      output[key] = { kind: 'boolean', value: mode === 'true', count: booleans.length };
      continue;
    }
    const strings = values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (strings.length > 0) {
      output[key] = { kind: 'string', value: calculateMode(strings) ?? strings[0], count: strings.length };
    }
  }
  return output;
}

function applyColorStyle(colorCorrection: ColorCorrection, summary: StyleSummary, strength: number, scope: StyleTransferScope): ColorCorrection {
  const current = normalizeColorCorrection(colorCorrection);
  const patch: Partial<ColorCorrection> = {};
  if (scope.color) {
    for (const key of COLOR_KEYS) {
      patch[key] = blendNumericStyleValue(current[key], summary.color[key].mean, strength);
    }
  }
  if (scope.lut && summary.lutPath !== undefined) {
    patch.lutPath = strength >= 0.5 ? summary.lutPath : current.lutPath;
  }
  return normalizeColorCorrection({ ...current, ...patch });
}

function applyEffectStyle(currentEffects: Effect[] | undefined, summaries: EffectStyleSummary[], strength: number): Effect[] | undefined {
  const current = cloneEffects(currentEffects) ?? [];
  const currentByType = new Map(current.map((effect) => [effect.type, effect]));
  const styledTypes = new Set(summaries.map((summary) => summary.type));
  const untouched = strength >= 1 ? [] : current.filter((effect) => !styledTypes.has(effect.type));
  const styled = summaries.flatMap((summary) => {
    const existing = currentByType.get(summary.type);
    const params = applyEffectParams(summary.type, existing?.params, summary.params, strength);
    const effect = normalizeEffect({
      id: existing?.id ?? createId(`style-${summary.type}`),
      type: summary.type,
      enabled: strength >= 0.5 ? summary.enabledRatio >= 0.5 : existing?.enabled ?? summary.enabledRatio >= 0.5,
      params
    });
    return effect ? [effect] : [];
  });
  return cloneEffects([...untouched, ...styled]);
}

function applyEffectParams(type: EffectType, currentParams: EffectParams | undefined, summaries: Record<string, EffectParamStyleSummary>, strength: number): EffectParams {
  const current = normalizeEffectParams(type, currentParams);
  const defaults = DEFAULT_EFFECT_PARAMS[type];
  const next: EffectParams = { ...current };
  for (const [key, summary] of Object.entries(summaries)) {
    const currentValue = current[key] ?? defaults[key];
    if (summary.kind === 'number') {
      const base = typeof currentValue === 'number' && Number.isFinite(currentValue) ? currentValue : summary.mean;
      next[key] = blendNumericStyleValue(base, summary.mean, strength);
    } else if (summary.kind === 'boolean') {
      next[key] = strength >= 0.5 ? summary.value : typeof currentValue === 'boolean' ? currentValue : summary.value;
    } else {
      next[key] = strength >= 0.5 ? summary.value : typeof currentValue === 'string' ? currentValue : summary.value;
    }
  }
  return normalizeEffectParams(type, next);
}

function calculateNumericStat(values: readonly number[]): NumericStyleStat {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (numeric.length === 0) {
    return { mean: 0, stddev: 0, count: 0 };
  }
  const mean = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  const variance = numeric.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numeric.length;
  return { mean: round(mean), stddev: round(Math.sqrt(variance)), count: numeric.length };
}

function calculateMode(values: readonly string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
}

function normalizeStrength(strength: number): number {
  return clamp(Number.isFinite(strength) ? strength : 100, 0, 100) / 100;
}

function cloneClipStyleFields<TClip extends Clip>(clip: TClip): TClip {
  return {
    ...clip,
    colorCorrection: normalizeColorCorrection(clip.colorCorrection),
    effects: cloneEffects(clip.effects)
  };
}
