/**
 * Rough Cut Comparison Panel
 *
 * Displays multiple rough cut proposals side-by-side with:
 * - Segment timeline preview for each proposal
 * - Quality scores and metrics
 * - One-click apply functionality
 */

import { useState, useMemo } from 'react';
import {
  Zap,
  Music,
  BarChart3,
  Clock,
  Star,
  Check,
  Eye,
  ArrowRight,
  X,
  Scissors,
} from 'lucide-react';
import {
  generateRoughCutProposals,
  type RoughCutResult,
  type RoughCutProposal,
  type RoughCutSegment,
} from '@open-factory/editor-core/smart-rough-cut';
import type { VisualHighlightMarker } from '@open-factory/editor-core/visual-highlight-engine';
import type { OnsetEvent, AudioRhythmResult } from '@open-factory/editor-core/audio-rhythm-analysis';
import { formatTimeShort } from '@open-factory/editor-core';
import { clsx } from 'clsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoughCutComparePanelProps {
  /** Visual highlight markers */
  highlights: VisualHighlightMarker[];
  /** Audio rhythm analysis result */
  rhythmResult: AudioRhythmResult | null;
  /** Source duration in seconds */
  sourceDuration: number;
  /** Called when a proposal is applied */
  onApply(proposal: RoughCutProposal): void;
  /** Called when a segment is previewed */
  onPreviewSegment?(segment: RoughCutSegment): void;
  /** Called to close the panel */
  onClose(): void;
}

// ---------------------------------------------------------------------------
// Segment timeline mini-visualization
// ---------------------------------------------------------------------------

function SegmentTimeline({
  segments,
  sourceDuration,
  onPreviewSegment,
}: {
  segments: RoughCutSegment[];
  sourceDuration: number;
  onPreviewSegment?(segment: RoughCutSegment): void;
}) {
  if (sourceDuration <= 0 || segments.length === 0) {
    return <div className="h-8 rounded bg-panel text-center text-[10px] text-[var(--color-text-muted)] leading-8">无片段</div>;
  }

  return (
    <div className="relative h-8 overflow-hidden rounded bg-[var(--color-bg-secondary)]" data-testid="segment-timeline">
      {/* Source duration background */}
      <div className="absolute inset-0 bg-[var(--color-bg-secondary)]" />

      {/* Segments */}
      {segments.map((seg, i) => {
        const left = (seg.sourceStart / sourceDuration) * 100;
        const width = (seg.duration / sourceDuration) * 100;
        return (
          <button
            key={i}
            className="absolute top-0.5 bottom-0.5 rounded-sm transition-opacity hover:opacity-80"
            style={{
              left: `${left}%`,
              width: `${Math.max(0.5, width)}%`,
              backgroundColor: `hsl(${220 + i * 30}, 70%, ${55 + (seg.score * 15)}%)`,
            }}
            type="button"
            title={`片段 ${i + 1}: ${formatTimeShort(seg.sourceStart)} - ${formatTimeShort(seg.sourceEnd)} (${formatTimeShort(seg.duration)})`}
            data-testid={`segment-block-${i}`}
            onClick={() => onPreviewSegment?.(seg)}
          />
        );
      })}

      {/* Duration label */}
      <span className="absolute right-1 bottom-0.5 text-[8px] text-white/50">
        {formatTimeShort(sourceDuration)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score badge
// ---------------------------------------------------------------------------

function ScoreBadge({ score, label, icon: Icon }: { score: number; label: string; icon: typeof Star }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-rose-600';
  return (
    <div className="flex items-center gap-1" title={label}>
      <Icon size={12} className="shrink-0 text-[var(--color-text-muted)]" />
      <span className={`text-xs font-semibold ${color}`}>{pct}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proposal card
// ---------------------------------------------------------------------------

function ProposalCard({
  proposal,
  sourceDuration,
  rank,
  isSelected,
  onSelect,
  onApply,
  onPreviewSegment,
}: {
  proposal: RoughCutProposal;
  sourceDuration: number;
  rank: number;
  isSelected: boolean;
  onSelect(): void;
  onApply(): void;
  onPreviewSegment?(segment: RoughCutSegment): void;
}) {
  const strategyIcon = proposal.id === 'highlights-first' ? Star : proposal.id === 'beat-sync' ? Music : BarChart3;

  return (
    <div
      className={clsx(
        'cursor-pointer rounded-lg border p-3 transition-all',
        isSelected
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 shadow-md'
          : 'border-line bg-[var(--color-bg-elevated)] hover:border-[var(--color-accent)]/50',
      )}
      data-testid={`rough-cut-proposal-${proposal.id}`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-[10px] font-bold text-[var(--color-accent)]">
            {rank}
          </span>
          <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
            {proposal.name}
          </span>
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)]">{proposal.id}</span>
      </div>

      {/* Description */}
      <p className="mb-2 text-xs text-[var(--color-text-muted)]">{proposal.description}</p>

      {/* Segment timeline */}
      <SegmentTimeline
        segments={proposal.segments}
        sourceDuration={sourceDuration}
        onPreviewSegment={onPreviewSegment}
      />

      {/* Metrics */}
      <div className="mt-2 flex items-center gap-3">
        <ScoreBadge score={proposal.qualityScore} label="综合质量" icon={Star} />
        <ScoreBadge score={proposal.pacingScore} label="节奏评分" icon={Zap} />
        <ScoreBadge score={proposal.highlightCoverage} label="高光覆盖" icon={Eye} />
        <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          <Clock size={12} />
          {formatTimeShort(proposal.totalDuration)}
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {proposal.segments.length} 片段
        </span>
      </div>

      {/* Apply button (shown when selected) */}
      {isSelected ? (
        <button
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          type="button"
          data-testid={`apply-proposal-${proposal.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onApply();
          }}
        >
          <Check size={14} />
          应用此方案
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function RoughCutComparePanel({
  highlights,
  rhythmResult,
  sourceDuration,
  onApply,
  onPreviewSegment,
  onClose,
}: RoughCutComparePanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const result = useMemo<RoughCutResult>(() => {
    const audioBeats = rhythmResult?.onsets ?? [];
    return generateRoughCutProposals(highlights, audioBeats, sourceDuration);
  }, [highlights, rhythmResult, sourceDuration]);

  return (
    <div
      className="flex flex-col rounded-lg border border-line bg-[var(--color-bg-elevated)] shadow-lg"
      data-testid="rough-cut-compare-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Scissors size={16} className="text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">智能粗剪方案</h3>
          <span className="rounded bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">
            {result.proposals.length} 个方案
          </span>
        </div>
        <button
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-panel"
          type="button"
          onClick={onClose}
          data-testid="rough-cut-close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 border-b border-line px-4 py-2 text-xs text-[var(--color-text-muted)]">
        <span>源素材: {formatTimeShort(sourceDuration)}</span>
        <span>高光: {result.inputHighlightCount} 个</span>
        <span>节拍: {result.inputBeatCount} 个</span>
      </div>

      {/* Proposals */}
      <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
        {result.proposals.map((proposal, i) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            sourceDuration={sourceDuration}
            rank={i + 1}
            isSelected={selectedId === proposal.id}
            onSelect={() => setSelectedId(proposal.id)}
            onApply={() => onApply(proposal)}
            onPreviewSegment={onPreviewSegment}
          />
        ))}
      </div>
    </div>
  );
}
