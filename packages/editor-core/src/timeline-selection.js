export function normalizeSelectionRect(rect) {
    return {
        left: Math.min(rect.left, rect.right),
        top: Math.min(rect.top, rect.bottom),
        right: Math.max(rect.left, rect.right),
        bottom: Math.max(rect.top, rect.bottom),
    };
}
export function rectsIntersect(leftRect, rightRect) {
    const left = normalizeSelectionRect(leftRect);
    const right = normalizeSelectionRect(rightRect);
    return left.left <= right.right && right.left <= left.right && left.top <= right.bottom && right.top <= left.bottom;
}
//# sourceMappingURL=timeline-selection.js.map