/**
 * AI smart cut suggestion engine.
 *
 * Analyzes voice activity detection (VAD) intervals and visual content
 * to automatically identify and suggest removal of redundant segments
 * such as silence, static frames, filler words, and low-content sections.
 * All functions are pure computation with no side effects.
 */
// --- Core analysis ---
/**
 * Generate smart cut suggestions by analyzing VAD intervals and visual samples.
 *
 * @param vadIntervals - Voice activity detection intervals.
 * @param visualSamples - Visual content samples (brightness, motion, etc.).
 * @param clipDuration - Total clip duration in seconds.
 * @param options - Analysis configuration.
 * @returns Smart cut result with suggestions and statistics.
 */
export function generateSmartCuts(vadIntervals, visualSamples, clipDuration, options = {}) {
    const { minSilenceDuration = 1.0, minStaticDuration = 2.0, staticMotionThreshold = 0.05, minPauseDuration = 0.8, speechPadding = 0.15, minConfidence = 0.4, maxSuggestions = 50, detectFillers = true, } = options;
    const duration = Math.max(0, clipDuration);
    if (duration <= 0) {
        return emptyResult(duration);
    }
    const suggestions = [];
    let idCounter = 0;
    // 1. Detect silence gaps between speech segments.
    const silenceCuts = detectSilenceGaps(vadIntervals, duration, minSilenceDuration, speechPadding, minConfidence);
    for (const cut of silenceCuts) {
        suggestions.push({ ...cut, id: `cut-${++idCounter}` });
    }
    // 2. Detect static frames.
    const staticCuts = detectStaticFrames(visualSamples, minStaticDuration, staticMotionThreshold, speechPadding, minConfidence);
    for (const cut of staticCuts) {
        suggestions.push({ ...cut, id: `cut-${++idCounter}` });
    }
    // 3. Detect long pauses within speech.
    const pauseCuts = detectLongPauses(vadIntervals, minPauseDuration, speechPadding, minConfidence);
    for (const cut of pauseCuts) {
        suggestions.push({ ...cut, id: `cut-${++idCounter}` });
    }
    // 4. Detect filler word segments.
    if (detectFillers) {
        const fillerCuts = detectFillerWords(vadIntervals, speechPadding, minConfidence);
        for (const cut of fillerCuts) {
            suggestions.push({ ...cut, id: `cut-${++idCounter}` });
        }
    }
    // Sort by time and merge overlapping suggestions.
    const sorted = suggestions.filter((s) => s.confidence >= minConfidence).sort((a, b) => a.start - b.start);
    const merged = mergeOverlappingSuggestions(sorted);
    // Limit count.
    const limited = merged.slice(0, maxSuggestions);
    // Compute statistics.
    const stats = computeStats(limited);
    const totalRemovableDuration = round(limited.reduce((sum, s) => sum + s.duration, 0));
    return {
        suggestions: limited,
        totalRemovableDuration,
        originalDuration: round(duration),
        estimatedDuration: round(Math.max(0, duration - totalRemovableDuration)),
        stats,
    };
}
/**
 * Apply cut suggestions to a timeline, returning adjusted cut points.
 *
 * @param suggestions - Accepted cut suggestions.
 * @param clipDuration - Original clip duration.
 * @returns Array of retained time ranges.
 */
export function applyCutsToTimeline(suggestions, clipDuration) {
    const accepted = suggestions.filter((s) => s.accepted !== false).sort((a, b) => a.start - b.start);
    if (accepted.length === 0) {
        return [{ start: 0, end: clipDuration }];
    }
    const retained = [];
    let cursor = 0;
    for (const cut of accepted) {
        if (cut.start > cursor) {
            retained.push({ start: round(cursor), end: round(cut.start) });
        }
        cursor = cut.end;
    }
    if (cursor < clipDuration) {
        retained.push({ start: round(cursor), end: round(clipDuration) });
    }
    return retained.filter((r) => r.end - r.start > 0.01);
}
/**
 * Compute the impact score of a cut suggestion.
 * Higher score = more impactful removal.
 *
 * @param suggestion - The cut suggestion.
 * @param speechSegments - Surrounding speech segments.
 * @returns Impact score (0.0 ~ 1.0).
 */
export function computeCutImpact(suggestion, speechSegments) {
    // Longer cuts have more impact.
    const durationScore = Math.min(1, suggestion.duration / 5);
    // Cuts between high-confidence speech segments have more impact.
    const surroundingSpeech = speechSegments.filter((s) => Math.abs(s.start - suggestion.end) < 2 || Math.abs(s.end - suggestion.start) < 2);
    const speechConfidence = surroundingSpeech.length > 0
        ? surroundingSpeech.reduce((sum, s) => sum + s.confidence, 0) / surroundingSpeech.length
        : 0.5;
    // Confidence of the suggestion itself.
    const confidenceScore = suggestion.confidence;
    return round(durationScore * 0.4 + speechConfidence * 0.3 + confidenceScore * 0.3);
}
/**
 * Detect low-energy segments where visual content is unchanging
 * and audio is minimal.
 */
