/**
 * Audio Waveform Display with Beat Markers
 *
 * Renders audio waveform visualization with beat detection markers
 * for the Timeline audio tracks. Supports beat-snap for clip editing.
 *
 * Sprint AU: Uses OffscreenCanvas + Worker for rendering when available,
 * keeping the main thread free during playback.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Canvas waveform renderer (main thread fallback)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// OffscreenCanvas support detection
// ---------------------------------------------------------------------------

/**
 * Beat snap helper: snaps a given time to the nearest beat.
 */
export function snapToBeat(
  time: number,
  beatTimes: number[],
  toleranceSeconds = 0.1,
): { snapped: boolean; time: number } {
  if (beatTimes.length === 0) return { snapped: false, time };

  const nearest = beatTimes.reduce((prev, curr) => (Math.abs(curr - time) < Math.abs(prev - time) ? curr : prev));

  if (Math.abs(nearest - time) <= toleranceSeconds) {
    return { snapped: true, time: nearest };
  }

  return { snapped: false, time };
}
