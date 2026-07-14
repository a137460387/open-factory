import { useState, useCallback, useRef } from 'react';
import type { Project, NarrationStyle, NarrationSegment } from '@open-factory/editor-core';
import {
  NARRATION_STYLES,
  isProviderConfigured,
  buildChaptersFromMarkers,
  buildNarrationSystemPrompt,
  buildNarrationUserPrompt,
  parseNarrationResponse,
  buildTtsRequests,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';

const t = zhCN.aiNarration;

const STYLE_LABELS: Record<NarrationStyle, string> = {
  commentary: t.styleCommentary,
  advertisement: t.styleAdvertisement,
  documentary: t.styleDocumentary,
  'social-media': t.styleSocialMedia,
};

type NarrationPhase = 'idle' | 'generating' | 'done';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m) + ':' + String(s).padStart(2, '0');
}

export function AINarrationPanel({ project, onClose }: { project: Project; onClose(): void }) {
  const providers = useAISettingsStore((s) => s.providers);
  const serviceMapping = useAISettingsStore((s) => s.serviceMapping);
  const textProviders = providers.filter((p) => p.enabled && isProviderConfigured(p));
  const defaultProviderId = serviceMapping['narration-script'] ?? 'openai';
  const defaultProvider = textProviders.find((p) => p.id === defaultProviderId) ?? textProviders[0];

  const [selectedProviderId, setSelectedProviderId] = useState<string>(defaultProvider?.id ?? '');
  const [selectedStyle, setSelectedStyle] = useState<NarrationStyle>('commentary');
  const [phase, setPhase] = useState<NarrationPhase>('idle');
  const [segments, setSegments] = useState<NarrationSegment[]>([]);
  const abortRef = useRef(false);

  const selectedProvider = textProviders.find((p) => p.id === selectedProviderId) ?? defaultProvider;

  const totalDuration = project.timeline.tracks
    .flatMap((tr) => tr.clips)
    .reduce((max, c) => Math.max(max, c.start + c.duration), 0);

  const markers = project.timeline.markers ?? [];

  const buildSubtitleTextMap = useCallback((): Map<number, string> => {
    const map = new Map<number, string>();
    for (const track of project.timeline.tracks) {
      for (const clip of track.clips) {
        if (clip.type === 'subtitle' && clip.text) {
          const key = clip.start;
          const existing = map.get(key) ?? '';
          map.set(key, existing ? existing + ' ' + clip.text : clip.text);
        }
      }
    }
    return map;
  }, [project.timeline.tracks]);

  const startGeneration = useCallback(async () => {
    if (!selectedProvider) return;
    abortRef.current = false;
    setPhase('generating');

    try {
      const chapters =
        markers.length > 0
          ? buildChaptersFromMarkers(markers, totalDuration, new Map(), buildSubtitleTextMap())
          : [
              {
                time: 0,
                duration: totalDuration,
                label: '',
                sceneDescription: '',
                subtitleText: buildSubtitleTextMap().get(0) ?? '',
              },
            ];

      const isChinese = true;
      const systemPrompt = buildNarrationSystemPrompt(selectedStyle, isChinese);
      const userPrompt = buildNarrationUserPrompt(chapters);

      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) {
        setPhase('idle');
        return;
      }

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ];

      const response = await callAiApi(
        {
          providerId: selectedProvider.id,
          baseUrl: selectedProvider.baseUrl,
          model: selectedProvider.defaultModel,
          messages,
          customHeaders: selectedProvider.customHeaders,
          maxTokens: 4096,
          temperature: 0.7,
          timeoutSecs: 120,
        },
        apiKey,
      );

      if (abortRef.current) {
        setPhase('idle');
        return;
      }

      const parsed = parseNarrationResponse(JSON.parse(response.content));
      setSegments(parsed);
      setPhase('done');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.errorTitle,
        message: error instanceof Error ? error.message : t.errorMessage,
      });
      setPhase('idle');
    }
  }, [selectedProvider, selectedStyle, markers, totalDuration, buildSubtitleTextMap]);

  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
    setPhase('idle');
  }, []);

  const updateSegmentText = useCallback((index: number, text: string) => {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, text } : s)));
  }, []);

  const updateSegmentNote = useCallback((index: number, speakerNote: string) => {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, speakerNote } : s)));
  }, []);

  const handleSendToTts = useCallback(() => {
    if (segments.length === 0) return;
    const voiceId = useAISettingsStore.getState().ttsVoiceId || 'default';
    const requests = buildTtsRequests(segments, voiceId);
    showToast({
      kind: 'info',
      title: t.sendToTts,
      message: String(requests.length) + ' segments',
    });
  }, [segments]);

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="ai-narration-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-xs font-semibold text-slate-700">{t.title}</span>
        <button
          className="rounded p-1 text-slate-400 hover:bg-panel hover:text-slate-700"
          type="button"
          onClick={onClose}
          data-testid="ai-narration-close"
        >
          x
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {phase === 'idle' && segments.length === 0 && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs text-slate-600">{t.selectStyle}</label>
              <select
                className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm"
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value as NarrationStyle)}
                data-testid="ai-narration-style-select"
              >
                {NARRATION_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {STYLE_LABELS[style]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-600">{t.selectProvider}</label>
              <select
                className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm"
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                disabled={textProviders.length === 0}
                data-testid="ai-narration-provider-select"
              >
                {textProviders.length === 0 && <option value="">{t.noProvider}</option>}
                {textProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">
              {markers.length > 0 ? t.chapterCount(markers.length) : t.noMarkers}
            </div>
            <button
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!selectedProvider}
              onClick={() => void startGeneration()}
              data-testid="ai-narration-generate"
            >
              {t.generate}
            </button>
          </div>
        )}

        {phase === 'generating' && (
          <div className="space-y-2">
            <div className="text-xs text-slate-600" data-testid="ai-narration-progress">
              {t.generating}
            </div>
            <button
              className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              onClick={cancelGeneration}
              data-testid="ai-narration-cancel"
            >
              {t.cancel}
            </button>
          </div>
        )}

        {(phase === 'done' || (phase === 'idle' && segments.length > 0)) && (
          <div className="space-y-3" data-testid="ai-narration-result">
            {segments.map((seg, i) => (
              <div key={i} className="rounded-md border border-line p-2 space-y-1">
                <div className="flex items-center gap-2 text-[11px] text-blue-600 font-mono">
                  <span>
                    {t.timeRange}: {formatTime(seg.markerTime)} - {formatTime(seg.markerTime + seg.duration)}
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-500">{t.text}</label>
                  <textarea
                    className="w-full rounded border border-line bg-white px-2 py-1 text-sm resize-none"
                    rows={3}
                    value={seg.text}
                    onChange={(e) => updateSegmentText(i, e.target.value)}
                    data-testid={`ai-narration-text-${i}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-500">{t.speakerNote}</label>
                  <input
                    className="w-full rounded border border-line bg-white px-2 py-1 text-xs"
                    value={seg.speakerNote}
                    onChange={(e) => updateSegmentNote(i, e.target.value)}
                    data-testid={`ai-narration-note-${i}`}
                  />
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-panel"
                type="button"
                onClick={() => {
                  setSegments([]);
                  setPhase('idle');
                }}
                data-testid="ai-narration-regenerate"
              >
                {t.regenerate}
              </button>
              <button
                className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                type="button"
                onClick={handleSendToTts}
                data-testid="ai-narration-send-tts"
              >
                {t.sendToTts}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
