import { round } from './time';
export const DEFAULT_COVER_FRAME_COUNT = 6;
export const MAX_COVER_FRAME_COUNT = 24;
export function buildEvenCoverFrameTimestamps(duration, count = DEFAULT_COVER_FRAME_COUNT) {
    const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    const safeCount = Math.min(MAX_COVER_FRAME_COUNT, Math.max(1, Math.round(Number.isFinite(count) ? count : DEFAULT_COVER_FRAME_COUNT)));
    if (safeDuration <= 0) {
        return Array.from({ length: safeCount }, () => 0);
    }
    const step = safeDuration / (safeCount + 1);
    return Array.from({ length: safeCount }, (_item, index) => round(Math.min(safeDuration, step * (index + 1))));
}
export function buildCoverFrameBatchTasks(media) {
    return media
        .filter((asset) => asset.type === 'video' && !asset.missing && typeof asset.path === 'string' && asset.path.trim().length > 0)
        .map((asset, index) => ({
        assetId: asset.id,
        sourcePath: asset.path,
        outputFileName: `${sanitizeCoverFileStem(asset.name || asset.id || `video-${index + 1}`)}-cover.png`,
    }));
}
export function sanitizeCoverFileStem(value) {
    const stem = value
        .replace(/\.[^.\\/]+$/, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return stem || 'cover-frame';
}
//# sourceMappingURL=cover-frames.js.map