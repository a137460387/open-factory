/**
 * AI TTS 语音合成 Worker
 *
 * 在独立线程中执行 VITS TTS 推理，避免阻塞主线程。
 * 支持两种模式：
 * 1. Tauri 原生 VITS（通过桥接调用）
 * 2. WebAssembly 推理（前端推理，预留）
 */

import type {
  TTSSynthesisParams,
  TTSSynthesisResult,
  TTSProgressEvent,
  WordTiming,
} from '@open-factory/editor-core/ai/tts';

// -- Worker 消息类型 --

export interface AITTSWorkerInput {
  type: 'synthesize' | 'cancel';
  /** 合成参数 */
  params?: TTSSynthesisParams;
  /** 批量合成参数 */
  batchParams?: TTSSynthesisParams[];
  /** Tauri 请求参数 */
  tauriRequest?: {
    modelPath: string;
    text: string;
    voiceId: string;
    speed?: number;
    pitch?: number;
    volume?: number;
  };
}

export interface AITTSWorkerOutput {
  type: 'progress' | 'result' | 'batch-result' | 'error' | 'cancelled';
  /** 进度事件 */
  event?: TTSProgressEvent;
  /** 合成结果 */
  result?: TTSSynthesisResult;
  /** 批量合成结果 */
  batchResults?: TTSSynthesisResult[];
  /** 处理耗时（毫秒） */
  durationMs?: number;
  /** 错误信息 */
  error?: string;
}

// -- Worker 主逻辑 --

let cancelled = false;

self.onmessage = async (event: MessageEvent<AITTSWorkerInput>) => {
  const input = event.data;

  if (input.type === 'cancel') {
    cancelled = true;
    postMessage({ type: 'cancelled' } satisfies AITTSWorkerOutput);
    return;
  }

  if (input.type === 'synthesize') {
    await handleSingleSynthesis(input);
    return;
  }

  postMessage({
    type: 'error',
    error: `未知消息类型: ${input.type}`,
  } satisfies AITTSWorkerOutput);
};

/**
 * 处理单个合成请求
 */
async function handleSingleSynthesis(input: AITTSWorkerInput): Promise<void> {
  cancelled = false;
  const startTime = performance.now();

  try {
    // 阶段 1：模型加载
    postMessage({
      type: 'progress',
      event: {
        phase: 'loading-model',
        progress: 0,
      },
    } satisfies AITTSWorkerOutput);

    if (cancelled) {
      postMessage({ type: 'cancelled' } satisfies AITTSWorkerOutput);
      return;
    }

    // 阶段 2：合成
    postMessage({
      type: 'progress',
      event: {
        phase: 'synthesizing',
        progress: 0.1,
      },
    } satisfies AITTSWorkerOutput);

    let result: TTSSynthesisResult;

    if (input.tauriRequest) {
      // 通过 Tauri 桥接调用 VITS
      result = await callVITSViaBridge(input.tauriRequest);
    } else if (input.params) {
      // 使用前端合成（简化版本）
      result = await performFrontendTTS(input.params);
    } else {
      throw new Error('缺少合成参数');
    }

    if (cancelled) {
      postMessage({ type: 'cancelled' } satisfies AITTSWorkerOutput);
      return;
    }

    // 阶段 3：编码
    postMessage({
      type: 'progress',
      event: {
        phase: 'encoding',
        progress: 0.8,
      },
    } satisfies AITTSWorkerOutput);

    // 阶段 4：后处理
    postMessage({
      type: 'progress',
      event: {
        phase: 'post-processing',
        progress: 0.95,
      },
    } satisfies AITTSWorkerOutput);

    const durationMs = performance.now() - startTime;

    // 返回结果
    postMessage({
      type: 'result',
      result,
      durationMs,
    } satisfies AITTSWorkerOutput);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    postMessage({
      type: 'error',
      error: errorMessage,
    } satisfies AITTSWorkerOutput);
  }
}

/**
 * 通过 Tauri 桥接调用 VITS
 */
