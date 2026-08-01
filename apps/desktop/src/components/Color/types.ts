/**
 * Color Grading Panel - Type Definitions
 */

import type {ColorCorrectionParams} from '@open-factory/editor-core/ai/color-grading';

// ==================== Types ====================

/**
 * Color wheel type
 */
export type ColorWheelType = 'lift' | 'gamma' | 'gain' | 'offset';

/**
 * Color wheel value
 */
export interface ColorWheelValue {
  r: number;
  g: number;
  b: number;
  y: number; // luminance
}

/**
 * Curve point
 */
export interface CurvePoint {
  x: number;
  y: number;
}

/**
 * Color curves
 */
export interface ColorCurves {
  master: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

/**
 * HSL qualifier parameters
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
 * LUT info
 */
export interface LUTInfo {
  id: string;
  name: string;
  type: '1d' | '3d';
  size: number;
  preview?: string;
}

/**
 * Color grading panel props
 */
export interface ColorGradingPanelProps {
  /** Current color correction params */
  correction: ColorCorrectionParams;
  /** Param change callback */
  onCorrectionChange: (correction: ColorCorrectionParams) => void;
  /** Whether to show advanced options */
  showAdvanced?: boolean;
  /** Whether to enable AI assist */
  enableAI?: boolean;
  /** AI suggest callback */
  onAISuggest?: () => void;
}

/**
 * Color wheel props
 */
export interface ColorWheelProps {
  /** Color wheel type */
  type: ColorWheelType;
  /** Current value */
  value: ColorWheelValue;
  /** Value change callback */
  onChange: (value: ColorWheelValue) => void;
  /** Size */
  size?: number;
  /** Label */
  label: string;
}

/**
 * Color slider props
 */
export interface ColorSliderProps {
  /** Label */
  label: string;
  /** Current value */
  value: number;
  /** Value change callback */
  onChange: (value: number) => void;
  /** Min value */
  min?: number;
  /** Max value */
  max?: number;
  /** Step */
  step?: number;
  /** Unit */
  unit?: string;
}

/**
 * Color curves props
 */
export interface ColorCurvesProps {
  /** Current curves */
  curves: ColorCurves;
  /** Curves change callback */
  onChange: (curves: ColorCurves) => void;
  /** Width */
  width?: number;
  /** Height */
  height?: number;
}

/**
 * HSL qualifier props
 */
export interface HSLQualifierProps {
  /** Current params */
  params: HSLQualifierParams;
  /** Param change callback */
  onChange: (params: HSLQualifierParams) => void;
}

/**
 * LUT manager props
 */
export interface LUTManagerProps {
  /** Available LUT list */
  luts: LUTInfo[];
  /** Currently selected LUT ID */
  selectedLUTId?: string;
  /** LUT select callback */
  onSelect: (lutId: string | undefined) => void;
  /** LUT intensity */
  intensity: number;
  /** Intensity change callback */
  onIntensityChange: (intensity: number) => void;
}
