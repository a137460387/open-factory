/**
 * Content-Aware Template Adaptation Engine
 *
 * Analyzes media assets (duration, visual complexity, audio features)
 * and automatically adapts EditingTemplate parameters to fit the content.
 *
 * Pipeline: analyze media -> map dimensions -> apply adjustments -> return result
 * Design: pure functions, immutable operations, no classes.
 */
import { clamp, lerp } from '../utils/math';
// ─── Constants ─────────────────────────────────────────────────────
const COMPLEXITY = { low: 0.3, medium: 0.6, high: 0.85 };
const SCALE = { min: 0.5, max: 2.0 };
const EFFECT_FACTOR = { low: 0.4, med: 1.0, high: 0.75 };
// ─── Public API ────────────────────────────────────────────────────
/**
 * Analyze a single media asset and extract content features.
 * Uses available metadata for heuristic estimation of visual/audio properties.
 */
export function analyzeMedia(media) {
    const hasAudio = media.hasAudio === true || media.type === 'audio';
    return {
        mediaId: media.id,
        durationSec: media.duration,
        width: media.width,
        height: media.height,
        frameRate: media.frameRate ?? 0,
        hasAudio,
        visualComplexity: media.type !== 'audio' ? estimateVisual(media) : null,
        audioFeatures: hasAudio ? estimateAudio(media) : null,
    };
}
/** Analyze multiple media assets. */
export function analyzeMediaBatch(assets) {
    return assets.map(analyzeMedia);
}
/**
 * Adapt a template to fit analyzed media content.
 *
 * - **Duration**: scales flexible clip durations to match media length
 * - **Visual complexity**: adjusts effect intensity to avoid over/under-processing
 * - **Audio**: adjusts volumes, ducking, fades to match source audio profile
 */
export function adaptTemplateToContent(template, analysis) {
    const changes = [];
    // Duration adaptation
    const tracks1 = adaptDurations(template.tracks, analysis.durationSec, changes);
    // Visual complexity adaptation
    const tracks2 = adaptVisualEffects(tracks1, analysis.visualComplexity, changes);
    // Audio layout adaptation
    const audioLayout = adaptAudio(template.audioLayout, analysis.audioFeatures, changes);
    const adapted = {
        ...template,
        tracks: tracks2,
        audioLayout,
        metadata: {
            ...template.metadata,
            estimatedDurationSec: analysis.durationSec,
            updatedAt: new Date().toISOString(),
        },
    };
    return {
        template: adapted,
        changes,
        adaptedDurationSec: analysis.durationSec,
        summary: buildSummary(analysis, changes.length),
    };
}
/**
 * One-click smart adaptation: selects the primary media from the project
 * (video > image > audio) and adapts the template to fit it.
 * Returns null if no suitable media exists.
 */
