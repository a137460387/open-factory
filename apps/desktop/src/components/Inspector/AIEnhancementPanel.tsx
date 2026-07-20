import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import type { Clip } from '@open-factory/editor-core';
import {
  hasAvailableTextProvider,
} from '@open-factory/editor-core';
import {
  createDefaultEnhancementParams,
  estimateProcessingTime,
  estimateQualityImprovement,
  executeEnhancement,
  validateEnhancementParams,
  getAvailableStylePresets,
} from '@open-factory/editor-core';
import type {
  EnhancementOperation,
  EnhancementTask,
  EnhancementParams,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';

const t = zhCN.inspector.aiEnhancement;

const OPERATIONS: EnhancementOperation[] = [
  'denoise',
  'super-resolution',
  'color-correction',
  'stabilization',
  'style-transfer',
  'sharpen',
];

interface EnhancementResult {
  operation: EnhancementOperation;
  qualityImprovement: number;
  estimatedTime: number;
  warnings: string[];
}

export function AIEnhancementPanel({
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
  const [results, setResults] = useState<EnhancementResult[]>([]);
  const [selectedOps, setSelectedOps] = useState<Set<EnhancementOperation>>(new Set(['denoise']));
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const abortRef = useRef(false);

  const selectedProvider = providers.find((p) => p.enabled && hasAvailableTextProvider([p])) ?? providers[0];

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!selectedProvider || !available) return;
    abortRef.current = false;
    setLoading(true);
    setError(undefined);
    setResults([]);

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) return;

      const response = await callAiApi(
        {
          providerId: selectedProvider.id,
          baseUrl: selectedProvider.baseUrl,
          model: selectedProvider.defaultModel,
          messages: [
            { role: 'system', content: '视频质量分析助手' },
            { role: 'user', content: '分析此视频片段的质量，返回JSON格式：{"qualityScore": 0-100, "grade": "A/B/C/D", "recommendedOperations": ["denoise", "sharpen"]}' },
          ],
          temperature: 0.3,
          timeoutSecs: 30,
        },
        apiKey,
      );

      if (abortRef.current) return;

      let parsed: { qualityScore?: number; grade?: string; recommendedOperations?: string[] };
      try {
        parsed = JSON.parse(response.content) as { qualityScore?: number; grade?: string; recommendedOperations?: string[] };
      } catch {
        showToast({ kind: 'error', title: t.failedTitle, message: 'AI返回格式无效' });
        setLoading(false);
        return;
      }

      const score = parsed.qualityScore ?? 50;
      const g = parsed.grade ?? 'C';
      const ops = (parsed.recommendedOperations ?? ['denoise'])
        .filter((op): op is EnhancementOperation => OPERATIONS.includes(op as EnhancementOperation));

      setQualityScore(score);
      setGrade(g);
      setSelectedOps(new Set(ops));

      const enhancementResults: EnhancementResult[] = ops.map((op) => {
        const params = createDefaultEnhancementParams(op);
        const estimatedTime = estimateProcessingTime(op, params, 100, 1920, 1080);
        const qualityImprovement = estimateQualityImprovement(op, params, score);
        return {
          operation: op,
          qualityImprovement,
          estimatedTime,
          warnings: [],
        };
      });

      setResults(enhancementResults);
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
  }, [selectedProvider, available]);

  const toggleOperation = (op: EnhancementOperation) => {
    setSelectedOps((prev) => {
      const next = new Set(prev);
      if (next.has(op)) {
        next.delete(op);
      } else {
        next.add(op);
      }
      return next;
    });
  };

  const handleApply = () => {
    if (results.length === 0) return;
    showToast({
      kind: 'success',
      title: t.apply,
      message: `已选择 ${selectedOps.size} 个增强操作`,
    });
    onUpdateTrack(trackId, {
      aiEnhancement: {
        qualityScore,
        grade,
        selectedOperations: Array.from(selectedOps),
      },
    });
  };

  const getOperationLabel = (op: EnhancementOperation): string => {
    const labels: Record<EnhancementOperation, string> = {
      'denoise': t.denoise,
      'super-resolution': t.superResolution,
      'color-correction': t.colorCorrection,
      'stabilization': t.stabilization,
      'style-transfer': t.styleTransfer,
      'sharpen': t.sharpen,
      'frame-interpolation': '帧插值',
      'motion-blur-reduction': '去运动模糊',
      'hdr-tone-mapping': 'HDR色调映射',
      'deinterlace': '去隔行',
    };
    return labels[op] ?? op;
  };

  const getGradeColor = (g: string): string => {
    switch (g) {
      case 'A': return 'text-green-500';
      case 'B': return 'text-blue-500';
      case 'C': return 'text-yellow-500';
      case 'D': return 'text-red-500';
      default: return 'text-[var(--color-text-muted)]';
    }
  };

  const hasResults = results.length > 0;

  return (
    <details className="mb-4" data-testid="ai-enhancement-section">
      <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
        {t.title}
      </summary>
      <div className="space-y-2 p-1">
        {!available && (
          <p className="text-xs text-orange-500" data-testid="ai-enhancement-no-provider">
            {t.noProvider}
          </p>
        )}

        {!loading && !hasResults && (
          <div className="mb-2">
            <label className="block text-xs text-[var(--color-text-secondary)]">{t.selectProvider}</label>
            <select
              className="w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              value={selectedProvider?.id ?? ''}
              disabled
              data-testid="ai-enhancement-provider-select"
            >
              {providers.length === 0 && <option value="">{t.noProvider}</option>}
              {providers
                .filter((p) => p.enabled)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
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
            data-testid="ai-enhancement-analyze"
          >
            <Sparkles size={14} className="mr-1 inline" />
            {t.analyze}
          </button>
        )}

        {loading && (
          <div
            className="flex items-center gap-2 py-3 text-sm text-[var(--color-text-muted)]"
            data-testid="ai-enhancement-loading"
          >
            <Loader2 size={16} className="animate-spin" />
            {t.analyzing}
          </div>
        )}

        {error && !loading && (
          <div
            className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600"
            data-testid="ai-enhancement-error"
          >
            {error}
          </div>
        )}

        {hasResults && qualityScore !== null && grade !== null && (
          <div className="space-y-3" data-testid="ai-enhancement-results">
            <div className="flex items-center justify-between rounded-md border border-line bg-[var(--color-bg-elevated)] p-2">
              <div>
                <div className="text-xs text-[var(--color-text-secondary)]">{t.qualityScore}</div>
                <div className="text-lg font-bold text-ink">{qualityScore}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--color-text-secondary)]">{t.grade}</div>
                <div className={`text-lg font-bold ${getGradeColor(grade)}`}>{grade}</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">{t.operations}</div>
              <div className="space-y-1">
                {results.map((result) => (
                  <label
                    key={result.operation}
                    className="flex items-center gap-2 rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 text-xs cursor-pointer hover:bg-[var(--color-bg-secondary)]"
                    data-testid={`ai-enhancement-op-${result.operation}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedOps.has(result.operation)}
                      onChange={() => toggleOperation(result.operation)}
                      className="rounded border-line"
                    />
                    <span className="flex-1 font-medium text-ink">{getOperationLabel(result.operation)}</span>
                    <span className="text-[var(--color-text-muted)]">
                      +{result.qualityImprovement.toFixed(0)}%
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={selectedOps.size === 0}
                onClick={handleApply}
                data-testid="ai-enhancement-apply"
              >
                <Wand2 size={14} className="mr-1 inline" />
                {t.apply}
              </button>
              <button
                className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-ink hover:bg-[var(--color-bg-secondary)]"
                type="button"
                onClick={() => {
                  setResults([]);
                  setQualityScore(null);
                  setGrade(null);
                  setError(undefined);
                }}
                data-testid="ai-enhancement-reset"
              >
                {t.preview}
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
