import { useState, useCallback, useRef } from 'react';
import type { Clip, AIProvider } from '@open-factory/editor-core';
import {
  calculateSubtitlePolishBatchSplit,
  parseSubtitlePolishResponse,
  removeFillerWords,
  isProviderConfigured
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { BatchUpdateSubtitleTextCommand } from '@open-factory/editor-core';
import { showToast } from '../../lib/toast';

const t = zhCN.inspector.subtitleAIPolish;

interface PolishedItem {
  clipId: string;
  index: number;
  originalText: string;
  polishedText: string;
  accepted: boolean;
}

type PolishPhase = 'idle' | 'processing' | 'preview' | 'applying';

export function SubtitleAIPolishPanel({
  selectedSubtitleClips,
  selectedClipLocked
}: {
  selectedSubtitleClips: Array<Extract<Clip, { type: 'subtitle' }>>;
  selectedClipLocked: boolean;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const serviceMapping = useAISettingsStore((s) => s.serviceMapping);
  const enabledProviders = providers.filter((p) => p.enabled && isProviderConfigured(p));
  const defaultProviderId = serviceMapping['subtitle-polish'] ?? '';
  const defaultProvider = enabledProviders.find((p) => p.id === defaultProviderId) ?? enabledProviders[0];

  const [selectedProviderId, setSelectedProviderId] = useState<string>(defaultProvider?.id ?? '');
  const [removeFillers, setRemoveFillers] = useState(false);
  const [phase, setPhase] = useState<PolishPhase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [polishedItems, setPolishedItems] = useState<PolishedItem[]>([]);
  const abortRef = useRef(false);

  const selectedProvider = enabledProviders.find((p) => p.id === selectedProviderId) ?? defaultProvider;

  const startPolish = useCallback(async () => {
    if (!selectedProvider || selectedSubtitleClips.length === 0) return;

    abortRef.current = false;
    setPhase('processing');
    setProgress({ done: 0, total: selectedSubtitleClips.length });

    const items = selectedSubtitleClips.map((clip, index) => ({
      clipId: clip.id,
      index,
      text: removeFillers ? removeFillerWords(clip.text) : clip.text
    }));
    const batches = calculateSubtitlePolishBatchSplit(items.length, 50);
    const results: PolishedItem[] = [];
    let offset = 0;

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) { setPhase('idle'); return; }

      for (const batchSize of batches) {
        const batch = items.slice(offset, offset + batchSize);
        const messages = [
          {
            role: 'system' as const,
            content: '你是一个专业的字幕编辑助手。用户会给你一段JSON数组，每个元素有index和text字段。请修正错别字、标点符号错误、优化断句（每条不超过20字），返回相同格式的JSON数组。只返回JSON数组，不要其他内容。'
          },
          {
            role: 'user' as const,
            content: JSON.stringify(batch.map((b) => ({ index: b.index, text: b.text })))
          }
        ];

        const response = await callAiApi(
          {
            providerId: selectedProvider.id,
            baseUrl: selectedProvider.baseUrl,
            model: selectedProvider.defaultModel,
            messages,
            customHeaders: selectedProvider.customHeaders,
            maxTokens: 4096,
            temperature: 0.3
          },
          apiKey
        );

        if (abortRef.current) { setPhase('idle'); return; }

        const parsed = parseSubtitlePolishResponse(JSON.parse(response.content));
        for (const item of parsed) {
          const original = batch[item.index - offset];
          if (original && item.text !== original.text) {
            results.push({
              clipId: original.clipId,
              index: original.index,
              originalText: original.text,
              polishedText: item.text,
              accepted: true
            });
          }
        }

        offset += batchSize;
        setProgress({ done: offset, total: items.length });
      }

      if (results.length === 0) {
        showToast({ kind: 'info', title: t.noChanges });
        setPhase('idle');
        return;
      }

      setPolishedItems(results);
      setPhase('preview');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage
      });
      setPhase('idle');
    }
  }, [selectedProvider, selectedSubtitleClips, removeFillers]);

  const cancelPolish = useCallback(() => {
    abortRef.current = true;
    setPhase('idle');
    showToast({ kind: 'info', title: t.cancelledTitle, message: t.cancelledMessage });
  }, []);

  const toggleItem = useCallback((clipId: string) => {
    setPolishedItems((prev) =>
      prev.map((item) => (item.clipId === clipId ? { ...item, accepted: !item.accepted } : item))
    );
  }, []);

  const acceptAll = useCallback(() => {
    setPolishedItems((prev) => prev.map((item) => ({ ...item, accepted: true })));
  }, []);

  const rejectAll = useCallback(() => {
    setPolishedItems((prev) => prev.map((item) => ({ ...item, accepted: false })));
  }, []);

  const applyAccepted = useCallback(() => {
    const accepted = polishedItems.filter((item) => item.accepted);
    if (accepted.length === 0) {
      setPhase('idle');
      setPolishedItems([]);
      return;
    }
    try {
      commandManager.execute(
        new BatchUpdateSubtitleTextCommand(
          timelineAccessor,
          accepted.map((item) => ({ clipId: item.clipId, text: item.polishedText }))
        )
      );
      showToast({
        kind: 'success',
        title: t.appliedTitle,
        message: t.appliedMessage(accepted.length)
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage
      });
    }
    setPhase('idle');
    setPolishedItems([]);
  }, [polishedItems]);

  if (selectedSubtitleClips.length === 0) {
    return null;
  }

  return (
    <details className="rounded-md border border-line bg-[var(--color-bg-elevated)]" data-testid="subtitle-ai-polish-section">
      <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{t.title}</summary>
      <div className="space-y-3 border-t border-line p-2">
        {phase === 'idle' && (
          <>
            <div className="space-y-2">
              <label className="block text-xs text-[var(--color-text-secondary)]">{t.selectProvider}</label>
              <select
                className="w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                disabled={enabledProviders.length === 0}
                data-testid="subtitle-ai-polish-provider-select"
              >
                {enabledProviders.length === 0 && <option value="">{t.noProvider}</option>}
                {enabledProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={removeFillers}
                onChange={(e) => setRemoveFillers(e.target.checked)}
                data-testid="subtitle-ai-polish-remove-fillers"
              />
              {t.removeFillers}
            </label>
            <button
              className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!selectedProvider || selectedClipLocked}
              onClick={() => void startPolish()}
              data-testid="subtitle-ai-polish-start-button"
            >
              {t.startPolish}
            </button>
          </>
        )}
        {phase === 'processing' && (
          <div className="space-y-2">
            <div className="text-xs text-[var(--color-text-secondary)]" data-testid="subtitle-ai-polish-progress">
              {t.processing(progress.done, progress.total)}
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
              onClick={cancelPolish}
              data-testid="subtitle-ai-polish-cancel-button"
            >
              {t.cancelPolish}
            </button>
          </div>
        )}
        {phase === 'preview' && (
          <div className="space-y-2" data-testid="subtitle-ai-polish-preview">
            <div className="text-xs font-semibold text-[var(--color-text-secondary)]">{t.previewTitle}</div>
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {polishedItems.map((item) => (
                <div
                  key={item.clipId}
                  className="rounded-md border border-line p-2 text-xs"
                  data-testid={`subtitle-ai-polish-item-${item.clipId}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[var(--color-text-muted)] line-through">{item.originalText}</div>
                      <div className="mt-0.5 font-medium text-ink">{item.polishedText}</div>
                    </div>
                    <button
                      className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${
                        item.accepted
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                      type="button"
                      onClick={() => toggleItem(item.clipId)}
                      data-testid={`subtitle-ai-polish-toggle-${item.clipId}`}
                    >
                      {item.accepted ? t.accept : t.reject}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-medium hover:bg-panel"
                type="button"
                onClick={acceptAll}
                data-testid="subtitle-ai-polish-accept-all"
              >
                {t.acceptAll}
              </button>
              <button
                className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-medium hover:bg-panel"
                type="button"
                onClick={rejectAll}
                data-testid="subtitle-ai-polish-reject-all"
              >
                {t.rejectAll}
              </button>
            </div>
            <button
              className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)]"
              type="button"
              onClick={applyAccepted}
              data-testid="subtitle-ai-polish-apply"
            >
              {t.applyAccepted}
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
