import { useState, useCallback, useRef } from 'react';
import type { Project } from '@open-factory/editor-core';
import {
  isVisionCapable,
  isProviderConfigured,
  buildSummaryFrameTimestamps,
  buildSummaryDataPack,
  buildSummarySystemPrompt,
  buildSummaryUserPrompt,
  parseVideoSummaryResponse,
  generateSummaryHtml,
  generateSummaryFilename,
  type VideoSummaryResult
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey, extractAiFrames, saveFileDialog, writeVideoSummary } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';

const t = zhCN.aiVideoSummary;
const SUMMARY_FRAME_COUNT = 8;

type SummaryPhase = 'idle' | 'extracting' | 'analyzing' | 'done';

export function AIVideoSummaryPanel({ project, onClose }: { project: Project; onClose(): void }) {
  const providers = useAISettingsStore((s) => s.providers);
  const serviceMapping = useAISettingsStore((s) => s.serviceMapping);
  const visionProviders = providers.filter(
    (p) => p.enabled && isProviderConfigured(p) && isVisionCapable(p.defaultModel)
  );
  const defaultProviderId = serviceMapping['video-summary'] ?? serviceMapping['vision-analysis'] ?? '';
  const defaultProvider = visionProviders.find((p) => p.id === defaultProviderId) ?? visionProviders[0];

  const [selectedProviderId, setSelectedProviderId] = useState<string>(defaultProvider?.id ?? '');
  const [phase, setPhase] = useState<SummaryPhase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<VideoSummaryResult | null>(null);
  const abortRef = useRef(false);

  const selectedProvider = visionProviders.find((p) => p.id === selectedProviderId) ?? defaultProvider;

  const duration = project.timeline.tracks.flatMap((tr) => tr.clips).reduce((max, c) => Math.max(max, c.start + c.duration), 0);
  const frameTimes = buildSummaryFrameTimestamps(duration, SUMMARY_FRAME_COUNT);

  const startGeneration = useCallback(async () => {
    if (!selectedProvider) return;
    abortRef.current = false;
    setPhase('extracting');
    setProgress({ done: 0, total: SUMMARY_FRAME_COUNT + 1 });

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) { setPhase('idle'); return; }

      const { frames } = await extractAiFrames({ sourcePath: project.media[0]?.path ?? '', times: frameTimes });
      if (abortRef.current) { setPhase('idle'); return; }

      setPhase('analyzing');
      setProgress({ done: SUMMARY_FRAME_COUNT, total: SUMMARY_FRAME_COUNT + 1 });

      const dataPack = buildSummaryDataPack(project);
      const imageContent = frames.map((b64) => ({
        type: 'image_url' as const,
        image_url: { url: `data:image/jpeg;base64,${b64}` }
      }));

      const messages = [
        { role: 'system' as const, content: buildSummarySystemPrompt() },
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: buildSummaryUserPrompt(dataPack) },
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
          maxTokens: 4096,
          temperature: 0.3,
          timeoutSecs: 120
        },
        apiKey
      );

      if (abortRef.current) { setPhase('idle'); return; }

      const parsed = parseVideoSummaryResponse(JSON.parse(response.content));
      setResult(parsed);
      setPhase('done');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.errorTitle,
        message: error instanceof Error ? error.message : t.errorMessage
      });
      setPhase('idle');
    }
  }, [selectedProvider, project, frameTimes]);

  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
    setPhase('idle');
  }, []);

  const exportHtml = useCallback(async () => {
    if (!result) return;
    try {
      const defaultFilename = generateSummaryFilename(project.name);
      const savePath = await saveFileDialog(defaultFilename, [{ name: 'HTML', extensions: ['html'] }]);
      if (!savePath) return;
      const html = generateSummaryHtml(result, project.name, []);
      await writeVideoSummary(savePath, html);
      showToast({ kind: 'success', title: t.saveSuccess, message: savePath });
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.saveFailed,
        message: error instanceof Error ? error.message : t.saveFailedMessage
      });
    }
  }, [result, project.name]);

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="ai-video-summary-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-xs font-semibold text-slate-700">{t.title}</span>
        <button
          className="rounded p-1 text-slate-400 hover:bg-panel hover:text-slate-700"
          type="button"
          onClick={onClose}
          data-testid="ai-video-summary-close"
        >
          x
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {phase === 'idle' && !result && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs text-slate-600">{t.selectProvider}</label>
              <select
                className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm"
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                disabled={visionProviders.length === 0}
                data-testid="ai-video-summary-provider-select"
              >
                {visionProviders.length === 0 && <option value="">{t.noProvider}</option>}
                {visionProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">
              抽帧: {frameTimes.length} 帧
            </div>
            <button
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!selectedProvider}
              onClick={() => void startGeneration()}
              data-testid="ai-video-summary-start"
            >
              {t.startGenerate}
            </button>
          </div>
        )}

        {(phase === 'extracting' || phase === 'analyzing') && (
          <div className="space-y-2">
            <div className="text-xs text-slate-600" data-testid="ai-video-summary-progress">
              {phase === 'extracting' ? t.extractingFrames : t.analyzing}
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
              onClick={cancelGeneration}
              data-testid="ai-video-summary-cancel"
            >
              {t.cancel}
            </button>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="space-y-3" data-testid="ai-video-summary-result">
            <div className="text-xs font-semibold text-slate-700">{result.title || project.name}</div>
            {result.summary && (
              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{result.summary}</div>
            )}
            {result.scenes.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-600">场景 ({result.scenes.length})</div>
                {result.scenes.map((scene, i) => (
                  <div key={i} className="flex gap-2 text-xs text-slate-700">
                    <span className="font-mono text-blue-600">{scene.time.toFixed(1)}s</span>
                    <span>{scene.description}</span>
                  </div>
                ))}
              </div>
            )}
            {result.emotionArc && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-600">情绪弧线</div>
                <div className="text-xs text-slate-700">{result.emotionArc}</div>
              </div>
            )}
            {result.keyMoments.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-600">关键时刻</div>
                {result.keyMoments.map((km, i) => (
                  <div key={i} className="flex gap-2 text-xs text-slate-700">
                    <span className="font-mono text-amber-600">{km.time.toFixed(1)}s</span>
                    <span>{km.description}</span>
                  </div>
                ))}
              </div>
            )}
            {result.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.tags.map((tag, i) => (
                  <span key={i} className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <button
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              type="button"
              onClick={() => void exportHtml()}
              data-testid="ai-video-summary-export"
            >
              {t.exportHtml}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
