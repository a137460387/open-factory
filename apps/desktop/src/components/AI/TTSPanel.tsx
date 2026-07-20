import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, Volume2, Play, Pause, Download, X, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { useTTS } from '../../hooks/useTTS';
import type { TTSSynthesisParams, TTSVoiceStyle } from '@open-factory/editor-core/ai/tts';

/** TTS面板属性 */
export interface TTSPanelProps {
  /** 初始文本 */
  initialText?: string;
  /** 关闭回调 */
  onClose?: () => void;
  /** 完成回调 */
  onComplete?: (result: { audioData: Float32Array | ArrayBuffer; sampleRate: number; durationMs: number }) => void;
}

/**
 * TTS 语音合成面板
 */
export function TTSPanel({ initialText = '', onClose, onComplete }: TTSPanelProps) {
  const { state, startSynthesis, cancelSynthesis, reset, updateRecommendedVoice, playAudio, exportAudio } = useTTS();

  const [text, setText] = useState(initialText);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [style, setStyle] = useState<TTSVoiceStyle>('neutral');
  const [showSettings, setShowSettings] = useState(false);

  // 更新推荐语音
  useEffect(() => {
    if (text) {
      updateRecommendedVoice(text);
      if (state.recommendedVoice && !selectedVoiceId) {
        setSelectedVoiceId(state.recommendedVoice.id);
      }
    }
  }, [text, updateRecommendedVoice, state.recommendedVoice, selectedVoiceId]);

  /**
   * 开始合成
   */
  const handleStart = useCallback(async () => {
    if (!text.trim()) {
      return;
    }

    const params: TTSSynthesisParams = {
      text: text.trim(),
      voiceId: selectedVoiceId || state.recommendedVoice?.id || 'vits-zh-female-1',
      speed,
      pitch,
      volume,
      style,
    };

    await startSynthesis(params);
  }, [text, selectedVoiceId, speed, pitch, volume, style, state.recommendedVoice, startSynthesis]);

  /**
   * 处理完成
   */
  const handleComplete = useCallback(() => {
    if (state.result && onComplete) {
      onComplete({
        audioData: state.result.audioData,
        sampleRate: state.result.sampleRate,
        durationMs: state.result.durationMs,
      });
    }
  }, [state.result, onComplete]);

  /**
   * 播放预览
   */
  const handlePlay = useCallback(() => {
    if (state.result) {
      playAudio(state.result);
    }
  }, [state.result, playAudio]);

  /**
   * 导出音频
   */
  const handleExport = useCallback(() => {
    if (state.result) {
      exportAudio(state.result, `tts-${Date.now()}.wav`);
    }
  }, [state.result, exportAudio]);

  /**
   * 重置
   */
  const handleReset = useCallback(() => {
    reset();
    setText('');
  }, [reset]);

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="tts-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-ink">AI 语音合成</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 hover:bg-panel"
            onClick={() => setShowSettings(!showSettings)}
            data-testid="tts-settings-toggle"
          >
            <Settings className="h-4 w-4" />
          </button>
          {onClose && (
            <button className="rounded p-1 hover:bg-panel" onClick={onClose} data-testid="tts-close">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* 文本输入 */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--color-text-muted)]">要合成的文本</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入要转换为语音的文本..."
            className="w-full rounded-lg border border-line bg-[var(--color-bg-primary)] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            rows={4}
            disabled={state.stage !== 'idle' && state.stage !== 'done' && state.stage !== 'error'}
            data-testid="tts-text-input"
          />
          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>{text.length} 字符</span>
            {state.recommendedVoice && <span>推荐语音: {state.recommendedVoice.name}</span>}
          </div>
        </div>

        {/* 语音选择 */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--color-text-muted)]">选择语音</label>
          <select
            value={selectedVoiceId}
            onChange={(e) => setSelectedVoiceId(e.target.value)}
            className="w-full rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1.5 text-sm"
            disabled={state.stage !== 'idle' && state.stage !== 'done' && state.stage !== 'error'}
            data-testid="tts-voice-select"
          >
            {state.voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name} (
                {voice.language === 'zh'
                  ? '中文'
                  : voice.language === 'en'
                    ? '英文'
                    : voice.language === 'ja'
                      ? '日文'
                      : '韩文'}
                )
              </option>
            ))}
          </select>
        </div>

        {/* 设置面板 */}
        {showSettings && (
          <div className="rounded-lg border border-line p-3 space-y-3">
            <div className="text-xs font-medium text-[var(--color-text-muted)]">语音参数</div>

            {/* 语速 */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">语速</span>
                <span>{speed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full"
                data-testid="tts-speed-slider"
              />
            </div>

            {/* 音调 */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">音调</span>
                <span>{pitch.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full"
                data-testid="tts-pitch-slider"
              />
            </div>

            {/* 音量 */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">音量</span>
                <span>{(volume * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full"
                data-testid="tts-volume-slider"
              />
            </div>

            {/* 风格 */}
            <div className="space-y-1">
              <label className="text-xs text-[var(--color-text-muted)]">语音风格</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as TTSVoiceStyle)}
                className="w-full rounded border border-line bg-[var(--color-bg-primary)] px-2 py-1 text-xs"
                data-testid="tts-style-select"
              >
                <option value="neutral">中性</option>
                <option value="happy">欢快</option>
                <option value="sad">悲伤</option>
                <option value="angry">愤怒</option>
              </select>
            </div>
          </div>
        )}

        {/* 处理中 */}
        {(state.stage === 'loading' || state.stage === 'synthesizing' || state.stage === 'encoding') && (
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
              onClick={cancelSynthesis}
              data-testid="cancel-tts-button"
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
              <span>合成完成</span>
            </div>

            {/* 统计信息 */}
            <div className="rounded-lg border border-line p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-[var(--color-text-muted)]">时长：</span>
                  <span className="font-medium">{(state.result.durationMs / 1000).toFixed(1)}s</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">处理耗时：</span>
                  <span className="font-medium">
                    {state.durationMs ? `${(state.durationMs / 1000).toFixed(1)}s` : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">实时率：</span>
                  <span className="font-medium">{state.result.stats.realTimeFactor.toFixed(2)}x</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">词数：</span>
                  <span className="font-medium">{state.result.stats.wordCount}</span>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                onClick={handlePlay}
                data-testid="play-tts-button"
              >
                <div className="flex items-center justify-center gap-2">
                  <Play className="h-4 w-4" />
                  <span>播放</span>
                </div>
              </button>
              <button
                className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-panel"
                onClick={handleExport}
                data-testid="export-tts-button"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                onClick={handleComplete}
                data-testid="apply-tts-button"
              >
                应用到时间线
              </button>
              <button
                className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-panel"
                onClick={handleReset}
                data-testid="reset-tts-button"
              >
                重新合成
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
                <span className="font-medium">合成失败</span>
              </div>
              <div className="mt-1 text-sm text-red-500">{state.error}</div>
            </div>

            {/* 验证问题 */}
            {state.validationIssues.length > 0 && (
              <div className="space-y-1">
                {state.validationIssues.map((issue, i) => (
                  <div key={i} className="text-xs text-red-500">
                    • {issue.message}
                  </div>
                ))}
              </div>
            )}

            <button
              className="w-full rounded-lg border border-line px-4 py-2 text-sm hover:bg-panel"
              onClick={handleReset}
              data-testid="retry-tts-button"
            >
              重试
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
