import { useState, useCallback, useRef } from 'react';
import { useSafeTimeout } from '../../hooks/useSafeTimeout';
import type { MediaAsset } from '@open-factory/editor-core';
import {
  buildMusicMatchSystemPrompt,
  buildMusicMatchUserPrompt,
  parseMusicMatchResponse,
  rankAudioByMoodSimilarity,
  calculateAudioLoopOrTrimToDuration,
  isProviderConfigured,
  type MusicMatchResult,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';

const t = zhCN.musicMatch;

type Phase = 'idle' | 'analyzing' | 'result';

export function MusicMatchPanel({
  media,
  sequenceDuration,
  onClose,
}: {
  media: MediaAsset[];
  sequenceDuration: number;
  onClose: () => void;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const textProviders = providers.filter((p) => p.enabled && isProviderConfigured(p));
  const [selectedProviderId, setSelectedProviderId] = useState(textProviders[0]?.id ?? '');
  const selectedProvider = textProviders.find((p) => p.id === selectedProviderId) ?? textProviders[0];

  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<MusicMatchResult | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(false);

  const audioAssets = media.filter((m) => m.type === 'audio');
  const recommendations = result ? rankAudioByMoodSimilarity(result.mood, audioAssets) : [];

  const startAnalysis = useCallback(async () => {
    if (!selectedProvider) return;
    abortRef.current = false;

    try {
      setPhase('analyzing');
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) {
        setPhase('idle');
        return;
      }

      const mediaInfo = media.map((m) => ({
        mediaId: m.id,
        filename: m.name,
        type: m.type,
        duration: m.duration,
        mood: m.aiAnalysis?.mood,
      }));

      const systemPrompt = buildMusicMatchSystemPrompt();
      const userPrompt = buildMusicMatchUserPrompt(description || '视频内容分析', mediaInfo);

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
        setPhase('idle');
        return;
      }

      const parsed = parseMusicMatchResponse(JSON.parse(response.content));
      if (!parsed) {
        showToast({ kind: 'info', title: 'AI未返回有效分析结果' });
        setPhase('idle');
        return;
      }

      setResult(parsed);
      setPhase('result');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage,
      });
      setPhase('idle');
    }
  }, [selectedProvider, media, description]);

  const cancelAnalysis = useCallback(() => {
    abortRef.current = true;
    setPhase('idle');
  }, []);

  const safeTimeout = useSafeTimeout();
  const copyKeywords = useCallback(async () => {
    if (!result) return;
    const allKeywords = [...result.keywords, ...result.searchSuggestions].join('、');
    try {
      await navigator.clipboard.writeText(allKeywords);
      setCopied(true);
      showToast({ kind: 'success', title: t.copied });
      safeTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ kind: 'error', title: '复制失败' });
    }
  }, [result]);

  return (
    <div className="flex flex-col h-full" data-testid="music-match-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
        <button
          className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-panel"
          type="button"
          onClick={onClose}
          data-testid="music-match-close"
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
                data-testid="music-match-provider"
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
              <label className="block text-xs text-slate-600 mb-1">视频描述（可选）</label>
              <textarea
                className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm resize-none"
                rows={2}
                placeholder="描述视频内容，帮助AI更好地分析"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="music-match-description"
              />
            </div>
            <button
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              type="button"
              disabled={!selectedProvider || media.length === 0}
              onClick={() => void startAnalysis()}
              data-testid="music-match-start"
            >
              {t.startAnalysis}
            </button>
            {media.length === 0 && <div className="text-xs text-slate-500 text-center">媒体库为空</div>}
          </>
        )}

        {phase === 'analyzing' && (
          <div className="space-y-2">
            <div className="text-xs text-slate-600" data-testid="music-match-analyzing">
              {t.analyzing}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-blue-600 animate-pulse" style={{ width: '60%' }} />
            </div>
            <button
              className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              onClick={cancelAnalysis}
              data-testid="music-match-cancel"
            >
              取消
            </button>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="space-y-3" data-testid="music-match-result">
            <div className="rounded-md border border-line bg-white p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-700">{t.analysisComplete}</div>
              <div className="text-xs">
                <span className="text-slate-500">{t.mood}：</span>
                <span className="text-slate-800">{result.mood}</span>
              </div>
              <div className="text-xs">
                <span className="text-slate-500">{t.tempo}：</span>
                <span className="text-slate-800">
                  {result.tempo === 'fast' ? t.tempoFast : result.tempo === 'medium' ? t.tempoMedium : t.tempoSlow}
                </span>
              </div>
              {result.genres.length > 0 && (
                <div className="text-xs">
                  <span className="text-slate-500">{t.genres}：</span>
                  <span className="text-slate-800">{result.genres.join('、')}</span>
                </div>
              )}
            </div>

            {(result.keywords.length > 0 || result.searchSuggestions.length > 0) && (
              <div className="rounded-md border border-line bg-white p-3 space-y-2">
                <div className="text-xs font-semibold text-slate-700">{t.keywords}</div>
                <div className="flex flex-wrap gap-1">
                  {result.keywords.map((kw, i) => (
                    <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                      {kw}
                    </span>
                  ))}
                  {result.searchSuggestions.map((kw, i) => (
                    <span key={`s${i}`} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                      {kw}
                    </span>
                  ))}
                </div>
                <button
                  className="rounded-md border border-line bg-white px-2 py-1 text-xs font-medium hover:bg-panel"
                  type="button"
                  onClick={() => void copyKeywords()}
                  data-testid="music-match-copy-keywords"
                >
                  {copied ? t.copied : t.copyKeywords}
                </button>
              </div>
            )}

            {recommendations.length > 0 && (
              <div className="rounded-md border border-line bg-white p-3 space-y-2">
                <div className="text-xs font-semibold text-slate-700">{t.mediaLibraryRecommendations}</div>
                {recommendations.slice(0, 10).map((rec) => {
                  const loopInfo =
                    sequenceDuration > 0
                      ? calculateAudioLoopOrTrimToDuration(
                          audioAssets.find((a) => a.id === rec.mediaId)?.duration ?? 0,
                          sequenceDuration,
                        )
                      : null;
                  return (
                    <div
                      key={rec.mediaId}
                      className="flex items-center justify-between rounded-md border border-line p-2 text-xs"
                      data-testid={`music-match-rec-${rec.mediaId}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-800 truncate">{rec.filename}</div>
                        {rec.mood && <div className="text-slate-500">{rec.mood}</div>}
                        {loopInfo && sequenceDuration > 0 && (
                          <div className="text-slate-400">{t.audioLoopInfo(loopInfo.loops, loopInfo.trimEnd)}</div>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 shrink-0">{(rec.similarity * 100).toFixed(0)}%</div>
                    </div>
                  );
                })}
              </div>
            )}

            {audioAssets.length === 0 && (
              <div className="text-xs text-slate-500 text-center py-2">{t.noAudioAssets}</div>
            )}

            <button
              className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              onClick={() => {
                setPhase('idle');
                setResult(null);
              }}
              data-testid="music-match-retry"
            >
              重新分析
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