export function createSmartAdaptation(project, template) {
    const primary = selectPrimaryMedia(project.media);
    if (!primary)
        return null;
    return adaptTemplateToContent(template, analyzeMedia(primary));
}
// ─── Duration Adaptation ───────────────────────────────────────────
function adaptDurations(tracks, targetSec, changes) {
    const flexTotal = tracks.reduce((sum, t) => sum + t.clips.filter((c) => c.flexibleDuration).reduce((s, c) => s + c.durationSec, 0), 0);
    if (flexTotal <= 0)
        return tracks;
    const factor = clamp(targetSec / flexTotal, SCALE.min, SCALE.max);
    if (Math.abs(factor - 1.0) < 0.01)
        return tracks;
    return tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip, i) => {
            if (!clip.flexibleDuration)
                return clip;
            const newDur = r2(clip.durationSec * factor);
            if (Math.abs(newDur - clip.durationSec) < 0.01)
                return clip;
            changes.push({
                target: track.name, index: i, field: 'durationSec',
                originalValue: clip.durationSec, adaptedValue: newDur,
                reason: `Scaled ${factor.toFixed(2)}x to fit ${targetSec.toFixed(1)}s`,
            });
            return { ...clip, durationSec: newDur };
        }),
    }));
}
// ─── Visual Complexity Adaptation ──────────────────────────────────
function adaptVisualEffects(tracks, vc, changes) {
    if (!vc)
        return tracks;
    const f = effectScale(vc.overallScore);
    if (Math.abs(f - 1.0) < 0.05)
        return tracks;
    return tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip, ci) => {
            if (clip.effects.length === 0)
                return clip;
            changes.push({
                target: track.name, index: ci, field: 'effectIntensity',
                originalValue: 1.0, adaptedValue: f,
                reason: complexityReason(vc.overallScore, f),
            });
            return {
                ...clip,
                effects: clip.effects.map((e) => ({
                    ...e,
                    params: mapValues(e.params, (v) => typeof v === 'number' ? r2(v * f) : v),
                })),
            };
        }),
    }));
}
function effectScale(score) {
    if (score < COMPLEXITY.low)
        return EFFECT_FACTOR.low;
    if (score < COMPLEXITY.medium)
        return EFFECT_FACTOR.med;
    if (score < COMPLEXITY.high) {
        const t = (score - COMPLEXITY.medium) / (COMPLEXITY.high - COMPLEXITY.medium);
        return lerp(EFFECT_FACTOR.med, EFFECT_FACTOR.high, t);
    }
    return EFFECT_FACTOR.high;
}
function complexityReason(score, factor) {
    const label = score < COMPLEXITY.low ? 'Simple' : score > COMPLEXITY.high ? 'Complex' : 'Moderate';
    return `${label} footage (score ${score.toFixed(2)}): effects adjusted to ${factor.toFixed(2)}x`;
}
// ─── Audio Layout Adaptation ───────────────────────────────────────
function adaptAudio(layout, af, changes) {
    if (!af)
        return layout;
    const tracks = layout.tracks.map((t) => adaptAudioMix(t, af, changes));
    const targetLufs = af.dynamicRangeDb > 20 ? -16 : af.dynamicRangeDb > 12 ? -14 : -12;
    let masterLufs = layout.masterLoudnessTarget;
    if (Math.abs(targetLufs - masterLufs) > 1) {
        changes.push({
            target: 'master', index: -1, field: 'masterLoudnessTarget',
            originalValue: masterLufs, adaptedValue: targetLufs,
            reason: `Master LUFS adjusted to ${targetLufs} (dynamic range ${af.dynamicRangeDb.toFixed(1)} dB)`,
        });
        masterLufs = targetLufs;
    }
    return { ...layout, tracks, masterLoudnessTarget: masterLufs };
}
function adaptAudioMix(mix, af, changes) {
    let m = { ...mix };
    // Voice volume matched to source speech loudness
    if (mix.role === 'voice' && af.hasSpeech) {
        const vol = clamp(af.avgLoudnessDb, -24, -6);
        if (Math.abs(vol - mix.volumeDb) > 2) {
            changes.push({
                target: 'voice', index: -1, field: 'volumeDb',
                originalValue: mix.volumeDb, adaptedValue: vol,
                reason: `Voice volume matched to source ${vol} dB`,
            });
            m = { ...m, volumeDb: vol };
        }
    }
    // Music ducking strength for speech clarity
    if (mix.role === 'music' && af.hasSpeech && mix.duckAttenuationDb !== undefined) {
        const duck = af.dynamicRangeDb > 15 ? 12 : 8;
        if (Math.abs(duck - mix.duckAttenuationDb) > 1) {
            changes.push({
                target: 'music', index: -1, field: 'duckAttenuationDb',
                originalValue: mix.duckAttenuationDb, adaptedValue: duck,
                reason: `Music ducking set to ${duck} dB for speech clarity`,
            });
            m = { ...m, duckAttenuationDb: duck };
        }
    }
    // Fade alignment to beat interval
    if (af.beatsPerSecond > 0) {
        const fade = r2(Math.min(0.5 / af.beatsPerSecond, 2.0));
        if (Math.abs(fade - mix.fadeInSec) > 0.3) {
            changes.push({
                target: mix.role, index: -1, field: 'fadeInSec',
                originalValue: mix.fadeInSec, adaptedValue: fade,
                reason: `Fade-in aligned to beat interval`,
            });
            m = { ...m, fadeInSec: fade };
        }
        if (Math.abs(fade - mix.fadeOutSec) > 0.3) {
            changes.push({
                target: mix.role, index: -1, field: 'fadeOutSec',
                originalValue: mix.fadeOutSec, adaptedValue: fade,
                reason: `Fade-out aligned to beat interval`,
            });
            m = { ...m, fadeOutSec: fade };
        }
    }
    return m;
}
// ─── Estimation Heuristics ─────────────────────────────────────────
function estimateVisual(media) {
    const px = media.width * media.height;
    const resFactor = clamp(px / (3840 * 2160), 0, 1);
    const edge = clamp(resFactor * 0.6 + 0.2, 0, 1);
    const fps = media.frameRate ?? 30;
    const motion = clamp((fps - 15) / 45, 0.1, 0.9);
    const color = media.type === 'video' ? 0.5 : 0.3;
    const overall = edge * 0.4 + color * 0.3 + motion * 0.3;
    return { edgeDensity: r2(edge), colorVariance: r2(color), motionIntensity: r2(motion), overallScore: r2(overall) };
}
function estimateAudio(media) {
    const sr = media.audioSampleRate ?? 44100;
    const ch = media.audioChannels ?? 2;
    const band = sr >= 48000 ? 'treble' : sr >= 44100 ? 'mid' : 'bass';
    return {
        avgLoudnessDb: -14, peakLoudnessDb: -3, dynamicRangeDb: 11,
        dominantBand: band, beatsPerSecond: 0, hasSpeech: false, snrDb: ch >= 2 ? 30 : 20,
    };
}
// ─── Utilities ─────────────────────────────────────────────────────
function selectPrimaryMedia(assets) {
    return assets.find((m) => m.type === 'video' && !m.missing)
        ?? assets.find((m) => m.type === 'image' && !m.missing)
        ?? assets.find((m) => m.type === 'audio' && !m.missing)
        ?? null;
}
function buildSummary(analysis, changeCount) {
    const dur = analysis.durationSec.toFixed(1);
    const cx = analysis.visualComplexity ? `${(analysis.visualComplexity.overallScore * 100).toFixed(0)}% complexity` : 'no visual';
    return changeCount === 0
        ? `No adaptation needed for ${dur}s content (${cx})`
        : `Adapted ${dur}s content (${cx}): ${changeCount} adjustment(s)`;
}
function mapValues(obj, fn) {
    const out = {};
    for (const [k, v] of Object.entries(obj))
        out[k] = fn(v);
    return out;
}
function r2(v) {
    return Math.round(v * 100) / 100;
}
//# sourceMappingURL=template-adapter.js.map