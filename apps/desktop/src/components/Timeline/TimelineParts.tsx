import { memo } from 'react';
import {
  areClipsAdjacent,
  CLIP_GROUP_COLOR_HEX,
  DEFAULT_TIMELINE_LABEL_COLOR_HEX,
  filterTimelineVirtualClips,
  getEffectiveClipColorLabel,
  getTimelineLabelColorHex,
  getVolumeEnvelopePoints,
  isFrameRateMismatch,
  pitchNoteColor,
  TIMELINE_THUMBNAIL_TRACK_HEIGHT,
  TIMELINE_LABEL_COLORS,
  buildTrimDurationBubble,
  type Clip,
  type CollaborationClipLock,
  type ClipGroup,
  type ClipPitchDataPoint,
  type DialogueInterval,
  type KeyframeProperty,
  type MediaAsset,
  snapTime,
  type TimelineLabelColor,
  type TimelineRulerTick,
  type TimelineThumbnailTrackSample,
  type TimelineLargeProjectMode,
  type TimelineVirtualRenderWindow,
  type VolumeEnvelopePoint,
  shouldLoadTimelineClipAssets,
  type Track,
  type Transition,
  type TransitionType
} from '@open-factory/editor-core';
import { AlertTriangle, MoreHorizontal } from 'lucide-react';
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
export const TRACK_DRAG_MIME = 'application/x-open-factory-track-id';
const LARGE_PROJECT_ASSET_HYDRATION_DELAY_MS = 1_200;
const LARGE_PROJECT_ASSET_IDLE_TIMEOUT_MS = 2_500;

export interface VolumeEnvelopePointRequest {
  clipId: string;
  time: number;
  value: number;
  keyframeId?: string;
}

