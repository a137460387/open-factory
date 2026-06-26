import { useState, useCallback, useRef } from 'react';
import type { Clip, AIColorGradingSuggestion } from '@open-factory/editor-core';
import {
  isVisionCapable,
  isProviderConfigured,
  parseColorGradingSuggestionResponse,
  buildColorGradingSystemPrompt,
  buildColorGradingColorCorrectionPatch
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey, extractAiFrames } from '../../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { UpdateClipCommand } from '@open-factory/editor-core';
import { showToast } from '../../lib/toast';

const t = zhCN.inspector.aiColorSuggestion;

type ColorPhase = 'idle' | 'extracting' | 'analyzing' | 'preview' | 'history';

interface SuggestionItem {
  parameter: string;
  currentValue?: number;
  recommendedValue: number;
  reason: string;
  selected: boolean;
}

export function AIColorGradingPanel({
  clip,
  sourcePath,
  selectedClipLocked
}: {
  clip: Clip;
  sourcePath: string;
  selectedClipLocked: boolean;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const visionProviders = providers.filter((p) => p.enabled && isProviderConfigured(p) && isVisionCapable(p.defaultModel));
  const [selectedProviderId, setSelectedProviderId] = useState<string>(visionProviders[0]?.id ?? '');
  const selectedProvider = visionProviders.find((p) => p.id === selectedProviderId) ?? visionProviders[0];

  const [phase, setPhase] = useState<ColorPhase>('idle');
  const [suggestion, setSuggestion] = useState<AIColorGradingSuggestion | null>(null);
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const abortRef = useRef(false);

  const aiColorHistory = (clip as unknown as { aiColorHistory?: Array<{ timestamp: number; style: string; issues: string[]; suggestions: Array<{ parameter: string; currentValue?: number; recommendedValue: number; reason: string }> }> }).aiColorHistory ?? [];

  const toggleItem = useCallback((parameter: string) => {
    setItems((prev) =>
      prev.map((item) => (item.parameter === parameter ? { ...item, selected: !item.selected } : item))
    );
  }, []);

  const selectAll = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: false })));
  }, []);

  const startAnalysis = useCallback(async () => {
    if (!selectedProvider || !sourcePath) return;
    abortRef.current = false;

    try {
      setPhase('extracting');
      const { frames } = await extractAiFrames({
        sourcePath,
        times: [clip.start + clip.duration / 2]
      });
      if (abortRef.current || frames.length === 0) { setPhase('idle'); return; }

      setPhase('analyzing');
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) { setPhase('idle'); return; }

      const imageContent = frames.map((b64: string) => ({
        type: 'image_url' as const,
        image_url: { url: `data:image/jpeg;base64,${b64}` }
      }));

      const currentCC = (clip as unknown as { colorCorrection?: Record<string, unknown> }).colorCorrection ?? {};
      const systemPrompt = buildColorGradingSystemPrompt();
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        {
          role: 'user' as const,
          content: [
            ...imageContent,
            { type: 'text' as const, text: `当前色彩校正参数: ${JSON.stringify(currentCC)}` }
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
          maxTokens: 4096,
          temperature: 0.3
        },
        apiKey
      );
      if (abortRef.current) { setPhase('idle'); return; }

      const parsed = parseColorGradingSuggestionResponse(JSON.parse(response.content));
      if (!parsed) {
        showToast({ kind: 'info', title: t.noSuggestion });
        setPhase('idle');
        return;
      }

      setSuggestion(parsed);
      setItems(parsed.suggestions.map((s) => ({ ...s, selected: true })));
      setPhase('preview');

      // Save to history (LRU max 3)
      const historyEntry = {
        timestamp: Date.now(),
        style: parsed.style,
        issues: parsed.issues,
        suggestions: parsed.suggestions
      };
      const existing = (clip as unknown as { aiColorHistory?: Array<{ timestamp: number; style: string; issues: string[]; suggestions: Array<{ parameter: string; currentValue?: number; recommendedValue: number; reason: string }> }> }).aiColorHistory ?? [];
      const newHistory = [historyEntry, ...existing].slice(0, 3);
      try {
        commandManager.execute(
          new UpdateClipCommand(timelineAccessor, clip.id, { aiColorHistory: newHistory })
        );
      } catch {
        // Don't block the UI if history save fails
      }
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage
      });
      setPhase('idle');
    }
  }, [selectedProvider, sourcePath, clip]);

  const cancelAnalysis = useCallback(() => {
    abortRef.current = true;
    setPhase('idle');
    showToast({ kind: 'info', title: t.cancelledTitle });
  }, []);

  const applySelected = useCallback(() => {
    const selected = items.filter((item) => item.selected);
    if (selected.length === 0) {
      setPhase('idle');
      setItems([]);
      setSuggestion(null);
      return;
    }
    try {
      const patch = buildColorGradingColorCorrectionPatch(
        selected.map((item) => ({ parameter: item.parameter, recommendedValue: item.recommendedValue }))
      );
      if (patch) {
        commandManager.execute(
          new UpdateClipCommand(timelineAccessor, clip.id, { colorCorrection: patch })
        );
        showToast({
          kind: 'success',
          title: t.appliedTitle,
          message: t.appliedMessage(selected.length)
        });
      }
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage
      });
    }
    setPhase('idle');
    setItems([]);
    setSuggestion(null);
  }, [items, clip.id]);

  const showHistory = useCallback((index: number) => {
    setHistoryIndex(index);
    setPhase('history');
  }, []);

  const applyHistoryItem = useCallback((parameter: string, recommendedValue: number) => {
    try {
      const patch = buildColorGradingColorCorrectionPatch([{ parameter, recommendedValue }]);
      if (patch) {
        commandManager.execute(
          new UpdateClipCommand(timelineAccessor, clip.id, { colorCorrection: patch })
        );
        showToast({ kind: 'success', title: t.appliedTitle, message: t.appliedMessage(1) });
      }
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage
      });
    }
  }, [clip.id]);

  return (
    <div className="mt-2" data-testid="ai-color-suggestion-section">
      {phase === 'idle' && (
        <>
          <div className="mb-2">
            <label className="block text-xs text-slate-600">{t.selectProvider}</label>
            <select
              className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm"
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              disabled={visionProviders.length === 0}
              data-testid="ai-color-suggestion-provider-select"
            >
              {visionProviders.length === 0 && <option value="">{t.noProvider}</option>}
              {visionProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!selectedProvider || selectedClipLocked}
            onClick={() => void startAnalysis()}
            data-testid="ai-color-suggestion-start-button"
          >
            {t.analyze}
          </button>
          {aiColorHistory.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold text-slate-700 mb-1">{t.historyTitle}</div>
              <div className="space-y-1">
                {aiColorHistory.map((entry, idx) => (
                  <button
                    key={entry.timestamp}
                    className="w-full rounded-md border border-line bg-white px-2 py-1 text-xs text-left hover:bg-panel"
                    type="button"
                    onClick={() => showHistory(idx)}
                    data-testid={`ai-color-suggestion-history-${idx}`}
                  >
                    {new Date(entry.timestamp).toLocaleString()} - {entry.style}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {(phase === 'extracting' || phase === 'analyzing') && (
        <div className="space-y-2">
          <div className="text-xs text-slate-600" data-testid="ai-color-suggestion-progress">
            {phase === 'extracting' ? t.extractingFrame : t.analyzing}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-blue-600 animate-pulse" style={{ width: '60%' }} />
          </div>
          <button
            className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
            type="button"
            onClick={cancelAnalysis}
            data-testid="ai-color-suggestion-cancel-button"
          >
            {zhCN.common.cancel}
          </button>
        </div>
      )}
      {phase === 'preview' && suggestion && (
        <div className="space-y-2" data-testid="ai-color-suggestion-preview">
          <div className="text-xs font-semibold text-slate-700">{t.previewTitle}</div>
          {suggestion.style && (
            <div className="text-xs text-slate-600">
              <span className="font-medium">{t.style}: </span>{suggestion.style}
            </div>
          )}
          {suggestion.issues.length > 0 && (
            <div className="text-xs text-slate-600">
              <span className="font-medium">{t.issues}: </span>{suggestion.issues.join('、')}
            </div>
          )}
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {items.map((item) => (
              <label
                key={item.parameter}
                className="flex items-start gap-2 rounded-md border border-line p-2 text-xs cursor-pointer"
                data-testid={`ai-color-suggestion-item-${item.parameter}`}
              >
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggleItem(item.parameter)}
                  className="mt-0.5"
                  data-testid={`ai-color-suggestion-toggle-${item.parameter}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800">{item.parameter}</div>
                  <div className="text-slate-500">
                    {item.currentValue !== undefined && (
                      <span>{t.currentValue}: {item.currentValue} → </span>
                    )}
                    <span>{t.recommendedValue}: {item.recommendedValue}</span>
                  </div>
                  {item.reason && <div className="mt-0.5 text-slate-400">{item.reason}</div>}
                </div>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="rounded-md border border-line bg-white px-2 py-1 text-xs font-medium hover:bg-panel"
              type="button"
              onClick={selectAll}
              data-testid="ai-color-suggestion-select-all"
            >
              {t.selectAll}
            </button>
            <button
              className="rounded-md border border-line bg-white px-2 py-1 text-xs font-medium hover:bg-panel"
              type="button"
              onClick={deselectAll}
              data-testid="ai-color-suggestion-deselect-all"
            >
              {t.deselectAll}
            </button>
          </div>
          <button
            className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            type="button"
            onClick={applySelected}
            data-testid="ai-color-suggestion-apply"
          >
            {t.applySelected}
          </button>
        </div>
      )}
      {phase === 'history' && aiColorHistory[historyIndex] && (
        <div className="space-y-2" data-testid="ai-color-suggestion-history-view">
          <div className="text-xs font-semibold text-slate-700">{t.historyTitle}</div>
          <div className="text-xs text-slate-600">
            <span className="font-medium">{t.style}: </span>{aiColorHistory[historyIndex].style}
          </div>
          {aiColorHistory[historyIndex].issues.length > 0 && (
            <div className="text-xs text-slate-600">
              <span className="font-medium">{t.issues}: </span>{aiColorHistory[historyIndex].issues.join('、')}
            </div>
          )}
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {aiColorHistory[historyIndex].suggestions.map((item) => (
              <div
                key={item.parameter}
                className="flex items-start gap-2 rounded-md border border-line p-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800">{item.parameter}</div>
                  <div className="text-slate-500">
                    {item.currentValue !== undefined && (
                      <span>{t.currentValue}: {item.currentValue} → </span>
                    )}
                    <span>{t.recommendedValue}: {item.recommendedValue}</span>
                  </div>
                  {item.reason && <div className="mt-0.5 text-slate-400">{item.reason}</div>}
                </div>
                <button
                  className="shrink-0 rounded bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-200"
                  type="button"
                  onClick={() => applyHistoryItem(item.parameter, item.recommendedValue)}
                  data-testid={`ai-color-suggestion-history-apply-${item.parameter}`}
                >
                  {t.applySelected}
                </button>
              </div>
            ))}
          </div>
          <button
            className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
            type="button"
            onClick={() => setPhase('idle')}
            data-testid="ai-color-suggestion-history-back"
          >
            {zhCN.common.back}
          </button>
        </div>
      )}
    </div>
  );
}
