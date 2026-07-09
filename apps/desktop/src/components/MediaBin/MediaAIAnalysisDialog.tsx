import { useState, useCallback, useRef } from 'react';
import { useSafeTimeout } from '../../hooks/useSafeTimeout';
import type { MediaAsset, MediaAIAnalysis } from '@open-factory/editor-core';
import {
  isVisionCapable,
  isProviderConfigured,
  calculateExtractFrameTimes,
  estimateVisionCost,
  parseVisionAnalysisResponse,
  mergeAITags
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { useEditorStore } from '../../store/editorStore';
import { callAiApi, readAiApiKey, extractAiFrames } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';

const t = zhCN.inspector.aiContentAnalysis;

type AnalysisPhase = 'idle' | 'extracting' | 'analyzing' | 'preview' | 'done';

export function MediaAIAnalysisDialog({
  asset,
  onClose
}: {
  asset: MediaAsset;
  onClose(): void;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const serviceMapping = useAISettingsStore((s) => s.serviceMapping);
  const safeTimeout = useSafeTimeout();
  const visionProviders = providers.filter(
    (p) => p.enabled && isProviderConfigured(p) && isVisionCapable(p.defaultModel)
  );
  const defaultProviderId = serviceMapping['vision-analysis'] ?? '';
  const defaultProvider = visionProviders.find((p) => p.id === defaultProviderId) ?? visionProviders[0];

  const [selectedProviderId, setSelectedProviderId] = useState<string>(defaultProvider?.id ?? '');
  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<MediaAIAnalysis | null>(null);
  const abortRef = useRef(false);

  const selectedProvider = visionProviders.find((p) => p.id === selectedProviderId) ?? defaultProvider;

  const duration = asset.duration ?? 0;
  const frameTimes = calculateExtractFrameTimes(duration);
  const costEstimate = selectedProvider
    ? estimateVisionCost(frameTimes.length, selectedProvider.defaultModel)
    : { tokens: 0, costCny: 0 };

  const startAnalysis = useCallback(async () => {
    if (!selectedProvider) return;

    abortRef.current = false;
    setPhase('extracting');
    setProgress({ done: 0, total: frameTimes.length + 1 });

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) { setPhase('idle'); return; }

      const { frames } = await extractAiFrames({ sourcePath: asset.path, times: frameTimes });
      if (abortRef.current) { setPhase('idle'); return; }

      setPhase('analyzing');
      setProgress({ done: frameTimes.length, total: frameTimes.length + 1 });

      const imageContent = frames.map((b64) => ({
        type: 'image_url' as const,
        image_url: { url: `data:image/jpeg;base64,${b64}` }
      }));

      const messages = [
        {
          role: 'system' as const,
          content: '你是一个视频内容分析助手。用户会给你一段视频的截帧。请分析这些画面并返回JSON格式：{"tags": ["标签1","标签2"], "scene": "场景描述", "mood": "氛围描述", "objects": ["物体1","物体2"]}。标签不超过10个，场景和氛围各一句话。只返回JSON，不要其他内容。'
        },
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: `分析这段视频的内容，文件名：${asset.name}` },
            ...imageContent
          ]
        }
      ];

      const response = await callAiApi(
        {
          providerId: selectedProvider.id,
          baseUrl: selectedProvider.baseUrl,
          model: selectedProvider.defaultModel,
          messages,
          customHeaders: selectedProvider.customHeaders,
          maxTokens: 2048,
          temperature: 0.3,
          timeoutSecs: 60
        },
        apiKey
      );

      if (abortRef.current) { setPhase('idle'); return; }

      const parsed = parseVisionAnalysisResponse(JSON.parse(response.content));
      const analysis: MediaAIAnalysis = {
        ...parsed,
        tags: mergeAITags([], parsed.tags),
        analysisTime: new Date().toISOString(),
        providerId: selectedProvider.id
      };

      setResult(analysis);
      setPhase('preview');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage
      });
      setPhase('idle');
    }
  }, [selectedProvider, asset.path, asset.name, frameTimes]);

  const cancelAnalysis = useCallback(() => {
    abortRef.current = true;
    setPhase('idle');
  }, []);

  const applyResult = useCallback(() => {
    if (!result) return;

    const setMedia = useEditorStore.getState().setMedia;
    const currentMedia = useEditorStore.getState().project.media;
    setMedia(
      currentMedia.map((item) =>
        item.id === asset.id ? { ...item, aiAnalysis: result } : item
      )
    );

    showToast({ kind: 'success', title: t.appliedTitle, message: t.appliedMessage });
    setPhase('done');
    safeTimeout(() => onClose(), 300);
  }, [result, asset.id, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="ai-content-analysis-dialog"
    >
      <div className="w-[460px] max-h-[80vh] overflow-y-auto rounded-lg border border-line bg-[var(--color-bg-elevated)] p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <button
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-panel hover:text-[var(--color-text-secondary)]"
            type="button"
            onClick={onClose}
            data-testid="ai-content-analysis-close"
          >
            x
          </button>
        </div>

        <div className="mb-3 text-xs text-[var(--color-text-muted)] truncate" title={asset.name}>{asset.name}</div>

        {phase === 'idle' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs text-[var(--color-text-secondary)]">{t.selectProvider}</label>
              <select
                className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm"
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                disabled={visionProviders.length === 0}
                data-testid="ai-content-analysis-provider-select"
              >
                {visionProviders.length === 0 && <option value="">{t.noProvider}</option>}
                {visionProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-[var(--color-text-muted)]" data-testid="ai-content-analysis-cost">
              {t.costPreview(costEstimate.tokens, costEstimate.costCny)}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              抽帧: {frameTimes.length} 帧 ({frameTimes.map((t) => `${t.toFixed(1)}s`).join(', ')})
            </div>
            <button
              className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!selectedProvider}
              onClick={() => void startAnalysis()}
              data-testid="ai-content-analysis-start"
            >
              {t.analyze}
            </button>
          </div>
        )}

        {(phase === 'extracting' || phase === 'analyzing') && (
          <div className="space-y-2">
            <div className="text-xs text-[var(--color-text-secondary)]" data-testid="ai-content-analysis-progress">
              {phase === 'extracting' ? t.extractingFrames : t.analyzing}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
              <div
                className="h-full bg-[var(--color-accent)] transition-all"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <button
              className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              onClick={cancelAnalysis}
              data-testid="ai-content-analysis-cancel"
            >
              取消
            </button>
          </div>
        )}

        {phase === 'preview' && result && (
          <div className="space-y-3" data-testid="ai-content-analysis-results">
            <div className="text-xs font-semibold text-[var(--color-text-secondary)]">{t.resultsTitle}</div>

            {result.tags.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-[var(--color-text-secondary)]">{t.tags}</div>
                <div className="flex flex-wrap gap-1">
                  {result.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-block rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--color-accent)]"
                      data-testid={`ai-tag-${i}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.scene && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-[var(--color-text-secondary)]">{t.scene}</div>
                <div className="text-xs text-ink">{result.scene}</div>
              </div>
            )}

            {result.mood && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-[var(--color-text-secondary)]">{t.mood}</div>
                <div className="text-xs text-ink">{result.mood}</div>
              </div>
            )}

            {result.objects.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-[var(--color-text-secondary)]">{t.objects}</div>
                <div className="text-xs text-ink">{result.objects.join(', ')}</div>
              </div>
            )}

            <button
              className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)]"
              type="button"
              onClick={applyResult}
              data-testid="ai-content-analysis-apply"
            >
              {t.apply}
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-xs text-emerald-600 text-center py-4" data-testid="ai-content-analysis-done">
            {t.appliedTitle}
          </div>
        )}
      </div>
    </div>
  );
}
