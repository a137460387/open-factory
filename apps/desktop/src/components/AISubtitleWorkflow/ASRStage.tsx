import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  MediaAsset,
  TranscriptionSegment,
  TranscriptionLanguage,
  TranscriptionProgressEvent,
} from '@open-factory/editor-core';
import { parseWhisperSrt, processWhisperOutput } from '@open-factory/editor-core';
import type { ASRState } from './useSubtitleWorkflow';
import { zhCN } from '../../i18n/strings';

const t = zhCN.aiSubtitleWorkflow;

// -- 语言选项 --
const LANGUAGE_OPTIONS: Array<{ value: TranscriptionLanguage; label: string }> = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
];

interface ASRStageProps {
  media: MediaAsset[];
  onComplete: (trackId: string) => void;
  onCancel: () => void;
  asrState?: ASRState;
  onUpdate?: (patch: Partial<ASRState>) => void;
  selectedClip?: { id: string; name: string };
}

export function ASRStage(props: ASRStageProps) {
  const { selectedClip, asrState, onUpdate, onComplete } = props;
  const [language, setLanguage] = useState<TranscriptionLanguage>('auto');
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [progress, setProgress] = useState<TranscriptionProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  // 清理 Worker
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'cancel' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // 开始转录
  const startTranscription = useCallback(async () => {
    if (!selectedClip) return;

    setIsRunning(true);
    setError(null);
    setSegments([]);
    setProgress(null);
    onUpdate?.({ status: 'running', progress: 0, error: null });

    try {
      // 创建 Worker
      const worker = new Worker(new URL('../../workers/ai-transcription.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;

      worker.onmessage = (event) => {
        const data = event.data;

        if (data.type === 'progress') {
          setProgress(data.event);
          onUpdate?.({ progress: data.event.progress * 100 });
        } else if (data.type === 'result') {
          // 解析 SRT 内容
          const result = processWhisperOutput(data.srtContent, { language });
          setSegments(result.segments);
          setIsRunning(false);
          onUpdate?.({ status: 'done', progress: 100 });

          // 生成 trackId 并通知完成
          const trackId = `ai-sub-track-${Date.now()}`;
          onComplete(trackId);

          worker.terminate();
          workerRef.current = null;
        } else if (data.type === 'error') {
          setError(data.error);
          setIsRunning(false);
          onUpdate?.({ status: 'error', error: data.error });

          worker.terminate();
          workerRef.current = null;
        } else if (data.type === 'cancelled') {
          setIsRunning(false);
          onUpdate?.({ status: 'idle' });

          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = (err) => {
        const errorMsg = err.message || 'Worker 错误';
        setError(errorMsg);
        setIsRunning(false);
        onUpdate?.({ status: 'error', error: errorMsg });

        worker.terminate();
        workerRef.current = null;
      };

      // 发送转录请求
      worker.postMessage({
        type: 'transcribe',
        request: {
          executablePath: '', // 从设置中获取
          modelPath: '', // 从设置中获取
          audioPath: '', // 从选中片段获取
          clipId: selectedClip.id,
        },
        language,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '转录启动失败';
      setError(errorMsg);
      setIsRunning(false);
      onUpdate?.({ status: 'error', error: errorMsg });
    }
  }, [selectedClip, language, onUpdate, onComplete]);

  // 取消转录
  const cancelTranscription = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'cancel' });
    }
  }, []);

  // 渲染
  return (
    <div className="space-y-4" data-testid="subtitle-workflow-asr-stage">
      {/* 片段选择 */}
      <div className="rounded-lg border border-line bg-[var(--color-bg-elevated)] p-3">
        <h3 className="mb-2 text-xs font-medium text-ink">{t.asr.selectClip}</h3>
        {selectedClip ? (
          <div className="flex items-center gap-2 rounded-md bg-[var(--color-bg-primary)] px-3 py-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-ink">{selectedClip.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md bg-[var(--color-bg-primary)] px-3 py-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-text-muted)]" />
            <span className="text-sm text-[var(--color-text-muted)]">{t.asr.noClipSelected}</span>
          </div>
        )}
      </div>

      {/* 语言选择 */}
      <div className="rounded-lg border border-line bg-[var(--color-bg-elevated)] p-3">
        <h3 className="mb-2 text-xs font-medium text-ink">识别语言</h3>
        <select
          className="w-full rounded-md border border-line bg-[var(--color-bg-primary)] px-3 py-1.5 text-sm text-ink focus:border-[var(--color-accent)] focus:outline-none"
          value={language}
          onChange={(e) => setLanguage(e.target.value as TranscriptionLanguage)}
          disabled={isRunning}
          data-testid="asr-language-select"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Whisper 状态 */}
      <div className="rounded-lg border border-line bg-[var(--color-bg-elevated)] p-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${asrState?.whisperReady ? 'bg-green-500' : 'bg-yellow-500'}`}
          />
          <span className="text-xs text-[var(--color-text-secondary)]">
            {asrState?.whisperReady ? t.asr.whisperReady : t.asr.whisperNotConfigured}
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {!isRunning ? (
          <button
            className="flex-1 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!selectedClip}
            onClick={startTranscription}
            data-testid="asr-start-button"
          >
            {t.asr.startRecognition}
          </button>
        ) : (
          <button
            className="flex-1 rounded-md border border-line bg-[var(--color-bg-elevated)] px-4 py-2 text-sm font-medium text-ink hover:bg-panel"
            type="button"
            onClick={cancelTranscription}
            data-testid="asr-cancel-button"
          >
            取消
          </button>
        )}
      </div>

      {/* 进度显示 */}
      {isRunning && progress && (
        <div className="rounded-lg border border-line bg-[var(--color-bg-elevated)] p-3" data-testid="asr-progress">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {progress.phase === 'loading-model' && '加载模型中...'}
              {progress.phase === 'decoding' && '识别中...'}
              {progress.phase === 'post-processing' && '后处理中...'}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">{Math.round(progress.progress * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-primary)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${Math.round(progress.progress * 100)}%` }}
            />
          </div>
          {progress.estimatedMs != null && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              预计剩余 {Math.round(progress.estimatedMs / 1000)} 秒
            </p>
          )}
        </div>
      )}

      {/* 错误显示 */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3" data-testid="asr-error">
          <p className="text-sm text-red-600">{t.asr.recognitionFailed}</p>
          <p className="mt-1 text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* 结果预览 */}
      {segments.length > 0 && (
        <div className="rounded-lg border border-line bg-[var(--color-bg-elevated)] p-3" data-testid="asr-results">
          <h3 className="mb-2 text-xs font-medium text-ink">{t.asr.previewTitle}</h3>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {segments.slice(0, 20).map((seg, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="shrink-0 text-[var(--color-text-muted)]">{formatTimecode(seg.startMs)}</span>
                <span className="text-ink">{seg.text}</span>
              </div>
            ))}
            {segments.length > 20 && (
              <p className="text-xs text-[var(--color-text-muted)]">...共 {segments.length} 条字幕</p>
            )}
          </div>
        </div>
      )}

      {/* 无结果提示 */}
      {!isRunning && !error && asrState?.status === 'done' && segments.length === 0 && (
        <div className="rounded-lg border border-line bg-[var(--color-bg-elevated)] p-3 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">{t.asr.noResults}</p>
        </div>
      )}
    </div>
  );
}

// -- 辅助函数 --

/** 毫秒格式化为 HH:MM:SS.mmm */
function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;

  return (
    [hours.toString().padStart(2, '0'), minutes.toString().padStart(2, '0'), seconds.toString().padStart(2, '0')].join(
      ':',
    ) +
    '.' +
    millis.toString().padStart(3, '0')
  );
}
