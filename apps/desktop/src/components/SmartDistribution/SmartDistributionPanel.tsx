import React, { useCallback, useMemo } from 'react';
import {
  DISTRIBUTION_PLATFORMS,
  buildDistributionRecommendations,
  formatPlatformSummary,
  formatMaxDuration,
  type DistributionPlatformId,
  type DistributionPlatformSpec,
} from '@open-factory/editor-core';
import { useDistributionStore } from '../../store/distributionStore';

// ─── 平台卡片组件 ────────────────────────────────────────────

interface PlatformCardProps {
  platform: DistributionPlatformSpec;
  selected: boolean;
  score?: number;
  reasons?: string[];
  onToggle: (id: DistributionPlatformId) => void;
}

function PlatformCard({ platform, selected, score, reasons, onToggle }: PlatformCardProps) {
  const orientationLabel = platform.orientation === 'portrait'
    ? '竖屏'
    : platform.orientation === 'square'
      ? '方形'
      : '横屏';

  return (
    <button
      type="button"
      data-testid={`platform-card-${platform.id}`}
      onClick={() => onToggle(platform.id)}
      className={`
        w-full text-left rounded-lg border-2 p-3 transition-all cursor-pointer
        ${selected
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
            selected
              ? 'border-blue-500 bg-blue-500'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          {selected && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <div className="flex justify-between">
          <span>{platform.width}×{platform.height}</span>
          <span>{platform.aspectRatio} {orientationLabel}</span>
        </div>
        <div className="flex justify-between">
          <span>{platform.fps}fps · {platform.videoBitrate}</span>
          <span>最长 {formatMaxDuration(platform)}</span>
        </div>
      </div>

      {score !== undefined && score > 0.3 && (
        <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
          推荐度: {Math.round(score * 100)}%
          {reasons && reasons.length > 0 && (
            <span className="ml-1 text-gray-400">· {reasons[0]}</span>
          )}
        </div>
      )}
    </button>
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

  const handleSelectRecommended = useCallback(() => {
    const recommended = recommendations
      .filter((r) => r.score > 0.4)
      .map((r) => r.platform.id);
    selectAllPlatforms(recommended);
  }, [recommendations, selectAllPlatforms]);

  const handleStartExport = useCallback(() => {
    if (onStartExport && selectedPlatforms.length > 0) {
      onStartExport(selectedPlatforms);
    }
  }, [onStartExport, selectedPlatforms]);

  const hasActiveTasks = tasks.some(
    (t) => t.status === 'running' || t.status === 'pending',
  );

  return (
    <div
      className="flex flex-col h-full"
      data-testid="smart-distribution-panel"
    >
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
        <span className="text-xs text-gray-400">
          已选 {selectedPlatforms.length} 个平台
        </span>
      </div>

      {/* 平台网格 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3" data-testid="platform-grid">
          {recommendations.map((rec) => (
            <PlatformCard
              key={rec.platform.id}
              platform={rec.platform}
              selected={selectedPlatforms.includes(rec.platform.id)}
              score={rec.score}
              reasons={rec.reasons}
              onToggle={togglePlatform}
            />
          ))}
        </div>
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
                  {task.status === 'success' ? '✓' : task.status === 'error' ? '✗' : `${Math.round(task.progress * 100)}%`}
                </span>
              </div>
            ))}
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
