import {type ClipPitchDataPoint, type MediaAsset, pitchNoteColor} from '@open-factory/editor-core';
import {clsx} from 'clsx';
import {useEffect, useRef, useState} from 'react';
import {zhCN} from '../../i18n/strings';
import {getWaveform, type WaveformResult} from '../../media/waveform';
import {drawWaveform} from './clip-helpers';

export interface WaveformStripProps {
  clipId: string;
  asset: MediaAsset;
  pixelWidth: number;
  clipDuration: number;
  muted: boolean;
  color: string;
  pitchData?: ClipPitchDataPoint[];
  compact?: boolean;
  resolutionScale?: number;
}

export function WaveformStrip({
  clipId,
  asset,
  pixelWidth,
  clipDuration,
  muted,
  color,
  pitchData,
  compact = false,
  resolutionScale = 1,
}: WaveformStripProps) {
  const [waveform, setWaveform] = useState<WaveformResult | undefined>();
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWidth = Math.max(1, Math.round(pixelWidth));
  const canvasHeight = compact ? 16 : 40;
  const pointsPerSecond = Math.max(
    8,
    Math.ceil((canvasWidth / Math.max(0.001, clipDuration)) * Math.max(0.1, resolutionScale)),
  );

  useEffect(() => {
    let canceled = false;
    setWaveform(undefined);
    setFailed(false);
    void getWaveform(asset, pointsPerSecond)
      .then((result) => {
        if (!canceled) {
          setWaveform(result);
        }
      })
      .catch(() => {
        if (!canceled) {
          setFailed(true);
        }
      });
    return () => {
      canceled = true;
    };
  }, [asset, pointsPerSecond]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    drawWaveform(context, canvasWidth, canvasHeight, waveform?.peaks, color);
  }, [canvasHeight, canvasWidth, color, waveform]);

  if (failed) {
    return null;
  }
  return (
    <span
      className={clsx(
        'absolute z-0 overflow-hidden',
        compact ? 'bottom-0 left-0 right-0 h-4 border-t border-white/20 bg-black/20' : 'inset-0',
      )}
      data-testid={`timeline-waveform-${clipId}`}
      title={waveform?.isSampled ? zhCN.timeline.sampledWaveform : zhCN.timeline.waveform}
      style={{ opacity: muted ? 0.2 : compact ? 0.62 : 0.48 }}
    >
      <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} className="h-full w-full" />
      {pitchData && pitchData.length > 0 ? (
        <PitchCurveOverlay
          clipId={clipId}
          data={pitchData}
          width={canvasWidth}
          height={canvasHeight}
          duration={clipDuration}
          compact={compact}
        />
      ) : null}
    </span>
  );
}

function PitchCurveOverlay({
  clipId,
  data,
  width,
  height,
  duration,
  compact,
}: {
  clipId: string;
  data: ClipPitchDataPoint[];
  width: number;
  height: number;
  duration: number;
  compact: boolean;
}) {
  const points = data.filter(
    (point) => point.time >= 0 && point.time <= duration && Number.isFinite(point.hz) && point.hz > 0,
  );
  if (points.length === 0) {
    return null;
  }
  const hzValues = points.map((point) => point.hz);
  const minHz = Math.min(...hzValues);
  const maxHz = Math.max(...hzValues);
  const range = Math.max(1, Math.log2(maxHz / Math.max(1, minHz)));
  const topPadding = compact ? 2 : 4;
  const bottomPadding = compact ? 2 : 6;
  const drawableHeight = Math.max(1, height - topPadding - bottomPadding);
  const toSvgPoint = (point: ClipPitchDataPoint) => {
    const x = Math.max(0, Math.min(width, (point.time / Math.max(0.001, duration)) * width));
    const normalized = range <= 1e-6 ? 0.5 : Math.log2(point.hz / Math.max(1, minHz)) / range;
    const y = topPadding + (1 - normalized) * drawableHeight;
    return { x, y };
  };

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      data-testid={`timeline-pitch-curve-${clipId}`}
    >
      {points.length === 1 ? (
        <circle
          cx={toSvgPoint(points[0]).x}
          cy={toSvgPoint(points[0]).y}
          r={compact ? 1.5 : 2.5}
          fill={pitchNoteColor(points[0].note)}
        />
      ) : (
        points.slice(1).map((point, index) => {
          const previous = points[index];
          const start = toSvgPoint(previous);
          const end = toSvgPoint(point);
          return (
            <line
              key={`${previous.time}-${point.time}-${index}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={pitchNoteColor(point.note)}
              strokeWidth={compact ? 1.5 : 2}
              strokeLinecap="round"
              opacity={0.92}
            />
          );
        })
      )}
    </svg>
  );
}
