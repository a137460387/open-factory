import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Pause, Play, Settings } from 'lucide-react';

interface SpectrumAnalyzerProps {
  /** 频率数据数组 (0-1 范围，长度通常为 128 或 256) */
  frequencyData?: number[];
  /** 采样率 */
  sampleRate?: number;
  /** 是否显示控制面板 */
  showControls?: boolean;
  /** 高度 (px) */
  height?: number;
  /** 自定义类名 */
  className?: string;
}

/** 频谱显示模式 */
type SpectrumMode = 'bars' | 'line' | 'filled';

/** 频谱颜色主题 */
interface SpectrumTheme {
  background: string;
  grid: string;
  bars: string[];
  peak: string;
  text: string;
}

const DEFAULT_THEME: SpectrumTheme = {
  background: '#0f172a',
  grid: '#1e293b',
  bars: ['#22c55e', '#22c55e', '#eab308', '#ef4444'],
  peak: '#f59e0b',
  text: '#94a3b8',
};

const FREQUENCY_LABELS = [
  { hz: 20, label: '20' },
  { hz: 50, label: '50' },
  { hz: 100, label: '100' },
  { hz: 200, label: '200' },
  { hz: 500, label: '500' },
  { hz: 1000, label: '1k' },
  { hz: 2000, label: '2k' },
  { hz: 5000, label: '5k' },
  { hz: 10000, label: '10k' },
  { hz: 20000, label: '20k' },
];

