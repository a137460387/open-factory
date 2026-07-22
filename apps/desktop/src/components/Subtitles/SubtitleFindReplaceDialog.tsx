import { useState, useCallback, useEffect, useRef } from 'react';
import type { Timeline } from '@open-factory/editor-core';
import {
  searchSubtitles,
  replaceSubtitles,
  replaceSingleResult,
  type SubtitleSearchResult,
  type SubtitleSearchOptions,
  formatTime,
} from '@open-factory/editor-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubtitleFindReplaceDialogProps {
  timeline: Timeline;
  onTimelineChange: (timeline: Timeline) => void;
  onNavigateToResult?: (result: SubtitleSearchResult) => void;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubtitleFindReplaceDialog({
  timeline,
  onTimelineChange,
  onNavigateToResult,
  onClose,
}: SubtitleFindReplaceDialogProps) {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [results, setResults] = useState<SubtitleSearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦搜索框
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // 执行搜索
  const handleSearch = useCallback(() => {
    setError(null);

    if (!searchText.trim()) {
      setResults([]);
      setCurrentIndex(-1);
      return;
    }

    try {
      const searchResults = searchSubtitles(timeline, {
        searchText,
        caseSensitive,
        wholeWord,
        useRegex,
      });

      setResults(searchResults);
      setCurrentIndex(searchResults.length > 0 ? 0 : -1);

      // 导航到第一个结果
      if (searchResults.length > 0) {
        onNavigateToResult?.(searchResults[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索出错');
      setResults([]);
      setCurrentIndex(-1);
    }
  }, [searchText, caseSensitive, wholeWord, useRegex, timeline, onNavigateToResult]);

  // 导航到指定结果
  const navigateToResult = useCallback(
    (index: number) => {
      if (index >= 0 && index < results.length) {
        setCurrentIndex(index);
        onNavigateToResult?.(results[index]);
      }
    },
    [results, onNavigateToResult],
  );

  // 导航到下一个/上一个
  const handleNavigate = useCallback(
    (direction: 'next' | 'prev') => {
      if (results.length === 0) return;

      const newIndex =
        direction === 'next'
          ? (currentIndex + 1) % results.length
          : (currentIndex - 1 + results.length) % results.length;

      navigateToResult(newIndex);
    },
    [results, currentIndex, navigateToResult],
  );

  // 替换当前
  const handleReplaceCurrent = useCallback(() => {
    if (currentIndex < 0 || !results[currentIndex]) return;

    const result = results[currentIndex];
    const newTimeline = replaceSingleResult(timeline, result, replaceText);
    onTimelineChange(newTimeline);

    // 移除当前结果并更新列表
    const newResults = results.filter((_, i) => i !== currentIndex);
    setResults(newResults);

    // 调整当前索引
    const newIndex = Math.min(currentIndex, newResults.length - 1);
    setCurrentIndex(newIndex);

    // 导航到下一个结果
    if (newResults.length > 0 && newIndex >= 0) {
      onNavigateToResult?.(newResults[newIndex]);
    }
  }, [timeline, currentIndex, results, replaceText, onTimelineChange, onNavigateToResult]);

  // 全部替换
  const handleReplaceAll = useCallback(() => {
    if (!searchText.trim()) return;

    const { timeline: newTimeline, replacedCount } = replaceSubtitles(timeline, {
      searchText,
      replaceText,
      caseSensitive,
      wholeWord,
      useRegex,
    });

    if (replacedCount > 0) {
      onTimelineChange(newTimeline);

      // 重新搜索
      const newResults = searchSubtitles(newTimeline, {
        searchText,
        caseSensitive,
        wholeWord,
        useRegex,
      });

      setResults(newResults);
      setCurrentIndex(newResults.length > 0 ? 0 : -1);
    }
  }, [searchText, replaceText, caseSensitive, wholeWord, useRegex, timeline, onTimelineChange]);

  // 键盘快捷键
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          if (e.shiftKey) {
            handleNavigate('prev');
          } else {
            handleSearch();
          }
          break;
        case 'Escape':
          onClose?.();
          break;
        case 'ArrowDown':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleNavigate('next');
          }
          break;
        case 'ArrowUp':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleNavigate('prev');
          }
          break;
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) {
              e.preventDefault();
              setShowReplace((prev) => !prev);
            }
          }
          break;
      }
    },
    [handleSearch, handleNavigate, onClose],
  );

  // 高亮匹配文本
  const highlightMatch = useCallback((text: string, matchStart: number, matchEnd: number) => {
    const before = text.substring(0, matchStart);
    const match = text.substring(matchStart, matchEnd);
    const after = text.substring(matchEnd);

    return (
      <>
        <span>{before}</span>
        <span className="bg-yellow-200 text-yellow-900 font-medium">{match}</span>
        <span>{after}</span>
      </>
    );
  }, []);

  return (
    <div
      className="flex flex-col bg-[var(--color-bg-primary)] shadow-lg rounded-lg border border-line"
      style={{ width: '400px', maxHeight: '500px' }}
      onKeyDown={handleKeyDown}
      data-testid="subtitle-find-replace-dialog"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h3 className="text-sm font-semibold text-ink">{showReplace ? '查找和替换' : '查找字幕'}</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-panel"
          data-testid="find-replace-close"
        >
          ✕
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="输入搜索文本..."
            className="flex-1 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1.5 text-xs focus:border-[var(--color-accent)] focus:outline-none"
            data-testid="find-replace-search-input"
          />
          <button
            onClick={handleSearch}
            className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)]/90"
            data-testid="find-replace-search-button"
          >
            搜索
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="rounded border-line"
            />
            区分大小写
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={wholeWord}
              onChange={(e) => setWholeWord(e.target.checked)}
              className="rounded border-line"
            />
            全词匹配
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(e) => setUseRegex(e.target.checked)}
              className="rounded border-line"
            />
            正则表达式
          </label>
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="text-xs text-[var(--color-accent)] hover:underline ml-auto"
          >
            {showReplace ? '隐藏替换' : '显示替换'}
          </button>
        </div>

        {/* Error */}
        {error && <div className="rounded bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-600">{error}</div>}
      </div>

      {/* Replace Input */}
      {showReplace && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="替换为..."
              className="flex-1 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1.5 text-xs focus:border-[var(--color-accent)] focus:outline-none"
              data-testid="find-replace-replace-input"
            />
            <button
              onClick={handleReplaceCurrent}
              disabled={currentIndex < 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
              data-testid="find-replace-single"
            >
              替换
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={results.length === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
              data-testid="find-replace-all"
            >
              全部替换
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Results Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-line">
          <span className="text-xs text-[var(--color-text-muted)]">
            {results.length > 0
              ? `${currentIndex + 1} / ${results.length} 个结果`
              : searchText.trim()
                ? '未找到结果'
                : ''}
          </span>
          {results.length > 0 && (
            <div className="flex gap-1">
              <button
                onClick={() => handleNavigate('prev')}
                className="rounded border border-line px-2 py-0.5 text-xs hover:bg-panel"
                data-testid="find-replace-prev"
              >
                ↑
              </button>
              <button
                onClick={() => handleNavigate('next')}
                className="rounded border border-line px-2 py-0.5 text-xs hover:bg-panel"
                data-testid="find-replace-next"
              >
                ↓
              </button>
            </div>
          )}
        </div>

        {/* Results List */}
        {results.length > 0 && (
          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {results.map((result, index) => (
              <div
                key={`${result.clipId}-${result.matchStart}`}
                className={`cursor-pointer px-3 py-2 text-xs transition-colors ${
                  index === currentIndex ? 'bg-[var(--color-accent)]/10' : 'hover:bg-panel'
                }`}
                onClick={() => navigateToResult(index)}
                data-testid={`find-replace-result-${index}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[var(--color-text-muted)]">
                    {formatTime(result.matchStart)} - {formatTime(result.matchEnd)}
                  </span>
                  <span className="text-[var(--color-text-muted)]">轨道 {result.trackIndex + 1}</span>
                </div>
                <div className="line-clamp-2">
                  {highlightMatch(result.fullText, result.matchStart, result.matchEnd)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-line px-3 py-2 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center justify-between">
          <span>Enter: 搜索 | Shift+Enter: 上一个 | Ctrl+↓: 下一个</span>
          <span>Esc: 关闭</span>
        </div>
      </div>
    </div>
  );
}
