import { useState, useCallback, useRef, useEffect } from 'react';
import { useSafeTimeout } from '../../hooks/useSafeTimeout';
import { History, Loader2, Sparkles } from 'lucide-react';
import {
  buildSemanticSearchMediaPayload,
  buildSemanticSearchSystemPrompt,
  buildSemanticSearchUserPrompt,
  parseSemanticSearchResponse,
  getUnanalyzedMediaIds,
  appendSemanticSearchHistory,
  sanitizeSemanticSearchHistory,
  hasAvailableTextProvider,
  type SemanticSearchHistoryEntry,
  type SemanticSearchResult
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';

const t = zhCN.mediaBin.aiSemanticSearch;

const HISTORY_STORAGE_KEY = 'ai-semantic-search-history';

function loadHistory(): SemanticSearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeSemanticSearchHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveHistory(history: SemanticSearchHistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
}

interface AISearchResultWithMedia extends SemanticSearchResult {
  name: string;
  type: string;
}

interface AISemanticSearchPanelProps {
  media: Array<{ id: string; name: string; type: string; aiAnalysis?: { tags?: string[]; scene?: string; mood?: string; objects?: string[] } }>;
  onSelectMedia: (mediaId: string) => void;
}

export function AISemanticSearchPanel({ media, onSelectMedia }: AISemanticSearchPanelProps) {
  const providers = useAISettingsStore((s) => s.providers);
  const available = hasAvailableTextProvider(providers);

  const safeTimeout = useSafeTimeout();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [results, setResults] = useState<AISearchResultWithMedia[]>([]);
  const [unanalyzedIds, setUnanalyzedIds] = useState<string[]>([]);
  const [history, setHistory] = useState<SemanticSearchHistoryEntry[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef(false);

  const mediaMap = useRef(new Map(media.map((m) => [m.id, m])));

  useEffect(() => {
    mediaMap.current = new Map(media.map((m) => [m.id, m]));
  }, [media]);

  const executeSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !available) return;
    const selectedProvider = providers.find((p) => p.enabled && hasAvailableTextProvider([p])) ?? providers[0];
    if (!selectedProvider) return;

    abortRef.current = false;
    setLoading(true);
    setError(undefined);
    setResults([]);
    setUnanalyzedIds([]);

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) return;

      const payload = buildSemanticSearchMediaPayload(media);
      const systemPrompt = buildSemanticSearchSystemPrompt();
      const userPrompt = buildSemanticSearchUserPrompt(searchQuery, payload);

      const response = await callAiApi({
        providerId: selectedProvider.id,
        baseUrl: selectedProvider.baseUrl,
        model: selectedProvider.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        timeoutSecs: 30
      }, apiKey);

      if (abortRef.current) return;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(response.content);
      } catch {
        setError('AI返回格式无效');
        setLoading(false);
        return;
      }

      const searchResults = parseSemanticSearchResponse(parsed);
      const resultIds = new Set(searchResults.map((r) => r.mediaId));
      const unanalyzed = getUnanalyzedMediaIds(media, resultIds);

      const resultsWithMedia: AISearchResultWithMedia[] = searchResults
        .filter((r) => mediaMap.current.has(r.mediaId))
        .map((r) => {
          const m = mediaMap.current.get(r.mediaId)!;
          return { ...r, name: m.name, type: m.type };
        });

      setResults(resultsWithMedia);
      setUnanalyzedIds(unanalyzed);

      const newHistory = appendSemanticSearchHistory(history, {
        query: searchQuery,
        timestamp: Date.now(),
        resultCount: searchResults.length
      });
      setHistory(newHistory);
      saveHistory(newHistory);
    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : '搜索失败');
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [available, providers, media, history]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  }, [query, executeSearch]);

  const handleHistorySelect = useCallback((q: string) => {
    setQuery(q);
    setShowHistory(false);
    executeSearch(q);
  }, [executeSearch]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
    setShowHistory(false);
  }, []);

  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  return (
    <div className="space-y-2" data-testid="ai-semantic-search-panel">
      <form onSubmit={handleSubmit} className="relative">
        <input
          className="w-full rounded-md border border-brand bg-[var(--color-bg-elevated)] py-2 pl-3 pr-16 text-sm text-ink"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          disabled={!available}
          data-testid="ai-search-input"
          onFocus={() => setShowHistory(true)}
          onBlur={() => safeTimeout(() => setShowHistory(false), 200)}
        />
        <button
          type="submit"
          disabled={loading || !query.trim() || !available}
          className="absolute right-1 top-1 rounded-md bg-brand px-2 py-1 text-xs text-white disabled:opacity-50"
          data-testid="ai-search-submit"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        </button>
      </form>

      {!available && (
        <p className="text-xs text-orange-500" data-testid="ai-search-no-provider">{t.noProvider}</p>
      )}

      {showHistory && history.length > 0 && (
        <div className="rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-sm" data-testid="ai-search-history">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs text-[var(--color-text-muted)]">{t.historyLabel}</span>
            <button onClick={handleClearHistory} className="text-xs text-[var(--color-text-muted)] hover:text-red-500">{t.clearHistory}</button>
          </div>
          {history.map((h, i) => (
            <button
              key={`${h.query}-${i}`}
              className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-panel"
              onMouseDown={() => handleHistorySelect(h.query)}
            >
              <History size={12} className="text-[var(--color-text-muted)]" />
              <span className="flex-1 truncate">{h.query}</span>
              <span className="text-[var(--color-text-muted)]">{h.resultCount}</span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--color-text-muted)]" data-testid="ai-search-loading">
          <Loader2 size={16} className="animate-spin" />
          {t.searching}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600" data-testid="ai-search-error">
          {error}
        </div>
      )}

      {!loading && !error && results.length === 0 && query.trim() && (
        <p className="py-2 text-center text-xs text-[var(--color-text-muted)]" data-testid="ai-search-no-results">{t.noResults}</p>
      )}

      {results.length > 0 && (
        <div className="space-y-1" data-testid="ai-search-results">
          <p className="text-xs text-[var(--color-text-muted)]">{t.resultCount(results.length)}</p>
          {results.map((r) => (
            <button
              key={r.mediaId}
              className="group flex w-full items-start gap-2 rounded-md border border-brand/30 bg-brand/5 p-2 text-left text-xs hover:bg-brand/10"
              onClick={() => onSelectMedia(r.mediaId)}
              title={`${t.matchReason}: ${r.reason}`}
              data-testid={`ai-search-result-${r.mediaId}`}
            >
              <span className="flex-1 truncate font-medium">{r.name}</span>
              <span className="shrink-0 rounded bg-brand/20 px-1 py-0.5 text-[10px] text-brand">
                {t.scoreLabel} {Math.round(r.score * 100)}%
              </span>
            </button>
          ))}
        </div>
      )}

      {unanalyzedIds.length > 0 && (
        <div className="mt-2 rounded-md border border-dashed border-slate-300 p-2" data-testid="ai-search-unanalyzed">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{t.unanalyzedGroup} ({unanalyzedIds.length})</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">{t.unanalyzedHint}</p>
        </div>
      )}
    </div>
  );
}
