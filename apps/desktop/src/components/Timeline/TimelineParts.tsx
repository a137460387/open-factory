import {
  areClipsAdjacent,
  filterTimelineVirtualClips,
  secondsToTimecode,
  type Clip,
  type KeyframeProperty,
  type MediaAsset,
  snapTime,
  type TimecodeFormat,
  type TimelineVirtualRenderWindow,
  type Track,
  type Transition,
  type TransitionType
} from '@open-factory/editor-core';
import type { TimelineRenderRange } from '@open-factory/editor-core';
import type { TimelineDiffRange } from '@open-factory/editor-core';
import { clsx } from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatTrackType, zhCN } from '../../i18n/strings';
import { getTimelineThumbnailPlaceholders, getTimelineThumbnails, type TimelineThumbnailFrame } from '../../media/timeline-thumbnails';
import { getWaveform, type WaveformResult } from '../../media/waveform';
import type { SelectedKeyframeRef } from '../../store/editorStore';

export type DragMode = 'move' | 'trim-left' | 'trim-right' | 'rolling-trim' | 'slip' | 'slide' | 'playhead' | 'keyframe';

export interface DragState {
  mode: DragMode;
  clip?: Clip;
  rightClip?: Clip;
  clipIds?: string[];
  keyframeProperty?: KeyframeProperty;
  keyframeId?: string;
  startX: number;
  previewStart: number;
  previewDuration: number;
  previewTrimStart: number;
  previewTrimEnd: number;
  startByClipId?: Record<string, number>;
  previewStartsByClipId?: Record<string, number>;
  previewClipsById?: Record<string, Clip>;
  previewKeyframeTime?: number;
  previewRollingDelta?: number;
  previewSlipDelta?: number;
  previewSlideDelta?: number;
}

export const TRACK_HEIGHT = 54;
export const LABEL_WIDTH = 138;

