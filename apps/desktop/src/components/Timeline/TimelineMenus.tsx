import {
  CLIP_GROUP_COLORS,
  CLIP_GROUP_COLOR_HEX,
  PROJECT_ANNOTATION_COLORS,
  TIMELINE_LABEL_COLORS,
  TIMELINE_NOTE_COLORS,
  TRANSITION_TYPES,
  getTimelineLabelColorHex,
  isFrameRateMismatch,
  secondsToTimecode,
  type Clip,
  type ClipGroup,
  type ClipGroupColor,
  type GapFillStrategy,
  type MediaAsset,
  type MediaVersionEntry,
  type TimelineLabelColor,
  type TimecodeFormat,
  type Track,
  type TrackPatch,
  type TransitionType,
} from '@open-factory/editor-core';
import { clsx } from 'clsx';
import { Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { zhCN } from '../../i18n/strings';
import { canGenerateSubtitlesForClip } from '../../lib/whisper';
import { readTransitionFavorites, toggleTransitionFavorite } from '../../timeline/transition-favorites';
import { buildRulerContextMenuItems, type RulerContextMenuAction } from './timeline-ruler-menu';

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

export function TransitionMenu({
  menu,
  onChange,
  onAdd,
  onRemove,
  onClose,
}: {
  menu: TransitionMenuState;
  onChange(menu: TransitionMenuState): void;
  onAdd(): void;
  onRemove?: () => void;
  onClose(): void;
}) {
  const [favorites, setFavorites] = useState<TransitionType[]>(() => readTransitionFavorites());
  const orderedTypes = useMemo(() => {
    const favoriteTypes = favorites.filter((type) => TRANSITION_TYPES.includes(type));
    return [...favoriteTypes, ...TRANSITION_TYPES.filter((type) => !favoriteTypes.includes(type))];
  }, [favorites]);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const selectType = (type: TransitionType) => onChange({ ...menu, type });
  const toggleFavorite = (type: TransitionType) => {
    setFavorites(toggleTransitionFavorite(type));
  };

  return (
    <div
      className="fixed z-50 w-[360px] rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="transition-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 font-semibold text-[var(--color-text-secondary)]">{zhCN.timeline.transitionPicker}</div>
      <label className="mb-2 block text-[var(--color-text-secondary)]">
        {zhCN.timeline.transitionType}
        <select
          className="mt-1 w-full rounded border border-line px-2 py-1"
          value={menu.type}
          data-testid="transition-type-select"
          onChange={(event) => onChange({ ...menu, type: event.target.value as TransitionType })}
        >
          {TRANSITION_TYPES.map((type) => (
            <option key={type} value={type}>
              {zhCN.timeline.transitionNames[type]}
            </option>
          ))}
        </select>
      </label>
      <div className="mb-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1" data-testid="transition-effect-grid">
        {orderedTypes.map((type, index) => {
          const favorite = favoriteSet.has(type);
          return (
            <div
              key={type}
              role="button"
              tabIndex={0}
              className={clsx(
                'group relative min-w-0 rounded-md border p-1 text-left hover:border-brand hover:bg-sky-50',
                menu.type === type ? 'border-brand bg-sky-50' : 'border-line bg-[var(--color-bg-elevated)]',
              )}
              data-testid={`transition-preset-${type}`}
              data-favorite={favorite ? 'true' : 'false'}
              onClick={() => selectType(type)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectType(type);
                }
              }}
            >
              <TransitionPreviewCanvas type={type} active={menu.type === type} />
              <span className="mt-1 block truncate text-[11px] font-medium text-[var(--color-text-secondary)]">
                {zhCN.timeline.transitionNames[type]}
              </span>
              {index === 0 && favorite ? <span className="sr-only">{zhCN.timeline.transitionFavorites}</span> : null}
              <button
                type="button"
                className={clsx(
                  'absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded bg-[var(--color-bg-elevated)]/90 shadow-sm',
                  favorite ? 'text-amber-500' : 'text-[var(--color-text-muted)]',
                )}
                aria-label={zhCN.timeline.transitionFavoriteToggle}
                data-testid={`transition-favorite-${type}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(type);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleFavorite(type);
                  }
                }}
              >
                <Star size={14} fill={favorite ? 'currentColor' : 'none'} />
              </button>
            </div>
          );
        })}
      </div>
      <label className="mb-3 block text-[var(--color-text-secondary)]">
        {zhCN.timeline.transitionDuration}
        <input
          className="mt-1 w-full rounded border border-line px-2 py-1"
          type="number"
          min={0.1}
          max={5}
          step={0.05}
          value={menu.duration}
          data-testid="transition-duration-input"
          onChange={(event) => onChange({ ...menu, duration: Number(event.target.value) })}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button className="rounded border border-line px-2 py-1 hover:bg-panel" type="button" onClick={onClose}>
          {zhCN.timeline.close}
        </button>
        {onRemove ? (
          <button
            className="rounded border border-rose-300 px-2 py-1 text-rose-700 hover:bg-rose-50"
            type="button"
            data-testid="transition-remove-button"
            onClick={onRemove}
          >
            {zhCN.timeline.remove}
          </button>
        ) : null}
        <button
          className="rounded bg-brand px-2 py-1 font-medium text-white"
          type="button"
          data-testid="transition-add-button"
          onClick={onAdd}
        >
          {zhCN.timeline.add}
        </button>
      </div>
    </div>
  );
}

export function TransitionPreviewCanvas({ type, active }: { type: TransitionType; active: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);
    const base = context.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, '#0f766e');
    base.addColorStop(1, '#2563eb');
    context.fillStyle = base;
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#f8fafc';
    context.globalAlpha = 0.88;
    const progress = 0.58;
    if (type.startsWith('wipe')) {
      const horizontal = type === 'wipe-left' || type === 'wipe-right';
      context.fillRect(
        type === 'wipe-left' ? 0 : horizontal ? width * (1 - progress) : 0,
        type === 'wipe-up' ? 0 : !horizontal ? height * (1 - progress) : 0,
        horizontal ? width * progress : width,
        horizontal ? height : height * progress,
      );
    } else if (type === 'zoom-dissolve') {
      context.globalAlpha = 0.7;
      context.beginPath();
      context.arc(width / 2, height / 2, Math.min(width, height) * 0.36, 0, Math.PI * 2);
      context.fill();
    } else if (type === 'flash-white' || type === 'flash-black') {
      context.globalAlpha = 0.78;
      context.fillStyle = type === 'flash-white' ? '#ffffff' : '#020617';
      context.fillRect(0, 0, width, height);
    } else if (type === 'block') {
      for (let y = 0; y < height; y += 12) {
        for (let x = 0; x < width; x += 12) {
          if ((x + y) % 24 === 0) {
            context.fillRect(x, y, 12, 12);
          }
        }
      }
    } else if (type === 'rotate') {
      context.translate(width / 2, height / 2);
      context.rotate(-0.45);
      context.fillRect(-width * 0.28, -height * 0.24, width * 0.56, height * 0.48);
      context.setTransform(1, 0, 0, 1, 0, 0);
    } else if (type.startsWith('film-roll')) {
      context.fillRect(0, height * 0.18, width, height * 0.64);
      context.clearRect(8, height * 0.28, 8, 8);
      context.clearRect(width - 16, height * 0.28, 8, 8);
      context.clearRect(8, height * 0.58, 8, 8);
      context.clearRect(width - 16, height * 0.58, 8, 8);
    } else if (type === 'shape-heart' || type === 'shape-star') {
      drawPreviewShape(context, type, width, height);
    } else if (type === 'motion-blur-wipe') {
      for (let index = 0; index < 5; index += 1) {
        context.globalAlpha = 0.16 + index * 0.08;
        context.fillRect(index * 12, 0, width * 0.36, height);
      }
    } else {
      context.globalAlpha = 0.5;
      context.fillRect(0, 0, width, height);
    }
    context.globalAlpha = 1;
    if (active) {
      context.strokeStyle = '#0284c7';
      context.lineWidth = 4;
      context.strokeRect(2, 2, width - 4, height - 4);
    }
  }, [active, type]);

  return (
    <canvas
      ref={ref}
      className="block h-12 w-full rounded bg-[var(--color-bg-elevated)]"
      width={144}
      height={72}
      aria-hidden="true"
    />
  );
}

export function drawPreviewShape(
  context: CanvasRenderingContext2D,
  type: TransitionType,
  width: number,
  height: number,
) {
  context.save();
  context.translate(width / 2, height / 2);
  context.fillStyle = '#f8fafc';
  context.globalAlpha = 0.9;
  context.beginPath();
  if (type === 'shape-star') {
    const outer = Math.min(width, height) * 0.34;
    const inner = outer * 0.45;
    for (let point = 0; point < 10; point += 1) {
      const radius = point % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + (point * Math.PI) / 5;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (point === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
  } else {
    const scale = Math.min(width, height) / 72;
    context.moveTo(0, 18 * scale);
    context.bezierCurveTo(-36 * scale, -8 * scale, -18 * scale, -32 * scale, 0, -14 * scale);
    context.bezierCurveTo(18 * scale, -32 * scale, 36 * scale, -8 * scale, 0, 18 * scale);
  }
  context.fill();
  context.restore();
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

export function ClipActionMenu({
  menu,
  clip,
  asset,
  versionEntries,
  group,
  projectFrameRate,
  canCreateGroup,
  whisperReady,
  whisperUnavailableMessage,
  onSilence,
  onScene,
  onGenerateCover,
  onGenerateSubtitles,
  onAlignSubtitles,
  onTtsVoiceover,
  onReplaceMedia,
  onSwitchVersion,
  onConvertFrameRate,
  onPack,
  onAiReframe,
  onAiTransitionRecommend,
  onAnomalyDetect,
  onCreateGroup,
  onUngroup,
  onDeleteGroup,
  onGroupColor,
  onClipColor,
  onDelete,
  onRippleDelete,
  onClose,
}: {
  menu: ClipMenuState;
  clip?: Clip;
  asset?: MediaAsset;
  versionEntries: MediaVersionEntry[];
  group?: ClipGroup;
  projectFrameRate: number;
  canCreateGroup: boolean;
  whisperReady: boolean;
  whisperUnavailableMessage?: string;
  onSilence(): void;
  onScene(): void;
  onGenerateCover(): void;
  onGenerateSubtitles(): void;
  onAlignSubtitles(): void;
  onTtsVoiceover(): void;
  onReplaceMedia(): void;
  onSwitchVersion(mediaId: string): void;
  onConvertFrameRate(): void;
  onPack(): void;
  onAiReframe(): void;
  onAiTransitionRecommend(): void;
  onAnomalyDetect(): void;
  onCreateGroup(): void;
  onUngroup(group: ClipGroup): void;
  onDeleteGroup(group: ClipGroup): void;
  onGroupColor(group: ClipGroup, color: ClipGroupColor): void;
  onClipColor(clipId: string, color: TimelineLabelColor | null): void;
  onDelete(): void;
  onRippleDelete(): void;
  onClose(): void;
}) {
  const canDetectSilence = Boolean(clip && (clip.type === 'audio' || (clip.type === 'video' && asset?.hasAudio)));
  const canDetectScene = clip?.type === 'video';
  const canGenerateCover = clip?.type === 'video' && asset?.type === 'video';
  const canGenerateSubtitles = canGenerateSubtitlesForClip(clip, asset, whisperReady);
  const canAlignSubtitles = clip?.type === 'subtitle';
  const canTtsVoiceover = clip?.type === 'subtitle';
  const canReplaceMedia = Boolean(clip && (clip.type === 'video' || clip.type === 'audio' || clip.type === 'image'));
  const canConvertFrameRate = Boolean(
    asset?.type === 'video' && (asset.variableFrameRate || isFrameRateMismatch(asset.frameRate, projectFrameRate)),
  );
  const currentMediaId = clip && 'mediaId' in clip ? clip.mediaId : undefined;
  return (
    <div
      className="fixed z-50 max-h-[80vh] w-[230px] overflow-y-auto rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="clip-action-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canDetectSilence}
        data-testid="clip-action-silence"
        onClick={onSilence}
      >
        {zhCN.timeline.silenceAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canDetectScene}
        data-testid="clip-action-scene"
        onClick={onScene}
      >
        {zhCN.timeline.sceneAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canGenerateCover}
        data-testid="clip-action-generate-cover"
        onClick={onGenerateCover}
      >
        {zhCN.timeline.generateCoverFramesAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canGenerateSubtitles}
        title={!canGenerateSubtitles ? whisperUnavailableMessage : undefined}
        data-testid="clip-action-generate-subtitles"
        onClick={onGenerateSubtitles}
      >
        {zhCN.timeline.generateSubtitlesAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canAlignSubtitles}
        data-testid="clip-action-align-subtitles"
        onClick={onAlignSubtitles}
      >
        {zhCN.timeline.alignSubtitlesAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canTtsVoiceover}
        data-testid="clip-action-tts-voiceover"
        onClick={onTtsVoiceover}
      >
        {zhCN.aiTts.subtitleToVoiceover}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={clip?.type !== 'video'}
        data-testid="clip-action-ai-reframe"
        onClick={onAiReframe}
      >
        {zhCN.toolbar.aiSmartReframe}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={clip?.type !== 'video'}
        data-testid="clip-action-ai-transition"
        onClick={onAiTransitionRecommend}
      >
        {zhCN.toolbar.aiRecommendTransition}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={clip?.type !== 'video'}
        data-testid="clip-action-anomaly-detect"
        onClick={onAnomalyDetect}
      >
        {zhCN.toolbar.detectAnomalies}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canReplaceMedia}
        data-testid="clip-action-replace-media"
        onClick={onReplaceMedia}
      >
        {zhCN.timeline.replaceMediaAction}
      </button>
      {versionEntries.length > 1 ? (
        <div className="rounded-md border border-line bg-panel px-2 py-2" data-testid="clip-media-version-menu">
          <div className="mb-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            {zhCN.timeline.switchMediaVersionAction}
          </div>
          <div className="grid gap-1">
            {versionEntries.map((entry) => (
              <button
                key={entry.id}
                className={clsx(
                  'flex min-w-0 items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[11px] hover:bg-[var(--color-bg-elevated)] disabled:opacity-60',
                  currentMediaId === entry.assetId
                    ? 'bg-[var(--color-bg-elevated)] font-semibold text-brand'
                    : 'text-[var(--color-text-secondary)]',
                )}
                type="button"
                disabled={currentMediaId === entry.assetId}
                data-testid={`clip-switch-version-${entry.assetId}`}
                onClick={() => onSwitchVersion(entry.assetId)}
              >
                <span>{entry.label}</span>
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canConvertFrameRate}
        data-testid="clip-action-convert-frame-rate"
        onClick={onConvertFrameRate}
      >
        {zhCN.timeline.convertFrameRateAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!clip}
        data-testid="clip-action-pack-nested"
        onClick={onPack}
      >
        {zhCN.timeline.packNestedSequence}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        data-testid="clip-action-delete"
        onClick={onDelete}
      >
        {zhCN.timeline.deleteSelectedClip}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        data-testid="clip-action-ripple-delete"
        onClick={onRippleDelete}
      >
        {zhCN.timeline.rippleDeleteClip}
      </button>
      <div className="my-1 border-t border-line" />
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canCreateGroup}
        data-testid="clip-action-create-group"
        onClick={onCreateGroup}
      >
        {zhCN.timeline.clipGroupCreate}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!group}
        data-testid="clip-action-ungroup"
        onClick={() => group && onUngroup(group)}
      >
        {zhCN.timeline.clipGroupUngroup}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left text-rose-700 hover:bg-rose-50 disabled:opacity-40"
        type="button"
        disabled={!group}
        data-testid="clip-action-delete-group"
        onClick={() => group && onDeleteGroup(group)}
      >
        {zhCN.timeline.clipGroupDelete}
      </button>
      {clip ? (
        <div className="px-2 pb-1 pt-2" data-testid="clip-label-color-options">
          <div className="mb-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            {zhCN.timeline.clipLabelColor}
          </div>
          <div className="flex flex-wrap gap-1">
            {TIMELINE_LABEL_COLORS.map((color) => (
              <button
                key={color}
                className={`h-5 w-5 rounded-full border ${clip.colorLabel === color ? 'border-line ring-2 ring-[var(--color-border)]' : 'border-white'}`}
                type="button"
                title={zhCN.timeline.timelineLabelColorNames[color]}
                style={{ backgroundColor: getTimelineLabelColorHex(color) }}
                data-testid={`clip-label-color-${color}`}
                onClick={() => onClipColor(clip.id, color)}
              />
            ))}
          </div>
          <button
            className="mt-1 rounded border border-line px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            data-testid="clip-label-color-clear"
            onClick={() => onClipColor(clip.id, null)}
          >
            {zhCN.timeline.defaultLabelColor}
          </button>
        </div>
      ) : null}
      {group ? (
        <div className="px-2 pb-1 pt-2" data-testid="clip-group-color-options">
          <div className="mb-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            {zhCN.timeline.clipGroupColor}
          </div>
          <div className="flex gap-1">
            {CLIP_GROUP_COLORS.map((color) => (
              <button
                key={color}
                className={`h-5 w-5 rounded-full border ${group.color === color ? 'border-line ring-2 ring-[var(--color-border)]' : 'border-white'}`}
                type="button"
                title={zhCN.timeline.clipGroupColorNames[color]}
                style={{ backgroundColor: CLIP_GROUP_COLOR_HEX[color] }}
                data-testid={`clip-group-color-${color}`}
                onClick={() => onGroupColor(group, color)}
              />
            ))}
          </div>
        </div>
      ) : null}
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
