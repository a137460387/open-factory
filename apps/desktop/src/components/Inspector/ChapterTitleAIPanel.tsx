import { useState, useCallback, useRef, useMemo } from 'react';
import type { Clip, AIChapterResult } from '@open-factory/editor-core';
import {
  splitChapterSegments,
  suggestChapterCount,
  parseChapterResponse,
  formatChaptersYouTube,
  formatChaptersBilibili,
  isProviderConfigured,
  BatchAddMarkersCommand
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { showToast } from '../../lib/toast';

const t = zhCN.inspector.chapterTitleAI;

type ChapterPhase = 'idle' | 'processing' | 'preview' | 'applying';

export function ChapterTitleAIPanel({
  allSubtitleClips,
  totalDuration,
  selectedClipLocked
}: {
  allSubtitleClips: Array<Extract<Clip, { type: 'subtitle' }>>;
  totalDuration: number;
  selectedClipLocked: boolean;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const serviceMapping = useAISettingsStore((s) => s.serviceMapping);
  const enabledProviders = providers.filter((p) => p.enabled && isProviderConfigured(p));
  const defaultProviderId = serviceMapping['chapter-title'] ?? '';
  const defaultProvider = enabledProviders.find((p) => p.id === defaultProviderId) ?? enabledProviders[0];

  const [selectedProviderId, setSelectedProviderId] = useState<string>(defaultProvider?.id ?? '');
  const [phase, setPhase] = useState<ChapterPhase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [chapters, setChapters] = useState<AIChapterResult[]>([]);
  const abortRef = useRef(false);

  const selectedProvider = enabledProviders.find((p) => p.id === selectedProviderId) ?? defaultProvider;

  const chapterSuggestion = useMemo(() => suggestChapterCount(totalDuration), [totalDuration]);

  const hasSubtitles = allSubtitleClips.length > 0;

  const startGenerate = useCallback(async () => {
    if (!selectedProvider || !hasSubtitles || totalDuration <= 0) return;

    abortRef.current = false;
    setPhase('processing');

    const segments = splitChapterSegments(totalDuration);
    setProgress({ done: 0, total: segments.length });

    const sortedSubtitles = [...allSubtitleClips].sort((a, b) => a.start - b.start);

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) { setPhase('idle'); return; }

      const allChapters: AIChapterResult[] = [];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segmentText = sortedSubtitles
          .filter((s) => s.start < seg.end && s.start + s.duration > seg.start)
          .map((s) => s.text)
          .join(' ');

        if (!segmentText.trim()) {
          setProgress({ done: i + 1, total: segments.length });
          continue;
        }

        const messages = [
          {
            role: 'system' as const,
            content: '你是一个视频章节标题助手。用户会给你一段视频的字幕文本和时间范围。请为这段内容生成一个简洁的章节标题（不超过15个字）。返回JSON格式：[{"time": 秒数, "title": "标题"}]。只返回JSON数组，不要其他内容。'
          },
          {
            role: 'user' as const,
            content: JSON.stringify({
              startTime: seg.start,
              endTime: seg.end,
              text: segmentText
            })
          }
        ];

        const response = await callAiApi(
          {
            providerId: selectedProvider.id,
            baseUrl: selectedProvider.baseUrl,
            model: selectedProvider.defaultModel,
            messages,
            customHeaders: selectedProvider.customHeaders,
            maxTokens: 1024,
            temperature: 0.3
          },
          apiKey
        );

        if (abortRef.current) { setPhase('idle'); return; }

        const parsed = parseChapterResponse(JSON.parse(response.content));
        allChapters.push(...parsed);
        setProgress({ done: i + 1, total: segments.length });
      }

      if (allChapters.length === 0) {
        showToast({ kind: 'info', title: t.failedMessage });
        setPhase('idle');
        return;
      }

      const sorted = allChapters.sort((a, b) => a.time - b.time);
      setChapters(sorted);
      setPhase('preview');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage
      });
      setPhase('idle');
    }
  }, [selectedProvider, hasSubtitles, totalDuration, allSubtitleClips]);

  const cancelGenerate = useCallback(() => {
    abortRef.current = true;
    setPhase('idle');
    showToast({ kind: 'info', title: t.cancelledTitle });
  }, []);

  const applyChapters = useCallback(() => {
    if (chapters.length === 0) {
      setPhase('idle');
      setChapters([]);
      return;
    }
    try {
      commandManager.execute(
        new BatchAddMarkersCommand(
          timelineAccessor,
          chapters.map((ch) => ({ time: ch.time, label: ch.title }))
        )
      );
      showToast({
        kind: 'success',
        title: t.appliedTitle,
        message: t.appliedMessage(chapters.length)
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage
      });
    }
    setPhase('idle');
    setChapters([]);
  }, [chapters]);

  const copyYouTube = useCallback(() => {
    void navigator.clipboard.writeText(formatChaptersYouTube(chapters));
    showToast({ kind: 'success', title: t.copied });
  }, [chapters]);

  const copyBilibili = useCallback(() => {
    void navigator.clipboard.writeText(formatChaptersBilibili(chapters));
    showToast({ kind: 'success', title: t.copied });
  }, [chapters]);

  if (!hasSubtitles) {
    return (
      <details className="rounded-md border border-line bg-[var(--color-bg-elevated)]" data-testid="chapter-title-ai-section">
        <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{t.title}</summary>
        <div className="space-y-3 border-t border-line p-2">
          <div className="text-xs text-[var(--color-text-muted)]" data-testid="chapter-title-ai-no-subtitle">{t.noSubtitle}</div>
        </div>
      </details>
    );
  }

  return (
    <details className="rounded-md border border-line bg-[var(--color-bg-elevated)]" data-testid="chapter-title-ai-section">
      <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{t.title}</summary>
      <div className="space-y-3 border-t border-line p-2">
        {phase === 'idle' && (
          <>
            <div className="space-y-2">
              <label className="block text-xs text-[var(--color-text-secondary)]">{t.selectProvider}</label>
              <select
                className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm"
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                disabled={enabledProviders.length === 0}
                data-testid="chapter-title-ai-provider-select"
              >
                {enabledProviders.length === 0 && <option value="">{t.noProvider}</option>}
                {enabledProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-[var(--color-text-muted)]" data-testid="chapter-title-ai-suggestion">
              {t.chapterCount}: {t.suggested(chapterSuggestion.min, chapterSuggestion.max)}
            </div>
            <button
              className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!selectedProvider || selectedClipLocked}
              onClick={() => void startGenerate()}
              data-testid="chapter-title-ai-generate-button"
            >
              {t.generate}
            </button>
          </>
        )}
        {phase === 'processing' && (
          <div className="space-y-2">
            <div className="text-xs text-[var(--color-text-secondary)]" data-testid="chapter-title-ai-progress">
              {t.progress(progress.done, progress.total)}
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
              onClick={cancelGenerate}
              data-testid="chapter-title-ai-cancel-button"
            >
              {t.cancel}
            </button>
          </div>
        )}
        {phase === 'preview' && (
          <div className="space-y-2" data-testid="chapter-title-ai-preview">
            <div className="text-xs font-semibold text-[var(--color-text-secondary)]">{t.previewTitle}</div>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {chapters.map((ch, idx) => {
                const mins = Math.floor(ch.time / 60);
                const secs = Math.floor(ch.time % 60);
                const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-md border border-line p-2 text-xs"
                    data-testid={`chapter-title-ai-item-${idx}`}
                  >
                    <span className="w-12 shrink-0 font-mono text-[var(--color-text-muted)]">{timeStr}</span>
                    <span className="flex-1 font-medium text-ink">{ch.title}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-medium hover:bg-panel"
                type="button"
                onClick={copyYouTube}
                data-testid="chapter-title-ai-copy-youtube"
              >
                {t.copyYouTube}
              </button>
              <button
                className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-medium hover:bg-panel"
                type="button"
                onClick={copyBilibili}
                data-testid="chapter-title-ai-copy-bilibili"
              >
                {t.copyBilibili}
              </button>
            </div>
            <button
              className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)]"
              type="button"
              onClick={applyChapters}
              data-testid="chapter-title-ai-apply"
            >
              {t.apply}
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
