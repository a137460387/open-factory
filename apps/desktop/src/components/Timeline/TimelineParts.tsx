import {
  areClipsAdjacent,
  CLIP_GROUP_COLOR_HEX,
  DEFAULT_TIMELINE_LABEL_COLOR_HEX,
  filterTimelineVirtualClips,
  getEffectiveClipColorLabel,
  getTimelineLabelColorHex,
  isFrameRateMismatch,
  TIMELINE_THUMBNAIL_TRACK_HEIGHT,
  TIMELINE_LABEL_COLORS,
  type Clip,
  type ClipGroup,
  type KeyframeProperty,
  type MediaAsset,
  snapTime,
  type TimelineLabelColor,
  type TimelineRulerTick,
  type TimelineThumbnailTrackSample,
  type TimelineVirtualRenderWindow,
  type Track,
  type Transition,
  type TransitionType
} from '@open-factory/editor-core';
import { AlertTriangle } from 'lucide-react';
import type { TimelineRenderRange } from '@open-factory/editor-core';
import type { TimelineDiffRange } from '@open-factory/editor-core';
import { clsx } from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatTrackType, zhCN } from '../../i18n/strings';
import { getTimelineThumbnailFrame, getTimelineThumbnailPlaceholder, getTimelineThumbnailPlaceholders, getTimelineThumbnails, type TimelineThumbnailFrame } from '../../media/timeline-thumbnails';
import { getWaveform, type WaveformResult } from '../../media/waveform';
import { getSilentFrequencyBands, useAudioMeterStore } from '../../store/audioMeterStore';
import type { SelectedKeyframeRef } from '../../store/editorStore';

export type DragMode = 'move' | 'trim-left' | 'trim-right' | 'rolling-trim' | 'slip' | 'slide' | 'playhead' | 'keyframe';

export interface DragState {
  mode: DragMode;
  clip?: Clip;
  rightClip?: Clip;
  clipIds?: string[];
  keyframeProperty?: KeyframeProperty;
  keyframeId?: string;
  keyframes?: SelectedKeyframeRef[];
  keyframeSelectionOnly?: boolean;
  startX: number;
  previewStart: number;
  previewDuration: number;
  previewTrimStart: number;
  previewTrimEnd: number;
  startByClipId?: Record<string, number>;
  previewStartsByClipId?: Record<string, number>;
  previewClipsById?: Record<string, Clip>;
  previewKeyframeTime?: number;
  previewKeyframeDelta?: number;
  keyframeStartTimes?: Record<string, number>;
  previewKeyframeTimes?: Record<string, number>;
  previewRollingDelta?: number;
  previewSlipDelta?: number;
  previewSlideDelta?: number;
}

export const TRACK_HEIGHT = 54;
export const LABEL_WIDTH = 138;

export function ThumbnailTrack({
  samples,
  media,
  zoom,
  width
}: {
  samples: TimelineThumbnailTrackSample[];
  media: MediaAsset[];
  zoom: number;
  width: number;
}) {
  return (
    <div className="grid border-b border-line" style={{ gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, height: TIMELINE_THUMBNAIL_TRACK_HEIGHT }} data-testid="timeline-thumbnail-track">
      <div className="flex items-center border-r border-line bg-panel px-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">{zhCN.timeline.thumbnailTrack}</div>
          <div className="text-[11px] text-slate-500">{zhCN.timeline.thumbnailTrackSubtitle}</div>
        </div>
      </div>
      <div className="relative overflow-hidden bg-slate-100" style={{ width }}>
        {samples.map((sample) => {
          const asset = sample.mediaId ? media.find((item) => item.id === sample.mediaId) : undefined;
          const left = sample.time * zoom;
          const sampleWidth = Math.max(48, sample.intervalSeconds * zoom);
          return <ThumbnailTrackCell key={sample.id} sample={sample} asset={asset} left={left} width={sampleWidth} />;
        })}
      </div>
    </div>
  );
}

