import React, { useCallback, useMemo, useState } from 'react';
import {
  DISTRIBUTION_PLATFORMS,
  buildDistributionRecommendations,
  formatPlatformSummary,
  formatMaxDuration,
  type DistributionPlatformId,
  type DistributionPlatformSpec,
} from '@open-factory/editor-core';
import {
  generateMultiFormats,
  getPlatformAdaptation,
  analyzeAdaptationNeeds,
  generateCovers,
  DEFAULT_MULTI_FORMAT_CONFIG,
  DEFAULT_COVER_CONFIG,
  type FormatVariant,
  type PlatformAdaptation,
  type AdaptationSuggestion,
  type CoverGenerationResult,
} from '@open-factory/editor-core';
import { useDistributionStore } from '../../store/distributionStore';

// ─── 平台卡片组件 ────────────────────────────────────────────

interface PlatformCardProps {
  platform: DistributionPlatformSpec;
  selected: boolean;
  score?: number;
  reasons?: string[];
  adaptation?: PlatformAdaptation;
  onToggle: (id: DistributionPlatformId) => void;
}

function PlatformCard({ platform, selected, score, reasons, adaptation, onToggle }: PlatformCardProps) {
  const orientationLabel =
    platform.orientation === 'portrait' ? '竖屏' : platform.orientation === 'square' ? '方形' : '横屏';

  return (
    <button
      type="button"
      data-testid={`platform-card-${platform.id}`}
      onClick={() => onToggle(platform.id)}
      className={`
        w-full text-left rounded-lg border-2 p-3 transition-all cursor-pointer
        ${
          selected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
        }
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{platform.icon}</span>
          <span className="font-medium text-sm">{platform.name}</span>
        </div>
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          {selected && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <div className="flex justify-between">
          <span>
            {platform.width}×{platform.height}
          </span>
          <span>
            {platform.aspectRatio} {orientationLabel}
          </span>
        </div>
        <div className="flex justify-between">
          <span>
            {platform.fps}fps · {platform.videoBitrate}
          </span>
          <span>最长 {formatMaxDuration(platform)}</span>
        </div>
      </div>

      {/* 平台适配标签 */}
      {adaptation && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
            {adaptation.rhythmStyle === 'fast' ? '快节奏' : adaptation.rhythmStyle === 'slow' ? '慢节奏' : '中等节奏'}
          </span>
          {adaptation.optimizations.addOpeningHook && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
              前{adaptation.optimizations.hookDurationSecs}秒强吸引
            </span>
          )}
          {adaptation.optimizations.loopFriendly && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              循环优化
            </span>
          )}
        </div>
      )}

      {score !== undefined && score > 0.3 && (
        <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
          推荐度: {Math.round(score * 100)}%
          {reasons && reasons.length > 0 && <span className="ml-1 text-gray-400">· {reasons[0]}</span>}
        </div>
      )}
    </button>
  );
}

// ─── 格式预览组件 ────────────────────────────────────────────

interface FormatPreviewCardProps {
  variant: FormatVariant;
}

function FormatPreviewCard({ variant }: FormatPreviewCardProps) {
  const orientationLabel =
    variant.orientation === 'portrait' ? '竖屏' : variant.orientation === 'square' ? '方形' : '横屏';
  const qualityPercent = Math.round((1 - variant.qualityLoss) * 100);

  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
      data-testid={`format-preview-${variant.id}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{orientationLabel}</span>
          <span className="text-xs text-gray-500">{variant.aspectRatio}</span>
        </div>
        <span className="text-xs text-gray-400">
          {variant.width}×{variant.height}
        </span>
      </div>

      {/* 裁剪预览框 */}
      <div className="relative w-full h-20 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden mb-2">
        <div
          className="absolute border-2 border-blue-400 bg-blue-400/10 rounded"
          style={{
            left: `${variant.cropResult.cropX * 100}%`,
            top: `${variant.cropResult.cropY * 100}%`,
            width: `${variant.cropResult.cropWidth * 100}%`,
            height: `${variant.cropResult.cropHeight * 100}%`,
          }}
        />
      </div>

      {/* 质量指示器 */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500">质量</span>
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              qualityPercent > 80 ? 'bg-green-500' : qualityPercent > 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${qualityPercent}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-500">{qualityPercent}%</span>
      </div>

      {/* 警告信息 */}
      {variant.warnings.length > 0 && (
        <div className="mt-1">
          {variant.warnings.map((w, i) => (
            <span key={i} className="text-[10px] text-amber-600 dark:text-amber-400">
              ⚠ {w}
            </span>
          ))}
        </div>
      )}

      {/* 目标平台标签 */}
      <div className="mt-2 flex flex-wrap gap-1">
        {variant.targetPlatforms.slice(0, 3).map((pid) => {
          const p = DISTRIBUTION_PLATFORMS.find((dp) => dp.id === pid);
          return p ? (
            <span
              key={pid}
              className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              {p.icon} {p.name}
            </span>
          ) : null;
        })}
        {variant.targetPlatforms.length > 3 && (
          <span className="text-[10px] text-gray-400">+{variant.targetPlatforms.length - 3}</span>
        )}
      </div>
    </div>
  );
}

// ─── 适配建议组件 ────────────────────────────────────────────

interface SuggestionListProps {
  suggestions: AdaptationSuggestion[];
}

function SuggestionList({ suggestions }: SuggestionListProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-1" data-testid="adaptation-suggestions">
      {suggestions.slice(0, 5).map((s, i) => (
        <div
          key={i}
          className={`text-xs px-2 py-1 rounded ${
            s.severity === 'critical'
              ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
              : s.severity === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
          }`}
        >
          {s.severity === 'critical' ? '🔴' : s.severity === 'warning' ? '🟡' : '🔵'} {s.message}
        </div>
      ))}
    </div>
  );
}

// ─── 主面板组件 ────────────────────────────────────────────

export interface SmartDistributionPanelProps {
  /** 项目宽度 */
  projectWidth?: number;
  /** 项目高度 */
  projectHeight?: number;
  /** 项目时长（秒） */
  projectDuration?: number;
  /** 是否有字幕 */
  hasSubtitles?: boolean;
  /** 开始批量导出回调 */
  onStartExport?: (platforms: DistributionPlatformId[]) => void;
  /** 关闭面板回调 */
  onClose?: () => void;
}

export function SmartDistributionPanel({
  projectWidth = 1920,
  projectHeight = 1080,
  projectDuration = 0,
  hasSubtitles = false,
  onStartExport,
  onClose,
}: SmartDistributionPanelProps) {
  const selectedPlatforms = useDistributionStore((s) => s.selectedPlatforms);
  const togglePlatform = useDistributionStore((s) => s.togglePlatform);
  const selectAllPlatforms = useDistributionStore((s) => s.selectAllPlatforms);
  const clearPlatforms = useDistributionStore((s) => s.clearPlatforms);
  const tasks = useDistributionStore((s) => s.tasks);
  const multiFormatResult = useDistributionStore((s) => s.multiFormatResult);
  const setMultiFormatResult = useDistributionStore((s) => s.setMultiFormatResult);
  const isGeneratingFormats = useDistributionStore((s) => s.isGeneratingFormats);
  const setIsGeneratingFormats = useDistributionStore((s) => s.setIsGeneratingFormats);

  const [activeTab, setActiveTab] = useState<'platforms' | 'formats' | 'suggestions'>('platforms');

  // 智能推荐
  const recommendations = useMemo(
    () =>
      buildDistributionRecommendations({
        width: projectWidth,
        height: projectHeight,
        durationSecs: projectDuration,
        hasSubtitles,
      }),
    [projectWidth, projectHeight, projectDuration, hasSubtitles],
  );

  // 推荐分数映射
  const scoreMap = useMemo(() => {
    const map = new Map<string, { score: number; reasons: string[] }>();
    for (const rec of recommendations) {
      map.set(rec.platform.id, { score: rec.score, reasons: rec.reasons });
    }
    return map;
  }, [recommendations]);

  // 平台适配方案
  const adaptations = useMemo(() => {
    const map = new Map<DistributionPlatformId, PlatformAdaptation>();
    for (const pid of selectedPlatforms) {
      try {
        map.set(pid, getPlatformAdaptation(pid));
      } catch {
        // ignore unknown platform
      }
    }
    return map;
  }, [selectedPlatforms]);

  // 适配建议
  const suggestions = useMemo(() => {
    const allSuggestions: AdaptationSuggestion[] = [];
    for (const pid of selectedPlatforms) {
      try {
        const platformSuggestions = analyzeAdaptationNeeds(
          {
            width: projectWidth,
            height: projectHeight,
            durationSecs: projectDuration,
            hasSubtitles,
            hasIntro: false,
            hasOutro: false,
          },
          pid,
        );
        allSuggestions.push(...platformSuggestions);
      } catch {
        // ignore
      }
    }
    return allSuggestions;
  }, [selectedPlatforms, projectWidth, projectHeight, projectDuration, hasSubtitles]);

  const handleSelectRecommended = useCallback(() => {
    const recommended = recommendations.filter((r) => r.score > 0.4).map((r) => r.platform.id);
    selectAllPlatforms(recommended);
  }, [recommendations, selectAllPlatforms]);

  const handleStartExport = useCallback(() => {
    if (onStartExport && selectedPlatforms.length > 0) {
      onStartExport(selectedPlatforms);
    }
  }, [onStartExport, selectedPlatforms]);

  const handleGenerateFormats = useCallback(() => {
    if (selectedPlatforms.length === 0) return;
    setIsGeneratingFormats(true);

    // 模拟多格式生成（实际应调用 Worker）
    setTimeout(() => {
      const mockProject = {
        name: 'project',
        settings: { width: projectWidth, height: projectHeight, fps: 30, timecodeFormat: 'hh:mm:ss:ff' },
        timeline: { tracks: [] },
      } as any;

      try {
        const result = generateMultiFormats(mockProject, {
          ...DEFAULT_MULTI_FORMAT_CONFIG,
          targetPlatforms: selectedPlatforms,
        });
        setMultiFormatResult(result);
      } catch {
        // fallback
      }
      setIsGeneratingFormats(false);
    }, 300);
  }, [selectedPlatforms, projectWidth, projectHeight, setIsGeneratingFormats, setMultiFormatResult]);

  const hasActiveTasks = tasks.some((t) => t.status === 'running' || t.status === 'pending');
  const criticalSuggestions = suggestions.filter((s) => s.severity === 'critical');

  return (
    <div className="flex flex-col h-full" data-testid="smart-distribution-panel">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚀</span>
          <h2 className="font-semibold text-sm">智能多平台分发</h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            data-testid="distribution-panel-close"
          >
            ✕
          </button>
        )}
      </div>

      {/* 标签页导航 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(['platforms', 'formats', 'suggestions'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-xs py-2 text-center transition-colors ${
              activeTab === tab
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            data-testid={`tab-${tab}`}
          >
            {tab === 'platforms' ? '平台选择' : tab === 'formats' ? '格式预览' : '适配建议'}
            {tab === 'suggestions' && criticalSuggestions.length > 0 && (
              <span className="ml-1 px-1 py-0.5 text-[10px] rounded-full bg-red-500 text-white">
                {criticalSuggestions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 操作栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={handleSelectRecommended}
          className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
          data-testid="select-recommended"
        >
          智能推荐
        </button>
        <button
          type="button"
          onClick={() => selectAllPlatforms(DISTRIBUTION_PLATFORMS.map((p) => p.id))}
          className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          data-testid="select-all"
        >
          全选
        </button>
        <button
          type="button"
          onClick={clearPlatforms}
          className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          data-testid="clear-selection"
        >
          清除
        </button>
        <div className="flex-1" />
        <span className="text-xs text-gray-400">已选 {selectedPlatforms.length} 个平台</span>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 平台选择标签页 */}
        {activeTab === 'platforms' && (
          <div className="grid grid-cols-2 gap-3" data-testid="platform-grid">
            {recommendations.map((rec) => (
              <PlatformCard
                key={rec.platform.id}
                platform={rec.platform}
                selected={selectedPlatforms.includes(rec.platform.id)}
                score={rec.score}
                reasons={rec.reasons}
                adaptation={adaptations.get(rec.platform.id)}
                onToggle={togglePlatform}
              />
            ))}
          </div>
        )}

        {/* 格式预览标签页 */}
        {activeTab === 'formats' && (
          <div>
            {selectedPlatforms.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8">
                请先在「平台选择」中选择目标平台
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500">
                    已选择 {selectedPlatforms.length} 个平台，
                    预计生成{' '}
                    {new Set(
                      selectedPlatforms.map((pid) => {
                        const p = DISTRIBUTION_PLATFORMS.find((dp) => dp.id === pid);
                        return p ? `${p.orientation}:${p.aspectRatio}` : '';
                      }),
                    ).size}{' '}
                    种格式
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateFormats}
                    disabled={isGeneratingFormats}
                    className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    data-testid="generate-formats"
                  >
                    {isGeneratingFormats ? '生成中...' : '生成格式预览'}
                  </button>
                </div>

                {multiFormatResult && (
                  <div className="space-y-3">
                    {/* 源信息 */}
                    <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 rounded p-2">
                      源: {multiFormatResult.sourceInfo.width}×{multiFormatResult.sourceInfo.height}
                      {multiFormatResult.sourceInfo.durationSecs > 0 &&
                        ` · ${Math.round(multiFormatResult.sourceInfo.durationSecs)}秒`}
                      {` · 平均质量 ${Math.round(multiFormatResult.summary.averageQuality * 100)}%`}
                    </div>

                    {/* 格式变体卡片 */}
                    <div className="grid grid-cols-1 gap-3">
                      {multiFormatResult.variants.map((variant) => (
                        <FormatPreviewCard key={variant.id} variant={variant} />
                      ))}
                    </div>

                    {/* 警告信息 */}
                    {multiFormatResult.summary.warnings.length > 0 && (
                      <div className="space-y-1">
                        {multiFormatResult.summary.warnings.map((w, i) => (
                          <div key={i} className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠ {w}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 适配建议标签页 */}
        {activeTab === 'suggestions' && (
          <div>
            {selectedPlatforms.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8">
                请先在「平台选择」中选择目标平台
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center text-sm text-green-600 dark:text-green-400 py-8">
                ✅ 当前项目与所选平台适配良好
              </div>
            ) : (
              <SuggestionList suggestions={suggestions} />
            )}
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
        {/* 批量进度（如果有活跃任务） */}
        {hasActiveTasks && (
          <div className="mb-3 space-y-1" data-testid="batch-progress">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-xs">
                <span className="w-20 truncate">{task.platform.name}</span>
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      task.status === 'success'
                        ? 'bg-green-500'
                        : task.status === 'error'
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.round(task.progress * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right">
                  {task.status === 'success'
                    ? '✓'
                    : task.status === 'error'
                      ? '✗'
                      : `${Math.round(task.progress * 100)}%`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 严重警告提示 */}
        {criticalSuggestions.length > 0 && (
          <div className="mb-2 text-xs text-red-600 dark:text-red-400">
            ⚠ 有 {criticalSuggestions.length} 个严重适配问题需要处理
          </div>
        )}

        <button
          type="button"
          onClick={handleStartExport}
          disabled={selectedPlatforms.length === 0 || hasActiveTasks}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
            selectedPlatforms.length > 0 && !hasActiveTasks
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
          data-testid="start-distribution"
        >
          {hasActiveTasks
            ? '导出中...'
            : selectedPlatforms.length === 0
              ? '请选择目标平台'
              : `一键分发到 ${selectedPlatforms.length} 个平台`}
        </button>
      </div>
    </div>
  );
}
