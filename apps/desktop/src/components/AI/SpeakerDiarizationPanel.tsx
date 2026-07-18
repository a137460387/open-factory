import React, { useState, useCallback } from 'react';
import { Loader2, Mic, Users, Play, Download, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useSpeakerDiarization } from '../../hooks/useSpeakerDiarization';
import type { SpeakerDiarizationConfig } from '@open-factory/editor-core/ai/speaker-diarization';

/** 说话人分离面板属性 */
export interface SpeakerDiarizationPanelProps {
  /** 音频文件路径 */
  audioPath?: string;
  /** 转录片段（可选，用于集成） */
  transcriptionSegments?: Array<{
    startMs: number;
    endMs: number;
    text: string;
  }>;
  /** 关闭回调 */
  onClose?: () => void;
  /** 完成回调 */
  onComplete?: (result: {
    labeledSegments: Array<{
      startMs: number;
      endMs: number;
      text: string;
      speaker?: string;
      speakerId?: number;
    }>;
  }) => void;
}

/**
 * 说话人分离面板
 */
export function SpeakerDiarizationPanel({
  audioPath,
  transcriptionSegments,
  onClose,
  onComplete,
}: SpeakerDiarizationPanelProps) {
  const { state, startDiarization, cancelDiarization, reset } = useSpeakerDiarization();
  const [config, setConfig] = useState<SpeakerDiarizationConfig>({
    minSpeakers: 1,
    maxSpeakers: 10,
    clusteringThreshold: 0.7,
  });

  /**
   * 开始分离
   */
  const handleStart = useCallback(async () => {
    if (!audioPath) {
      return;
    }
    await startDiarization(audioPath, transcriptionSegments, config);
  }, [audioPath, transcriptionSegments, config, startDiarization]);

  /**
   * 处理完成
   */
  const handleComplete = useCallback(() => {
    if (state.labeledSegments && onComplete) {
      onComplete({ labeledSegments: state.labeledSegments });
    }
  }, [state.labeledSegments, onComplete]);

  /**
   * 重置
   */
  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="speaker-diarization-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-ink">AI 说话人分离</span>
        </div>
        {onClose && (
          <button
            className="rounded p-1 hover:bg-panel"
            onClick={onClose}
            data-testid="speaker-diarization-close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* 配置区域 */}
        {state.stage === 'idle' && (
          <div className="space-y-3">
            <div className="text-sm text-[var(--color-text-secondary)]">
              从音频中自动识别不同说话人，并为转录文本添加说话人标签。
            </div>

            {/* 说话人数量配置 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                说话人数量范围
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={config.minSpeakers ?? 1}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    minSpeakers: parseInt(e.target.value) || 1,
                  }))}
                  className="w-16 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1 text-sm"
                  data-testid="min-speakers-input"
                />
                <span className="text-xs text-[var(--color-text-muted)]">至</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={config.maxSpeakers ?? 10}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    maxSpeakers: parseInt(e.target.value) || 10,
                  }))}
                  className="w-16 rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1 text-sm"
                  data-testid="max-speakers-input"
                />
              </div>
            </div>

            {/* 聚类阈值 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                分离灵敏度
              </label>
              <input
                type="range"
                min={0.3}
                max={0.9}
                step={0.05}
                value={config.clusteringThreshold ?? 0.7}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  clusteringThreshold: parseFloat(e.target.value),
                }))}
                className="w-full"
                data-testid="clustering-threshold-slider"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                <span>低（更多合并）</span>
                <span>{((config.clusteringThreshold ?? 0.7) * 100).toFixed(0)}%</span>
                <span>高（更细分离）</span>
              </div>
            </div>

            {/* 开始按钮 */}
            <button
              className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              onClick={handleStart}
              disabled={!audioPath}
              data-testid="start-diarization-button"
            >
              <div className="flex items-center justify-center gap-2">
                <Mic className="h-4 w-4" />
                <span>开始说话人分离</span>
              </div>
            </button>
          </div>
        )}

        {/* 处理中 */}
        {(state.stage === 'loading' || state.stage === 'processing') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{state.progressMessage}</span>
            </div>

            {/* 进度条 */}
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-primary)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
                style={{ width: `${state.progress * 100}%` }}
              />
            </div>

            <button
              className="w-full rounded-lg border border-line px-4 py-2 text-sm hover:bg-panel"
              onClick={cancelDiarization}
              data-testid="cancel-diarization-button"
            >
              取消
            </button>
          </div>
        )}

        {/* 完成 */}
        {state.stage === 'done' && state.result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>分离完成</span>
            </div>

            {/* 统计信息 */}
            <div className="rounded-lg border border-line p-3 space-y-2">
              <div className="text-xs font-medium text-[var(--color-text-muted)]">统计信息</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-[var(--color-text-muted)]">说话人数量：</span>
                  <span className="font-medium">{state.result.stats.speakerCount}</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">切换次数：</span>
                  <span className="font-medium">{state.result.stats.speakerSwitches}</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">平均置信度：</span>
                  <span className="font-medium">{(state.result.stats.avgConfidence * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">处理耗时：</span>
                  <span className="font-medium">{state.durationMs ? `${(state.durationMs / 1000).toFixed(1)}s` : '-'}</span>
                </div>
              </div>
            </div>

            {/* 说话人列表 */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-[var(--color-text-muted)]">检测到的说话人</div>
              <div className="space-y-1">
                {state.result.speakers.map(speaker => (
                  <div
                    key={speaker.speakerId}
                    className="flex items-center gap-2 rounded px-2 py-1 text-sm"
                    style={{ backgroundColor: `hsl(${speaker.speakerId * 60}, 70%, 95%)` }}
                  >
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: `hsl(${speaker.speakerId * 60}, 70%, 50%)` }}
                    />
                    <span>{speaker.speakerLabel}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      ({speaker.sampleCount} 个片段)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                onClick={handleComplete}
                data-testid="apply-diarization-button"
              >
                应用到字幕
              </button>
              <button
                className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-panel"
                onClick={handleReset}
                data-testid="reset-diarization-button"
              >
                重新分离
              </button>
            </div>
          </div>
        )}

        {/* 错误 */}
        {state.stage === 'error' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-red-300 bg-red-50 p-3">
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">分离失败</span>
              </div>
              <div className="mt-1 text-sm text-red-500">{state.error}</div>
            </div>

            <button
              className="w-full rounded-lg border border-line px-4 py-2 text-sm hover:bg-panel"
              onClick={handleReset}
              data-testid="retry-diarization-button"
            >
              重试
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
