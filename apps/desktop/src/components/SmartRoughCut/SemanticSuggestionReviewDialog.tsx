/**
 * M3-3 A1 语义建议审阅对话框（单条显式应用）
 *
 * 对比呈现采纳前（原 clip 使用区间）/采纳后（保留建议区间）的源素材
 * 条带 + 保留比例，提供「采纳此建议」单一显式入口；应用走既有
 * ApplyRoughCutProposalCommand（onApply 由调用方注入，返回成功/失败
 * 供即时反馈）。覆盖整个 clip 的建议无法裁剪（命令侧守卫），按钮禁用
 * 并给出说明。无多选、无批量、无自动应用（A1 红线）。
 */
import { memo, useState } from 'react';
import { X } from 'lucide-react';
import type { Clip } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import type { SemanticRoughCutSuggestion } from './semantic-suggestion';
import { buildSuggestionReviewModel, suggestionCoversEntireClip } from './semantic-suggestion-review';
import { formatSeconds } from './smart-rough-cut-utils';

/** 采纳结果（useSmartRoughCut.applySemanticSuggestion 返回形态） */
export interface ApplySuggestionResult {
  ok: boolean;
  error?: string;
}

export interface SemanticSuggestionReviewDialogProps {
  suggestion: SemanticRoughCutSuggestion;
  clip: Clip;
  onApply(suggestion: SemanticRoughCutSuggestion): ApplySuggestionResult;
  onClose(): void;
}

function SourceRangeBar({
  label,
  range,
  windowStart,
  windowEnd,
  tone,
  testId,
}: {
  label: string;
  range: { start: number; end: number };
  windowStart: number;
  windowEnd: number;
  tone: 'before' | 'after';
  testId: string;
}) {
  const span = Math.max(windowEnd - windowStart, 0.000001);
  const left = ((range.start - windowStart) / span) * 100;
  const width = ((range.end - range.start) / span) * 100;
  return (
    <div data-testid={testId}>
      <p className="text-[10px] text-slate-500">{label}</p>
      <div className="relative mt-1 h-6 overflow-hidden rounded bg-panel" data-testid={`${testId}-track`}>
        <div
          className={`absolute bottom-0.5 top-0.5 rounded-sm ${
            tone === 'after' ? 'bg-emerald-500/80' : 'bg-slate-400/70'
          }`}
          style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(0.5, width)}%` }}
          data-testid={`${testId}-bar`}
        />
        <span className="absolute right-1 bottom-0 text-[8px] text-slate-400">
          {formatSeconds(range.start)} - {formatSeconds(range.end)}
        </span>
      </div>
    </div>
  );
}

function SemanticSuggestionReviewDialogImpl({
  suggestion,
  clip,
  onApply,
  onClose,
}: SemanticSuggestionReviewDialogProps) {
  const model = buildSuggestionReviewModel(suggestion, clip);
  const wholeClip = suggestionCoversEntireClip(suggestion, clip);
  const [feedback, setFeedback] = useState<{ result: 'success' | 'error'; message: string } | null>(null);

  const handleApply = () => {
    const outcome = onApply(suggestion);
    setFeedback(
      outcome.ok
        ? { result: 'success', message: zhCN.smartRoughCut.semanticReviewApplied(formatSeconds(model.keptDuration)) }
        : {
            result: 'error',
            message: zhCN.smartRoughCut.semanticReviewFailed(outcome.error ?? '未知错误'),
          },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      data-testid="semantic-review-dialog"
    >
      <div className="w-96 rounded-lg border border-line bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">{zhCN.smartRoughCut.semanticReviewTitle}</h3>
          <button
            type="button"
            className="rounded p-1 text-slate-400 hover:bg-panel"
            onClick={onClose}
            data-testid="semantic-review-close"
          >
            <X size={16} />
          </button>
        </div>

        <div
          className={`mb-3 rounded border p-2 ${
            suggestion.markerType === 'climax' ? 'border-amber-400 bg-amber-50' : 'border-line bg-white'
          }`}
          data-testid="semantic-review-summary"
        >
          <span className="text-xs font-semibold text-ink">{suggestion.label}</span>
          <span className="ml-2 text-[10px] tabular-nums text-slate-500">
            {zhCN.smartRoughCut.semanticRange(
              formatSeconds(suggestion.timeRange.start),
              formatSeconds(suggestion.timeRange.end),
            )}
            {' · '}
            {zhCN.smartRoughCut.semanticConfidence(suggestion.confidence)}
          </span>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">{suggestion.reason}</p>
        </div>

        <div className="space-y-2">
          <SourceRangeBar
            label={zhCN.smartRoughCut.semanticReviewBefore}
            range={model.before}
            windowStart={model.before.start}
            windowEnd={model.before.end}
            tone="before"
            testId="semantic-review-before"
          />
          <SourceRangeBar
            label={zhCN.smartRoughCut.semanticReviewAfter}
            range={model.after}
            windowStart={model.before.start}
            windowEnd={model.before.end}
            tone="after"
            testId="semantic-review-after"
          />
        </div>
        <p className="mt-2 text-[10px] text-slate-500" data-testid="semantic-review-ratio">
          保留 {Math.round(model.retentionRatio * 100)}%（保留 {formatSeconds(model.keptDuration)} / 原{' '}
          {formatSeconds(model.originalDuration)}）
        </p>

        {wholeClip ? (
          <p className="mt-3 text-xs text-amber-600" data-testid="semantic-review-whole-clip">
            {zhCN.smartRoughCut.semanticReviewWholeClip}
          </p>
        ) : null}

        {feedback ? (
          <p
            className={`mt-3 text-xs ${feedback.result === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}
            data-testid="semantic-review-feedback"
            data-result={feedback.result}
          >
            {feedback.message}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-line px-3 py-1.5 text-xs text-slate-600 hover:bg-panel"
            onClick={onClose}
            data-testid="semantic-review-cancel"
          >
            关闭
          </button>
          <button
            type="button"
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={wholeClip}
            onClick={handleApply}
            data-testid="semantic-review-apply"
          >
            {zhCN.smartRoughCut.semanticReviewApply}
          </button>
        </div>
      </div>
    </div>
  );
}

export const SemanticSuggestionReviewDialog = memo(SemanticSuggestionReviewDialogImpl);
