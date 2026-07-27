import { round, clamp } from '../time';
import { createId, normalizeChromaKey, normalizeStabilization, normalizeAudioDenoise, normalizeVideoRestoration, normalizeClipProjection, normalizeClipPanoramaView, normalizeMasks, normalizeMotionTrack, normalizeClipBorder, normalizeMulticamSequence, normalizeSequenceFrameRate } from './clip-normalize';
import { normalizeAudioRestoration } from '../audio-restoration';
import { normalizeMotionGraphic } from '../motion-graphics';
import { normalizeClipPitchData } from '../audio-pitch';
import { normalizeDataSubtitleSource } from '../data-subtitle';
import { createBus } from '../audio/mixer-types';
import { DEFAULT_COLLABORATION_NOTE_AUTHOR, DEFAULT_TIMELINE_MARKER_COLOR, DEFAULT_TIMELINE_NOTE_COLOR, TIMELINE_NOTE_COLORS } from './defaults';
import { normalizeQualityEnhancement } from './clip-normalize';
import { finiteOrDefault } from '../math-utils';
export function serializeLegacyProject(project) {
    return {
        version: '0.1',
        project: {
            id: project.id,
            name: project.name,
            createdAt: project.createdAt,
            updatedAt: new Date().toISOString(),
            settings: { ...project.settings },
        },
        assets: project.media.map((asset) => ({ ...asset })),
        timeline: {
            markers: project.timeline.markers?.map((marker) => ({ ...marker })) ?? [],
            transitions: project.timeline.transitions?.map((transition) => ({ ...transition })) ?? [],
            tracks: project.timeline.tracks.map((track) => ({
                ...track,
                clips: track.clips.map((clip) => ({
                    ...clip,
                    transform: { ...clip.transform },
                    chromaKey: normalizeChromaKey(clip.chromaKey),
                    stabilization: normalizeStabilization(clip.stabilization),
                    audioDenoise: normalizeAudioDenoise(clip.audioDenoise),
                    audioRestoration: normalizeAudioRestoration(clip.audioRestoration),
                    videoRestoration: normalizeVideoRestoration(clip.videoRestoration),
                    qualityEnhancement: normalizeQualityEnhancement(clip.qualityEnhancement),
                    projection: normalizeClipProjection(clip.projection),
                    panorama: normalizeClipPanoramaView(clip.panorama),
                    masks: normalizeMasks(clip.masks),
                    motionTrack: normalizeMotionTrack(clip.motionTrack, clip.duration),
                    border: normalizeClipBorder(clip.border),
                    multicam: clip.type === 'nested-sequence' ? normalizeMulticamSequence(clip.multicam, clip.duration) : undefined,
                    ...(clip.type === 'motion-graphic'
                        ? { motionGraphic: normalizeMotionGraphic(clip.motionGraphic, clip.duration) }
                        : {}),
                    sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
                    keyframes: cloneClipKeyframesLocal(clip.keyframes),
                    pitchData: normalizeClipPitchData(clip.pitchData),
                    dataSubtitle: clip.type === 'subtitle' ? normalizeDataSubtitleSource(clip.dataSubtitle) : undefined,
                    readingSpeedWarning: clip.type === 'subtitle'
                        ? normalizeReadingSpeedWarning(clip.readingSpeedWarning)
                        : undefined,
                })),
                musicStructure: normalizeMusicStructurePoints(track.musicStructure),
            })),
            continuityWarnings: normalizeContinuityWarnings(project.timeline.continuityWarnings),
        },
    };
}
export function normalizeTimelineMarkerTime(time, maxTime) {
    return normalizeTimelinePointTime(time, maxTime);
}
export function normalizeTimelinePointTime(time, maxTime) {
    const finiteTime = typeof time === 'number' && Number.isFinite(time) ? time : 0;
    const upperBound = typeof maxTime === 'number' && Number.isFinite(maxTime) ? Math.max(0, maxTime) : undefined;
    return round(Math.min(upperBound ?? finiteTime, Math.max(0, finiteTime)));
}
export function normalizeTimelineMarkerLabel(label) {
    const trimmed = label?.trim();
    return trimmed ? trimmed.slice(0, 80) : 'Marker';
}
export function normalizeTimelineBookmarkNote(note) {
    const trimmed = note?.trim();
    return trimmed ? trimmed.slice(0, 120) : 'Bookmark';
}
export function normalizeBookmarkAnnotation(annotation) {
    const trimmed = annotation?.trim();
    if (!trimmed) {
        return undefined;
    }
    return trimmed.slice(0, 50);
}
export function normalizeTimelineMarkerColor(color) {
    return normalizeHexColor(color, DEFAULT_TIMELINE_MARKER_COLOR);
}
export function normalizeProjectAnnotationText(text) {
    const trimmed = text?.trim();
    return trimmed ? trimmed.slice(0, 240) : 'Annotation';
}
export function normalizeReviewAnnotationText(text) {
    const trimmed = text?.trim();
    return trimmed ? trimmed.slice(0, 240) : 'Review annotation';
}
export function normalizeCollaborationNoteText(text) {
    const trimmed = text?.trim();
    return trimmed ? trimmed.slice(0, 2000) : 'Collaboration note';
}
export function normalizeCollaborationAuthorName(name) {
    const trimmed = name?.trim();
    return trimmed ? trimmed.slice(0, 80) : DEFAULT_COLLABORATION_NOTE_AUTHOR;
}
export function normalizeTimelineNoteText(text) {
    const trimmed = text?.trim();
    return trimmed ? trimmed.slice(0, 240) : 'Timeline note';
}
export function normalizeCollaborationNoteType(type) {
    return type === 'highlight' || type === 'replacement' || type === 'comment' ? type : 'comment';
}
export function normalizeReviewAnnotationType(type) {
    return type === 'rectangle' || type === 'arrow' || type === 'text' ? type : 'text';
}
export function normalizeReviewAnnotationUnit(value, fallback) {
    return round(Math.min(1, Math.max(0, finiteOrDefault(value, fallback))));
}
export function normalizeReviewAnnotationDimension(value, type, axis) {
    const fallback = type === 'text' ? (axis === 'width' ? 0.22 : 0.08) : type === 'arrow' ? 0.12 : 0.18;
    const finite = finiteOrDefault(value, fallback);
    if (type === 'arrow') {
        return round(Math.min(1, Math.max(-1, finite || fallback)));
    }
    return round(Math.min(1, Math.max(0.01, Math.abs(finite || fallback))));
}
export function normalizeTimelineNoteColor(color) {
    const normalized = normalizeHexColor(color, DEFAULT_TIMELINE_NOTE_COLOR);
    return TIMELINE_NOTE_COLORS.includes(normalized) ? normalized : DEFAULT_TIMELINE_NOTE_COLOR;
}
export function normalizeIsoDate(value) {
    if (value && Number.isFinite(Date.parse(value))) {
        return new Date(value).toISOString();
    }
    return new Date().toISOString();
}
export function normalizeExportRangeLabel(label) {
    const trimmed = label?.trim();
    return trimmed ? trimmed.slice(0, 80) : 'Export Range';
}
export function normalizeProtectedRangeLabel(label) {
    const trimmed = label?.trim();
    return trimmed ? trimmed.slice(0, 80) : 'Protected Range';
}
export function normalizeHexColor(color, fallback) {
    const trimmed = color?.trim();
    if (!trimmed)
        return fallback;
    const six = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
    if (six)
        return `#${six[1].toLowerCase()}`;
    const three = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
    if (three) {
        const [r, g, b] = three[1].toLowerCase();
        return `#${r}${r}${g}${g}${b}${b}`;
    }
    return fallback;
}
export { normalizeOptionalHexColor } from '../math-utils';
export function normalizeLutPath(path) {
    const trimmed = path?.trim();
    return trimmed ? trimmed : null;
}
export function normalizeLutLayers(luts, lutPath) {
    // If luts array is explicitly provided, normalize it (max 3, filter intensity=0)
    if (luts && luts.length > 0) {
        return luts
            .slice(0, 3)
            .map((l) => ({
            path: (typeof l.path === 'string' ? l.path.trim() : '') || '',
            intensity: round(Math.min(1, Math.max(0, typeof l.intensity === 'number' ? l.intensity : 1))),
        }))
            .filter((l) => l.path.length > 0);
    }
    // Backward compat: upgrade legacy lutPath string to single LUTLayer
    const normalizedPath = normalizeLutPath(lutPath);
    if (normalizedPath) {
        return [{ path: normalizedPath, intensity: 1 }];
    }
    return [];
}
export function normalizeClipAIReframe(value) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const obj = value;
    const targetAspect = typeof obj.targetAspect === 'string' ? obj.targetAspect : undefined;
    const confidence = typeof obj.confidence === 'number' && Number.isFinite(obj.confidence) ? obj.confidence : undefined;
    const generatedAt = typeof obj.generatedAt === 'number' && Number.isFinite(obj.generatedAt) ? obj.generatedAt : undefined;
    if (!targetAspect || confidence === undefined || generatedAt === undefined) {
        return undefined;
    }
    if (!Array.isArray(obj.keyframes)) {
        return undefined;
    }
    const keyframes = [];
    for (const kf of obj.keyframes) {
        if (!kf || typeof kf !== 'object')
            continue;
        const k = kf;
        const time = typeof k.time === 'number' ? k.time : undefined;
        const cropX = typeof k.cropX === 'number' ? k.cropX : undefined;
        const cropY = typeof k.cropY === 'number' ? k.cropY : undefined;
        const cropW = typeof k.cropW === 'number' ? k.cropW : undefined;
        const cropH = typeof k.cropH === 'number' ? k.cropH : undefined;
        if (time !== undefined &&
            cropX !== undefined &&
            cropY !== undefined &&
            cropW !== undefined &&
            cropH !== undefined) {
            keyframes.push({ time, cropX, cropY, cropW, cropH });
        }
    }
    if (keyframes.length === 0) {
        return undefined;
    }
    return { targetAspect, keyframes, confidence: Math.min(1, Math.max(0, confidence)), generatedAt };
}
export function normalizeAnomalyIntervals(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const validTypes = new Set(['black', 'static']);
    const validSeverities = new Set(['low', 'medium', 'high']);
    const result = [];
    for (const item of value) {
        if (!item || typeof item !== 'object')
            continue;
        const r = item;
        const typ = validTypes.has(r.type) ? r.type : undefined;
        const startTime = typeof r.startTime === 'number' ? r.startTime : undefined;
        const endTime = typeof r.endTime === 'number' ? r.endTime : undefined;
        const severity = validSeverities.has(r.severity) ? r.severity : undefined;
        if (typ !== undefined &&
            startTime !== undefined &&
            endTime !== undefined &&
            severity !== undefined &&
            endTime > startTime) {
            result.push({ type: typ, startTime, endTime, severity });
        }
    }
    return result;
}
export function normalizeSubtitleSpeakerId(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value !== Math.floor(value)) {
        return undefined;
    }
    return value;
}
export function normalizeSpeakerLabels(value) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const result = {};
    let hasEntries = false;
    for (const [key, val] of Object.entries(value)) {
        const numKey = Number(key);
        if (!Number.isFinite(numKey) || numKey < 0 || numKey !== Math.floor(numKey))
            continue;
        if (typeof val !== 'string')
            continue;
        result[numKey] = val;
        hasEntries = true;
    }
    return hasEntries ? result : undefined;
}
export function cloneClipKeyframesLocal(keyframes) {
    if (!keyframes) {
        return undefined;
    }
    const output = {};
    for (const property of Object.keys(keyframes)) {
        const frames = keyframes[property];
        if (frames?.length) {
            output[property] = frames.map((frame) => ({
                ...frame,
                ...(frame.inHandle ? { inHandle: { ...frame.inHandle } } : {}),
                ...(frame.outHandle ? { outHandle: { ...frame.outHandle } } : {}),
            }));
        }
    }
    return Object.keys(output).length > 0 ? output : undefined;
}
export function normalizePrivacyRedactions(input) {
    if (!Array.isArray(input))
        return [];
    return input
        .filter((r) => r != null && typeof r === 'object')
        .filter((r) => typeof r.id === 'string' && (r.type === 'face' || r.type === 'license_plate' || r.type === 'screen'))
        .map((r) => ({
        id: r.id,
        type: r.type,
        keyframes: Array.isArray(r.keyframes)
            ? r.keyframes
                .filter((k) => k != null && typeof k === 'object' && typeof k.time === 'number')
                .map((k) => ({
                time: round(Math.max(0, k.time)),
                x: round(Math.min(1, Math.max(0, typeof k.x === 'number' ? k.x : 0))),
                y: round(Math.min(1, Math.max(0, typeof k.y === 'number' ? k.y : 0))),
                w: round(Math.min(1, Math.max(0.001, typeof k.w === 'number' ? k.w : 0.1))),
                h: round(Math.min(1, Math.max(0.001, typeof k.h === 'number' ? k.h : 0.1))),
            }))
                .sort((a, b) => a.time - b.time)
            : [],
        blurStrength: typeof r.blurStrength === 'number' && Number.isFinite(r.blurStrength)
            ? Math.min(1, Math.max(0, r.blurStrength))
            : 1,
        enabled: r.enabled !== false,
    }));
}
export function normalizeAILookMatch(input) {
    if (!input || typeof input !== 'object')
        return undefined;
    const obj = input;
    if (typeof obj.sourceImageHash !== 'string' || !obj.sourceImageHash)
        return undefined;
    if (!obj.wheelAdjustments || typeof obj.wheelAdjustments !== 'object')
        return undefined;
    const wa = obj.wheelAdjustments;
    const parseRgb = (v) => {
        if (!v || typeof v !== 'object')
            return { r: 0, g: 0, b: 0 };
        const o = v;
        return {
            r: typeof o.r === 'number' ? o.r : 0,
            g: typeof o.g === 'number' ? o.g : 0,
            b: typeof o.b === 'number' ? o.b : 0,
        };
    };
    const clampWheel = (v) => ({
        r: round(Math.min(1, Math.max(-1, v.r))),
        g: round(Math.min(1, Math.max(-1, v.g))),
        b: round(Math.min(1, Math.max(-1, v.b))),
    });
    return {
        sourceImageHash: obj.sourceImageHash,
        wheelAdjustments: {
            lift: clampWheel(parseRgb(wa.lift)),
            gamma: clampWheel(parseRgb(wa.gamma)),
            gain: clampWheel(parseRgb(wa.gain)),
        },
        curveControlPoints: typeof obj.curveControlPoints === 'object' && obj.curveControlPoints
            ? obj.curveControlPoints
            : {
                master: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                r: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                g: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                b: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
            },
        confidence: typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
            ? Math.min(1, Math.max(0, obj.confidence))
            : 0,
        generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : new Date().toISOString(),
        blendStrength: typeof obj.blendStrength === 'number' && Number.isFinite(obj.blendStrength)
            ? Math.min(100, Math.max(0, obj.blendStrength))
            : 100,
    };
}
export function normalizeAiPipSuggestion(input) {
    if (!input || typeof input !== 'object')
        return undefined;
    const obj = input;
    const validCorners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const corner = validCorners.includes(obj.recommendedCorner)
        ? obj.recommendedCorner
        : 'bottom-right';
    return {
        recommendedCorner: corner,
        overlapReduction: typeof obj.overlapReduction === 'number' && Number.isFinite(obj.overlapReduction)
            ? round(Math.min(100, Math.max(0, obj.overlapReduction)))
            : 0,
        confidence: typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
            ? round(Math.min(1, Math.max(0, obj.confidence)))
            : 0.5,
    };
}
export function normalizePlatformFitSuggestion(input) {
    if (!input || typeof input !== 'object')
        return undefined;
    const obj = input;
    const validPlatforms = ['tiktok', 'reels', 'shorts', 'custom'];
    const platform = validPlatforms.includes(obj.targetPlatform)
        ? obj.targetPlatform
        : 'custom';
    const limitSeconds = typeof obj.limitSeconds === 'number' && Number.isFinite(obj.limitSeconds) && obj.limitSeconds > 0
        ? round(obj.limitSeconds)
        : 60;
    const normalizeSegments = (segs) => {
        if (!Array.isArray(segs))
            return [];
        return segs
            .filter((s) => s != null &&
            typeof s === 'object' &&
            typeof s.clipId === 'string' &&
            typeof s.start === 'number' &&
            typeof s.end === 'number')
            .map((s) => ({
            clipId: s.clipId.trim(),
            start: round(Math.max(0, s.start)),
            end: round(Math.max(0, s.end)),
            score: typeof s.score === 'number' && Number.isFinite(s.score)
                ? round(Math.min(1, Math.max(0, s.score)))
                : 0.5,
        }))
            .filter((s) => s.clipId.length > 0 && s.end > s.start);
    };
    return {
        targetPlatform: platform,
        limitSeconds,
        keptSegments: normalizeSegments(obj.keptSegments),
        removedSegments: normalizeSegments(obj.removedSegments),
    };
}
/** Normalize flash warnings array */
export function normalizeFlashWarnings(input) {
    if (!Array.isArray(input))
        return [];
    return input.filter((w) => w != null &&
        typeof w === 'object' &&
        typeof w.startTime === 'number' &&
        typeof w.endTime === 'number' &&
        typeof w.flashRate === 'number' &&
        typeof w.severity === 'string' &&
        typeof w.isRedFlash === 'boolean');
}
/** Normalize reading speed warning */
export function normalizeReadingSpeedWarning(input) {
    if (!input || typeof input !== 'object')
        return null;
    const obj = input;
    if (typeof obj.charsPerSecond !== 'number' ||
        typeof obj.recommendedMax !== 'number' ||
        typeof obj.severity !== 'string')
        return null;
    const validSeverities = ['ok', 'warning', 'critical'];
    if (!validSeverities.includes(obj.severity))
        return null;
    return {
        charsPerSecond: obj.charsPerSecond,
        recommendedMax: obj.recommendedMax,
        severity: obj.severity,
    };
}
/** Normalize music structure points */
export function normalizeMusicStructurePoints(input) {
    if (!Array.isArray(input))
        return [];
    return input.filter((p) => p != null &&
        typeof p === 'object' &&
        typeof p.time === 'number' &&
        typeof p.type === 'string' &&
        typeof p.confidence === 'number');
}
/** Normalize continuity warnings */
export function normalizeContinuityWarnings(input) {
    if (!Array.isArray(input))
        return [];
    return input.filter((w) => w != null &&
        typeof w === 'object' &&
        typeof w.clipAId === 'string' &&
        typeof w.clipBId === 'string' &&
        typeof w.type === 'string' &&
        typeof w.confidence === 'number' &&
        typeof w.reason === 'string');
}
/** Normalize mixer bus */
export function normalizeBus(raw) {
    return {
        id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id : createId('bus'),
        name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Bus',
        type: raw?.type === 'submix' || raw?.type === 'send' || raw?.type === 'aux' || raw?.type === 'master'
            ? raw.type
            : 'submix',
        effectsChain: Array.isArray(raw?.effectsChain) ? raw.effectsChain : [],
        volume: typeof raw?.volume === 'number' && Number.isFinite(raw.volume) ? raw.volume : 0,
        pan: typeof raw?.pan === 'number' && Number.isFinite(raw.pan) ? clamp(raw.pan, -100, 100) : 0,
        muted: !!raw?.muted,
        outputBusId: raw?.outputBusId ?? null,
    };
}
/** Normalize mixer channel */
export function normalizeMixerChannel(raw) {
    return {
        trackId: typeof raw?.trackId === 'string' ? raw.trackId : '',
        name: typeof raw?.name === 'string' ? raw.name : '',
        volume: typeof raw?.volume === 'number' && Number.isFinite(raw.volume) ? raw.volume : 0,
        pan: typeof raw?.pan === 'number' && Number.isFinite(raw.pan) ? clamp(raw.pan, -100, 100) : 0,
        muted: !!raw?.muted,
        solo: !!raw?.solo,
        busAssignments: Array.isArray(raw?.busAssignments) ? raw.busAssignments : [],
        inputBus: typeof raw?.inputBus === 'string' ? raw.inputBus : null,
        effectsChain: Array.isArray(raw?.effectsChain) ? raw.effectsChain : [],
        automation: raw?.automation ?? {},
        metering: raw?.metering ?? { peakLevel: -60, rmsLevel: -60, clipCount: 0 },
    };
}
/** Normalize mixer state */
export function normalizeMixerState(raw) {
    if (!raw)
        return undefined;
    return {
        channels: Array.isArray(raw.channels) ? raw.channels.map(normalizeMixerChannel) : [],
        buses: Array.isArray(raw.buses) ? raw.buses.map(normalizeBus) : [],
        masterBus: raw.masterBus ? normalizeBus(raw.masterBus) : createBus('Master', 'master'),
    };
}
//# sourceMappingURL=annotations.js.map