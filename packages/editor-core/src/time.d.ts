export declare const DEFAULT_FPS = 30;
export declare const DEFAULT_SNAP_GRID: number;
export declare const PROJECT_TIMEBASE = 600;
export declare const SUPPORTED_PROJECT_FPS: readonly [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
export type SupportedProjectFps = (typeof SUPPORTED_PROJECT_FPS)[number];
export type TimecodeFormat = 'ndf' | 'df';
export type TimecodeParseError = 'format' | 'minutes' | 'seconds' | 'frames' | 'duration';
export type FrameJumpParseError = TimecodeParseError | 'frame-number';
export interface ParsedTimecode {
    seconds: number;
    totalFrames: number;
    hours: number;
    minutes: number;
    secondsPart: number;
    frames: number;
}
export type ParseTimecodeResult = {
    ok: true;
    value: ParsedTimecode;
} | {
    ok: false;
    error: TimecodeParseError;
};
export interface ParsedFrameJump {
    kind: 'timecode' | 'frame';
    seconds: number;
    totalFrames: number;
    timecode: string;
    frameNumber?: number;
}
export type ParseFrameJumpResult = {
    ok: true;
    value: ParsedFrameJump;
} | {
    ok: false;
    error: FrameJumpParseError;
};
export declare function clamp(value: number, min: number, max: number): number;
export declare function round(value: number, precision?: number): number;
export declare function snap(time: number, grid?: number): number;
export declare function secondsToFrames(seconds: number, fps?: number): number;
export declare function framesToSeconds(frames: number, fps?: number): number;
export declare function frameNumberToTimecode(frameNumber: number, fps?: number, format?: TimecodeFormat): string;
export declare function normalizeProjectFps(value: number | undefined): SupportedProjectFps;
export declare function supportsDropFrameTimecode(fps: number): boolean;
export declare function normalizeTimecodeFormat(format: TimecodeFormat | undefined, fps: number): TimecodeFormat;
export declare function secondsToTicks(seconds: number): number;
export declare function ticksToSeconds(ticks: number): number;
export declare function ticksToTimecode(ticks: number, fps?: number, format?: TimecodeFormat): string;
export declare function secondsToTimecode(seconds: number, fps?: number, format?: TimecodeFormat): string;
export declare function parseTimecodeToSeconds(value: string, options?: {
    fps?: number;
    duration?: number;
}): ParseTimecodeResult;
export declare function parseFrameJumpQuery(value: string, options?: {
    fps?: number;
    duration?: number;
    timecodeFormat?: TimecodeFormat;
}): ParseFrameJumpResult;
//# sourceMappingURL=time.d.ts.map