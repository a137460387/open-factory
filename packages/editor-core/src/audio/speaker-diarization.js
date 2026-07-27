import { DEFAULT_COLOR_CORRECTION, DEFAULT_TRANSFORM, createTrack } from '../model';
import { getClipSourceVisibleDuration, getClipSpeed } from '../timeline';
import { clamp, round } from '../time';
const DEFAULT_SILENCE_THRESHOLD = 0.12;
const DEFAULT_PITCH_CHANGE_THRESHOLD_HZ = 55;
const DEFAULT_MIN_SEGMENT_DURATION = 0.25;
const DEFAULT_MAX_SPEAKERS = 4;
const EPSILON = 0.000001;
export function detectSpeakerSegments(frames, options = {}) {
    const silenceThreshold = clamp(finiteOrDefault(options.silenceThreshold, DEFAULT_SILENCE_THRESHOLD), 0, 1);
    const pitchThreshold = Math.max(10, finiteOrDefault(options.pitchChangeThresholdHz, DEFAULT_PITCH_CHANGE_THRESHOLD_HZ));
    const minSegmentDuration = Math.max(0.05, finiteOrDefault(options.minSegmentDuration, DEFAULT_MIN_SEGMENT_DURATION));
    const maxSpeakers = Math.max(1, Math.min(DEFAULT_MAX_SPEAKERS, Math.floor(finiteOrDefault(options.maxSpeakers, DEFAULT_MAX_SPEAKERS))));
    const dialogueIntervals = normalizeDialogueIntervals(options.dialogueIntervals);
    const normalized = normalizeFrames(frames).filter((frame) => dialogueIntervals.length === 0 || dialogueIntervals.some((interval) => overlaps(frame, interval)));
    const voiceRuns = collectVoiceRuns(normalized, silenceThreshold, minSegmentDuration);
    const clusters = [];
    const segments = [];
    for (const run of voiceRuns) {
        const averagePitchHz = weightedAverage(run.frames, (frame) => frame.pitchHz);
        const averageCentroidHz = weightedAverage(run.frames, (frame) => frame.spectralCentroidHz);
        const assignment = assignSpeakerCluster(clusters, averagePitchHz, averageCentroidHz, pitchThreshold, maxSpeakers);
        const confidence = calculateSegmentConfidence(run.frames, assignment.distance, pitchThreshold);
        segments.push({
            id: `speaker-segment-${segments.length + 1}`,
            speakerId: `speaker-${assignment.cluster.speakerIndex + 1}`,
            speakerIndex: assignment.cluster.speakerIndex,
            start: run.start,
            end: run.end,
            duration: round(run.end - run.start),
            averagePitchHz: round(averagePitchHz),
            averageCentroidHz: round(averageCentroidHz),
            confidence,
            confidenceLabel: labelConfidence(confidence),
        });
    }
    return segments;
}
export function buildSpeakerDiarizationTracks(sourceClip, segments, options = {}) {
    const baseId = sanitizeId(options.baseId ?? 'speaker-diarization');
    const speakerNamePrefix = options.speakerNamePrefix?.trim() || 'Speaker';
    const clipNamePrefix = options.clipNamePrefix?.trim() || sourceClip.name || 'Dialogue';
    const speed = getClipSpeed(sourceClip);
    const sourceVisibleDuration = getClipSourceVisibleDuration(sourceClip);
    const totalSourceDuration = round(sourceClip.trimStart + sourceVisibleDuration + sourceClip.trimEnd);
    const groups = new Map();
    for (const segment of segments.filter((item) => item.duration > EPSILON)) {
        const current = groups.get(segment.speakerIndex) ?? [];
        current.push(segment);
        groups.set(segment.speakerIndex, current);
    }
    return Array.from(groups.entries())
        .sort(([left], [right]) => left - right)
        .map(([speakerIndex, speakerSegments]) => {
        const trackId = `${baseId}-track-${speakerIndex + 1}`;
        const clips = speakerSegments
            .sort((left, right) => left.start - right.start || left.end - right.end)
            .map((segment, index) => {
            const sourceStart = round(sourceClip.trimStart + segment.start * speed);
            const sourceDuration = round(segment.duration * speed);
            return {
                id: `${baseId}-clip-${speakerIndex + 1}-${index + 1}`,
                type: 'audio',
                name: `${clipNamePrefix} ${speakerNamePrefix} ${speakerIndex + 1}`,
                mediaId: sourceClip.mediaId,
                trackId,
                start: round(sourceClip.start + segment.start),
                duration: segment.duration,
                trimStart: sourceStart,
                trimEnd: round(Math.max(0, totalSourceDuration - sourceStart - sourceDuration)),
                speed,
                colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
                transform: { ...DEFAULT_TRANSFORM },
                volume: sourceClip.volume,
                muted: sourceClip.muted === true,
                pitchSemitones: sourceClip.pitchSemitones,
                reverseAudio: sourceClip.reverseAudio === true,
                fadeInDuration: sourceClip.fadeInDuration,
                fadeOutDuration: sourceClip.fadeOutDuration,
                fadeInCurve: sourceClip.fadeInCurve,
                fadeOutCurve: sourceClip.fadeOutCurve,
                audioDenoise: sourceClip.audioDenoise,
                audioChannelRouting: sourceClip.audioChannelRouting,
                spatialAudio: sourceClip.spatialAudio,
            };
        });
        return createTrack({
            id: trackId,
            type: 'audio',
            name: `${speakerNamePrefix} ${speakerIndex + 1}`,
            clips,
        });
    });
}
export function hasLowConfidenceSpeakerSegments(segments) {
    return segments.some((segment) => segment.confidenceLabel === 'low');
}
export function labelConfidence(confidence) {
    const normalized = clamp(finiteOrDefault(confidence, 0), 0, 1);
    if (normalized >= 0.75) {
        return 'high';
    }
    if (normalized >= 0.5) {
        return 'medium';
    }
    return 'low';
}
function collectVoiceRuns(frames, silenceThreshold, minSegmentDuration) {
    const runs = [];
    let current;
    for (const frame of frames) {
        const active = frame.loudness >= silenceThreshold && frame.pitchHz > 0;
        if (!active) {
            pushRun(runs, current, minSegmentDuration);
            current = undefined;
            continue;
        }
        if (!current) {
            current = { start: frame.time, end: round(frame.time + frame.duration), frames: [frame] };
            continue;
        }
        current.end = round(frame.time + frame.duration);
        current.frames.push(frame);
    }
    pushRun(runs, current, minSegmentDuration);
    return runs;
}
function pushRun(runs, run, minSegmentDuration) {
    if (run && run.end - run.start + EPSILON >= minSegmentDuration) {
        runs.push(run);
    }
}
function assignSpeakerCluster(clusters, pitchHz, centroidHz, thresholdHz, maxSpeakers) {
    const nearest = clusters
        .map((cluster) => ({ cluster, distance: speakerDistance(cluster, pitchHz, centroidHz) }))
        .sort((left, right) => left.distance - right.distance)[0];
    if (!nearest || (nearest.distance > thresholdHz && clusters.length < maxSpeakers)) {
        const cluster = {
            speakerIndex: clusters.length,
            pitchHz,
            centroidHz,
            segmentCount: 1,
        };
        clusters.push(cluster);
        return { cluster, distance: 0 };
    }
    const cluster = nearest.cluster;
    const nextCount = cluster.segmentCount + 1;
    cluster.pitchHz = round((cluster.pitchHz * cluster.segmentCount + pitchHz) / nextCount);
    cluster.centroidHz = round((cluster.centroidHz * cluster.segmentCount + centroidHz) / nextCount);
    cluster.segmentCount = nextCount;
    return nearest;
}
function speakerDistance(cluster, pitchHz, centroidHz) {
    const pitchDistance = Math.abs(cluster.pitchHz - pitchHz);
    const centroidDistance = Math.abs(cluster.centroidHz - centroidHz) / 12;
    return pitchDistance + centroidDistance;
}
function calculateSegmentConfidence(frames, assignmentDistance, thresholdHz) {
    const averagePitch = weightedAverage(frames, (frame) => frame.pitchHz);
    const pitchVariance = weightedAverage(frames, (frame) => Math.abs(frame.pitchHz - averagePitch));
    const loudness = weightedAverage(frames, (frame) => frame.loudness);
    const stabilityScore = 1 - clamp(pitchVariance / Math.max(1, thresholdHz), 0, 1);
    const assignmentScore = 1 - clamp(assignmentDistance / Math.max(1, thresholdHz * 1.6), 0, 1);
    const loudnessScore = clamp(loudness / 0.32, 0, 1);
    return round(stabilityScore * 0.45 + assignmentScore * 0.35 + loudnessScore * 0.2);
}
function normalizeFrames(frames) {
    return frames
        .filter((frame) => Number.isFinite(frame.time) && Number.isFinite(frame.duration) && frame.duration > 0)
        .map((frame) => ({
        time: round(Math.max(0, frame.time)),
        duration: round(Math.max(0.001, frame.duration)),
        loudness: clamp(finiteOrDefault(frame.loudness, 0), 0, 1),
        pitchHz: Math.max(0, finiteOrDefault(frame.pitchHz, 0)),
        spectralCentroidHz: Math.max(0, finiteOrDefault(frame.spectralCentroidHz, 0)),
    }))
        .sort((left, right) => left.time - right.time || left.duration - right.duration);
}
function normalizeDialogueIntervals(intervals) {
    if (!Array.isArray(intervals)) {
        return [];
    }
    return intervals
        .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
        .map((interval) => ({ start: round(Math.max(0, interval.start)), end: round(Math.max(0, interval.end)) }))
        .sort((left, right) => left.start - right.start || left.end - right.end);
}
function overlaps(frame, interval) {
    return frame.time < interval.end && frame.time + frame.duration > interval.start;
}
function weightedAverage(frames, pick) {
    let total = 0;
    let weight = 0;
    for (const frame of frames) {
        const frameWeight = Math.max(0.001, frame.duration);
        total += pick(frame) * frameWeight;
        weight += frameWeight;
    }
    return weight > 0 ? total / weight : 0;
}
function sanitizeId(value) {
    return (value
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'speaker-diarization');
}
function finiteOrDefault(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
//# sourceMappingURL=speaker-diarization.js.map