/**
 * Color Grading Panel Component
 *
 * Features:
 * 1. Color wheels - Lift/Gamma/Gain/Offset
 * 2. Sliders - Brightness/Contrast/Saturation/Temperature/Tint
 * 3. Color curves - Master/Red/Green/Blue curves
 * 4. HSL qualifier - Selective grading based on Hue/Saturation/Luminance
 * 5. LUT management - Load/Apply/Manage LUTs
 */

import React, {useState, useCallback} from 'react';
import type {ColorCorrectionParams} from '@open-factory/editor-core/ai/color-grading';

// Re-export all types and sub-components for public API compatibility
export type {
  ColorWheelType,
  ColorWheelValue,
  CurvePoint,
  ColorCurves,
  HSLQualifierParams,
  LUTInfo,
  ColorGradingPanelProps,
  ColorWheelProps,
  ColorSliderProps,
  ColorCurvesProps,
  HSLQualifierProps,
  LUTManagerProps,
} from './types';

export {ColorWheel} from './ColorWheel';
export {ColorSlider} from './ColorSlider';
export {ColorCurvesComponent} from './ColorCurvesComponent';
export {HSLQualifier} from './HSLQualifier';
export {LUTManagerComponent} from './LUTManagerComponent';

import type {ColorGradingPanelProps, ColorWheelValue, ColorCurves, HSLQualifierParams} from './types';
import {ColorWheel} from './ColorWheel';
import {ColorSlider} from './ColorSlider';
import {ColorCurvesComponent} from './ColorCurvesComponent';
import {HSLQualifier} from './HSLQualifier';
import {LUTManagerComponent} from './LUTManagerComponent';

/**
 * Color Grading Panel Component
 */
export const ColorGradingPanel: React.FC<ColorGradingPanelProps> = ({
  correction,
  onCorrectionChange,
  showAdvanced = false,
  enableAI = false,
  onAISuggest,
}) => {
  const [activeTab, setActiveTab] = useState<'wheels' | 'sliders' | 'curves' | 'hsl' | 'lut'>('wheels');

  // Wheel values
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

  // Curve values
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

  // HSL qualifier params
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

  // LUT state
  const [selectedLUTId, setSelectedLUTId] = useState<string | undefined>();
  const [lutIntensity, setLutIntensity] = useState(1);

  // Handle wheel changes
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

  // Handle slider changes
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
      {/* Title bar */}
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

      {/* Tabs */}
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

      {/* Content area */}
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

      {/* Advanced options */}
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
                // Copy current params
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
