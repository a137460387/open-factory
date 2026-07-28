import { createId } from './model';
import { createKeyframe, interpolateKeyframes, normalizeKeyframes } from './keyframes';
import { round } from './time';
const VIRTUAL_START_ID = 'volume-envelope-start';
const VIRTUAL_END_ID = 'volume-envelope-end';
export function getVolumeEnvelopePoints(clip) {
    const duration = round(Math.max(0, clip.duration));
    const fallback = 'volume' in clip && typeof clip.volume === 'number' ? clip.volume : 1;
    const frames = normalizeKeyframes(clip.keyframes?.volume, duration, fallback, 'volume');
    if (frames.length === 0) {
        return [makeVirtualPoint(VIRTUAL_START_ID, 0, fallback), makeVirtualPoint(VIRTUAL_END_ID, duration, fallback)];
    }
    const points = [];
    if (frames[0].time > 0) {
        points.push(makeVirtualPoint(VIRTUAL_START_ID, 0, interpolateKeyframes(frames, 0, fallback)));
    }
    points.push(...frames.map((frame) => ({ ...frame, persisted: true })));
    if (frames[frames.length - 1].time < duration) {
        points.push(makeVirtualPoint(VIRTUAL_END_ID, duration, interpolateKeyframes(frames, duration, fallback)));
    }
    return points;
}
export function volumeEnvelopeControlPointToKeyframe(input, duration) {
    return createKeyframe('volume', {
        id: input.id ?? createId('volume-envelope'),
        time: input.time,
        value: input.value,
        easing: input.easing ?? 'linear',
    }, duration);
}
export function buildVolumeFadeKeyframes(kind, duration, baseVolume = 1, fadeDuration = 1) {
    const normalizedDuration = round(Math.max(0, duration));
    const normalizedFadeDuration = round(Math.min(normalizedDuration, Math.max(0, fadeDuration)));
    const normalizedBase = volumeEnvelopeControlPointToKeyframe({ time: 0, value: baseVolume }, normalizedDuration).value;
    if (kind === 'in') {
        return [
            volumeEnvelopeControlPointToKeyframe({ id: 'volume-fade-in-start', time: 0, value: 0, easing: 'linear' }, normalizedDuration),
            volumeEnvelopeControlPointToKeyframe({ id: 'volume-fade-in-end', time: normalizedFadeDuration, value: normalizedBase, easing: 'linear' }, normalizedDuration),
        ];
    }
    return [
        volumeEnvelopeControlPointToKeyframe({
            id: 'volume-fade-out-start',
            time: round(Math.max(0, normalizedDuration - normalizedFadeDuration)),
            value: normalizedBase,
            easing: 'linear',
        }, normalizedDuration),
        volumeEnvelopeControlPointToKeyframe({ id: 'volume-fade-out-end', time: normalizedDuration, value: 0, easing: 'linear' }, normalizedDuration),
    ];
}
export function getVolumeEnvelopeValueAt(clip, localTime) {
    const fallback = 'volume' in clip && typeof clip.volume === 'number' ? clip.volume : 1;
    return interpolateKeyframes(clip.keyframes?.volume, localTime, fallback);
}
function makeVirtualPoint(id, time, value) {
    return {
        id,
        time: round(time),
        value: round(Math.min(2, Math.max(0, value))),
        easing: 'linear',
        persisted: false,
    };
}
//# sourceMappingURL=audio-envelope.js.map