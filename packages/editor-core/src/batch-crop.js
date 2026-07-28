import { calculateReframeCrop, resolveReframeDimensions } from './reframe';
export const CUSTOM_ASPECT_RATIO_KEY = 'custom';
export const BATCH_ASPECT_RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:5', '21:9', 'custom'];
export function normalizeBatchAspectRatioOption(value) {
    return BATCH_ASPECT_RATIO_OPTIONS.includes(value)
        ? value
        : 'custom';
}
export function isCustomBatchAspectRatio(option) {
    return option === 'custom';
}
export function resolveCustomRatioValue(width, height) {
    const safeW = Math.max(1, Math.abs(Math.round(width)));
    const safeH = Math.max(1, Math.abs(Math.round(height)));
    return safeW / safeH;
}
export function smartAnchorForClip(clip, sourceWidth, sourceHeight) {
    return {
        mode: 'smart',
        offsetX: 0,
        offsetY: 0,
    };
}
export function calculateBatchCropPreview(target, targetAspectRatio, anchor) {
    const settings = {
        targetAspectRatio,
        reframeOffsetX: anchor.mode === 'center' ? 0 : anchor.offsetX,
        reframeOffsetY: anchor.mode === 'center' ? 0 : anchor.offsetY,
    };
    const reframeCrop = calculateReframeCrop(settings);
    const resolved = resolveReframeDimensions(target.sourceWidth, target.sourceHeight, targetAspectRatio);
    const cropWidth = resolved.width;
    const cropHeight = resolved.height;
    const offsetX = anchor.mode === 'center' ? 0 : anchor.offsetX;
    const offsetY = anchor.mode === 'center' ? 0 : anchor.offsetY;
    const cropX = Math.max(0, Math.round((target.sourceWidth - cropWidth) / 2 + ((target.sourceWidth - cropWidth) / 2) * offsetX));
    const cropY = Math.max(0, Math.round((target.sourceHeight - cropHeight) / 2 + ((target.sourceHeight - cropHeight) / 2) * offsetY));
    return {
        clipId: target.clipId,
        name: target.name,
        sourceWidth: target.sourceWidth,
        sourceHeight: target.sourceHeight,
        cropWidth,
        cropHeight,
        cropX,
        cropY,
        reframeCrop,
    };
}
export function calculateBatchCropPreviews(targets, targetAspectRatio, anchors) {
    return targets.map((target) => {
        const anchor = anchors.get(target.clipId) ?? { mode: 'center', offsetX: 0, offsetY: 0 };
        return calculateBatchCropPreview(target, targetAspectRatio, anchor);
    });
}
export function buildBatchCropResults(targets, targetAspectRatio, anchors) {
    return targets.map((target) => {
        const anchor = anchors.get(target.clipId) ?? { mode: 'center', offsetX: 0, offsetY: 0 };
        return {
            clipId: target.clipId,
            targetAspectRatio,
            offsetX: anchor.mode === 'center' ? 0 : anchor.offsetX,
            offsetY: anchor.mode === 'center' ? 0 : anchor.offsetY,
        };
    });
}
export function collectBatchCropTargets(timeline, clipIds, media) {
    const mediaMap = new Map(media.map((asset) => [asset.id, asset]));
    const targets = [];
    for (const track of timeline.tracks) {
        for (const clip of track.clips) {
            if (!clipIds.includes(clip.id)) {
                continue;
            }
            const clipMediaId = 'mediaId' in clip ? clip.mediaId : undefined;
            const mediaAsset = clipMediaId ? mediaMap.get(clipMediaId) : undefined;
            const sourceWidth = mediaAsset?.width ?? clip.width ?? 1920;
            const sourceHeight = mediaAsset?.height ?? clip.height ?? 1080;
            targets.push({
                clipId: clip.id,
                sourceWidth: Math.max(1, Math.round(sourceWidth)),
                sourceHeight: Math.max(1, Math.round(sourceHeight)),
                name: clip.name,
            });
        }
    }
    return targets;
}
export function formatAspectRatioLabel(option) {
    if (option === 'custom')
        return 'Custom';
    return option;
}
//# sourceMappingURL=batch-crop.js.map