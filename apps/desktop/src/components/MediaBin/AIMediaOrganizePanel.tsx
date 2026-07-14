import { useState, useCallback, useRef, useEffect } from 'react';
import { FolderPlus, Loader2, Sparkles, X } from 'lucide-react';
import { clsx } from 'clsx';
import {
  buildMediaTagPrompt,
  parseAIMediaOrganizeResponse,
  buildMediaCollectionsFromAI,
  mergeCollectionsWithExisting,
  filterAlreadyCategorizedMedia,
  hasAvailableTextProvider,
  type AIMediaOrganizeSuggestion,
  type MediaCollection,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';

const t = zhCN.aiOrganize;

interface OrganizeSuggestion {
  name: string;
  mediaIds: string[];
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface AIMediaOrganizePanelProps {
  media: Array<{ id: string; name: string; type: string; aiAnalysis?: { tags?: string[]; scene?: string } }>;
  existingCollections: MediaCollection[];
  onCollectionsUpdated: (collections: MediaCollection[]) => void;
  onClose: () => void;
}

export function AIMediaOrganizePanel({
  media,
  existingCollections,
  onCollectionsUpdated,
  onClose,
}: AIMediaOrganizePanelProps) {
  const providers = useAISettingsStore((s) => s.providers);
  const available = hasAvailableTextProvider(providers);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [suggestions, setSuggestions] = useState<OrganizeSuggestion[]>([]);
  const [executed, setExecuted] = useState(false);
  const abortRef = useRef(false);

  const executeOrganize = useCallback(async () => {
    if (!available) return;
    const selectedProvider = providers.find((p) => p.enabled && hasAvailableTextProvider([p])) ?? providers[0];
    if (!selectedProvider) return;

    abortRef.current = false;
    setLoading(true);
    setError(undefined);
    setSuggestions([]);
    setExecuted(true);

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) return;

      const filtered = filterAlreadyCategorizedMedia(media, existingCollections);
      if (filtered.length === 0) {
        setError(t.noMedia);
        setLoading(false);
        return;
      }

      const payload = buildMediaTagPrompt(filtered);
      if (!payload) {
        setError(t.noMedia);
        setLoading(false);
        return;
      }

      const systemPrompt =
        'You are a media organizer. Given a list of media with tags and scene info, suggest meaningful collections. Return JSON: {"collections":[{"name":"string","mediaIds":["id"],"reason":"string"}]}';
      const userPrompt = `Organize the following media into collections:\n\n${payload}`;

      const response = await callAiApi(
        {
          providerId: selectedProvider.id,
          baseUrl: selectedProvider.baseUrl,
          model: selectedProvider.defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          timeoutSecs: 60,
        },
        apiKey,
      );

      if (abortRef.current) return;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(response.content);
      } catch {
        setError('AI返回格式无效');
        setLoading(false);
        return;
      }

      const result = parseAIMediaOrganizeResponse(parsed);
      const organizeSuggestions: OrganizeSuggestion[] = result.collections.map((c) => ({
        ...c,
        status: 'pending' as const,
      }));
      setSuggestions(organizeSuggestions);
    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : '分析失败');
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [available, providers, media, existingCollections]);

  const handleAccept = useCallback((index: number) => {
    setSuggestions((prev) => prev.map((s, i) => (i === index ? { ...s, status: 'accepted' } : s)));
  }, []);

  const handleReject = useCallback((index: number) => {
    setSuggestions((prev) => prev.map((s, i) => (i === index ? { ...s, status: 'rejected' } : s)));
  }, []);

  const handleApplyAll = useCallback(() => {
    setSuggestions((prev) => prev.map((s) => ({ ...s, status: 'accepted' })));
  }, []);

  const handleApplyChanges = useCallback(() => {
    const accepted = suggestions
      .filter((s) => s.status === 'accepted')
      .map((s) => ({
        name: s.name,
        mediaIds: s.mediaIds,
        reason: s.reason,
      }));
    if (accepted.length === 0) return;
    const aiCollections = buildMediaCollectionsFromAI(accepted, existingCollections);
    const merged = mergeCollectionsWithExisting(aiCollections, existingCollections);
    onCollectionsUpdated(merged);
    onClose();
  }, [suggestions, existingCollections, onCollectionsUpdated, onClose]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  const acceptedCount = suggestions.filter((s) => s.status === 'accepted').length;
  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;

  return (
    <div className="space-y-2 rounded-md border border-brand/30 bg-brand/5 p-3" data-testid="media-organize-panel">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <FolderPlus size={14} className="text-brand" />
          {t.title}
        </h3>
        <button
          type="button"
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-secondary)]"
          onClick={onClose}
          data-testid="media-organize-close"
        >
          <X size={14} />
        </button>
      </div>

      {!available && (
        <p className="text-xs text-orange-500" data-testid="media-organize-no-provider">
          未配置AI文本模型。
        </p>
      )}

      {!executed && available && (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:brightness-95"
          onClick={executeOrganize}
          data-testid="media-organize-button"
        >
          <Sparkles size={14} />
          {t.button}
        </button>
      )}

      {loading && (
        <div
          className="flex items-center gap-2 py-4 text-sm text-[var(--color-text-muted)]"
          data-testid="media-organize-loading"
        >
          <Loader2 size={16} className="animate-spin" />
          {t.analyzing}
        </div>
      )}

      {error && (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600"
          data-testid="media-organize-error"
        >
          {error}
        </div>
      )}

      {!loading && !error && executed && suggestions.length === 0 && (
        <p className="py-2 text-center text-xs text-[var(--color-text-muted)]" data-testid="media-organize-empty">
          {t.empty}
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2" data-testid="media-organize-suggestions">
          <p className="text-xs text-[var(--color-text-muted)]">
            {suggestions.length} 个建议 ({acceptedCount} 已采纳, {pendingCount} 待处理)
          </p>
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.name}-${index}`}
              className={clsx(
                'rounded-md border p-2',
                suggestion.status === 'accepted' && 'border-green-300 bg-green-50',
                suggestion.status === 'rejected' &&
                  'border-[var(--color-border)] bg-[var(--color-bg-secondary)] opacity-50',
                suggestion.status === 'pending' && 'border-brand/20 bg-[var(--color-bg-elevated)]',
              )}
              data-testid={`media-organize-suggestion-${index}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <FolderPlus
                      size={12}
                      className={suggestion.status === 'accepted' ? 'text-green-600' : 'text-brand'}
                    />
                    <span className="text-xs font-semibold text-ink">{suggestion.name}</span>
                    <span className="rounded bg-[var(--color-bg-elevated)] px-1 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                      {suggestion.mediaIds.length} 素材
                    </span>
                  </div>
                  {suggestion.reason && (
                    <p
                      className="mt-0.5 text-[11px] text-[var(--color-text-muted)]"
                      data-testid={`media-organize-reason-${index}`}
                    >
                      {suggestion.reason}
                    </p>
                  )}
                </div>
                {suggestion.status === 'pending' && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 hover:bg-green-200"
                      onClick={() => handleAccept(index)}
                      data-testid={`media-organize-accept-${index}`}
                    >
                      {t.accept}
                    </button>
                    <button
                      type="button"
                      className="rounded bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                      onClick={() => handleReject(index)}
                      data-testid={`media-organize-reject-${index}`}
                    >
                      {t.reject}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            {pendingCount > 0 && (
              <button
                type="button"
                className="rounded-md bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20"
                onClick={handleApplyAll}
                data-testid="media-organize-apply-all"
              >
                {t.applyAll}
              </button>
            )}
            {acceptedCount > 0 && (
              <button
                type="button"
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95"
                onClick={handleApplyChanges}
                data-testid="media-organize-apply-changes"
              >
                {t.applied(acceptedCount)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
