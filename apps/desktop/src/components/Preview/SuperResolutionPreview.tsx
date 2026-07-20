import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ZoomIn,
  Settings,
  Play,
  Pause,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  Gauge,
  Sparkles,
  Monitor,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  UpscaleFactor,
  SuperResolutionModel,
  SuperResolutionConfig,
  SuperResolutionResult,
  GPUMode,
} from '@open-factory/editor-core/ai/super-resolution';
import {
  createDefaultSuperResolutionConfig,
  validateSuperResolutionConfig,
  selectOptimalModel,
  evaluateQuality,
} from '@open-factory/editor-core/ai/super-resolution';

/** 超分辨率预览面板属性 */
export interface SuperResolutionPreviewProps {
  /** 源图像数据 URL 或 canvas 引用 */
  sourceUrl?: string;
  /** 源 canvas 引用 */
  sourceCanvas?: HTMLCanvasElement;
  /** 关闭回调 */
  onClose?: () => void;
  /** 应用回调 */
  onApply?: (config: SuperResolutionConfig) => void;
  /** 处理完成回调 */
  onComplete?: (result: SuperResolutionResult) => void;
}

/** 处理状态 */
type ProcessingState = 'idle' | 'processing' | 'completed' | 'error';

/**
 * 超分辨率预览组件
 *
 * 提供：
 * - 实时预览超分效果
 * - 缩放因子选择 (2x/4x)
 * - 模型选择
 * - 降噪/锐化参数调整
 * - 质量评估显示
 * - GPU 加速状态
 */
