import {clsx} from 'clsx';
import {Star} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {TRANSITION_TYPES, type TransitionType} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {readTransitionFavorites, toggleTransitionFavorite} from '../../timeline/transition-favorites';
import type {TransitionMenuState} from './TimelineMenus';

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
