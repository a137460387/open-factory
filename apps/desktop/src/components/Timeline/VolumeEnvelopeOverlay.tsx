import {memo} from 'react';
import {getVolumeEnvelopePoints, snapTime, type Clip, type VolumeEnvelopePoint} from '@open-factory/editor-core';
import {clsx} from 'clsx';
import {useRef, useState} from 'react';
import {zhCN} from '../../i18n/strings';
import type {VolumeEnvelopePointRequest, VolumeEnvelopeMenuRequest} from './timeline-parts-types';
import {envelopePointX, envelopePointY} from './clip-helpers';

export const VolumeEnvelopeOverlay = memo(function VolumeEnvelopeOverlay({
  clip,
  disabled,
  onAdd,
  onUpdate,
  onRemove,
  onMenu,
}: {
  clip: Extract<Clip, { type: 'audio' }>;
  disabled: boolean;
  onAdd(request: VolumeEnvelopePointRequest): void;
  onUpdate(request: Required<VolumeEnvelopePointRequest>): void;
  onRemove(request: Required<Pick<VolumeEnvelopePointRequest, 'clipId' | 'keyframeId'>>): void;
  onMenu(request: VolumeEnvelopeMenuRequest): void;
}) {
  const overlayRef = useRef<HTMLSpanElement | null>(null);
  const [draftPoint, setDraftPoint] = useState<Required<VolumeEnvelopePointRequest> | undefined>();
  const duration = Math.max(0.001, clip.duration);
  const basePoints = getVolumeEnvelopePoints(clip);
  const points = draftPoint
    ? basePoints.map((point) =>
        point.id === draftPoint.keyframeId ? { ...point, time: draftPoint.time, value: draftPoint.value } : point,
      )
    : basePoints;
  const svgPoints = points.map((point) => `${envelopePointX(point, duration)},${envelopePointY(point)}`).join(' ');

  const eventToRequest = (
    event: Pick<React.PointerEvent<HTMLElement>, 'clientX' | 'clientY'>,
  ): VolumeEnvelopePointRequest | undefined => {
    const bounds = overlayRef.current?.getBoundingClientRect();
    if (!bounds) {
      return undefined;
    }
    const x = Math.min(bounds.width, Math.max(0, event.clientX - bounds.left));
    const y = Math.min(bounds.height, Math.max(0, event.clientY - bounds.top));
    return {
      clipId: clip.id,
      time: snapTime((x / Math.max(1, bounds.width)) * clip.duration),
      value: Math.round(Math.min(2, Math.max(0, 2 - (y / Math.max(1, bounds.height)) * 2)) * 100) / 100,
    };
  };

  const persistedPoints = points.filter((point) => point.persisted);

  return (
    <span
      ref={overlayRef}
      className={clsx(
        'absolute inset-0 z-20 cursor-crosshair',
        disabled ? 'pointer-events-none opacity-50' : 'pointer-events-auto',
      )}
      data-testid={`timeline-volume-envelope-${clip.id}`}
      onPointerDown={(event) => {
        if (event.button !== 0 || disabled) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const request = eventToRequest(event);
        if (request) {
          onAdd(request);
        }
      }}
      onContextMenu={(event) => {
        if (disabled) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onMenu({ x: event.clientX, y: event.clientY, clipId: clip.id });
      }}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          points={svgPoints}
          fill="none"
          stroke="rgba(15, 23, 42, 0.45)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={svgPoints}
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {persistedPoints.map((point) => (
        <button
          key={point.id}
          className="absolute z-30 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-[var(--color-bg-elevated)] shadow"
          style={{ left: `${envelopePointX(point, duration)}%`, top: `${envelopePointY(point)}%` }}
          type="button"
          title={zhCN.timeline.volumeEnvelopePointTitle(point.time, point.value)}
          data-testid={`timeline-volume-envelope-point-${clip.id}-${point.id}`}
          onPointerDown={(event) => {
            if (event.button !== 0 || disabled) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            setDraftPoint({ clipId: clip.id, keyframeId: point.id, time: point.time, value: point.value });
          }}
          onPointerMove={(event) => {
            if (!draftPoint || draftPoint.keyframeId !== point.id) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            const request = eventToRequest(event);
            if (request) {
              setDraftPoint({ ...request, keyframeId: point.id });
            }
          }}
          onPointerUp={(event) => {
            if (!draftPoint || draftPoint.keyframeId !== point.id) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            onUpdate(draftPoint);
            setDraftPoint(undefined);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDraftPoint(undefined);
            onRemove({ clipId: clip.id, keyframeId: point.id });
          }}
        />
      ))}
    </span>
  );
});
