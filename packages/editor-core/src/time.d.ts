/** Default frames per second for the project timeline. */
export declare const DEFAULT_FPS = 30;
/** Default snap grid interval in seconds (1 frame at DEFAULT_FPS). */
export declare const DEFAULT_SNAP_GRID: number;
/** Project timebase used for tick-based calculations (600 ticks per second). */
export declare const PROJECT_TIMEBASE = 600;
/** Supported project frame rates. */
export declare const SUPPORTED_PROJECT_FPS: readonly [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
/** Union of supported project frame rate values. */
export type SupportedProjectFps = (typeof SUPPORTED_PROJECT_FPS)[number];
/** Timecode format: non-drop-frame or drop-frame. */
export type TimecodeFormat = 'ndf' | 'df';
/** Error codes for timecode parsing failures. */
export type TimecodeParseError = 'format' | 'minutes' | 'seconds' | 'frames' | 'duration';
/** Error codes for frame jump query parsing failures. */
export type FrameJumpParseError = TimecodeParseError | 'frame-number';
/** Parsed timecode breakdown into hours, minutes, seconds, and frames. */
export interface ParsedTimecode {
    seconds: number;
    totalFrames: number;
    hours: number;
    minutes: number;
    secondsPart: number;
    frames: number;
}
/** Result type for timecode parsing: success with ParsedTimecode or failure with error code. */
export type ParseTimecodeResult = {
    ok: true;
    value: ParsedTimecode;
} | {
    ok: false;
    error: TimecodeParseError;
};
/** Parsed frame jump query result, either a timecode or raw frame number. */
export interface ParsedFrameJump {
    kind: 'timecode' | 'frame';
    seconds: number;
    totalFrames: number;
    timecode: string;
    frameNumber?: number;
}
/** Result type for frame jump query parsing. */
export type ParseFrameJumpResult = {
    ok: true;
    value: ParsedFrameJump;
} | {
    ok: false;
    error: FrameJumpParseError;
};
/**
 * Clamp a number to [min, max] range.
 * @param value - The number to clamp
 * @param min - Minimum bound (must be <= max)
 * @param max - Maximum bound
 */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Round a number to the given decimal precision.
 * @param value - Number to round
 * @param precision - Decimal places (default 6)
 */
export declare function round(value: number, precision?: number): number;
/**
 * Snap a time value to the nearest grid boundary.
 * @param time - Time in seconds
 * @param grid - Grid interval in seconds (default: one frame)
 */
export declare function snap(time: number, grid?: number): number;
/**
 * Convert seconds to frame count.
 * @param seconds - Time in seconds
 * @param fps - Frames per second (default 30)
 */
export declare function secondsToFrames(seconds: number, fps?: number): number;
/**
 * Convert frame count to seconds.
 * @param frames - Frame number
 * @param fps - Frames per second (default 30)
 */
export declare function framesToSeconds(frames: number, fps?: number): number;
/**
 * Convert a frame number to timecode string.
 * @param frameNumber - Zero-based frame number
 * @param fps - Frames per second (default 30)
 * @param format - Timecode format: 'ndf' or 'df' (default 'ndf')
 */
export declare function frameNumberToTimecode(frameNumber: number, fps?: number, format?: TimecodeFormat): string;
/**
 * Normalize an FPS value to the nearest supported project frame rate.
 * @param value - Raw FPS value (may be undefined or non-finite)
 */
export declare function normalizeProjectFps(value: number | undefined): SupportedProjectFps;
/**
 * Check if the given FPS supports drop-frame timecode (29.97 or 59.94).
 * @param fps - Frames per second
 */
export declare function supportsDropFrameTimecode(fps: number): boolean;
export declare function normalizeTimecodeFormat(format: TimecodeFormat | undefined, fps: number): TimecodeFormat;
/**
 * Convert seconds to project ticks (600 ticks per second).
 * @param seconds - Time in seconds
 */
export declare function secondsToTicks(seconds: number): number;
/**
 * Convert project ticks to seconds.
 * @param ticks - Tick count
 */
export declare function ticksToSeconds(ticks: number): number;
export declare function ticksToTimecode(ticks: number, fps?: number, format?: TimecodeFormat): string;
/**
 * Convert seconds to HH:MM:SS:FF timecode string.
 * @param seconds - Time in seconds
 * @param fps - Frames per second (default 30)
 * @param format - Timecode format: 'ndf' or 'df' (default 'ndf')
 */
export declare function secondsToTimecode(seconds: number, fps?: number, format?: TimecodeFormat): string;
/**
 * Parse a HH:MM:SS:FF timecode string into seconds.
 * @param value - Timecode string in HH:MM:SS:FF format
 * @param options - Optional fps and duration constraints
 */
export declare function parseTimecodeToSeconds(value: string, options?: {
    fps?: number;
    duration?: number;
}): ParseTimecodeResult;
/**
 * Parse a frame jump query (timecode or f{N} frame syntax).
 * @param value - Query string: HH:MM:SS:FF timecode or f123 frame syntax
 * @param options - Optional fps, duration, and timecode format
 */
export declare function parseFrameJumpQuery(value: string, options?: {
    fps?: number;
    duration?: number;
    timecodeFormat?: TimecodeFormat;
}): ParseFrameJumpResult;
//# sourceMappingURL=time.d.ts.map