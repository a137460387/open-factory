/**
 * 色彩分级面板组件
 *
 * 功能：
 * 1. 色轮调整 - Lift/Gamma/Gain/Offset
 * 2. 滑块调整 - 亮度/对比度/饱和度/色温/色调
 * 3. 色彩曲线 - 主曲线/红/绿/蓝曲线
 * 4. HSL限定器 - 基于色相/饱和度/亮度的选择性调色
 * 5. LUT管理 - 加载/应用/管理LUT
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { RGBColor } from '@open-factory/editor-core/color/aces';
import type { ColorCorrectionParams } from '@open-factory/editor-core/ai/color-grading';
import { clamp } from '@open-factory/editor-core/utils/math';

// ==================== 类型定义 ====================

/**
 * 色轮类型
 */
export type ColorWheelType = 'lift' | 'gamma' | 'gain' | 'offset';

/**
 * 色轮值
 */
export interface ColorWheelValue {
  r: number;
  g: number;
  b: number;
  y: number; // 亮度
}

/**
 * 曲线点
 */
export interface CurvePoint {
  x: number;
  y: number;
}

/**
 * 色彩曲线
 */
export interface ColorCurves {
  master: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

/**
 * HSL限定器参数
 */
export interface HSLQualifierParams {
  hueCenter: number;
  hueWidth: number;
  hueSoftness: number;
  satMin: number;
  satMax: number;
  satSoftness: number;
  lumMin: number;
  lumMax: number;
  lumSoftness: number;
  hueShift: number;
  saturation: number;
  brightness: number;
}

/**
 * LUT信息
 */
export interface LUTInfo {
  id: string;
  name: string;
  type: '1d' | '3d';
  size: number;
  preview?: string;
}

/**
 * 色彩分级面板属性
 */
export interface ColorGradingPanelProps {
  /** 当前色彩校正参数 */
  correction: ColorCorrectionParams;
  /** 参数变化回调 */
  onCorrectionChange: (correction: ColorCorrectionParams) => void;
  /** 是否显示高级选项 */
  showAdvanced?: boolean;
  /** 是否启用AI辅助 */
  enableAI?: boolean;
  /** AI建议回调 */
  onAISuggest?: () => void;
}

/**
 * 色轮属性
 */
export interface ColorWheelProps {
  /** 色轮类型 */
  type: ColorWheelType;
  /** 当前值 */
  value: ColorWheelValue;
  /** 值变化回调 */
  onChange: (value: ColorWheelValue) => void;
  /** 尺寸 */
  size?: number;
  /** 标签 */
  label: string;
}

/**
 * 色彩滑块属性
 */
export interface ColorSliderProps {
  /** 标签 */
  label: string;
  /** 当前值 */
  value: number;
  /** 值变化回调 */
  onChange: (value: number) => void;
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 步长 */
  step?: number;
  /** 单位 */
  unit?: string;
}

/**
 * 色彩曲线属性
 */
export interface ColorCurvesProps {
  /** 当前曲线 */
  curves: ColorCurves;
  /** 曲线变化回调 */
  onChange: (curves: ColorCurves) => void;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
}

/**
 * HSL限定器属性
 */
export interface HSLQualifierProps {
  /** 当前参数 */
  params: HSLQualifierParams;
  /** 参数变化回调 */
  onChange: (params: HSLQualifierParams) => void;
}

/**
 * LUT管理器属性
 */
export interface LUTManagerProps {
  /** 可用LUT列表 */
  luts: LUTInfo[];
  /** 当前选中的LUT ID */
  selectedLUTId?: string;
  /** LUT选择回调 */
  onSelect: (lutId: string | undefined) => void;
  /** LUT强度 */
  intensity: number;
  /** 强度变化回调 */
  onIntensityChange: (intensity: number) => void;
}

// ==================== 辅助函数 ====================

/**
 * RGB到CSS颜色
 */
function rgbToCSS(rgb: RGBColor): string {
  return `rgb(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)})`;
}

/**
 * HSL到CSS颜色
 */
function hslToCSS(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s * 100}%, ${l * 100}%)`;
}

// ==================== 色轮组件 ====================

/**
 * 色轮组件
 */
export const ColorWheel: React.FC<ColorWheelProps> = ({ type, value, onChange, size = 150, label }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [center, setCenter] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCenter({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;

      const radius = size / 2;
      const dx = (e.clientX - center.x) / radius;
      const dy = (e.clientY - center.y) / radius;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 1;

      if (distance > maxDistance) {
        const scale = maxDistance / distance;
        onChange({
          ...value,
          r: clamp(dx * scale, -1, 1),
          g: clamp(dy * scale, -1, 1),
        });
      } else {
        onChange({
          ...value,
          r: clamp(dx, -1, 1),
          g: clamp(dy, -1, 1),
        });
      }
    },
    [isDragging, center, size, value, onChange],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 计算指示器位置
  const indicatorX = ((value.r + 1) / 2) * size;
  const indicatorY = ((value.g + 1) / 2) * size;

  // 根据类型选择颜色
  const wheelGradient = useMemo(() => {
    switch (type) {
      case 'lift':
        return 'radial-gradient(circle, #000 0%, #333 50%, #666 100%)';
      case 'gamma':
        return 'radial-gradient(circle, #666 0%, #999 50%, #ccc 100%)';
      case 'gain':
        return 'radial-gradient(circle, #ccc 0%, #fff 50%, #fff 100%)';
      case 'offset':
        return 'radial-gradient(circle, #000 0%, #888 50%, #fff 100%)';
      default:
        return 'radial-gradient(circle, #000 0%, #fff 100%)';
    }
  }, [type]);

  return (
    <div className="color-wheel-container">
      <label className="color-wheel-label">{label}</label>
      <div
        className="color-wheel"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: wheelGradient,
          position: 'relative',
          cursor: 'crosshair',
          border: '2px solid #333',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 十字准线 */}
        <div
          style={{
            position: 'absolute',
            left: size / 2 - 1,
            top: 0,
            width: 2,
            height: size,
            background: 'rgba(255,255,255,0.2)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: size / 2 - 1,
            width: size,
            height: 2,
            background: 'rgba(255,255,255,0.2)',
          }}
        />

        {/* 指示器 */}
        <div
          style={{
            position: 'absolute',
            left: indicatorX - 6,
            top: indicatorY - 6,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#fff',
            border: '2px solid #000',
            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* 数值显示 */}
      <div className="color-wheel-values" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <span>R: {value.r.toFixed(2)}</span>
        <span>G: {value.g.toFixed(2)}</span>
        <span>B: {value.b.toFixed(2)}</span>
      </div>
    </div>
  );
};

// ==================== 色彩滑块组件 ====================

/**
 * 色彩滑块组件
 */
export const ColorSlider: React.FC<ColorSliderProps> = ({
  label,
  value,
  onChange,
  min = -1,
  max = 1,
  step = 0.01,
  unit = '',
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange],
  );

  const handleReset = useCallback(() => {
    onChange(0);
  }, [onChange]);

  // 计算滑块位置百分比
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="color-slider" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <label>{label}</label>
        <span style={{ fontSize: 12, color: '#888' }}>
          {value.toFixed(2)}
          {unit}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="range" min={min} max={max} step={step} value={value} onChange={handleChange} style={{ flex: 1 }} />
        <button
          onClick={handleReset}
          style={{
            padding: '2px 8px',
            fontSize: 12,
            background: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          重置
        </button>
      </div>
    </div>
  );
};

// ==================== 色彩曲线组件 ====================

/**
 * 色彩曲线组件
 */
export const ColorCurvesComponent: React.FC<ColorCurvesProps> = ({ curves, onChange, width = 300, height = 200 }) => {
  const [activeChannel, setActiveChannel] = useState<'master' | 'red' | 'green' | 'blue'>('master');
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);

  const handleMouseDown = useCallback((index: number) => {
    setDraggingPointIndex(index);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (draggingPointIndex === null) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / width, 0, 1);
      const y = clamp(1 - (e.clientY - rect.top) / height, 0, 1);

      const newCurves = { ...curves };
      const channel = newCurves[activeChannel];
      channel[draggingPointIndex] = { x, y };

      // 按x排序
      channel.sort((a, b) => a.x - b.x);

      onChange(newCurves);
    },
    [draggingPointIndex, activeChannel, curves, onChange, width, height],
  );

  const handleMouseUp = useCallback(() => {
    setDraggingPointIndex(null);
  }, []);

  const handleAddPoint = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (draggingPointIndex !== null) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / width, 0, 1);
      const y = clamp(1 - (e.clientY - rect.top) / height, 0, 1);

      const newCurves = { ...curves };
      const channel = [...newCurves[activeChannel]];
      channel.push({ x, y });
      channel.sort((a, b) => a.x - b.x);

      newCurves[activeChannel] = channel;
      onChange(newCurves);
    },
    [draggingPointIndex, activeChannel, curves, onChange, width, height],
  );

  // 生成曲线路径
  const generateCurvePath = (points: CurvePoint[]): string => {
    if (points.length < 2) return '';

    const sorted = [...points].sort((a, b) => a.x - b.x);
    let path = `M ${sorted[0].x * width} ${(1 - sorted[0].y) * height}`;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const cp1x = prev.x + (curr.x - prev.x) / 3;
      const cp1y = prev.y;
      const cp2x = curr.x - (curr.x - prev.x) / 3;
      const cp2y = curr.y;

      path += ` C ${cp1x * width} ${(1 - cp1y) * height}, ${cp2x * width} ${(1 - cp2y) * height}, ${curr.x * width} ${(1 - curr.y) * height}`;
    }

    return path;
  };

  // 通道颜色
  const channelColors = {
    master: '#fff',
    red: '#ff4444',
    green: '#44ff44',
    blue: '#4444ff',
  };

  return (
    <div className="color-curves">
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {(['master', 'red', 'green', 'blue'] as const).map((channel) => (
          <button
            key={channel}
            onClick={() => setActiveChannel(channel)}
            style={{
              padding: '4px 12px',
              background: activeChannel === channel ? channelColors[channel] : '#333',
              color: activeChannel === channel ? '#000' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {channel === 'master' ? '主' : channel === 'red' ? '红' : channel === 'green' ? '绿' : '蓝'}
          </button>
        ))}
      </div>

      <svg
        width={width}
        height={height}
        style={{ background: '#1a1a1a', borderRadius: 8, cursor: 'crosshair' }}
        onMouseDown={handleAddPoint}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 网格 */}
        <defs>
          <pattern id="grid" width={width / 4} height={height / 4} patternUnits="userSpaceOnUse">
            <path
              d={`M ${width / 4} 0 L 0 0 0 ${height / 4}`}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* 对角线 */}
        <line x1="0" y1={height} x2={width} y2="0" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

        {/* 曲线 */}
        <path
          d={generateCurvePath(curves[activeChannel])}
          fill="none"
          stroke={channelColors[activeChannel]}
          strokeWidth="2"
        />

        {/* 控制点 */}
        {curves[activeChannel].map((point, index) => (
          <circle
            key={index}
            cx={point.x * width}
            cy={(1 - point.y) * height}
            r="6"
            fill={channelColors[activeChannel]}
            stroke="#000"
            strokeWidth="2"
            onMouseDown={(e) => {
              e.stopPropagation();
              handleMouseDown(index);
            }}
            style={{ cursor: 'grab' }}
          />
        ))}
      </svg>
    </div>
  );
};

// ==================== HSL限定器组件 ====================

/**
 * HSL限定器组件
 */
export const HSLQualifier: React.FC<HSLQualifierProps> = ({ params, onChange }) => {
  const handleChange = useCallback(
    (key: keyof HSLQualifierParams, value: number) => {
      onChange({ ...params, [key]: value });
    },
    [params, onChange],
  );

  return (
    <div className="hsl-qualifier">
      <h4>色相限定</h4>
      <ColorSlider
        label="色相中心"
        value={params.hueCenter}
        onChange={(v) => handleChange('hueCenter', v)}
        min={0}
        max={360}
        unit="°"
      />
      <ColorSlider
        label="色相宽度"
        value={params.hueWidth}
        onChange={(v) => handleChange('hueWidth', v)}
        min={0}
        max={180}
        unit="°"
      />
      <ColorSlider
        label="色相柔和度"
        value={params.hueSoftness}
        onChange={(v) => handleChange('hueSoftness', v)}
        min={0}
        max={1}
      />

      <h4>饱和度限定</h4>
      <ColorSlider
        label="最小饱和度"
        value={params.satMin}
        onChange={(v) => handleChange('satMin', v)}
        min={0}
        max={1}
      />
      <ColorSlider
        label="最大饱和度"
        value={params.satMax}
        onChange={(v) => handleChange('satMax', v)}
        min={0}
        max={1}
      />

      <h4>亮度限定</h4>
      <ColorSlider label="最小亮度" value={params.lumMin} onChange={(v) => handleChange('lumMin', v)} min={0} max={1} />
      <ColorSlider label="最大亮度" value={params.lumMax} onChange={(v) => handleChange('lumMax', v)} min={0} max={1} />

      <h4>调整</h4>
      <ColorSlider
        label="色相偏移"
        value={params.hueShift}
        onChange={(v) => handleChange('hueShift', v)}
        min={-180}
        max={180}
        unit="°"
      />
      <ColorSlider label="饱和度" value={params.saturation} onChange={(v) => handleChange('saturation', v)} />
      <ColorSlider label="亮度" value={params.brightness} onChange={(v) => handleChange('brightness', v)} />
    </div>
  );
};

// ==================== LUT管理器组件 ====================

/**
 * LUT管理器组件
 */
export const LUTManagerComponent: React.FC<LUTManagerProps> = ({
  luts,
  selectedLUTId,
  onSelect,
  intensity,
  onIntensityChange,
}) => {
  return (
    <div className="lut-manager">
      <h4>LUT管理</h4>

      <div style={{ marginBottom: 12 }}>
        <label>选择LUT</label>
        <select
          value={selectedLUTId || ''}
          onChange={(e) => onSelect(e.target.value || undefined)}
          style={{
            width: '100%',
            padding: 8,
            background: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: 4,
          }}
        >
          <option value="">无</option>
          {luts.map((lut) => (
            <option key={lut.id} value={lut.id}>
              {lut.name} ({lut.type === '3d' ? '3D' : '1D'}, {lut.size}x{lut.size}x{lut.size})
            </option>
          ))}
        </select>
      </div>

      {selectedLUTId && <ColorSlider label="LUT强度" value={intensity} onChange={onIntensityChange} min={0} max={1} />}

      {/* LUT预览 */}
      {selectedLUTId && (
        <div style={{ marginTop: 12 }}>
          <label>LUT预览</label>
          <div
            style={{
              width: '100%',
              height: 50,
              background: 'linear-gradient(to right, #000, #fff)',
              borderRadius: 4,
              marginTop: 4,
            }}
          />
        </div>
      )}
    </div>
  );
};

// ==================== 色彩分级面板组件 ====================

/**
 * 色彩分级面板组件
 */
export const ColorGradingPanel: React.FC<ColorGradingPanelProps> = ({
  correction,
  onCorrectionChange,
  showAdvanced = false,
  enableAI = false,
  onAISuggest,
}) => {
  const [activeTab, setActiveTab] = useState<'wheels' | 'sliders' | 'curves' | 'hsl' | 'lut'>('wheels');

  // 色轮值
  const [liftValue, setLiftValue] = useState<ColorWheelValue>({
    r: correction.lift.r,
    g: correction.lift.g,
    b: correction.lift.b,
    y: 0,
  });

  const [gammaValue, setGammaValue] = useState<ColorWheelValue>({
    r: correction.gammaRGB.r,
    g: correction.gammaRGB.g,
    b: correction.gammaRGB.b,
    y: 0,
  });

  const [gainValue, setGainValue] = useState<ColorWheelValue>({
    r: correction.gain.r,
    g: correction.gain.g,
    b: correction.gain.b,
    y: 0,
  });

  const [offsetValue, setOffsetValue] = useState<ColorWheelValue>({
    r: 0,
    g: 0,
    b: 0,
    y: 0,
  });

  // 曲线值
  const [curves, setCurves] = useState<ColorCurves>({
    master: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    red: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    green: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    blue: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  });

  // HSL限定器参数
  const [hslParams, setHslParams] = useState<HSLQualifierParams>({
    hueCenter: 0,
    hueWidth: 30,
    hueSoftness: 0.5,
    satMin: 0,
    satMax: 1,
    satSoftness: 0.5,
    lumMin: 0,
    lumMax: 1,
    lumSoftness: 0.5,
    hueShift: 0,
    saturation: 0,
    brightness: 0,
  });

  // LUT状态
  const [selectedLUTId, setSelectedLUTId] = useState<string | undefined>();
  const [lutIntensity, setLutIntensity] = useState(1);

  // 处理色轮变化
  const handleLiftChange = useCallback(
    (value: ColorWheelValue) => {
      setLiftValue(value);
      onCorrectionChange({
        ...correction,
        lift: { r: value.r, g: value.g, b: value.b },
      });
    },
    [correction, onCorrectionChange],
  );

  const handleGammaChange = useCallback(
    (value: ColorWheelValue) => {
      setGammaValue(value);
      onCorrectionChange({
        ...correction,
        gammaRGB: { r: value.r, g: value.g, b: value.b },
      });
    },
    [correction, onCorrectionChange],
  );

  const handleGainChange = useCallback(
    (value: ColorWheelValue) => {
      setGainValue(value);
      onCorrectionChange({
        ...correction,
        gain: { r: value.r, g: value.g, b: value.b },
      });
    },
    [correction, onCorrectionChange],
  );

  // 处理滑块变化
  const handleSliderChange = useCallback(
    (key: keyof ColorCorrectionParams, value: number) => {
      onCorrectionChange({
        ...correction,
        [key]: value,
      });
    },
    [correction, onCorrectionChange],
  );

  return (
    <div className="color-grading-panel" style={{ width: 350, background: '#1a1a1a', borderRadius: 8, padding: 16 }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#fff' }}>色彩分级</h3>
        {enableAI && (
          <button
            onClick={onAISuggest}
            style={{
              padding: '4px 12px',
              background: '#4a9eff',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            AI建议
          </button>
        )}
      </div>

      {/* 标签页 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['wheels', 'sliders', 'curves', 'hsl', 'lut'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 12px',
              background: activeTab === tab ? '#4a9eff' : '#333',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              flex: 1,
            }}
          >
            {tab === 'wheels'
              ? '色轮'
              : tab === 'sliders'
                ? '滑块'
                : tab === 'curves'
                  ? '曲线'
                  : tab === 'hsl'
                    ? 'HSL'
                    : 'LUT'}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div style={{ maxHeight: 500, overflowY: 'auto' }}>
        {activeTab === 'wheels' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ColorWheel type="lift" value={liftValue} onChange={handleLiftChange} label="Lift (阴影)" size={120} />
              <ColorWheel
                type="gamma"
                value={gammaValue}
                onChange={handleGammaChange}
                label="Gamma (中间调)"
                size={120}
              />
              <ColorWheel type="gain" value={gainValue} onChange={handleGainChange} label="Gain (高光)" size={120} />
              <ColorWheel type="offset" value={offsetValue} onChange={() => {}} label="Offset (偏移)" size={120} />
            </div>
          </div>
        )}

        {activeTab === 'sliders' && (
          <div>
            <ColorSlider
              label="亮度"
              value={correction.brightness}
              onChange={(v) => handleSliderChange('brightness', v)}
            />
            <ColorSlider
              label="对比度"
              value={correction.contrast}
              onChange={(v) => handleSliderChange('contrast', v)}
            />
            <ColorSlider
              label="饱和度"
              value={correction.saturation}
              onChange={(v) => handleSliderChange('saturation', v)}
            />
            <ColorSlider
              label="色温"
              value={correction.temperature}
              onChange={(v) => handleSliderChange('temperature', v)}
            />
            <ColorSlider label="色调" value={correction.tint} onChange={(v) => handleSliderChange('tint', v)} />
            <ColorSlider
              label="伽马"
              value={correction.gamma}
              onChange={(v) => handleSliderChange('gamma', v)}
              min={0.1}
              max={3}
            />
            <ColorSlider
              label="色相旋转"
              value={correction.hueRotation}
              onChange={(v) => handleSliderChange('hueRotation', v)}
              min={-180}
              max={180}
              unit="°"
            />
          </div>
        )}

        {activeTab === 'curves' && (
          <ColorCurvesComponent curves={curves} onChange={setCurves} width={300} height={200} />
        )}

        {activeTab === 'hsl' && <HSLQualifier params={hslParams} onChange={setHslParams} />}

        {activeTab === 'lut' && (
          <LUTManagerComponent
            luts={[]}
            selectedLUTId={selectedLUTId}
            onSelect={setSelectedLUTId}
            intensity={lutIntensity}
            onIntensityChange={setLutIntensity}
          />
        )}
      </div>

      {/* 高级选项 */}
      {showAdvanced && (
        <div style={{ marginTop: 16, padding: 12, background: '#222', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#fff' }}>高级选项</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() =>
                onCorrectionChange({
                  ...correction,
                  brightness: 0,
                  contrast: 0,
                  saturation: 0,
                  temperature: 0,
                  tint: 0,
                  hueRotation: 0,
                  gamma: 1,
                  lift: { r: 0, g: 0, b: 0 },
                  gammaRGB: { r: 0, g: 0, b: 0 },
                  gain: { r: 0, g: 0, b: 0 },
                })
              }
              style={{
                padding: '6px 12px',
                background: '#ff4444',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              重置全部
            </button>
            <button
              onClick={() => {
                // 复制当前参数
                navigator.clipboard.writeText(JSON.stringify(correction, null, 2));
              }}
              style={{
                padding: '6px 12px',
                background: '#44ff44',
                color: '#000',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              复制参数
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorGradingPanel;
