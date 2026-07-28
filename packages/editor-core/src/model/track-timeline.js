import { round } from '../time';
import { finiteOrDefault, normalizeOptionalHexColor } from '../math-utils';
export { finiteOrDefault };
import { isDefaultColorCurves, isNeutralThreeWayColor } from '../color-grading';
import { createId, normalizeColorCorrection, } from './clip-normalize';
import { createTimelineMarker, createTimelineBookmark, createProjectAnnotation, createReviewAnnotation, createCollaborationNote, createTimelineNote, createExportRange, createProtectedRange, } from './factories';
import { DEFAULT_CHROMA_KEY, DEFAULT_COLOR_CORRECTION, DEFAULT_MASTER_VOLUME, DEFAULT_NESTED_SEQUENCE_NAME, DEFAULT_PRIMARY_SEQUENCE_NAME, DEFAULT_SUBTITLE_LANGUAGE, DEFAULT_SUBTITLE_TRACK_TYPE, DEFAULT_TRACK_COMPRESSOR, DEFAULT_TRACK_EQ, DEFAULT_TRACK_PAN, DEFAULT_TRACK_VOLUME, DEFAULT_TRANSFORM, DEFAULT_TRANSITION_DURATION, DEFAULT_TRANSITION_TYPE, MAX_CHROMA_KEY_COLORS, MAX_NESTED_SEQUENCE_DEPTH, MAX_TRANSITION_DURATION, MIN_TRANSITION_DURATION, PRIMARY_SEQUENCE_ID, TRANSITION_TYPES, } from './defaults';
export function normalizeTimelineMarker(marker, maxTime) {
    return createTimelineMarker(marker, maxTime);
}
export function normalizeQualityEnhancement(enhancement) {
    return {
        superResolution: enhancement?.superResolution === true,
        deblock: enhancement?.deblock === true,
        colorBoost: enhancement?.colorBoost === true,
        frameCompensation: enhancement?.frameCompensation === true,
    };
}
export function normalizeTimelineBookmark(bookmark, maxTime) {
    return createTimelineBookmark(bookmark, maxTime);
}
export function normalizeTransform(transform) {
    const legacyScale = clampTransformScale(transform?.scale, DEFAULT_TRANSFORM.scale);
    const rawScaleX = typeof transform?.scaleX === 'number' && Number.isFinite(transform.scaleX) ? transform.scaleX : undefined;
    const rawScaleY = typeof transform?.scaleY === 'number' && Number.isFinite(transform.scaleY) ? transform.scaleY : undefined;
    const clampedScaleX = clampTransformScale(rawScaleX, legacyScale);
    const clampedScaleY = clampTransformScale(rawScaleY, legacyScale);
    const staleUniformAxes = rawScaleX !== undefined &&
        rawScaleY !== undefined &&
        Math.abs(clampedScaleX - clampedScaleY) <= 0.000001 &&
        Math.abs(clampedScaleX - legacyScale) > 0.000001;
    const scaleX = staleUniformAxes ? legacyScale : clampedScaleX;
    const scaleY = staleUniformAxes ? legacyScale : clampedScaleY;
    return {
        x: round(finiteOrDefault(transform?.x, DEFAULT_TRANSFORM.x)),
        y: round(finiteOrDefault(transform?.y, DEFAULT_TRANSFORM.y)),
        scale: round((scaleX + scaleY) / 2),
        scaleX,
        scaleY,
        rotation: normalizeRotation(transform?.rotation),
        opacity: round(Math.min(1, Math.max(0, finiteOrDefault(transform?.opacity, DEFAULT_TRANSFORM.opacity)))),
    };
}
export function normalizeRotation(rotation) {
    return round(Math.min(180, Math.max(-180, finiteOrDefault(rotation, DEFAULT_TRANSFORM.rotation))));
}
export function getTransformScaleX(transform) {
    return normalizeTransform(transform).scaleX ?? DEFAULT_TRANSFORM.scaleX ?? DEFAULT_TRANSFORM.scale;
}
export function getTransformScaleY(transform) {
    return normalizeTransform(transform).scaleY ?? DEFAULT_TRANSFORM.scaleY ?? DEFAULT_TRANSFORM.scale;
}
export function clampTransformScale(scale, fallback) {
    return round(Math.min(4, Math.max(0.01, finiteOrDefault(scale, fallback))));
}
export function normalizeTimelineMarkers(markers, maxTime) {
    return [...(markers ?? [])]
        .map((marker) => normalizeTimelineMarker(marker, maxTime))
        .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}
