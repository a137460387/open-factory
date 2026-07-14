import { useState, useCallback, useRef } from 'react';
import type { Clip, AIProvider } from '@open-factory/editor-core';
import {
  buildSubtitleGlossarySystemPrompt,
  buildGlossaryExtractionUserPrompt,
  parseSubtitleGlossaryResponse,
  buildContextualTranslationSystemPrompt,
  parseContextualTranslationResponse,
  compareTranslationVersions,
  calculateContextualTranslationBatches,
  isProviderConfigured,
  type GlossaryTerm,
  type TranslationComparison,
} from '@open-factory/editor-core';
import { BatchUpdateSubtitleTextCommand } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { showToast } from '../../lib/toast';

const t = zhCN.contextualTranslation;

type Phase = 'idle' | 'extracting' | 'editing' | 'translating' | 'compare' | 'done';

const TARGET_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
];

export function ContextualTranslationPanel({
  subtitleClips,
  onClose,
}: {
  subtitleClips: Array<Extract<Clip, { type: 'subtitle' }>>;
  onClose: () => void;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const textProviders = providers.filter((p) => p.enabled && isProviderConfigured(p));
  const [selectedProviderId, setSelectedProviderId] = useState(textProviders[0]?.id ?? '');
  const selectedProvider = textProviders.find((p) => p.id === selectedProviderId) ?? textProviders[0];

  const [targetLanguage, setTargetLanguage] = useState('en');
  const [phase, setPhase] = useState<Phase>('idle');
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
  const [editingGlossary, setEditingGlossary] = useState<GlossaryTerm[]>([]);
  const [speakerStyle, setSpeakerStyle] = useState('');
  const [withContextTranslations, setWithContextTranslations] = useState<string[]>([]);
  const [withoutContextTranslations, setWithoutContextTranslations] = useState<string[]>([]);
  const [comparisons, setComparisons] = useState<TranslationComparison[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const abortRef = useRef(false);

  const subtitleLines = subtitleClips.map((clip, index) => ({
    index,
    time: formatTime(clip.start),
    text: clip.text,
  }));

  const extractGlossary = useCallback(async () => {
    if (!selectedProvider || subtitleClips.length === 0) return;
    abortRef.current = false;
    setPhase('extracting');

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) {
        setPhase('idle');
        return;
      }

      const systemPrompt = buildSubtitleGlossarySystemPrompt();
      const userPrompt = buildGlossaryExtractionUserPrompt(subtitleLines);

      const response = await callAiApi(
        {
          providerId: selectedProvider.id,
          baseUrl: selectedProvider.baseUrl,
          model: selectedProvider.defaultModel,
          messages: [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: userPrompt },
          ],
          customHeaders: selectedProvider.customHeaders,
          maxTokens: 4096,
          temperature: 0.2,
        },
        apiKey,
      );
      if (abortRef.current) {
        setPhase('idle');
        return;
      }

      const parsed = parseSubtitleGlossaryResponse(JSON.parse(response.content));
      setGlossary(parsed.terms);
      setEditingGlossary(parsed.terms.map((term) => ({ ...term })));
      setPhase('editing');
      showToast({ kind: 'success', title: t.glossaryExtracted });
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage,
      });
      setPhase('idle');
    }
  }, [selectedProvider, subtitleClips, subtitleLines]);

  const startTranslation = useCallback(async () => {
    if (!selectedProvider || subtitleClips.length === 0) return;
    abortRef.current = false;
    setPhase('translating');

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) {
        setPhase('editing');
        return;
      }

      const batches = calculateContextualTranslationBatches(subtitleClips.length, 50);
      const withCtx: string[] = [];
      const withoutCtx: string[] = [];
      let offset = 0;
      setProgress({ done: 0, total: subtitleClips.length });

      for (const batchSize of batches) {
        const batch = subtitleLines.slice(offset, offset + batchSize);

        // With context
        const ctxSystemPrompt = buildContextualTranslationSystemPrompt(
          editingGlossary,
          targetLanguage,
          speakerStyle || undefined,
        );
        const ctxResponse = await callAiApi(
          {
            providerId: selectedProvider.id,
            baseUrl: selectedProvider.baseUrl,
            model: selectedProvider.defaultModel,
            messages: [
              { role: 'system' as const, content: ctxSystemPrompt },
              { role: 'user' as const, content: JSON.stringify(batch.map((b) => ({ index: b.index, text: b.text }))) },
            ],
            customHeaders: selectedProvider.customHeaders,
            maxTokens: 4096,
            temperature: 0.2,
          },
          apiKey,
        );
        if (abortRef.current) {
          setPhase('editing');
          return;
        }

        const ctxParsed = parseContextualTranslationResponse(JSON.parse(ctxResponse.content));
        for (const item of ctxParsed) {
          withCtx[item.index] = item.translatedText;
        }

        // Without context (basic translation)
        const basicSystemPrompt = `你是一个字幕翻译助手。请将以下字幕翻译为${targetLanguage}。返回严格JSON数组，每个元素包含{"index": 序号, "translatedText": "翻译后的文本"}。只返回JSON数组。`;
        const basicResponse = await callAiApi(
          {
            providerId: selectedProvider.id,
            baseUrl: selectedProvider.baseUrl,
            model: selectedProvider.defaultModel,
            messages: [
              { role: 'system' as const, content: basicSystemPrompt },
              { role: 'user' as const, content: JSON.stringify(batch.map((b) => ({ index: b.index, text: b.text }))) },
            ],
            customHeaders: selectedProvider.customHeaders,
            maxTokens: 4096,
            temperature: 0.2,
          },
          apiKey,
        );
        if (abortRef.current) {
          setPhase('editing');
          return;
        }

        const basicParsed = parseContextualTranslationResponse(JSON.parse(basicResponse.content));
        for (const item of basicParsed) {
          withoutCtx[item.index] = item.translatedText;
        }

        offset += batchSize;
        setProgress({ done: offset, total: subtitleClips.length });
      }

      setWithContextTranslations(withCtx);
      setWithoutContextTranslations(withoutCtx);

      const originalTexts = subtitleClips.map((c) => c.text);
      const comps = compareTranslationVersions(originalTexts, withoutCtx, withCtx);
      setComparisons(comps);
      setPhase('compare');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage,
      });
      setPhase('editing');
    }
  }, [selectedProvider, subtitleClips, subtitleLines, editingGlossary, targetLanguage, speakerStyle]);

  const applyWithContext = useCallback(() => {
    if (withContextTranslations.length === 0) return;
    try {
      const updates = subtitleClips
        .map((clip, index) => ({ clipId: clip.id, text: withContextTranslations[index] ?? clip.text }))
        .filter((u) => u.text !== subtitleClips.find((c) => c.id === u.clipId)?.text);

      if (updates.length === 0) {
        showToast({ kind: 'info', title: '无变更需要应用' });
        return;
      }

      commandManager.execute(new BatchUpdateSubtitleTextCommand(timelineAccessor, updates));
      showToast({ kind: 'success', title: t.translated, message: `已更新 ${updates.length} 条字幕` });
      setPhase('done');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage,
      });
    }
  }, [withContextTranslations, subtitleClips]);

  const cancelOperation = useCallback(() => {
    abortRef.current = true;
  }, []);

  const updateGlossaryTranslation = useCallback((index: number, translation: string) => {
    setEditingGlossary((prev) => prev.map((term, i) => (i === index ? { ...term, translation } : term)));
  }, []);

  if (subtitleClips.length === 0) {
    return (
      <div className="flex flex-col h-full" data-testid="contextual-translation-panel">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
          <button
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-panel"
            type="button"
            onClick={onClose}
            data-testid="contextual-translation-close"
          >
            {zhCN.common.close}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-xs text-slate-500">{t.noSubtitles}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="contextual-translation-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
        <button
          className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-panel"
          type="button"
          onClick={onClose}
          data-testid="contextual-translation-close"
        >
          {zhCN.common.close}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {phase === 'idle' && (
          <>
            <div>
              <label className="block text-xs text-slate-600 mb-1">{t.selectProvider}</label>
              <select
                className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm"
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                disabled={textProviders.length === 0}
                data-testid="contextual-translation-provider"
              >
                {textProviders.length === 0 && <option value="">{t.noProvider}</option>}
                {textProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">{t.targetLanguage}</label>
              <select
                className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                data-testid="contextual-translation-language"
              >
                {TARGET_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">{subtitleClips.length} 条字幕待翻译</div>
            <button
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              type="button"
              disabled={!selectedProvider}
              onClick={() => void extractGlossary()}
              data-testid="contextual-translation-extract"
            >
              {t.extractGlossary}
            </button>
          </>
        )}

        {phase === 'extracting' && (
          <div className="space-y-2">
            <div className="text-xs text-slate-600" data-testid="contextual-translation-extracting">
              {t.extracting}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-blue-600 animate-pulse" style={{ width: '60%' }} />
            </div>
            <button
              className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              onClick={cancelOperation}
              data-testid="contextual-translation-cancel"
            >
              {zhCN.common.cancel}
            </button>
          </div>
        )}

        {phase === 'editing' && (
          <>
            <div className="rounded-md border border-line bg-white p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-700">{t.glossaryTitle}</div>
              <div className="text-[11px] text-slate-400">{t.glossaryDesc}</div>
              {editingGlossary.length === 0 ? (
                <div className="text-xs text-slate-500 py-2">未检测到专有名词</div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {editingGlossary.map((term, i) => (
                    <div
                      key={`${term.original}-${i}`}
                      className="flex items-center gap-2 rounded-md border border-line p-2 text-xs"
                      data-testid={`contextual-translation-glossary-${i}`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-slate-800">{term.original}</span>
                        <span className="ml-1 text-slate-400">
                          [
                          {
                            (typeof t[
                              `type${term.type.charAt(0).toUpperCase()}${term.type.slice(1)}` as keyof typeof t
                            ] === 'string'
                              ? t[`type${term.type.charAt(0).toUpperCase()}${term.type.slice(1)}` as keyof typeof t]
                              : term.type) as string
                          }
                          ]
                        </span>
                      </div>
                      <input
                        type="text"
                        className="w-24 rounded border border-line bg-white px-1.5 py-0.5 text-xs"
                        placeholder="翻译"
                        value={term.translation ?? ''}
                        onChange={(e) => updateGlossaryTranslation(i, e.target.value)}
                        data-testid={`contextual-translation-glossary-input-${i}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">说话人风格（可选）</label>
              <input
                type="text"
                className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm"
                placeholder="例如：正式、口语化、幽默"
                value={speakerStyle}
                onChange={(e) => setSpeakerStyle(e.target.value)}
                data-testid="contextual-translation-speaker-style"
              />
            </div>

            <button
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              type="button"
              disabled={!selectedProvider}
              onClick={() => void startTranslation()}
              data-testid="contextual-translation-start"
            >
              {t.startTranslation}
            </button>
          </>
        )}

        {phase === 'translating' && (
          <div className="space-y-2">
            <div className="text-xs text-slate-600" data-testid="contextual-translation-translating">
              {t.batchProgress(Math.min(progress.done, progress.total), progress.total)}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <button
              className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              onClick={cancelOperation}
              data-testid="contextual-translation-cancel-translate"
            >
              {zhCN.common.cancel}
            </button>
          </div>
        )}

        {phase === 'compare' && (
          <div className="space-y-3" data-testid="contextual-translation-compare">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-700">{t.compareMode}</div>
              <div className="text-[11px] text-slate-400">
                {comparisons.filter((c) => c.hasDifference).length} 条有差异
              </div>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {comparisons.map((comp, i) => (
                <div
                  key={i}
                  className={`rounded-md border p-2 text-xs ${comp.hasDifference ? 'border-amber-200 bg-amber-50' : 'border-line bg-white'}`}
                  data-testid={`contextual-translation-compare-${i}`}
                >
                  <div className="text-slate-500 mb-1">{comp.original}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] text-slate-400 mb-0.5">{t.compareWithoutContext}</div>
                      <div className="text-slate-700">{comp.withoutContext || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 mb-0.5">{t.compareWithContext}</div>
                      <div className="text-slate-700 font-medium">{comp.withContext || '—'}</div>
                    </div>
                  </div>
                  {comp.hasDifference && (
                    <div className="mt-1 text-[10px] text-amber-600">{t.compareHasDifference}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
                type="button"
                onClick={() => {
                  setPhase('editing');
                  setComparisons([]);
                }}
                data-testid="contextual-translation-back"
              >
                {zhCN.common.back}
              </button>
              <button
                className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                type="button"
                onClick={applyWithContext}
                data-testid="contextual-translation-apply"
              >
                {t.confirmApply}
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center py-8" data-testid="contextual-translation-done">
            <div className="text-sm text-green-700 font-medium">{t.translated}</div>
            <button
              className="mt-4 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              onClick={onClose}
              data-testid="contextual-translation-done-close"
            >
              {zhCN.common.close}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
