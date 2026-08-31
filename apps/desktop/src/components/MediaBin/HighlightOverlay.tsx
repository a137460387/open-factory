/**
 * Visual Highlight Overlay for MediaBin
 *
 * Displays highlight markers on media card thumbnails
 * with color-coded badges and a hover tooltip showing highlight time points.
 */

import { Star } from 'lucide-react';
import type { VisualHighlightMarker } from '@open-factory/editor-core/visual-highlight-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HighlightOverlayProps {
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
  'motion-peak': '#f97316', // orange
  'scene-change': '#8b5cf6', // violet
  combined: '#10b981', // emerald
};

const HIGHLIGHT_TYPE_LABELS: Record<VisualHighlightMarker['type'], string> = {
  'motion-peak': '运动峰值',
  'scene-change': '场景切换',
  combined: '综合高光',
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
