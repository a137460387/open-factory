/** Default frames per second for the project timeline. */
export const DEFAULT_FPS = 30;
/** Default snap grid interval in seconds (1 frame at DEFAULT_FPS). */
export const DEFAULT_SNAP_GRID = 1 / DEFAULT_FPS;
/** Project timebase used for tick-based calculations (600 ticks per second). */
export const PROJECT_TIMEBASE = 600;
/** Supported project frame rates. */
export const SUPPORTED_PROJECT_FPS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
/**
 * Clamp a number to [min, max] range.
 * @param value - The number to clamp
 * @param min - Minimum bound (must be <= max)
 * @param max - Maximum bound
 */
export function clamp(value, min, max) {
    if (min > max) {
        throw new RangeError('min cannot be greater than max');
    }
    return Math.min(Math.max(value, min), max);
}
/**
 * Round a number to the given decimal precision.
 * @param value - Number to round
 * @param precision - Decimal places (default 6)
 */
export function round(value, precision = 6) {
    const factor = 10 ** precision;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}
/**
 * Snap a time value to the nearest grid boundary.
 * @param time - Time in seconds
 * @param grid - Grid interval in seconds (default: one frame)
 */
export function snap(time, grid = DEFAULT_SNAP_GRID) {
    if (grid <= 0) {
        return round(time);
    }
    return round(Math.round(time / grid) * grid);
}
/**
 * Convert seconds to frame count.
 * @param seconds - Time in seconds
 * @param fps - Frames per second (default 30)
 */
export function secondsToFrames(seconds, fps = DEFAULT_FPS) {
    if (fps <= 0) {
        throw new RangeError('fps must be greater than 0');
    }
    return Math.round(seconds * fps);
}
/**
 * Convert frame count to seconds.
 * @param frames - Frame number
 * @param fps - Frames per second (default 30)
 */
export function framesToSeconds(frames, fps = DEFAULT_FPS) {
    if (fps <= 0) {
        throw new RangeError('fps must be greater than 0');
    }
    return round(frames / fps);
}
/**
 * Convert a frame number to timecode string.
 * @param frameNumber - Zero-based frame number
 * @param fps - Frames per second (default 30)
 * @param format - Timecode format: 'ndf' or 'df' (default 'ndf')
 */
export function frameNumberToTimecode(frameNumber, fps = DEFAULT_FPS, format = 'ndf') {
    if (!Number.isFinite(frameNumber) || frameNumber < 0) {
        throw new RangeError('frameNumber must be zero or greater');
    }
    return secondsToTimecode(framesToSeconds(Math.floor(frameNumber), fps), fps, format);
}
/**
 * Normalize an FPS value to the nearest supported project frame rate.
 * @param value - Raw FPS value (may be undefined or non-finite)
 */
export function normalizeProjectFps(value) {
    if (!Number.isFinite(value)) {
        return DEFAULT_FPS;
    }
    return SUPPORTED_PROJECT_FPS.reduce((closest, candidate) => (Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest), DEFAULT_FPS);
}
/**
 * Check if the given FPS supports drop-frame timecode (29.97 or 59.94).
 * @param fps - Frames per second
 */
export function supportsDropFrameTimecode(fps) {
    const normalized = normalizeProjectFps(fps);
    return normalized === 29.97 || normalized === 59.94;
}
export function normalizeTimecodeFormat(format, fps) {
    return format === 'df' && supportsDropFrameTimecode(fps) ? 'df' : 'ndf';
}
/**
 * Convert seconds to project ticks (600 ticks per second).
 * @param seconds - Time in seconds
 */
export function secondsToTicks(seconds) {
    return Math.max(0, Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * PROJECT_TIMEBASE));
}
/**
 * Convert project ticks to seconds.
 * @param ticks - Tick count
 */
export function ticksToSeconds(ticks) {
    return round(Math.max(0, Number.isFinite(ticks) ? ticks : 0) / PROJECT_TIMEBASE);
}
export function ticksToTimecode(ticks, fps = DEFAULT_FPS, format = 'ndf') {
    return secondsToTimecode(ticksToSeconds(ticks), fps, format);
}
/**
 * Convert seconds to HH:MM:SS:FF timecode string.
 * @param seconds - Time in seconds
 * @param fps - Frames per second (default 30)
 * @param format - Timecode format: 'ndf' or 'df' (default 'ndf')
 */
