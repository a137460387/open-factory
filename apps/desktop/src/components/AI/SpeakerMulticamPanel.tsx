import React, { useState, useCallback, useEffect } from 'react';
import { Users, Video, Settings, Play, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useSpeakerMulticam } from '../../hooks/useSpeakerMulticam';
import type { SpeakerDiarizationResult } from '@open-factory/editor-core/ai/speaker-diarization';
import type { MulticamClip, MulticamSequence } from '@open-factory/editor-core';
import { formatTime } from '@open-factory/editor-core';

/** 说话人-多机位面板属性 */
export interface SpeakerMulticamPanelProps {
  /** 说话人分离结果 */
  diarizationResult?: SpeakerDiarizationResult;
  /** 多机位片段（可选） */
  multicamClip?: MulticamClip | MulticamSequence;
  /** 关闭回调 */
  onClose?: () => void;
  /** 应用切换回调 */
  onApplySwitches?: (switches: Array<{ timeMs: number; targetAngle: number }>) => void;
}

/**
 * 说话人-多机位集成面板
 */
export function SpeakerMulticamPanel({
  diarizationResult,
  multicamClip,
  onClose,
  onApplySwitches,
}: SpeakerMulticamPanelProps) {
  const {
    state,
    setMapping,
    removeMapping,
    updateConfig,
    generateSuggestions,
    applySuggestions,
    clearSuggestions,
    autoConfigureMappings,
    reset,
  } = useSpeakerMulticam();

  const [showSettings, setShowSettings] = useState(false);

  // 获取可用机位
  const availableAngles = multicamClip ? ('angles' in multicamClip ? multicamClip.angles : []) : [];

  // 自动配置映射
  useEffect(() => {
    if (diarizationResult && availableAngles.length > 0 && state.mappings.length === 0) {
      autoConfigureMappings(
        diarizationResult,
        availableAngles.map((a: { name?: string }, i: number) => ({
          index: i,
          name: a.name ?? `机位 ${i + 1}`,
        })),
      );
    }
  }, [diarizationResult, availableAngles, state.mappings.length, autoConfigureMappings]);

  /**
   * 生成切换建议
   */
  const handleGenerateSuggestions = useCallback(() => {
    if (!diarizationResult) return;
    generateSuggestions(diarizationResult);
  }, [diarizationResult, generateSuggestions]);

  /**
   * 应用切换建议
   */
  const handleApplySuggestions = useCallback(() => {
    if (!onApplySwitches) return;
    applySuggestions(state.suggestions, onApplySwitches);
  }, [state.suggestions, onApplySwitches, applySuggestions]);

  /**
   * 更新映射
   */
  const handleMappingChange = useCallback(
    (speakerId: number, angleIndex: number) => {
      const angle = availableAngles[angleIndex];
      setMapping(speakerId, angleIndex, angle?.name);
    },
    [availableAngles, setMapping],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="speaker-multicam-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-ink">说话人-机位映射</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 hover:bg-panel"
            onClick={() => setShowSettings(!showSettings)}
            data-testid="speaker-multicam-settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          {onClose && (
            <button className="rounded p-1 hover:bg-panel" onClick={onClose} data-testid="speaker-multicam-close">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* 无数据提示 */}
        {!diarizationResult && (
          <div className="text-center text-sm text-[var(--color-text-muted)] py-8">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>请先运行说话人分离</p>
          </div>
        )}

        {/* 映射配置 */}
        {diarizationResult && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-[var(--color-text-muted)]">为每个说话人分配对应的机位</div>

            <div className="space-y-2">
              {diarizationResult.speakers.map((speaker) => {
                const mapping = state.mappings.find((m) => m.speakerId === speaker.speakerId);
                const selectedAngle = mapping?.angleIndex ?? -1;

                return (
                  <div key={speaker.speakerId} className="flex items-center gap-2 rounded-lg border border-line p-2">
                    {/* 说话人标识 */}
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: `hsl(${speaker.speakerId * 60}, 70%, 50%)` }}
                    >
                      {String.fromCharCode(65 + speaker.speakerId)}
                    </div>

                    {/* 说话人信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{speaker.speakerLabel}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{speaker.sampleCount} 个片段</div>
                    </div>

                    {/* 机位选择 */}
                    <select
                      value={selectedAngle}
                      onChange={(e) => handleMappingChange(speaker.speakerId, parseInt(e.target.value))}
                      className="rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1 text-xs"
                      data-testid={`angle-select-${speaker.speakerId}`}
                    >
                      <option value={-1}>未分配</option>
                      {availableAngles.map((angle: { id: string; name?: string }, index: number) => (
                        <option key={angle.id} value={index}>
                          {angle.name ?? `机位 ${index + 1}`}
                        </option>
                      ))}
                    </select>

                    {/* 移除按钮 */}
                    {mapping && (
                      <button
                        className="rounded p-1 hover:bg-panel text-[var(--color-text-muted)]"
                        onClick={() => removeMapping(speaker.speakerId)}
                        data-testid={`remove-mapping-${speaker.speakerId}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 设置面板 */}
        {showSettings && (
          <div className="rounded-lg border border-line p-3 space-y-3">
            <div className="text-xs font-medium text-[var(--color-text-muted)]">切换设置</div>

            {/* 启用自动切换 */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.config.enabled}
                onChange={(e) => updateConfig({ enabled: e.target.checked })}
                className="rounded border-line"
                data-testid="auto-switch-enabled"
              />
              <span className="text-sm">启用自动切换</span>
            </label>

            {/* 最小切换间隔 */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">最小切换间隔</span>
                <span>{(state.config.minSwitchIntervalMs / 1000).toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={500}
                max={5000}
                step={100}
                value={state.config.minSwitchIntervalMs}
                onChange={(e) => updateConfig({ minSwitchIntervalMs: parseInt(e.target.value) })}
                className="w-full"
                data-testid="min-switch-interval"
              />
            </div>

            {/* 过渡类型 */}
            <div className="space-y-1">
              <label className="text-xs text-[var(--color-text-muted)]">过渡类型</label>
              <select
                value={state.config.transitionType}
                onChange={(e) => updateConfig({ transitionType: e.target.value as "cut" | "dissolve" | "wipe" })}
                className="w-full rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1 text-xs"
                data-testid="transition-type"
              >
                <option value="cut">硬切</option>
                <option value="dissolve">溶解</option>
                <option value="wipe">擦除</option>
              </select>
            </div>

            {/* 过渡时长（仅溶解和擦除） */}
            {state.config.transitionType !== 'cut' && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">过渡时长</span>
                  <span>{state.config.transitionDurationMs ?? 300}ms</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={1000}
                  step={50}
                  value={state.config.transitionDurationMs ?? 300}
                  onChange={(e) => updateConfig({ transitionDurationMs: parseInt(e.target.value) })}
                  className="w-full"
                  data-testid="transition-duration"
                />
              </div>
            )}
          </div>
        )}

        {/* 生成建议按钮 */}
        {diarizationResult && state.mappings.length > 0 && (
          <button
            className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            onClick={handleGenerateSuggestions}
            disabled={state.isProcessing}
            data-testid="generate-suggestions-button"
          >
            {state.isProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>生成中...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Play className="h-4 w-4" />
                <span>生成切换建议</span>
              </div>
            )}
          </button>
        )}

        {/* 切换建议列表 */}
        {state.suggestions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-[var(--color-text-muted)]">
                切换建议 ({state.suggestions.length})
              </div>
              <button
                className="text-xs text-[var(--color-accent)] hover:underline"
                onClick={clearSuggestions}
                data-testid="clear-suggestions"
              >
                清除
              </button>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {state.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs bg-[var(--color-bg-elevated)]"
                >
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: `hsl(${suggestion.speakerId * 60}, 70%, 50%)` }}
                  />
                  <span className="font-mono text-[var(--color-text-muted)]">
                    {formatTime(suggestion.timeMs / 1000)}
                  </span>
                  <span className="flex-1">→ {suggestion.speakerLabel}</span>
                  <span className="text-[var(--color-text-muted)]">机位 {suggestion.targetAngle + 1}</span>
                  <span className="text-[var(--color-text-muted)]">{(suggestion.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>

            {/* 应用按钮 */}
            {onApplySwitches && (
              <button
                className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                onClick={handleApplySuggestions}
                data-testid="apply-suggestions-button"
              >
                应用到时间线
              </button>
            )}
          </div>
        )}

        {/* 错误信息 */}
        {state.error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{state.error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

