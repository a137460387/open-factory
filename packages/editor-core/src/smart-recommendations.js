import { getTimelineDuration } from './timeline';
import { round } from './time';
const DEFAULT_HISTOGRAM_BINS = 12;
const DEFAULT_DURATION_TOLERANCE = 0.2;
const DEFAULT_MAX_RECOMMENDATIONS = 12;
export function calculateColorHistogramDistance(left, right) {
    const normalizedLeft = normalizeHistogram(left);
    const normalizedRight = normalizeHistogram(right);
    const length = Math.max(normalizedLeft.length, normalizedRight.length);
    if (length === 0) {
        return 0;
    }
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
        sum += Math.abs((normalizedLeft[index] ?? 0) - (normalizedRight[index] ?? 0));
    }
    return round(Math.min(1, sum / 2));
}
export function calculateColorHistogramSimilarity(left, right) {
    return round(1 - calculateColorHistogramDistance(left, right));
}
export function durationMatchesGap(assetDuration, gapDuration, tolerance = DEFAULT_DURATION_TOLERANCE) {
    return calculateDurationMatchScore(assetDuration, gapDuration, tolerance) > 0;
}
export function calculateDurationMatchScore(assetDuration, gapDuration, tolerance = DEFAULT_DURATION_TOLERANCE) {
    if (!Number.isFinite(assetDuration) || !Number.isFinite(gapDuration) || assetDuration <= 0 || gapDuration <= 0) {
        return 0;
    }
    const allowedDelta = Math.max(0.001, gapDuration * Math.max(0, tolerance));
    const delta = Math.abs(assetDuration - gapDuration);
    if (delta > allowedDelta) {
        return 0;
    }
    return round(1 - delta / allowedDelta);
}
export function detectTimelineGaps(timeline, minGapDuration = 0.1) {
    const gaps = [];
    for (const track of timeline.tracks) {
        if (track.type !== 'video') {
            continue;
        }
        const clips = [...track.clips].filter(isVisualMediaClip).sort((left, right) => left.start - right.start);
        if (clips.length < 2) {
            continue;
        }
        let cursor = round(clips[0].start + clips[0].duration);
        for (const clip of clips.slice(1)) {
            if (clip.start - cursor >= minGapDuration) {
                const start = cursor;
                const end = round(clip.start);
                gaps.push({
                    id: `${track.id}:${start}-${end}`,
                    trackId: track.id,
                    trackName: track.name,
                    start,
                    end,
                    duration: round(end - start),
                });
            }
            cursor = round(Math.max(cursor, clip.start + clip.duration));
        }
    }
    return gaps;
}
export function buildSmartTimelineContext(project, options = {}) {
    const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
    const usedClips = project.timeline.tracks.flatMap((track) => track.clips).filter(isMediaClip);
    const visualUsedClips = usedClips.filter(isVisualMediaClip);
    const usedMediaIds = Array.from(new Set(usedClips.map((clip) => clip.mediaId))).sort();
    const usedTypes = Array.from(new Set(usedClips
        .map((clip) => mediaById.get(clip.mediaId)?.type)
        .filter((type) => Boolean(type)))).sort();
    const timelineDuration = getTimelineDuration(project.timeline);
    const averageClipDuration = usedClips.length > 0 ? round(usedClips.reduce((sum, clip) => sum + clip.duration, 0) / usedClips.length) : 0;
    const rhythmCutsPerMinute = timelineDuration > 0 ? round((Math.max(usedClips.length - 1, 0) / timelineDuration) * 60) : 0;
    const weightedHistograms = visualUsedClips
        .map((clip) => {
        const asset = mediaById.get(clip.mediaId);
        return asset
            ? { histogram: getAssetHistogram(asset, options.histograms), weight: Math.max(clip.duration, 0.001) }
            : undefined;
    })
        .filter((item) => Boolean(item));
    const colorHistogram = averageHistograms(weightedHistograms);
    return {
        usedMediaIds,
        usedTypes,
        rhythmCutsPerMinute,
        averageClipDuration,
        colorHistogram,
        gaps: detectTimelineGaps(project.timeline, options.minGapDuration),
    };
}
export function buildSmartSegmentRecommendations(project, options = {}) {
    const context = buildSmartTimelineContext(project, options);
    const used = new Set(context.usedMediaIds);
    const candidates = project.media.filter((asset) => !used.has(asset.id) && (asset.type === 'video' || asset.type === 'image'));
    const maxRecommendations = Math.max(1, Math.floor(options.maxRecommendations ?? DEFAULT_MAX_RECOMMENDATIONS));
    const tolerance = options.durationTolerance ?? DEFAULT_DURATION_TOLERANCE;
    return candidates
        .map((asset) => buildRecommendationForAsset(asset, context, options.histograms, tolerance))
        .sort((left, right) => right.score - left.score || left.assetName.localeCompare(right.assetName))
        .slice(0, maxRecommendations);
}
export function sortRecommendationsBySimilarity(recommendations) {
    return [...recommendations].sort((left, right) => right.colorSimilarity - left.colorSimilarity ||
        right.score - left.score ||
        left.assetName.localeCompare(right.assetName));
}
function buildRecommendationForAsset(asset, context, histograms, tolerance) {
    const histogram = getAssetHistogram(asset, histograms);
    const colorSimilarity = context.colorHistogram.length > 0 ? calculateColorHistogramSimilarity(context.colorHistogram, histogram) : 0;
    const gapMatch = findBestGapMatch(asset, context.gaps, tolerance);
    const typeScore = calculateTypeScore(asset.type, context.usedTypes);
    const durationScore = gapMatch?.score ?? 0;
    const score = round(context.gaps.length > 0
        ? colorSimilarity * 0.58 + durationScore * 0.32 + typeScore * 0.1
        : colorSimilarity * 0.82 + typeScore * 0.18);
    return {
        id: `recommendation:${asset.id}:${gapMatch?.gap.id ?? 'style'}`,
        assetId: asset.id,
        assetName: asset.name,
        assetType: asset.type,
        duration: asset.duration,
        thumbnail: asset.thumbnail,
        score,
        colorSimilarity,
        durationScore,
        typeScore,
        reasons: buildReasons(colorSimilarity, durationScore, typeScore),
        ...(gapMatch ? { gap: gapMatch.gap } : {}),
    };
}
function findBestGapMatch(asset, gaps, tolerance) {
    let best;
    for (const gap of gaps) {
        const score = calculateDurationMatchScore(asset.duration, gap.duration, tolerance);
        if (!best || score > best.score || (score === best.score && gap.start < best.gap.start)) {
            best = { gap, score };
        }
    }
    return best && best.score > 0 ? best : undefined;
}
function buildReasons(colorSimilarity, durationScore, typeScore) {
    const reasons = [{ code: 'unused', weight: 1 }];
    if (colorSimilarity >= 0.72) {
        reasons.push({ code: 'color-similar', weight: colorSimilarity });
    }
    if (durationScore > 0) {
        reasons.push({ code: 'duration-fit', weight: durationScore });
    }
    if (typeScore >= 0.8) {
        reasons.push({ code: 'type-match', weight: typeScore });
    }
    return reasons;
}
function calculateTypeScore(type, usedTypes) {
    if (usedTypes.includes(type)) {
        return 1;
    }
    if ((type === 'video' || type === 'image') && (usedTypes.includes('video') || usedTypes.includes('image'))) {
        return 0.75;
    }
    return 0.35;
}
function getAssetHistogram(asset, histograms) {
    const provided = histograms?.[asset.id];
    if (provided && provided.length > 0) {
        return normalizeHistogram(provided);
    }
    const thumbnailColor = extractHexColorFromSvgThumbnail(asset.thumbnail);
    if (thumbnailColor) {
        return hexColorToHistogram(thumbnailColor);
    }
    return hashAssetToHistogram(asset);
}
function normalizeHistogram(values) {
    if (!values?.length) {
        return [];
    }
    const sanitized = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
    const sum = sanitized.reduce((total, value) => total + value, 0);
    if (sum <= 0) {
        return new Array(sanitized.length).fill(0);
    }
    return sanitized.map((value) => round(value / sum));
}
function averageHistograms(items) {
    if (items.length === 0) {
        return [];
    }
    const length = Math.max(...items.map((item) => item.histogram.length), DEFAULT_HISTOGRAM_BINS);
    const output = new Array(length).fill(0);
    let totalWeight = 0;
    for (const item of items) {
        const weight = Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 1;
        const normalized = normalizeHistogram(item.histogram);
        totalWeight += weight;
        for (let index = 0; index < length; index += 1) {
            output[index] += (normalized[index] ?? 0) * weight;
        }
    }
    return normalizeHistogram(totalWeight > 0 ? output.map((value) => value / totalWeight) : output);
}
function extractHexColorFromSvgThumbnail(thumbnail) {
    if (!thumbnail?.startsWith('data:image/svg+xml')) {
        return undefined;
    }
    const decoded = safeDecodeURIComponent(thumbnail);
    const match = decoded.match(/fill=["'](#[0-9a-fA-F]{3,8})["']/);
    return match?.[1];
}
function safeDecodeURIComponent(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
function hexColorToHistogram(hex) {
    const rgb = parseHexColor(hex);
    if (!rgb) {
        return [];
    }
    const histogram = new Array(DEFAULT_HISTOGRAM_BINS).fill(0);
    histogram[Math.min(3, Math.floor(rgb.r / 64))] += 1;
    histogram[4 + Math.min(3, Math.floor(rgb.g / 64))] += 1;
    histogram[8 + Math.min(3, Math.floor(rgb.b / 64))] += 1;
    return normalizeHistogram(histogram);
}
function parseHexColor(hex) {
    const clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
        const [r, g, b] = clean.split('').map((char) => Number.parseInt(`${char}${char}`, 16));
        return { r, g, b };
    }
    if (clean.length >= 6) {
        return {
            r: Number.parseInt(clean.slice(0, 2), 16),
            g: Number.parseInt(clean.slice(2, 4), 16),
            b: Number.parseInt(clean.slice(4, 6), 16),
        };
    }
    return undefined;
}
function hashAssetToHistogram(asset) {
    const text = `${asset.name}|${asset.path}|${asset.type}`.toLocaleLowerCase();
    const histogram = new Array(DEFAULT_HISTOGRAM_BINS).fill(0);
    for (let index = 0; index < text.length; index += 1) {
        histogram[(text.charCodeAt(index) + index) % histogram.length] += 1;
    }
    if (histogram.every((value) => value === 0)) {
        histogram[0] = 1;
    }
    return normalizeHistogram(histogram);
}
function isMediaClip(clip) {
    return 'mediaId' in clip;
}
function isVisualMediaClip(clip) {
    return (clip.type === 'video' || clip.type === 'image') && 'mediaId' in clip;
}
//# sourceMappingURL=smart-recommendations.js.map