import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import type { Clip, SubtitleStyleTemplate } from '@open-factory/editor-core';
import {
  buildSubtitleStyleVideoContext,
  filterPortraitStyles,
  buildSubtitleStyleSystemPrompt,
  buildSubtitleStyleUserPrompt,
  parseSubtitleStyleResponse,
  hasAvailableTextProvider,
  getBuiltinSubtitleStyleTemplate,
  renderSubtitleStyleTemplatePreview,
  UpdateSubtitleStyleCommand
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { showToast } from '../../lib/toast';

const t = zhCN.inspector.aiSubtitleStyle;

function makeSvgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface StyleRecommendationCard {
  templateId: string;
  reason: string;
  confidence: number;
  template: SubtitleStyleTemplate;
}

export function AISubtitleStylePanel({
  clip,
  media,
  subtitleTrack,
  selectedClipLocked
}: {
  clip: Clip;
  media: Array<{ id: string; name: string; type: string; path?: string; duration?: number; width?: number; height?: number; aiAnalysis?: { tags?: string[]; scene?: string; mood?: string; objects?: string[] } }>;
  subtitleTrack?: { id: string; type: string; clips: Array<{ id: string; type: string; trackId: string }> };
  selectedClipLocked: boolean;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const available = hasAvailableTextProvider(providers);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StyleRecommendationCard[]>([]);
  const [error, setError] = useState<string>();
  const abortRef = useRef(false);
  const prevClipIdRef = useRef<string>();

  useEffect(() => {
    if (prevClipIdRef.current !== clip.id) {
      setResults([]);
      setError(undefined);
      prevClipIdRef.current = clip.id;
    }
  }, [clip.id]);

  const selectedProvider = providers.find((p) => p.enabled && hasAvailableTextProvider([p])) ?? providers[0];

  const firstVideoMedia = media.find((m) => m.type === 'video');

  const handleAnalyze = useCallback(async () => {
    if (!selectedProvider || !available) return;
    abortRef.current = false;
    setLoading(true);
    setError(undefined);

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) return;

      const context = buildSubtitleStyleVideoContext(firstVideoMedia);
      const systemPrompt = buildSubtitleStyleSystemPrompt();
      const userPrompt = buildSubtitleStyleUserPrompt(context);

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

      const aiResult = parseSubtitleStyleResponse(parsed);
      const filtered = filterPortraitStyles(aiResult.recommended, context.isPortrait);

      const cards: StyleRecommendationCard[] = filtered
        .map((r) => {
          const template = getBuiltinSubtitleStyleTemplate(r.templateId);
          if (!template) return null;
          return { ...r, template };
        })
        .filter((c): c is StyleRecommendationCard => c !== null);

      setResults(cards);
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
  }, [selectedProvider, available, firstVideoMedia]);

  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  const handleApplyToTrack = useCallback((template: SubtitleStyleTemplate) => {
    if (!subtitleTrack) return;
    try {
      for (const subClip of subtitleTrack.clips) {
        if (subClip.type === 'subtitle') {
          commandManager.execute(new UpdateSubtitleStyleCommand(timelineAccessor, subClip.id, template.style));
        }
      }
      showToast({ kind: 'success', title: t.applied, message: template.name });
    } catch (err) {
      showToast({ kind: 'error', title: t.failedTitle, message: err instanceof Error ? err.message : t.failedMessage });
    }
  }, [subtitleTrack]);

  return (
    <details className="mb-4" data-testid="ai-subtitle-style-section">
      <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
        {t.title}
      </summary>
      <div className="space-y-2 p-1">
        {!available && (
          <p className="text-xs text-orange-500" data-testid="ai-subtitle-style-no-provider">{t.noProvider}</p>
        )}

        {!loading && results.length === 0 && (
          <div className="mb-2">
            <label className="block text-xs text-[var(--color-text-secondary)]">{t.selectProvider}</label>
            <select
              className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm"
              value={selectedProvider?.id ?? ''}
              disabled
              data-testid="ai-subtitle-style-provider-select"
            >
              {providers.length === 0 && <option value="">{t.noProvider}</option>}
              {providers.filter((p) => p.enabled).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {!loading && results.length === 0 && (
          <button
            className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!available || selectedClipLocked || !subtitleTrack}
            onClick={() => void handleAnalyze()}
            data-testid="ai-subtitle-style-analyze"
          >
            <Sparkles size={14} className="mr-1 inline" />
            {t.analyze}
          </button>
        )}

        {!subtitleTrack && !loading && results.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)]" data-testid="ai-subtitle-style-no-track">{t.noSubtitleTrack}</p>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-3 text-sm text-[var(--color-text-muted)]" data-testid="ai-subtitle-style-loading">
            <Loader2 size={16} className="animate-spin" />
            {t.analyzing}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600" data-testid="ai-subtitle-style-error">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2" data-testid="ai-subtitle-style-results">
            {results.map((card) => (
              <div
                key={card.templateId}
                className="group cursor-pointer rounded-md border border-brand/30 bg-brand/5 p-2 text-xs hover:bg-brand/10"
                onClick={() => handleApplyToTrack(card.template)}
                title={`${t.reason}: ${card.reason}`}
                data-testid={`ai-subtitle-style-card-${card.templateId}`}
              >
                <div className="flex items-start gap-2">
                  <img
                    className="h-10 w-24 shrink-0 rounded object-cover"
                    src={makeSvgDataUri(renderSubtitleStyleTemplatePreview(card.template))}
                    alt={card.template.name}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate font-medium text-ink">{card.template.name}</span>
                      <span className="shrink-0 rounded bg-brand/20 px-1 py-0.5 text-[10px] text-brand">
                        {Math.round(card.confidence * 100)}%
                      </span>
                    </div>
                    <div className="mt-0.5 text-[var(--color-text-muted)] line-clamp-2">{card.reason}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