export function SuperResolutionPreview({
  sourceUrl,
  sourceCanvas,
  onClose,
  onApply,
  onComplete,
}: SuperResolutionPreviewProps) {
  const [config, setConfig] = useState<SuperResolutionConfig>(createDefaultSuperResolutionConfig());
  const [state, setState] = useState<ProcessingState>('idle');
  const [result, setResult] = useState<SuperResolutionResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [previewMode, setPreviewMode] = useState<'split' | 'original' | 'upscaled'>('split');
  const [splitPosition, setSplitPosition] = useState(50);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const upscaledCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // 配置验证
  const configErrors = useMemo(() => validateSuperResolutionConfig(config), [config]);

  // 更新配置
  const updateConfig = useCallback(<K extends keyof SuperResolutionConfig>(key: K, value: SuperResolutionConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  // 开始处理
  const handleProcess = useCallback(async () => {
    if (configErrors.length > 0) return;

    setState('processing');
    setErrorMessage(null);

    try {
      // 从 canvas 获取图像数据
      const canvas = sourceCanvas || originalCanvasRef.current;
      if (!canvas) {
        throw new Error('没有可用的源图像');
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法获取 canvas 上下文');
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // 动态导入以支持懒加载
      const { upscaleFrame } = await import('@open-factory/editor-core/ai/super-resolution');

      const processResult = upscaleFrame({ data: imageData.data, width: canvas.width, height: canvas.height }, config);

      setResult(processResult);
      setState('completed');

      // 绘制结果到预览 canvas
      if (upscaledCanvasRef.current) {
        const outCtx = upscaledCanvasRef.current.getContext('2d');
        if (outCtx) {
          upscaledCanvasRef.current.width = processResult.output.width;
          upscaledCanvasRef.current.height = processResult.output.height;
          const outImageData = new ImageData(
            new Uint8ClampedArray(processResult.output.data),
            processResult.output.width,
            processResult.output.height,
          );
          outCtx.putImageData(outImageData, 0, 0);
        }
      }

      onComplete?.(processResult);
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : '处理失败');
    }
  }, [config, configErrors, sourceCanvas, onComplete]);

  // 应用配置
  const handleApply = useCallback(() => {
    onApply?.(config);
  }, [config, onApply]);

  // 分割线拖动
  const handleSplitDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setSplitPosition(Math.max(5, Math.min(95, x)));
  }, []);

  // 渲染预览
  useEffect(() => {
    if (!previewCanvasRef.current || !sourceCanvas) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = sourceCanvas.width * 2;
    canvas.height = sourceCanvas.height * 2;

    // 绘制分割预览
    const splitX = (splitPosition / 100) * canvas.width;

    // 左侧：原始
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, canvas.height);
    ctx.clip();
    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // 右侧：超分
    if (upscaledCanvasRef.current && state === 'completed') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, canvas.width - splitX, canvas.height);
      ctx.clip();
      ctx.drawImage(upscaledCanvasRef.current, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // 分割线
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, canvas.height);
    ctx.stroke();

    // 标签
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(8, 8, 60, 24);
    ctx.fillRect(canvas.width - 68, 8, 60, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText('原始', 14, 24);
    ctx.fillText(`${config.scaleFactor}x`, canvas.width - 56, 24);
  }, [sourceCanvas, state, splitPosition, config.scaleFactor]);

  return (
    <div
      className="super-resolution-preview"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--panel-bg, #1e1e1e)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color, #333)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>AI 超分辨率</span>
          {result?.gpuAccelerated && (
            <span
              style={{
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'var(--accent-bg, #2d4a2d)',
                color: 'var(--accent-text, #4ade80)',
              }}
            >
              GPU
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* 预览区域 */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 200 }} onMouseMove={handleSplitDrag}>
        <canvas
          ref={previewCanvasRef}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          data-testid="sr-preview-canvas"
        />
        <canvas ref={originalCanvasRef} style={{ display: 'none' }} />
        <canvas ref={upscaledCanvasRef} style={{ display: 'none' }} />

        {state === 'processing' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.5)',
            }}
          >
            <Loader2 size={32} className="animate-spin" />
            <span style={{ marginLeft: 8 }}>处理中...</span>
          </div>
        )}

        {state === 'error' && errorMessage && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--error-bg, #4a2020)',
              color: 'var(--error-text, #f87171)',
              fontSize: 12,
            }}
          >
            <AlertCircle size={14} />
            {errorMessage}
          </div>
        )}
      </div>

      {/* 控制栏 */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border-color, #333)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* 缩放因子选择 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #999)', minWidth: 48 }}>缩放</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {([2, 4] as UpscaleFactor[]).map((factor) => (
              <button
                key={factor}
                onClick={() => updateConfig('scaleFactor', factor)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 4,
                  border: '1px solid var(--border-color, #444)',
                  background: config.scaleFactor === factor ? 'var(--accent-bg, #2563eb)' : 'transparent',
                  color: config.scaleFactor === factor ? '#fff' : 'var(--text-primary, #ccc)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
                data-testid={`sr-factor-${factor}`}
              >
                {factor}x
              </button>
            ))}
          </div>

          {/* 模型选择 */}
          <select
            value={config.model}
            onChange={(e) => updateConfig('model', e.target.value as SuperResolutionModel)}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid var(--border-color, #444)',
              background: 'var(--input-bg, #2a2a2a)',
              color: 'var(--text-primary, #ccc)',
              fontSize: 12,
              marginLeft: 'auto',
            }}
            data-testid="sr-model-select"
          >
            <option value="auto">自动选择</option>
            <option value="realesrgan-x2plus">Real-ESRGAN 2x</option>
            <option value="realesrgan-x4plus">Real-ESRGAN 4x</option>
            <option value="realesrgan-x4-anime">Real-ESRGAN 动漫</option>
            <option value="esrgan-x4">ESRGAN 4x</option>
          </select>
        </div>

        {/* 参数滑块 */}
        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
          <SliderControl
            label="降噪"
            value={config.denoiseStrength}
            onChange={(v) => updateConfig('denoiseStrength', v)}
            testId="sr-denoise"
          />
          <SliderControl
            label="锐化"
            value={config.sharpenStrength}
            onChange={(v) => updateConfig('sharpenStrength', v)}
            testId="sr-sharpen"
          />
        </div>

        {/* 高级设置 */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary, #999)',
            cursor: 'pointer',
            fontSize: 11,
            padding: 0,
          }}
        >
          <Settings size={12} />
          高级设置
          {showSettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showSettings && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={config.preserveFaces}
                onChange={(e) => updateConfig('preserveFaces', e.target.checked)}
              />
              保留人脸质量
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={config.temporalConsistency}
                onChange={(e) => updateConfig('temporalConsistency', e.target.checked)}
              />
              时序一致性（视频模式）
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-secondary, #999)', minWidth: 64 }}>GPU 模式</span>
              <select
                value={config.gpuMode}
                onChange={(e) => updateConfig('gpuMode', e.target.value as GPUMode)}
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid var(--border-color, #444)',
                  background: 'var(--input-bg, #2a2a2a)',
                  color: 'var(--text-primary, #ccc)',
                  fontSize: 12,
                }}
              >
                <option value="auto">自动</option>
                <option value="webgl">WebGL</option>
                <option value="webgpu">WebGPU</option>
                <option value="cpu-fallback">仅 CPU</option>
              </select>
            </div>
            <SliderControl
              label="瓦片大小"
              value={config.tileSize / 2048}
              onChange={(v) => updateConfig('tileSize', Math.round(v * 2048))}
              testId="sr-tile-size"
            />
          </div>
        )}

        {/* 质量评估 */}
        {result && state === 'completed' && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              padding: '6px 0',
              fontSize: 11,
              color: 'var(--text-secondary, #999)',
            }}
          >
            <span>
              <Gauge size={12} style={{ verticalAlign: -2 }} /> PSNR: {result.psnr.toFixed(1)} dB
            </span>
            <span>SSIM: {result.ssim.toFixed(3)}</span>
            <span>质量: {(result.qualityScore * 100).toFixed(0)}%</span>
            <span>耗时: {result.processingTimeMs.toFixed(0)}ms</span>
            <span style={{ marginLeft: 'auto' }}>模型: {result.usedModel}</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleProcess}
            disabled={state === 'processing' || configErrors.length > 0}
            style={{
              flex: 1,
              padding: '6px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent-bg, #2563eb)',
              color: '#fff',
              cursor: state === 'processing' ? 'wait' : 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: state === 'processing' || configErrors.length > 0 ? 0.6 : 1,
            }}
            data-testid="sr-process-btn"
          >
            {state === 'processing' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                开始超分
              </>
            )}
          </button>
          {onApply && (
            <button
              onClick={handleApply}
              disabled={state !== 'completed'}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: '1px solid var(--border-color, #444)',
                background: 'transparent',
                color: state === 'completed' ? 'var(--text-primary, #ccc)' : 'var(--text-disabled, #666)',
                cursor: state === 'completed' ? 'pointer' : 'default',
                fontSize: 13,
              }}
              data-testid="sr-apply-btn"
            >
              应用
            </button>
          )}
        </div>

        {/* 配置错误 */}
        {configErrors.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--error-text, #f87171)' }}>
            {configErrors.map((err, i) => (
              <div key={i}>⚠ {err}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== 子组件 ====================

/** 滑块控制组件 */
function SliderControl({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  testId?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
      <span style={{ color: 'var(--text-secondary, #999)', minWidth: 36, fontSize: 11 }}>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ flex: 1, height: 16 }}
        data-testid={testId}
      />
      <span style={{ minWidth: 32, textAlign: 'right', fontSize: 11 }}>{Math.round(value * 100)}%</span>
    </div>
  );
}

export default SuperResolutionPreview;
