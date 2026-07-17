/**
 * 多机位预览 Worker 管理 Hook
 *
 * 管理 Web Worker 生命周期，提供多机位帧解码能力。
 * 使用 Worker 线程进行并行解码，确保主线程 60fps 流畅。
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import type {
  MulticamPreviewFrameRequest,
  MulticamPreviewWorkerInput,
  MulticamPreviewWorkerOutput,
  MulticamPreviewFrameResult,
} from '../workers/multicam-preview.worker';

export interface MulticamPreviewFrame {
  angleId: string;
  bitmap: ImageBitmap | null;
  decodeTimeMs: number;
}

export interface UseMulticamPreviewWorkerOptions {
  /** Worker 并发解码的最大帧数 */
  maxConcurrent?: number;
  /** 帧缓存大小 */
  cacheSize?: number;
}

export interface UseMulticamPreviewWorkerReturn {
  /** 请求解码指定时间点的所有机位帧 */
  requestFrames: (
    angles: Array<{ id: string; mediaId: string }>,
    time: number,
    width: number,
    height: number,
    mediaToSrc: (mediaId: string) => string,
  ) => void;
  /** 最近解码完成的帧 */
  frames: Map<string, MulticamPreviewFrame>;
  /** 是否正在解码 */
  isDecoding: boolean;
  /** Worker 是否就绪 */
  isReady: boolean;
  /** 错误信息 */
  error: string | null;
}

export function useMulticamPreviewWorker(
  options: UseMulticamPreviewWorkerOptions = {},
): UseMulticamPreviewWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [frames, setFrames] = useState<Map<string, MulticamPreviewFrame>>(new Map());
  const [isDecoding, setIsDecoding] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRequestRef = useRef<boolean>(false);

  // 初始化 Worker
  useEffect(() => {
    try {
      const worker = new Worker(
        new URL('../workers/multicam-preview.worker.ts', import.meta.url),
        { type: 'module' },
      );

      worker.onmessage = (event: MessageEvent<MulticamPreviewWorkerOutput>) => {
        const { type, results } = event.data;

        if (type === 'frames-decoded') {
          setFrames((prev) => {
            const next = new Map(prev);
            for (const result of results) {
              if (result.success && result.bitmap) {
                // 释放旧的 bitmap
                const old = next.get(result.angleId);
                if (old?.bitmap) {
                  old.bitmap.close();
                }
                next.set(result.angleId, {
                  angleId: result.angleId,
                  bitmap: result.bitmap,
                  decodeTimeMs: result.decodeTimeMs,
                });
              }
            }
            return next;
          });
          setIsDecoding(false);
          pendingRequestRef.current = false;
        }
      };

      worker.onerror = (err) => {
        setError(`Worker 错误: ${err.message}`);
        setIsDecoding(false);
        pendingRequestRef.current = false;
      };

      workerRef.current = worker;
      setIsReady(true);
      setError(null);

      return () => {
        worker.terminate();
        workerRef.current = null;
        setIsReady(false);
      };
    } catch (err) {
      setError(`Worker 初始化失败: ${err instanceof Error ? err.message : String(err)}`);
      setIsReady(false);
    }
  }, []);

  // 请求解码帧
  const requestFrames = useCallback(
    (
      angles: Array<{ id: string; mediaId: string }>,
      time: number,
      width: number,
      height: number,
      mediaToSrc: (mediaId: string) => string,
    ) => {
      const worker = workerRef.current;
      if (!worker || pendingRequestRef.current) return;

      const frames: MulticamPreviewFrameRequest[] = angles.map((angle) => ({
        angleId: angle.id,
        mediaSrc: mediaToSrc(angle.mediaId),
        time,
        width,
        height,
      }));

      const input: MulticamPreviewWorkerInput = {
        type: 'decode-frames',
        frames,
      };

      pendingRequestRef.current = true;
      setIsDecoding(true);
      setError(null);

      worker.postMessage(input);
    },
    [],
  );

  // 清理 bitmap 缓存
  useEffect(() => {
    return () => {
      frames.forEach((frame) => {
        if (frame.bitmap) {
          frame.bitmap.close();
        }
      });
    };
  }, []);

  return {
    requestFrames,
    frames,
    isDecoding,
    isReady,
    error,
  };
}