export function normalizeTimelineBookmarks(bookmarks, maxTime) {
    return [...(bookmarks ?? [])]
        .map((bookmark) => normalizeTimelineBookmark(bookmark, maxTime))
        .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}
export function normalizeProjectAnnotation(annotation, maxTime) {
    return createProjectAnnotation(annotation, maxTime);
}
export function normalizeProjectAnnotations(annotations, maxTime) {
    return [...(annotations ?? [])]
        .map((annotation) => normalizeProjectAnnotation(annotation, maxTime))
        .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}
export function normalizeReviewAnnotation(annotation, maxTime) {
    return createReviewAnnotation(annotation, maxTime);
}
export function normalizeReviewAnnotations(annotations, maxTime) {
    return [...(annotations ?? [])]
        .map((annotation) => normalizeReviewAnnotation(annotation, maxTime))
        .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}
export function normalizeCollaborationNote(note, maxTime) {
    return createCollaborationNote(note, maxTime);
}
export function normalizeCollaborationNotes(notes, maxTime) {
    return [...(notes ?? [])]
        .map((note) => normalizeCollaborationNote(note, maxTime))
        .sort((left, right) => left.start - right.start ||
        (left.end ?? left.start) - (right.end ?? right.start) ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id));
}
export function normalizeTimelineNote(note, maxTime) {
    const normalized = createTimelineNote(note, maxTime);
    return normalized.end > normalized.start ? normalized : undefined;
}
export function normalizeTimelineNotes(notes, maxTime) {
    return [...(notes ?? [])]
        .flatMap((note) => {
        const normalized = normalizeTimelineNote(note, maxTime);
        return normalized ? [normalized] : [];
    })
        .sort((left, right) => left.start - right.start ||
        left.end - right.end ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id));
}
export function normalizeExportRange(range, maxTime) {
    const normalized = createExportRange(range, maxTime);
    return normalized.end > normalized.start ? normalized : undefined;
}
export function normalizeExportRanges(ranges, maxTime) {
    return [...(ranges ?? [])]
        .flatMap((range) => {
        const normalized = normalizeExportRange(range, maxTime);
        return normalized ? [normalized] : [];
    })
        .sort((left, right) => left.start - right.start || left.end - right.end || left.id.localeCompare(right.id));
}
export function normalizeProtectedRange(range, maxTime) {
    const normalized = createProtectedRange(range, maxTime);
    return normalized.end > normalized.start ? normalized : undefined;
}
export function normalizeProtectedRanges(ranges, maxTime) {
    return [...(ranges ?? [])]
        .flatMap((range) => {
        const normalized = normalizeProtectedRange(range, maxTime);
        return normalized ? [normalized] : [];
    })
        .sort((left, right) => left.start - right.start || left.end - right.end || left.id.localeCompare(right.id));
}
export function normalizeTrackVolume(volume) {
    if (typeof volume !== 'number' || !Number.isFinite(volume)) {
        return DEFAULT_TRACK_VOLUME;
    }
    return round(Math.min(2, Math.max(0, volume)));
}
export function normalizeTrackPan(pan) {
    if (typeof pan !== 'number' || !Number.isFinite(pan)) {
        return DEFAULT_TRACK_PAN;
    }
    return round(Math.min(1, Math.max(-1, pan)));
}
export function normalizeSubtitleLanguage(language) {
    if (typeof language !== 'string') {
        return DEFAULT_SUBTITLE_LANGUAGE;
    }
    const primary = language.trim().toLowerCase().replace(/_/g, '-').split('-')[0];
    return /^[a-z]{2}$/.test(primary) ? primary : DEFAULT_SUBTITLE_LANGUAGE;
}
export function normalizeSubtitleTrackType(value) {
    return value === 'cc' ? 'cc' : DEFAULT_SUBTITLE_TRACK_TYPE;
}
export function normalizeSubtitleSpeaker(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
export function normalizeSubtitleSoundDesc(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    return /^\[[^\]]+\]$/.test(trimmed) ? trimmed : `[${trimmed.replace(/^\[|\]$/g, '').trim()}]`;
}
export function normalizeProjectSpeakers(speakers) {
    if (!Array.isArray(speakers)) {
        return [];
    }
    const output = [];
    const seen = new Set();
    for (const speaker of speakers) {
        if (!speaker || typeof speaker !== 'object') {
            continue;
        }
        const name = normalizeSubtitleSpeaker(speaker.name);
        if (!name) {
            continue;
        }
        const key = name.toLocaleLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        const id = normalizeSubtitleSpeaker(speaker.id) ?? createId('speaker');
        const color = normalizeOptionalHexColor(speaker.color);
        output.push(color ? { id, name, color } : { id, name });
    }
    return output;
}
export function normalizeSubtitleLanguageList(languages) {
    if (!Array.isArray(languages)) {
        return undefined;
    }
    const output = [];
    const seen = new Set();
    for (const language of languages) {
        const normalized = normalizeSubtitleLanguage(language);
        if (seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        output.push(normalized);
    }
    return output;
}
export function normalizeTrackEQ(eq) {
    const inputBands = Array.isArray(eq?.bands) ? eq.bands : [];
    return {
        enabled: eq?.enabled !== false,
        bands: DEFAULT_TRACK_EQ.bands.map((fallback, index) => normalizeTrackEQBand(inputBands[index], fallback)),
    };
}
export function normalizeTrackEQBand(band, fallback = DEFAULT_TRACK_EQ.bands[1]) {
    return {
        id: typeof band?.id === 'string' && band.id.trim() ? band.id : fallback.id,
        type: normalizeTrackEQBandType(band?.type, fallback.type),
        frequency: round(Math.min(20_000, Math.max(20, finiteOrDefault(band?.frequency, fallback.frequency)))),
        gain: round(Math.min(24, Math.max(-24, finiteOrDefault(band?.gain, fallback.gain)))),
        q: round(Math.min(4, Math.max(0.1, finiteOrDefault(band?.q, fallback.q)))),
    };
}
export function normalizeTrackCompressor(compressor) {
    return {
        enabled: compressor?.enabled === true,
        threshold: round(Math.min(0, Math.max(-60, finiteOrDefault(compressor?.threshold, DEFAULT_TRACK_COMPRESSOR.threshold)))),
        ratio: round(Math.min(20, Math.max(1, finiteOrDefault(compressor?.ratio, DEFAULT_TRACK_COMPRESSOR.ratio)))),
        attack: round(Math.min(2000, Math.max(0.01, finiteOrDefault(compressor?.attack, DEFAULT_TRACK_COMPRESSOR.attack)))),
        release: round(Math.min(9000, Math.max(0.01, finiteOrDefault(compressor?.release, DEFAULT_TRACK_COMPRESSOR.release)))),
        makeupGain: round(Math.min(24, Math.max(0, finiteOrDefault(compressor?.makeupGain, DEFAULT_TRACK_COMPRESSOR.makeupGain)))),
    };
}
export function normalizeMasterVolume(volume) {
    if (typeof volume !== 'number' || !Number.isFinite(volume)) {
        return DEFAULT_MASTER_VOLUME;
    }
    return round(Math.min(2, Math.max(0, volume)));
}
export function normalizeSequenceName(name) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    return trimmed || DEFAULT_NESTED_SEQUENCE_NAME;
}
export function getProjectSequences(project) {
    const sequences = project.sequences && project.sequences.length > 0 ? project.sequences : [];
    if (sequences.some((sequence) => sequence.id === PRIMARY_SEQUENCE_ID)) {
        return sequences;
    }
    return [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline: project.timeline }, ...sequences];
}
export function getProjectActiveSequenceId(project) {
    const sequences = getProjectSequences(project);
    return sequences.some((sequence) => sequence.id === project.activeSequenceId)
        ? project.activeSequenceId
        : PRIMARY_SEQUENCE_ID;
}
export function getProjectPrimaryTimeline(project) {
    const synced = replaceProjectActiveTimeline(project, project.timeline);
    return (getProjectSequences(synced).find((sequence) => sequence.id === PRIMARY_SEQUENCE_ID)?.timeline ?? synced.timeline);
}
export function replaceProjectActiveTimeline(project, timeline) {
    const activeSequenceId = getProjectActiveSequenceId(project);
    const sequences = getProjectSequences(project).map((sequence) => sequence.id === activeSequenceId ? { ...sequence, timeline } : sequence);
    return { ...project, timeline, sequences, activeSequenceId };
}
export function switchProjectActiveSequence(project, sequenceId) {
    const synced = replaceProjectActiveTimeline(project, project.timeline);
    const target = getProjectSequences(synced).find((sequence) => sequence.id === sequenceId);
    if (!target) {
        return synced;
    }
    return { ...synced, timeline: target.timeline, activeSequenceId: target.id };
}
export function getNestedSequenceDepth(project, sequenceId = PRIMARY_SEQUENCE_ID) {
    const sequences = getProjectSequences(project);
    const sequence = sequences.find((item) => item.id === sequenceId);
    if (!sequence) {
        return 0;
    }
    return getNestedSequenceDepthForTimeline(project, sequence.timeline, new Set([sequenceId]));
}
export function isNestedSequenceDepthExceeded(project, sequenceId = PRIMARY_SEQUENCE_ID, maxDepth = MAX_NESTED_SEQUENCE_DEPTH) {
    return getNestedSequenceDepth(project, sequenceId) > maxDepth;
}
export function normalizeTrackEQBandType(type, fallback) {
    return type === 'lowshelf' || type === 'peaking' || type === 'highshelf' ? type : fallback;
}
export function normalizeRgbColor(color) {
    const input = Array.isArray(color) ? color : DEFAULT_CHROMA_KEY.color;
    return [normalizeRgbChannel(input[0]), normalizeRgbChannel(input[1]), normalizeRgbChannel(input[2])];
}
export function normalizeChromaKeyColors(chromaKey) {
    const candidates = Array.isArray(chromaKey?.colors) && chromaKey.colors.length > 0
        ? chromaKey.colors
        : [chromaKey?.color ?? DEFAULT_CHROMA_KEY.color];
    const colors = candidates.slice(0, MAX_CHROMA_KEY_COLORS).map((color) => normalizeRgbColor(color));
    return colors.length > 0 ? colors : [[...DEFAULT_CHROMA_KEY.color]];
}
export function normalizeChromaKeyMode(mode) {
    return mode === 'luma-key' || mode === 'difference-matte' || mode === 'chroma-key' ? mode : DEFAULT_CHROMA_KEY.mode;
}
export function normalizeRgbChannel(value) {
    return Math.round(Math.min(255, Math.max(0, finiteOrDefault(value, 0))));
}
export function clonePathPoint(point) {
    return {
        x: point.x,
        y: point.y,
        handleIn: point.handleIn ? { ...point.handleIn } : undefined,
        handleOut: point.handleOut ? { ...point.handleOut } : undefined,
    };
}
export function normalizeUnit(value, fallback) {
    return round(Math.min(1, Math.max(0, finiteOrDefault(value, fallback))));
}
export function normalizePositiveUnit(value, fallback) {
    return round(Math.min(1, Math.max(0.001, finiteOrDefault(value, fallback))));
}
export function getNestedSequenceDepthForTimeline(project, timeline, visited) {
    let depth = 0;
    for (const clip of timeline.tracks.flatMap((track) => track.clips)) {
        if (clip.type !== 'nested-sequence') {
            continue;
        }
        if (visited.has(clip.sequenceId)) {
            return MAX_NESTED_SEQUENCE_DEPTH + 1;
        }
        const sequence = getProjectSequences(project).find((item) => item.id === clip.sequenceId);
        if (!sequence) {
            continue;
        }
        const nextVisited = new Set(visited);
        nextVisited.add(clip.sequenceId);
        depth = Math.max(depth, 1 + getNestedSequenceDepthForTimeline(project, sequence.timeline, nextVisited));
    }
    return depth;
}
export function normalizeTransitionType(type) {
    return type && TRANSITION_TYPES.includes(type) ? type : DEFAULT_TRANSITION_TYPE;
}
export function normalizeTransitionDuration(duration) {
    if (typeof duration !== 'number' || !Number.isFinite(duration)) {
        return DEFAULT_TRANSITION_DURATION;
    }
    return round(Math.min(MAX_TRANSITION_DURATION, Math.max(MIN_TRANSITION_DURATION, duration)));
}
export function isDefaultColorCorrection(colorCorrection) {
    const normalized = normalizeColorCorrection(colorCorrection);
    return (normalized.brightness === DEFAULT_COLOR_CORRECTION.brightness &&
        normalized.inputColorSpace === DEFAULT_COLOR_CORRECTION.inputColorSpace &&
        normalized.contrast === DEFAULT_COLOR_CORRECTION.contrast &&
        normalized.saturation === DEFAULT_COLOR_CORRECTION.saturation &&
        normalized.hue === DEFAULT_COLOR_CORRECTION.hue &&
        normalized.lutPath === DEFAULT_COLOR_CORRECTION.lutPath &&
        (normalized.luts?.length ?? 0) === 0 &&
        isDefaultColorCurves(normalized.colorCurves) &&
        isNeutralThreeWayColor(normalized.threeWayColor));
}
//# sourceMappingURL=track-timeline.js.map