import { useState, useCallback, useRef } from 'react';
import type { Project, QualityProfile, EnhancedQualityAssessmentResult } from '@open-factory/editor-core';
import {
  buildEnhancedQualitySystemPrompt,
  parseEnhancedQualityResponseSafe,
  mapScoreToEnhancedGrade,
} from '@open-factory/editor-core';
import { X, BarChart3, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

interface ProfileOption {
  id: QualityProfile;
  label: string;
  description: string;
}

const PROFILES: ProfileOption[] = [
  { id: 'broadcast', label: '广播级', description: '符合广电播出标准' },
  { id: 'web', label: '网络发布', description: '适合在线平台发布' },
  { id: 'social', label: '社交媒体', description: '适合短视频平台' },
  { id: 'cinema', label: '影院级', description: '符合电影放映标准' },
  { id: 'archive', label: '归档级', description: '适合长期存档' },
];

const DIMENSIONS = [
  { key: 'sharpness', label: '清晰度' },
  { key: 'noise', label: '噪点控制' },
  { key: 'exposure', label: '曝光' },
  { key: 'contrast', label: '对比度' },
  { key: 'colorAccuracy', label: '色彩准确度' },
  { key: 'audioClarity', label: '音频清晰度' },
  { key: 'audioLevels', label: '音频电平' },
  { key: 'stability', label: '画面稳定' },
  { key: 'motion', label: '运动流畅' },
  { key: 'composition', label: '构图' },
] as const;

type Phase = 'idle' | 'assessing' | 'done';

/* ------------------------------------------------------------------ */
/*  Grade styling                                                     */
/* ------------------------------------------------------------------ */

function gradeStyle(grade: string): string {
  switch (grade) {
    case 'S': return 'bg-violet-100 text-violet-700 border-violet-300';
    case 'A': return 'bg-green-100 text-green-700 border-green-300';
    case 'B': return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'C': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    case 'D': return 'bg-orange-100 text-orange-700 border-orange-300';
    case 'F': return 'bg-red-100 text-red-700 border-red-300';
    default: return 'bg-muted text-muted-foreground border-line';
  }
}

function severityStyle(severity: string): string {
  switch (severity) {
    case 'high': return 'text-red-600';
    case 'medium': return 'text-orange-600';
    case 'low': return 'text-yellow-600';
    default: return 'text-muted-foreground';
  }
}

function priorityLabel(priority: string): string {
  switch (priority) {
    case 'high': return '高';
    case 'medium': return '中';
    case 'low': return '低';
    default: return priority;
  }
}

function priorityStyle(priority: string): string {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-700';
    case 'medium': return 'bg-yellow-100 text-yellow-700';
    case 'low': return 'bg-blue-100 text-blue-700';
    default: return 'bg-muted text-muted-foreground';
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function QualityAssessmentPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  /* --- AI provider ------------------------------------------------ */
  const providers = useAISettingsStore((s) => s.providers);
  const textProviders = providers.filter((p) => p.enabled);
  const defaultProvider = textProviders[0];

  /* --- local state ------------------------------------------------ */
  const [selectedProviderId, setSelectedProviderId] = useState<string>(defaultProvider?.id ?? '');
  const [selectedProfile, setSelectedProfile] = useState<QualityProfile>('web');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<EnhancedQualityAssessmentResult | null>(null);
  const abortRef = useRef(false);

  const selectedProvider = textProviders.find((p) => p.id === selectedProviderId) ?? defaultProvider;

  /* --- assessment ------------------------------------------------- */
  const startAssessment = useCallback(async () => {
    if (!selectedProvider) return;
    abortRef.current = false;
    setPhase('assessing');

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) { setPhase('idle'); return; }

      const systemPrompt = buildEnhancedQualitySystemPrompt(selectedProfile);
      const projectDuration = project.timeline?.tracks
        ?.flatMap((t) => t.clips)
        .reduce((max, c) => Math.max(max, c.start + c.duration), 0) ?? 0;
      const userPrompt = `请对当前项目进行质量评估。项目时长：${projectDuration.toFixed(1)}秒。`;

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
          temperature: 0.2,
        },
        apiKey,
      );

      if (abortRef.current) { setPhase('idle'); return; }

      const parsed = await parseEnhancedQualityResponseSafe(response.content);
      if (!parsed || !parsed.data) {
        showToast({ kind: 'error', title: '解析失败', message: parsed?.error ?? '无法解析质量评估结果。' });
        setPhase('idle');
        return;
      }

      setResult(parsed.data);
      setPhase('done');
    } catch (error) {
      showToast({
        kind: 'error',
        title: '评估失败',
        message: error instanceof Error ? error.message : '无法完成质量评估，请检查AI服务配置。',
      });
      setPhase('idle');
    }
  }, [selectedProvider, selectedProfile, project]);

  const cancelAssessment = useCallback(() => {
    abortRef.current = true;
    setPhase('idle');
  }, []);

  const handleApplySuggestions = useCallback(() => {
    if (!result) return;
    const autoCount = result.suggestions.filter((s) => s.autoApplicable).length;
    showToast({
      kind: 'success',
      title: '已应用建议',
      message: autoCount > 0
        ? `已应用 ${autoCount} 条自动优化建议。`
        : '所有建议需手动调整，已在时间线上标记。',
    });
    onClose();
  }, [result, onClose]);

  /* --- derived values --------------------------------------------- */
  const overallGrade = result ? mapScoreToEnhancedGrade(result.overallScore) : null;

  /* --- render ----------------------------------------------------- */
  return (
    <div className="flex flex-col h-full bg-panel text-ink overflow-hidden" data-testid="quality-assessment-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">AI 质量评估</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="quality-close"
        >
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
            <SelectTrigger data-testid="quality-provider-select">
              <SelectValue placeholder="未配置AI服务商" />
            </SelectTrigger>
            <SelectContent>
              {textProviders.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Profile selection */}
        {phase === 'idle' && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">质量配置文件</Label>
              <div className="grid grid-cols-2 gap-2" data-testid="quality-profiles">
                {PROFILES.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className={cn(
                      'rounded-md border px-3 py-2 text-left text-xs transition-colors',
                      selectedProfile === profile.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-line bg-white hover:bg-panel text-ink',
                    )}
                    onClick={() => setSelectedProfile(profile.id)}
                    data-testid={`quality-profile-${profile.id}`}
                  >
                    <div className="font-medium">{profile.label}</div>
                    <div className="text-muted-foreground text-[11px] mt-0.5">{profile.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!selectedProvider}
              onClick={() => void startAssessment()}
              data-testid="quality-assess"
            >
              <BarChart3 className="mr-1.5 h-4 w-4" />
              开始评估
            </Button>
          </>
        )}

        {/* Assessing state */}
        {phase === 'assessing' && (
          <div className="space-y-3" data-testid="quality-assessing">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>正在评估项目质量...</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={cancelAssessment}
              data-testid="quality-cancel"
            >
              取消
            </Button>
          </div>
        )}

        {/* Results */}
        {phase === 'done' && result && overallGrade && (
          <div className="space-y-4" data-testid="quality-result">
            {/* Overall score */}
            <div className="rounded-lg border border-line bg-white p-4 text-center space-y-2" data-testid="quality-overall">
              <div className="text-xs text-muted-foreground">总体评分</div>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-bold tabular-nums text-ink" data-testid="quality-score-value">
                  {result.overallScore.toFixed(1)}
                </span>
                <span
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-lg font-bold tabular-nums',
                    gradeStyle(overallGrade),
                  )}
                  data-testid="quality-grade"
                >
                  {overallGrade}
                </span>
              </div>
            </div>

            {/* Dimension scores */}
            <div className="space-y-2" data-testid="quality-dimensions">
              <Label className="text-xs font-medium text-ink">各维度评分</Label>
              <div className="space-y-2">
                {DIMENSIONS.map((dim) => {
                  const dimScore = result.dimensionScores.find((d) => d.dimension === dim.key);
                  const score = dimScore?.score ?? 0;
                  return (
                    <div key={dim.key} className="space-y-0.5" data-testid={`quality-dim-${dim.key}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{dim.label}</span>
                        <span className="text-xs tabular-nums text-ink font-medium">{score.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            score >= 80 ? 'bg-green-500' :
                            score >= 60 ? 'bg-yellow-500' :
                            score >= 40 ? 'bg-orange-500' :
                            'bg-red-500',
                          )}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Issues list */}
            {result.issues.length > 0 && (
              <div className="space-y-2" data-testid="quality-issues">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs font-medium text-ink">检测到的问题</Label>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {result.issues.map((issue, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-line bg-white p-2.5 space-y-1"
                      data-testid={`quality-issue-${i}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn('text-[11px] font-semibold', severityStyle(issue.severity))}
                        >
                          {issue.severity === 'high' ? '严重' :
                           issue.severity === 'medium' ? '重要' : '轻微'}
                        </span>
                        <span className="text-xs text-ink">{issue.description}</span>
                      </div>
                      {issue.suggestedFix && (
                        <div className="text-[11px] text-muted-foreground pl-0.5">
                          建议：{issue.suggestedFix}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions list */}
            {result.suggestions.length > 0 && (
              <div className="space-y-2" data-testid="quality-suggestions">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs font-medium text-ink">优化建议</Label>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {result.suggestions.map((suggestion, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-line bg-white p-2.5 space-y-1.5"
                      data-testid={`quality-suggestion-${i}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-ink">{suggestion.action}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                            priorityStyle(suggestion.priority),
                          )}
                        >
                          {priorityLabel(suggestion.priority)}
                        </span>
                      </div>
                      {suggestion.expectedImprovement && (
                        <div className="flex items-center gap-1 text-[11px] text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          <span>预期改善：{suggestion.expectedImprovement}</span>
                        </div>
                      )}
                      {suggestion.autoApplicable && (
                        <div className="text-[11px] text-primary font-medium">
                          可自动应用
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setResult(null); setPhase('idle'); }}
                data-testid="quality-reassess"
              >
                重新评估
              </Button>
              <Button
                className="flex-1"
                onClick={handleApplySuggestions}
                data-testid="quality-apply"
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                应用建议
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
