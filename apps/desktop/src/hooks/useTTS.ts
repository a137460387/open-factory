import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  TTSSynthesisParams,
  TTSSynthesisResult,
  TTSVoice,
  TTSConfig,
} from '@open-factory/editor-core/ai/tts';
import {
  getAvailableVoices,
  recommendVoice,
  validateTTSParams,
} from '@open-factory/editor-core/ai/tts';

/** TTS阶段 */
export type TTSStage = 'idle' | 'loading' | 'synthesizing' | 'encoding' | 'done' | 'error';

/** TTS状态 */
export interface TTSState {
  /** 当前阶段 */
  stage: TTSStage;
  /** 进度（0-1） */
  progress: number;
  /** 进度消息 */
  progressMessage: string;
  /** 合成结果 */
  result: TTSSynthesisResult | null;
  /** 可用语音列表 */
  voices: TTSVoice[];
  /** 推荐语音 */
  recommendedVoice: TTSVoice | null;
  /** 错误信息 */
  error: string | null;
  /** 验证问题 */
  validationIssues: Array<{ type: string; message: string }>;
  /** 处理耗时 */
  durationMs: number | null;
}

/** 初始状态 */
const INITIAL_STATE: TTSState = {
  stage: 'idle',
  progress: 0,
  progressMessage: '',
  result: null,
  voices: getAvailableVoices(),
  recommendedVoice: null,
  error: null,
  validationIssues: [],
  durationMs: null,
};

/**
 * TTS 语音合成 Hook
 */
export function useTTS(config?: TTSConfig) {
  const [state, setState] = useState<TTSState>(INITIAL_STATE);
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
   * 更新推荐语音
   */
  const updateRecommendedVoice = useCallback((text: string, preferredGender?: 'male' | 'female' | 'neutral') => {
    const voice = recommendVoice(text, preferredGender);
    setState(prev => ({ ...prev, recommendedVoice: voice ?? null }));
  }, []);

  /**
   * 验证参数
   */
  const validateParams = useCallback((params: TTSSynthesisParams): boolean => {
    const issues = validateTTSParams(params, config);
    setState(prev => ({ ...prev, validationIssues: issues }));
    return issues.length === 0;
  }, [config]);

  /**
   * 开始合成
   */
  const startSynthesis = useCallback(async (params: TTSSynthesisParams) => {
    // 验证参数
    const issues = validateTTSParams(params, config);
    if (issues.length > 0) {
      setState(prev => ({
        ...prev,
        validationIssues: issues,
        error: issues[0].message,
      }));
      return;
    }

    // 重置状态
    abortRef.current = false;
    setState(prev => ({
      ...prev,
      stage: 'loading',
      progress: 0,
      progressMessage: '正在加载模型...',
      error: null,
      validationIssues: [],
      result: null,
    }));

    try {
      // 创建 Worker
      const worker = new Worker(
        new URL('../workers/ai-tts.worker.ts', import.meta.url),
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
              stage: mapProgressPhase(data.event?.phase),
              progress: data.event?.progress ?? prev.progress,
              progressMessage: getTTSProgressMessage(data.event?.phase),
            }));
            break;

          case 'result':
            setState(prev => ({
              ...prev,
              stage: 'done',
              progress: 1,
              progressMessage: '合成完成',
              result: data.result,
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
        type: 'synthesize',
        params,
      });

    } catch (err) {
      setState(prev => ({
        ...prev,
        stage: 'error',
        error: err instanceof Error ? err.message : '启动失败',
      }));
    }
  }, [config]);

  /**
   * 取消合成
   */
  const cancelSynthesis = useCallback(() => {
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
    setState(prev => ({
      ...INITIAL_STATE,
      voices: prev.voices,
    }));
  }, []);

  /**
   * 播放音频
   */
  const playAudio = useCallback((result: TTSSynthesisResult) => {
    if (!result.audioData) return;

    try {
      const audioContext = new AudioContext();
      const audioData = result.audioData instanceof Float32Array
        ? result.audioData
        : new Float32Array(result.audioData);
      const buffer = audioContext.createBuffer(1, audioData.length, result.sampleRate);
      buffer.getChannelData(0).set(audioData);

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();

      source.onended = () => {
        audioContext.close();
      };
    } catch (err) {
      console.error('播放音频失败:', err);
    }
  }, []);

  /**
   * 导出音频
   */
  const exportAudio = useCallback(async (result: TTSSynthesisResult, filename: string) => {
    if (!result.audioData) return;

    try {
      // 转换为 WAV 格式
      const { pcmToWav } = await import('@open-factory/editor-core/ai/tts');
      const wavData = result.audioData instanceof Float32Array
        ? pcmToWav(result.audioData, result.sampleRate)
        : result.audioData;

      // 创建下载链接
      const blob = new Blob([wavData], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.wav') ? filename : `${filename}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('导出音频失败:', err);
    }
  }, []);

  return {
    state,
    startSynthesis,
    cancelSynthesis,
    reset,
    updateRecommendedVoice,
    validateParams,
    playAudio,
    exportAudio,
  };
}

/**
 * 映射进度阶段
 */
function mapProgressPhase(phase: string): TTSStage {
  switch (phase) {
    case 'loading-model':
      return 'loading';
    case 'synthesizing':
      return 'synthesizing';
    case 'encoding':
      return 'encoding';
    case 'post-processing':
      return 'encoding';
    default:
      return 'synthesizing';
  }
}

/**
 * 获取TTS进度消息
 */
function getTTSProgressMessage(phase: string): string {
  switch (phase) {
    case 'loading-model':
      return '正在加载模型...';
    case 'synthesizing':
      return '正在合成语音...';
    case 'encoding':
      return '正在编码音频...';
    case 'post-processing':
      return '正在后处理...';
    default:
      return '处理中...';
  }
}
