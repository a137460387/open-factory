import { type TimecodeFormat } from './time';
export type TimelineRulerTickUnit = 'frame' | 'ten-frames' | 'seconds' | 'minutes';
export interface TimelineRulerScaleInput {
    zoom: number;
    viewportWidth: number;
    fps?: number;
    minTickSpacingPx?: number;
}
export interface TimelineRulerScale {
    unit: TimelineRulerTickUnit;
    stepSeconds: number;
    stepFrames?: number;
    tickSpacingPx: number;
}
export interface TimelineRulerTick {
    time: number;
    label: string;
    unit: TimelineRulerTickUnit;
    major: boolean;
}
export interface TimelineRulerTickInput extends TimelineRulerScaleInput {
    duration: number;
    visibleStart?: number;
    visibleEnd?: number;
    timecodeFormat?: TimecodeFormat;
}
export declare function calculateTimelineRulerScale(input: TimelineRulerScaleInput): TimelineRulerScale;
export declare function buildTimelineRulerTicks(input: TimelineRulerTickInput): TimelineRulerTick[];
export declare function formatTimelineRulerTickLabel(time: number, unit: TimelineRulerTickUnit, fps?: number, timecodeFormat?: TimecodeFormat): string;
//# sourceMappingURL=timeline-ruler.d.ts.map