function ThumbnailTrackCell({ sample, asset, left, width }: { sample: TimelineThumbnailTrackSample; asset?: MediaAsset; left: number; width: number }) {
  const placeholderColor = sample.trackColor ? getTimelineLabelColorHex(sample.trackColor) : DEFAULT_TIMELINE_LABEL_COLOR_HEX;
  const [frame, setFrame] = useState<TimelineThumbnailFrame | undefined>(() => (asset && sample.sourceTimestamp !== undefined ? getTimelineThumbnailPlaceholder(asset, sample.sourceTimestamp) : undefined));

  useEffect(() => {
    let canceled = false;
    if (!asset || sample.sourceTimestamp === undefined) {
      setFrame(undefined);
      return;
    }
    const placeholder = getTimelineThumbnailPlaceholder(asset, sample.sourceTimestamp);
    setFrame(placeholder);
    void getTimelineThumbnailFrame(asset, sample.sourceTimestamp)
      .then((nextFrame) => {
        if (!canceled) {
          setFrame(nextFrame);
        }
      })
      .catch(() => {
        if (!canceled) {
          setFrame(placeholder);
        }
      });
    return () => {
      canceled = true;
    };
  }, [asset, sample.sourceTimestamp]);

  return (
    <span
      className="absolute bottom-1 top-1 overflow-hidden rounded-sm border border-white/40 shadow-sm"
      style={{ left, width, backgroundColor: placeholderColor }}
      data-testid="timeline-thumbnail-frame"
      data-source-time={sample.sourceTimestamp ?? ''}
    >
      {frame?.dataUrl ? <img className="h-full w-full object-cover opacity-95 transition-opacity duration-200" src={frame.dataUrl} alt="" draggable={false} /> : null}
    </span>
  );
}

