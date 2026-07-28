import {memo} from 'react';
import {areClipsAdjacent, filterTimelineVirtualClips, getEffectiveClipColorLabel, getTimelineLabelColorHex, DEFAULT_TIMELINE_LABEL_COLOR_HEX, isFrameRateMismatch, TIMELINE_THUMBNAIL_TRACK_HEIGHT, TIMELINE_LABEL_COLORS, type Clip, type CollaborationClipLock, type AnomalyInterval, type ClipGroup, type DialogueInterval, type MediaAsset, snapTime, type TimelineLabelColor, type TimelineRulerTick, type TimelineThumbnailTrackSample, type TimelineLargeProjectMode, type TimelineVirtualRenderWindow, type VolumeEnvelopePoint, shouldLoadTimelineClipAssets, type Track, type Transition, detectTrackGaps, getEffectiveTrackHeight, clampTrackHeight, DEFAULT_TRACK_HEIGHT, shouldShowWaveform} from '@open-factory/editor-core';
import {AlertTriangle, MoreHorizontal} from 'lucide-react';
import type {TimelineRenderRange} from '@open-factory/editor-core';
import type {TimelineDiffRange} from '@open-factory/editor-core';
import {clsx} from 'clsx';
import {useEffect, useMemo, useState} from 'react';
import {formatTrackType, zhCN} from '../../i18n/strings';
import {getTimelineThumbnailFrame, getTimelineThumbnailPlaceholder, type TimelineThumbnailFrame} from '../../media/timeline-thumbnails';
import {getSilentFrequencyBands, useAudioMeterStore} from '../../store/audioMeterStore';
import type {SelectedKeyframeRef} from '../../store/editorStore';
import type {DragState, VolumeEnvelopePointRequest, VolumeEnvelopeMenuRequest, TransitionMenuRequest, ClipMenuRequest, GapMenuRequest} from './timeline-parts-types';
import {LABEL_WIDTH, TRACK_DRAG_MIME} from './timeline-parts-types';
import {MemoizedClipBlock, formatTransitionBadge, getTrackWaveformColor, formatFrameRateLabel} from './TimelineClipComponents';

function ThumbnailTrack({
  samples,
  media,
  zoom,
  width,
}: {
  samples: TimelineThumbnailTrackSample[];
  media: MediaAsset[];
  zoom: number;
  width: number;
}) {
  const mediaMap = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);
  return (
    <div
      className="grid border-b border-line"
      style={{ gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, height: TIMELINE_THUMBNAIL_TRACK_HEIGHT }}
      data-testid="timeline-thumbnail-track"
    >
      <div className="flex items-center border-r border-line bg-panel px-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">{zhCN.timeline.thumbnailTrack}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">{zhCN.timeline.thumbnailTrackSubtitle}</div>
        </div>
      </div>
      <div className="relative overflow-hidden bg-[var(--color-bg-elevated)]" style={{ width }}>
        {samples.map((sample) => {
          const asset = sample.mediaId ? mediaMap.get(sample.mediaId) : undefined;
          const left = sample.time * zoom;
          const sampleWidth = Math.max(48, sample.intervalSeconds * zoom);
          return <ThumbnailTrackCell key={sample.id} sample={sample} asset={asset} left={left} width={sampleWidth} />;
        })}
      </div>
    </div>
  );
}

function ThumbnailTrackCell({
  sample,
  asset,
  left,
  width,
}: {
  sample: TimelineThumbnailTrackSample;
  asset?: MediaAsset;
  left: number;
  width: number;
}) {
  const placeholderColor = sample.trackColor
    ? getTimelineLabelColorHex(sample.trackColor)
    : DEFAULT_TIMELINE_LABEL_COLOR_HEX;
  const [frame, setFrame] = useState<TimelineThumbnailFrame | undefined>(() =>
    asset && sample.sourceTimestamp !== undefined
      ? getTimelineThumbnailPlaceholder(asset, sample.sourceTimestamp)
      : undefined,
  );

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
      {frame?.dataUrl ? (
        <img
          className="h-full w-full object-cover opacity-95 transition-opacity duration-200"
          src={frame.dataUrl}
          alt=""
          draggable={false}
        />
      ) : null}
    </span>
  );
}

