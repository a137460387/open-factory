import { useState, useCallback } from 'react';
import { formatTime } from '@open-factory/editor-core';
import type { SubtitleFindReplaceViewProps } from './types';

export function SubtitleFindReplaceView({
  searchResults,
  currentResultIndex,
  onSearch,
  onReplace,
  onNavigate,
}: SubtitleFindReplaceViewProps) {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  const handleSearch = useCallback(() => {
    onSearch({
      searchText,
      caseSensitive,
      wholeWord,
      useRegex,
    });
  }, [searchText, caseSensitive, wholeWord, useRegex, onSearch]);

  const handleReplaceSingle = useCallback(() => {
    onReplace(
      {
        searchText,
        replaceText,
        caseSensitive,
        wholeWord,
        useRegex,
      },
      false,
    );
  }, [searchText, replaceText, caseSensitive, wholeWord, useRegex, onReplace]);

  const handleReplaceAll = useCallback(() => {
    onReplace(
      {
        searchText,
        replaceText,
        caseSensitive,
        wholeWord,
        useRegex,
      },
      true,
    );
  }, [searchText, replaceText, caseSensitive, wholeWord, useRegex, onReplace]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          onNavigate('prev');
        } else {
          handleSearch();
        }
      }
    },
    [handleSearch, onNavigate],
  );

  return (
    <div className="space-y-3 p-3">
      {/* Search Input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索字幕文本..."
            className="flex-1 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1.5 text-xs focus:border-[var(--color-accent)] focus:outline-none"
            data-testid="subtitle-search-input"
          />
          <button
            onClick={handleSearch}
            className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)]/90"
            data-testid="subtitle-search-button"
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
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            {showReplace ? '隐藏替换' : '显示替换'}
          </button>
        </div>
      </div>

      {/* Replace Input */}
      {showReplace && (
        <div className="space-y-2 rounded border border-line p-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="替换为..."
              className="flex-1 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1.5 text-xs focus:border-[var(--color-accent)] focus:outline-none"
              data-testid="subtitle-replace-input"
            />
            <button
              onClick={handleReplaceSingle}
              disabled={searchResults.length === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
              data-testid="subtitle-replace-single"
            >
              替换
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={searchResults.length === 0}
              className="rounded border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-50"
              data-testid="subtitle-replace-all"
            >
              全部替换
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>
            找到 {searchResults.length} 个结果
            {searchResults.length > 0 && ` (${currentResultIndex + 1}/${searchResults.length})`}
          </span>
          {searchResults.length > 0 && (
            <div className="flex gap-1">
              <button
                onClick={() => onNavigate('prev')}
                className="rounded border border-line px-2 py-0.5 hover:bg-panel"
                data-testid="subtitle-search-prev"
              >
                ↑
              </button>
              <button
                onClick={() => onNavigate('next')}
                className="rounded border border-line px-2 py-0.5 hover:bg-panel"
                data-testid="subtitle-search-next"
              >
                ↓
              </button>
            </div>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {searchResults.map((result, index) => (
              <div
                key={`${result.clipId}-${result.matchStart}`}
                className={`rounded px-2 py-1.5 text-xs ${
                  index === currentResultIndex
                    ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30'
                    : 'hover:bg-panel'
                }`}
              >
                <div className="font-mono text-[var(--color-text-muted)]">
                  {formatTime(result.matchStart)} - {formatTime(result.matchEnd)}
                </div>
                <div className="mt-0.5">
                  <span>{result.fullText.substring(0, result.matchStart)}</span>
                  <span className="bg-yellow-200 text-yellow-900">{result.matchedText}</span>
                  <span>{result.fullText.substring(result.matchEnd)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