export interface VolumeEnvelopeMenuRequest {
  x: number;
  y: number;
  clipId: string;
}

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
  dialogueMarkers,
  onSeek,
  onContextMenu
}: {
  ticks: TimelineRulerTick[];
  zoom: number;
  width: number;
  currentTimecode: string;
  cachedRanges: TimelineRenderRange[];
  staleRanges: TimelineRenderRange[];
  diffRanges: TimelineDiffRange[];
  exportRanges: Array<{ id: string; start: number; end: number }>;
  protectedRanges: Array<{ id: string; start: number; end: number }>;
  dialogueMarkers: DialogueInterval[];
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
          {dialogueMarkers.map((marker) => (
            <span
              key={marker.id}
              className="absolute bottom-0 top-0 z-[3] rounded-sm bg-emerald-500/45 outline outline-1 outline-emerald-600/70"
              style={{ left: marker.start * zoom, width: Math.max(2, (marker.end - marker.start) * zoom) }}
              title={zhCN.timeline.dialogueMarkerTitle(marker.confidence)}
              data-testid="timeline-dialogue-marker"
              data-confidence={marker.confidence}
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
  selectedTrackIds,
  drag,
  media,
  onSelect,
  onKeyframeSelect,
  onDragStart,
  onTrackPointerDown,
  onTrackUpdate,
  onTrackHeaderClick,
  onTrackBatchMenu,
  onTrackReorder,
  transitions,
  onTransitionMenu,
  onGapMenu,
  onClipMenu,
  onVolumeEnvelopeAdd,
  onVolumeEnvelopeUpdate,
  onVolumeEnvelopeRemove,
  onVolumeEnvelopeMenu,
  onClipDoubleClick,
  virtualWindow,
  assetLoadWindow,
  largeProjectMode,
  rollingTrimActive,
  slipEditActive,
  slideEditActive,
  clipGroupByClipId,
  colorFilter,
  projectFrameRate,
  envelopeEditMode,
  reduceMotion,
  collaborationLocksByClipId
}: {
  track: Track;
  zoom: number;
  selectedClipId?: string;
  selectedClipIds: string[];
  selectedKeyframe?: SelectedKeyframeRef;
  selectedKeyframes: SelectedKeyframeRef[];
  selectedTrackIds: string[];
  drag?: DragState;
  media: MediaAsset[];
  onSelect(clipId: string, additive: boolean, forceSingle?: boolean): void;
  onKeyframeSelect(keyframe: SelectedKeyframeRef, additive: boolean): void;
  onDragStart(drag: DragState): void;
  onTrackPointerDown(event: React.PointerEvent<HTMLDivElement>): void;
  onTrackUpdate(trackId: string, patch: Partial<Pick<Track, 'color' | 'muted' | 'solo' | 'locked' | 'volume'>>): void;
  onTrackHeaderClick(trackId: string, event: React.MouseEvent<HTMLDivElement>): void;
  onTrackBatchMenu(trackId: string, x: number, y: number): void;
  onTrackReorder(draggedTrackId: string, targetTrackId: string): void;
  transitions: Transition[];
  onTransitionMenu(request: TransitionMenuRequest): void;
  onGapMenu(request: GapMenuRequest): void;
  onClipMenu(request: ClipMenuRequest): void;
  onVolumeEnvelopeAdd(request: VolumeEnvelopePointRequest): void;
  onVolumeEnvelopeUpdate(request: Required<VolumeEnvelopePointRequest>): void;
  onVolumeEnvelopeRemove(request: Required<Pick<VolumeEnvelopePointRequest, 'clipId' | 'keyframeId'>>): void;
  onVolumeEnvelopeMenu(request: VolumeEnvelopeMenuRequest): void;
  onClipDoubleClick(clip: Clip): void;
  virtualWindow: TimelineVirtualRenderWindow;
  assetLoadWindow: { scrollLeft: number; viewportWidth: number; labelWidth: number };
  largeProjectMode: TimelineLargeProjectMode;
  rollingTrimActive: boolean;
  slipEditActive: boolean;
  slideEditActive: boolean;
  clipGroupByClipId: Map<string, ClipGroup>;
  colorFilter: TimelineLabelColor | null;
  projectFrameRate: number;
  envelopeEditMode: boolean;
  reduceMotion: boolean;
  collaborationLocksByClipId: Map<string, CollaborationClipLock>;
}) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const frequencyBands = useAudioMeterStore((state) => state.trackFrequencyBands[track.id] ?? getSilentFrequencyBands());
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));
  const locked = Boolean(track.locked);
  const selectedTrack = selectedTrackIds.includes(track.id);
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
      <div
        className={clsx('flex items-center gap-2 border-r px-3 outline-none', selectedTrack ? 'border-brand/60 bg-brand/10' : 'border-line bg-panel')}
        role="option"
        aria-selected={selectedTrack}
        data-testid={`track-header-${track.id}`}
        data-track-selected={selectedTrack ? 'true' : 'false'}
        draggable
        onClick={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('button,input,textarea,select')) {
            return;
          }
          onTrackHeaderClick(track.id, event);
        }}
        onDragStart={(event) => {
          event.dataTransfer.setData(TRACK_DRAG_MIME, track.id);
          event.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(event) => {
          if (Array.from(event.dataTransfer.types).includes(TRACK_DRAG_MIME)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={(event) => {
          const draggedTrackId = event.dataTransfer.getData(TRACK_DRAG_MIME);
          if (!draggedTrackId || draggedTrackId === track.id) {
            return;
          }
          event.preventDefault();
          onTrackReorder(draggedTrackId, track.id);
        }}
      >
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
          <div className="flex min-w-0 items-center gap-1">
            <div className="truncate text-xs font-semibold">{track.name}</div>
            {track.type === 'subtitle' && track.subtitleType === 'cc' ? (
              <span className="rounded border border-brand/30 bg-brand/10 px-1 text-[10px] font-bold text-brand" data-testid={`track-cc-badge-${track.id}`}>
                {zhCN.timeline.trackTypes.cc}
              </span>
            ) : null}
          </div>
          <div className="text-[11px] uppercase tracking-normal text-slate-500">{formatTimelineTrackType(track)}</div>
          {track.type === 'audio' ? <AudioTrackFrequencyBands trackId={track.id} bands={frequencyBands} /> : null}
        </div>
        <div className="flex items-center gap-1">
          <TrackToggle label="M" title={zhCN.timeline.muteTrack} active={Boolean(track.muted)} testId={`track-mute-${track.id}`} onClick={() => onTrackUpdate(track.id, { muted: !track.muted })} />
          <TrackToggle label="S" title={zhCN.timeline.soloTrack} active={Boolean(track.solo)} testId={`track-solo-${track.id}`} onClick={() => onTrackUpdate(track.id, { solo: !track.solo })} />
          <TrackToggle label="L" title={zhCN.timeline.lockTrack} active={locked} testId={`track-lock-${track.id}`} onClick={() => onTrackUpdate(track.id, { locked: !track.locked })} />
          {selectedTrack ? (
            <button
              className="h-6 w-6 rounded border border-line bg-white text-slate-600 hover:bg-panel"
              title={zhCN.timeline.trackBatchMenu}
              aria-label={zhCN.timeline.trackBatchMenu}
              type="button"
              data-testid={`track-batch-menu-button-${track.id}`}
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onTrackBatchMenu(track.id, rect.left, rect.bottom + 4);
              }}
            >
              <MoreHorizontal size={14} aria-hidden="true" />
            </button>
          ) : null}
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
        data-testid={`timeline-track-body-${track.id}`}
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
        {drag?.mode === 'move'
          ? track.clips.flatMap((clip) => {
              const previewStart = drag.previewStartsByClipId?.[clip.id];
              if (previewStart === undefined) {
                return [];
              }
              return [
                <div
                  key={`drop-preview-${clip.id}`}
                  className="pointer-events-none absolute top-2 z-[9] h-10 rounded-md border-2 border-dashed border-brand bg-brand/10"
                  style={{ left: previewStart * zoom, width: Math.max(16, clip.duration * zoom) }}
                  data-testid={`timeline-drop-preview-${clip.id}`}
                  data-preview-clip-id={clip.id}
                />
              ];
            })
          : null}
        {virtualClips.map((clip) => {
          const isSelected = selectedClipIds.includes(clip.id) || selectedClipId === clip.id;
          const trimPreview = drag?.clip?.id === clip.id && (drag.mode === 'trim-left' || drag.mode === 'trim-right') ? drag : undefined;
          const previewClip = drag?.previewClipsById?.[clip.id];
          const movedStart = drag?.mode === 'move' ? drag.previewStartsByClipId?.[clip.id] : undefined;
          const displayClip = previewClip ?? clip;
          const left = (previewClip?.start ?? movedStart ?? trimPreview?.previewStart ?? clip.start) * zoom;
          const width = Math.max(16, (previewClip?.duration ?? trimPreview?.previewDuration ?? clip.duration) * zoom);
          const loadAssets = shouldLoadTimelineClipAssets({
            clipStart: clip.start,
            clipDuration: clip.duration,
            zoom,
            scrollLeft: assetLoadWindow.scrollLeft,
            viewportWidth: assetLoadWindow.viewportWidth,
            labelWidth: assetLoadWindow.labelWidth,
            preloadPx: 100
          });
          return (
            <MemoizedClipBlock
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
              onVolumeEnvelopeAdd={onVolumeEnvelopeAdd}
              onVolumeEnvelopeUpdate={onVolumeEnvelopeUpdate}
              onVolumeEnvelopeRemove={onVolumeEnvelopeRemove}
              onVolumeEnvelopeMenu={onVolumeEnvelopeMenu}
              onClipDoubleClick={onClipDoubleClick}
              rollingTrimActive={rollingTrimActive}
              slipEditActive={slipEditActive}
              slideEditActive={slideEditActive}
              clipGroup={clipGroupByClipId.get(clip.id)}
              trackColor={track.color ?? null}
              projectFrameRate={projectFrameRate}
              envelopeEditMode={envelopeEditMode}
              reduceMotion={reduceMotion}
              loadAssets={loadAssets}
              largeProjectMode={largeProjectMode}
              collaborationLock={collaborationLocksByClipId.get(clip.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface ClipAssetStripsProps {
  clip: Extract<Clip, { type: 'video' }>;
  asset: MediaAsset;
  clipPixelWidth: number;
  trackMuted: boolean;
  waveformColor: string;
  largeProjectMode: TimelineLargeProjectMode;
}

function DeferredClipAssetStrips(props: ClipAssetStripsProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    return scheduleLargeProjectAssetHydration(() => setReady(true));
  }, [props.asset.id, props.clip.id]);

  return ready ? <ClipAssetStrips {...props} /> : null;
}

function DeferredWaveformStrip(props: WaveformStripProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    return scheduleLargeProjectAssetHydration(() => setReady(true));
  }, [props.asset.id, props.clipId]);

  return ready ? <WaveformStrip {...props} /> : null;
}

function scheduleLargeProjectAssetHydration(onReady: () => void): () => void {
  let idleId: number | undefined;
  let completed = false;
  const run = () => {
    if (completed) {
      return;
    }
    completed = true;
    onReady();
  };
  const delayId = window.setTimeout(() => {
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: LARGE_PROJECT_ASSET_IDLE_TIMEOUT_MS });
    } else {
      run();
    }
  }, LARGE_PROJECT_ASSET_HYDRATION_DELAY_MS);
  return () => {
    completed = true;
    window.clearTimeout(delayId);
    if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleId);
    }
  };
}