export function Ruler({
  ticks,
  zoom,
  width,
  currentTimecode,
  cachedRanges,
  diffRanges,
  exportRanges,
  protectedRanges,
  onSeek,
  onContextMenu
}: {
  ticks: TimelineRulerTick[];
  zoom: number;
  width: number;
  currentTimecode: string;
  cachedRanges: TimelineRenderRange[];
  diffRanges: TimelineDiffRange[];
  exportRanges: Array<{ id: string; start: number; end: number }>;
  protectedRanges: Array<{ id: string; start: number; end: number }>;
  onSeek(time: number): void;
  onContextMenu(request: { time: number; x: number; y: number }): void;
}) {
  function timeFromEvent(event: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    return snapTime((event.clientX - rect.left) / zoom);
  }

  return (
    <div className="sticky top-0 z-30 grid h-10 grid-cols-[138px_1fr] border-b border-line bg-panel">
      <div className="grid grid-rows-[10px_1fr] border-r border-line">
        <div className="px-3 text-[9px] font-medium leading-[10px] text-emerald-700">{zhCN.timeline.renderCache}</div>
        <div className="px-3 py-1 font-mono text-xs font-semibold tabular-nums text-slate-700" data-testid="timeline-ruler-timecode">
          {currentTimecode}
        </div>
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
            if (event.button !== 0) {
              return;
            }
            onSeek(timeFromEvent(event));
          }}
          onDoubleClick={(event) => {
            if (event.button !== 0) {
              return;
            }
            onSeek(timeFromEvent(event));
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onContextMenu({ time: timeFromEvent(event), x: event.clientX, y: event.clientY });
          }}
        >
          {diffRanges.map((range) => (
            <span
              key={`${range.start}-${range.end}`}
              className="absolute bottom-0 top-0 z-0 bg-orange-300/55"
              style={{ left: range.start * zoom, width: Math.max(2, (range.end - range.start) * zoom) }}
              title={zhCN.timeline.snapshotDiffRange}
              data-testid="timeline-snapshot-diff-segment"
            />
          ))}
          {exportRanges.map((range) => (
            <span
              key={range.id}
              className="absolute bottom-0 top-0 z-[1] bg-sky-400/35"
              style={{ left: range.start * zoom, width: Math.max(2, (range.end - range.start) * zoom) }}
              title={zhCN.timeline.exportRange}
              data-testid="timeline-export-range-highlight"
            />
          ))}
          {protectedRanges.map((range) => (
            <span
              key={range.id}
              className="absolute bottom-0 top-0 z-[2] bg-rose-500/30"
              style={{ left: range.start * zoom, width: Math.max(2, (range.end - range.start) * zoom) }}
              title={zhCN.timeline.protectedRange}
              data-testid="timeline-ruler-protected-range"
            />
          ))}
          {ticks.map((tick) => (
            <div
              key={`${tick.unit}-${tick.time}`}
              className="absolute top-0 z-10 h-full border-l border-slate-300 pl-1 text-[11px] text-slate-500"
              style={{ left: tick.time * zoom }}
              data-testid="timeline-ruler-tick"
              data-ruler-unit={tick.unit}
            >
              {tick.label}
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
  selectedKeyframes,
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
  slideEditActive,
  clipGroupByClipId,
  colorFilter,
  projectFrameRate
}: {
  track: Track;
  zoom: number;
  selectedClipId?: string;
  selectedClipIds: string[];
  selectedKeyframe?: SelectedKeyframeRef;
  selectedKeyframes: SelectedKeyframeRef[];
  drag?: DragState;
  media: MediaAsset[];
  onSelect(clipId: string, additive: boolean, forceSingle?: boolean): void;
  onKeyframeSelect(keyframe: SelectedKeyframeRef, additive: boolean): void;
  onDragStart(drag: DragState): void;
  onTrackPointerDown(event: React.PointerEvent<HTMLDivElement>): void;
  onTrackUpdate(trackId: string, patch: Partial<Pick<Track, 'color' | 'muted' | 'solo' | 'locked' | 'volume'>>): void;
  transitions: Transition[];
  onTransitionMenu(request: TransitionMenuRequest): void;
  onGapMenu(request: GapMenuRequest): void;
  onClipMenu(request: ClipMenuRequest): void;
  onClipDoubleClick(clip: Clip): void;
  virtualWindow: TimelineVirtualRenderWindow;
  rollingTrimActive: boolean;
  slipEditActive: boolean;
  slideEditActive: boolean;
  clipGroupByClipId: Map<string, ClipGroup>;
  colorFilter: TimelineLabelColor | null;
  projectFrameRate: number;
}) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const frequencyBands = useAudioMeterStore((state) => state.trackFrequencyBands[track.id] ?? getSilentFrequencyBands());
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));
  const locked = Boolean(track.locked);
  const nextAdjacentByClipId = new Map<string, Clip>();
  const sortedClips = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  const virtualClips = filterTimelineVirtualClips(track.clips, virtualWindow).filter((clip) => !colorFilter || getEffectiveClipColorLabel(clip, track) === colorFilter);
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
        <div className="relative h-full py-2">
          <button
            className="block h-full w-1.5 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: getTimelineLabelColorHex(track.color) }}
            type="button"
            title={zhCN.timeline.trackLabelColor}
            data-testid={`track-color-button-${track.id}`}
            data-color={track.color ?? 'default'}
            onClick={(event) => {
              event.stopPropagation();
              setColorPickerOpen((open) => !open);
            }}
          />
          {colorPickerOpen ? (
            <div className="absolute left-0 top-11 z-40 grid w-[116px] grid-cols-4 gap-1 rounded-md border border-line bg-white p-2 shadow-soft" data-testid={`track-color-picker-${track.id}`}>
              {TIMELINE_LABEL_COLORS.map((color) => (
                <button
                  key={color}
                  className={clsx('h-5 w-5 rounded-full border', track.color === color ? 'border-slate-900 ring-2 ring-slate-300' : 'border-white')}
                  style={{ backgroundColor: getTimelineLabelColorHex(color) }}
                  type="button"
                  title={zhCN.timeline.timelineLabelColorNames[color]}
                  aria-label={zhCN.timeline.timelineLabelColorNames[color]}
                  data-testid={`track-color-swatch-${color}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onTrackUpdate(track.id, { color });
                    setColorPickerOpen(false);
                  }}
                />
              ))}
              <button
                className="col-span-4 mt-1 rounded border border-line px-2 py-1 text-[11px] text-slate-600 hover:bg-panel"
                type="button"
                data-testid="track-color-clear"
                onClick={(event) => {
                  event.stopPropagation();
                  onTrackUpdate(track.id, { color: null });
                  setColorPickerOpen(false);
                }}
              >
                {zhCN.timeline.defaultLabelColor}
              </button>
            </div>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">{track.name}</div>
          <div className="text-[11px] uppercase tracking-normal text-slate-500">{formatTrackType(track.type)}</div>
          {track.type === 'audio' ? <AudioTrackFrequencyBands trackId={track.id} bands={frequencyBands} /> : null}
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
              selectedKeyframes={selectedKeyframes}
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
              clipGroup={clipGroupByClipId.get(clip.id)}
              trackColor={track.color ?? null}
              projectFrameRate={projectFrameRate}
            />
          );
        })}
      </div>
    </div>
  );
}

function AudioTrackFrequencyBands({ trackId, bands }: { trackId: string; bands: number[] }) {
  return (
    <div className="mt-1 flex h-3 w-full max-w-[58px] items-end gap-px overflow-hidden rounded-sm bg-slate-200 px-px" title={zhCN.timeline.audioFrequencyMeter} data-testid={`track-vu-bands-${trackId}`}>
      {Array.from({ length: 16 }, (_, index) => {
        const level = Math.min(1, Math.max(0, bands[index] ?? 0));
        return <span key={index} className="w-0.5 rounded-t bg-emerald-500" style={{ height: `${Math.max(8, level * 100)}%` }} />;
      })}
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
  selectedKeyframes,
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
  slideEditActive,
  clipGroup,
  trackColor,
  projectFrameRate
}: {
  clip: Clip;
  asset?: MediaAsset;
  left: number;
  width: number;
  selected: boolean;
  selectedKeyframe?: SelectedKeyframeRef;
  selectedKeyframes: SelectedKeyframeRef[];
  drag?: DragState;
  onSelect(clipId: string, additive: boolean, forceSingle?: boolean): void;
  onKeyframeSelect(keyframe: SelectedKeyframeRef, additive: boolean): void;
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
  clipGroup?: ClipGroup;
  trackColor: TimelineLabelColor | null;
  projectFrameRate: number;
}) {
  const waveformColor = getTrackWaveformColor(trackType);
  const effectiveColor = getEffectiveClipColorLabel(clip, { color: trackColor });
  const effectiveColorHex = effectiveColor ? getTimelineLabelColorHex(effectiveColor) : DEFAULT_TIMELINE_LABEL_COLOR_HEX;
  const frameRateMismatch = asset?.type === 'video' && isFrameRateMismatch(asset.frameRate, projectFrameRate);
  const frameRateWarningTitle =
    frameRateMismatch && asset?.frameRate ? zhCN.timeline.frameRateMismatchTooltip(formatFrameRateLabel(asset.frameRate), formatFrameRateLabel(projectFrameRate)) : undefined;
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
        onSelect(clip.id, event.shiftKey, event.altKey);
        const advancedMode = slideEditActive ? 'slide' : slipEditActive ? 'slip' : undefined;
        const clipIds = advancedMode
          ? [clip.id]
          : event.altKey
            ? selectedClipIds.includes(clip.id)
              ? selectedClipIds
              : [clip.id]
            : selectedClipIds.includes(clip.id)
              ? selectedClipIds
              : clipGroup?.clipIds ?? [clip.id];
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
      title={asset?.missing ? zhCN.timeline.mediaMissing : frameRateWarningTitle ?? `${clip.name} (${clip.duration.toFixed(2)}s)`}
      data-testid={`timeline-clip-${clip.id}`}
      data-clip-type={clip.type}
      data-clip-id={clip.id}
      data-clip-group-id={clipGroup?.id}
      data-color-label={effectiveColor ?? 'default'}
    >
      <span
        className="absolute bottom-0 left-0 top-0 z-20 w-1.5"
        style={{ backgroundColor: effectiveColorHex }}
        data-testid={`clip-color-strip-${clip.id}`}
        data-color={effectiveColor ?? 'default'}
      />
      {clipGroup ? (
        <>
          <span className="absolute left-0 right-0 top-0 z-20 h-1.5" style={{ backgroundColor: CLIP_GROUP_COLOR_HEX[clipGroup.color] }} data-testid={`timeline-clip-group-strip-${clip.id}`} />
          {width >= 86 ? (
            <span className="absolute left-1 top-1.5 z-20 max-w-[70%] truncate rounded-sm bg-white/80 px-1 text-[9px] font-semibold text-slate-700" data-testid={`timeline-clip-group-label-${clip.id}`}>
              {clipGroup.name}
            </span>
          ) : null}
        </>
      ) : null}
      {clip.type === 'video' && asset ? <VideoThumbnailStrip clip={clip} asset={asset} pixelWidth={clipPixelWidth} /> : null}
      {clip.type === 'video' && asset?.hasAudio ? (
        <WaveformStrip clipId={clip.id} asset={asset} pixelWidth={clipPixelWidth} clipDuration={clip.duration} muted={trackMuted || Boolean(clip.muted)} color={waveformColor} compact />
      ) : null}
      {transition ? (
        <span className="absolute right-1 top-1 z-20 rounded bg-brand px-1 text-[10px] font-semibold text-white" data-testid={`timeline-transition-${transition.id}`}>
          {transition.type === 'fade-black' ? 'FB' : 'DS'}
        </span>
      ) : null}
      {frameRateMismatch ? (
        <span
          className="absolute top-1 z-20 inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-white shadow"
          style={{ right: transition ? 28 : 4 }}
          title={frameRateWarningTitle}
          data-testid={`timeline-frame-rate-warning-${clip.id}`}
        >
          <AlertTriangle size={11} />
        </span>
      ) : null}
      {locked ? null : (
        <span
          className="absolute left-0 top-0 z-30 h-full w-[4px] cursor-ew-resize bg-black/20 opacity-0 transition group-hover:opacity-100"
          data-testid={`timeline-trim-left-${clip.id}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            onSelect(clip.id, event.shiftKey, event.altKey);
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
      <span className="relative z-10 truncate pl-1">{(clip.type === 'text' || clip.type === 'subtitle' || clip.type === 'credits') && 'text' in clip ? clip.text.slice(0, 28) : clip.name}</span>
      <span className="relative z-10 ml-auto pl-2 tabular-nums">{clip.duration.toFixed(1)}s</span>
      {getClipKeyframeMarkers(clip).map((marker) => {
        const keyframeRef = { clipId: clip.id, property: marker.property, keyframeId: marker.id };
        const isSelectedKeyframe =
          selectedKeyframes.some((item) => sameSelectedKeyframe(item, keyframeRef)) ||
          (selectedKeyframe?.clipId === clip.id && selectedKeyframe.property === marker.property && selectedKeyframe.keyframeId === marker.id);
        const markerKey = selectedKeyframeKey(keyframeRef);
        const previewMarkerTime = drag?.mode === 'keyframe' ? drag.previewKeyframeTimes?.[markerKey] : undefined;
        const markerTime = previewMarkerTime !== undefined
          ? previewMarkerTime
          : drag?.mode === 'keyframe' && drag.clip?.id === clip.id && drag.keyframeProperty === marker.property && drag.keyframeId === marker.id
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
            const selectedBeforePointerDown = selectedKeyframes.some((item) => sameSelectedKeyframe(item, keyframeRef));
            if (!event.shiftKey) {
              onSelect(clip.id, false);
            }
            onKeyframeSelect(keyframeRef, event.shiftKey);
            const dragKeyframes = event.shiftKey
              ? selectedBeforePointerDown
                ? selectedKeyframes.filter((item) => !sameSelectedKeyframe(item, keyframeRef))
                : [...selectedKeyframes, keyframeRef]
              : selectedBeforePointerDown && selectedKeyframes.length > 1
                ? selectedKeyframes
                : [keyframeRef];
            const keyframeSelectionOnly = event.shiftKey && selectedBeforePointerDown;
            onDragStart({
              mode: 'keyframe',
              clip,
              keyframeProperty: marker.property,
              keyframeId: marker.id,
              keyframes: keyframeSelectionOnly ? [] : dragKeyframes.length > 0 ? dragKeyframes : [keyframeRef],
              keyframeSelectionOnly,
              keyframeStartTimes: Object.fromEntries(
                (keyframeSelectionOnly ? [] : dragKeyframes.length > 0 ? dragKeyframes : [keyframeRef]).map((ref) => [selectedKeyframeKey(ref), getKeyframeMarkerTime(clip, ref) ?? marker.time])
              ),
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
          className="absolute right-0 top-0 z-30 h-full w-[4px] cursor-ew-resize bg-black/20 opacity-0 transition group-hover:opacity-100"
          data-testid={`timeline-trim-right-${clip.id}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            onSelect(clip.id, event.shiftKey, event.altKey);
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

function getKeyframeMarkerTime(clip: Clip, ref: SelectedKeyframeRef): number | undefined {
  if (clip.id !== ref.clipId) {
    return undefined;
  }
  return clip.keyframes?.[ref.property]?.find((frame) => frame.id === ref.keyframeId)?.time;
}

function sameSelectedKeyframe(left: SelectedKeyframeRef, right: SelectedKeyframeRef): boolean {
  return left.clipId === right.clipId && left.property === right.property && left.keyframeId === right.keyframeId;
}

function selectedKeyframeKey(keyframe: SelectedKeyframeRef): string {
  return `${keyframe.clipId}\0${keyframe.property}\0${keyframe.keyframeId}`;
}

function getClipToneClass(type: Clip['type']): string {
  if (type === 'audio') {
    return 'bg-amber-100 text-amber-950';
  }
  if (type === 'text' || type === 'credits') {
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

function formatFrameRateLabel(frameRate: number): string {
  const rounded = Math.round(frameRate * 100) / 100;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}fps`;
}

function formatTimelineKeyframeProperty(property: KeyframeProperty): string {
  return zhCN.inspector.keyframeProperty[property] ?? property;
}
