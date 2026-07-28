export const TIMELINE_LABEL_COLORS = [
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'teal',
    'cyan',
    'blue',
    'indigo',
    'purple',
    'pink',
];
export const TIMELINE_LABEL_COLOR_HEX = {
    red: '#ef4444',
    orange: '#f97316',
    amber: '#f59e0b',
    yellow: '#eab308',
    lime: '#84cc16',
    green: '#22c55e',
    teal: '#14b8a6',
    cyan: '#06b6d4',
    blue: '#3b82f6',
    indigo: '#6366f1',
    purple: '#a855f7',
    pink: '#ec4899',
};
export const DEFAULT_TIMELINE_LABEL_COLOR_HEX = '#94a3b8';
export function isTimelineLabelColor(value) {
    return typeof value === 'string' && TIMELINE_LABEL_COLORS.includes(value);
}
export function normalizeTimelineLabelColor(value) {
    return isTimelineLabelColor(value) ? value : null;
}
export function getEffectiveClipColorLabel(clip, track) {
    return normalizeTimelineLabelColor(clip.colorLabel) ?? normalizeTimelineLabelColor(track?.color);
}
export function getTimelineLabelColorHex(color) {
    return color ? TIMELINE_LABEL_COLOR_HEX[color] : DEFAULT_TIMELINE_LABEL_COLOR_HEX;
}
export function filterTimelineClipsByColor(timeline, color) {
    return timeline.tracks.flatMap((track) => track.clips.filter((clip) => {
        if (!color) {
            return true;
        }
        return getEffectiveClipColorLabel(clip, track) === color;
    }));
}
//# sourceMappingURL=timeline-color-labels.js.map