function ClipAssetStrips({ clip, asset, clipPixelWidth, trackMuted, waveformColor, largeProjectMode }: ClipAssetStripsProps) {
  return (
    <>
      <VideoThumbnailStrip clip={clip} asset={asset} pixelWidth={clipPixelWidth} frameStep={largeProjectMode.previewFrameStep} />
      {asset.hasAudio ? (
        <WaveformStrip
          clipId={clip.id}
          asset={asset}
          pixelWidth={clipPixelWidth}
          clipDuration={clip.duration}
          muted={trackMuted || Boolean(clip.muted)}
          color={waveformColor}
          pitchData={clip.pitchData}
          compact
          resolutionScale={largeProjectMode.waveformResolutionScale}
        />
      ) : null}
    </>
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
      aria-pressed={active}
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
  onVolumeEnvelopeAdd,
  onVolumeEnvelopeUpdate,
  onVolumeEnvelopeRemove,
  onVolumeEnvelopeMenu,
  onClipDoubleClick,
  rollingTrimActive,
  slipEditActive,
  slideEditActive,
  clipGroup,
  trackColor,
  projectFrameRate,
  envelopeEditMode,
  reduceMotion,
  loadAssets,
  largeProjectMode,
  collaborationLock
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
  onVolumeEnvelopeAdd(request: VolumeEnvelopePointRequest): void;
  onVolumeEnvelopeUpdate(request: Required<VolumeEnvelopePointRequest>): void;
  onVolumeEnvelopeRemove(request: Required<Pick<VolumeEnvelopePointRequest, 'clipId' | 'keyframeId'>>): void;
  onVolumeEnvelopeMenu(request: VolumeEnvelopeMenuRequest): void;
  onClipDoubleClick(clip: Clip): void;
  rollingTrimActive: boolean;
  slipEditActive: boolean;
  slideEditActive: boolean;
  clipGroup?: ClipGroup;
  trackColor: TimelineLabelColor | null;
  projectFrameRate: number;
  envelopeEditMode: boolean;
  reduceMotion: boolean;
  loadAssets: boolean;
  largeProjectMode: TimelineLargeProjectMode;
  collaborationLock?: CollaborationClipLock;
}) {
  const waveformColor = getTrackWaveformColor(trackType);
  const effectiveColor = getEffectiveClipColorLabel(clip, { color: trackColor });
  const effectiveColorHex = effectiveColor ? getTimelineLabelColorHex(effectiveColor) : DEFAULT_TIMELINE_LABEL_COLOR_HEX;
  const isMoveDragging = drag?.mode === 'move' && (drag.clipIds?.includes(clip.id) || drag.clip?.id === clip.id);
  const trimBubble =
    drag?.clip?.id === clip.id && (drag.mode === 'trim-left' || drag.mode === 'trim-right')
      ? buildTrimDurationBubble(drag.clip.duration, drag.previewDuration ?? clip.duration)
      : undefined;
  const frameRateMismatch = asset?.type === 'video' && isFrameRateMismatch(asset.frameRate, projectFrameRate);
  const frameRateWarningTitle =
    frameRateMismatch && asset?.frameRate ? zhCN.timeline.frameRateMismatchTooltip(formatFrameRateLabel(asset.frameRate), formatFrameRateLabel(projectFrameRate)) : undefined;
  return (
    <div
      className={clsx(
        'group absolute top-2 flex h-10 select-none items-center overflow-hidden rounded-md border px-2 text-xs font-medium shadow-sm',
        getClipToneClass(clip.type),
        asset?.missing ? 'border-rose-500 bg-[repeating-linear-gradient(135deg,rgba(244,63,94,0.18)_0,rgba(244,63,94,0.18)_6px,transparent_6px,transparent_12px)]' : selected ? 'border-coral ring-2 ring-coral/30' : 'border-white/80',
        locked ? 'cursor-not-allowed opacity-70' : 'cursor-grab',
        isMoveDragging && 'opacity-80 shadow-[0_12px_22px_rgba(15,23,42,0.24)] ring-2 ring-brand/30',
        !reduceMotion && !largeProjectMode.disableAnimations && 'transition-all duration-150 ease-out'
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
      data-dragging={isMoveDragging ? 'true' : 'false'}
      data-reduce-motion={reduceMotion ? 'true' : 'false'}
      data-collaboration-locked={collaborationLock ? 'true' : 'false'}
    >
      {trimBubble ? (
        <span
          className="pointer-events-none absolute left-1/2 top-1 z-40 -translate-x-1/2 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow"
          data-testid={`timeline-trim-duration-bubble-${clip.id}`}
        >
          {trimBubble}
        </span>
      ) : null}
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
      {collaborationLock ? (
        <span
          className="absolute right-1 top-1 z-30 max-w-[72%] truncate rounded-sm bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
          title={zhCN.timeline.lockedByUser(collaborationLock.userName)}
          data-testid={`timeline-clip-remote-lock-${clip.id}`}
        >
          {zhCN.timeline.lockedByUser(collaborationLock.userName)}
        </span>
      ) : null}
      {loadAssets && clip.type === 'video' && asset ? (
        largeProjectMode.enabled ? (
          <DeferredClipAssetStrips clip={clip} asset={asset} clipPixelWidth={clipPixelWidth} trackMuted={trackMuted} waveformColor={waveformColor} largeProjectMode={largeProjectMode} />
        ) : (
          <ClipAssetStrips clip={clip} asset={asset} clipPixelWidth={clipPixelWidth} trackMuted={trackMuted} waveformColor={waveformColor} largeProjectMode={largeProjectMode} />
        )
      ) : null}
      {transition ? (
        <span className="absolute right-1 top-1 z-20 rounded bg-brand px-1 text-[10px] font-semibold text-white" data-testid={`timeline-transition-${transition.id}`}>
          {formatTransitionBadge(transition.type)}
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
      {loadAssets && clip.type === 'audio' && asset ? (
        largeProjectMode.enabled ? (
          <DeferredWaveformStrip clipId={clip.id} asset={asset} pixelWidth={clipPixelWidth} clipDuration={clip.duration} muted={trackMuted || Boolean(clip.muted)} color={waveformColor} pitchData={clip.pitchData} resolutionScale={largeProjectMode.waveformResolutionScale} />
        ) : (
          <WaveformStrip clipId={clip.id} asset={asset} pixelWidth={clipPixelWidth} clipDuration={clip.duration} muted={trackMuted || Boolean(clip.muted)} color={waveformColor} pitchData={clip.pitchData} resolutionScale={largeProjectMode.waveformResolutionScale} />
        )
      ) : null}
      {envelopeEditMode && clip.type === 'audio' && 'volume' in clip ? (
        <VolumeEnvelopeOverlay
          clip={clip}
          disabled={locked}
          onAdd={onVolumeEnvelopeAdd}
          onUpdate={onVolumeEnvelopeUpdate}
          onRemove={onVolumeEnvelopeRemove}
          onMenu={onVolumeEnvelopeMenu}
        />
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

function formatTransitionBadge(type: TransitionType): string {
  if (type === 'dissolve') {
    return 'DS';
  }
  if (type === 'fade-black') {
    return 'FB';
  }
  return type
    .split('-')
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3);
}

function VolumeEnvelopeOverlay({
  clip,
  disabled,
  onAdd,
  onUpdate,
  onRemove,
  onMenu
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
    ? basePoints.map((point) => (point.id === draftPoint.keyframeId ? { ...point, time: draftPoint.time, value: draftPoint.value } : point))
    : basePoints;
  const svgPoints = points.map((point) => `${envelopePointX(point, duration)},${envelopePointY(point)}`).join(' ');

  const eventToRequest = (event: Pick<React.PointerEvent<HTMLElement>, 'clientX' | 'clientY'>): VolumeEnvelopePointRequest | undefined => {
    const bounds = overlayRef.current?.getBoundingClientRect();
    if (!bounds) {
      return undefined;
    }
    const x = Math.min(bounds.width, Math.max(0, event.clientX - bounds.left));
    const y = Math.min(bounds.height, Math.max(0, event.clientY - bounds.top));
    return {
      clipId: clip.id,
      time: snapTime((x / Math.max(1, bounds.width)) * clip.duration),
      value: Math.round(Math.min(2, Math.max(0, 2 - (y / Math.max(1, bounds.height)) * 2)) * 100) / 100
    };
  };

  const persistedPoints = points.filter((point) => point.persisted);

  return (
    <span
      ref={overlayRef}
      className={clsx('absolute inset-0 z-20 cursor-crosshair', disabled ? 'pointer-events-none opacity-50' : 'pointer-events-auto')}
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
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={svgPoints} fill="none" stroke="rgba(15, 23, 42, 0.45)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={svgPoints} fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {persistedPoints.map((point) => (
        <button
          key={point.id}
          className="absolute z-30 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-900 bg-white shadow"
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
}

function envelopePointX(point: Pick<VolumeEnvelopePoint, 'time'>, duration: number): number {
  return Math.min(100, Math.max(0, (point.time / Math.max(0.001, duration)) * 100));
}

function envelopePointY(point: Pick<VolumeEnvelopePoint, 'value'>): number {
  return Math.min(100, Math.max(0, 100 - (point.value / 2) * 100));
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

const MemoizedClipBlock = memo(ClipBlock, areClipBlockPropsEqual);

function areClipBlockPropsEqual(previous: Parameters<typeof ClipBlock>[0], next: Parameters<typeof ClipBlock>[0]): boolean {
  return previous.clip === next.clip &&
    previous.asset === next.asset &&
    previous.left === next.left &&
    previous.width === next.width &&
    previous.selected === next.selected &&
    previous.selectedKeyframe === next.selectedKeyframe &&
    previous.selectedKeyframes === next.selectedKeyframes &&
    previous.drag === next.drag &&
    previous.selectedClipIds === next.selectedClipIds &&
    previous.locked === next.locked &&
    previous.clipPixelWidth === next.clipPixelWidth &&
    previous.trackMuted === next.trackMuted &&
    previous.trackType === next.trackType &&
    previous.nextAdjacentClip === next.nextAdjacentClip &&
    previous.transition === next.transition &&
    previous.rollingTrimActive === next.rollingTrimActive &&
    previous.slipEditActive === next.slipEditActive &&
    previous.slideEditActive === next.slideEditActive &&
    previous.clipGroup === next.clipGroup &&
    previous.trackColor === next.trackColor &&
    previous.projectFrameRate === next.projectFrameRate &&
    previous.envelopeEditMode === next.envelopeEditMode &&
    previous.reduceMotion === next.reduceMotion &&
    previous.loadAssets === next.loadAssets &&
    previous.largeProjectMode === next.largeProjectMode &&
    previous.collaborationLock === next.collaborationLock;
}

function VideoThumbnailStrip({ clip, asset, pixelWidth, frameStep = 1 }: { clip: Extract<Clip, { type: 'video' }>; asset: MediaAsset; pixelWidth: number; frameStep?: number }) {
  const requestPixelWidth = Math.max(1, pixelWidth / Math.max(1, frameStep));
  const [frames, setFrames] = useState<TimelineThumbnailFrame[]>(() => getTimelineThumbnailPlaceholders(asset, clip, requestPixelWidth));

  useEffect(() => {
    let canceled = false;
    const placeholders = getTimelineThumbnailPlaceholders(asset, clip, requestPixelWidth);
    setFrames(placeholders);
    void getTimelineThumbnails(asset, clip, requestPixelWidth)
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
  }, [asset, clip.duration, clip.keyframes, clip.speed, clip.trimStart, requestPixelWidth]);

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

interface WaveformStripProps {
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

function WaveformStrip({
  clipId,
  asset,
  pixelWidth,
  clipDuration,
  muted,
  color,
  pitchData,
  compact = false,
  resolutionScale = 1
}: WaveformStripProps) {
  const [waveform, setWaveform] = useState<WaveformResult | undefined>();
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWidth = Math.max(1, Math.round(pixelWidth));
  const canvasHeight = compact ? 16 : 40;
  const pointsPerSecond = useMemo(() => Math.max(8, Math.ceil((canvasWidth / Math.max(0.001, clipDuration)) * Math.max(0.1, resolutionScale))), [canvasWidth, clipDuration, resolutionScale]);

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
      {pitchData && pitchData.length > 0 ? <PitchCurveOverlay clipId={clipId} data={pitchData} width={canvasWidth} height={canvasHeight} duration={clipDuration} compact={compact} /> : null}
    </span>
  );
}

function PitchCurveOverlay({ clipId, data, width, height, duration, compact }: { clipId: string; data: ClipPitchDataPoint[]; width: number; height: number; duration: number; compact: boolean }) {
  const points = data.filter((point) => point.time >= 0 && point.time <= duration && Number.isFinite(point.hz) && point.hz > 0);
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
        <circle cx={toSvgPoint(points[0]).x} cy={toSvgPoint(points[0]).y} r={compact ? 1.5 : 2.5} fill={pitchNoteColor(points[0].note)} />
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

function formatTimelineTrackType(track: Track): string {
  if (track.type === 'subtitle' && track.subtitleType === 'cc') {
    return zhCN.timeline.trackTypes.cc;
  }
  return formatTrackType(track.type);
}

function formatFrameRateLabel(frameRate: number): string {
  const rounded = Math.round(frameRate * 100) / 100;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}fps`;
}

function formatTimelineKeyframeProperty(property: KeyframeProperty): string {
  return zhCN.inspector.keyframeProperty[property] ?? property;
}
