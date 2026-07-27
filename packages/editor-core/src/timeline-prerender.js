import { buildTimelineThumbnailCacheKey, calculateTimelineThumbnailTimestamps, planTimelineThumbnailCache, TIMELINE_THUMBNAIL_WIDTH } from './timeline-thumbnails';
import { round } from './time';
export const PRERENDER_LARGE_PROJECT_CLIP_THRESHOLD = 200;
export const PRERENDER_LOW_RES_WIDTH = 40;
export function buildThumbnailPrerenderPlan(clips, cachedKeys, visibleRange, thumbWidth) {
    const isLargeProject = clips.length > PRERENDER_LARGE_PROJECT_CLIP_THRESHOLD;
    const effectiveThumbWidth = isLargeProject ? PRERENDER_LOW_RES_WIDTH : (thumbWidth ?? TIMELINE_THUMBNAIL_WIDTH);
    const tasks = [];
    let cachedCount = 0;
    for (const clip of clips) {
        const timestamps = calculateTimelineThumbnailTimestamps({
            clipDuration: clip.duration,
            clipPixelWidth: clip.clipPixelWidth,
            thumbWidth: effectiveThumbWidth,
            trimStart: clip.trimStart,
            speed: clip.speed,
        });
        const plan = planTimelineThumbnailCache(clip.mediaPath, timestamps, cachedKeys);
        cachedCount += plan.hits.length;
        for (const missIndex of plan.misses) {
            const timestamp = timestamps[missIndex];
            const cacheKey = plan.keys[missIndex];
            const zone = classifyZone(timestamp, clip.clipId, visibleRange);
            const priority = zoneToPriority(zone);
            tasks.push({
                clipId: clip.clipId,
                mediaPath: clip.mediaPath,
                mediaId: clip.mediaId,
                timestamp,
                cacheKey,
                priority,
                zone,
            });
        }
    }
    tasks.sort((a, b) => a.priority - b.priority || a.timestamp - b.timestamp);
    return {
        tasks,
        totalCount: tasks.length + cachedCount,
        cachedCount,
        lowResolution: isLargeProject,
    };
}
export function buildThumbnailPrerenderProgress(completed, total) {
    const safeTotal = Math.max(0, total);
    const safeCompleted = Math.min(Math.max(0, completed), safeTotal);
    return {
        completed: safeCompleted,
        total: safeTotal,
        fraction: safeTotal > 0 ? round(safeCompleted / safeTotal) : 0,
        active: safeCompleted < safeTotal && safeTotal > 0,
    };
}
export function filterUncachedThumbnails(mediaPath, timestamps, cachedKeys) {
    const uncachedTimestamps = [];
    const uncachedKeys = [];
    for (const timestamp of timestamps) {
        const key = buildTimelineThumbnailCacheKey(mediaPath, timestamp);
        if (!cachedKeys.has(key)) {
            uncachedTimestamps.push(timestamp);
            uncachedKeys.push(key);
        }
    }
    return { uncachedTimestamps, uncachedKeys };
}
function classifyZone(timestamp, clipId, visibleRange) {
    if (!visibleRange) {
        return 'remaining';
    }
    const margin = visibleRange.nearbyMargin ?? 5;
    if (timestamp >= visibleRange.startTime && timestamp <= visibleRange.endTime) {
        return 'visible';
    }
    if (timestamp >= visibleRange.startTime - margin && timestamp <= visibleRange.endTime + margin) {
        return 'nearby';
    }
    return 'remaining';
}
function zoneToPriority(zone) {
    switch (zone) {
        case 'visible':
            return 0;
        case 'nearby':
            return 1;
        case 'remaining':
            return 2;
    }
}
//# sourceMappingURL=timeline-prerender.js.map