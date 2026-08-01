import {TIMELINE_LABEL_COLORS, getTimelineLabelColorHex, type Track, type TrackPatch} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import type {TrackBatchMenuState} from './TimelineMenus';

export function TrackBatchMenu({
  menu,
  selectedTracks,
  onPatch,
  onDeleteEmpty,
  onSetEqualHeight,
  onClose,
}: {
  menu: TrackBatchMenuState;
  selectedTracks: Track[];
  onPatch(patchForTrack: (track: Track) => TrackPatch): void;
  onDeleteEmpty(): void;
  onSetEqualHeight(): void;
  onClose(): void;
}) {
  const disabled = selectedTracks.length === 0;
  const hasEmptyTrack = selectedTracks.some((track) => track.clips.length === 0);
  return (
    <div
      className="fixed z-50 w-[220px] rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="track-batch-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 px-2 text-[11px] font-semibold text-[var(--color-text-muted)]">
        {zhCN.timeline.trackBatchSelectedCount(selectedTracks.length)}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <button
          className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40"
          type="button"
          data-testid="track-batch-mute"
          disabled={disabled}
          onClick={() => onPatch(() => ({ muted: true }))}
        >
          {zhCN.timeline.trackBatchMute}
        </button>
        <button
          className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40"
          type="button"
          data-testid="track-batch-unmute"
          disabled={disabled}
          onClick={() => onPatch(() => ({ muted: false }))}
        >
          {zhCN.timeline.trackBatchUnmute}
        </button>
        <button
          className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40"
          type="button"
          data-testid="track-batch-solo"
          disabled={disabled}
          onClick={() => onPatch(() => ({ solo: true }))}
        >
          {zhCN.timeline.trackBatchSolo}
        </button>
        <button
          className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40"
          type="button"
          data-testid="track-batch-unsolo"
          disabled={disabled}
          onClick={() => onPatch(() => ({ solo: false }))}
        >
          {zhCN.timeline.trackBatchUnsolo}
        </button>
        <button
          className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40"
          type="button"
          data-testid="track-batch-lock"
          disabled={disabled}
          onClick={() => onPatch(() => ({ locked: true }))}
        >
          {zhCN.timeline.trackBatchLock}
        </button>
        <button
          className="rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40"
          type="button"
          data-testid="track-batch-unlock"
          disabled={disabled}
          onClick={() => onPatch(() => ({ locked: false }))}
        >
          {zhCN.timeline.trackBatchUnlock}
        </button>
      </div>
      <button
        className="mt-1 block w-full rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        data-testid="track-batch-delete-empty"
        disabled={disabled || !hasEmptyTrack}
        onClick={onDeleteEmpty}
      >
        {zhCN.timeline.trackBatchDeleteEmpty}
      </button>
      <div className="mt-2 border-t border-line pt-2">
        <div className="mb-1 px-2 text-[11px] font-semibold text-[var(--color-text-muted)]">
          {zhCN.timeline.trackBatchSetColor}
        </div>
        <div className="grid grid-cols-6 gap-1 px-2">
          {TIMELINE_LABEL_COLORS.map((color) => (
            <button
              key={color}
              className="h-5 w-5 rounded-full border border-white ring-1 ring-slate-200 hover:ring-slate-500 disabled:opacity-40"
              style={{ backgroundColor: getTimelineLabelColorHex(color) }}
              type="button"
              title={zhCN.timeline.timelineLabelColorNames[color]}
              aria-label={zhCN.timeline.timelineLabelColorNames[color]}
              data-testid={`track-batch-color-${color}`}
              disabled={disabled}
              onClick={() => onPatch(() => ({ color }))}
            />
          ))}
        </div>
        <button
          className="mt-2 block w-full rounded px-2 py-1.5 text-left text-[var(--color-text-muted)] hover:bg-panel disabled:opacity-40"
          type="button"
          data-testid="track-batch-color-default"
          disabled={disabled}
          onClick={() => onPatch(() => ({ color: null }))}
        >
          {zhCN.timeline.defaultLabelColor}
        </button>
      </div>
      <button
        className="mt-1 block w-full rounded px-2 py-1.5 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        data-testid="track-batch-equal-height"
        disabled={disabled}
        onClick={onSetEqualHeight}
      >
        {zhCN.timeline.trackBatchSetEqualHeight}
      </button>
      <button
        className="mt-1 block w-full rounded px-2 py-1.5 text-left text-[var(--color-text-muted)] hover:bg-panel"
        type="button"
        onClick={onClose}
      >
        {zhCN.timeline.close}
      </button>
    </div>
  );
}
