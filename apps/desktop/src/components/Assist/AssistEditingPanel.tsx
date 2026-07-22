import { useState, useCallback, useRef } from 'react';
import type { Project, AssistEditingPreset, AssistEditingConfig, AssistEditingResult } from '@open-factory/editor-core';
import { formatTimeShort } from '@open-factory/editor-core/utils/time';
import {
  createDefaultAssistEditingConfig,
  applyAssistEditingPreset,
  validateAssistEditingConfig,
  buildAssistEditingSystemPrompt,
  parseAssistEditingResponseSafe,
} from '@open-factory/editor-core';
import { X, Wand2, Play, Settings2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';

/* ------------------------------------------------------------------ */
/*  Preset definitions                                                */
/* ------------------------------------------------------------------ */

interface PresetOption {
  id: AssistEditingPreset;
  label: string;
  description: string;
}

const PRESETS: PresetOption[] = [
  { id: 'quick-cut', label: '快速剪辑', description: '自动识别精彩片段，快速生成剪辑' },
  { id: 'rhythm-match', label: '节奏匹配', description: '根据音频节奏自动匹配剪辑点' },
  { id: 'emotion-driven', label: '情感驱动', description: '基于内容情感变化进行智能剪辑' },
  { id: 'content-aware', label: '内容感知', description: '分析画面内容，智能选择最佳剪辑' },
  { id: 'custom', label: '自定义', description: '完全自定义剪辑参数' },
];

const TRANSITION_OPTIONS = [
  { value: 'none', label: '无过渡' },
  { value: 'cross-dissolve', label: '交叉溶解' },
  { value: 'fade-in', label: '淡入' },
  { value: 'fade-out', label: '淡出' },
];

type Phase = 'idle' | 'generating' | 'done';

/* ------------------------------------------------------------------ */
/*  Helper                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function AssistEditingPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  /* --- AI provider ------------------------------------------------ */
  const providers = useAISettingsStore((s) => s.providers);
  const textProviders = providers.filter((p) => p.enabled);
  const defaultProvider = textProviders[0];

  /* --- local state ------------------------------------------------ */
  const [selectedProviderId, setSelectedProviderId] = useState<string>(defaultProvider?.id ?? '');
  const [selectedPreset, setSelectedPreset] = useState<AssistEditingPreset>('quick-cut');
  const [config, setConfig] = useState<AssistEditingConfig>(() => createDefaultAssistEditingConfig());
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<AssistEditingResult | null>(null);
  const abortRef = useRef(false);

  const selectedProvider = textProviders.find((p) => p.id === selectedProviderId) ?? defaultProvider;

  /* --- config helpers --------------------------------------------- */
  const updateConfig = useCallback(<K extends keyof AssistEditingConfig>(key: K, value: AssistEditingConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePresetChange = useCallback((preset: AssistEditingPreset) => {
    setSelectedPreset(preset);
    setConfig(applyAssistEditingPreset(preset));
  }, []);

  /* --- generation ------------------------------------------------- */
  const startGeneration = useCallback(async () => {
    if (!selectedProvider) return;

    if (!validateAssistEditingConfig(config)) {
      showToast({ kind: 'error', title: '参数错误', message: '请检查辅助剪辑参数配置' });
      return;
    }

    abortRef.current = false;
    setPhase('generating');

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) {
        setPhase('idle');
        return;
      }

      const systemPrompt = buildAssistEditingSystemPrompt();
      const projectDuration =
        project.timeline?.tracks?.flatMap((t) => t.clips).reduce((max, c) => Math.max(max, c.start + c.duration), 0) ??
        0;
      const userPrompt = `请为当前项目生成剪辑建议。项目时长：${formatTime(projectDuration)}。`;

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
          temperature: 0.3,
        },
        apiKey,
      );

      if (abortRef.current) {
        setPhase('idle');
        return;
      }

      const parsed = await parseAssistEditingResponseSafe(response.content);
      if (!parsed || !parsed.data) {
        showToast({ kind: 'error', title: '解析失败', message: parsed?.error ?? '无法解析AI返回的剪辑建议。' });
        setPhase('idle');
        return;
      }

      setResult(parsed.data);
      setPhase('done');
    } catch (error) {
      showToast({
        kind: 'error',
        title: '生成失败',
        message: error instanceof Error ? error.message : '无法生成剪辑建议，请检查AI服务配置。',
      });
      setPhase('idle');
    }
  }, [selectedProvider, config, project]);

  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
    setPhase('idle');
  }, []);

  const handleApply = useCallback(() => {
    if (!result) return;
    showToast({ kind: 'success', title: '已应用', message: `已应用 ${result.suggestions.length} 条剪辑建议。` });
    onClose();
  }, [result, onClose]);

  /* --- render ----------------------------------------------------- */
  return (
    <div className="flex flex-col h-full bg-panel text-ink overflow-hidden" data-testid="assist-editing-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">AI 辅助剪辑</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="assist-editing-close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Provider selection */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">AI 服务商</Label>
          <Select
            value={selectedProviderId}
            onValueChange={setSelectedProviderId}
            disabled={textProviders.length === 0}
          >
            <SelectTrigger data-testid="assist-editing-provider-select">
              <SelectValue placeholder="未配置AI服务商" />
            </SelectTrigger>
            <SelectContent>
              {textProviders.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Preset selection */}
        {phase === 'idle' && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">选择预设</Label>
              <div className="grid grid-cols-2 gap-2" data-testid="assist-editing-presets">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={cn(
                      'rounded-md border px-3 py-2 text-left text-xs transition-colors',
                      selectedPreset === preset.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-line bg-white hover:bg-panel text-ink',
                    )}
                    onClick={() => handlePresetChange(preset.id)}
                    data-testid={`assist-editing-preset-${preset.id}`}
                  >
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-muted-foreground text-[11px] mt-0.5">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Parameter configuration */}
            <div className="space-y-3" data-testid="assist-editing-config">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" />
                <span>参数配置</span>
              </div>

              {/* Min clip duration */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">最小片段时长</Label>
                  <span className="text-xs tabular-nums text-ink">{config.minSegmentDuration.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={config.minSegmentDuration}
                  onChange={(e) => updateConfig('minSegmentDuration', Number(e.target.value))}
                  data-testid="assist-editing-min-duration"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0.5s</span>
                  <span>10s</span>
                </div>
              </div>

              {/* Max clip duration */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">最大片段时长</Label>
                  <span className="text-xs tabular-nums text-ink">{config.maxSegmentDuration}s</span>
                </div>
                <input
                  type="range"
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  min={5}
                  max={120}
                  step={1}
                  value={config.maxSegmentDuration}
                  onChange={(e) => updateConfig('maxSegmentDuration', Number(e.target.value))}
                  data-testid="assist-editing-max-duration"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>5s</span>
                  <span>120s</span>
                </div>
              </div>

              {/* Max clips count */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">最大剪辑数量</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={config.maxCutCount}
                  onChange={(e) => updateConfig('maxCutCount', Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  data-testid="assist-editing-max-clips"
                />
              </div>

              {/* Target duration */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">目标时长（可选）</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="留空表示不限制"
                  value={config.targetDuration ?? ''}
                  onChange={(e) => updateConfig('targetDuration', e.target.value ? Number(e.target.value) : undefined)}
                  data-testid="assist-editing-target-duration"
                />
              </div>

              {/* Transition preference */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">过渡偏好</Label>
                <Select
                  value={config.transitionPreference}
                  onValueChange={(v) => updateConfig('transitionPreference', v)}
                >
                  <SelectTrigger data-testid="assist-editing-transition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSITION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Toggle switches */}
              <div className="space-y-2 pt-1">
                {[
                  { key: 'enableAutoCut' as const, label: '自动剪辑', testId: 'auto-cut' },
                  { key: 'enableRhythmSync' as const, label: '节奏同步', testId: 'rhythm-sync' },
                  { key: 'enableEmotionAware' as const, label: '情绪感知', testId: 'emotion-aware' },
                  { key: 'enableContentAnalysis' as const, label: '内容分析', testId: 'content-analysis' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">{item.label}</Label>
                    <Switch
                      checked={config[item.key]}
                      onCheckedChange={(v) => updateConfig(item.key, v)}
                      data-testid={`assist-editing-${item.testId}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <Button
              className="w-full"
              disabled={!selectedProvider}
              onClick={() => void startGeneration()}
              data-testid="assist-editing-generate"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              生成剪辑建议
            </Button>
          </>
        )}

        {/* Generating state */}
        {phase === 'generating' && (
          <div className="space-y-3" data-testid="assist-editing-generating">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>正在分析并生成剪辑建议...</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
            </div>
            <Button variant="outline" className="w-full" onClick={cancelGeneration} data-testid="assist-editing-cancel">
              取消
            </Button>
          </div>
        )}

        {/* Results */}
        {(phase === 'done' || (phase === 'idle' && result)) && result && (
          <div className="space-y-3" data-testid="assist-editing-result">
            {/* Summary */}
            <div className="rounded-md border border-line bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink">剪辑结果概览</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    result.qualityScore >= 80
                      ? 'bg-green-100 text-green-700'
                      : result.qualityScore >= 60
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700',
                  )}
                  data-testid="assist-editing-quality-score"
                >
                  质量评分：{result.qualityScore}
                </span>
              </div>
              <div className="text-xs text-muted-foreground" data-testid="assist-editing-total-duration">
                总预估时长：{formatTime(result.totalEstimatedDuration)}
              </div>
            </div>

            {/* Suggestions list */}
            <div className="space-y-2" data-testid="assist-editing-suggestions">
              <Label className="text-xs font-medium text-ink">剪辑建议</Label>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {result.suggestions.map((suggestion, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-line bg-white p-2.5 space-y-1"
                    data-testid={`assist-editing-suggestion-${i}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-primary">
                        {formatTime(suggestion.startTime)} - {formatTime(suggestion.endTime)}
                      </span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium',
                          suggestion.cutType === 'cut'
                            ? 'bg-blue-100 text-blue-700'
                            : suggestion.cutType === 'trim'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-700',
                        )}
                      >
                        {suggestion.cutType === 'cut'
                          ? '剪切'
                          : suggestion.cutType === 'trim'
                            ? '裁剪'
                            : suggestion.cutType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">置信度：</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            suggestion.confidence >= 0.8
                              ? 'bg-green-500'
                              : suggestion.confidence >= 0.5
                                ? 'bg-yellow-500'
                                : 'bg-red-500',
                          )}
                          style={{ width: `${suggestion.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-ink">
                        {(suggestion.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    {suggestion.reason && (
                      <div className="text-[11px] text-muted-foreground line-clamp-2">{suggestion.reason}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setResult(null);
                  setPhase('idle');
                }}
                data-testid="assist-editing-regenerate"
              >
                重新生成
              </Button>
              <Button className="flex-1" onClick={handleApply} data-testid="assist-editing-apply">
                <Play className="mr-1.5 h-4 w-4" />
                应用建议
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