function Ruler({
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
  onContextMenu,
  audioScrubEnabled,
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
  audioScrubEnabled?: boolean;
}) {
  function timeFromEvent(event: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    return snapTime((event.clientX - rect.left) / zoom);
  }

  return (
    <div className="sticky top-0 z-30 grid h-11 grid-cols-[160px_1fr] border-b border-line bg-panel">
      <div className="grid grid-rows-[10px_1fr] border-r border-line">
        <div className="px-3 text-[9px] font-medium leading-[10px] text-emerald-700">{zhCN.timeline.renderCache}</div>
        <div
          className="px-3 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]"
          data-testid="timeline-ruler-timecode"
        >
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
          role="slider"
          aria-label="时间线位置"
          aria-valuemin={0}
          aria-valuemax={Math.round(width / zoom)}
          data-testid="timeline-ruler"
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }
            const startTime = timeFromEvent(event);
            const startX = event.clientX;
            let scrubbing = false;
            let lastScrubTime = 0;
            let scrubCtx = audioScrubEnabled
              ? (() => {
                  try {
                    const Ctor =
                      window.AudioContext ||
                      ((window as unknown as Record<string, unknown>).webkitAudioContext as AudioContext | undefined);
                    return Ctor ? new Ctor() : null;
                  } catch {
                    return null;
                  }
                })()
              : null;
            onSeek(startTime);
            const onMove = (moveEvent: PointerEvent) => {
              if (!scrubbing && Math.abs(moveEvent.clientX - startX) > 3) {
                scrubbing = true;
              }
              if (scrubbing) {
                const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                const t = Math.max(0, (moveEvent.clientX - rect.left) / zoom);
                onSeek(t);
                const now = Date.now();
                if (scrubCtx && now - lastScrubTime >= 30) {
                  try {
                    const speedPxPerSec =
                      Math.abs(moveEvent.clientX - startX) / Math.max(0.001, (now - event.timeStamp) / 1000);
                    const intervalMul = speedPxPerSec > 500 ? 0.25 : speedPxPerSec > 100 ? 0.5 : 1.0;
                    const dur = 0.05 * intervalMul;
                    const osc = scrubCtx.createOscillator();
                    const gain = scrubCtx.createGain();
                    osc.frequency.value = 200 + ((t * 100) % 800);
                    gain.gain.setValueAtTime(0.15, scrubCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, scrubCtx.currentTime + dur);
                    osc.connect(gain).connect(scrubCtx.destination);
                    osc.start(scrubCtx.currentTime);
                    osc.stop(scrubCtx.currentTime + dur);
                    lastScrubTime = now;
                  } catch {
                    /* silent degradation */
                  }
                }
              }
            };
            const onUp = () => {
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
              if (scrubCtx) {
                try {
                  scrubCtx.close();
                } catch {
                  // AudioContext close can fail if already closed
                }
                scrubCtx = null;
              }
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
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
              className="absolute top-0 z-10 h-full border-l border-line pl-1 text-[11px] text-[var(--color-text-muted)]"
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

function TrackRow({
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
  collaborationLocksByClipId,
  onRemoveAnomaly,
  continuityWarnings,
  colorConsistencyWarnings,
  sfxSuggestions,
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
  onTrackUpdate(
    trackId: string,
    patch: Partial<Pick<Track, 'color' | 'muted' | 'solo' | 'locked' | 'volume' | 'displayHeight'>>,
  ): void;
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
  onRemoveAnomaly(clipId: string, anomaly: AnomalyInterval): void;
  continuityWarnings?: Array<{ clipAId: string; clipBId: string; type: string; confidence: number; reason: string }>;
  colorConsistencyWarnings?: Array<{
    clipAId: string;
    clipBId: string;
    type: string;
    deltaRGB: number | null;
    reason: string;
  }>;
  sfxSuggestions?: Array<{
    time: number;
    category: string;
    confidence: number;
    matchedAssetId: string | null;
    status: string;
  }>;
}) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const frequencyBands = useAudioMeterStore(
    (state) => state.trackFrequencyBands[track.id] ?? getSilentFrequencyBands(),
  );
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));
  const locked = Boolean(track.locked);
  const selectedTrack = selectedTrackIds.includes(track.id);
  const sortedClips = useMemo(
    () => [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id)),
    [track.clips],
  );
  const nextAdjacentByClipId = useMemo(() => {
    const adjacent = new Map<string, Clip>();
    for (let index = 0; index < sortedClips.length - 1; index += 1) {
      const current = sortedClips[index];
      const next = sortedClips[index + 1];
      if (areClipsAdjacent(current, next)) {
        adjacent.set(current.id, next);
      }
    }
    return adjacent;
  }, [sortedClips]);
  const virtualClips = useMemo(
    () =>
      filterTimelineVirtualClips(track.clips, virtualWindow).filter(
        (clip) => !colorFilter || getEffectiveClipColorLabel(clip, track) === colorFilter,
      ),
    [track.clips, virtualWindow, colorFilter, track],
  );
  return (
    <div
      className="grid border-b border-line"
      role="row"
      aria-label={track.name}
      style={{ gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, height: getEffectiveTrackHeight(track.displayHeight) }}
    >
      <div
        className={clsx(
          'relative flex items-center gap-2 border-r px-3 outline-none',
          selectedTrack ? 'border-brand/60 bg-brand/10' : 'border-line bg-panel',
        )}
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
            <div
              className="absolute left-0 top-11 z-40 grid w-[116px] grid-cols-4 gap-1 rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 shadow-soft"
              data-testid={`track-color-picker-${track.id}`}
            >
              {TIMELINE_LABEL_COLORS.map((color) => (
                <button
                  key={color}
                  className={clsx(
                    'h-5 w-5 rounded-full border',
                    track.color === color ? 'border-line ring-2 ring-[var(--color-border)]' : 'border-white',
                  )}
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
                className="col-span-4 mt-1 rounded border border-line px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-panel"
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
              <span
                className="rounded border border-brand/30 bg-brand/10 px-1 text-[10px] font-bold text-brand"
                data-testid={`track-cc-badge-${track.id}`}
              >
                {zhCN.timeline.trackTypes.cc}
              </span>
            ) : null}
          </div>
          <div className="text-[11px] uppercase tracking-normal text-[var(--color-text-muted)]">
            {formatTimelineTrackType(track)}
          </div>
          {track.type === 'audio' ? <AudioTrackFrequencyBands trackId={track.id} bands={frequencyBands} /> : null}
        </div>
        <div className="flex items-center gap-1">
          <TrackToggle
            label="M"
            title={zhCN.timeline.muteTrack}
            active={Boolean(track.muted)}
            testId={`track-mute-${track.id}`}
            onClick={() => onTrackUpdate(track.id, { muted: !track.muted })}
          />
          <TrackToggle
            label="S"
            title={zhCN.timeline.soloTrack}
            active={Boolean(track.solo)}
            testId={`track-solo-${track.id}`}
            onClick={() => onTrackUpdate(track.id, { solo: !track.solo })}
          />
          <TrackToggle
            label="L"
            title={zhCN.timeline.lockTrack}
            active={locked}
            testId={`track-lock-${track.id}`}
            onClick={() => onTrackUpdate(track.id, { locked: !track.locked })}
          />
          {selectedTrack ? (
            <button
              className="h-6 w-6 rounded border border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel"
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
          aria-label={zhCN.timeline.trackVolume}
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={track.volume ?? 1}
          onChange={(event) => onTrackUpdate(track.id, { volume: Number(event.target.value) })}
          data-testid={`track-volume-${track.id}`}
        />
        <div
          className="absolute bottom-0 left-0 right-0 z-10 h-[3px] cursor-ns-resize bg-transparent hover:bg-brand/50"
          data-testid={`track-resize-handle-${track.id}`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const startY = e.clientY;
            const startHeight = getEffectiveTrackHeight(track.displayHeight);
            const onMove = (ev: PointerEvent) => {
              const newHeight = clampTrackHeight(startHeight + ev.clientY - startY);
              onTrackUpdate(track.id, { displayHeight: newHeight });
            };
            const onUp = () => {
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTrackUpdate(track.id, { displayHeight: DEFAULT_TRACK_HEIGHT });
          }}
        />
      </div>
      <div
        className="relative bg-panel"
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
            time: snapTime((event.clientX - rect.left) / zoom),
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
                />,
              ];
            })
          : null}
        {useMemo(() => {
          const minDuration = projectFrameRate > 0 ? 1 / projectFrameRate : 0;
          return detectTrackGaps(track, { minDuration }).map((gap) => (
            <div
              key={`gap-${gap.trackId}-${gap.start}`}
              className="absolute top-0 z-[1] h-full opacity-40"
              style={{
                left: gap.start * zoom,
                width: Math.max(2, gap.duration * zoom),
                backgroundImage:
                  'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(148,163,184,0.35) 3px, rgba(148,163,184,0.35) 5px)',
                backgroundSize: '8px 8px',
              }}
              title={`${zhCN.timeline.gapPrefix}${gap.duration.toFixed(1)}s`}
              data-testid={`timeline-gap-${gap.trackId}-${gap.start}`}
            />
          ));
        }, [track.clips, zoom, projectFrameRate])}
        {Array.isArray(track.musicStructure) && track.musicStructure.length > 0 ? (
          <span
            className="absolute inset-0 z-[2] pointer-events-none"
            data-testid={`music-structure-markers-${track.id}`}
          >
            {track.musicStructure.map((ms, mi) => {
              const color =
                ms.type === 'energy_rise'
                  ? 'bg-green-500'
                  : ms.type === 'energy_drop'
                    ? 'bg-[var(--color-danger)]'
                    : 'bg-[var(--color-accent)]';
              const label =
                ms.type === 'energy_rise'
                  ? zhCN.musicStructure.energyRise
                  : ms.type === 'energy_drop'
                    ? zhCN.musicStructure.energyDrop
                    : zhCN.musicStructure.timbreShift;
              return (
                <span
                  key={mi}
                  className={`absolute top-0 bottom-0 w-px ${color} opacity-60`}
                  style={{ left: ms.time * zoom }}
                  data-testid={`music-structure-marker-${track.id}-${mi}`}
                  title={label}
                />
              );
            })}
          </span>
        ) : null}
        {Array.isArray(continuityWarnings) && continuityWarnings.length > 0 ? (
          <span className="absolute inset-0 z-[3] pointer-events-none" data-testid={`continuity-warnings-${track.id}`}>
            {continuityWarnings.map((w, wi) => {
              const boundaryClip = sortedClips.find((c) => c.id === w.clipAId);
              if (!boundaryClip) return null;
              const boundaryTime = boundaryClip.start + boundaryClip.duration;
              const isAxisJump = w.type === 'axis_jump';
              const label = isAxisJump ? zhCN.continuityCheck.axisJump : zhCN.continuityCheck.jumpCut;
              return (
                <span
                  key={wi}
                  className={`absolute top-1 z-[3] flex h-5 w-5 items-center justify-center rounded-full ${isAxisJump ? 'bg-[var(--color-danger)]' : 'bg-orange-400'} text-white shadow cursor-pointer pointer-events-auto`}
                  style={{ left: boundaryTime * zoom - 10 }}
                  title={label + ': ' + w.reason}
                  data-testid={`continuity-warning-${w.clipAId}-${w.clipBId}-${w.type}`}
                >
                  <AlertTriangle size={12} />
                </span>
              );
            })}
          </span>
        ) : null}
        {Array.isArray(colorConsistencyWarnings) && colorConsistencyWarnings.length > 0 ? (
          <span
            className="absolute inset-0 z-[4] pointer-events-none"
            data-testid={`color-consistency-warnings-${track.id}`}
          >
            {colorConsistencyWarnings.map((w, wi) => {
              const boundaryClip = sortedClips.find((c) => c.id === w.clipAId);
              if (!boundaryClip) return null;
              const boundaryTime = boundaryClip.start + boundaryClip.duration;
              const label =
                w.type === 'skin_tone'
                  ? zhCN.colorConsistency.skinTone
                  : w.type === 'white_balance'
                    ? zhCN.colorConsistency.whiteBalance
                    : zhCN.colorConsistency.both;
              return (
                <span
                  key={wi}
                  className="absolute top-1 z-[4] flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-white shadow cursor-pointer pointer-events-auto"
                  style={{ left: boundaryTime * zoom - 10 }}
                  title={
                    zhCN.colorConsistency.title +
                    ': ' +
                    label +
                    (w.deltaRGB != null ? ' (ΔRGB=' + w.deltaRGB.toFixed(1) + ')' : '')
                  }
                  data-testid={`color-consistency-warning-${w.clipAId}-${w.clipBId}-${w.type}`}
                >
                  <span>🎨</span>
                </span>
              );
            })}
          </span>
        ) : null}
        {Array.isArray(sfxSuggestions) && sfxSuggestions.length > 0 ? (
          <span className="absolute inset-0 z-[5] pointer-events-none" data-testid={`sfx-suggestions-${track.id}`}>
            {sfxSuggestions.map((s, si) => (
              <span
                key={si}
                className="absolute bottom-0 z-[5] flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-white shadow cursor-pointer pointer-events-auto"
                style={{ left: s.time * zoom - 8 }}
                title={
                  zhCN.sfxMatch.candidatePoint +
                  ': ' +
                  s.category +
                  ' (' +
                  (s.confidence * 100).toFixed(0) +
                  '%)' +
                  (s.matchedAssetId ? '' : ' - ' + zhCN.sfxMatch.noMatch)
                }
                data-testid={`sfx-suggestion-${track.id}-${si}`}
                data-sfx-status={s.status}
              >
                <span className="text-[9px]">♪</span>
              </span>
            ))}
          </span>
        ) : null}
        {virtualClips.map((clip) => {
          const isSelected = selectedClipIds.includes(clip.id) || selectedClipId === clip.id;
          const trimPreview =
            drag?.clip?.id === clip.id && (drag.mode === 'trim-left' || drag.mode === 'trim-right') ? drag : undefined;
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
            preloadPx: 100,
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
              trackHeight={getEffectiveTrackHeight(track.displayHeight)}
              nextAdjacentClip={nextAdjacentByClipId.get(clip.id)}
              transition={transitions.find(
                (transition) =>
                  transition.fromClipId === clip.id && transition.toClipId === nextAdjacentByClipId.get(clip.id)?.id,
              )}
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
              onRemoveAnomaly={onRemoveAnomaly}
            />
          );
        })}
      </div>
    </div>
  );
}

