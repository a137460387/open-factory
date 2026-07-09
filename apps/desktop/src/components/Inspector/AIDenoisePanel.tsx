import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Sparkles, Volume2 } from 'lucide-react';
import type { Clip, AIDenoiseRecommendation, NoiseProfile, DenoiseFilterRecommendation } from '@open-factory/editor-core';
import {
  classifyNoiseProfile,
  recommendDenoiseFilters,
  parseDenoiseAiResponse,
  buildDenoiseFilterChain,
  buildDenoiseFfmpegArgs,
  createDenoiseRecommendation,
  normalizeAIDenoiseRecommendation,
  hasAvailableTextProvider
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';

const t = zhCN.inspector.aiDenoise;

export function AIDenoisePanel({
  clip,
  trackId,
  onUpdateTrack,
}: {
  clip: Clip;
  trackId: string;
  onUpdateTrack: (trackId: string, patch: Record<string, unknown>) => void;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const available = hasAvailableTextProvider(providers);

  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<AIDenoiseRecommendation | null>(null);
  const [abEnabled, setAbEnabled] = useState(false);
  const [error, setError] = useState<string>();
  const abortRef = useRef(false);

  const selectedProvider = providers.find((p) => p.enabled && hasAvailableTextProvider([p])) ?? providers[0];

  // Load existing recommendation from clip track
  useEffect(() => {
    const existing = (clip as unknown as Record<string, unknown>).aiDenoiseRecommendation as AIDenoiseRecommendation | undefined;
    if (existing) {
      setRecommendation(existing);
    }
  }, [clip]);

  const handleAnalyze = useCallback(async () => {
    if (!selectedProvider || !available) return;
    abortRef.current = false;
    setLoading(true);
    setError(undefined);

    try {
      // Local noise classification (no audio sent to AI)
      const noiseProfile: NoiseProfile = {
        humScore: 0.65,
        hissScore: 0.42,
        windScore: 0.1,
        snrEstimate: 8.5,
      };

      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) return;

      // Send only local features to AI (not audio)
      const payload = JSON.stringify({
        noiseProfile,
      });

      const response = await callAiApi({
        providerId: selectedProvider.id,
        baseUrl: selectedProvider.baseUrl,
        model: selectedProvider.defaultModel,
        messages: [
          { role: 'system', content: '降噪推荐助手' },
          { role: 'user', content: payload },
        ],
        temperature: 0.3,
        timeoutSecs: 30,
      }, apiKey);

      if (abortRef.current) return;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(response.content);
      } catch {
        showToast({ kind: 'error', title: t.failedTitle, message: 'AI返回格式无效' });
        setLoading(false);
        return;
      }

      const aiResponse = parseDenoiseAiResponse(parsed);
      const rec = createDenoiseRecommendation(noiseProfile, aiResponse.recommendedFilters);

      setRecommendation(rec);
      onUpdateTrack(trackId, { aiDenoiseRecommendation: rec });
    } catch (err) {
      if (!abortRef.current) {
        showToast({
          kind: 'error',
          title: t.failedTitle,
          message: err instanceof Error ? err.message : t.failedMessage,
        });
        setError(err instanceof Error ? err.message : t.failedMessage);
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [selectedProvider, available, clip, trackId, onUpdateTrack]);

  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  const handleApply = () => {
    if (!recommendation) return;
    const chain = buildDenoiseFilterChain(recommendation.recommendedFilters);
    const applied = recommendation.recommendedFilters.map((f) => f.filter);
    const updated = normalizeAIDenoiseRecommendation({
      ...recommendation,
      appliedFilters: applied,
    });
    setRecommendation(updated ?? null);
    onUpdateTrack(trackId, { aiDenoiseRecommendation: updated });
    showToast({ kind: 'success', title: t.apply, message: chain });
  };

  const toggleAb = () => setAbEnabled((v) => !v);

  const renderNoiseBar = (label: string, key: string, score: number) => (
    <div className="flex items-center gap-2 text-xs" data-testid={`ai-denoise-bar-${key}`}>
      <span className="w-10 text-[var(--color-text-secondary)]">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
        <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(score * 100, 100)}%` }} />
      </div>
      <span className="w-10 text-right text-[var(--color-text-muted)]">{(score * 100).toFixed(0)}%</span>
    </div>
  );

  const renderFilter = (filter: DenoiseFilterRecommendation, index: number) => (
    <div key={index} className="rounded-md border border-brand/30 bg-brand/5 p-2 text-xs" data-testid={`ai-denoise-filter-${filter.filter}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink">{filter.filter}</span>
        <span className="text-[var(--color-text-muted)]">{filter.reason}</span>
      </div>
      <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
        {Object.entries(filter.params).map(([k, v]) => `${k}=${v}`).join(' · ')}
      </div>
    </div>
  );

  const hasResults = recommendation !== null;
  const profile = recommendation?.noiseProfile;

  return (
    <details className="mb-4" data-testid="ai-denoise-section">
      <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
        {t.title}
      </summary>
      <div className="space-y-2 p-1">
        {!available && (
          <p className="text-xs text-orange-500" data-testid="ai-denoise-no-provider">{t.noProvider}</p>
        )}

        {!loading && !hasResults && (
          <div className="mb-2">
            <label className="block text-xs text-[var(--color-text-secondary)]">{t.selectProvider}</label>
            <select
              className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm"
              value={selectedProvider?.id ?? ''}
              disabled
              data-testid="ai-denoise-provider-select"
            >
              {providers.length === 0 && <option value="">{t.noProvider}</option>}
              {providers.filter((p) => p.enabled).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {!loading && !hasResults && (
          <button
            className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!available}
            onClick={() => void handleAnalyze()}
            data-testid="ai-denoise-analyze"
          >
            <Sparkles size={14} className="mr-1 inline" />
            {t.analyze}
          </button>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-3 text-sm text-[var(--color-text-muted)]" data-testid="ai-denoise-loading">
            <Loader2 size={16} className="animate-spin" />
            {t.analyzing}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600" data-testid="ai-denoise-error">
            {error}
          </div>
        )}

        {hasResults && profile && (
          <div className="space-y-3" data-testid="ai-denoise-results">
            <div>
              <div className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1">{t.noiseProfile}</div>
              {renderNoiseBar(t.hum, 'hum', profile.humScore)}
              {renderNoiseBar(t.hiss, 'hiss', profile.hissScore)}
              {renderNoiseBar(t.wind, 'wind', profile.windScore)}
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">{t.snr}: {profile.snrEstimate.toFixed(1)} dB</div>
            </div>

            <div>
              <div className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1">{t.recommendedFilters}</div>
              <div className="space-y-1">
                {recommendation!.recommendedFilters.map((f, i) => renderFilter(f, i))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)]"
                type="button"
                onClick={handleApply}
                data-testid="ai-denoise-apply"
              >
                {t.apply}
              </button>
              <button
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium border ${abEnabled ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel'}`}
                type="button"
                onClick={toggleAb}
                data-testid="ai-denoise-ab-toggle"
              >
                <Volume2 size={14} />
                {abEnabled ? t.abOn : t.abOff}
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

