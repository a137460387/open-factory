import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import type { Clip, SceneMatchResponse, SceneMatchResult } from '@open-factory/editor-core';
import {
  buildSceneMatchContext,
  buildSceneMatchMediaPayload,
  buildSceneMatchSystemPrompt,
  buildSceneMatchUserPrompt,
  parseSceneMatchResponse,
  buildSceneMatchDragParams,
  hasAvailableTextProvider
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey, convertLocalFileSrc } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';

const t = zhCN.inspector.aiSceneMatch;

const MEDIA_CARD_DRAG_MIME = 'application/x-open-factory-media-id';

interface SceneMatchCard extends SceneMatchResult {
  name: string;
  type: string;
  path?: string;
}

export function AISceneMatchPanel({
  clip,
  media,
  timelineClips,
  selectedClipLocked
}: {
  clip: Clip;
  media: Array<{ id: string; name: string; type: string; path?: string; duration?: number; width?: number; height?: number; aiAnalysis?: { tags?: string[]; scene?: string; mood?: string; objects?: string[] } }>;
  timelineClips: Array<{ id: string; start: number; mediaId?: string; aiAnalysis?: { tags?: string[]; scene?: string; mood?: string; objects?: string[] } }>;
  selectedClipLocked: boolean;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const available = hasAvailableTextProvider(providers);

  const [loading, setLoading] = useState(false);
  const [similar, setSimilar] = useState<SceneMatchCard[]>([]);
  const [contrast, setContrast] = useState<SceneMatchCard[]>([]);
  const [error, setError] = useState<string>();
  const abortRef = useRef(false);
  const prevClipIdRef = useRef<string>();

  // Clear results when clip changes
  useEffect(() => {
    if (prevClipIdRef.current !== clip.id) {
      setSimilar([]);
      setContrast([]);
      setError(undefined);
      prevClipIdRef.current = clip.id;
    }
  }, [clip.id]);

  const clipMedia = 'mediaId' in clip ? media.find((m) => m.id === (clip as { mediaId?: string }).mediaId) : undefined;
  const hasAnalysis = !!clipMedia?.aiAnalysis;

  const selectedProvider = providers.find((p) => p.enabled && hasAvailableTextProvider([p])) ?? providers[0];

  const mediaMap = useRef(new Map(media.map((m) => [m.id, m])));
  useEffect(() => {
    mediaMap.current = new Map(media.map((m) => [m.id, m]));
  }, [media]);

  const handleAnalyze = useCallback(async () => {
    if (!selectedProvider || !available) return;
    abortRef.current = false;
    setLoading(true);
    setError(undefined);

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) return;

      const context = buildSceneMatchContext(
        {
          id: clip.id,
          name: clip.name,
          type: clip.type,
          mediaId: 'mediaId' in clip ? (clip as { mediaId?: string }).mediaId : undefined,
          aiAnalysis: clipMedia?.aiAnalysis
        },
        timelineClips,
        media
      );

      const payload = buildSceneMatchMediaPayload(media);
      const systemPrompt = buildSceneMatchSystemPrompt();
      const userPrompt = buildSceneMatchUserPrompt(context, payload);

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
        showToast({ kind: 'error', title: t.failedTitle, message: 'AI返回格式无效' });
        setLoading(false);
        return;
      }

      const result: SceneMatchResponse = parseSceneMatchResponse(parsed);

      const toCard = (r: SceneMatchResult): SceneMatchCard => {
        const m = mediaMap.current.get(r.mediaId);
        return { ...r, name: m?.name ?? r.mediaId, type: m?.type ?? 'unknown', path: m?.path };
      };

      setSimilar(result.similar.map(toCard));
      setContrast(result.contrast.map(toCard));
    } catch (err) {
      if (!abortRef.current) {
        showToast({
          kind: 'error',
          title: t.failedTitle,
          message: err instanceof Error ? err.message : t.failedMessage
        });
        setError(err instanceof Error ? err.message : t.failedMessage);
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [selectedProvider, available, clip, clipMedia, timelineClips, media]);

  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  const renderCard = (card: SceneMatchCard) => {
    const thumbnailSrc = card.path ? convertLocalFileSrc(card.path) : undefined;
    return (
      <div
        key={card.mediaId}
        className="group flex items-start gap-2 rounded-md border border-brand/30 bg-brand/5 p-2 text-xs cursor-pointer hover:bg-brand/10"
        draggable
        onDragStart={(e) => {
          const m = mediaMap.current.get(card.mediaId);
          if (!m) return;
          const params = buildSceneMatchDragParams({
            id: m.id, name: m.name, type: m.type, path: m.path ?? '', duration: m.duration ?? 0, width: m.width ?? 0, height: m.height ?? 0
          });
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData(MEDIA_CARD_DRAG_MIME, params.mediaId);
        }}
        onClick={() => {
          // Trigger a custom event so the media bin can react
          window.dispatchEvent(new CustomEvent('open-factory:highlight-media', { detail: { mediaId: card.mediaId } }));
        }}
        title={`${t.clickToHighlight}\n${t.reasonLabel}: ${card.reason}`}
        data-testid={`ai-scene-match-card-${card.mediaId}`}
      >
        {thumbnailSrc && (
          <img src={thumbnailSrc} alt="" className="h-10 w-14 rounded object-cover shrink-0" loading="lazy" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-ink">{card.name}</div>
          <div className="mt-0.5 text-[var(--color-text-muted)] line-clamp-2">{card.reason}</div>
        </div>
        <span className="shrink-0 rounded bg-brand/20 px-1 py-0.5 text-[10px] text-brand">
          {Math.round(card.score * 100)}%
        </span>
      </div>
    );
  };

  const renderGroup = (title: string, cards: SceneMatchCard[], testId: string) => (
    <div className="space-y-1" data-testid={testId}>
      <div className="text-xs font-semibold text-[var(--color-text-secondary)]">{title}</div>
      {cards.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">{t.noResults}</p>
      ) : (
        <div className="space-y-1">
          {cards.map(renderCard)}
        </div>
      )}
    </div>
  );

  const hasResults = similar.length > 0 || contrast.length > 0;

  return (
    <details className="mb-4" data-testid="ai-scene-match-section">
      <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
        {t.title}
      </summary>
      <div className="space-y-2 p-1">
        {!available && (
          <p className="text-xs text-orange-500" data-testid="ai-scene-match-no-provider">{t.noProvider}</p>
        )}
        {!hasAnalysis && available && (
          <p className="text-xs text-amber-600" data-testid="ai-scene-match-no-analysis">{t.noAnalysis}</p>
        )}

        {!loading && !hasResults && (
          <div className="mb-2">
            <label className="block text-xs text-[var(--color-text-secondary)]">{t.selectProvider}</label>
            <select
              className="w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              value={selectedProvider?.id ?? ''}
              disabled
              data-testid="ai-scene-match-provider-select"
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
            className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!available || selectedClipLocked}
            onClick={() => void handleAnalyze()}
            data-testid="ai-scene-match-analyze"
          >
            <Sparkles size={14} className="mr-1 inline" />
            {t.analyze}
          </button>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-3 text-sm text-[var(--color-text-muted)]" data-testid="ai-scene-match-loading">
            <Loader2 size={16} className="animate-spin" />
            {t.analyzing}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600" data-testid="ai-scene-match-error">
            {error}
          </div>
        )}

        {hasResults && (
          <div className="space-y-3" data-testid="ai-scene-match-results">
            {renderGroup(t.similarTitle, similar, 'ai-scene-match-similar')}
            {renderGroup(t.contrastTitle, contrast, 'ai-scene-match-contrast')}
          </div>
        )}
      </div>
    </details>
  );
}
