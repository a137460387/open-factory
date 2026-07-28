/**
 * GPU color processing type definitions and constants.
 */

import type { PrimaryWheelParams, PrimarySliderParams } from '../color-grading/types';
import type { ToneMappingMethod, ColorSpace } from './aces';

// ==================== Type Definitions ====================

/** GPU backend type */
export type GPUBackend = 'webgpu' | 'webgl2' | 'cpu-fallback';

/** Preview resolution */
export type PreviewResolution = '720p' | '1080p' | '1440p' | '4k';

/** Resolution config */
export interface ResolutionConfig {
  width: number;
  height: number;
  label: string;
}

/** GPU device info */
export interface GPUDeviceInfo {
  backend: GPUBackend;
  vendor: string;
  renderer: string;
  maxTextureSize: number;
  maxComputeWorkgroupSize: [number, number, number];
  supportsWebGPU: boolean;
  supportsWebGL2: boolean;
  vramEstimateMB: number;
}

/** Performance stats */
export interface GPUPerformanceStats {
  frameTimeMs: number;
  gpuTimeMs: number;
  uploadTimeMs: number;
  downloadTimeMs: number;
  textureMemoryMB: number;
  bufferMemoryMB: number;
  framesRendered: number;
  cacheHits: number;
  cacheMisses: number;
}

/** 3D LUT GPU data */
export interface GPU3DLUTData {
  size: number;
  data: Float32Array;
  textureId: string;
  format: 'rgb' | 'rgba';
}

/** Color correction params */
export interface GPUColorCorrectionParams {
  lift: { r: number; g: number; b: number };
  liftMaster: number;
  gamma: { r: number; g: number; b: number };
  gammaMaster: number;
  gain: { r: number; g: number; b: number };
  gainMaster: number;
  offset: { r: number; g: number; b: number };
  offsetMaster: number;
  temperature: number;
  tint: number;
  contrast: number;
  pivot: number;
  saturation: number;
  hueRotation: number;
}

/** Tone mapping params */
export interface GPUToneMappingParams {
  method: ToneMappingMethod;
  exposure: number;
  whitePoint: number;
  shoulderStrength: number;
  linearStrength: number;
  linearAngle: number;
  toeStrength: number;
  toeNumerator: number;
  toeDenominator: number;
  linearWhitePoint: number;
}

/** GPU pipeline config */
export interface GPUPipelineConfig {
  backend: GPUBackend;
  resolution: PreviewResolution;
  enableLUT: boolean;
  enableColorCorrection: boolean;
  enableToneMapping: boolean;
  enableCache: boolean;
  maxCacheSize: number;
  maxCacheBytes: number;
  inputColorSpace: ColorSpace;
  outputColorSpace: ColorSpace;
  hdrEnabled: boolean;
  hdrPeakLuminance: number;
}

/** GPU cache entry */
export interface GPUCacheEntry {
  key: string;
  textureData: Uint8ClampedArray;
  width: number;
  height: number;
  bytes: number;
  timestamp: number;
  accessCount: number;
}

/** GPU process result */
export interface GPUProcessResult {
  outputData: Uint8ClampedArray;
  width: number;
  height: number;
  processingTimeMs: number;
  fromCache: boolean;
  backend: GPUBackend;
}

/** Pipeline callback */
export type GPUStatusCallback = (status: GPUDeviceStatus) => void;

/** Device status */
export interface GPUDeviceStatus {
  available: boolean;
  backend: GPUBackend;
  message: string;
}

// ==================== Constants ====================

export const RESOLUTION_PRESETS: Record<PreviewResolution, ResolutionConfig> = {
  '720p': { width: 1280, height: 720, label: '720p' },
  '1080p': { width: 1920, height: 1080, label: '1080p' },
  '1440p': { width: 2560, height: 1440, label: '1440p' },
  '4k': { width: 3840, height: 2160, label: '4K' },
};

export const DEFAULT_PIPELINE_CONFIG: GPUPipelineConfig = {
  backend: 'webgl2',
  resolution: '1080p',
  enableLUT: true,
  enableColorCorrection: true,
  enableToneMapping: true,
  enableCache: true,
  maxCacheSize: 64,
  maxCacheBytes: 512 * 1024 * 1024, // 512MB
  inputColorSpace: 'srgb',
  outputColorSpace: 'srgb',
  hdrEnabled: false,
  hdrPeakLuminance: 1000,
};

export const CACHE_TTL_MS = 30_000;
export const MAX_PERFORMANCE_SAMPLES = 120;

// Re-export external types for sibling modules
export type { PrimaryWheelParams, PrimarySliderParams } from '../color-grading/types';
export type { ToneMappingMethod, ColorSpace } from './aces';
