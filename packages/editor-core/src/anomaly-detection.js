import { round } from './time';
export const BLACK_FRAME_LUMA_THRESHOLD = 8;
export const BLACK_FRAME_MERGE_GAP = 1.0;
export const STATIC_MOTION_THRESHOLD = 2.0;
export const STATIC_MIN_DURATION = 5.0;
export const SEVERITY_HIGH_STATIC_DURATION = 10.0;
export const SEVERITY_HIGH_BLACK_DURATION = 3.0;
export function isBlackFrame(lumaMean, threshold = BLACK_FRAME_LUMA_THRESHOLD) {
    return Number.isFinite(lumaMean) && lumaMean < threshold;
}
export function classifyBlackFrameSeverity(duration) {
    if (duration >= SEVERITY_HIGH_BLACK_DURATION)
        return 'high';
    if (duration >= 1.0)
        return 'medium';
    return 'low';
}
export function classifyStaticSeverity(duration) {
    if (duration >= SEVERITY_HIGH_STATIC_DURATION)
        return 'high';
    if (duration >= STATIC_MIN_DURATION)
        return 'medium';
    return 'low';
}
export function mergeAdjacentIntervals(times, maxGap = BLACK_FRAME_MERGE_GAP) {
    if (times.length === 0)
        return [];
    const sorted = [...times].sort((a, b) => a - b);
    const intervals = [];
    let start = sorted[0];
    let end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - end <= maxGap) {
            end = sorted[i];
        }
        else {
            intervals.push({ startTime: start, endTime: end });
            start = sorted[i];
            end = sorted[i];
        }
    }
    intervals.push({ startTime: start, endTime: end });
    return intervals;
}
export function detectBlackFrameIntervals(samples, lumaThreshold = BLACK_FRAME_LUMA_THRESHOLD, mergeGap = BLACK_FRAME_MERGE_GAP) {
    const blackTimes = samples.filter((s) => isBlackFrame(s.lumaMean, lumaThreshold)).map((s) => s.time);
    const merged = mergeAdjacentIntervals(blackTimes, mergeGap);
    return merged.map((interval) => ({
        type: 'black',
        startTime: interval.startTime,
        endTime: round(interval.endTime + 1),
        severity: classifyBlackFrameSeverity(interval.endTime - interval.startTime + 1),
    }));
}
export function detectStaticIntervals(samples, motionThreshold = STATIC_MOTION_THRESHOLD, minDuration = STATIC_MIN_DURATION) {
    if (samples.length < minDuration)
        return [];
    const intervals = [];
    let staticStart = null;
    let staticCount = 0;
    for (const sample of samples) {
        if (sample.grayscaleDiff < motionThreshold) {
            if (staticStart === null) {
                staticStart = sample.time;
                staticCount = 1;
            }
            else {
                staticCount++;
            }
        }
        else {
            if (staticStart !== null) {
                const duration = sample.time - staticStart;
                if (duration >= minDuration) {
                    intervals.push({
                        type: 'static',
                        startTime: staticStart,
                        endTime: round(sample.time),
                        severity: classifyStaticSeverity(duration),
                    });
                }
                staticStart = null;
                staticCount = 0;
            }
        }
    }
    if (staticStart !== null) {
        const lastTime = samples[samples.length - 1].time;
        const duration = lastTime - staticStart;
        if (duration >= minDuration) {
            intervals.push({
                type: 'static',
                startTime: staticStart,
                endTime: round(lastTime + 1),
                severity: classifyStaticSeverity(duration),
            });
        }
    }
    return intervals;
}
export function detectAnomalies(samples, options = {}) {
    const black = detectBlackFrameIntervals(samples, options.lumaThreshold, options.mergeGap);
    const statics = detectStaticIntervals(samples, options.motionThreshold, options.minStaticDuration);
    return [...black, ...statics].sort((a, b) => a.startTime - b.startTime);
}
//# sourceMappingURL=anomaly-detection.js.map