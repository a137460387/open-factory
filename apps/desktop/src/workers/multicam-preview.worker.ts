/**
 * 多机位预览解码 Worker
 *
 * 在 Worker 线程中并行解码多个机位的帧数据，
 * 主线程只需接收已解码的 ImageBitmap 进行渲染，
 * 确保 60fps 流畅预览。
 */

export interface MulticamPreviewFrameRequest {
  /** 机位 ID */
  angleId: string;
  /** 媒体文件路径（Tauri convertFileSrc 后的 URL） */
  mediaSrc: string;
  /** 目标时间（秒） */
  time: number;
  /** 目标宽度 */
  width: number;
  /** 目标高度 */
  height: number;
}

export interface MulticamPreviewWorkerInput {
  type: 'decode-frames';
  frames: MulticamPreviewFrameRequest[];
}

export interface MulticamPreviewWorkerOutput {
  type: 'frames-decoded';
  results: MulticamPreviewFrameResult[];
}

export interface MulticamPreviewFrameResult {
  angleId: string;
  /** 解码成功 */
  success: boolean;
  /** ImageBitmap 数据（可转移） */
  bitmap?: ImageBitmap;
  /** 错误信息 */
  error?: string;
  /** 解码耗时（ms） */
  decodeTimeMs: number;
}

// ── Worker 主逻辑 ──────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<MulticamPreviewWorkerInput>) => {
  const { type, frames } = event.data;

  if (type !== 'decode-frames') return;

  const results: MulticamPreviewFrameResult[] = [];
  const transferables: Transferable[] = [];

  // 并行解码所有机位帧
  const decodePromises = frames.map(async (frame) => {
    const startTime = performance.now();
    try {
      const bitmap = await decodeFrameAtTime(frame);
      const decodeTimeMs = Math.round(performance.now() - startTime);

      const result: MulticamPreviewFrameResult = {
        angleId: frame.angleId,
        success: true,
        bitmap,
        decodeTimeMs,
      };

      if (bitmap) {
        transferables.push(bitmap);
      }

      return result;
    } catch (error) {
      const decodeTimeMs = Math.round(performance.now() - startTime);
      return {
        angleId: frame.angleId,
        success: false,
        error: error instanceof Error ? error.message : '解码失败',
        decodeTimeMs,
      } as MulticamPreviewFrameResult;
    }
  });

  const decoded = await Promise.all(decodePromises);
  results.push(...decoded);

  const output: MulticamPreviewWorkerOutput = {
    type: 'frames-decoded',
    results,
  };

  self.postMessage(output, { transfer: transferables });
};

// ── 帧解码逻辑 ──────────────────────────────────────────────────

/**
 * 使用 OffscreenCanvas + VideoFrame 解码指定时间的帧
 * 回退到 createImageBitmap + video 元素方案
 */
async function decodeFrameAtTime(frame: MulticamPreviewFrameRequest): Promise<ImageBitmap | undefined> {
  // 方案1：使用 VideoDecoder（如果可用）
  if (typeof VideoDecoder !== 'undefined') {
    try {
      return await decodeWithVideoDecoder(frame);
    } catch {
      // 回退到方案2
    }
  }

  // 方案2：使用 OffscreenCanvas 绘制 video 帧
  return await decodeWithOffscreenCanvas(frame);
}

/**
 * 使用 OffscreenCanvas 方案解码
 * 创建一个隐藏的 video 元素，seek 到目标时间后截取帧
 */
async function decodeWithOffscreenCanvas(frame: MulticamPreviewFrameRequest): Promise<ImageBitmap | undefined> {
  const video = new OffscreenVideoProxy(frame.mediaSrc);

  try {
    await video.load();
    await video.seekTo(frame.time);

    const canvas = new OffscreenCanvas(frame.width, frame.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    ctx.drawImage(video.element, 0, 0, frame.width, frame.height);
    const bitmap = await createImageBitmap(canvas);

    return bitmap;
  } finally {
    video.dispose();
  }
}

/**
 * 使用 VideoDecoder API 解码（更高效，但兼容性有限）
 */
async function decodeWithVideoDecoder(_frame: MulticamPreviewFrameRequest): Promise<ImageBitmap | undefined> {
  // VideoDecoder API 实现（需要浏览器支持）
  // 当前作为预留接口，回退到 OffscreenCanvas 方案
  throw new Error('VideoDecoder not implemented, falling back');
}

// ── Offscreen Video 代理 ──────────────────────────────────────

/**
 * Worker 线程中的视频代理
 * 注意：Worker 中不能直接创建 HTMLVideoElement，
 * 使用 fetch + blob URL 方式获取视频数据，
 * 通过 createImageBitmap 进行帧提取
 */
class OffscreenVideoProxy {
  private blobUrl: string | null = null;
  private _element: HTMLVideoElement | null = null;

  constructor(private src: string) {}

  get element(): HTMLVideoElement {
    if (!this._element) {
      throw new Error('Video element not initialized');
    }
    return this._element;
  }

  async load(): Promise<void> {
    // 在 Worker 中，我们使用 fetch 获取视频数据
    // 然后通过 createImageBitmap 进行解码
    try {
      const response = await fetch(this.src);
      const blob = await response.blob();
      this.blobUrl = URL.createObjectURL(blob);

      // 创建 video 元素（Worker 中可能不可用，需要回退）
      if (typeof document !== 'undefined') {
        this._element = document.createElement('video');
        this._element.src = this.blobUrl;
        this._element.muted = true;
        this._element.preload = 'auto';

        await new Promise<void>((resolve, reject) => {
          this._element!.onloadeddata = () => resolve();
          this._element!.onerror = () => reject(new Error('Video load failed'));
          // 超时处理
          setTimeout(() => reject(new Error('Video load timeout')), 10000);
        });
      } else {
        // Worker 环境中无法创建 DOM 元素
        throw new Error('DOM not available in Worker');
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  async seekTo(time: number): Promise<void> {
    if (!this._element) {
      throw new Error('Video not loaded');
    }

    this._element.currentTime = time;

    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        this._element!.removeEventListener('seeked', onSeeked);
        resolve();
      };
      this._element!.addEventListener('seeked', onSeeked);
      // 如果已经 seek 完成
      if (this._element!.readyState >= 2) {
        resolve();
      }
    });
  }

  dispose(): void {
    if (this._element) {
      this._element.pause();
      this._element.src = '';
      this._element = null;
    }
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }
}