export function detectLowEnergySegments(visualSamples, vadIntervals, duration, options = {}) {
    const { energyThreshold = 0.15, minDuration = 1.5 } = options;
    if (visualSamples.length === 0) {
        return [];
    }
    // Compute per-sample energy = motion * loudness_proxy.
    const speechTimes = new Set();
    for (const interval of vadIntervals) {
        for (let t = Math.floor(interval.start * 10); t <= Math.floor(interval.end * 10); t++) {
            speechTimes.add(t / 10);
        }
    }
    const lowEnergyRanges = [];
    let rangeStart = null;
    let rangeSamples = [];
    for (const sample of visualSamples) {
        const hasSpeech = speechTimes.has(Math.round(sample.time * 10) / 10);
        const energy = hasSpeech ? 1.0 : sample.motion * 0.7 + sample.brightness * 0.3;
        if (energy < energyThreshold) {
            if (rangeStart === null) {
                rangeStart = sample.time;
                rangeSamples = [];
            }
            rangeSamples.push(sample);
        }
        else {
            if (rangeStart !== null && rangeSamples.length > 0) {
                const rangeEnd = rangeSamples[rangeSamples.length - 1].time;
                const rangeDuration = rangeEnd - rangeStart;
                if (rangeDuration >= minDuration) {
                    const avgEnergy = rangeSamples.reduce((sum, s) => sum + s.motion * 0.7 + s.brightness * 0.3, 0) / rangeSamples.length;
                    lowEnergyRanges.push({
                        start: round(rangeStart),
                        end: round(rangeEnd),
                        confidence: round(1 - avgEnergy / energyThreshold),
                    });
                }
            }
            rangeStart = null;
            rangeSamples = [];
        }
    }
    // Flush remaining range.
    if (rangeStart !== null && rangeSamples.length > 0) {
        const rangeEnd = rangeSamples[rangeSamples.length - 1].time;
        if (rangeEnd - rangeStart >= minDuration) {
            lowEnergyRanges.push({
                start: round(rangeStart),
                end: round(rangeEnd),
                confidence: 0.5,
            });
        }
    }
    return lowEnergyRanges;
}
// --- Internal helpers ---
function detectSilenceGaps(vadIntervals, duration, minSilenceDuration, speechPadding, minConfidence) {
    if (vadIntervals.length === 0) {
        // Entire clip is silent.
        if (duration >= minSilenceDuration) {
            return [
                {
                    start: 0,
                    end: round(duration),
                    duration: round(duration),
                    reason: 'silence',
                    confidence: 0.9,
                    description: '整个片段无语音活动',
                },
            ];
        }
        return [];
    }
    const sorted = [...vadIntervals].sort((a, b) => a.start - b.start);
    const cuts = [];
    // Gap before first speech.
    if (sorted[0].start > minSilenceDuration) {
        const gapEnd = Math.max(0, sorted[0].start - speechPadding);
        if (gapEnd > 0) {
            cuts.push({
                start: 0,
                end: round(gapEnd),
                duration: round(gapEnd),
                reason: 'silence',
                confidence: 0.85,
                description: '片头静音段',
            });
        }
    }
    // Gaps between speech segments.
    for (let i = 1; i < sorted.length; i++) {
        const gapStart = sorted[i - 1].end + speechPadding;
        const gapEnd = sorted[i].start - speechPadding;
        const gapDuration = gapEnd - gapStart;
        if (gapDuration >= minSilenceDuration) {
            cuts.push({
                start: round(gapStart),
                end: round(gapEnd),
                duration: round(gapDuration),
                reason: 'silence',
                confidence: round(Math.min(0.95, 0.5 + gapDuration * 0.15)),
                description: `语音间静音段 (${round(gapDuration)}s)`,
            });
        }
    }
    // Gap after last speech.
    const lastSpeech = sorted[sorted.length - 1];
    if (duration - lastSpeech.end > minSilenceDuration) {
        const gapStart = lastSpeech.end + speechPadding;
        cuts.push({
            start: round(gapStart),
            end: round(duration),
            duration: round(duration - gapStart),
            reason: 'silence',
            confidence: 0.85,
            description: '片尾静音段',
        });
    }
    return cuts.filter((c) => c.confidence >= minConfidence);
}
function detectStaticFrames(samples, minStaticDuration, staticMotionThreshold, speechPadding, minConfidence) {
    if (samples.length < 2) {
        return [];
    }
    const sorted = [...samples].filter((s) => Number.isFinite(s.time)).sort((a, b) => a.time - b.time);
    const cuts = [];
    let staticStart = null;
    let prevSample = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        const sample = sorted[i];
        const motionDelta = Math.abs(sample.motion - prevSample.motion);
        const brightnessDelta = Math.abs(sample.brightness - prevSample.brightness);
        const isStatic = motionDelta < staticMotionThreshold && brightnessDelta < 0.1;
        if (isStatic) {
            if (staticStart === null) {
                staticStart = prevSample.time;
            }
        }
        else {
            if (staticStart !== null) {
                const staticDuration = prevSample.time - staticStart;
                if (staticDuration >= minStaticDuration) {
                    cuts.push({
                        start: round(staticStart + speechPadding),
                        end: round(prevSample.time - speechPadding),
                        duration: round(staticDuration - speechPadding * 2),
                        reason: 'static-frame',
                        confidence: round(Math.min(0.9, 0.4 + staticDuration * 0.1)),
                        description: `静态画面 (${round(staticDuration)}s)`,
                    });
                }
                staticStart = null;
            }
        }
        prevSample = sample;
    }
    // Flush remaining static range.
    if (staticStart !== null) {
        const lastSample = sorted[sorted.length - 1];
        const staticDuration = lastSample.time - staticStart;
        if (staticDuration >= minStaticDuration) {
            cuts.push({
                start: round(staticStart + speechPadding),
                end: round(lastSample.time - speechPadding),
                duration: round(staticDuration - speechPadding * 2),
                reason: 'static-frame',
                confidence: round(Math.min(0.9, 0.4 + staticDuration * 0.1)),
                description: `静态画面 (${round(staticDuration)}s)`,
            });
        }
    }
    return cuts.filter((c) => c.confidence >= minConfidence && c.duration > 0);
}
function detectLongPauses(vadIntervals, minPauseDuration, speechPadding, minConfidence) {
    const sorted = [...vadIntervals].sort((a, b) => a.start - b.start);
    const cuts = [];
    for (let i = 1; i < sorted.length; i++) {
        const pauseStart = sorted[i - 1].end;
        const pauseEnd = sorted[i].start;
        const pauseDuration = pauseEnd - pauseStart;
        // Only suggest if both segments are high-confidence speech.
        if (pauseDuration >= minPauseDuration && sorted[i - 1].confidence >= 0.6 && sorted[i].confidence >= 0.6) {
            // Keep some padding around speech.
            const cutStart = pauseStart + speechPadding;
            const cutEnd = pauseEnd - speechPadding;
            const cutDuration = cutEnd - cutStart;
            if (cutDuration > 0.1) {
                cuts.push({
                    start: round(cutStart),
                    end: round(cutEnd),
                    duration: round(cutDuration),
                    reason: 'long-pause',
                    confidence: round(Math.min(0.85, 0.4 + pauseDuration * 0.2)),
                    description: `长停顿 (${round(pauseDuration)}s)`,
                });
            }
        }
    }
    return cuts.filter((c) => c.confidence >= minConfidence);
}
function detectFillerWords(vadIntervals, speechPadding, minConfidence) {
    return vadIntervals
        .filter((v) => v.isFiller && v.confidence >= minConfidence)
        .map((v) => ({
        start: round(v.start + speechPadding * 0.5),
        end: round(v.end - speechPadding * 0.5),
        duration: round(Math.max(0, v.end - v.start - speechPadding)),
        reason: 'filler-word',
        confidence: round(v.confidence),
        description: '填充词（如"嗯"、"那个"）',
    }))
        .filter((c) => c.duration > 0.05);
}
function mergeOverlappingSuggestions(suggestions) {
    if (suggestions.length <= 1) {
        return suggestions;
    }
    const merged = [suggestions[0]];
    for (let i = 1; i < suggestions.length; i++) {
        const last = merged[merged.length - 1];
        const curr = suggestions[i];
        if (curr.start <= last.end + 0.1) {
            // Overlapping or adjacent - merge.
            const newEnd = Math.max(last.end, curr.end);
            merged[merged.length - 1] = {
                ...last,
                end: newEnd,
                duration: round(newEnd - last.start),
                confidence: round(Math.max(last.confidence, curr.confidence)),
                description: `${last.description} + ${curr.description}`,
            };
        }
        else {
            merged.push(curr);
        }
    }
    return merged;
}
function computeStats(suggestions) {
    const stats = {
        silence: { count: 0, duration: 0 },
        'static-frame': { count: 0, duration: 0 },
        'filler-word': { count: 0, duration: 0 },
        'low-energy': { count: 0, duration: 0 },
        'repetitive-content': { count: 0, duration: 0 },
        'long-pause': { count: 0, duration: 0 },
    };
    for (const s of suggestions) {
        stats[s.reason].count++;
        stats[s.reason].duration = round(stats[s.reason].duration + s.duration);
    }
    return stats;
}
function emptyResult(duration) {
    return {
        suggestions: [],
        totalRemovableDuration: 0,
        originalDuration: round(duration),
        estimatedDuration: round(duration),
        stats: {
            silence: { count: 0, duration: 0 },
            'static-frame': { count: 0, duration: 0 },
            'filler-word': { count: 0, duration: 0 },
            'low-energy': { count: 0, duration: 0 },
            'repetitive-content': { count: 0, duration: 0 },
            'long-pause': { count: 0, duration: 0 },
        },
    };
}
function round(value) {
    return Math.round(value * 1000) / 1000;
}
//# sourceMappingURL=smart-cut.js.map