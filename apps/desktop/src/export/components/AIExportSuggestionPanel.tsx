import {
  isProviderConfigured,
  buildExportProjectInfo,
  buildExportOptimizationSystemPrompt,
  buildExportOptimizationUserPrompt,
  parseExportOptimizationResponse,
  sortExportSuggestionsByPriority,
  EXPORT_SUGGESTION_CACHE_TTL_MS,
  type AIExportSuggestion,
  type Project,
} from '@open-factory/editor-core';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { zhCN } from '../../i18n/strings';
import { Loader2 } from 'lucide-react';
import { priorityLabel } from '../lib/exportFormatHelpers';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { useAISettingsStore } from '../../store/aiSettingsStore';

export function AIExportSuggestionPanel({
  project,
  draftSettings,
  setDraftSettings,
}: {
  project: Project;
  draftSettings: ExportPresetSettings;
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>;
}) {
  const t = zhCN.aiExportSuggestion;
  const providers = useAISettingsStore((s) => s.providers);
  const serviceMapping = useAISettingsStore((s) => s.serviceMapping);
  const providerId = serviceMapping['export-suggestion'];
  const provider = providers.find((p) => p.id === providerId && p.enabled && isProviderConfigured(p));

  const [expanded, setExpanded] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'analyzing'>('idle');
  const [suggestions, setSuggestions] = useState<AIExportSuggestion[]>([]);

  async function runAnalysis() {
    if (!provider) return;
    const cacheKey = JSON.stringify({
      p: project.settings,
      d: {
        f: draftSettings.format,
        vc: draftSettings.videoCodec,
        vb: draftSettings.videoBitrate,
        ab: draftSettings.audioBitrate,
      },
    });
    if (
      aiExportSuggestionCache &&
      aiExportSuggestionCache.key === cacheKey &&
      Date.now() - aiExportSuggestionCache.ts < EXPORT_SUGGESTION_CACHE_TTL_MS
    ) {
      setSuggestions(aiExportSuggestionCache.data);
      return;
    }
    setPhase('analyzing');
    try {
      const apiKey = await readAiApiKey(provider.id);
      const projectInfo = buildExportProjectInfo(
        project as unknown as {
          settings: { width: number; height: number; fps: number };
          timeline: { tracks: Array<{ type: string; clips: Array<Record<string, unknown>> }> };
        },
      );
      const systemPrompt = buildExportOptimizationSystemPrompt();
      const userPrompt = buildExportOptimizationUserPrompt(projectInfo, {
        ...draftSettings,
        videoBitrate: draftSettings.videoBitrate ?? undefined,
        audioBitrate: draftSettings.audioBitrate ?? undefined,
      });
      const response = await callAiApi(
        {
          providerId: provider.id,
          baseUrl: provider.baseUrl,
          model: provider.defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          customHeaders: provider.customHeaders,
          maxTokens: 4096,
          temperature: 0.3,
        },
        apiKey,
      );
      let parsed: AIExportSuggestion[] = [];
      try {
        parsed = parseExportOptimizationResponse(JSON.parse(response.content));
      } catch {
        /* ignore parse errors */
      }
      const sorted = sortExportSuggestionsByPriority(parsed);
      setSuggestions(sorted);
      aiExportSuggestionCache = { key: cacheKey, ts: Date.now(), data: sorted };
    } catch {
      setSuggestions([]);
    } finally {
      setPhase('idle');
    }
  }

  function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const isOpen = (e.target as HTMLDetailsElement).open;
    setExpanded(isOpen);
    if (isOpen && suggestions.length === 0 && phase === 'idle') {
      void runAnalysis();
    }
  }

  function applyAll() {
    for (const s of suggestions) {
      applyExportSuggestionToDraft(setDraftSettings, s, project);
    }
  }

  if (!provider) {
    return (
      <section
        className="rounded-md border border-dashed border-line bg-panel/50 px-3 py-3 text-center text-xs text-slate-500"
        data-testid="ai-export-suggestion-no-provider"
      >
        {t.noProvider}
      </section>
    );
  }

  const priorityGroups: Record<string, AIExportSuggestion[]> = { high: [], medium: [], low: [] };
  for (const s of suggestions) {
    (priorityGroups[s.priority] ?? (priorityGroups[s.priority] = [])).push(s);
  }

  return (
    <details
      className="rounded-md border border-line bg-white p-3 text-xs"
      data-testid="ai-export-suggestion-panel"
      onToggle={handleToggle}
    >
      <summary
        className="cursor-pointer select-none font-semibold text-slate-800"
        data-testid="ai-export-suggestion-toggle"
      >
        {t.title}
      </summary>
      <div className="mt-0.5 text-[11px] text-slate-500">{t.description}</div>
      {phase === 'analyzing' ? (
        <div className="mt-2 flex items-center gap-2 text-slate-500" data-testid="ai-export-suggestion-loading">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.analyzing}
        </div>
      ) : suggestions.length === 0 && expanded ? (
        <div
          className="mt-2 rounded-md border border-dashed border-line bg-panel/50 px-3 py-3 text-center text-slate-500"
          data-testid="ai-export-suggestion-empty"
        >
          {t.empty}
        </div>
      ) : suggestions.length > 0 ? (
        <div className="mt-2 space-y-3">
          {(['high', 'medium', 'low'] as const).map((pri) => {
            const group = priorityGroups[pri];
            if (!group || group.length === 0) return null;
            return (
              <div key={pri} data-testid={`ai-export-suggestion-priority-${pri}`}>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t.priorityLabels[pri]}
                </div>
                <div className="space-y-2">
                  {group.map((s, i) => (
                    <div
                      key={s.parameter + '-' + i}
                      className="rounded-md border border-line bg-panel/30 p-2"
                      data-testid={'ai-export-suggestion-' + s.parameter}
                    >
                      <div className="font-medium text-slate-800">
                        {t.parameterLabels[s.parameter as keyof typeof t.parameterLabels] ?? s.parameter}
                      </div>
                      <div className="mt-0.5 text-slate-600">
                        <span className="text-slate-500">{s.currentValue}</span>
                        <span className="mx-1 text-slate-400">&rarr;</span>
                        <span className="font-semibold text-emerald-700">{s.suggestedValue}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{s.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <button
            className="mt-2 rounded-md bg-brand px-3 py-1.5 font-semibold text-white hover:bg-[#176858]"
            type="button"
            onClick={applyAll}
            data-testid="ai-export-suggestion-apply"
          >
            {t.apply}
          </button>
          <button
            className="ml-2 rounded-md border border-line bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-panel"
            type="button"
            onClick={() => void runAnalysis()}
            data-testid="ai-export-suggestion-refresh"
          >
            {t.refresh}
          </button>
        </div>
      ) : null}
    </details>
  );
}

