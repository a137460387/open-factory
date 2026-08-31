/**
 * Audio Waveform Display with Beat Markers
 *
 * Renders audio waveform visualization with beat detection markers
 * for the Timeline audio tracks. Supports beat-snap for clip editing.
 *
 * Sprint AU: Uses OffscreenCanvas + Worker for rendering when available,
 * keeping the main thread free during playback.
 */

import type { AudioRhythmResult, SpectrumFrame } from '@open-factory/editor-core/audio-rhythm-analysis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AudioWaveformDisplayProps {
  /** Audio rhythm analysis result */
  rhythmResult: AudioRhythmResult | null;
  /** Width of the display in pixels */
  width: number;
  /** Height of the display in pixels */
  height?: number;
  /** Timeline zoom level (pixels per second) */
  pixelsPerSecond: number;
  /** Scroll offset in pixels */
  scrollLeft?: number;
  /** Whether to show beat markers */
  showBeatMarkers?: boolean;
  /** Whether beat-snap is enabled */
  beatSnapEnabled?: boolean;
  /** Called when beat-snap is toggled */
  onBeatSnapToggle?(enabled: boolean): void;
  /** Called when a beat marker is clicked */
  onBeatClick?(time: number): void;
  /** Current playback time in seconds */
  currentTime?: number;
}

// ---------------------------------------------------------------------------
// Canvas waveform renderer (main thread fallback)
// ---------------------------------------------------------------------------

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  spectrumFrames: SpectrumFrame[],
  width: number,
  height: number,
  pixelsPerSecond: number,
  scrollLeft: number,
  currentTime: number,
) {
  ctx.clearRect(0, 0, width, height);

  if (spectrumFrames.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('无音频数据', width / 2, height / 2);
    return;
  }

  const midY = height / 2;
  const maxAmp = height * 0.42;

  // Draw waveform from band energies
  ctx.beginPath();
  ctx.moveTo(0, midY);

  for (let x = 0; x < width; x += 2) {
    const time = (x + scrollLeft) / pixelsPerSecond;
    // Find nearest spectrum frame
    const frameIdx = Math.round(
      time * (spectrumFrames.length / (spectrumFrames[spectrumFrames.length - 1]?.time || 1)),
    );
    const frame = spectrumFrames[Math.max(0, Math.min(frameIdx, spectrumFrames.length - 1))];

    if (!frame) continue;

    const energy = frame.bandEnergies.reduce((a, b) => a + b, 0) / 6;
    const amp = energy * maxAmp;

    ctx.lineTo(x, midY - amp);
  }

  // Mirror
  for (let x = width - 1; x >= 0; x -= 2) {
    const time = (x + scrollLeft) / pixelsPerSecond;
    const frameIdx = Math.round(
      time * (spectrumFrames.length / (spectrumFrames[spectrumFrames.length - 1]?.time || 1)),
    );
    const frame = spectrumFrames[Math.max(0, Math.min(frameIdx, spectrumFrames.length - 1))];

    if (!frame) continue;

    const energy = frame.bandEnergies.reduce((a, b) => a + b, 0) / 6;
    const amp = energy * maxAmp;

    ctx.lineTo(x, midY + amp);
  }

  ctx.closePath();

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
  gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.2)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.5)');
  ctx.fillStyle = gradient;
  ctx.fill();

  // Center line
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();

  // Playback head
  const headX = currentTime * pixelsPerSecond - scrollLeft;
  if (headX >= 0 && headX <= width) {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(headX, 0);
    ctx.lineTo(headX, height);
    ctx.stroke();
  }
}

function drawBeatMarkers(
  ctx: CanvasRenderingContext2D,
  beatTimes: number[],
  width: number,
  height: number,
  pixelsPerSecond: number,
  scrollLeft: number,
) {
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
  ctx.lineWidth = 1;

  for (const time of beatTimes) {
    const x = time * pixelsPerSecond - scrollLeft;
    if (x < -1 || x > width + 1) continue;

    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ---------------------------------------------------------------------------
// OffscreenCanvas support detection
// ---------------------------------------------------------------------------

const supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';

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
