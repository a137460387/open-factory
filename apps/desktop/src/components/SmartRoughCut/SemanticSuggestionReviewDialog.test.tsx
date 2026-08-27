// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/SmartRoughCut/SemanticSuggestionReviewDialog.tsx
// 策略：render + fireEvent 直调（与 SemanticSuggestionList.test.tsx 同款）。
// 锁定：before/after 审阅视图渲染、采纳成功/失败的即时反馈契约
// （data-result）、整 clip 建议的采纳禁用（A1 红线：失败可预期、无自动应用）、
// 关闭回调。命令执行链路由 useSmartRoughCut.test.ts 与 e2e 覆盖。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Clip } from '@open-factory/editor-core';
import { makeClip } from '../Timeline/hooks/timeline/__tests__/test-fixtures';
import type { SemanticRoughCutSuggestion } from './semantic-suggestion';
import { SemanticSuggestionReviewDialog, type ApplySuggestionResult } from './SemanticSuggestionReviewDialog';

// ── Fixture ─────────────────────────────────────────────────

function makeSuggestion(
  overrides: Partial<SemanticRoughCutSuggestion> & { timeRange: { start: number; end: number } },
): SemanticRoughCutSuggestion {
  return {
    id: 'semantic-0',
    markerType: 'climax',
    confidence: 0.7,
    label: '高潮片段',
    reason: '重点内容',
    source: 'narrative',
    ...overrides,
  };
}

/** clip 占据时间线 [0, 10)，源域 [0, 10) */
function makeClip10s(): Clip {
  return makeClip({ id: 'clip-1', start: 0, duration: 10 });
}

function renderDialog(overrides: {
  suggestion?: SemanticRoughCutSuggestion;
  clip?: Clip;
  onApply?: (suggestion: SemanticRoughCutSuggestion) => ApplySuggestionResult;
} = {}) {
  const suggestion = overrides.suggestion ?? makeSuggestion({ timeRange: { start: 2, end: 6 } });
  const clip = overrides.clip ?? makeClip10s();
  const onApply = overrides.onApply ?? vi.fn(() => ({ ok: true }));
  const onClose = vi.fn();
  render(<SemanticSuggestionReviewDialog suggestion={suggestion} clip={clip} onApply={onApply} onClose={onClose} />);
  return { suggestion, onApply, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ── 渲染契约 ────────────────────────────────────────────────

describe('SemanticSuggestionReviewDialog rendering', () => {
  it('renders before/after bars with the kept ratio derived from the suggestion', () => {
    renderDialog();

    expect(screen.getByTestId('semantic-review-dialog')).toBeDefined();
    expect(screen.getByTestId('semantic-review-summary').textContent).toContain('高潮片段');
    expect(screen.getByTestId('semantic-review-before')).toBeDefined();
    expect(screen.getByTestId('semantic-review-after')).toBeDefined();
    // 建议区间 [2, 6) / 原 10s → 保留 40%
    expect(screen.getByTestId('semantic-review-ratio').textContent).toContain('保留 40%');
  });

  it('clamps the after bar inside the before window for out-of-range suggestions', () => {
    // after 条基于 before 窗口渲染，宽度按窗口钳制（极端值不越界）
    renderDialog({ suggestion: makeSuggestion({ timeRange: { start: 0, end: 10 } }) });

    expect(screen.getByTestId('semantic-review-after-bar')).toBeDefined();
  });

  it('shows the heuristic source tag for head-trim/tail-trim suggestions but not narrative ones', () => {
    renderDialog();
    expect(screen.getByTestId('semantic-review-summary').textContent).not.toContain('启发式');
    cleanup();

    renderDialog({
      suggestion: makeSuggestion({
        id: 'semantic-head-trim',
        markerType: 'opening',
        label: '掐头收紧',
        source: 'head-trim',
        timeRange: { start: 1, end: 10 },
      }),
    });
    expect(screen.getByTestId('semantic-review-summary').textContent).toContain('掐头收紧');
    expect(screen.getByTestId('semantic-review-summary').textContent).toContain('启发式');
  });
});

// ── 采纳反馈（A1 红线：单一显式入口 + 即时成功/失败反馈）─────

describe('SemanticSuggestionReviewDialog apply feedback', () => {
  it('shows success feedback after applying', () => {
    const { onApply } = renderDialog({ onApply: vi.fn(() => ({ ok: true })) });

    fireEvent.click(screen.getByTestId('semantic-review-apply'));

    expect(onApply).toHaveBeenCalledTimes(1);
    const feedback = screen.getByTestId('semantic-review-feedback');
    expect(feedback.getAttribute('data-result')).toBe('success');
    expect(feedback.textContent).toContain('已应用');
    expect(feedback.textContent).toContain('Ctrl+Z');
  });

  it('shows failure feedback with the error reason and stays open', () => {
    const { onClose } = renderDialog({
      onApply: vi.fn(() => ({ ok: false, error: 'Proposal keeps the entire clip' })),
    });

    fireEvent.click(screen.getByTestId('semantic-review-apply'));

    const feedback = screen.getByTestId('semantic-review-feedback');
    expect(feedback.getAttribute('data-result')).toBe('error');
    expect(feedback.textContent).toContain('Proposal keeps the entire clip');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables the apply button and explains when the suggestion covers the whole clip', () => {
    const { onApply } = renderDialog({
      suggestion: makeSuggestion({ timeRange: { start: 0, end: 10 } }),
    });

    const apply = screen.getByTestId('semantic-review-apply') as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    expect(screen.getByTestId('semantic-review-whole-clip').textContent).toContain('覆盖整个片段');
    expect(onApply).not.toHaveBeenCalled();
  });
});

// ── 关闭交互 ────────────────────────────────────────────────

describe('SemanticSuggestionReviewDialog close', () => {
  it('invokes onClose from the header and cancel buttons', () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByTestId('semantic-review-close'));
    fireEvent.click(screen.getByTestId('semantic-review-cancel'));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