export function secondsToTimecode(seconds, fps = DEFAULT_FPS, format = 'ndf') {
    const normalizedFps = normalizeProjectFps(fps);
    const nominalFps = Math.round(normalizedFps);
    const totalFrames = Math.max(0, Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * normalizedFps));
    const timecodeFrames = normalizeTimecodeFormat(format, normalizedFps) === 'df' ? addDropFrameLabels(totalFrames, nominalFps) : totalFrames;
    const frames = timecodeFrames % nominalFps;
    const totalSeconds = Math.floor(timecodeFrames / nominalFps);
    const displaySeconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    return [hours, minutes, displaySeconds, frames].map((part) => String(part).padStart(2, '0')).join(':');
}
/**
 * Parse a HH:MM:SS:FF timecode string into seconds.
 * @param value - Timecode string in HH:MM:SS:FF format
 * @param options - Optional fps and duration constraints
 */
export function parseTimecodeToSeconds(value, options = {}) {
    const match = /^(\d{2}):(\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
    if (!match) {
        return { ok: false, error: 'format' };
    }
    const [, hoursRaw, minutesRaw, secondsRaw, framesRaw] = match;
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    const secondsPart = Number(secondsRaw);
    const frames = Number(framesRaw);
    if (minutes > 59) {
        return { ok: false, error: 'minutes' };
    }
    if (secondsPart > 59) {
        return { ok: false, error: 'seconds' };
    }
    const normalizedFps = normalizeProjectFps(options.fps ?? DEFAULT_FPS);
    const nominalFps = Math.round(normalizedFps);
    if (frames >= nominalFps) {
        return { ok: false, error: 'frames' };
    }
    const totalWholeSeconds = hours * 3600 + minutes * 60 + secondsPart;
    const totalFrames = Math.max(0, Math.round(totalWholeSeconds * normalizedFps) + frames);
    const seconds = framesToSeconds(totalFrames, normalizedFps);
    if (typeof options.duration === 'number' &&
        Number.isFinite(options.duration) &&
        seconds > Math.max(0, options.duration) + 1 / Math.max(1, normalizedFps)) {
        return { ok: false, error: 'duration' };
    }
    return {
        ok: true,
        value: {
            seconds,
            totalFrames,
            hours,
            minutes,
            secondsPart,
            frames,
        },
    };
}
/**
 * Parse a frame jump query (timecode or f{N} frame syntax).
 * @param value - Query string: HH:MM:SS:FF timecode or f123 frame syntax
 * @param options - Optional fps, duration, and timecode format
 */
export function parseFrameJumpQuery(value, options = {}) {
    const trimmed = value.trim();
    const frameMatch = /^f(\d+)$/i.exec(trimmed);
    const fps = normalizeProjectFps(options.fps ?? DEFAULT_FPS);
    const timecodeFormat = options.timecodeFormat ?? 'ndf';
    if (/^f/i.test(trimmed) && !frameMatch) {
        return { ok: false, error: 'frame-number' };
    }
    if (frameMatch) {
        const frameNumber = Number(frameMatch[1]);
        if (!Number.isSafeInteger(frameNumber) || frameNumber < 0) {
            return { ok: false, error: 'frame-number' };
        }
        const seconds = framesToSeconds(frameNumber, fps);
        if (typeof options.duration === 'number' &&
            Number.isFinite(options.duration) &&
            seconds > Math.max(0, options.duration) + 1 / Math.max(1, fps)) {
            return { ok: false, error: 'duration' };
        }
        return {
            ok: true,
            value: {
                kind: 'frame',
                seconds,
                totalFrames: frameNumber,
                timecode: frameNumberToTimecode(frameNumber, fps, timecodeFormat),
                frameNumber,
            },
        };
    }
    const parsed = parseTimecodeToSeconds(trimmed, { fps, duration: options.duration });
    if (!parsed.ok) {
        return parsed;
    }
    return {
        ok: true,
        value: {
            kind: 'timecode',
            seconds: parsed.value.seconds,
            totalFrames: parsed.value.totalFrames,
            timecode: secondsToTimecode(parsed.value.seconds, fps, timecodeFormat),
        },
    };
}
function addDropFrameLabels(totalFrames, nominalFps) {
    const dropFrames = nominalFps === 60 ? 4 : 2;
    const framesPerMinute = nominalFps * 60 - dropFrames;
    const framesPer10Minutes = nominalFps * 60 * 10 - dropFrames * 9;
    const tenMinuteBlocks = Math.floor(totalFrames / framesPer10Minutes);
    const remainingFrames = totalFrames % framesPer10Minutes;
    const droppedFrames = dropFrames * (tenMinuteBlocks * 9 + Math.floor(Math.max(0, remainingFrames - dropFrames) / framesPerMinute));
    return totalFrames + droppedFrames;
}
//# sourceMappingURL=time.js.map