/**
 * Creator Style Analyzer
 *
 * Extracts quantitative "style fingerprints" from user's historical projects.
 * Analyzes transitions, rhythm, color grading, audio processing, and effects
 * to build a reusable style profile.
 *
 * Pipeline:
 * 1. Collect clips, transitions, effects from historical projects
 * 2. Extract per-dimension statistical features
 * 3. Build a unified StyleFingerprint JSON
 * 4. Apply style to new editing plans via blend/match
 *
 * Privacy: All analysis is local. Style fingerprints contain no media data.
 */
import { normalizeColorCorrection } from '../model';
import { round } from '../time';
import { clamp01 } from '../utils/math';
// ─── Style Fingerprint JSON Schema ──────────────────────────────
/** Style fingerprint version */
export const STYLE_FINGERPRINT_VERSION = '1.0';
const DEFAULT_EXTRACTION_OPTIONS = {
    minClipCount: 3,
    histogramBins: 60,
    histogramMaxDurationSec: 30,
};
// ─── Statistical Utilities ──────────────────────────────────────
function calcMean(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}
function calcStddev(values, mean) {
    if (values.length <= 1)
        return 0;
    const m = mean ?? calcMean(values);
    const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}
function calcMedian(values) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function calcNumericStat(values) {
    const mean = calcMean(values);
    return { mean, stddev: calcStddev(values, mean), count: values.length };
}
function buildHistogram(values, bins, maxVal) {
    const histogram = new Array(bins).fill(0);
    const binWidth = maxVal / bins;
    for (const v of values) {
        const idx = Math.min(Math.floor(v / binWidth), bins - 1);
        if (idx >= 0)
            histogram[idx]++;
    }
    return histogram;
}
// ─── Transition Analysis ────────────────────────────────────────
function extractTransitions(timeline) {
    const transitions = timeline.transitions ?? [];
    if (transitions.length === 0)
        return [];
    const byType = new Map();
    for (const t of transitions) {
        const existing = byType.get(t.type) ?? [];
        existing.push(t);
        byType.set(t.type, existing);
    }
    const total = transitions.length;
    return Array.from(byType.entries())
        .map(([type, items]) => {
        const durations = items.map((t) => t.duration);
        const avgDurationSec = calcMean(durations);
        return {
            type,
            count: items.length,
            avgDurationSec: round(avgDurationSec, 3),
            durationStddev: round(calcStddev(durations, avgDurationSec), 3),
            ratio: round(items.length / total, 3),
        };
    })
        .sort((a, b) => b.count - a.count);
}
// ─── Rhythm Analysis ────────────────────────────────────────────
function extractRhythm(timeline, opts) {
    const allClips = getAllClips(timeline);
    const durations = allClips.map((c) => c.duration).filter((d) => d > 0);
    if (durations.length === 0) {
        return {
            avgClipDurationSec: 0,
            clipDurationStddev: 0,
            cutsPerMinute: 0,
            regularity: 0,
            durationHistogram: new Array(opts.histogramBins).fill(0),
            shortClipRatio: 0,
            longClipRatio: 0,
        };
    }
    const avgClipDurationSec = calcMean(durations);
    const clipDurationStddev = calcStddev(durations, avgClipDurationSec);
    const totalDuration = durations.reduce((s, d) => s + d, 0);
    const cutsPerMinute = totalDuration > 0 ? (durations.length / totalDuration) * 60 : 0;
    // Regularity: 1 - normalized stddev (clamped to 0-1)
    const regularity = avgClipDurationSec > 0
        ? Math.max(0, 1 - clipDurationStddev / avgClipDurationSec)
        : 0;
    const shortClipRatio = durations.filter((d) => d < 2).length / durations.length;
    const longClipRatio = durations.filter((d) => d > 10).length / durations.length;
    return {
        avgClipDurationSec: round(avgClipDurationSec, 3),
        clipDurationStddev: round(clipDurationStddev, 3),
        cutsPerMinute: round(cutsPerMinute, 2),
        regularity: round(regularity, 3),
        durationHistogram: buildHistogram(durations, opts.histogramBins, opts.histogramMaxDurationSec),
        shortClipRatio: round(shortClipRatio, 3),
        longClipRatio: round(longClipRatio, 3),
    };
}
// ─── Color Grading Analysis ─────────────────────────────────────
function extractColorGrading(timeline) {
    const allClips = getAllClips(timeline);
    const colorCorrections = allClips
        .map((c) => ('colorCorrection' in c ? normalizeColorCorrection(c.colorCorrection) : null))
        .filter((cc) => cc !== null);
    if (colorCorrections.length === 0) {
        const empty = { mean: 0, stddev: 0, count: 0 };
        return {
            brightness: { ...empty },
            contrast: { ...empty },
            saturation: { ...empty },
            hue: { ...empty },
            preferredLutPath: null,
            lutUsageRatio: 0,
            temperatureTendency: 'neutral',
        };
    }
    const brightness = calcNumericStat(colorCorrections.map((c) => c.brightness));
    const contrast = calcNumericStat(colorCorrections.map((c) => c.contrast));
    const saturation = calcNumericStat(colorCorrections.map((c) => c.saturation));
    const hue = calcNumericStat(colorCorrections.map((c) => c.hue));
    // LUT analysis
    const lutPaths = colorCorrections
        .map((c) => c.lutPath)
        .filter((p) => typeof p === 'string' && p.trim().length > 0);
    const lutUsageRatio = round(lutPaths.length / colorCorrections.length, 3);
    const preferredLutPath = lutPaths.length > 0 ? findMode(lutPaths) : null;
    // Temperature tendency based on hue mean
    const hueMean = hue.mean;
    const temperatureTendency = hueMean > 10 ? 'warm' : hueMean < -10 ? 'cool' : 'neutral';
    return {
        brightness,
        contrast,
        saturation,
        hue: { ...hue, mean: round(hue.mean, 1) },
        preferredLutPath,
        lutUsageRatio,
        temperatureTendency,
    };
}
// ─── Audio Processing Analysis ──────────────────────────────────
function extractAudioProcessing(timeline) {
    const allClips = getAllClips(timeline);
    const audioClips = allClips.filter((c) => 'fadeInDuration' in c || 'fadeOutDuration' in c);
    if (audioClips.length === 0) {
        return {
            avgTargetLoudness: -14,
            loudnessStddev: 0,
            avgFadeInSec: 0,
            avgFadeOutSec: 0,
            musicSpeechRatio: 0.5,
            crossfadeRatio: 0,
        };
    }
    const fadeInDurations = audioClips
        .map((c) => ('fadeInDuration' in c ? c.fadeInDuration : 0))
        .filter((d) => d > 0);
    const fadeOutDurations = audioClips
        .map((c) => ('fadeOutDuration' in c ? c.fadeOutDuration : 0))
        .filter((d) => d > 0);
    // Volume analysis
    const volumes = allClips
        .map((c) => ('volume' in c ? c.volume : 1))
        .filter((v) => v >= 0);
    // Crossfade detection: transitions between audio tracks
    const transitions = timeline.transitions ?? [];
    const crossfadeCount = transitions.filter((t) => t.duration > 0).length;
    const crossfadeRatio = transitions.length > 0
        ? round(crossfadeCount / transitions.length, 3)
        : 0;
    // Estimate music/speech ratio from track types
    const audioTracks = timeline.tracks.filter((t) => t.type === 'audio');
    const musicTracks = audioTracks.filter((t) => t.name.toLowerCase().includes('music'));
    const musicSpeechRatio = audioTracks.length > 0
        ? round(musicTracks.length / audioTracks.length, 3)
        : 0.5;
    return {
        avgTargetLoudness: round(calcMean(volumes.map((v) => 20 * Math.log10(Math.max(v, 0.001)))), 1),
        loudnessStddev: round(calcStddev(volumes.map((v) => 20 * Math.log10(Math.max(v, 0.001)))), 1),
        avgFadeInSec: round(calcMean(fadeInDurations), 3),
        avgFadeOutSec: round(calcMean(fadeOutDurations), 3),
        musicSpeechRatio,
        crossfadeRatio,
    };
}
// ─── Effect Usage Analysis ──────────────────────────────────────
function extractEffectPatterns(timeline) {
    const allClips = getAllClips(timeline);
    const allEffects = allClips.flatMap((c) => ('effects' in c ? (c.effects ?? []) : []));
    if (allEffects.length === 0)
        return [];
    const byType = new Map();
    for (const e of allEffects) {
        const existing = byType.get(e.type) ?? [];
        existing.push(e);
        byType.set(e.type, existing);
    }
    const total = allEffects.length;
    return Array.from(byType.entries())
        .map(([type, items]) => {
        // Average numeric params
        const avgParams = {};
        const paramKeys = new Set();
        for (const item of items) {
            for (const key of Object.keys(item.params)) {
                paramKeys.add(key);
            }
        }
        for (const key of paramKeys) {
            const numericVals = items
                .map((i) => i.params[key])
                .filter((v) => typeof v === 'number' && Number.isFinite(v));
            if (numericVals.length > 0) {
                avgParams[key] = round(calcMean(numericVals), 3);
            }
        }
        const enabledCount = items.filter((i) => i.enabled).length;
        return {
            type,
            totalCount: items.length,
            ratio: round(items.length / total, 3),
            avgParams,
            typicallyEnabled: enabledCount > items.length / 2,
        };
    })
        .sort((a, b) => b.totalCount - a.totalCount);
}
// ─── Tag Generation ─────────────────────────────────────────────
function generateStyleTags(fp) {
    const tags = [];
    // Rhythm tags
    if (fp.rhythm.cutsPerMinute > 20)
        tags.push('fast-paced');
    else if (fp.rhythm.cutsPerMinute > 10)
        tags.push('medium-paced');
    else
        tags.push('slow-paced');
    if (fp.rhythm.regularity > 0.7)
        tags.push('rhythmic');
    if (fp.rhythm.shortClipRatio > 0.3)
        tags.push('dynamic');
    if (fp.rhythm.longClipRatio > 0.3)
        tags.push('contemplative');
    // Color tags
    tags.push(fp.colorGrading.temperatureTendency + '-tones');
    if (fp.colorGrading.saturation.mean > 20)
        tags.push('vivid');
    if (fp.colorGrading.saturation.mean < -10)
        tags.push('desaturated');
    if (fp.colorGrading.contrast.mean > 15)
        tags.push('high-contrast');
    if (fp.colorGrading.lutUsageRatio > 0.5)
        tags.push('lut-heavy');
    // Transition tags
    if (fp.transitions.length > 0) {
        const topTransition = fp.transitions[0];
        if (topTransition.ratio > 0.5)
            tags.push(`${topTransition.type}-transitions`);
    }
    // Effect tags
    if (fp.effects.length > 0) {
        tags.push(`${fp.effects[0].type}-effects`);
    }
    return [...new Set(tags)];
}
// ─── Helpers ────────────────────────────────────────────────────
function getAllClips(timeline) {
    return timeline.tracks.flatMap((t) => t.clips);
}
function findMode(values) {
    if (values.length === 0)
        return null;
    const counts = new Map();
    for (const v of values) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let maxCount = 0;
    let mode = null;
    for (const [v, count] of counts) {
        if (count > maxCount) {
            maxCount = count;
            mode = v;
        }
    }
    return mode;
}
function generateId() {
    return `style-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
// ─── Public API ─────────────────────────────────────────────────
/**
 * Extract a style fingerprint from a single project.
 */
export function extractProjectStyle(project, options) {
    const opts = { ...DEFAULT_EXTRACTION_OPTIONS, ...options };
    const timeline = project.timeline;
    const allClips = getAllClips(timeline);
    if (allClips.length < opts.minClipCount)
        return null;
    const totalDuration = allClips.reduce((s, c) => s + c.duration, 0);
    const transitions = extractTransitions(timeline);
    const rhythm = extractRhythm(timeline, opts);
    const colorGrading = extractColorGrading(timeline);
    const audioProcessing = extractAudioProcessing(timeline);
    const effects = extractEffectPatterns(timeline);
    const now = new Date().toISOString();
    const fp = {
        version: STYLE_FINGERPRINT_VERSION,
        id: generateId(),
        name: project.name,
        createdAt: now,
        updatedAt: now,
        analyzedProjectCount: 1,
        totalClipCount: allClips.length,
        totalDurationSec: round(totalDuration, 2),
        transitions,
        rhythm,
        colorGrading,
        audioProcessing,
        effects,
    };
    return { ...fp, tags: generateStyleTags(fp) };
}
/**
 * Merge multiple style fingerprints into a composite profile.
 * Weights by clip count for each dimension.
 */
export function mergeStyleFingerprints(fingerprints, name) {
    if (fingerprints.length === 0)
        return null;
    if (fingerprints.length === 1) {
        return { ...fingerprints[0], name: name ?? fingerprints[0].name };
    }
    const totalClips = fingerprints.reduce((s, f) => s + f.totalClipCount, 0);
    const totalDuration = fingerprints.reduce((s, f) => s + f.totalDurationSec, 0);
    const projectCount = fingerprints.reduce((s, f) => s + f.analyzedProjectCount, 0);
    // Weighted merge for rhythm
    const weightedAvgClipDuration = weightedMean(fingerprints.map((f) => f.rhythm.avgClipDurationSec), fingerprints.map((f) => f.totalClipCount));
    const weightedCutsPerMinute = weightedMean(fingerprints.map((f) => f.rhythm.cutsPerMinute), fingerprints.map((f) => f.totalClipCount));
    // Merge transitions
    const transitionMap = new Map();
    for (const fp of fingerprints) {
        for (const t of fp.transitions) {
            const existing = transitionMap.get(t.type) ?? { count: 0, durations: [] };
            existing.count += t.count;
            existing.durations.push(t.avgDurationSec);
            transitionMap.set(t.type, existing);
        }
    }
    const totalTransitions = Array.from(transitionMap.values()).reduce((s, v) => s + v.count, 0);
    const mergedTransitions = Array.from(transitionMap.entries())
        .map(([type, data]) => ({
        type: type,
        count: data.count,
        avgDurationSec: round(calcMean(data.durations), 3),
        durationStddev: 0,
        ratio: round(data.count / Math.max(totalTransitions, 1), 3),
    }))
        .sort((a, b) => b.count - a.count);
    // Merge color grading
    const cg = mergeColorGrading(fingerprints);
    // Merge audio
    const audio = mergeAudioProcessing(fingerprints);
    // Merge effects
    const effectMap = new Map();
    for (const fp of fingerprints) {
        for (const e of fp.effects) {
            const existing = effectMap.get(e.type) ?? { count: 0, params: {} };
            existing.count += e.totalCount;
            for (const [k, v] of Object.entries(e.avgParams)) {
                existing.params[k] = [...(existing.params[k] ?? []), v];
            }
            effectMap.set(e.type, existing);
        }
    }
    const totalEffects = Array.from(effectMap.values()).reduce((s, v) => s + v.count, 0);
    const mergedEffects = Array.from(effectMap.entries())
        .map(([type, data]) => ({
        type: type,
        totalCount: data.count,
        ratio: round(data.count / Math.max(totalEffects, 1), 3),
        avgParams: Object.fromEntries(Object.entries(data.params).map(([k, v]) => [k, round(calcMean(v), 3)])),
        typicallyEnabled: true,
    }))
        .sort((a, b) => b.totalCount - a.totalCount);
    // Merge rhythm histogram
    const maxBins = Math.max(...fingerprints.map((f) => f.rhythm.durationHistogram.length));
    const mergedHistogram = new Array(maxBins).fill(0);
    for (const fp of fingerprints) {
        for (let i = 0; i < fp.rhythm.durationHistogram.length; i++) {
            mergedHistogram[i] += fp.rhythm.durationHistogram[i];
        }
    }
    const now = new Date().toISOString();
    const base = {
        version: STYLE_FINGERPRINT_VERSION,
        id: generateId(),
        name: name ?? `Merged Style (${fingerprints.length} projects)`,
        createdAt: now,
        updatedAt: now,
        analyzedProjectCount: projectCount,
        totalClipCount: totalClips,
        totalDurationSec: round(totalDuration, 2),
        transitions: mergedTransitions,
        rhythm: {
            avgClipDurationSec: round(weightedAvgClipDuration, 3),
            clipDurationStddev: 0,
            cutsPerMinute: round(weightedCutsPerMinute, 2),
            regularity: round(weightedMean(fingerprints.map((f) => f.rhythm.regularity), fingerprints.map((f) => f.totalClipCount)), 3),
            durationHistogram: mergedHistogram,
            shortClipRatio: round(weightedMean(fingerprints.map((f) => f.rhythm.shortClipRatio), fingerprints.map((f) => f.totalClipCount)), 3),
            longClipRatio: round(weightedMean(fingerprints.map((f) => f.rhythm.longClipRatio), fingerprints.map((f) => f.totalClipCount)), 3),
        },
        colorGrading: cg,
        audioProcessing: audio,
        effects: mergedEffects,
    };
    return { ...base, tags: generateStyleTags(base) };
}
/**
 * Apply a style fingerprint to an editing plan's parameters.
 * Returns modified instructions with style-informed adjustments.
 */
export function applyStyleToInstructions(instructions, style, strength = 0.7) {
    const clampedStrength = clamp01(strength);
    return instructions.map((inst) => {
        const params = { ...inst.params };
        if (inst.action === 'add_transition' && style.transitions.length > 0) {
            const top = style.transitions[0];
            if (!params.type || typeof params.type !== 'string') {
                params.type = top.type;
            }
            if (params.duration === undefined) {
                params.duration = round(top.avgDurationSec * clampedStrength, 3);
            }
        }
        if (inst.action === 'adjust_audio') {
            if (params.fadeIn === undefined && style.audioProcessing.avgFadeInSec > 0) {
                params.fadeIn = round(style.audioProcessing.avgFadeInSec * clampedStrength, 3);
            }
            if (params.fadeOut === undefined && style.audioProcessing.avgFadeOutSec > 0) {
                params.fadeOut = round(style.audioProcessing.avgFadeOutSec * clampedStrength, 3);
            }
        }
        if (inst.action === 'add_effect' && style.effects.length > 0) {
            const topEffect = style.effects[0];
            if (!params.effectType) {
                params.effectType = topEffect.type;
                params.enabled = topEffect.typicallyEnabled;
                for (const [k, v] of Object.entries(topEffect.avgParams)) {
                    if (params[k] === undefined) {
                        params[k] = round(v * clampedStrength, 3);
                    }
                }
            }
        }
        return { action: inst.action, params };
    });
}
/**
 * Compute similarity between two style fingerprints (0-1).
 */
export function computeStyleSimilarity(a, b) {
    const weights = { rhythm: 0.3, color: 0.3, transitions: 0.2, audio: 0.1, effects: 0.1 };
    // Rhythm similarity
    const rhythmSim = 1 - Math.min(Math.abs(a.rhythm.avgClipDurationSec - b.rhythm.avgClipDurationSec) /
        Math.max(a.rhythm.avgClipDurationSec, b.rhythm.avgClipDurationSec, 1), 1);
    // Color similarity
    const colorFields = [
        'brightness',
        'contrast',
        'saturation',
    ];
    const colorSim = colorFields.reduce((sum, field) => {
        const diff = Math.abs(a.colorGrading[field].mean - b.colorGrading[field].mean);
        return sum + Math.max(0, 1 - diff / 100);
    }, 0) / colorFields.length;
    // Transition similarity (Jaccard on types)
    const aTypes = new Set(a.transitions.map((t) => t.type));
    const bTypes = new Set(b.transitions.map((t) => t.type));
    const intersection = [...aTypes].filter((t) => bTypes.has(t)).length;
    const union = new Set([...aTypes, ...bTypes]).size;
    const transSim = union > 0 ? intersection / union : 1;
    // Audio similarity
    const audioSim = 1 - Math.min(Math.abs(a.audioProcessing.avgTargetLoudness - b.audioProcessing.avgTargetLoudness) / 20, 1);
    // Effect similarity
    const aEffectTypes = new Set(a.effects.map((e) => e.type));
    const bEffectTypes = new Set(b.effects.map((e) => e.type));
    const effectIntersection = [...aEffectTypes].filter((e) => bEffectTypes.has(e)).length;
    const effectUnion = new Set([...aEffectTypes, ...bEffectTypes]).size;
    const effectSim = effectUnion > 0 ? effectIntersection / effectUnion : 1;
    return round(weights.rhythm * rhythmSim +
        weights.color * colorSim +
        weights.transitions * transSim +
        weights.audio * audioSim +
        weights.effects * effectSim, 3);
}
/**
 * Convert a StyleSummary (from style-transfer.ts) to a partial StyleFingerprint.
 * Useful for lightweight style comparison without full project analysis.
 */
export function summaryToFingerprint(summary, name = 'Imported Style') {
    return {
        version: STYLE_FINGERPRINT_VERSION,
        name,
        totalClipCount: summary.clipCount,
        colorGrading: {
            brightness: summary.color.brightness,
            contrast: summary.color.contrast,
            saturation: summary.color.saturation,
            hue: summary.color.hue,
            preferredLutPath: summary.lutPath ?? null,
            lutUsageRatio: summary.lutPath ? 1 : 0,
            temperatureTendency: 'neutral',
        },
        effects: summary.effects.map((e) => ({
            type: e.type,
            totalCount: e.count,
            ratio: 0,
            avgParams: Object.fromEntries(Object.entries(e.params)
                .filter(([, v]) => v.kind === 'number')
                .map(([k, v]) => [k, v.mean])),
            typicallyEnabled: e.enabledRatio > 0.5,
        })),
    };
}
// ─── Internal Merge Helpers ─────────────────────────────────────
function weightedMean(values, weights) {
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    if (totalWeight === 0)
        return 0;
    return values.reduce((sum, v, i) => sum + v * weights[i], 0) / totalWeight;
}
function mergeColorGrading(fps) {
    const weights = fps.map((f) => f.totalClipCount);
    const cg = (field) => ({
        mean: round(weightedMean(fps.map((f) => f.colorGrading[field].mean), weights), 2),
        stddev: round(weightedMean(fps.map((f) => f.colorGrading[field].stddev), weights), 2),
        count: fps.reduce((s, f) => s + f.colorGrading[field].count, 0),
    });
    const lutPaths = fps
        .map((f) => f.colorGrading.preferredLutPath)
        .filter((p) => p !== null);
    const totalLutUsage = fps.reduce((s, f) => s + f.colorGrading.lutUsageRatio * f.totalClipCount, 0);
    const totalClips = fps.reduce((s, f) => s + f.totalClipCount, 0);
    const hueMean = cg('hue').mean;
    const temperatureTendency = hueMean > 10 ? 'warm' : hueMean < -10 ? 'cool' : 'neutral';
    return {
        brightness: cg('brightness'),
        contrast: cg('contrast'),
        saturation: cg('saturation'),
        hue: cg('hue'),
        preferredLutPath: lutPaths.length > 0 ? findMode(lutPaths) : null,
        lutUsageRatio: totalClips > 0 ? round(totalLutUsage / totalClips, 3) : 0,
        temperatureTendency,
    };
}
function mergeAudioProcessing(fps) {
    const weights = fps.map((f) => f.totalClipCount);
    return {
        avgTargetLoudness: round(weightedMean(fps.map((f) => f.audioProcessing.avgTargetLoudness), weights), 1),
        loudnessStddev: round(weightedMean(fps.map((f) => f.audioProcessing.loudnessStddev), weights), 1),
        avgFadeInSec: round(weightedMean(fps.map((f) => f.audioProcessing.avgFadeInSec), weights), 3),
        avgFadeOutSec: round(weightedMean(fps.map((f) => f.audioProcessing.avgFadeOutSec), weights), 3),
        musicSpeechRatio: round(weightedMean(fps.map((f) => f.audioProcessing.musicSpeechRatio), weights), 3),
        crossfadeRatio: round(weightedMean(fps.map((f) => f.audioProcessing.crossfadeRatio), weights), 3),
    };
}
//# sourceMappingURL=style-analyzer.js.map