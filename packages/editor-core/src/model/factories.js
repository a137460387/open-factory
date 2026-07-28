import { normalizeClipBlendMode } from '../blend-modes';
import { normalizeColorNodeGraph } from '../color-node-graph';
import { normalizeClipContentAnalysis } from '../content-analysis';
import { normalizeColorGradingGraph } from '../color-grading';
import { normalizeCreditsRollSpeed, normalizeCreditsRows, normalizeCreditsStyle } from '../credits-roll';
import { cloneEffects } from '../effects';
import { normalizeMotionGraphic } from '../motion-graphics';
import { normalizeClipPitchData } from '../audio-pitch';
import { normalizeAudioRestoration } from '../audio-restoration';
import { normalizeSpatialAudio } from '../spatial-audio';
import { normalizeTimelineLabelColor } from '../timeline-color-labels';
import { round } from '../time';
import { finiteOrDefault } from '../math-utils';
import { clampClipSpeed, cloneClipKeyframesLocal, createId, normalizeAILocalDenoise, normalizeAILookMatch, normalizeAiPipSuggestion, normalizeAudioChannelRouting, normalizeAudioDenoise, normalizeAudioFadeCurve, normalizeAudioFadeDuration, normalizeAudioPitchSemitones, normalizeChromaKey, normalizeClipBorder, normalizeClipBeatMarkers, normalizeClipPanoramaView, normalizeClipProjection, normalizeClipSceneCuts, normalizeColorCorrection, normalizeDetectedBpm, normalizeFlashWarnings, normalizeFrameInterpolation, normalizeHexColor, normalizeMasks, normalizeMotionTrack, normalizeMulticamSequence, normalizePrivacyRedactions, normalizeQualityEnhancement, normalizeSequenceFrameRate, normalizeSlowMotionMode, normalizeStabilization, normalizeVideoRestoration } from './clip-normalize';
import { DEFAULT_COLLABORATION_NOTE_COLOR, DEFAULT_MASTER_VOLUME, DEFAULT_NESTED_SEQUENCE_NAME, DEFAULT_PRIMARY_SEQUENCE_NAME, DEFAULT_PROJECT_ANNOTATION_COLOR, DEFAULT_PROJECT_SETTINGS, DEFAULT_REVIEW_ANNOTATION_COLOR, DEFAULT_TIMELINE_MARKER_COLOR, DEFAULT_TIMELINE_NOTE_COLOR, DEFAULT_TRACK_COMPRESSOR, DEFAULT_TRACK_EQ, DEFAULT_TRACK_PAN, DEFAULT_TRACK_VOLUME, DEFAULT_TRANSFORM, PRIMARY_SEQUENCE_ID, TIMELINE_NOTE_COLORS, TRANSITION_TYPES, DEFAULT_TRANSITION_TYPE, DEFAULT_TRANSITION_DURATION, MIN_TRANSITION_DURATION, MAX_TRANSITION_DURATION, DEFAULT_COLLABORATION_NOTE_AUTHOR, DEFAULT_SUBTITLE_LANGUAGE, DEFAULT_SUBTITLE_TRACK_TYPE } from './defaults';
// ---------------------------------------------------------------------------
// Transition / marker / bookmark helpers
// ---------------------------------------------------------------------------
function normalizeTransitionType(type) {
    return type && TRANSITION_TYPES.includes(type) ? type : DEFAULT_TRANSITION_TYPE;
}
function normalizeTransitionDuration(duration) {
    if (typeof duration !== 'number' || !Number.isFinite(duration)) {
        return DEFAULT_TRANSITION_DURATION;
    }
    return round(Math.min(MAX_TRANSITION_DURATION, Math.max(MIN_TRANSITION_DURATION, duration)));
}
function normalizeTimelineMarkerTime(time, maxTime) {
    return normalizeTimelinePointTime(time, maxTime);
}
function normalizeTimelinePointTime(time, maxTime) {
    const finiteTime = typeof time === 'number' && Number.isFinite(time) ? time : 0;
    const upperBound = typeof maxTime === 'number' && Number.isFinite(maxTime) ? Math.max(0, maxTime) : undefined;
    return round(Math.min(upperBound ?? finiteTime, Math.max(0, finiteTime)));
}
function normalizeTimelineMarkerLabel(label) {
    const trimmed = label?.trim();
    return trimmed ? trimmed.slice(0, 80) : 'Marker';
}
function normalizeTimelineBookmarkNote(note) {
    const trimmed = note?.trim();
    return trimmed ? trimmed.slice(0, 120) : 'Bookmark';
}
function normalizeBookmarkAnnotation(annotation) {
    const trimmed = annotation?.trim();
    if (!trimmed) {
        return undefined;
    }
    return trimmed.slice(0, 50);
}
function normalizeTimelineMarkerColor(color) {
    return normalizeHexColor(color, DEFAULT_TIMELINE_MARKER_COLOR);
}
function normalizeProjectAnnotationText(text) {
    const trimmed = text?.trim();
    return trimmed ? trimmed.slice(0, 240) : 'Annotation';
}
function normalizeReviewAnnotationText(text) {
    const trimmed = text?.trim();
    return trimmed ? trimmed.slice(0, 240) : 'Review annotation';
}
function normalizeCollaborationNoteText(text) {
    const trimmed = text?.trim();
    return trimmed ? trimmed.slice(0, 2000) : 'Collaboration note';
}
function normalizeCollaborationAuthorName(name) {
    const trimmed = name?.trim();
    return trimmed ? trimmed.slice(0, 80) : DEFAULT_COLLABORATION_NOTE_AUTHOR;
}
function normalizeTimelineNoteText(text) {
    const trimmed = text?.trim();
    return trimmed ? trimmed.slice(0, 240) : 'Timeline note';
}
function normalizeCollaborationNoteType(type) {
    return type === 'highlight' || type === 'replacement' || type === 'comment' ? type : 'comment';
}
function normalizeReviewAnnotationType(type) {
    return type === 'rectangle' || type === 'arrow' || type === 'text' ? type : 'text';
}
function normalizeReviewAnnotationUnit(value, fallback) {
    return round(Math.min(1, Math.max(0, finiteOrDefault(value, fallback))));
}
function normalizeReviewAnnotationDimension(value, type, axis) {
    const fallback = type === 'text' ? (axis === 'width' ? 0.22 : 0.08) : type === 'arrow' ? 0.12 : 0.18;
    const finite = finiteOrDefault(value, fallback);
    if (type === 'arrow') {
        return round(Math.min(1, Math.max(-1, finite || fallback)));
    }
    return round(Math.min(1, Math.max(0.01, Math.abs(finite || fallback))));
}
function normalizeTimelineNoteColor(color) {
    const normalized = normalizeHexColor(color, DEFAULT_TIMELINE_NOTE_COLOR);
    return TIMELINE_NOTE_COLORS.includes(normalized) ? normalized : DEFAULT_TIMELINE_NOTE_COLOR;
}
function normalizeIsoDate(value) {
    if (value && Number.isFinite(Date.parse(value))) {
        return new Date(value).toISOString();
    }
    return new Date().toISOString();
}
function normalizeExportRangeLabel(label) {
    const trimmed = label?.trim();
    return trimmed ? trimmed.slice(0, 80) : 'Export Range';
}
function normalizeProtectedRangeLabel(label) {
    const trimmed = label?.trim();
    return trimmed ? trimmed.slice(0, 80) : 'Protected Range';
}
// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------
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
function normalizeRotation(rotation) {
    return round(Math.min(180, Math.max(-180, finiteOrDefault(rotation, DEFAULT_TRANSFORM.rotation))));
}
function clampTransformScale(scale, fallback) {
    return round(Math.min(4, Math.max(0.01, finiteOrDefault(scale, fallback))));
}
// ---------------------------------------------------------------------------
// Track helpers
// ---------------------------------------------------------------------------
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
export function normalizeTrackEQ(eq) {
    const inputBands = Array.isArray(eq?.bands) ? eq.bands : [];
    return {
        enabled: eq?.enabled !== false,
        bands: DEFAULT_TRACK_EQ.bands.map((fallback, index) => normalizeTrackEQBand(inputBands[index], fallback)),
    };
}
function normalizeTrackEQBand(band, fallback = DEFAULT_TRACK_EQ.bands[1]) {
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
function normalizeTrackEQBandType(type, fallback) {
    return type === 'lowshelf' || type === 'peaking' || type === 'highshelf' ? type : fallback;
}
export function normalizeSequenceName(name) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    return trimmed || DEFAULT_NESTED_SEQUENCE_NAME;
}
// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------
export function createDefaultTimeline() {
    return {
        markers: [],
        transitions: [],
        tracks: [
            createTrack({ id: createId('track'), type: 'video', name: 'Video 1', clips: [] }),
            createTrack({ id: createId('track'), type: 'audio', name: 'Audio 1', clips: [] }),
            createTrack({ id: createId('track'), type: 'text', name: 'Text 1', clips: [] }),
        ],
    };
}
export function createTransition(transition) {
    return {
        id: transition.id ?? createId('transition'),
        type: normalizeTransitionType(transition.type),
        duration: normalizeTransitionDuration(transition.duration),
        fromClipId: transition.fromClipId,
        toClipId: transition.toClipId,
    };
}
export function createTimelineMarker(marker, maxTime) {
    return {
        id: marker.id ?? createId('marker'),
        time: normalizeTimelineMarkerTime(marker.time, maxTime),
        label: normalizeTimelineMarkerLabel(marker.label),
        color: normalizeTimelineMarkerColor(marker.color),
    };
}
export function createTimelineBookmark(bookmark, maxTime) {
    return {
        id: bookmark.id ?? createId('bookmark'),
        time: normalizeTimelinePointTime(bookmark.time, maxTime),
        note: normalizeTimelineBookmarkNote(bookmark.note),
        ...(bookmark.groupId ? { groupId: bookmark.groupId.trim() } : {}),
        ...(bookmark.thumbnailPath ? { thumbnailPath: bookmark.thumbnailPath } : {}),
        ...(bookmark.annotation !== undefined ? { annotation: normalizeBookmarkAnnotation(bookmark.annotation) } : {}),
        ...(bookmark.createdAt ? { createdAt: bookmark.createdAt } : {}),
    };
}
export function createProjectAnnotation(annotation, maxTime) {
    return {
        id: annotation.id ?? createId('annotation'),
        time: normalizeTimelinePointTime(annotation.time, maxTime),
        text: normalizeProjectAnnotationText(annotation.text),
        color: normalizeHexColor(annotation.color, DEFAULT_PROJECT_ANNOTATION_COLOR),
    };
}
export function createReviewAnnotation(annotation, maxTime) {
    const type = normalizeReviewAnnotationType(annotation.type);
    return {
        id: annotation.id ?? createId('review-annotation'),
        time: normalizeTimelinePointTime(annotation.time, maxTime),
        type,
        text: normalizeReviewAnnotationText(annotation.text),
        color: normalizeHexColor(annotation.color, DEFAULT_REVIEW_ANNOTATION_COLOR),
        x: normalizeReviewAnnotationUnit(annotation.x, 0.5),
        y: normalizeReviewAnnotationUnit(annotation.y, 0.5),
        width: normalizeReviewAnnotationDimension(annotation.width, type, 'width'),
        height: normalizeReviewAnnotationDimension(annotation.height, type, 'height'),
    };
}
export function createCollaborationNote(note, maxTime) {
    const type = normalizeCollaborationNoteType(note.type);
    const start = normalizeTimelinePointTime(note.start, maxTime);
    const rawEnd = normalizeTimelinePointTime(note.end ?? start, maxTime);
    const end = type === 'comment' ? undefined : round(Math.max(start, rawEnd));
    return {
        id: note.id ?? createId('collaboration-note'),
        type,
        authorName: normalizeCollaborationAuthorName(note.authorName),
        authorColor: normalizeHexColor(note.authorColor, DEFAULT_COLLABORATION_NOTE_COLOR),
        start,
        ...(end !== undefined ? { end } : {}),
        text: normalizeCollaborationNoteText(note.text),
        ...(typeof note.mediaPath === 'string' && note.mediaPath.trim() ? { mediaPath: note.mediaPath.trim() } : {}),
        resolved: note.resolved === true,
        createdAt: normalizeIsoDate(note.createdAt),
        ...(note.updatedAt ? { updatedAt: normalizeIsoDate(note.updatedAt) } : {}),
    };
}
export function createTimelineNote(note, maxTime) {
    const start = normalizeTimelinePointTime(note.start, maxTime);
    const end = normalizeTimelinePointTime(note.end, maxTime);
    return {
        id: note.id ?? createId('timeline-note'),
        start: round(Math.min(start, end)),
        end: round(Math.max(start, end)),
        text: normalizeTimelineNoteText(note.text),
        color: normalizeTimelineNoteColor(note.color),
        createdAt: normalizeIsoDate(note.createdAt),
    };
}
export function createExportRange(range, maxTime) {
    const start = normalizeTimelinePointTime(range.start, maxTime);
    const end = normalizeTimelinePointTime(range.end, maxTime);
    return {
        id: range.id ?? createId('export-range'),
        label: normalizeExportRangeLabel(range.label),
        start: round(Math.min(start, end)),
        end: round(Math.max(start, end)),
    };
}
export function createProtectedRange(range, maxTime) {
    const start = normalizeTimelinePointTime(range.start, maxTime);
    const end = normalizeTimelinePointTime(range.end, maxTime);
    return {
        id: range.id ?? createId('protected-range'),
        label: normalizeProtectedRangeLabel(range.label),
        start: round(Math.min(start, end)),
        end: round(Math.max(start, end)),
    };
}
export function createTrack(track) {
    const next = {
        ...track,
        color: normalizeTimelineLabelColor(track.color),
        muted: Boolean(track.muted),
        solo: Boolean(track.solo),
        locked: Boolean(track.locked),
        volume: normalizeTrackVolume(track.volume),
        pan: normalizeTrackPan(track.pan),
        eq: normalizeTrackEQ(track.eq),
        compressor: normalizeTrackCompressor(track.compressor),
    };
    if (track.type === 'subtitle') {
        next.language = normalizeSubtitleLanguage(track.language);
        next.subtitleType = normalizeSubtitleTrackType(track.subtitleType);
    }
    else {
        delete next.language;
        delete next.subtitleType;
    }
    return next;
}
export function createProject(name = 'Untitled Project') {
    const now = new Date().toISOString();
    const timeline = createDefaultTimeline();
    return {
        version: '0.2',
        id: createId('project'),
        name,
        releaseVersion: '0.1.0',
        createdAt: now,
        updatedAt: now,
        masterVolume: DEFAULT_MASTER_VOLUME,
        settings: { ...DEFAULT_PROJECT_SETTINGS },
        media: [],
        mediaFolders: [],
        mediaMetadata: {},
        annotations: [],
        reviewAnnotations: [],
        collaborationNotes: [],
        timelineNotes: [],
        bookmarks: [],
        beatMarkers: [],
        exportRanges: [],
        protectedRanges: [],
        clipGroups: [],
        coverPath: undefined,
        speakers: [],
        documentation: {},
        timeline,
        sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
        activeSequenceId: PRIMARY_SEQUENCE_ID,
        subclips: [],
        beatSnapSuggestions: [],
        mediaCollections: [],
        characterTimeline: undefined,
        preflightReport: undefined,
    };
}
export function createSubclip(input) {
    return {
        id: input.id ?? createId('subclip'),
        name: input.name,
        sourceMediaId: input.sourceMediaId,
        inPoint: round(Math.max(0, input.inPoint)),
        outPoint: round(Math.max(input.inPoint, input.outPoint)),
        color: normalizeTimelineLabelColor(input.color),
        description: input.description,
        createdAt: input.createdAt ?? new Date().toISOString(),
    };
}
export function createSequence(sequence) {
    return {
        id: sequence.id ?? createId('sequence'),
        name: normalizeSequenceName(sequence.name),
        timeline: sequence.timeline,
        ...(sequence.settings ? { settings: sequence.settings } : {}),
    };
}
export function createBaseClip(input) {
    const beatMarkers = normalizeClipBeatMarkers(input.beatMarkers, input.duration);
    const detectedBpm = normalizeDetectedBpm(input.detectedBpm);
    const scenecuts = normalizeClipSceneCuts(input.scenecuts, input.duration);
    return {
        id: input.id ?? createId('clip'),
        name: input.name,
        trackId: input.trackId,
        start: round(Math.max(0, input.start)),
        duration: round(Math.max(0, input.duration)),
        colorLabel: normalizeTimelineLabelColor(input.colorLabel),
        trimStart: round(Math.max(0, input.trimStart)),
        trimEnd: round(Math.max(0, input.trimEnd)),
        speed: clampClipSpeed(input.speed),
        colorCorrection: normalizeColorCorrection(input.colorCorrection),
        ...(input.colorNodeGraph
            ? { colorNodeGraph: normalizeColorNodeGraph(input.colorNodeGraph, input.colorCorrection) }
            : {}),
        ...(input.colorGradingGraph ? { colorGradingGraph: normalizeColorGradingGraph(input.colorGradingGraph) } : {}),
        transform: normalizeTransform(input.transform),
        chromaKey: normalizeChromaKey(input.chromaKey),
        stabilization: normalizeStabilization(input.stabilization),
        frameInterpolation: normalizeFrameInterpolation(input.frameInterpolation),
        slowMotionMode: normalizeSlowMotionMode(input.slowMotionMode),
        audioDenoise: normalizeAudioDenoise(input.audioDenoise),
        aiLocalDenoise: normalizeAILocalDenoise(input.aiLocalDenoise),
        audioRestoration: normalizeAudioRestoration(input.audioRestoration),
        audioChannelRouting: normalizeAudioChannelRouting(input.audioChannelRouting),
        videoRestoration: normalizeVideoRestoration(input.videoRestoration),
        qualityEnhancement: normalizeQualityEnhancement(input.qualityEnhancement),
        projection: normalizeClipProjection(input.projection),
        panorama: normalizeClipPanoramaView(input.panorama),
        masks: normalizeMasks(input.masks),
        motionTrack: normalizeMotionTrack(input.motionTrack, input.duration),
        border: normalizeClipBorder(input.border),
        keyframes: cloneClipKeyframesLocal(input.keyframes),
        effects: cloneEffects(input.effects),
        sequenceFrameRate: normalizeSequenceFrameRate(input.sequenceFrameRate),
        blendMode: normalizeClipBlendMode(input.blendMode),
        contentAnalysis: normalizeClipContentAnalysis(input.contentAnalysis),
        pitchData: normalizeClipPitchData(input.pitchData),
        ...(beatMarkers ? { beatMarkers } : {}),
        ...(detectedBpm !== undefined ? { detectedBpm } : {}),
        ...(scenecuts ? { scenecuts } : {}),
        ...(Array.isArray(input.aiColorHistory) ? { aiColorHistory: input.aiColorHistory.slice(0, 3) } : {}),
        ...(Array.isArray(input.privacyRedactions)
            ? { privacyRedactions: normalizePrivacyRedactions(input.privacyRedactions) }
            : {}),
        ...(input.beatSnapped === true ? { beatSnapped: true } : {}),
        ...(input.aiLookMatch && typeof input.aiLookMatch === 'object'
            ? { aiLookMatch: normalizeAILookMatch(input.aiLookMatch) }
            : {}),
        ...(input.aiPipSuggestion && typeof input.aiPipSuggestion === 'object'
            ? { aiPipSuggestion: normalizeAiPipSuggestion(input.aiPipSuggestion) }
            : {}),
        ...(Array.isArray(input.flashWarnings) ? { flashWarnings: normalizeFlashWarnings(input.flashWarnings) } : {}),
    };
}
export function createNestedSequenceClip(input) {
    return {
        ...createBaseClip(input),
        type: 'nested-sequence',
        sequenceId: input.sequenceId,
        volume: normalizeTrackVolume(input.volume),
        muted: input.muted,
        pitchSemitones: normalizeAudioPitchSemitones(input.pitchSemitones),
        reverseAudio: input.reverseAudio === true,
        fadeInDuration: normalizeAudioFadeDuration(input.fadeInDuration, input.duration),
        fadeOutDuration: normalizeAudioFadeDuration(input.fadeOutDuration, input.duration),
        fadeInCurve: normalizeAudioFadeCurve(input.fadeInCurve),
        fadeOutCurve: normalizeAudioFadeCurve(input.fadeOutCurve),
        spatialAudio: normalizeSpatialAudio(input.spatialAudio),
        multicam: normalizeMulticamSequence(input.multicam, input.duration),
    };
}
export function createAdjustmentClip(input) {
    return {
        ...createBaseClip(input),
        type: 'adjustment',
    };
}
export function createMotionGraphicClip(input) {
    return {
        ...createBaseClip(input),
        type: 'motion-graphic',
        motionGraphic: normalizeMotionGraphic(input.motionGraphic, input.duration),
    };
}
export function createCreditsClip(input) {
    const text = typeof input.text === 'string' ? input.text : '';
    return {
        ...createBaseClip(input),
        type: 'credits',
        text,
        rows: normalizeCreditsRows(input.rows, text),
        rollSpeed: normalizeCreditsRollSpeed(input.rollSpeed),
        style: normalizeCreditsStyle(input.style),
    };
}
export function createMulticamClip(angles, syncMode, syncReferenceAngle) {
    if (syncReferenceAngle < 0 || syncReferenceAngle >= angles.length) {
        throw new Error('syncReferenceAngle out of range');
    }
    const baseClip = createBaseClip({
        name: 'Multicam Clip',
        trackId: '',
        start: 0,
        duration: 0,
        trimStart: 0,
        trimEnd: 0,
    });
    return {
        ...baseClip,
        type: 'multicam',
        angles: angles.map((a) => ({
            ...a,
            ...(a.colorCorrection ? { colorCorrection: { ...a.colorCorrection } } : {}),
            ...(a.transform ? { transform: { ...a.transform } } : {}),
        })),
        activeAngle: 0,
        switchPoints: [],
        syncMode,
        syncReferenceAngle,
    };
}
//# sourceMappingURL=factories.js.map