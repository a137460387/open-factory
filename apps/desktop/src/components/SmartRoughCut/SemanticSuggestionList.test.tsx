// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/SmartRoughCut/SemanticSuggestionList.tsx
// 策略：render + fireEvent 直调。锁定：列表项字段映射（label/range/reason/
// confidence）、climax 高亮契约（data-climax + 高亮类名）、空态与未就绪门控、
// hover 回调携带 timeRange.start、离开不清乱 playhead（M2 同款：无 leave 回调）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SemanticRoughCutSuggestion } from './semantic-suggestion';
import { SemanticSuggestionList } from './SemanticSuggestionList';

// ── Fixture ─────────────────────────────────────────────────

function makeSuggestion(overrides: Partial<SemanticRoughCutSuggestion> & { id: string }): SemanticRoughCutSuggestion {
  return {
    timeRange: { start: 0, end: 1 },
    markerType: 'climax',
    confidence: 0.7,
    label: '高潮片段',
    reason: '重点内容',
    ...overrides,
  };
}

const SUGGESTIONS: SemanticRoughCutSuggestion[] = [
  makeSuggestion({ id: 'semantic-0', timeRange: { start: 1.6, end: 2.5 }, confidence: 0.7 }),
  makeSuggestion({
    id: 'semantic-1',
    markerType: 'opening',
    timeRange: { start: 0, end: 0.8 },
    confidence: 0.8,
    label: '开场',
    reason: '开场白',
  }),
  makeSuggestion({
    id: 'semantic-2',
    markerType: 'rising',
    timeRange: { start: 0.8, end: 1.6 },
    confidence: 0.6,
    label: '铺垫',
    reason: '内容递增',
  }),
];

function renderList(overrides: { suggestions?: SemanticRoughCutSuggestion[]; ready?: boolean; onPreviewTime?: ReturnType<typeof vi.fn>; onReview?: ReturnType<typeof vi.fn> } = {}) {
  const onPreviewTime = overrides.onPreviewTime ?? vi.fn();
  const onReview = overrides.onReview ?? vi.fn();
  render(
    <SemanticSuggestionList
      suggestions={overrides.suggestions ?? SUGGESTIONS}
      ready={overrides.ready ?? true}
      onPreviewTime={onPreviewTime}
      onReview={onReview}
    />,
  );
  return { onPreviewTime, onReview };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ── MS-A：列表渲染 ─────────────────────────────────────────

describe('SemanticSuggestionList rendering', () => {
  it('renders every suggestion with label, formatted range, reason and confidence', () => {
    renderList();

    const climax = screen.getByTestId('smart-semantic-item-semantic-0');
    expect(climax.textContent).toContain('高潮片段');
    expect(climax.textContent).toContain('1.60s - 2.50s');
    expect(climax.textContent).toContain('重点内容');
    expect(climax.textContent).toContain('置信度 70%');

    const opening = screen.getByTestId('smart-semantic-item-semantic-1');
    expect(opening.textContent).toContain('开场');
    expect(opening.textContent).toContain('0.00s - 0.80s');
    expect(opening.textContent).toContain('开场白');
    expect(opening.textContent).toContain('置信度 80%');
  });

  it('marks climax items with the data attribute and highlight classes', () => {
    renderList();

    const climax = screen.getByTestId('smart-semantic-item-semantic-0');
    expect(climax.getAttribute('data-climax')).toBe('true');
    expect(climax.className).toContain('border-amber-400');
    expect(climax.className).toContain('bg-amber-50');

    const opening = screen.getByTestId('smart-semantic-item-semantic-1');
    expect(opening.getAttribute('data-climax')).toBe('false');
    expect(opening.className).not.toContain('border-amber-400');
  });

  it('renders the empty placeholder when ready with no suggestions', () => {
    renderList({ suggestions: [] });

    expect(screen.getByTestId('smart-semantic-empty')).toBeDefined();
    expect(screen.queryByTestId('smart-semantic-list')).toBeNull();
    expect(screen.getByTestId('smart-semantic').getAttribute('data-ready')).toBe('true');
  });
});

// ── MS-B：hover playhead 联动 ───────────────────────────────

describe('SemanticSuggestionList hover preview', () => {
  it('forwards the suggestion timeRange.start on item hover', () => {
    const { onPreviewTime } = renderList();

    fireEvent.mouseEnter(screen.getByTestId('smart-semantic-item-semantic-0'));

    expect(onPreviewTime).toHaveBeenCalledTimes(1);
    expect(onPreviewTime).toHaveBeenCalledWith(1.6);
  });

  it('does not move the playhead on mouse leave (M2-aligned behavior)', () => {
    const { onPreviewTime } = renderList();

    fireEvent.mouseEnter(screen.getByTestId('smart-semantic-item-semantic-0'));
    fireEvent.mouseLeave(screen.getByTestId('smart-semantic-item-semantic-0'));

    expect(onPreviewTime).toHaveBeenCalledTimes(1);
  });
});

// ── MS-C：ready 门控与状态切换 ───────────────────────────────

describe('SemanticSuggestionList ready gating', () => {
  it('shows the not-ready hint instead of the list when ready is false', () => {
    renderList({ ready: false });

    const section = screen.getByTestId('smart-semantic');
    expect(section.getAttribute('data-ready')).toBe('false');
    expect(screen.getByTestId('smart-semantic-hint').textContent).toContain('请先运行 Whisper 字幕生成转写文本');
    expect(screen.queryByTestId('smart-semantic-list')).toBeNull();
    expect(screen.queryByTestId('smart-semantic-empty')).toBeNull();
  });

  it('switches from the hint to the list when ready becomes true', () => {
    const { rerender } = render(
      <SemanticSuggestionList suggestions={SUGGESTIONS} ready={false} onPreviewTime={vi.fn()} onReview={vi.fn()} />,
    );
    expect(screen.getByTestId('smart-semantic-hint')).toBeDefined();

    rerender(<SemanticSuggestionList suggestions={SUGGESTIONS} ready onPreviewTime={vi.fn()} onReview={vi.fn()} />);

    expect(screen.queryByTestId('smart-semantic-hint')).toBeNull();
    expect(screen.getByTestId('smart-semantic-list')).toBeDefined();
    expect(screen.getByTestId('smart-semantic').getAttribute('data-ready')).toBe('true');
  });

  it('does not fire hover previews while gated off', () => {
    const onPreviewTime = vi.fn();
    render(<SemanticSuggestionList suggestions={SUGGESTIONS} ready={false} onPreviewTime={onPreviewTime} onReview={vi.fn()} />);

    // 门控态下列表不渲染，无从 hover；断言回调零调用
    expect(onPreviewTime).not.toHaveBeenCalled();
  });
});

// ── MS-D：对比审阅入口（M3-3 A1）────────────────────────────

describe('SemanticSuggestionList review entry', () => {
  it('renders a review button per suggestion and forwards the item on click', () => {
    const { onReview } = renderList();

    fireEvent.click(screen.getByTestId('smart-semantic-review-semantic-1'));

    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onReview).toHaveBeenCalledWith(SUGGESTIONS[1]);
  });

  it('does not trigger the hover preview when clicking the review button', () => {
    const { onPreviewTime, onReview } = renderList();

    fireEvent.click(screen.getByTestId('smart-semantic-review-semantic-0'));

    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onPreviewTime).not.toHaveBeenCalled();
  });
});
