import {type Clip, type ClipGroupColor, type GapFillStrategy, type TimelineLabelColor, type TransitionType} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {buildRulerContextMenuItems, type RulerContextMenuAction} from './timeline-ruler-menu';

export interface TransitionMenuState {
  x: number;
  y: number;
  fromClipId: string;
  toClipId: string;
  existingTransitionId?: string;
  existingType?: TransitionType;
  existingDuration?: number;
  type: TransitionType;
  duration: number;
}

export interface ClipMenuState {
  x: number;
  y: number;
  clipId: string;
  clipType: Clip['type'];
}

export interface VolumeEnvelopeMenuState {
  x: number;
  y: number;
  clipId: string;
}

export interface GapMenuState {
  x: number;
  y: number;
  trackId: string;
  time: number;
}

export interface RulerMenuState {
  x: number;
  y: number;
  time: number;
  timecode: string;
}

export interface TrackBatchMenuState {
  x: number;
  y: number;
  trackId: string;
}

export function GapActionMenu({
  menu,
  onCloseGap,
  onFillGap,
  onClose,
}: {
  menu: GapMenuState;
  onCloseGap(): void;
  onFillGap(strategy: GapFillStrategy): void;
  onClose(): void;
}) {
  return (
    <div
      className="fixed z-50 w-[210px] rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="gap-action-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel"
        type="button"
        data-testid="gap-action-close"
        onClick={onCloseGap}
      >
        {zhCN.timeline.closeGapAction}
      </button>
      <div className="my-1 border-t border-line" />
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel"
        type="button"
        data-testid="gap-action-freeze-frame"
        onClick={() => onFillGap('freeze-frame')}
      >
        {zhCN.timeline.smartGapFillFreezeFrameAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel"
        type="button"
        data-testid="gap-action-black"
        onClick={() => onFillGap('black')}
      >
        {zhCN.timeline.smartGapFillBlackAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel"
        type="button"
        data-testid="gap-action-white"
        onClick={() => onFillGap('white')}
      >
        {zhCN.timeline.smartGapFillWhiteAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel"
        type="button"
        data-testid="gap-action-repeat"
        onClick={() => onFillGap('repeat')}
      >
        {zhCN.timeline.smartGapFillRepeatAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel"
        type="button"
        data-testid="gap-action-crossfade"
        onClick={() => onFillGap('crossfade')}
      >
        {zhCN.timeline.smartGapFillCrossfadeAction}
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

export function VolumeEnvelopeMenu({
  menu,
  onFade,
  onReset,
  onClose,
}: {
  menu: VolumeEnvelopeMenuState;
  onFade(kind: 'in' | 'out'): void;
  onReset(): void;
  onClose(): void;
}) {
  return (
    <div
      className="fixed z-50 w-[180px] rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="volume-envelope-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel"
        type="button"
        data-testid="volume-envelope-fade-in"
        onClick={() => onFade('in')}
      >
        {zhCN.timeline.volumeEnvelopeFadeIn}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel"
        type="button"
        data-testid="volume-envelope-fade-out"
        onClick={() => onFade('out')}
      >
        {zhCN.timeline.volumeEnvelopeFadeOut}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel"
        type="button"
        data-testid="volume-envelope-reset"
        onClick={onReset}
      >
        {zhCN.timeline.volumeEnvelopeReset}
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

export function RulerContextMenu({
  menu,
  onChange,
  onAction,
  onJump,
  onClose,
}: {
  menu: RulerMenuState;
  onChange(menu: RulerMenuState): void;
  onAction(action: RulerContextMenuAction): void;
  onJump(): void;
  onClose(): void;
}) {
  const items = buildRulerContextMenuItems();
  return (
    <div
      className="fixed z-50 w-[220px] rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="ruler-context-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {items
        .filter((item) => item.action !== 'jump-timecode')
        .map((item) => (
          <button
            key={item.action}
            className="block w-full rounded px-2 py-2 text-left hover:bg-panel"
            type="button"
            data-testid={item.testId}
            onClick={() => onAction(item.action)}
          >
            {item.label}
          </button>
        ))}
      <div className="my-1 border-t border-line" />
      <div className="px-2 py-1" data-testid="ruler-context-jump-timecode">
        <label className="block text-[11px] font-semibold text-[var(--color-text-muted)]">
          {zhCN.timeline.rulerJumpToTimecode}
          <input
            className="mt-1 h-7 w-full rounded border border-line px-2 font-mono text-xs tabular-nums text-ink"
            value={menu.timecode}
            placeholder={zhCN.timeline.rulerTimecodePlaceholder}
            data-testid="ruler-timecode-input"
            onChange={(event) => onChange({ ...menu, timecode: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onJump();
              }
            }}
          />
        </label>
        <button
          className="mt-2 block w-full rounded bg-brand px-2 py-1.5 text-center font-medium text-white"
          type="button"
          data-testid="ruler-timecode-jump-button"
          onClick={onJump}
        >
          {zhCN.timeline.rulerJump}
        </button>
      </div>
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

// Re-export extracted components so existing consumers are unaffected
export {TransitionMenu, TransitionPreviewCanvas, drawPreviewShape} from './TransitionMenu';
export {TrackBatchMenu} from './TrackBatchMenu';
export {ClipActionMenu} from './ClipActionMenu';
