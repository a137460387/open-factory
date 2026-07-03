import { useState } from 'react';
import { useSafeTimeout } from '../hooks/useSafeTimeout';
import type { Project, LoudnessSuggestion, PlatformTarget } from '@open-factory/editor-core';
import { PLATFORM_TARGETS, calculateGainDelta, shouldSuggestGain } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';

const t = zhCN.exportDialog.aiLoudnessSuggestion;

export function AILoudnessSuggestionSection({ project, onApply }: { project: Project; onApply?: (s: LoudnessSuggestion) => void }) {
  const existing = project.loudnessSuggestion;
  const safeTimeout = useSafeTimeout();
  const [suggestion, setSuggestion] = useState<LoudnessSuggestion | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [targetPlatform, setTargetPlatform] = useState<PlatformTarget>(existing?.targetPlatform ?? 'youtube');

  const handleMeasure = () => {
    if (existing) { setSuggestion(existing); return; }
    setMeasuring(true);
    safeTimeout(() => setMeasuring(false), 300);
  };

  const targetLUFS = PLATFORM_TARGETS[targetPlatform];
  const currentGain = suggestion ? calculateGainDelta(suggestion.measuredLUFS, targetLUFS) : 0;
  const showSuggestion = suggestion != null && shouldSuggestGain(currentGain);
  const applied = suggestion?.appliedAt != null;

  const handleApply = () => {
    if (!suggestion) return;
    const updated: LoudnessSuggestion = { ...suggestion, targetPlatform, targetLUFS, suggestedGainDb: currentGain, appliedAt: Date.now() };
    setSuggestion(updated);
    onApply?.(updated);
  };

  return (
    <details className="rounded-md border border-line p-3" data-testid="ai-loudness-section">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700">
        <span>{t.title}</span>
        {applied && <span className="text-[11px] font-normal text-green-600">{t.applied}</span>}
      </summary>
      <div className="mt-3 space-y-3 text-xs">
        {!suggestion && !measuring && (
          <button className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" type="button" onClick={handleMeasure} data-testid="ai-loudness-measure">
            {t.measure}
          </button>
        )}
        {measuring && <div className="text-sm text-slate-500">{t.measuring}</div>}
        {suggestion && (
          <div data-testid="ai-loudness-result">
            <div className="text-slate-600">{t.measured(suggestion.measuredLUFS)}</div>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-slate-600">目标平台</label>
              <select className="rounded-md border border-line bg-white px-2 py-1 text-sm" value={targetPlatform} disabled={applied} data-testid="ai-loudness-platform-select" onChange={(e) => setTargetPlatform(e.target.value as PlatformTarget)}>
                {Object.entries(PLATFORM_TARGETS).map(([key, lufs]) => (
                  <option key={key} value={key}>{t.platforms[key as PlatformTarget]} ({lufs} LUFS)</option>
                ))}
              </select>
            </div>
            <div className="mt-1 text-slate-600">{t.target(t.platforms[targetPlatform], targetLUFS)}</div>
            {showSuggestion && !applied && (
              <>
                <div className="mt-2 font-medium text-orange-600">{t.suggestedGain(currentGain)}</div>
                <button className="mt-2 w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" type="button" onClick={handleApply} data-testid="ai-loudness-apply">
                  {t.apply}
                </button>
              </>
            )}
            {!showSuggestion && <div className="mt-2 text-green-600">{t.noSuggestion}</div>}
          </div>
        )}
      </div>
    </details>
  );
}
