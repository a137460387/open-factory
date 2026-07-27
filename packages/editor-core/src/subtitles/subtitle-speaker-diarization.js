export const DEFAULT_PAUSE_THRESHOLD = 1.2;
export const DEFAULT_ZCR_DIFF_THRESHOLD = 0.15;
export const DEFAULT_SPEAKER_NAME_PREFIX = '说话人';
export function detectPauseBoundaries(segments, pauseThreshold = DEFAULT_PAUSE_THRESHOLD) {
    if (segments.length <= 1)
        return segments.length === 1 ? [false] : [];
    const boundaries = [false];
    for (let i = 1; i < segments.length; i++) {
        const gap = segments[i].start - segments[i - 1].end;
        boundaries.push(gap > pauseThreshold);
    }
    return boundaries;
}
export function detectSpeakerChange(currentZcr, previousZcr, zcrThreshold = DEFAULT_ZCR_DIFF_THRESHOLD) {
    return Math.abs(currentZcr - previousZcr) > zcrThreshold;
}
export function assignSpeakerIds(segments, pauseThreshold = DEFAULT_PAUSE_THRESHOLD, zcrThreshold = DEFAULT_ZCR_DIFF_THRESHOLD) {
    if (segments.length === 0)
        return [];
    const assignments = [{ segmentId: segments[0].id, speakerId: 0 }];
    let currentSpeaker = 0;
    for (let i = 1; i < segments.length; i++) {
        const gap = segments[i].start - segments[i - 1].end;
        const isPauseBoundary = gap > pauseThreshold;
        const hasZcrChange = detectSpeakerChange(segments[i].zeroCrossingRate ?? 0, segments[i - 1].zeroCrossingRate ?? 0, zcrThreshold);
        if (isPauseBoundary && hasZcrChange) {
            currentSpeaker++;
        }
        assignments.push({ segmentId: segments[i].id, speakerId: currentSpeaker });
    }
    return assignments;
}
export function buildSpeakerLabels(count, prefix = DEFAULT_SPEAKER_NAME_PREFIX) {
    const labels = {};
    for (let i = 0; i < count; i++) {
        labels[i] = `${prefix}${i + 1}`;
    }
    return labels;
}
export function renameSpeaker(labels, oldId, newName) {
    if (!(oldId in labels))
        return { ...labels };
    return { ...labels, [oldId]: newName };
}
export function batchRenameSpeakers(labels, renames) {
    const result = { ...labels };
    for (const [id, name] of Object.entries(renames)) {
        const numId = Number(id);
        if (numId in result && typeof name === 'string' && name.trim()) {
            result[numId] = name.trim();
        }
    }
    return result;
}
export function performSpeakerDiarization(segments, pauseThreshold = DEFAULT_PAUSE_THRESHOLD, zcrThreshold = DEFAULT_ZCR_DIFF_THRESHOLD) {
    const assignments = assignSpeakerIds(segments, pauseThreshold, zcrThreshold);
    const maxSpeaker = assignments.reduce((max, a) => Math.max(max, a.speakerId), 0);
    return {
        assignments,
        speakerLabels: buildSpeakerLabels(maxSpeaker + 1),
    };
}
//# sourceMappingURL=subtitle-speaker-diarization.js.map