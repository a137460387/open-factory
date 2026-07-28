import { DEFAULT_CLIP_SPEED, DEFAULT_COLOR_CORRECTION, DEFAULT_SUBTITLE_MODE, DEFAULT_SUBTITLE_STYLE, DEFAULT_TRANSFORM, } from '../model';
import { round } from '../time';
export const VOICE_BAND_MIN_HZ = 300;
export const VOICE_BAND_MAX_HZ = 3400;
export const DIALOGUE_SENSITIVITY_PRESETS = {
    low: {
        minDuration: 0.7,
        loudnessThreshold: 0.32,
        voiceEnergyRatio: 0.62,
    },
    medium: {
        minDuration: 0.45,
        loudnessThreshold: 0.24,
        voiceEnergyRatio: 0.52,
    },
    high: {
        minDuration: 0.25,
        loudnessThreshold: 0.16,
        voiceEnergyRatio: 0.42,
    },
};
const DEFAULT_MERGE_GAP = 0.18;
const EPSILON = 0.000001;
export function calculateVoiceBandEnergy(frequencyBins) {
    let voiceEnergy = 0;
    let totalEnergy = 0;
    for (const bin of frequencyBins) {
        const hz = finiteOrDefault(bin.hz, 0);
        const energy = Math.max(0, finiteOrDefault(bin.energy, 0));
        totalEnergy += energy;
        if (hz >= VOICE_BAND_MIN_HZ && hz <= VOICE_BAND_MAX_HZ) {
            voiceEnergy += energy;
        }
    }
    return {
        voiceEnergy: round(voiceEnergy),
        totalEnergy: round(totalEnergy),
        ratio: totalEnergy > EPSILON ? round(voiceEnergy / totalEnergy) : 0,
    };
}
export function detectDialogueIntervals(frames, options = {}) {
    const sensitivity = normalizeSensitivity(options.sensitivity);
    const preset = DIALOGUE_SENSITIVITY_PRESETS[sensitivity];
    const minConfidence = Math.min(1, Math.max(0, finiteOrDefault(options.minConfidence, 0.5)));
    const mergeGap = Math.max(0, finiteOrDefault(options.mergeGap, DEFAULT_MERGE_GAP));
    const candidates = [];
    let current;
    for (const frame of normalizeFrames(frames)) {
        const voice = calculateVoiceBandEnergy(frame.frequencyBins);
        const loudness = Math.max(0, finiteOrDefault(frame.loudness, 0));
        const loudnessScore = preset.loudnessThreshold > 0 ? Math.min(1, loudness / preset.loudnessThreshold) : 0;
        const voiceScore = preset.voiceEnergyRatio > 0 ? Math.min(1, voice.ratio / preset.voiceEnergyRatio) : 0;
        const confidence = round(loudnessScore * 0.45 + voiceScore * 0.55);
        const active = loudness >= preset.loudnessThreshold && voice.ratio >= preset.voiceEnergyRatio && confidence >= minConfidence;
        const frameStart = frame.time;
        const frameEnd = round(frame.time + frame.duration);
        if (!active) {
            if (current) {
                candidates.push(current);
                current = undefined;
            }
            continue;
        }
        if (!current || frameStart - current.end > mergeGap + EPSILON) {
            if (current) {
                candidates.push(current);
            }
            current = createOpenInterval(candidates.length, frameStart, frameEnd, confidence);
            continue;
        }
        current.end = frameEnd;
        current.duration = round(current.end - current.start);
        current.scoreSum += confidence;
        current.frameCount += 1;
        current.confidence = round(current.scoreSum / current.frameCount);
    }
    if (current) {
        candidates.push(current);
    }
    return mergeDialogueIntervals(candidates, mergeGap)
        .filter((interval) => interval.duration + EPSILON >= preset.minDuration)
        .map((interval, index) => ({ ...interval, id: `dialogue-${index + 1}` }));
}
export function compareDialogueWithWhisper(dialogues, whisperSegments, minOverlapRatio = 0.35) {
    const normalizedWhisper = whisperSegments
        .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start)
        .map((segment) => ({ start: round(Math.max(0, segment.start)), end: round(Math.max(0, segment.end)) }));
    return dialogues
        .filter((dialogue) => {
        const overlap = normalizedWhisper.reduce((total, segment) => total + overlapDuration(dialogue, segment), 0);
        const ratio = dialogue.duration > EPSILON ? overlap / dialogue.duration : 0;
        return ratio < minOverlapRatio;
    })
        .map((dialogue) => ({
        id: `missing-${dialogue.id}`,
        start: dialogue.start,
        end: dialogue.end,
        duration: dialogue.duration,
        confidence: dialogue.confidence,
    }));
}
export function createSubtitleClipsFromDialogues(dialogues, input) {
    const baseId = sanitizeId(input.baseId ?? 'dialogue-subtitle');
    const namePrefix = input.namePrefix?.trim() || 'Dialogue';
    return dialogues
        .filter((dialogue) => dialogue.end > dialogue.start)
        .map((dialogue, index) => ({
        id: `${baseId}-${index + 1}`,
        type: 'subtitle',
        name: `${namePrefix} ${index + 1}`,
        trackId: input.trackId,
        start: dialogue.start,
        duration: dialogue.duration,
        trimStart: 0,
        trimEnd: 0,
        speed: DEFAULT_CLIP_SPEED,
        colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
        transform: { ...DEFAULT_TRANSFORM },
        text: '',
        style: { ...DEFAULT_SUBTITLE_STYLE },
        subtitleMode: DEFAULT_SUBTITLE_MODE,
    }));
}
function createOpenInterval(index, start, end, confidence) {
    return {
        id: `candidate-${index + 1}`,
        start,
        end,
        duration: round(end - start),
        confidence,
        scoreSum: confidence,
        frameCount: 1,
    };
}
function mergeDialogueIntervals(intervals, mergeGap) {
    const merged = [];
    for (const interval of intervals.sort((left, right) => left.start - right.start || left.end - right.end)) {
        const previous = merged[merged.length - 1];
        if (previous && interval.start - previous.end <= mergeGap + EPSILON) {
            previous.end = Math.max(previous.end, interval.end);
            previous.duration = round(previous.end - previous.start);
            previous.scoreSum += interval.confidence * (interval.frameCount ?? 1);
            previous.frameCount += interval.frameCount ?? 1;
            previous.confidence = round(previous.scoreSum / previous.frameCount);
        }
        else {
            merged.push({
                ...interval,
                scoreSum: interval.confidence * (interval.frameCount ?? 1),
                frameCount: interval.frameCount ?? 1,
            });
        }
    }
    return merged.map(({ scoreSum: _scoreSum, frameCount: _frameCount, ...interval }) => interval);
}
function normalizeFrames(frames) {
    return frames
        .filter((frame) => Number.isFinite(frame.time) &&
        Number.isFinite(frame.duration) &&
        frame.duration > 0 &&
        Array.isArray(frame.frequencyBins))
        .map((frame) => ({
        time: round(Math.max(0, frame.time)),
        duration: round(Math.max(0.001, frame.duration)),
        loudness: Math.max(0, finiteOrDefault(frame.loudness, 0)),
        frequencyBins: frame.frequencyBins,
    }))
        .sort((left, right) => left.time - right.time);
}
function normalizeSensitivity(value) {
    return value === 'low' || value === 'high' ? value : 'medium';
}
function overlapDuration(left, right) {
    return Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start));
}
function sanitizeId(value) {
    return (value
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'dialogue-subtitle');
}
function finiteOrDefault(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
//# sourceMappingURL=dialogue-detection.js.map