export function Ruler({
  ticks,
  zoom,
  width,
  cachedRanges,
  diffRanges,
  fps,
  timecodeFormat,
  onSeek
}: {
  ticks: number[];
  zoom: number;
  width: number;
  cachedRanges: TimelineRenderRange[];
  diffRanges: TimelineDiffRange[];
  fps: number;
  timecodeFormat: TimecodeFormat;
  onSeek(time: number): void;
}) {
  return (
    <div className="sticky top-0 z-30 grid h-10 grid-cols-[138px_1fr] border-b border-line bg-panel">
      <div className="grid grid-rows-[10px_1fr] border-r border-line">
        <div className="px-3 text-[9px] font-medium leading-[10px] text-emerald-700">{zhCN.timeline.renderCache}</div>
        <div className="px-3 py-1 text-xs font-medium text-slate-600">{zhCN.timeline.tracks}</div>
      </div>
      <div className="min-w-0" style={{ width }}>
        <div className="relative h-2 bg-emerald-50" data-testid="timeline-render-cache-bar">
          {cachedRanges.map((range) => (
            <span
              key={`${range.start}-${range.end}`}
              className="absolute top-0 h-full bg-emerald-500"
              style={{ left: range.start * zoom, width: Math.max(1, (range.end - range.start) * zoom) }}
              data-testid="timeline-render-cache-segment"
            />
          ))}
        </div>
        <div
          className="relative h-8"
          data-testid="timeline-ruler"
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onSeek(snapTime((event.clientX - rect.left) / zoom));
          }}
        >
          {diffRanges.map((range) => (
            <span
              key={`${range.start}-${range.end}`}
              className="absolute bottom-0 top-0 bg-orange-300/55"
              style={{ left: range.start * zoom, width: Math.max(2, (range.end - range.start) * zoom) }}
              title={zhCN.timeline.snapshotDiffRange}
              data-testid="timeline-snapshot-diff-segment"
            />
          ))}
          {ticks.map((tick) => (
            <div key={tick} className="absolute top-0 h-full border-l border-slate-300 pl-1 text-[11px] text-slate-500" style={{ left: tick * zoom }}>
              {secondsToTimecode(tick, fps, timecodeFormat)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrackRow({
  track,
  zoom,
  selectedClipId,
  selectedClipIds,
  selectedKeyframe,
  drag,
  media,
  onSelect,
  onKeyframeSelect,
  onDragStart,
  onTrackPointerDown,
  onTrackUpdate,
  transitions,
  onTransitionMenu,
  onGapMenu,
  onClipMenu,
  onClipDoubleClick,
  virtualWindow,
  rollingTrimActive,
  slipEditActive,
  slideEditActive
}: {
  track: Track;
  zoom: number;
  selectedClipId?: string;
  selectedClipIds: string[];
  selectedKeyframe?: SelectedKeyframeRef;
  drag?: DragState;
  media: MediaAsset[];
  onSelect(clipId: string, additive: boolean): void;
  onKeyframeSelect(keyframe: SelectedKeyframeRef): void;
  onDragStart(drag: DragState): void;
  onTrackPointerDown(event: React.PointerEvent<HTMLDivElement>): void;
  onTrackUpdate(trackId: string, patch: Partial<Pick<Track, 'muted' | 'solo' | 'locked' | 'volume'>>): void;
  transitions: Transition[];
  onTransitionMenu(request: TransitionMenuRequest): void;
  onGapMenu(request: GapMenuRequest): void;
  onClipMenu(request: ClipMenuRequest): void;
  onClipDoubleClick(clip: Clip): void;
  virtualWindow: TimelineVirtualRenderWindow;
  rollingTrimActive: boolean;
  slipEditActive: boolean;
  slideEditActive: boolean;
}) {
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));
  const locked = Boolean(track.locked);
  const nextAdjacentByClipId = new Map<string, Clip>();
  const sortedClips = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  const virtualClips = filterTimelineVirtualClips(track.clips, virtualWindow);
  for (let index = 0; index < sortedClips.length - 1; index += 1) {
    const current = sortedClips[index];
    const next = sortedClips[index + 1];
    if (areClipsAdjacent(current, next)) {
      nextAdjacentByClipId.set(current.id, next);
    }
  }
  return (
    <div className="grid border-b border-line" style={{ gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, height: TRACK_HEIGHT }}>
      <div className="flex items-center gap-2 border-r border-line bg-panel px-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">{track.name}</div>
          <div className="text-[11px] uppercase tracking-normal text-slate-500">{formatTrackType(track.type)}</div>
        </div>
        <div className="flex items-center gap-1">
          <TrackToggle label="M" title={zhCN.timeline.muteTrack} active={Boolean(track.muted)} testId={`track-mute-${track.id}`} onClick={() => onTrackUpdate(track.id, { muted: !track.muted })} />
          <TrackToggle label="S" title={zhCN.timeline.soloTrack} active={Boolean(track.solo)} testId={`track-solo-${track.id}`} onClick={() => onTrackUpdate(track.id, { solo: !track.solo })} />
          <TrackToggle label="L" title={zhCN.timeline.lockTrack} active={locked} testId={`track-lock-${track.id}`} onClick={() => onTrackUpdate(track.id, { locked: !track.locked })} />
        </div>
        <input
          className="w-14 accent-brand"
          title={zhCN.timeline.trackVolume}
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={track.volume ?? 1}
          onChange={(event) => onTrackUpdate(track.id, { volume: Number(event.target.value) })}
          data-testid={`track-volume-${track.id}`}
        />
      </div>
      <div
        className="relative bg-white"
        onPointerDown={onTrackPointerDown}
        onContextMenu={(event) => {
          if (locked || event.target !== event.currentTarget) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          onGapMenu({
            x: event.clientX,
            y: event.clientY,
            trackId: track.id,
            time: snapTime((event.clientX - rect.left) / zoom)
          });
        }}
      >
        {virtualClips.map((clip) => {
          const isSelected = selectedClipIds.includes(clip.id) || selectedClipId === clip.id;
          const trimPreview = drag?.clip?.id === clip.id && (drag.mode === 'trim-left' || drag.mode === 'trim-right') ? drag : undefined;
          const previewClip = drag?.previewClipsById?.[clip.id];
          const movedStart = drag?.mode === 'move' ? drag.previewStartsByClipId?.[clip.id] : undefined;
          const displayClip = previewClip ?? clip;
          const left = (previewClip?.start ?? movedStart ?? trimPreview?.previewStart ?? clip.start) * zoom;
          const width = Math.max(16, (previewClip?.duration ?? trimPreview?.previewDuration ?? clip.duration) * zoom);
          return (
            <ClipBlock
              key={clip.id}
              clip={displayClip}
              asset={'mediaId' in clip ? mediaById.get(clip.mediaId) : undefined}
              left={left}
              width={width}
              selected={isSelected}
              selectedKeyframe={selectedKeyframe}
              drag={drag}
              onSelect={onSelect}
              onKeyframeSelect={onKeyframeSelect}
              onDragStart={onDragStart}
              selectedClipIds={selectedClipIds}
              locked={locked}
              clipPixelWidth={width}
              trackMuted={Boolean(track.muted)}
              trackType={track.type}
              nextAdjacentClip={nextAdjacentByClipId.get(clip.id)}
              transition={transitions.find((transition) => transition.fromClipId === clip.id && transition.toClipId === nextAdjacentByClipId.get(clip.id)?.id)}
              onTransitionMenu={onTransitionMenu}
              onClipMenu={onClipMenu}
              onClipDoubleClick={onClipDoubleClick}
              rollingTrimActive={rollingTrimActive}
              slipEditActive={slipEditActive}
              slideEditActive={slideEditActive}
            />
          );
        })}
      </div>
    </div>
  );
}

export interface TransitionMenuRequest {
  x: number;
  y: number;
  fromClipId: string;
  toClipId: string;
  existingTransitionId?: string;
  existingType?: TransitionType;
  existingDuration?: number;
}

export interface ClipMenuRequest {
  x: number;
  y: number;
  clipId: string;
  clipType: Clip['type'];
}

export interface GapMenuRequest {
  x: number;
  y: number;
  trackId: string;
  time: number;
}

function TrackToggle({
  label,
  title,
  active,
  testId,
  onClick
}: {
  label: string;
  title: string;
  active: boolean;
  testId: string;
  onClick(): void;
}) {
  return (
    <button
      className={clsx('h-6 w-6 rounded border text-[11px] font-semibold', active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-slate-600 hover:bg-panel')}
      title={title}
      type="button"
      data-testid={testId}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ClipBlock({
  clip,
  asset,
  left,
  width,
  selected,
  selectedKeyframe,
  drag,
  onSelect,
  onKeyframeSelect,
  onDragStart,
  selectedClipIds,
  locked,
  clipPixelWidth,
  trackMuted,
  trackType,
  nextAdjacentClip,
  transition,
  onTransitionMenu,
  onClipMenu,
  onClipDoubleClick,
  rollingTrimActive,
  slipEditActive,
  slideEditActive
}: {
  clip: Clip;
  asset?: MediaAsset;
  left: number;
  width: number;
  selected: boolean;
  selectedKeyframe?: SelectedKeyframeRef;
  drag?: DragState;
  onSelect(clipId: string, additive: boolean): void;
  onKeyframeSelect(keyframe: SelectedKeyframeRef): void;
  onDragStart(drag: DragState): void;
  selectedClipIds: string[];
  locked: boolean;
  clipPixelWidth: number;
  trackMuted: boolean;
  trackType: Track['type'];
  nextAdjacentClip?: Clip;
  transition?: Transition;
  onTransitionMenu(request: TransitionMenuRequest): void;
  onClipMenu(request: ClipMenuRequest): void;
  onClipDoubleClick(clip: Clip): void;
  rollingTrimActive: boolean;
  slipEditActive: boolean;
  slideEditActive: boolean;
}) {
  const waveformColor = getTrackWaveformColor(trackType);
  return (
    <div
      className={clsx(
        'group absolute top-2 flex h-10 select-none items-center overflow-hidden rounded-md border px-2 text-xs font-medium shadow-sm',
        getClipToneClass(clip.type),
        asset?.missing ? 'border-rose-500 bg-[repeating-linear-gradient(135deg,rgba(244,63,94,0.18)_0,rgba(244,63,94,0.18)_6px,transparent_6px,transparent_12px)]' : selected ? 'border-coral ring-2 ring-coral/30' : 'border-white/80',
        locked ? 'cursor-not-allowed opacity-70' : 'cursor-grab'
      )}
      style={{ left, width }}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.button === 2) {
          return;
        }
        if (locked) {
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        onSelect(clip.id, event.shiftKey);
        const advancedMode = slideEditActive ? 'slide' : slipEditActive ? 'slip' : undefined;
        const clipIds = advancedMode ? [clip.id] : selectedClipIds.includes(clip.id) ? selectedClipIds : [clip.id];
        onDragStart({
          mode: advancedMode ?? 'move',
          clip,
          clipIds,
          startX: event.clientX,
          previewStart: clip.start,
          previewDuration: clip.duration,
          previewTrimStart: clip.trimStart,
          previewTrimEnd: clip.trimEnd
        });
      }}
      onContextMenu={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const isRightEdge = bounds.right - event.clientX <= 14;
        if (locked) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (nextAdjacentClip && isRightEdge) {
          onTransitionMenu({
            x: event.clientX,
            y: event.clientY,
            fromClipId: clip.id,
            toClipId: nextAdjacentClip.id,
            existingTransitionId: transition?.id,
            existingType: transition?.type,
            existingDuration: transition?.duration
          });
          return;
        }
        onClipMenu({ x: event.clientX, y: event.clientY, clipId: clip.id, clipType: clip.type });
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onClipDoubleClick(clip);
      }}
      title={asset?.missing ? zhCN.timeline.mediaMissing : `${clip.name} (${clip.duration.toFixed(2)}s)`}
      data-testid={`timeline-clip-${clip.id}`}
      data-clip-type={clip.type}
      data-clip-id={clip.id}
    >
      {clip.type === 'video' && asset ? <VideoThumbnailStrip clip={clip} asset={asset} pixelWidth={clipPixelWidth} /> : null}
      {clip.type === 'video' && asset?.hasAudio ? (
        <WaveformStrip clipId={clip.id} asset={asset} pixelWidth={clipPixelWidth} clipDuration={clip.duration} muted={trackMuted || Boolean(clip.muted)} color={waveformColor} compact />
      ) : null}
      {transition ? (
        <span className="absolute right-1 top-1 z-20 rounded bg-brand px-1 text-[10px] font-semibold text-white" data-testid={`timeline-transition-${transition.id}`}>
          {transition.type === 'fade-black' ? 'FB' : 'DS'}
        </span>
      ) : null}
      {locked ? null : (
        <span
          className="absolute left-0 top-0 h-full w-[4px] cursor-ew-resize bg-black/20 opacity-0 transition group-hover:opacity-100"
          data-testid={`timeline-trim-left-${clip.id}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            onSelect(clip.id, event.shiftKey);
            onDragStart({
              mode: 'trim-left',
              clip,
              startX: event.clientX,
              previewStart: clip.start,
              previewDuration: clip.duration,
              previewTrimStart: clip.trimStart,
              previewTrimEnd: clip.trimEnd
            });
          }}
        />
      )}
      {clip.type === 'audio' && asset ? (
        <WaveformStrip clipId={clip.id} asset={asset} pixelWidth={clipPixelWidth} clipDuration={clip.duration} muted={trackMuted || Boolean(clip.muted)} color={waveformColor} />
      ) : null}
      <span className="relative z-10 truncate pl-1">{(clip.type === 'text' || clip.type === 'subtitle') && 'text' in clip ? clip.text.slice(0, 28) : clip.name}</span>
      <span className="relative z-10 ml-auto pl-2 tabular-nums">{clip.duration.toFixed(1)}s</span>
      {getClipKeyframeMarkers(clip).map((marker) => {
        const isSelectedKeyframe =
          selectedKeyframe?.clipId === clip.id && selectedKeyframe.property === marker.property && selectedKeyframe.keyframeId === marker.id;
        const markerTime =
          drag?.mode === 'keyframe' && drag.clip?.id === clip.id && drag.keyframeProperty === marker.property && drag.keyframeId === marker.id
            ? drag.previewKeyframeTime ?? marker.time
            : marker.time;
        return (
        <span
          key={`${marker.property}-${marker.id}`}
          className={clsx(
            'absolute bottom-0 z-20 h-2.5 w-2.5 -translate-x-1/2 rotate-45 cursor-ew-resize border shadow',
            isSelectedKeyframe ? 'border-black bg-white' : 'border-white bg-coral'
          )}
          style={{ left: `${Math.min(100, Math.max(0, (markerTime / Math.max(0.001, clip.duration)) * 100))}%` }}
          title={zhCN.timeline.keyframeTitle(formatTimelineKeyframeProperty(marker.property), marker.time)}
          data-testid={`timeline-keyframe-${clip.id}-${marker.property}-${marker.id}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (locked) {
              return;
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            onSelect(clip.id, false);
            onKeyframeSelect({ clipId: clip.id, property: marker.property, keyframeId: marker.id });
            onDragStart({
              mode: 'keyframe',
              clip,
              keyframeProperty: marker.property,
              keyframeId: marker.id,
              startX: event.clientX,
              previewStart: marker.time,
              previewDuration: clip.duration,
              previewTrimStart: clip.trimStart,
              previewTrimEnd: clip.trimEnd,
              previewKeyframeTime: marker.time
            });
          }}
        />
        );
      })}
      {locked ? null : (
        <span
          className="absolute right-0 top-0 h-full w-[4px] cursor-ew-resize bg-black/20 opacity-0 transition group-hover:opacity-100"
          data-testid={`timeline-trim-right-${clip.id}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            onSelect(clip.id, event.shiftKey);
            onDragStart({
              mode: rollingTrimActive && nextAdjacentClip ? 'rolling-trim' : 'trim-right',
              clip,
              rightClip: rollingTrimActive ? nextAdjacentClip : undefined,
              startX: event.clientX,
              previewStart: clip.start,
              previewDuration: clip.duration,
              previewTrimStart: clip.trimStart,
              previewTrimEnd: clip.trimEnd
            });
          }}
        />
      )}
    </div>
  );
}

function getClipKeyframeMarkers(clip: Clip): Array<{ id: string; property: KeyframeProperty; time: number }> {
  return (Object.keys(clip.keyframes ?? {}) as KeyframeProperty[]).flatMap((property) =>
    (clip.keyframes?.[property] ?? []).map((frame) => ({
      id: frame.id,
      property,
      time: frame.time
    }))
  );
}

function getClipToneClass(type: Clip['type']): string {
  if (type === 'audio') {
    return 'bg-amber-100 text-amber-950';
  }
  if (type === 'text') {
    return 'bg-emerald-100 text-emerald-950';
  }
  if (type === 'subtitle') {
    return 'bg-indigo-100 text-indigo-950';
  }
  if (type === 'nested-sequence') {
    return 'bg-violet-100 text-violet-950';
  }
  return 'bg-sky-100 text-sky-950';
}

function VideoThumbnailStrip({ clip, asset, pixelWidth }: { clip: Extract<Clip, { type: 'video' }>; asset: MediaAsset; pixelWidth: number }) {
  const [frames, setFrames] = useState<TimelineThumbnailFrame[]>(() => getTimelineThumbnailPlaceholders(asset, clip, pixelWidth));

  useEffect(() => {
    let canceled = false;
    const placeholders = getTimelineThumbnailPlaceholders(asset, clip, pixelWidth);
    setFrames(placeholders);
    void getTimelineThumbnails(asset, clip, pixelWidth)
      .then((nextFrames) => {
        if (!canceled) {
          setFrames(nextFrames);
        }
      })
      .catch(() => {
        if (!canceled) {
          setFrames(placeholders);
        }
      });
    return () => {
      canceled = true;
    };
  }, [asset, clip.duration, clip.keyframes, clip.speed, clip.trimStart, pixelWidth]);

  if (frames.length === 0) {
    return null;
  }

  return (
    <span className="absolute inset-0 z-0 flex overflow-hidden opacity-70" data-testid={`timeline-thumbnails-${clip.id}`}>
      {frames.map((frame) => (
        <span key={frame.key} className="h-full w-20 flex-none border-r border-white/20 bg-sky-200">
          {frame.dataUrl ? <img className="h-full w-full object-cover" src={frame.dataUrl} alt="" draggable={false} /> : null}
        </span>
      ))}
    </span>
  );
}

function WaveformStrip({
  clipId,
  asset,
  pixelWidth,
  clipDuration,
  muted,
  color,
  compact = false
}: {
  clipId: string;
  asset: MediaAsset;
  pixelWidth: number;
  clipDuration: number;
  muted: boolean;
  color: string;
  compact?: boolean;
}) {
  const [waveform, setWaveform] = useState<WaveformResult | undefined>();
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWidth = Math.max(1, Math.round(pixelWidth));
  const canvasHeight = compact ? 16 : 40;
  const pointsPerSecond = useMemo(() => Math.max(16, Math.ceil(canvasWidth / Math.max(0.001, clipDuration))), [canvasWidth, clipDuration]);

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
      className={clsx('absolute z-0 overflow-hidden', compact ? 'bottom-0 left-0 right-0 h-4 border-t border-white/20 bg-black/20' : 'inset-0')}
      data-testid={`timeline-waveform-${clipId}`}
      title={waveform?.isSampled ? zhCN.timeline.sampledWaveform : zhCN.timeline.waveform}
      style={{ opacity: muted ? 0.2 : compact ? 0.62 : 0.48 }}
    >
      <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} className="h-full w-full" />
    </span>
  );
}

function drawWaveform(context: CanvasRenderingContext2D, width: number, height: number, peaks: number[] | undefined, color: string): void {
  context.clearRect(0, 0, width, height);
  const values = peaks && peaks.length > 0 ? peaks : Array.from({ length: Math.max(16, Math.min(width, 64)) }, () => 0.2);
  const center = height / 2;
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const peak = values[Math.min(values.length - 1, Math.floor((x / Math.max(1, width)) * values.length))] ?? 0;
    const halfHeight = Math.max(1, peak * center);
    context.moveTo(x + 0.5, center - halfHeight);
    context.lineTo(x + 0.5, center + halfHeight);
  }
  context.stroke();
}

function getTrackWaveformColor(trackType: Track['type']): string {
  if (trackType === 'audio') {
    return '#92400e';
  }
  if (trackType === 'video') {
    return '#0f766e';
  }
  return '#047857';
}

function formatTimelineKeyframeProperty(property: KeyframeProperty): string {
  return zhCN.inspector.keyframeProperty[property] ?? property;
}

export function buildTicks(duration: number): number[] {
  const ticks: number[] = [];
  const step = duration > 30 ? 5 : 1;
  for (let tick = 0; tick <= duration; tick += step) {
    ticks.push(tick);
  }
  return ticks;
}
