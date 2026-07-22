/**
 * Format seconds to HH:MM:SS.cc (with centiseconds).
 * Use for timeline/inspector display.
 */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to MM:SS (short form).
 * Use for subtitles, simple displays.
 */
export function formatTimeShort(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${min}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to human-readable Chinese duration string.
 * e.g. "3秒", "2分15秒", "1时30分"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.round(seconds % 60)}秒`;
  return `${Math.floor(seconds / 3600)}时${Math.floor((seconds % 3600) / 60)}分`;
}

/**
 * Format milliseconds to human-readable duration string.
 * e.g. "500ms", "2.5s", "3m 10s", "1h 5m"
 */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Format seconds as HH:MM:SS timecode (integer seconds, no centiseconds).
 * Use for FFmpeg timecodes, export progress.
 */
export function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