const MemoizedTrackRow = memo(TrackRow, areTrackRowPropsEqual);

function areTrackRowPropsEqual(
  previous: Parameters<typeof TrackRow>[0],
  next: Parameters<typeof TrackRow>[0],
): boolean {
  return (
    previous.track === next.track &&
    previous.zoom === next.zoom &&
    previous.selectedClipId === next.selectedClipId &&
    previous.selectedClipIds === next.selectedClipIds &&
    previous.selectedKeyframe === next.selectedKeyframe &&
    previous.selectedKeyframes === next.selectedKeyframes &&
    previous.selectedTrackIds === next.selectedTrackIds &&
    previous.drag === next.drag &&
    previous.media === next.media &&
    previous.virtualWindow === next.virtualWindow &&
    previous.largeProjectMode === next.largeProjectMode &&
    previous.rollingTrimActive === next.rollingTrimActive &&
    previous.slipEditActive === next.slipEditActive &&
    previous.slideEditActive === next.slideEditActive &&
    previous.clipGroupByClipId === next.clipGroupByClipId &&
    previous.colorFilter === next.colorFilter &&
    previous.projectFrameRate === next.projectFrameRate &&
    previous.envelopeEditMode === next.envelopeEditMode &&
    previous.reduceMotion === next.reduceMotion &&
    previous.collaborationLocksByClipId === next.collaborationLocksByClipId &&
    previous.transitions === next.transitions &&
    previous.continuityWarnings === next.continuityWarnings &&
    previous.colorConsistencyWarnings === next.colorConsistencyWarnings &&
    previous.sfxSuggestions === next.sfxSuggestions
  );
}

