import {memo, useState} from 'react';
import {clsx} from 'clsx';
import {MoreHorizontal} from 'lucide-react';
import {
  getTimelineLabelColorHex,
  TIMELINE_LABEL_COLORS,
  getEffectiveTrackHeight,
  clampTrackHeight,
  DEFAULT_TRACK_HEIGHT,
  type Track,
} from '@open-factory/editor-core';
import {zhCN, formatTrackType} from '../../i18n/strings';
import {TRACK_DRAG_MIME} from './timeline-parts-types';

function TrackHeader({
  track,
  selectedTrack,
  frequencyBands,
  locked,
  onTrackHeaderClick,
  onTrackReorder,
  onTrackUpdate,
  onTrackBatchMenu,
}: {
  track: Track;
  selectedTrack: boolean;
  frequencyBands: number[];
  locked: boolean;
  onTrackHeaderClick(trackId: string, event: React.MouseEvent<HTMLDivElement>): void;
  onTrackReorder(draggedTrackId: string, targetTrackId: string): void;
  onTrackUpdate(
    trackId: string,
    patch: Partial<Pick<Track, 'color' | 'muted' | 'solo' | 'locked' | 'volume' | 'displayHeight'>>,
  ): void;
  onTrackBatchMenu(trackId: string, x: number, y: number): void;
}) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  return (
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
          style={{backgroundColor: getTimelineLabelColorHex(track.color)}}
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
                style={{backgroundColor: getTimelineLabelColorHex(color)}}
                type="button"
                title={zhCN.timeline.timelineLabelColorNames[color]}
                aria-label={zhCN.timeline.timelineLabelColorNames[color]}
                data-testid={`track-color-swatch-${color}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onTrackUpdate(track.id, {color});
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
                onTrackUpdate(track.id, {color: null});
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
          onClick={() => onTrackUpdate(track.id, {muted: !track.muted})}
        />
        <TrackToggle
          label="S"
          title={zhCN.timeline.soloTrack}
          active={Boolean(track.solo)}
          testId={`track-solo-${track.id}`}
          onClick={() => onTrackUpdate(track.id, {solo: !track.solo})}
        />
        <TrackToggle
          label="L"
          title={zhCN.timeline.lockTrack}
          active={locked}
          testId={`track-lock-${track.id}`}
          onClick={() => onTrackUpdate(track.id, {locked: !track.locked})}
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
        onChange={(event) => onTrackUpdate(track.id, {volume: Number(event.target.value)})}
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
            onTrackUpdate(track.id, {displayHeight: newHeight});
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
          onTrackUpdate(track.id, {displayHeight: DEFAULT_TRACK_HEIGHT});
        }}
      />
    </div>
  );
}

export const TrackToggle = memo(function TrackToggle({
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

export const AudioTrackFrequencyBands = memo(function AudioTrackFrequencyBands({
  trackId,
  bands,
}: {
  trackId: string;
  bands: number[];
}) {
  return (
    <div
      className="mt-1 flex h-3 w-full max-w-[58px] items-end gap-px overflow-hidden rounded-sm bg-[var(--color-bg-elevated)] px-px"
      title={zhCN.timeline.audioFrequencyMeter}
      data-testid={`track-vu-bands-${trackId}`}
    >
      {Array.from({length: 16}, (_, index) => {
        const level = Math.min(1, Math.max(0, bands[index] ?? 0));
        return (
          <span
            key={index}
            className="w-0.5 rounded-t bg-emerald-500"
            style={{height: `${Math.max(8, level * 100)}%`}}
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

export {TrackHeader, formatTimelineTrackType};
