import type { Clip, Timeline, TimelineLabelColor, Track } from './model-types';
export type { TimelineLabelColor } from './model-types';
export declare const TIMELINE_LABEL_COLORS: readonly ["red", "orange", "amber", "yellow", "lime", "green", "teal", "cyan", "blue", "indigo", "purple", "pink"];
export declare const TIMELINE_LABEL_COLOR_HEX: Record<TimelineLabelColor, string>;
export declare const DEFAULT_TIMELINE_LABEL_COLOR_HEX = "#94a3b8";
export declare function isTimelineLabelColor(value: unknown): value is TimelineLabelColor;
export declare function normalizeTimelineLabelColor(value: unknown): TimelineLabelColor | null;
export declare function getEffectiveClipColorLabel(clip: Pick<Clip, 'colorLabel'>, track: Pick<Track, 'color'> | undefined): TimelineLabelColor | null;
export declare function getTimelineLabelColorHex(color: TimelineLabelColor | null | undefined): string;
export declare function filterTimelineClipsByColor(timeline: Timeline, color: TimelineLabelColor | null): Clip[];
//# sourceMappingURL=timeline-color-labels.d.ts.map