export function SpectrumAnalyzer({
  frequencyData = [],
  sampleRate = 48000,
  showControls = true,
  height = 200,
  className = '',
}: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [mode, setMode] = useState<SpectrumMode>('bars');
  const [isRunning, setIsRunning] = useState(true);
  const [peakHold, setPeakHold] = useState<number[]>([]);
  const [peakDecay, setPeakDecay] = useState<number[]>([]);

  const width = 640;
  const padding = { top: 20, right: 16, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 频率到 X 坐标的映射（对数刻度）
  const frequencyToX = useCallback(
    (hz: number): number => {
      const minHz = 20;
      const maxHz = sampleRate / 2;
      const logMin = Math.log10(minHz);
      const logMax = Math.log10(maxHz);
      const logHz = Math.log10(Math.max(minHz, Math.min(maxHz, hz)));
      return padding.left + ((logHz - logMin) / (logMax - logMin)) * chartWidth;
    },
    [sampleRate, chartWidth, padding.left],
  );

  // 振幅到 Y 坐标的映射
  const amplitudeToY = useCallback(
    (amplitude: number): number => {
      const db = 20 * Math.log10(Math.max(0.001, amplitude));
      const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
      return padding.top + (1 - normalized) * chartHeight;
    },
    [chartHeight, padding.top],
  );

  // 获取频率条颜色
  const getBarColor = useCallback(
    (amplitude: number, index: number, total: number): string => {
      const ratio = index / total;
      if (amplitude > 0.9) return DEFAULT_THEME.bars[3]; // 红色 - 削波
      if (amplitude > 0.7) return DEFAULT_THEME.bars[2]; // 黄色 - 高电平
      if (ratio < 0.3) return DEFAULT_THEME.bars[0]; // 绿色 - 低频
      return DEFAULT_THEME.bars[1]; // 绿色 - 中高频
    },
    [],
  );

  // 绘制频谱
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 清除背景
    ctx.fillStyle = DEFAULT_THEME.background;
    ctx.fillRect(0, 0, width, height);

    // 绘制网格线
    ctx.strokeStyle = DEFAULT_THEME.grid;
    ctx.lineWidth = 0.5;

    // 水平网格线 (dB 刻度)
    for (let db = -60; db <= 0; db += 10) {
      const y = amplitudeToY(Math.pow(10, db / 20));
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // dB 标签
      ctx.fillStyle = DEFAULT_THEME.text;
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${db}`, padding.left - 4, y + 3);
    }

    // 垂直网格线 (频率刻度)
    for (const { hz, label } of FREQUENCY_LABELS) {
      const x = frequencyToX(hz);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      // 频率标签
      ctx.fillStyle = DEFAULT_THEME.text;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, height - padding.bottom + 14);
    }

    // 绘制频谱数据
    if (frequencyData.length === 0) {
      // 无数据时显示提示
      ctx.fillStyle = DEFAULT_THEME.text;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('等待音频数据...', width / 2, height / 2);
      return;
    }

    const barCount = Math.min(frequencyData.length, 128);
    const barWidth = chartWidth / barCount;

    // 更新峰值保持
    const newPeakHold = [...peakHold];
    const newPeakDecay = [...peakDecay];

    for (let i = 0; i < barCount; i++) {
      const amplitude = frequencyData[i] ?? 0;

      // 更新峰值
      if (amplitude > (newPeakHold[i] ?? 0)) {
        newPeakHold[i] = amplitude;
        newPeakDecay[i] = 0;
      } else {
        // 峰值衰减
        newPeakDecay[i] = (newPeakDecay[i] ?? 0) + 0.02;
        newPeakHold[i] = Math.max(0, (newPeakHold[i] ?? 0) - newPeakDecay[i] * 0.5);
      }

      const x = padding.left + i * barWidth;
      const y = amplitudeToY(amplitude);

      if (mode === 'bars') {
        // 柱状图模式
        const barHeight = height - padding.bottom - y;
        const gradient = ctx.createLinearGradient(x, y, x, height - padding.bottom);
        gradient.addColorStop(0, getBarColor(amplitude, i, barCount));
        gradient.addColorStop(1, getBarColor(amplitude * 0.5, i, barCount));

        ctx.fillStyle = gradient;
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);

        // 峰值指示器
        const peakY = amplitudeToY(newPeakHold[i] ?? 0);
        ctx.fillStyle = DEFAULT_THEME.peak;
        ctx.fillRect(x + 1, peakY, barWidth - 2, 2);
      } else if (mode === 'line') {
        // 线条模式
        if (i === 0) {
          ctx.beginPath();
          ctx.moveTo(x + barWidth / 2, y);
        } else {
          ctx.lineTo(x + barWidth / 2, y);
        }
        if (i === barCount - 1) {
          ctx.strokeStyle = DEFAULT_THEME.bars[0];
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else {
        // 填充模式
        if (i === 0) {
          ctx.beginPath();
          ctx.moveTo(x + barWidth / 2, y);
        } else {
          ctx.lineTo(x + barWidth / 2, y);
        }
        if (i === barCount - 1) {
          ctx.lineTo(x + barWidth / 2, height - padding.bottom);
          ctx.lineTo(padding.left + barWidth / 2, height - padding.bottom);
          ctx.closePath();
          const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
          gradient.addColorStop(0, 'rgba(34, 197, 94, 0.4)');
          gradient.addColorStop(1, 'rgba(34, 197, 94, 0.05)');
          ctx.fillStyle = gradient;
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(padding.left + barWidth / 2, amplitudeToY(frequencyData[0] ?? 0));
          for (let j = 1; j < barCount; j++) {
            ctx.lineTo(padding.left + (j + 0.5) * barWidth, amplitudeToY(frequencyData[j] ?? 0));
          }
          ctx.strokeStyle = DEFAULT_THEME.bars[0];
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    setPeakHold(newPeakHold);
    setPeakDecay(newPeakDecay);
  }, [frequencyData, mode, peakHold, peakDecay, amplitudeToY, frequencyToX, chartWidth, chartHeight, height, width, padding, getBarColor]);

  // 动画循环
  useEffect(() => {
    if (!isRunning) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, draw]);

  return (
    <div className={`flex flex-col rounded-md border border-line bg-panel ${className}`} data-testid="spectrum-analyzer">
      {/* 控制栏 */}
      {showControls && (
        <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className="text-brand" />
            <span className="text-xs font-semibold text-slate-700">频谱分析</span>
          </div>
          <div className="flex items-center gap-1">
            {/* 显示模式切换 */}
            <div className="flex rounded border border-line bg-white p-0.5">
              {(['bars', 'line', 'filled'] as SpectrumMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    mode === m ? 'bg-brand text-white' : 'text-slate-500 hover:bg-panel'
                  }`}
                  data-testid={`spectrum-mode-${m}`}
                >
                  {m === 'bars' ? '柱状' : m === 'line' ? '线条' : '填充'}
                </button>
              ))}
            </div>

            {/* 播放/暂停 */}
            <button
              type="button"
              onClick={() => setIsRunning(!isRunning)}
              className="rounded border border-line bg-white p-1 text-slate-500 hover:bg-panel"
              data-testid="spectrum-toggle"
            >
              {isRunning ? <Pause size={12} /> : <Play size={12} />}
            </button>
          </div>
        </div>
      )}

      {/* 频谱画布 */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ width, height }}
          className="w-full"
          data-testid="spectrum-canvas"
        />
      </div>
    </div>
  );
}

/**
 * 从 AudioMeterStore 的频率带数据生成频谱显示数据
 * 将 16 个频率带扩展为 128 个频谱点
 */
export function expandFrequencyBands(bands: number[], targetLength: number = 128): number[] {
  if (bands.length === 0) {
    return Array.from({ length: targetLength }, () => 0);
  }

  if (bands.length >= targetLength) {
    return bands.slice(0, targetLength);
  }

  const result: number[] = [];
  const ratio = bands.length / targetLength;

  for (let i = 0; i < targetLength; i++) {
    const sourceIndex = i * ratio;
    const lower = Math.floor(sourceIndex);
    const upper = Math.min(bands.length - 1, Math.ceil(sourceIndex));
    const fraction = sourceIndex - lower;

    const lowerValue = bands[lower] ?? 0;
    const upperValue = bands[upper] ?? 0;

    // 线性插值
    result.push(lowerValue + (upperValue - lowerValue) * fraction);
  }

  return result;
}

/**
 * 将频率带数据归一化到 0-1 范围
 */
export function normalizeFrequencyBands(bands: number[]): number[] {
  const max = Math.max(0.001, ...bands);
  return bands.map((v) => Math.max(0, Math.min(1, v / max)));
}