const MemoizedThumbnailTrack = memo(ThumbnailTrack);
const MemoizedRuler = memo(Ruler);

const TrackToggle = memo(function TrackToggle({
  label,
  title,
  active,
  testId,
  onClick,
}: {
  label: string;
  title: string;
  active: boolean;
  testId: string;
  onClick(): void;
}) {
  return (
    <button
      className={clsx(
        'h-6 w-6 rounded border text-[11px] font-semibold',
        active
          ? 'border-brand bg-brand text-white'
          : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel',
      )}
      title={title}
      aria-label={title}
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
});

const AudioTrackFrequencyBands = memo(function AudioTrackFrequencyBands({ trackId, bands }: { trackId: string; bands: number[] }) {
  return (
    <div
      className="mt-1 flex h-3 w-full max-w-[58px] items-end gap-px overflow-hidden rounded-sm bg-[var(--color-bg-elevated)] px-px"
      title={zhCN.timeline.audioFrequencyMeter}
      data-testid={`track-vu-bands-${trackId}`}
    >
      {Array.from({ length: 16 }, (_, index) => {
        const level = Math.min(1, Math.max(0, bands[index] ?? 0));
        return (
          <span
            key={index}
            className="w-0.5 rounded-t bg-emerald-500"
            style={{ height: `${Math.max(8, level * 100)}%` }}
          />
        );
      })}
    </div>
  );
});

function formatTimelineTrackType(track: Track): string {
  if (track.type === 'subtitle' && track.subtitleType === 'cc') {
    return zhCN.timeline.trackTypes.cc;
  }
  return formatTrackType(track.type);
}

export { MemoizedTrackRow as TrackRow, MemoizedThumbnailTrack as ThumbnailTrack, MemoizedRuler as Ruler };
