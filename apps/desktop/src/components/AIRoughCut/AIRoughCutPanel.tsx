import { useState, useCallback, useRef } from 'react';
import type { MediaAsset, Clip } from '@open-factory/editor-core';
import {
  buildMediaInfoForAI,
  buildRoughCutSystemPrompt,
  buildRoughCutUserPrompt,
  parseRoughCutAIResponse,
  ROUGH_CUT_TEMPLATES,
  isProviderConfigured,
  type AIRoughCutClip
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { BatchAddClipsCommand } from '@open-factory/editor-core';
import { showToast } from '../../lib/toast';
import { createId, createBaseClip, DEFAULT_COLOR_CORRECTION, DEFAULT_TRANSFORM } from '@open-factory/editor-core';

const t = zhCN.aiRoughCut;

type WizardPhase = 'input' | 'generating' | 'preview' | 'done';
type InputMode = 'text' | 'template';

interface StoryboardClip {
  mediaId: string;
  startTime: number;
  duration: number;
  trackIndex: number;
  reason: string;
  mediaName: string;
  deleted: boolean;
}

export function AIRoughCutPanel({
  media,
  onClose
}: {
  media: MediaAsset[];
  onClose: () => void;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const textProviders = providers.filter((p) => p.enabled && isProviderConfigured(p));
  const [selectedProviderId, setSelectedProviderId] = useState<string>(textProviders[0]?.id ?? '');
  const selectedProvider = textProviders.find((p) => p.id === selectedProviderId) ?? textProviders[0];

  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [textDescription, setTextDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(ROUGH_CUT_TEMPLATES[0]?.id ?? '');
  const [templateDurations, setTemplateDurations] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const tmpl of ROUGH_CUT_TEMPLATES) {
      for (const seg of tmpl.segments) {
        map[`${tmpl.id}:${seg.label}`] = seg.defaultDuration;
      }
    }
    return map;
  });

  const [phase, setPhase] = useState<WizardPhase>('input');
  const [storyboard, setStoryboard] = useState<StoryboardClip[]>([]);
  const abortRef = useRef(false);

  const hasAiAnalysis = media.some((m) => m.aiAnalysis);

  const buildDescription = useCallback((): string => {
    if (inputMode === 'text') {
      return textDescription.trim();
    }
    const tmpl = ROUGH_CUT_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return '';
    const segments = tmpl.segments.map((seg) => {
      const dur = templateDurations[`${tmpl.id}:${seg.label}`] ?? seg.defaultDuration;
      return `${seg.label}(${dur}秒)`;
    });
    return `按照以下结构制作视频：${segments.join(' → ')}`;
  }, [inputMode, textDescription, selectedTemplateId, templateDurations]);

  const startGeneration = useCallback(async () => {
    const description = buildDescription();
    if (!description || !selectedProvider) return;
    abortRef.current = false;

    try {
      setPhase('generating');
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) { setPhase('input'); return; }

      const mediaInfo = buildMediaInfoForAI(media);
      const systemPrompt = buildRoughCutSystemPrompt();
      const userPrompt = buildRoughCutUserPrompt(description, mediaInfo);

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt }
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
      if (abortRef.current) { setPhase('input'); return; }

      const parsed = parseRoughCutAIResponse(JSON.parse(response.content));
      if (parsed.length === 0) {
        showToast({ kind: 'info', title: t.storyboardEmpty });
        setPhase('input');
        return;
      }

      const mediaMap = new Map(media.map((m) => [m.id, m]));
      const storyItems: StoryboardClip[] = parsed.map((clip) => ({
        ...clip,
        mediaName: mediaMap.get(clip.mediaId)?.name ?? clip.mediaId,
        deleted: false
      }));
      setStoryboard(storyItems);
      setPhase('preview');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage
      });
      setPhase('input');
    }
  }, [selectedProvider, media, buildDescription]);

  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
    setPhase('input');
  }, []);

  const toggleDelete = useCallback((index: number) => {
    setStoryboard((prev) =>
      prev.map((item, i) => (i === index ? { ...item, deleted: !item.deleted } : item))
    );
  }, []);

  const moveClip = useCallback((index: number, direction: -1 | 1) => {
    setStoryboard((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const confirmCreate = useCallback(() => {
    const activeClips = storyboard.filter((s) => !s.deleted);
    if (activeClips.length === 0) {
      setPhase('input');
      return;
    }

    try {
      // Create a new sequence for the rough cut
      const seqId = createId();
      const trackId = createId();
      const mediaMap = new Map(media.map((m) => [m.id, m]));
      let cursor = 0;

      const clips: Clip[] = activeClips.map((sc, index) => {
        const asset = mediaMap.get(sc.mediaId);
        if (!asset) {
          throw new Error(`Media not found: ${sc.mediaId}`);
        }
        const clipDuration = Math.min(sc.duration, asset.duration);
        const base = createBaseClip({
          id: createId(),
          name: `${asset.name} - ${sc.reason || `片段${index + 1}`}`,
          trackId,
          start: cursor,
          duration: clipDuration,
          trimStart: Math.min(sc.startTime, Math.max(0, asset.duration - clipDuration)),
          trimEnd: Math.max(0, asset.duration - Math.min(sc.startTime, Math.max(0, asset.duration - clipDuration)) - clipDuration)
        });
        cursor += clipDuration;

        if (asset.type === 'video') {
          return {
            ...base,
            type: 'video' as const,
            mediaId: asset.id,
            volume: 1
          };
        } else if (asset.type === 'image') {
          return {
            ...base,
            type: 'image' as const,
            mediaId: asset.id
          };
        } else {
          return {
            ...base,
            type: 'audio' as const,
            mediaId: asset.id,
            volume: 1
          };
        }
      });

      const trackType = clips.some((c) => c.type === 'video' || c.type === 'image') ? 'video' as const : 'audio' as const;
      const cmd = new BatchAddClipsCommand(
        timelineAccessor,
        clips,
        [{ id: trackId, name: 'AI粗剪', type: trackType }]
      );
      commandManager.execute(cmd);

      showToast({
        kind: 'success',
        title: t.applied,
        message: t.appliedMessage(activeClips.length)
      });
      setPhase('done');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage
      });
    }
  }, [storyboard, media]);

  const selectedTemplate = ROUGH_CUT_TEMPLATES.find((tmpl) => tmpl.id === selectedTemplateId);

  return (
    <div className="flex flex-col h-full" data-testid="ai-rough-cut-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
        <button
          className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-panel"
          type="button"
          onClick={onClose}
          data-testid="ai-rough-cut-close"
        >
          {zhCN.common.close}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {phase === 'input' && (
          <>
            <div>
              <label className="block text-xs text-slate-600 mb-1">{t.selectProvider}</label>
              <select
                className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm"
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                disabled={textProviders.length === 0}
                data-testid="ai-rough-cut-provider-select"
              >
                {textProviders.length === 0 && <option value="">{t.noProvider}</option>}
                {textProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">{t.inputMode}</label>
              <div className="flex gap-2">
                <button
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${inputMode === 'text' ? 'bg-blue-600 text-white' : 'bg-white border border-line text-slate-700 hover:bg-panel'}`}
                  type="button"
                  onClick={() => setInputMode('text')}
                  data-testid="ai-rough-cut-mode-text"
                >
                  {t.textDescription}
                </button>
                <button
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${inputMode === 'template' ? 'bg-blue-600 text-white' : 'bg-white border border-line text-slate-700 hover:bg-panel'}`}
                  type="button"
                  onClick={() => setInputMode('template')}
                  data-testid="ai-rough-cut-mode-template"
                >
                  {t.template}
                </button>
              </div>
            </div>

            {inputMode === 'text' && (
              <div>
                <textarea
                  className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm resize-none"
                  rows={4}
                  placeholder={t.textDescriptionPlaceholder}
                  value={textDescription}
                  onChange={(e) => setTextDescription(e.target.value)}
                  data-testid="ai-rough-cut-text-input"
                />
              </div>
            )}

            {inputMode === 'template' && selectedTemplate && (
              <div className="space-y-2">
                <select
                  className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  data-testid="ai-rough-cut-template-select"
                >
                  {ROUGH_CUT_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                  ))}
                </select>
                <div className="space-y-1.5">
                  {selectedTemplate.segments.map((seg) => {
                    const key = `${selectedTemplate.id}:${seg.label}`;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 w-20">{t.segment(seg.label)}</span>
                        <input
                          type="number"
                          className="w-20 rounded-md border border-line bg-white px-2 py-1 text-xs"
                          min={1}
                          max={300}
                          value={templateDurations[key] ?? seg.defaultDuration}
                          onChange={(e) =>
                            setTemplateDurations((prev) => ({
                              ...prev,
                              [key]: Math.max(1, Number(e.target.value) || seg.defaultDuration)
                            }))
                          }
                          data-testid={`ai-rough-cut-template-duration-${seg.label}`}
                        />
                        <span className="text-xs text-slate-400">{t.templateDuration}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!hasAiAnalysis && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700" data-testid="ai-rough-cut-no-analysis-hint">
                {t.mediaMatchNoAnalysis}
              </div>
            )}

            <button
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!selectedProvider || (!textDescription.trim() && inputMode === 'text')}
              onClick={() => void startGeneration()}
              data-testid="ai-rough-cut-start"
            >
              {t.title}
            </button>
          </>
        )}

        {phase === 'generating' && (
          <div className="space-y-2">
            <div className="text-xs text-slate-600" data-testid="ai-rough-cut-generating">
              {t.generating}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-blue-600 animate-pulse" style={{ width: '60%' }} />
            </div>
            <button
              className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              onClick={cancelGeneration}
              data-testid="ai-rough-cut-cancel"
            >
              {zhCN.common.cancel}
            </button>
          </div>
        )}

        {phase === 'preview' && (
          <div className="space-y-2" data-testid="ai-rough-cut-storyboard">
            <div className="text-xs font-semibold text-slate-700">
              {t.storyboard} — {t.clipCount(storyboard.filter((s) => !s.deleted).length)} · {t.totalDuration(storyboard.filter((s) => !s.deleted).reduce((sum, s) => sum + s.duration, 0))}
            </div>
            <div className="text-[11px] text-slate-400">{t.reorderHint}</div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {storyboard.map((item, index) => (
                <div
                  key={`${item.mediaId}-${index}`}
                  className={`flex items-start gap-2 rounded-md border p-2 text-xs ${item.deleted ? 'border-red-200 bg-red-50 opacity-50' : 'border-line bg-white'}`}
                  data-testid={`ai-rough-cut-clip-${index}`}
                >
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      className="rounded px-1 py-0.5 text-[10px] text-slate-500 hover:bg-panel disabled:opacity-30"
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveClip(index, -1)}
                      data-testid={`ai-rough-cut-move-up-${index}`}
                    >
                      ▲
                    </button>
                    <button
                      className="rounded px-1 py-0.5 text-[10px] text-slate-500 hover:bg-panel disabled:opacity-30"
                      type="button"
                      disabled={index === storyboard.length - 1}
                      onClick={() => moveClip(index, 1)}
                      data-testid={`ai-rough-cut-move-down-${index}`}
                    >
                      ▼
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800 truncate">{item.mediaName}</div>
                    <div className="text-slate-500">
                      {item.duration.toFixed(1)}s · {t.segment(item.startTime.toFixed(1) + 's')}
                    </div>
                    {item.reason && <div className="mt-0.5 text-slate-400 line-clamp-2">{item.reason}</div>}
                  </div>
                  <button
                    className="shrink-0 rounded px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
                    type="button"
                    onClick={() => toggleDelete(index)}
                    data-testid={`ai-rough-cut-delete-${index}`}
                  >
                    {item.deleted ? zhCN.common.reset : t.deleteClip}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
                type="button"
                onClick={() => setPhase('input')}
                data-testid="ai-rough-cut-back"
              >
                {zhCN.common.back}
              </button>
              <button
                className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                type="button"
                onClick={confirmCreate}
                data-testid="ai-rough-cut-confirm"
              >
                {t.confirmCreate}
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center py-8" data-testid="ai-rough-cut-done">
            <div className="text-sm text-green-700 font-medium">{t.applied}</div>
            <button
              className="mt-4 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              onClick={onClose}
              data-testid="ai-rough-cut-done-close"
            >
              {zhCN.common.close}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