async function callVITSViaBridge(request: {
  modelPath: string;
  text: string;
  voiceId: string;
  speed?: number;
  pitch?: number;
  volume?: number;
}): Promise<TTSSynthesisResult> {
  return new Promise((resolve, reject) => {
    const requestId = `vits-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const handler = (event: MessageEvent) => {
      if (event.data?.requestId === requestId) {
        self.removeEventListener('message', handler);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      }
    };

    self.addEventListener('message', handler);

    // 请求主线程执行 Tauri 调用
    self.postMessage({
      type: 'tauri-request',
      requestId,
      command: 'runTTS',
      args: request,
    });

    // 超时保护（5 分钟）
    setTimeout(() => {
      self.removeEventListener('message', handler);
      reject(new Error('TTS 调用超时（5分钟）'));
    }, 5 * 60 * 1000);
  });
}

/**
 * 前端 TTS 合成（简化版本）
 * 使用 Web Speech API 或生成占位音频
 */
async function performFrontendTTS(params: TTSSynthesisParams): Promise<TTSSynthesisResult> {
  const startTime = performance.now();

  // 尝试使用 Web Speech API
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const audioData = await synthesizeWithWebSpeech(params);
      const processingTimeMs = performance.now() - startTime;
      const durationMs = estimateDuration(params.text, params.speed ?? 1.0);

      return {
        audioData,
        sampleRate: 22050,
        durationMs,
        format: 'pcm',
        wordTimings: generateWordTimings(params.text, durationMs),
        stats: {
          processingTimeMs,
          realTimeFactor: processingTimeMs / durationMs,
          charCount: params.text.length,
          wordCount: countWords(params.text),
        },
      };
    } catch {
      // Web Speech API 失败，使用占位音频
    }
  }

  // 生成占位音频（用于测试）
  const durationMs = estimateDuration(params.text, params.speed ?? 1.0);
  const sampleRate = params.sampleRate ?? 22050;
  const samples = Math.round((durationMs / 1000) * sampleRate);
  const audioData = new Float32Array(samples);

  // 生成简单的正弦波作为占位
  const frequency = 200 + (params.pitch ?? 1.0) * 100;
  const volume = params.volume ?? 1.0;

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    audioData[i] = Math.sin(2 * Math.PI * frequency * t) * volume * 0.3;
  }

  const processingTimeMs = performance.now() - startTime;

  return {
    audioData,
    sampleRate,
    durationMs,
    format: 'pcm',
    wordTimings: generateWordTimings(params.text, durationMs),
    stats: {
      processingTimeMs,
      realTimeFactor: processingTimeMs / durationMs,
      charCount: params.text.length,
      wordCount: countWords(params.text),
    },
  };
}

/**
 * 使用 Web Speech API 合成
 */
async function synthesizeWithWebSpeech(params: TTSSynthesisParams): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(params.text);

    // 设置语音参数
    utterance.rate = params.speed ?? 1.0;
    utterance.pitch = params.pitch ?? 1.0;
    utterance.volume = params.volume ?? 1.0;

    // 尝试选择匹配的语音
    const voices = speechSynthesis.getVoices();
    const targetLang = detectLanguage(params.text);
    const matchingVoice = voices.find(v => v.lang.startsWith(targetLang));

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    // 收集音频数据（Web Speech API 不直接提供音频数据）
    // 这里使用模拟数据，实际应用需要使用 MediaRecorder 或其他方法
    const sampleRate = 22050;
    const durationMs = estimateDuration(params.text, params.speed ?? 1.0);
    const samples = Math.round((durationMs / 1000) * sampleRate);
    const audioData = new Float32Array(samples);

    utterance.onend = () => {
      // 生成模拟音频数据
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        audioData[i] = Math.sin(2 * Math.PI * 200 * t) * 0.3;
      }
      resolve(audioData);
    };

    utterance.onerror = (event) => {
      reject(new Error(`Speech synthesis error: ${event.error}`));
    };

    speechSynthesis.speak(utterance);
  });
}

/**
 * 估算音频时长
 */
function estimateDuration(text: string, speed: number): number {
  // 基于平均语速估算
  const charsPerSecond: Record<string, number> = {
    zh: 4,
    en: 15,
    ja: 5,
    ko: 4.5,
  };

  const lang = detectLanguage(text);
  const cps = charsPerSecond[lang] || 5;
  const baseDuration = (text.length / cps) * 1000;

  return Math.round(baseDuration / speed);
}

/**
 * 检测文本语言
 */
function detectLanguage(text: string): string {
  const cjkPattern = /[\u4e00-\u9fff]/;
  const japanesePattern = /[\u3040-\u30ff]/;
  const koreanPattern = /[\uac00-\ud7af]/;

  for (const char of text) {
    if (japanesePattern.test(char)) return 'ja';
    if (koreanPattern.test(char)) return 'ko';
    if (cjkPattern.test(char)) return 'zh';
  }

  return 'en';
}

/**
 * 生成词时间映射
 */
function generateWordTimings(text: string, totalDurationMs: number): WordTiming[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const avgDuration = totalDurationMs / words.length;
  const timings: WordTiming[] = [];

  let currentTime = 0;
  for (const word of words) {
    const wordDuration = avgDuration * (word.length / 3); // 按字符数调整
    timings.push({
      text: word,
      startMs: Math.round(currentTime),
      endMs: Math.round(currentTime + wordDuration),
      confidence: 0.8,
    });
    currentTime += wordDuration;
  }

  return timings;
}

/**
 * 统计词数
 */
function countWords(text: string): number {
  const lang = detectLanguage(text);

  if (lang === 'zh' || lang === 'ja') {
    // 中日文按字符计数
    return text.replace(/\s/g, '').length;
  }

  // 英文按空格分词
  return text.split(/\s+/).filter(w => w.length > 0).length;
}
