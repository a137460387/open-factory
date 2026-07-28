import { type SnapEdge, type TimelineSnapInput, type TimelineSnapTarget } from './timeline-snapping';
export type TimelineGridUnit = 'frame' | '5-frames' | '10-frames' | 'second' | '5-seconds' | 'beat' | 'measure' | 'four-measures';
export interface TimelineGridSettings {
    enabled: boolean;
    unit: TimelineGridUnit;
}
export interface TimelineGridLine {
    time: number;
    major: boolean;
}
export interface TimelineGridBuildInput {
    unit: TimelineGridUnit;
    fps: number;
    duration: number;
    visibleStart: number;
    visibleEnd: number;
    zoom: number;
    viewportWidth: number;
    beatTimes?: number[];
    minPixelSpacing?: number;
}
export interface TimelineGridSnapInput {
    clipStart: number;
    clipDuration: number;
    unit: TimelineGridUnit;
    fps: number;
    pixelsPerSecond: number;
    disabled?: boolean;
    thresholdPx?: number;
    edges?: SnapEdge[];
    beatTimes?: number[];
}
export interface TimelineGridTimeSnapInput {
    time: number;
    unit: TimelineGridUnit;
    fps: number;
    pixelsPerSecond: number;
    disabled?: boolean;
    thresholdPx?: number;
    beatTimes?: number[];
}
export type TimelineSnapInputWithGrid = TimelineSnapInput & {
    grid?: Omit<TimelineGridSnapInput, 'clipStart' | 'clipDuration' | 'pixelsPerSecond' | 'disabled' | 'thresholdPx' | 'edges'> & {
        enabled?: boolean;
    };
};
export declare const DEFAULT_TIMELINE_GRID_SETTINGS: TimelineGridSettings;
export declare function normalizeTimelineGridSettings(value: unknown): TimelineGridSettings;
export declare function normalizeTimelineGridUnit(value: unknown): TimelineGridUnit;
export declare function getTimelineGridIntervalSeconds(unit: TimelineGridUnit, fps: number): number | undefined;
export declare function buildTimelineGridLines(input: TimelineGridBuildInput): TimelineGridLine[];
export declare function findTimelineSnapTargetWithGrid(input: TimelineSnapInputWithGrid): TimelineSnapTarget | null;
export declare function findTimelineGridSnapTarget(input: TimelineGridSnapInput): TimelineSnapTarget | null;
export declare function snapTimelineTimeToGrid(input: TimelineGridTimeSnapInput): number;
//# sourceMappingURL=timeline-grid.d.ts.map