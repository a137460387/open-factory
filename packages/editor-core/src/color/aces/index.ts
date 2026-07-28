/**
 * ACES色彩管理模块
 *
 * 功能：
 * 1. ACES工作流基础 - 实现ACES色彩空间转换
 * 2. OCIO色彩管理框架集成 - 支持OpenColorIO配置
 * 3. HDR调色支持 - 支持HDR色彩空间和调色
 * 4. LUT管理 - 管理和应用LUT
 */

// Type definitions
export type {
  ColorSpace,
  ACESStage,
  ColorManagementConfig,
  ToneMappingMethod,
  ColorMatrix3x3,
  ColorMatrix4x4,
  RGBColor,
  XYZColor,
  LABColor,
  ColorSpaceConversion,
  LUTData,
  LUTLibrary,
  HDRMetadata,
  TransferFunction,
  ColorGamut,
  OCIOConfig,
  OCIOColorSpace,
  OCIOView,
  OCIODisplay,
} from './types';

// Math utilities
export {
  clamp,
  lerp,
  multiplyMatrix3x3,
  multiplyMatrix4x4,
  multiplyMatrices3x3,
  invertMatrix3x3,
} from './math-utils';

// Transfer functions
export { TRANSFER_FUNCTIONS } from './transfer-functions';

// Tone mapping
export { TONE_MAPPING_FUNCTIONS } from './tone-mapping';

// Color space conversions
export { COLOR_SPACE_CONVERSIONS } from './color-space-conversions';

// LUT manager
export { LUTManager } from './lut-manager';

// ACES color manager and constants
export {
  DEFAULT_COLOR_MANAGEMENT_CONFIG,
  ACES_MATRICES,
  ACESColorManager,
  createDefaultColorManagementConfig,
  validateColorManagementConfig,
  parseCubeFile,
} from './aces-color-manager';
