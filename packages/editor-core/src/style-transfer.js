import { cloneEffects, DEFAULT_EFFECT_PARAMS, normalizeEffect, normalizeEffectParams, } from './effects';
import { createId, normalizeColorCorrection } from './model';
import { clamp, round } from './time';
const COLOR_KEYS = ['brightness', 'contrast', 'saturation', 'hue'];
const DEFAULT_SCOPE = { color: true, effects: true, lut: true };
export function calculateStyleSummary(clips) {
    const normalizedClips = clips.filter(Boolean);
    const colorCorrections = normalizedClips.map((clip) => normalizeColorCorrection(clip.colorCorrection));
    const color = Object.fromEntries(COLOR_KEYS.map((key) => [key, calculateNumericStat(colorCorrections.map((correction) => correction[key]))]));
    const lutPath = calculateMode(colorCorrections
        .map((correction) => correction.lutPath)
        .filter((value) => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim()));
    return {
        clipCount: normalizedClips.length,
        color,
        lutPath: lutPath ?? null,
        effects: summarizeEffects(normalizedClips.flatMap((clip) => cloneEffects(clip.effects) ?? [])),
    };
}
export function applyStyleToClip(clip, summary, options) {
    const strength = normalizeStrength(options.strength);
    if (strength <= 0 || summary.clipCount === 0) {
        return cloneClipStyleFields(clip);
    }
    const scope = normalizeStyleTransferScope(options.scope);
    let next = cloneClipStyleFields(clip);
    if (scope.color || scope.lut) {
        next = {
            ...next,
            colorCorrection: applyColorStyle(next.colorCorrection, summary, strength, scope),
        };
    }
    if (scope.effects) {
        next = {
            ...next,
            effects: applyEffectStyle(next.effects, summary.effects, strength),
        };
    }
    return next;
}
export function blendNumericStyleValue(current, target, strengthFactor) {
    return round(current + (target - current) * clamp(Number.isFinite(strengthFactor) ? strengthFactor : 1, 0, 1));
}
export function normalizeStyleTransferScope(scope) {
    return {
        color: scope?.color ?? DEFAULT_SCOPE.color,
        effects: scope?.effects ?? DEFAULT_SCOPE.effects,
        lut: scope?.lut ?? DEFAULT_SCOPE.lut,
    };
}
function summarizeEffects(effects) {
    const byType = new Map();
    for (const effect of effects) {
        byType.set(effect.type, [...(byType.get(effect.type) ?? []), effect]);
    }
    return Array.from(byType.entries())
        .map(([type, entries]) => ({
        type,
        count: entries.length,
        enabledRatio: entries.filter((effect) => effect.enabled).length / Math.max(1, entries.length),
        params: summarizeEffectParams(entries),
    }))
        .sort((left, right) => left.type.localeCompare(right.type));
}
function summarizeEffectParams(effects) {
    const valuesByKey = new Map();
    for (const effect of effects) {
        for (const [key, value] of Object.entries(effect.params)) {
            valuesByKey.set(key, [...(valuesByKey.get(key) ?? []), value]);
        }
    }
    const output = {};
    for (const [key, values] of valuesByKey.entries()) {
        const numeric = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
        if (numeric.length > 0) {
            output[key] = { kind: 'number', ...calculateNumericStat(numeric) };
            continue;
        }
        const booleans = values.filter((value) => typeof value === 'boolean');
        if (booleans.length > 0) {
            const mode = calculateMode(booleans.map(String));
            output[key] = { kind: 'boolean', value: mode === 'true', count: booleans.length };
            continue;
        }
        const strings = values.filter((value) => typeof value === 'string' && value.trim().length > 0);
        if (strings.length > 0) {
            output[key] = { kind: 'string', value: calculateMode(strings) ?? strings[0], count: strings.length };
        }
    }
    return output;
}
function applyColorStyle(colorCorrection, summary, strength, scope) {
    const current = normalizeColorCorrection(colorCorrection);
    const patch = {};
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
function applyEffectStyle(currentEffects, summaries, strength) {
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
            enabled: strength >= 0.5 ? summary.enabledRatio >= 0.5 : (existing?.enabled ?? summary.enabledRatio >= 0.5),
            params,
        });
        return effect ? [effect] : [];
    });
    return cloneEffects([...untouched, ...styled]);
}
function applyEffectParams(type, currentParams, summaries, strength) {
    const current = normalizeEffectParams(type, currentParams);
    const defaults = DEFAULT_EFFECT_PARAMS[type];
    const next = { ...current };
    for (const [key, summary] of Object.entries(summaries)) {
        const currentValue = current[key] ?? defaults[key];
        if (summary.kind === 'number') {
            const base = typeof currentValue === 'number' && Number.isFinite(currentValue) ? currentValue : summary.mean;
            next[key] = blendNumericStyleValue(base, summary.mean, strength);
        }
        else if (summary.kind === 'boolean') {
            next[key] = strength >= 0.5 ? summary.value : typeof currentValue === 'boolean' ? currentValue : summary.value;
        }
        else {
            next[key] = strength >= 0.5 ? summary.value : typeof currentValue === 'string' ? currentValue : summary.value;
        }
    }
    return normalizeEffectParams(type, next);
}
function calculateNumericStat(values) {
    const numeric = values.filter((value) => Number.isFinite(value));
    if (numeric.length === 0) {
        return { mean: 0, stddev: 0, count: 0 };
    }
    const mean = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
    const variance = numeric.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numeric.length;
    return { mean: round(mean), stddev: round(Math.sqrt(variance)), count: numeric.length };
}
function calculateMode(values) {
    const counts = new Map();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
}
function normalizeStrength(strength) {
    return clamp(Number.isFinite(strength) ? strength : 100, 0, 100) / 100;
}
function cloneClipStyleFields(clip) {
    return {
        ...clip,
        colorCorrection: normalizeColorCorrection(clip.colorCorrection),
        effects: cloneEffects(clip.effects),
    };
}
//# sourceMappingURL=style-transfer.js.map