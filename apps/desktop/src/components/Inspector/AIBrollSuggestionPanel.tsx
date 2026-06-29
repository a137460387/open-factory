import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Sparkles, Plus, X } from 'lucide-react';
import type { Clip, BrollSuggestion } from '@open-factory/editor-core';
import {
  detectCoverageGaps,
  matchKeywords,
  parseBrollAiResponse,
  createBrollSuggestions,
  normalizeBrollSuggestions,
  hasAvailableTextProvider
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';

const t = zhCN.inspector.aiBrollSuggestion;

export function AIBrollSuggestionPanel({
  clip,
  trackId,
  allClips,
  allMedia,
  onInsertSuggestion,
  onUpdateSuggestions,
}: {
  clip: Clip;
  trackId: string;
  allClips: Array<{ id: string; start: number; duration: number; mediaId?: string; trackId: string }>;
  allMedia: Array<{ id: string; name: string; aiAnalysis?: { tags?: string[] } }>;
  onInsertSuggestion: (suggestion: BrollSuggestion) => void;
  onUpdateSuggestions: (suggestions: BrollSuggestion[]) => void;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const available = hasAvailableTextProvider(providers);

  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<BrollSuggestion[]>([]);
  const [error, setError] = useState<string>();
  const abortRef = useRef(false);

  const selectedProvider = providers.find((p) => p.enabled && hasAvailableTextProvider([p])) ?? providers[0];

  // Load existing suggestions
  useEffect(() => {
    const existing = (clip as unknown as Record<string, unknown>).brollSuggestions as BrollSuggestion[] | undefined;
    if (existing && existing.length > 0) {
      setSuggestions(existing);
    }
  }, [clip]);

  const handleAnalyze = useCallback(async () => {
    if (!selectedProvider || !available) return;
    abortRef.current = false;
    setLoading(true);
    setError(undefined);

    try {
      // Local gap detection
      const subtitleSegments = allClips
        .filter((c) => c.trackId === trackId && c.id !== clip.id)
        .map((c) => ({
          id: c.id,
          start: c.start,
          end: c.start + c.duration,
          text: (c as Record<string, unknown>).text as string || '',
        }));

      const gaps = detectCoverageGaps(
        subtitleSegments.map((s) => ({ ...s, trackId })),
        allClips.filter((c) => c.trackId !== trackId).map((c) => ({ start: c.start, end: c.start + c.duration })),
        3
      );

      if (gaps.length === 0) {
        showToast({ kind: 'info', title: t.noGaps });
        setLoading(false);
        return;
      }

      // Local keyword matching
      const mediaTags = allMedia.map((m) => ({
        id: m.id,
        tags: m.aiAnalysis?.tags ?? [],
      }));

      const segmentTexts = subtitleSegments.map((s) => s.text).filter(Boolean);
      const matchedKeywords = segmentTexts.flatMap((text) =>
        mediaTags.flatMap((mt) =>
          matchKeywords(text, mt.tags).map((kw) => ({ keyword: kw, mediaId: mt.id }))
        )
      );

      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) return;

      // Send only text features to AI (not images)
      const payload = JSON.stringify({
        segmentText: segmentTexts.join(' | '),
        matchedKeywords: matchedKeywords.map((m) => m.keyword),
        currentClipId: clip.id,
      });

      const response = await callAiApi({
        providerId: selectedProvider.id,
        baseUrl: selectedProvider.baseUrl,
        model: selectedProvider.defaultModel,
        messages: [
          { role: 'system', content: 'B-roll推荐助手' },
          { role: 'user', content: payload },
        ],
        temperature: 0.3,
        timeoutSecs: 30,
      }, apiKey);

      if (abortRef.current) return;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(response.content);
      } catch {
        showToast({ kind: 'error', title: t.failedTitle, message: 'AI返回格式无效' });
        setLoading(false);
        return;
      }

      const aiResponse = parseBrollAiResponse(parsed);
      const newSuggestions = createBrollSuggestions(aiResponse);
      setSuggestions(newSuggestions);
      onUpdateSuggestions(newSuggestions);
    } catch (err) {
      if (!abortRef.current) {
        showToast({
          kind: 'error',
          title: t.failedTitle,
          message: err instanceof Error ? err.message : t.failedMessage,
        });
        setError(err instanceof Error ? err.message : t.failedMessage);
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [selectedProvider, available, clip, trackId, allClips, allMedia, onUpdateSuggestions]);

  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  const handleInsert = (suggestion: BrollSuggestion) => {
    onInsertSuggestion(suggestion);
    const updated = suggestions.map((s) =>
      s.segmentId === suggestion.segmentId && s.mediaId === suggestion.mediaId
        ? { ...s, status: 'accepted' as const }
        : s
    );
    setSuggestions(updated);
    showToast({ kind: 'success', title: t.inserted });
  };

  const handleReject = (suggestion: BrollSuggestion) => {
    const updated = suggestions.map((s) =>
      s.segmentId === suggestion.segmentId && s.mediaId === suggestion.mediaId
        ? { ...s, status: 'rejected' as const }
        : s
    );
    setSuggestions(updated);
    onUpdateSuggestions(updated);
    showToast({ kind: 'info', title: t.rejected });
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');
  const hasResults = suggestions.length > 0;

  return (
    <details className="mb-4" data-testid="ai-broll-section">
      <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-slate-500">
        {t.title}
      </summary>
      <div className="space-y-2 p-1">
        {!available && (
          <p className="text-xs text-orange-500" data-testid="ai-broll-no-provider">{t.noProvider}</p>
        )}

        {!loading && !hasResults && (
          <div className="mb-2">
            <label className="block text-xs text-slate-600">{t.selectProvider}</label>
            <select
              className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm"
              value={selectedProvider?.id ?? ''}
              disabled
              data-testid="ai-broll-provider-select"
            >
              {providers.length === 0 && <option value="">{t.noProvider}</option>}
              {providers.filter((p) => p.enabled).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {!loading && !hasResults && (
          <button
            className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!available}
            onClick={() => void handleAnalyze()}
            data-testid="ai-broll-analyze"
          >
            <Sparkles size={14} className="mr-1 inline" />
            {t.analyze}
          </button>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-3 text-sm text-slate-500" data-testid="ai-broll-loading">
            <Loader2 size={16} className="animate-spin" />
            {t.analyzing}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600" data-testid="ai-broll-error">
            {error}
          </div>
        )}

        {hasResults && (
          <div className="space-y-2" data-testid="ai-broll-results">
            <div className="text-xs text-slate-500">{t.suggestionCount(pendingSuggestions.length)}</div>
            {suggestions.map((s, i) => {
              const media = allMedia.find((m) => m.id === s.mediaId);
              const isAccepted = s.status === 'accepted';
              const isRejected = s.status === 'rejected';
              return (
                <div
                  key={`${s.segmentId}-${s.mediaId}-${i}`}
                  className={`rounded-md border p-2 text-xs ${isAccepted ? 'border-green-300 bg-green-50' : isRejected ? 'border-slate-200 bg-slate-50 opacity-50' : 'border-brand/30 bg-brand/5'}`}
                  data-testid={`ai-broll-suggestion-${i}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{media?.name ?? s.mediaId}</span>
                    <span className="text-slate-500">{t.confidence}: {Math.round(s.confidence * 100)}%</span>
                  </div>
                  <div className="mt-0.5 text-slate-500">{t.reason}: {s.reason}</div>
                  {!isAccepted && !isRejected && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                        type="button"
                        onClick={() => handleInsert(s)}
                        data-testid={`ai-broll-insert-${i}`}
                      >
                        <Plus size={12} />
                        {t.insert}
                      </button>
                      <button
                        className="flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-xs text-slate-700 hover:bg-panel"
                        type="button"
                        onClick={() => handleReject(s)}
                        data-testid={`ai-broll-reject-${i}`}
                      >
                        <X size={12} />
                        {t.reject}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}

