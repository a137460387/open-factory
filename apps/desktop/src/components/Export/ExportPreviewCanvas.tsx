import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { listenBridge, convertLocalFileSrc } from '../../lib/tauri-bridge';
import { useExportQueueStore } from '../../export/export-queue-store';

/**
 * 导出进度预览帧事件
 */
export interface ExportPreviewFrameEvent {
  taskId: string;
  framePath: string;
  timestamp: number;
  progress: number;
}

/**
 * 预览帧数据
 */
export interface PreviewFrame {
  id: string;
  src: string;
  timestamp: number;
  progress: number;
  loaded: boolean;
}

/**
 * ExportPreviewCanvas 组件属性
 */
export interface ExportPreviewCanvasProps {
  /** 当前导出任务 ID */
  taskId?: string;
  /** 画布宽度 */
  width?: number;
  /** 画布高度 */
  height?: number;
  /** 最大预览帧数 */
  maxFrames?: number;
  /** 是否显示进度条 */
  showProgressBar?: boolean;
  /** 是否显示帧时间戳 */
  showTimestamps?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 导出进度预览画布组件
 *
 * 在导出过程中实时显示已渲染帧的缩略图预览，替代纯进度条。
 * 通过监听 Tauri 后端的 export-preview-frame 事件获取帧数据。
 */
export function ExportPreviewCanvas({
  taskId,
  width = 640,
  height = 360,
  maxFrames = 9,
  showProgressBar = true,
  showTimestamps = true,
  className = '',
}: ExportPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frames, setFrames] = useState<PreviewFrame[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [error, setError] = useState<string>();
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // 从导出队列存储获取任务状态
  const task = useExportQueueStore((state) => state.tasks.find((t) => t.id === taskId));

  // 更新进度
  useEffect(() => {
    if (task) {
      setCurrentProgress(task.progress);
    }
  }, [task]);

  // 监听预览帧事件
  useEffect(() => {
    if (!taskId) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listenBridge<ExportPreviewFrameEvent>('export-preview-frame', (event) => {
          if (disposed || event.taskId !== taskId) return;

          const frameId = `frame-${event.timestamp}-${Math.random().toString(36).slice(2, 8)}`;
          const frameSrc = convertLocalFileSrc(event.framePath);

          setFrames((prev) => {
            const newFrame: PreviewFrame = {
              id: frameId,
              src: frameSrc,
              timestamp: event.timestamp,
              progress: event.progress,
              loaded: false,
            };

            // 保持最大帧数限制
            const updated = [...prev, newFrame];
            if (updated.length > maxFrames) {
              // 移除最早的帧并清理缓存
              const removed = updated.slice(0, updated.length - maxFrames);
              removed.forEach((frame) => {
                imageCache.current.delete(frame.src);
              });
              return updated.slice(updated.length - maxFrames);
            }
            return updated;
          });

          setCurrentProgress(event.progress);
        });
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'Failed to listen for preview frames');
        }
      }
    };

    setupListener();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [taskId, maxFrames]);

  // 预加载图片
  useEffect(() => {
    frames.forEach((frame) => {
      if (!frame.loaded && !imageCache.current.has(frame.src)) {
        const img = new Image();
        img.onload = () => {
          imageCache.current.set(frame.src, img);
          setFrames((prev) => prev.map((f) => (f.id === frame.id ? { ...f, loaded: true } : f)));
        };
        img.onerror = () => {
          console.warn(`Failed to load preview frame: ${frame.src}`);
        };
        img.src = frame.src;
      }
    });
  }, [frames]);

  // 绘制画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // 计算网格布局
    const loadedFrames = frames.filter((f) => f.loaded);
    if (loadedFrames.length === 0) {
      // 显示等待状态
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('等待预览帧...', width / 2, height / 2);
      return;
    }

    const cols = Math.ceil(Math.sqrt(loadedFrames.length));
    const rows = Math.ceil(loadedFrames.length / cols);
    const frameWidth = Math.floor(width / cols);
    const frameHeight = Math.floor(height / rows);

    // 绘制每一帧
    loadedFrames.forEach((frame, index) => {
      const img = imageCache.current.get(frame.src);
      if (!img) return;

      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * frameWidth;
      const y = row * frameHeight;

      // 绘制帧图片（保持宽高比）
      const scale = Math.min(frameWidth / img.width, frameHeight / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const offsetX = (frameWidth - scaledWidth) / 2;
      const offsetY = (frameHeight - scaledHeight) / 2;

      ctx.drawImage(img, x + offsetX, y + offsetY, scaledWidth, scaledHeight);

      // 绘制边框
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, frameWidth, frameHeight);

      // 绘制时间戳
      if (showTimestamps) {
        const timestamp = formatTimestamp(frame.timestamp);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y + frameHeight - 20, frameWidth, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(timestamp, x + 4, y + frameHeight - 6);
      }
    });

    // 绘制进度条
    if (showProgressBar) {
      const progressBarHeight = 4;
      const progressBarY = height - progressBarHeight;

      // 背景
      ctx.fillStyle = '#374151';
      ctx.fillRect(0, progressBarY, width, progressBarHeight);

      // 进度
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, progressBarY, width * currentProgress, progressBarHeight);
    }
  }, [frames, width, height, showProgressBar, showTimestamps, currentProgress]);

  // 清理缓存
  useEffect(() => {
    return () => {
      imageCache.current.clear();
    };
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-gray-700 bg-gray-900 ${className}`}
      data-testid="export-preview-canvas"
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block"
        data-testid="export-preview-canvas-element"
      />

      {/* 进度信息覆盖层 */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="text-sm text-white">导出进度: {Math.round(currentProgress * 100)}%</div>
        <div className="text-xs text-gray-300">{frames.length} 帧预览</div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
          <div className="rounded-md bg-red-800 px-4 py-2 text-sm text-white">{error}</div>
        </div>
      )}

      {/* 加载状态 */}
      {frames.length === 0 && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            <span className="text-sm">等待预览帧...</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 格式化时间戳
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * 简化版导出进度条组件
 */
export function ExportProgressBar({ progress, className = '' }: { progress: number; className?: string }) {
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-gray-700 ${className}`}
      data-testid="export-progress-bar"
    >
      <div
        className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        data-testid="export-progress-bar-fill"
      />
    </div>
  );
}

/**
 * 导出预览缩略图网格组件
 */
export function ExportPreviewThumbnailGrid({
  thumbnails,
  className = '',
}: {
  thumbnails: Array<{ src: string; label: string; timestamp?: number }>;
  className?: string;
}) {
  if (thumbnails.length === 0) {
    return null;
  }

  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{
        gridTemplateColumns: `repeat(${Math.min(3, thumbnails.length)}, 1fr)`,
      }}
      data-testid="export-preview-thumbnail-grid"
    >
      {thumbnails.map((thumbnail, index) => (
        <div
          key={index}
          className="group relative overflow-hidden rounded-md border border-gray-600"
          data-testid={`export-preview-thumbnail-${index}`}
        >
          <img src={thumbnail.src} alt={thumbnail.label} className="aspect-video w-full object-cover" loading="lazy" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
            <div className="text-xs text-white">{thumbnail.label}</div>
            {thumbnail.timestamp !== undefined && (
              <div className="text-[10px] text-gray-300">{formatTimestamp(thumbnail.timestamp)}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
