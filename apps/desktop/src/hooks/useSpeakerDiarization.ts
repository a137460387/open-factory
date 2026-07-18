import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  SpeakerDiarizationConfig,
  SpeakerDiarizationResult,
} from '@open-factory/editor-core/ai/speaker-diarization';
import type { TranscriptionSegment } from '@open-factory/editor-core/ai/transcription';

/** 说话人分离阶段 */
export type DiarizationStage = 'idle' | 'loading' | 'processing' | 'done' | 'error';

/** 说话人分离状态 */
export interface SpeakerDiarizationState {
  /** 当前阶段 */
  stage: DiarizationStage;
  /** 进度（0-1） */
  progress: number;
  /** 进度消息 */
  progressMessage: string;
  /** 分离结果 */
  result: SpeakerDiarizationResult | null;
  /** 带标签的转录片段 */
  labeledSegments: Array<{
    startMs: number;
    endMs: number;
    text: string;
    speaker?: string;
    speakerId?: number;
  }> | null;
  /** 错误信息 */
  error: string | null;
  /** 处理耗时 */
  durationMs: number | null;
}

/** 初始状态 */
const INITIAL_STATE: SpeakerDiarizationState = {
  stage: 'idle',
  progress: 0,
  progressMessage: '',
  result: null,
  labeledSegments: null,
  error: null,
  durationMs: null,
};

/**
 * 说话人分离 Hook
 */
export function useSpeakerDiarization() {
  const [state, setState] = useState<SpeakerDiarizationState>(INITIAL_STATE);
  const workerRef = useRef<Worker | null>(null);
  const abortRef = useRef(false);

  // 清理 Worker
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  /**
   * 开始说话人分离
   */
  const startDiarization = useCallback(async (
    audioPath: string,
    transcriptionSegments?: TranscriptionSegment[],
    config?: SpeakerDiarizationConfig,
  ) => {
    // 重置状态
    abortRef.current = false;
    setState({
      ...INITIAL_STATE,
      stage: 'loading',
      progressMessage: '正在加载模型...',
    });

    try {
      // 创建 Worker
      const worker = new Worker(
        new URL('../workers/ai-speaker-diarization.worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;

      // 监听 Worker 消息
      worker.onmessage = (event) => {
        const data = event.data;

        if (abortRef.current) {
          return;
        }

        switch (data.type) {
          case 'progress':
            setState(prev => ({
              ...prev,
              stage: data.phase === 'loading-model' ? 'loading' : 'processing',
              progress: data.progress ?? prev.progress,
              progressMessage: getProgressMessage(data.phase),
            }));
            break;

          case 'result':
            setState(prev => ({
              ...prev,
              stage: 'done',
              progress: 1,
              progressMessage: '分离完成',
              result: data.result,
              labeledSegments: data.labeledSegments,
              durationMs: data.durationMs,
            }));
            worker.terminate();
            workerRef.current = null;
            break;

          case 'error':
            setState(prev => ({
              ...prev,
              stage: 'error',
              error: data.error ?? '未知错误',
            }));
            worker.terminate();
            workerRef.current = null;
            break;

          case 'cancelled':
            setState(prev => ({
              ...prev,
              stage: 'idle',
              progress: 0,
              progressMessage: '',
            }));
            worker.terminate();
            workerRef.current = null;
            break;
        }
      };

      worker.onerror = (error) => {
        setState(prev => ({
          ...prev,
          stage: 'error',
          error: error.message ?? 'Worker 错误',
        }));
        worker.terminate();
        workerRef.current = null;
      };

      // 发送请求
      worker.postMessage({
        type: 'diarize',
        audioPath,
        transcriptionSegments: transcriptionSegments?.map(s => ({
          startMs: s.startMs,
          endMs: s.endMs,
          text: s.text,
        })),
        config,
      });

    } catch (err) {
      setState(prev => ({
        ...prev,
        stage: 'error',
        error: err instanceof Error ? err.message : '启动失败',
      }));
    }
  }, []);

  /**
   * 取消分离
   */
  const cancelDiarization = useCallback(() => {
    abortRef.current = true;
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'cancel' });
    }
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    abortRef.current = true;
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    startDiarization,
    cancelDiarization,
    reset,
  };
}

/**
 * 获取进度消息
 */
function getProgressMessage(phase: string): string {
  switch (phase) {
    case 'loading-model':
      return '正在加载模型...';
    case 'extracting-features':
      return '正在提取声纹特征...';
    case 'clustering':
      return '正在聚类分析...';
    case 'post-processing':
      return '正在后处理...';
    default:
      return '处理中...';
  }
}
