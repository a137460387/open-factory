/**
 * Contextual Suggestion Bubble
 *
 * Displays AI-generated contextual suggestions near the Timeline playhead
 * as non-blocking, dismissable bubbles.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Zap,
  Star,
  Volume2,
  Palette,
  X,
  ChevronRight,
  ChevronDown,
  Check,
  Lightbulb,
} from 'lucide-react';
import {
  generateContextualSuggestions,
  getSuggestionIcon,
  type ContextualSuggestion,
  type SuggestionCategory,
  type TimelineContext,
  type SuggestionConfig,
} from '@open-factory/editor-core/contextual-suggestions';
import type { Timeline, Clip, MediaAsset } from '@open-factory/editor-core/model-types';
import { clsx } from 'clsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextualSuggestionBubbleProps {
  /** Timeline state */
  timeline: Timeline;
  /** Media assets */
  media: MediaAsset[];
  /** Current timeline context */
  context: TimelineContext;
  /** Config overrides */
  config?: Partial<SuggestionConfig>;
  /** Called when a suggestion action is applied */
  onApplySuggestion(suggestion: ContextualSuggestion): void;
  /** Called when a suggestion is dismissed */
  onDismiss?(suggestionId: string): void;
  /** Whether suggestions are enabled */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Category styling
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<SuggestionCategory, { bg: string; border: string; icon: typeof Zap }> = {
  editing: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: Zap,
  },
  content: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: Star,
  },
  technical: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: Volume2,
  },
  creative: {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    icon: Palette,
  },
};

const PRIORITY_BADGES: Record<string, string> = {
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

// ---------------------------------------------------------------------------
// Single suggestion card
// ---------------------------------------------------------------------------

function SuggestionCard({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: ContextualSuggestion;
  onApply(): void;
  onDismiss(): void;
}) {
  const style = CATEGORY_STYLES[suggestion.category];
  const Icon = style.icon;

  return (
    <div
      className={clsx(
        'flex items-start gap-2.5 rounded-lg border p-2.5 shadow-sm transition-all',
        style.bg,
        style.border,
      )}
      data-testid={`suggestion-${suggestion.id}`}
    >
      <Icon size={16} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
            {suggestion.title}
          </span>
          <span
            className={clsx(
              'rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
              PRIORITY_BADGES[suggestion.priority],
            )}
          >
            {suggestion.priority === 'high' ? '高' : suggestion.priority === 'medium' ? '中' : '低'}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
          {suggestion.description}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)] px-2 py-1 text-[10px] font-medium text-white hover:opacity-90"
            type="button"
            data-testid={`apply-suggestion-${suggestion.id}`}
            onClick={onApply}
          >
            <Check size={10} />
            应用
          </button>
          <button
            className="inline-flex items-center gap-1 rounded bg-white/60 px-2 py-1 text-[10px] font-medium text-[var(--color-text-muted)] hover:bg-white/80"
            type="button"
            data-testid={`dismiss-suggestion-${suggestion.id}`}
            onClick={onDismiss}
          >
            <X size={10} />
            忽略
          </button>
          <span className="ml-auto text-[9px] text-[var(--color-text-muted)]">
            {Math.round(suggestion.confidence * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ContextualSuggestionBubble({
  timeline,
  media,
  context,
  config,
  onApplySuggestion,
  onDismiss,
  enabled = true,
}: ContextualSuggestionBubbleProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  // Generate suggestions
  const suggestions = useMemo(() => {
    if (!enabled) return [];
    return generateContextualSuggestions(timeline, media, context, config);
  }, [timeline, media, context, config, enabled]);

  // Filter dismissed
  const visibleSuggestions = useMemo(
    () => suggestions.filter((s) => !dismissed.has(s.id)),
    [suggestions, dismissed],
  );

  // Reset dismissed when context changes significantly
  useEffect(() => {
    setDismissed(new Set());
  }, [context.currentTime > 5 ? Math.floor(context.currentTime / 10) : 0]);

  const handleDismiss = useCallback(
    (id: string) => {
      setDismissed((prev) => new Set(prev).add(id));
      onDismiss?.(id);
    },
    [onDismiss],
  );

  if (visibleSuggestions.length === 0) return null;

  return (
    <div
      className="w-72 space-y-2"
      data-testid="contextual-suggestions"
    >
      {/* Header */}
      <button
        className="flex w-full items-center justify-between rounded-md bg-[var(--color-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] shadow-sm"
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        data-testid="suggestions-toggle"
      >
        <span className="flex items-center gap-1.5">
          <Lightbulb size={12} className="text-amber-500" />
          智能建议 ({visibleSuggestions.length})
        </span>
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* Suggestion list */}
      {!collapsed ? (
        <div className="space-y-1.5">
          {visibleSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onApply={() => onApplySuggestion(suggestion)}
              onDismiss={() => handleDismiss(suggestion.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Hook to manage contextual suggestions with debouncing.
 */
export function useContextualSuggestions(
  timeline: Timeline,
  media: MediaAsset[],
  context: TimelineContext,
  config?: Partial<SuggestionConfig>,
) {
  const [enabled, setEnabled] = useState(true);

  const suggestions = useMemo(() => {
    if (!enabled) return [];
    return generateContextualSuggestions(timeline, media, context, config);
  }, [timeline, media, context, config, enabled]);

  return {
    suggestions,
    enabled,
    setEnabled,
    toggle: () => setEnabled((prev) => !prev),
  };
}
