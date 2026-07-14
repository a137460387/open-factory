import { useState, useCallback, useRef } from 'react';
import type { MediaAsset, Clip } from '@open-factory/editor-core';
import {
  scoreAllHighlightClips,
  extractTopHighlightClips,
  scoreAIMoodKeywords,
  buildHighlightReelSystemPrompt,
  buildHighlightReelUserPrompt,
  parseHighlightReelResponse,
  isProviderConfigured,
  createId,
  createBaseClip,
  BatchAddClipsCommand,
  type HighlightScoreWeights,
  type HighlightScore,
  DEFAULT_HIGHLIGHT_WEIGHTS,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { showToast } from '../../lib/toast';

const t = zhCN.highlightReel;

const DURATION_OPTIONS = [15, 30, 60] as const;

type Phase = 'config' | 'generating' | 'result';
type SourceScope = 'all' | 'selected';

export function HighlightReelPanel({
  media,
  clips,
  selectedClipIds,
  onClose,
}: {
  media: MediaAsset[];
  clips: Clip[];
  selectedClipIds: string[];
  onClose: () => void;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const textProviders = providers.filter((p) => p.enabled && isProviderConfigured(p));
  const [selectedProviderId, setSelectedProviderId] = useState(textProviders[0]?.id ?? '');
  const selectedProvider = textProviders.find((p) => p.id === selectedProviderId) ?? textProviders[0];

  const [targetDuration, setTargetDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState('');
  const [weights, setWeights] = useState<HighlightScoreWeights>({ ...DEFAULT_HIGHLIGHT_WEIGHTS });
  const [sourceScope, setSourceScope] = useState<SourceScope>('all');
  const [phase, setPhase] = useState<Phase>('config');
  const [scores, setScores] = useState<HighlightScore[]>([]);
  const [selection, setSelection] = useState<ReturnType<typeof extractTopHighlightClips> | null>(null);
  const [transitionNotes, setTransitionNotes] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const abortRef = useRef(false);

  const effectiveDuration = targetDuration === -1 ? Number(customDuration) || 30 : targetDuration;

  const sourceClips =
    sourceScope === 'selected' && selectedClipIds.length > 0
      ? clips.filter((c) => selectedClipIds.includes(c.id))
      : clips;

  const generate = useCallback(async () => {
    if (sourceClips.length === 0) {
      showToast({ kind: 'info', title: t.noClips });
      return;
    }
    abortRef.current = false;
    setPhase('generating');

    try {
      // Score all clips locally
      const mediaById = new Map(media.map((m) => [m.id, m]));
      const inputs = sourceClips.map((clip) => {
        const asset = 'mediaId' in clip ? mediaById.get(clip.mediaId as string) : undefined;
        return {
          clipId: clip.id,
          visualScore: 0.5,
          loudnessScore: 0.5,
          aiScore: asset?.aiAnalysis?.mood ? scoreAIMoodKeywords(asset.aiAnalysis.mood) : 0,
        };
      });

      const scored = scoreAllHighlightClips(inputs, weights);
      setScores(scored);

      const clipDurations = new Map(sourceClips.map((c) => [c.id, c.duration]));
      const topSelection = extractTopHighlightClips(scored, clipDurations, effectiveDuration);

      if (selectedProvider && description.trim()) {
        // AI-assisted refinement
        try {
          const apiKey = await readAiApiKey(selectedProvider.id);
          if (abortRef.current) {
            setPhase('config');
            return;
          }

          const candidates = topSelection.selected.map((s) => {
            const asset =
              'mediaId' in (sourceClips.find((c) => c.id === s.clipId) ?? {})
                ? mediaById.get(
                    (sourceClips.find((c) => c.id === s.clipId) as Clip & { mediaId?: string })?.mediaId ?? '',
                  )
                : undefined;
            return {
              clipId: s.clipId,
              duration: clipDurations.get(s.clipId) ?? 0,
              totalScore: s.totalScore,
              mood: asset?.aiAnalysis?.mood,
            };
          });

          const systemPrompt = buildHighlightReelSystemPrompt();
          const userPrompt = buildHighlightReelUserPrompt(description, candidates);

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
              maxTokens: 2048,
              temperature: 0.3,
            },
            apiKey,
          );
          if (abortRef.current) {
            setPhase('config');
            return;
          }

          const aiResult = parseHighlightReelResponse(JSON.parse(response.content));
          if (aiResult.selectedIds.length > 0) {
            const aiFiltered = scored.filter((s) => aiResult.selectedIds.includes(s.clipId));
            const aiSelection = extractTopHighlightClips(aiFiltered, clipDurations, effectiveDuration);
            setSelection(aiSelection);
            setTransitionNotes(aiResult.transitionNotes);
          } else {
            setSelection(topSelection);
          }
        } catch {
          // Fallback to local scoring
          setSelection(topSelection);
        }
      } else {
        setSelection(topSelection);
      }

      setPhase('result');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage,
      });
      setPhase('config');
    }
  }, [sourceClips, media, weights, effectiveDuration, selectedProvider, description]);

  const cancelGenerate = useCallback(() => {
    abortRef.current = true;
    setPhase('config');
  }, []);

  const applyHighlightReel = useCallback(() => {
    if (!selection || selection.selected.length === 0) return;

    try {
      const trackId = createId();
      const mediaMap = new Map(media.map((m) => [m.id, m]));
      const clipMap = new Map(sourceClips.map((c) => [c.id, c]));
      let cursor = 0;

      const newClips: Clip[] = selection.selected.map((score, index) => {
        const clip = clipMap.get(score.clipId);
        if (!clip) throw new Error(`Clip not found: ${score.clipId}`);
        const asset =
          'mediaId' in clip ? mediaMap.get((clip as Clip & { mediaId?: string }).mediaId as string) : undefined;
        const clipDuration = clip.duration;
        const base = createBaseClip({
          id: createId(),
          name: `精彩片段${index + 1}${asset ? ` - ${asset.name}` : ''}`,
          trackId,
          start: cursor,
          duration: clipDuration,
          trimStart: 0,
          trimEnd: 0,
        });
        cursor += clipDuration;
        if (clip.type === 'video')
          return {
            ...base,
            type: 'video' as const,
            mediaId: (clip as Clip & { mediaId?: string }).mediaId as string,
            volume: 1,
          };
        if (clip.type === 'image')
          return { ...base, type: 'image' as const, mediaId: (clip as Clip & { mediaId?: string }).mediaId as string };
        return {
          ...base,
          type: 'audio' as const,
          mediaId: (clip as Clip & { mediaId?: string }).mediaId as string,
          volume: 1,
        };
      });

      const trackType = newClips.some((c) => c.type === 'video' || c.type === 'image')
        ? ('video' as const)
        : ('audio' as const);
      commandManager.execute(
        new BatchAddClipsCommand(timelineAccessor, newClips, [{ id: trackId, name: 'AI精彩集锦', type: trackType }]),
      );

      showToast({
        kind: 'success',
        title: t.generated,
        message: t.generatedMessage(selection.selected.length),
      });
      setPhase('config');
      onClose();
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage,
      });
    }
  }, [selection, media, sourceClips, onClose]);

  return (
    <div className="flex flex-col h-full" data-testid="highlight-reel-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
        <button
          className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-panel"
          type="button"
          onClick={onClose}
          data-testid="highlight-reel-close"
        >
          {zhCN.common.close}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {phase === 'config' && (
          <>
            <div>
              <label className="block text-xs text-slate-600 mb-1">{t.targetDuration}</label>
              <div className="flex gap-1 flex-wrap">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${targetDuration === d ? 'bg-blue-600 text-white' : 'bg-white border border-line text-slate-700 hover:bg-panel'}`}
                    type="button"
                    onClick={() => setTargetDuration(d)}
                    data-testid={`highlight-reel-duration-${d}`}
                  >
                    {d}s
                  </button>
                ))}
                <button
                  className={`rounded-md px-2 py-1 text-xs font-medium ${targetDuration === -1 ? 'bg-blue-600 text-white' : 'bg-white border border-line text-slate-700 hover:bg-panel'}`}
                  type="button"
                  onClick={() => setTargetDuration(-1)}
                  data-testid="highlight-reel-duration-custom"
                >
                  {t.customDuration}
                </button>
              </div>
              {targetDuration === -1 && (
                <input
                  type="number"
                  className="mt-1 w-24 rounded-md border border-line bg-white px-2 py-1 text-xs"
                  min={5}
                  max={600}
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  data-testid="highlight-reel-custom-duration"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-slate-600">{t.weights}</label>
              {[
                { key: 'visual' as const, label: t.weightVisual },
                { key: 'loudness' as const, label: t.weightLoudness },
                { key: 'aiContent' as const, label: t.weightAiContent },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 w-16 shrink-0">{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(weights[key] * 100)}
                    onChange={(e) => setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) / 100 }))}
                    className="flex-1"
                    data-testid={`highlight-reel-weight-${key}`}
                  />
                  <span className="text-xs text-slate-500 w-8 text-right">{Math.round(weights[key] * 100)}%</span>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">{t.sourceScope}</label>
              <div className="flex gap-1">
                <button
                  className={`rounded-md px-2 py-1 text-xs font-medium ${sourceScope === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-line text-slate-700 hover:bg-panel'}`}
                  type="button"
                  onClick={() => setSourceScope('all')}
                  data-testid="highlight-reel-source-all"
                >
                  {t.sourceAll}
                </button>
                <button
                  className={`rounded-md px-2 py-1 text-xs font-medium ${sourceScope === 'selected' ? 'bg-blue-600 text-white' : 'bg-white border border-line text-slate-700 hover:bg-panel'} ${selectedClipIds.length === 0 ? 'opacity-50' : ''}`}
                  type="button"
                  onClick={() => setSourceScope('selected')}
                  disabled={selectedClipIds.length === 0}
                  data-testid="highlight-reel-source-selected"
                >
                  {t.sourceSelected}
                </button>
              </div>
            </div>

            {textProviders.length > 0 && (
              <>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">AI辅助（可选）</label>
                  <select
                    className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm"
                    value={selectedProviderId}
                    onChange={(e) => setSelectedProviderId(e.target.value)}
                    data-testid="highlight-reel-provider"
                  >
                    <option value="">纯本地评分</option>
                    {textProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedProvider && (
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">目标描述（可选）</label>
                    <textarea
                      className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm resize-none"
                      rows={2}
                      placeholder="描述集锦目标，帮助AI优化选择"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      data-testid="highlight-reel-description"
                    />
                  </div>
                )}
              </>
            )}

            <button
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              type="button"
              disabled={sourceClips.length === 0}
              onClick={() => void generate()}
              data-testid="highlight-reel-generate"
            >
              {t.generate}
            </button>
          </>
        )}

        {phase === 'generating' && (
          <div className="space-y-2">
            <div className="text-xs text-slate-600" data-testid="highlight-reel-generating">
              {t.generating}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-blue-600 animate-pulse" style={{ width: '60%' }} />
            </div>
            <button
              className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              onClick={cancelGenerate}
              data-testid="highlight-reel-cancel"
            >
              {t.cancel}
            </button>
          </div>
        )}

        {phase === 'result' && selection && (
          <div className="space-y-3" data-testid="highlight-reel-result">
            <div className="rounded-md border border-line bg-white p-3 space-y-1">
              <div className="text-xs font-semibold text-slate-700">{t.selectedClips(selection.selected.length)}</div>
              <div className="text-xs text-slate-500">{t.totalDuration(selection.totalDuration)}</div>
            </div>

            {transitionNotes.length > 0 && (
              <div className="rounded-md border border-line bg-white p-3 space-y-1">
                <div className="text-xs font-semibold text-slate-700">{t.transitionNotes}</div>
                {transitionNotes.map((note, i) => (
                  <div key={i} className="text-xs text-slate-600">
                    {note}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {selection.selected.map((score, i) => {
                const clip = sourceClips.find((c) => c.id === score.clipId);
                return (
                  <div
                    key={score.clipId}
                    className="flex items-center justify-between rounded-md border border-line bg-white p-2 text-xs"
                    data-testid={`highlight-reel-item-${i}`}
                  >
                    <span className="font-medium text-slate-800 truncate">片段 {i + 1}</span>
                    <span className="text-slate-500 shrink-0">
                      {score.totalScore.toFixed(2)} · {(clip?.duration ?? 0).toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
                type="button"
                onClick={() => {
                  setPhase('config');
                  setSelection(null);
                }}
                data-testid="highlight-reel-back"
              >
                {zhCN.common.back}
              </button>
              <button
                className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                type="button"
                onClick={applyHighlightReel}
                data-testid="highlight-reel-apply"
              >
                {t.generated}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
