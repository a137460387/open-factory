import { createId, normalizeMask, normalizePrivacyBlurEffect } from './model';
import { round } from './time';
export function buildPrivacyMasksFromDetections(detections, options = {}) {
    const keyframes = detections
        .flatMap((box) => normalizePrivacyBox(box))
        .sort((left, right) => left.time - right.time || left.x - right.x || left.y - right.y);
    if (keyframes.length === 0) {
        return [];
    }
    const first = keyframes[0];
    return [
        normalizeMask({
            id: createId(options.idPrefix ?? 'privacy-mask'),
            type: 'rect',
            x: first.x,
            y: first.y,
            w: first.w,
            h: first.h,
            keyframes,
            inverted: false,
            feather: 0,
            enabled: true,
            privacyBlur: {
                enabled: true,
                effect: normalizePrivacyBlurEffect(options.effect),
                color: options.color,
            },
        }),
    ];
}
function normalizePrivacyBox(box) {
    if (!Number.isFinite(box.time)) {
        return [];
    }
    const w = clampPositiveUnit(box.w, 0.1);
    const h = clampPositiveUnit(box.h, 0.1);
    return [
        {
            time: round(Math.max(0, box.time)),
            x: round(Math.min(1 - w, Math.max(0, finiteOrDefault(box.x, 0)))),
            y: round(Math.min(1 - h, Math.max(0, finiteOrDefault(box.y, 0)))),
            w,
            h,
        },
    ];
}
function clampPositiveUnit(value, fallback) {
    return round(Math.min(1, Math.max(0.001, finiteOrDefault(value, fallback))));
}
function finiteOrDefault(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
//# sourceMappingURL=privacy-blur.js.map