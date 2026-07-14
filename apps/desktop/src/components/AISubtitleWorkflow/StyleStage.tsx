import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Loader2, Sparkles, SkipForward } from 'lucide-react';
import type { SubtitleStyleTemplate, MediaAsset } from '@open-factory/editor-core';
import {
  buildSubtitleStyleVideoContext,
  buildSubtitleStyleSystemPrompt,
  buildSubtitleStyleUserPrompt,
  parseSubtitleStyleResponse,
  filterPortraitStyles,
  hasAvailableTextProvider,
  getBuiltinSubtitleStyleTemplate,
  renderSubtitleStyleTemplatePreview,
  UpdateSubtitleStyleCommand,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { useEditorStore } from '../../store/editorStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { showToast } from '../../lib/toast';
import type { StyleState } from './useSubtitleWorkflow';

const t = zhCN.aiSubtitleWorkflow.style;

function makeSvgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface StyleRecommendationCard {
  templateId: string;
  reason: string;
  confidence: number;
  template: SubtitleStyleTemplate;
}

interface StyleStageProps {
  styleState: StyleState;
  onUpdate: (patch: Partial<StyleState>) => void;
  onComplete: (templateId: string) => void;
  media: MediaAsset[];
}

export function StyleStage({ styleState, onUpdate, onComplete, media }: StyleStageProps) {
  const providers = useAISettingsStore((s) => s.providers);
  const project = useEditorStore((s) => s.project);
  const timeline = project.timeline;

  const available = useMemo(() => hasAvailableTextProvider(providers), [providers]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.enabled && hasAvailableTextProvider([p])) ?? providers[0],
    [providers],
  );

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StyleRecommendationCard[]>([]);
  const abortRef = useRef(false);

  const firstVideoMedia = useMemo(() => media.find((m) => m.type === 'video'), [media]);

  const subtitleTracks = useMemo(() => timeline.tracks.filter((track) => track.type === 'subtitle'), [timeline]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  const handleRecommend = useCallback(async () => {
    if (!selectedProvider || !available) return;
    abortRef.current = false;
    setLoading(true);
    onUpdate({ status: 'running', error: null });

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) return;

      const context = buildSubtitleStyleVideoContext(firstVideoMedia);
      const systemPrompt = buildSubtitleStyleSystemPrompt();
      const userPrompt = buildSubtitleStyleUserPrompt(context);

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
          timeoutSecs: 30,
        },
        apiKey,
      );

      if (abortRef.current) return;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(response.content);
      } catch {
        showToast({ kind: 'error', title: t.failedTitle, message: 'AI返回格式无效' });
        onUpdate({ status: 'error', error: 'AI返回格式无效' });
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

      if (cards.length > 0) {
        onUpdate({ recommendedTemplateId: cards[0].templateId, confidence: cards[0].confidence });
      } else {
        onUpdate({ status: 'idle' });
      }
    } catch (err) {
      if (!abortRef.current) {
        const message = err instanceof Error ? err.message : t.failedMessage;
        showToast({ kind: 'error', title: t.failedTitle, message });
        onUpdate({ status: 'error', error: message });
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [selectedProvider, available, firstVideoMedia, onUpdate]);

  const handleApplyStyle = useCallback(
    (template: SubtitleStyleTemplate) => {
      try {
        for (const track of subtitleTracks) {
          for (const clip of track.clips) {
            if (clip.type === 'subtitle') {
              commandManager.execute(new UpdateSubtitleStyleCommand(timelineAccessor, clip.id, template.style));
            }
          }
        }
        onUpdate({ appliedTemplateId: template.id });
        showToast({ kind: 'success', title: t.styleApplied, message: template.name });
        onComplete(template.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : t.failedMessage;
        showToast({ kind: 'error', title: t.failedTitle, message });
        onUpdate({ status: 'error', error: message });
      }
    },
    [subtitleTracks, onUpdate, onComplete],
  );

  const handleSkip = useCallback(() => {
    onComplete('skipped');
  }, [onComplete]);

  return (
    <div className="space-y-3" data-testid="subtitle-workflow-style-stage">
      <div className="text-xs text-[var(--color-text-secondary)]">{zhCN.aiSubtitleWorkflow.stages.style}</div>

      {!available && (
        <p className="text-xs text-orange-500" data-testid="subtitle-workflow-style-no-provider">
          未配置AI服务商
        </p>
      )}

      {!loading && results.length === 0 && (
        <div className="space-y-2">
          <label className="block text-xs text-[var(--color-text-secondary)]">选择服务商</label>
          <select
            className="w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
            value={selectedProvider?.id ?? ''}
            disabled
            data-testid="subtitle-workflow-style-provider-select"
          >
            {providers.length === 0 && <option value="">未配置服务商</option>}
            {providers
              .filter((p) => p.enabled)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button
            className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!available}
            onClick={() => void handleRecommend()}
            data-testid="subtitle-workflow-style-recommend"
          >
            <Sparkles size={14} className="mr-1 inline" />
            {t.recommendStyles}
          </button>
          <button
            className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium hover:bg-panel"
            type="button"
            onClick={handleSkip}
            data-testid="subtitle-workflow-style-skip"
          >
            <SkipForward size={14} className="mr-1 inline" />
            {t.skipStyle}
          </button>
        </div>
      )}

      {loading && (
        <div
          className="flex items-center gap-2 py-3 text-sm text-[var(--color-text-muted)]"
          data-testid="subtitle-workflow-style-loading"
        >
          <Loader2 size={16} className="animate-spin" />
          {t.analyzing}
        </div>
      )}

      {styleState.status === 'error' && styleState.error && !loading && (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600"
          data-testid="subtitle-workflow-style-error"
        >
          {styleState.error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2" data-testid="subtitle-workflow-style-results">
          {results.map((card) => (
            <div
              key={card.templateId}
              className="rounded-md border border-brand/30 bg-brand/5 p-2 text-xs hover:bg-brand/10"
              data-testid={`subtitle-workflow-style-card-${card.templateId}`}
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
              <button
                className="mt-2 w-full rounded-md bg-[var(--color-accent)] px-2 py-1 text-xs font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => handleApplyStyle(card.template)}
                data-testid={`subtitle-workflow-style-apply-${card.templateId}`}
              >
                {t.applyStyle}
              </button>
            </div>
          ))}
          <button
            className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium hover:bg-panel"
            type="button"
            onClick={handleSkip}
            data-testid="subtitle-workflow-style-skip-after-results"
          >
            <SkipForward size={14} className="mr-1 inline" />
            {t.skipStyle}
          </button>
        </div>
      )}
    </div>
  );
}
