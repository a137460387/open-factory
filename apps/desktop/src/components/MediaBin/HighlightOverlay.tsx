/**
 * Visual Highlight Overlay for MediaBin
 *
 * Displays highlight markers on media card thumbnails
 * with color-coded badges and a hover tooltip showing highlight time points.
 */

import { useState, useMemo } from 'react';
import { Star, Zap, Film } from 'lucide-react';
import type { VisualHighlightMarker } from '@open-factory/editor-core/visual-highlight-engine';
import { extractHighlightRanges } from '@open-factory/editor-core/visual-highlight-engine';
import { formatTimeShort } from '@open-factory/editor-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HighlightOverlayProps {
  /** Highlight markers from visual-highlight-engine */
  highlights: VisualHighlightMarker[];
  /** Total media duration in seconds */
  duration: number;
  /** Called when user clicks a highlight time to seek preview */
  onSeekToHighlight?(time: number): void;
  /** Whether to show the compact badge only */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Highlight type colors
// ---------------------------------------------------------------------------

const HIGHLIGHT_TYPE_COLORS: Record<VisualHighlightMarker['type'], string> = {
  'motion-peak': '#f97316',     // orange
  'scene-change': '#8b5cf6',    // violet
  'combined': '#10b981',        // emerald
};

const HIGHLIGHT_TYPE_LABELS: Record<VisualHighlightMarker['type'], string> = {
  'motion-peak': '运动峰值',
  'scene-change': '场景切换',
  'combined': '综合高光',
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function HighlightBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow ${className ?? ''}`}
      data-testid="highlight-badge"
      title={`检测到 ${count} 个高光时刻`}
    >
      <Star size={10} fill="currentColor" />
      {count}
    </span>
  );
}

export function HighlightOverlay({
  highlights,
  duration,
  onSeekToHighlight,
  compact = false,
}: HighlightOverlayProps) {
  const [hovering, setHovering] = useState(false);
  const ranges = useMemo(() => extractHighlightRanges(highlights, 0.5), [highlights]);

  if (highlights.length === 0) return null;

  if (compact) {
    return <HighlightBadge count={highlights.length} className="absolute right-2 bottom-2 z-10" />;
  }

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-10"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Highlight range bar */}
      <div className="relative h-1.5 w-full bg-black/20">
        {ranges.map((range, i) => {
          const leftPct = duration > 0 ? (range.start / duration) * 100 : 0;
          const widthPct = duration > 0 ? ((range.end - range.start) / duration) * 100 : 0;
          return (
            <div
              key={i}
              className="absolute top-0 h-full rounded-sm"
              style={{
                left: `${leftPct}%`,
                width: `${Math.max(1, widthPct)}%`,
                backgroundColor: `rgba(251, 191, 36, ${0.4 + range.peakScore * 0.6})`,
              }}
              title={`${range.count} 个高光 (${formatTimeShort(range.start)} - ${formatTimeShort(range.end)})`}
            />
          );
        })}
      </div>

      {/* Hover tooltip with highlight list */}
      {hovering && highlights.length > 0 ? (
        <div
          className="absolute bottom-full left-1/2 z-20 mb-1 w-56 -translate-x-1/2 rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 text-xs shadow-soft"
          data-testid="highlight-tooltip"
        >
          <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-[var(--color-text-secondary)]">
            <Star size={12} className="text-amber-500" fill="currentColor" />
            高光时刻 ({highlights.length})
          </div>
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {highlights.slice(0, 10).map((h, i) => (
              <button
                key={i}
                className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left hover:bg-panel"
                type="button"
                data-testid={`highlight-item-${i}`}
                onClick={() => onSeekToHighlight?.(h.time)}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: HIGHLIGHT_TYPE_COLORS[h.type] }}
                  />
                  <span className="text-[var(--color-text-secondary)]">
                    {HIGHLIGHT_TYPE_LABELS[h.type]}
                  </span>
                </span>
                <span className="font-mono text-[var(--color-text-muted)]">
                  {formatTimeShort(h.time)}
                </span>
              </button>
            ))}
          </div>
          {highlights.length > 10 ? (
            <div className="mt-1 text-center text-[10px] text-[var(--color-text-muted)]">
              还有 {highlights.length - 10} 个...
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Compact highlight summary shown in MediaCard thumbnail area.
 * Uses colored dots for quick visual scan.
 */
export function HighlightDots({
  highlights,
  maxDots = 3,
}: {
  highlights: VisualHighlightMarker[];
  maxDots?: number;
}) {
  if (highlights.length === 0) return null;

  const topHighlights = highlights.slice(0, maxDots);
  return (
    <div className="absolute left-2 bottom-8 z-10 flex items-center gap-0.5" data-testid="highlight-dots">
      {topHighlights.map((h, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: HIGHLIGHT_TYPE_COLORS[h.type] }}
          title={`${HIGHLIGHT_TYPE_LABELS[h.type]} ${formatTimeShort(h.time)}`}
        />
      ))}
      {highlights.length > maxDots ? (
        <span className="text-[8px] text-white/70">+{highlights.length - maxDots}</span>
      ) : null}
    </div>
  );
}
