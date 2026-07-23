/**
 * Audio Waveform Display with Beat Markers
 *
 * Renders audio waveform visualization with beat detection markers
 * for the Timeline audio tracks. Supports beat-snap for clip editing.
 */

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import type {
  AudioRhythmResult,
  SpectrumFrame,
  OnsetEvent,
} from '@open-factory/editor-core/audio-rhythm-analysis';
import { formatTimeShort } from '@open-factory/editor-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioWaveformDisplayProps {
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
// Canvas waveform renderer
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
    const frameIdx = Math.round(time * (spectrumFrames.length / (spectrumFrames[spectrumFrames.length - 1]?.time || 1)));
    const frame = spectrumFrames[Math.max(0, Math.min(frameIdx, spectrumFrames.length - 1))];

    if (!frame) continue;

    const energy = frame.bandEnergies.reduce((a, b) => a + b, 0) / 6;
    const amp = energy * maxAmp;

    ctx.lineTo(x, midY - amp);
  }

  // Mirror
  for (let x = width - 1; x >= 0; x -= 2) {
    const time = (x + scrollLeft) / pixelsPerSecond;
    const frameIdx = Math.round(time * (spectrumFrames.length / (spectrumFrames[spectrumFrames.length - 1]?.time || 1)));
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
// Component
// ---------------------------------------------------------------------------

export function AudioWaveformDisplay({
  rhythmResult,
  width,
  height = 64,
  pixelsPerSecond,
  scrollLeft = 0,
  showBeatMarkers = true,
  beatSnapEnabled = false,
  onBeatSnapToggle,
  onBeatClick,
  currentTime = 0,
}: AudioWaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rhythmResult) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    drawWaveform(ctx, rhythmResult.spectrumFrames, width, height, pixelsPerSecond, scrollLeft, currentTime);

    if (showBeatMarkers && rhythmResult.beatTimes.length > 0) {
      drawBeatMarkers(ctx, rhythmResult.beatTimes, width, height, pixelsPerSecond, scrollLeft);
    }
  }, [rhythmResult, width, height, pixelsPerSecond, scrollLeft, showBeatMarkers, currentTime]);

  // Handle click for beat seeking
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!rhythmResult || !onBeatClick) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clickTime = (x + scrollLeft) / pixelsPerSecond;

      if (beatSnapEnabled && rhythmResult.beatTimes.length > 0) {
        // Snap to nearest beat
        const nearest = rhythmResult.beatTimes.reduce((prev, curr) =>
          Math.abs(curr - clickTime) < Math.abs(prev - clickTime) ? curr : prev,
        );
        onBeatClick(nearest);
      } else {
        onBeatClick(clickTime);
      }
    },
    [rhythmResult, scrollLeft, pixelsPerSecond, beatSnapEnabled, onBeatClick],
  );

  // Handle mouse move for hover time display
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = (x + scrollLeft) / pixelsPerSecond;
      setHoverTime(time);
    },
    [scrollLeft, pixelsPerSecond],
  );

  const tempoLabel = rhythmResult?.tempo
    ? `${rhythmResult.tempo.bpm} BPM (${Math.round(rhythmResult.tempo.confidence * 100)}%)`
    : null;

  const patternLabel = rhythmResult?.pattern
    ? { steady: '稳定', syncopated: '切分', buildup: '渐快', breakdown: '渐慢', irregular: '不规则' }[rhythmResult.pattern.type]
    : null;

  return (
    <div className="relative" data-testid="audio-waveform-display">
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: `${height}px` }}
        data-testid="audio-waveform-canvas"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverTime(null)}
      />

      {/* Beat snap toggle */}
      {onBeatSnapToggle ? (
        <button
          className={`absolute right-2 top-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
            beatSnapEnabled
              ? 'bg-amber-500 text-white'
              : 'bg-black/40 text-white/70 hover:bg-black/60'
          }`}
          type="button"
          title={beatSnapEnabled ? '关闭节拍吸附' : '开启节拍吸附'}
          data-testid="beat-snap-toggle"
          onClick={() => onBeatSnapToggle(!beatSnapEnabled)}
        >
          {beatSnapEnabled ? '🎵 吸附' : '🎵'}
        </button>
      ) : null}

      {/* Tempo info */}
      {tempoLabel ? (
        <div className="absolute left-2 top-1 flex items-center gap-2 text-[10px] text-white/70">
          <span>{tempoLabel}</span>
          {patternLabel ? <span>· {patternLabel}</span> : null}
        </div>
      ) : null}

      {/* Hover time tooltip */}
      {hoverTime !== null ? (
        <div
          className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
          data-testid="waveform-hover-time"
        >
          {formatTimeShort(hoverTime)}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Beat snap helper: snaps a given time to the nearest beat.
 */
export function snapToBeat(
  time: number,
  beatTimes: number[],
  toleranceSeconds = 0.1,
): { snapped: boolean; time: number } {
  if (beatTimes.length === 0) return { snapped: false, time };

  const nearest = beatTimes.reduce((prev, curr) =>
    Math.abs(curr - time) < Math.abs(prev - time) ? curr : prev,
  );

  if (Math.abs(nearest - time) <= toleranceSeconds) {
    return { snapped: true, time: nearest };
  }

  return { snapped: false, time };
}
