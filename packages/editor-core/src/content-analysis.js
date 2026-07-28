export const CONTENT_ANALYSIS_VERSION = 1;
export const CONTENT_SCENE_TYPES = ['indoor', 'outdoor', 'night', 'action', 'dialogue', 'close-up'];
export function classifySceneTypes(input) {
    const brightness = clamp01(input.brightness);
    const saturation = clamp01(input.saturation);
    const motion = clamp01(input.motion);
    const faceRatio = clamp01(input.faceRatio ?? 0);
    const colorTemperature = input.colorTemperature ?? 5600;
    const loudnessVariance = Math.max(0, input.loudnessVariance ?? 0);
    const silenceRatio = clamp01(input.silenceRatio ?? 0);
    const output = [];
    if (brightness < 0.28) {
        output.push('night');
    }
    if (motion >= 0.58) {
        output.push('action');
    }
    if (faceRatio >= 0.32) {
        output.push('close-up');
    }
    if (loudnessVariance >= 0.08 && silenceRatio >= 0.18 && silenceRatio <= 0.72) {
        output.push('dialogue');
    }
    if (brightness >= 0.62 && saturation >= 0.34 && colorTemperature >= 5200 && !output.includes('night')) {
        output.push('outdoor');
    }
    if (!output.includes('outdoor') && !output.includes('night')) {
        output.push('indoor');
    }
    if (output.length === 0) {
        output.push('indoor');
    }
    return dedupeSceneTypes(output);
}
export function sampleEmotionCurve(samples, segmentDuration) {
    const buckets = bucketVisualSamples(samples, segmentDuration);
    return buckets.map((bucket) => {
        const brightness = average(bucket.samples.map((sample) => clamp01(sample.brightness)));
        const previousBrightness = bucket.previousBrightness ?? brightness;
        return {
            time: round(bucket.start),
            brightness: round(brightness),
            value: round(Math.min(1, Math.abs(brightness - previousBrightness) * 1.6 + brightness * 0.65)),
        };
    });
}
export function detectDialogueTurns(samples, options = {}) {
    const silenceThreshold = options.silenceThreshold ?? 0.08;
    const minTurnDuration = options.minTurnDuration ?? 0.35;
    const mergeGap = options.mergeGap ?? 0.28;
    const sorted = [...samples]
        .filter((sample) => Number.isFinite(sample.time) && Number.isFinite(sample.loudness))
        .sort((left, right) => left.time - right.time);
    const turns = [];
    let active;
    for (let index = 0; index < sorted.length; index += 1) {
        const sample = sorted[index];
        const next = sorted[index + 1];
        const end = next ? next.time : sample.time + inferSampleStep(sorted, index);
        const loudness = clamp01(sample.loudness);
        if (loudness > silenceThreshold) {
            if (!active) {
                active = { start: sample.time, end, values: [loudness] };
            }
            else {
                active.end = end;
                active.values.push(loudness);
            }
            continue;
        }
        if (active && sample.time - active.end > mergeGap) {
            pushDialogueTurn(turns, active, minTurnDuration);
            active = undefined;
        }
    }
    if (active) {
        pushDialogueTurn(turns, active, minTurnDuration);
    }
    return turns;
}
export function buildClipContentAnalysis(input) {
    const duration = Math.max(0, input.duration);
    const segmentDuration = Math.max(0.25, input.segmentDuration ?? Math.max(1, Math.min(4, duration / 4 || 1)));
    const visualBuckets = bucketVisualSamples(input.visualSamples, segmentDuration);
    const audioSamples = input.audioSamples ?? [];
    const dialogueTurns = detectDialogueTurns(audioSamples);
    const segments = visualBuckets.map((bucket) => {
        const audioInRange = audioSamples.filter((sample) => sample.time >= bucket.start && sample.time < bucket.end);
        const loudnessValues = audioInRange.map((sample) => clamp01(sample.loudness));
        const loudnessVariance = variance(loudnessValues);
        const silenceRatio = loudnessValues.length > 0 ? loudnessValues.filter((value) => value <= 0.08).length / loudnessValues.length : 0;
        const brightness = average(bucket.samples.map((sample) => clamp01(sample.brightness)));
        const motion = average(bucket.samples.map((sample) => clamp01(sample.motion)));
        const saturation = average(bucket.samples.map((sample) => clamp01(sample.saturation)));
        const faceRatio = average(bucket.samples.map((sample) => clamp01(sample.faceRatio ?? 0)));
        const colorTemperature = average(bucket.samples.map((sample) => sample.colorTemperature ?? 5600));
        return {
            start: round(bucket.start),
            end: round(Math.min(duration || bucket.end, bucket.end)),
            sceneTypes: classifySceneTypes({
                brightness,
                saturation,
                motion,
                faceRatio,
                colorTemperature,
                loudnessVariance,
                silenceRatio,
            }),
            brightness: round(brightness),
            motion: round(motion),
            ...(loudnessValues.length > 0 ? { loudness: round(average(loudnessValues)) } : {}),
        };
    });
    const sceneTypes = rankSceneTypes([
        ...segments.flatMap((segment) => segment.sceneTypes),
        ...(dialogueTurns.length > 0 ? ['dialogue'] : []),
    ]);
    const primarySceneType = sceneTypes[0] ?? 'indoor';
    return normalizeClipContentAnalysis({
        version: CONTENT_ANALYSIS_VERSION,
        analyzedAt: input.analyzedAt ?? new Date(0).toISOString(),
        sceneTypes,
        primarySceneType,
        segments,
        emotionCurve: sampleEmotionCurve(input.visualSamples, segmentDuration),
        dialogueTurns,
        summary: buildContentAnalysisSummary(primarySceneType, segments.length, dialogueTurns.length),
    });
}
export function normalizeClipContentAnalysis(input) {
    if (!isRecord(input)) {
        return undefined;
    }
    const segments = Array.isArray(input.segments)
        ? input.segments.map(normalizeSegment).filter((segment) => Boolean(segment))
        : [];
    const emotionCurve = Array.isArray(input.emotionCurve)
        ? input.emotionCurve.map(normalizeEmotionPoint).filter((point) => Boolean(point))
        : [];
    const dialogueTurns = Array.isArray(input.dialogueTurns)
        ? input.dialogueTurns.map(normalizeDialogueTurn).filter((turn) => Boolean(turn))
        : [];
    const sceneTypes = rankSceneTypes([
        ...(Array.isArray(input.sceneTypes) ? input.sceneTypes.filter(isContentSceneType) : []),
        ...segments.flatMap((segment) => segment.sceneTypes),
    ]);
    const primarySceneType = isContentSceneType(input.primarySceneType)
        ? input.primarySceneType
        : (sceneTypes[0] ?? 'indoor');
    const analyzedAt = typeof input.analyzedAt === 'string' && input.analyzedAt.trim() ? input.analyzedAt : new Date(0).toISOString();
    return {
        version: CONTENT_ANALYSIS_VERSION,
        analyzedAt,
        sceneTypes: sceneTypes.length > 0 ? sceneTypes : [primarySceneType],
        primarySceneType,
        segments,
        emotionCurve,
        dialogueTurns,
        ...(typeof input.summary === 'string' && input.summary.trim() ? { summary: input.summary.trim() } : {}),
    };
}
export function serializeClipContentAnalysisJson(clip) {
    const analysis = normalizeClipContentAnalysis(clip.contentAnalysis);
    return JSON.stringify({
        clipId: clip.id,
        clipName: clip.name,
        contentAnalysis: analysis ?? null,
    }, null, 2);
}
function normalizeSegment(input) {
    if (!isRecord(input)) {
        return undefined;
    }
    const start = finiteNumber(input.start);
    const end = finiteNumber(input.end);
    if (start === undefined || end === undefined || end < start) {
        return undefined;
    }
    const sceneTypes = rankSceneTypes(Array.isArray(input.sceneTypes) ? input.sceneTypes.filter(isContentSceneType) : []);
    return {
        start: round(Math.max(0, start)),
        end: round(Math.max(0, end)),
        sceneTypes: sceneTypes.length > 0 ? sceneTypes : ['indoor'],
        brightness: round(clamp01(finiteNumber(input.brightness) ?? 0)),
        motion: round(clamp01(finiteNumber(input.motion) ?? 0)),
        ...(finiteNumber(input.loudness) !== undefined ? { loudness: round(clamp01(finiteNumber(input.loudness))) } : {}),
    };
}
function normalizeEmotionPoint(input) {
    if (!isRecord(input)) {
        return undefined;
    }
    const time = finiteNumber(input.time);
    if (time === undefined) {
        return undefined;
    }
    return {
        time: round(Math.max(0, time)),
        value: round(clamp01(finiteNumber(input.value) ?? 0)),
        brightness: round(clamp01(finiteNumber(input.brightness) ?? finiteNumber(input.value) ?? 0)),
    };
}
function normalizeDialogueTurn(input) {
    if (!isRecord(input)) {
        return undefined;
    }
    const start = finiteNumber(input.start);
    const end = finiteNumber(input.end);
    if (start === undefined || end === undefined || end < start) {
        return undefined;
    }
    return {
        start: round(Math.max(0, start)),
        end: round(Math.max(0, end)),
        loudness: round(clamp01(finiteNumber(input.loudness) ?? 0)),
    };
}
function bucketVisualSamples(samples, segmentDuration) {
    const sorted = [...samples]
        .filter((sample) => Number.isFinite(sample.time))
        .sort((left, right) => left.time - right.time);
    if (sorted.length === 0) {
        return [
            { start: 0, end: segmentDuration, samples: [{ time: 0, brightness: 0.45, saturation: 0.35, motion: 0.1 }] },
        ];
    }
    const lastTime = Math.max(segmentDuration, sorted[sorted.length - 1].time);
    const buckets = [];
    let previousBrightness;
    for (let start = 0; start <= lastTime + 0.000001; start += segmentDuration) {
        const end = start + segmentDuration;
        const inRange = sorted.filter((sample) => sample.time >= start && sample.time < end);
        if (inRange.length === 0) {
            continue;
        }
        buckets.push({ start, end, previousBrightness, samples: inRange });
        previousBrightness = average(inRange.map((sample) => clamp01(sample.brightness)));
    }
    return buckets;
}
function rankSceneTypes(types) {
    const counts = new Map();
    for (const type of types) {
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return CONTENT_SCENE_TYPES.filter((type) => counts.has(type)).sort((left, right) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0));
}
function dedupeSceneTypes(types) {
    return CONTENT_SCENE_TYPES.filter((type) => types.includes(type));
}
function isContentSceneType(value) {
    return typeof value === 'string' && CONTENT_SCENE_TYPES.includes(value);
}
function pushDialogueTurn(turns, active, minTurnDuration) {
    if (active.end - active.start < minTurnDuration) {
        return;
    }
    turns.push({ start: round(active.start), end: round(active.end), loudness: round(average(active.values)) });
}
function inferSampleStep(samples, index) {
    const current = samples[index];
    const previous = samples[index - 1];
    if (previous && current.time > previous.time) {
        return current.time - previous.time;
    }
    return 0.25;
}
function buildContentAnalysisSummary(primary, segmentCount, dialogueCount) {
    return `${primary}:${segmentCount}:${dialogueCount}`;
}
function average(values) {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
}
function variance(values) {
    if (values.length === 0) {
        return 0;
    }
    const mean = average(values);
    return average(values.map((value) => (value - mean) ** 2));
}
function clamp01(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.min(1, Math.max(0, value));
}
function round(value) {
    return Math.round(value * 1000) / 1000;
}
function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
//# sourceMappingURL=content-analysis.js.map