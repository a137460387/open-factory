/**
 * 实时预览组件
 *
 * 基于 GPU 加速的实时色彩预览面板。
 * 支持 WebGPU / WebGL2 双后端，自动回退到 CPU 处理。
 * 包含性能监控面板和多分辨率切换。
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  GPUColorCorrectionParams,
  GPUToneMappingParams,
  GPU3DLUTData,
  GPUPipelineConfig,
  GPUDeviceInfo,
  GPUPerformanceStats,
  PreviewResolution,
} from '@open-factory/editor-core/color/gpu-color-processing';
import {
  GPUColorProcessor,
  PreviewFrameCache,
  GPUPerformanceMonitor,
  RESOLUTION_PRESETS,
  createDefaultColorCorrectionParams,
  createDefaultToneMappingParams,
  createDefaultPipelineConfig,
  fromPrimaryWheelAndSliders,
} from '@open-factory/editor-core/color/gpu-color-processing';
import type { PrimaryWheelParams, PrimarySliderParams } from '@open-factory/editor-core/color-grading/types';

// ==================== 类型定义 ====================

/** 实时预览属性 */
export interface RealtimePreviewProps {
  /** 输入帧数据 */
  inputFrame: Uint8ClampedArray | null;
  /** 帧宽度 */
  frameWidth: number;
  /** 帧高度 */
  frameHeight: number;
  /** 色轮参数 */
  wheelParams?: PrimaryWheelParams;
  /** 滑块参数 */
  sliderParams?: PrimarySliderParams;
  /** 3D LUT 数据 */
  lutData?: GPU3DLUTData | null;
  /** LUT 强度 */
  lutIntensity?: number;
  /** 预览分辨率 */
  resolution?: PreviewResolution;
  /** 是否显示性能面板 */
  showPerformancePanel?: boolean;
  /** 参数变更回调 */
  onPerformanceUpdate?: (stats: GPUPerformanceStats) => void;
  /** GPU 设备就绪回调 */
  onDeviceReady?: (info: GPUDeviceInfo) => void;
}

/** 性能面板属性 */
interface PerformancePanelProps {
  stats: GPUPerformanceStats;
  deviceInfo: GPUDeviceInfo | null;
  backend: string;
  resolution: PreviewResolution;
}

// ==================== 子组件 ====================

/** 性能监控面板 */
function PerformancePanel({ stats, deviceInfo, backend, resolution }: PerformancePanelProps) {
  const fpsColor = stats.frameTimeMs < 20 ? '#10b981' : stats.frameTimeMs < 33 ? '#f59e0b' : '#f43f5e';

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        background: 'rgba(0,0,0,0.85)',
        color: '#e5e5e5',
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 12,
        fontFamily: 'monospace',
        lineHeight: 1.6,
        minWidth: 200,
        zIndex: 10,
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#38bdf8' }}>⚡ 性能监控</div>
      <div>
        后端: <span style={{ color: '#a78bfa' }}>{backend}</span>
      </div>
      <div>
        分辨率: <span style={{ color: '#a78bfa' }}>{RESOLUTION_PRESETS[resolution].label}</span>
      </div>
      <div>
        帧时间: <span style={{ color: fpsColor }}>{stats.frameTimeMs.toFixed(1)}ms</span>
      </div>
      <div>
        估算 FPS:{' '}
        <span style={{ color: fpsColor }}>{stats.frameTimeMs > 0 ? (1000 / stats.frameTimeMs).toFixed(0) : '—'}</span>
      </div>
      <div>已渲染: {stats.framesRendered} 帧</div>
      <div>
        缓存: <span style={{ color: '#10b981' }}>{stats.cacheHits} 命中</span> /{' '}
        <span style={{ color: '#f59e0b' }}>{stats.cacheMisses} 未中</span>
      </div>
      {deviceInfo && (
        <>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4, paddingTop: 4 }}>
            GPU: {deviceInfo.renderer || deviceInfo.vendor}
          </div>
          <div>最大纹理: {deviceInfo.maxTextureSize}px</div>
        </>
      )}
    </div>
  );
}

/** 分辨率切换器 */
function ResolutionSelector({
  current,
  onChange,
}: {
  current: PreviewResolution;
  onChange: (r: PreviewResolution) => void;
}) {
  const resolutions: PreviewResolution[] = ['720p', '1080p', '1440p', '4k'];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        display: 'flex',
        gap: 4,
        zIndex: 10,
      }}
    >
      {resolutions.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: 'none',
            background: r === current ? '#38bdf8' : 'rgba(0,0,0,0.7)',
            color: r === current ? '#000' : '#e5e5e5',
            fontSize: 11,
            fontWeight: r === current ? 700 : 400,
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            transition: 'all 0.15s',
          }}
        >
          {RESOLUTION_PRESETS[r].label}
        </button>
      ))}
    </div>
  );
}

/** GPU 状态指示器 */
function GPUStatusIndicator({ backend, available }: { backend: string; available: boolean }) {
  const color = available ? (backend === 'webgpu' ? '#10b981' : backend === 'webgl2' ? '#f59e0b' : '#f43f5e') : '#666';
  const label = available ? (backend === 'webgpu' ? 'WebGPU' : backend === 'webgl2' ? 'WebGL2' : 'CPU') : '初始化中';

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(0,0,0,0.7)',
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: 11,
        color: '#e5e5e5',
        zIndex: 10,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          boxShadow: available ? `0 0 6px ${color}` : 'none',
        }}
      />
      {label}
    </div>
  );
}

