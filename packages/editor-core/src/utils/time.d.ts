/**
 * Format seconds to HH:MM:SS.cc (with centiseconds).
 * Use for timeline/inspector display.
 */
export declare function formatTime(seconds: number): string;
/**
 * Format seconds to MM:SS (short form).
 * Use for subtitles, simple displays.
 */
export declare function formatTimeShort(seconds: number): string;
/**
 * Format seconds to human-readable Chinese duration string.
 * e.g. "3秒", "2分15秒", "1时30分"
 */
export declare function formatDuration(seconds: number): string;
/**
 * Format milliseconds to human-readable duration string.
 * e.g. "500ms", "2.5s", "3m 10s", "1h 5m"
 */
export declare function formatDurationMs(ms: number): string;
/**
 * Format seconds as HH:MM:SS timecode (integer seconds, no centiseconds).
 * Use for FFmpeg timecodes, export progress.
 */
export declare function formatTimecode(seconds: number): string;
//# sourceMappingURL=time.d.ts.map