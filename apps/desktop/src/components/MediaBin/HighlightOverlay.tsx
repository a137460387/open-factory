/**
 * Visual Highlight Overlay for MediaBin
 *
 * Displays highlight markers on media card thumbnails
 * with color-coded badges and a hover tooltip showing highlight time points.
 */

import { Star } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Highlight type colors
// ---------------------------------------------------------------------------



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