// ==================== 主组件 ====================

/**
 * 实时预览组件
 *
 * 提供 GPU 加速的实时色彩预览。包含性能监控、
 * 分辨率切换和 GPU 状态显示。
 */
export function RealtimePreview({
  inputFrame,
  frameWidth,
  frameHeight,
  wheelParams,
  sliderParams,
  lutData,
  lutIntensity = 1.0,
  resolution = '1080p',
  showPerformancePanel = false,
  onPerformanceUpdate,
  onDeviceReady,
}: RealtimePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processorRef = useRef<GPUColorProcessor | null>(null);
  const cacheRef = useRef<PreviewFrameCache>(new PreviewFrameCache());
  const monitorRef = useRef<GPUPerformanceMonitor>(new GPUPerformanceMonitor());
  const animFrameRef = useRef<number>(0);

  const [currentResolution, setCurrentResolution] = useState<PreviewResolution>(resolution);
  const [deviceInfo, setDeviceInfo] = useState<GPUDeviceInfo | null>(null);
  const [backend, setBackend] = useState<string>('cpu-fallback');
  const [stats, setStats] = useState<GPUPerformanceStats>({
    frameTimeMs: 0,
    gpuTimeMs: 0,
    uploadTimeMs: 0,
    downloadTimeMs: 0,
    textureMemoryMB: 0,
    bufferMemoryMB: 0,
    framesRendered: 0,
    cacheHits: 0,
    cacheMisses: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // 初始化 GPU 处理器
  useEffect(() => {
    const processor = new GPUColorProcessor({ resolution: currentResolution, enableCache: true });
    processorRef.current = processor;

    processor.initialize().then((info) => {
      setDeviceInfo(info);
      setBackend(info.backend);
      onDeviceReady?.(info);
    });

    return () => {
      processor.dispose();
      processorRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 更新分辨率
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.updateConfig({ resolution: currentResolution });
      cacheRef.current.clear();
    }
  }, [currentResolution]);

  // 构建色彩校正参数
  const colorCorrection = useMemo<GPUColorCorrectionParams | null>(() => {
    if (wheelParams && sliderParams) {
      return fromPrimaryWheelAndSliders(wheelParams, sliderParams);
    }
    return null;
  }, [wheelParams, sliderParams]);

  // 处理帧
  const processFrame = useCallback(async () => {
    const processor = processorRef.current;
    const canvas = canvasRef.current;
    if (!processor || !canvas || !inputFrame || isProcessing) return;

    setIsProcessing(true);

    try {
      const preset = RESOLUTION_PRESETS[currentResolution];
      const result = await processor.processFrame(
        inputFrame,
        frameWidth,
        frameHeight,
        colorCorrection,
        createDefaultToneMappingParams(),
        lutData ?? null,
        lutIntensity,
      );

      // 绘制到 canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = new ImageData(new Uint8ClampedArray(result.outputData), result.width, result.height);

        canvas.width = preset.width;
        canvas.height = preset.height;
        ctx.putImageData(imageData, 0, 0);
      }

      // 更新统计
      const currentStats = processor.getPerformanceStats();
      setStats(currentStats);
      monitorRef.current.recordFrame(currentStats.frameTimeMs, currentStats.gpuTimeMs);
      onPerformanceUpdate?.(currentStats);
    } catch {
      // 静默处理渲染错误
    } finally {
      setIsProcessing(false);
    }
  }, [
    inputFrame,
    frameWidth,
    frameHeight,
    colorCorrection,
    lutData,
    lutIntensity,
    currentResolution,
    isProcessing,
    onPerformanceUpdate,
  ]);

  // 动画循环
  useEffect(() => {
    if (!inputFrame) return;

    const tick = () => {
      processFrame();
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [inputFrame, processFrame]);

  const preset = RESOLUTION_PRESETS[currentResolution];

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        background: '#0a0a0a',
        borderRadius: 8,
        overflow: 'hidden',
        aspectRatio: `${preset.width}/${preset.height}`,
      }}
    >
      {/* 预览画布 */}
      <canvas
        ref={canvasRef}
        data-testid="realtime-preview-canvas"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'contain',
        }}
      />

      {/* GPU 状态指示器 */}
      <GPUStatusIndicator backend={backend} available={!!deviceInfo} />

      {/* 性能面板 */}
      {showPerformancePanel && (
        <PerformancePanel stats={stats} deviceInfo={deviceInfo} backend={backend} resolution={currentResolution} />
      )}

      {/* 分辨率切换 */}
      <ResolutionSelector current={currentResolution} onChange={setCurrentResolution} />

      {/* 处理中指示 */}
      {isProcessing && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            background: 'rgba(0,0,0,0.7)',
            color: '#f59e0b',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 10,
            zIndex: 10,
          }}
        >
          处理中...
        </div>
      )}

      {/* 无输入占位 */}
      {!inputFrame && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            fontSize: 14,
          }}
        >
          等待视频帧输入...
        </div>
      )}
    </div>
  );
}

export default RealtimePreview;
