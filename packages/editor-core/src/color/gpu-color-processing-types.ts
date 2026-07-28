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

// ==================== Internal Utilities ====================

function clampValue(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ==================== Default Factory Functions ====================

/** Create default color correction params */
export function createDefaultColorCorrectionParams(): GPUColorCorrectionParams {
  return {
    lift: { r: 0, g: 0, b: 0 },
    liftMaster: 0,
    gamma: { r: 0, g: 0, b: 0 },
    gammaMaster: 0,
    gain: { r: 0, g: 0, b: 0 },
    gainMaster: 0,
    offset: { r: 0, g: 0, b: 0 },
    offsetMaster: 0,
    temperature: 0,
    tint: 0,
    contrast: 0,
    pivot: 0.5,
    saturation: 100,
    hueRotation: 0,
  };
}

/** Create default tone mapping params */
export function createDefaultToneMappingParams(): GPUToneMappingParams {
  return {
    method: 'aces-hill',
    exposure: 0,
    whitePoint: 1.0,
    shoulderStrength: 0.22,
    linearStrength: 0.3,
    linearAngle: 0.1,
    toeStrength: 0.2,
    toeNumerator: 0.01,
    toeDenominator: 0.3,
    linearWhitePoint: 1.0,
  };
}

/** Create default pipeline config */
export function createDefaultPipelineConfig(): GPUPipelineConfig {
  return { ...DEFAULT_PIPELINE_CONFIG };
}

// ==================== Validation Functions ====================

/** Validate color correction params */
export function validateGPUColorCorrectionParams(params: GPUColorCorrectionParams): GPUColorCorrectionParams {
  const clamp = (v: number, min: number, max: number) => clampValue(v, min, max);
  const clampCh = (ch: { r: number; g: number; b: number }) => ({
    r: clamp(ch.r, -1, 1),
    g: clamp(ch.g, -1, 1),
    b: clamp(ch.b, -1, 1),
  });

  return {
    lift: clampCh(params.lift),
    liftMaster: clamp(params.liftMaster, -1, 1),
    gamma: clampCh(params.gamma),
    gammaMaster: clamp(params.gammaMaster, -1, 1),
    gain: clampCh(params.gain),
    gainMaster: clamp(params.gainMaster, -1, 1),
    offset: clampCh(params.offset),
    offsetMaster: clamp(params.offsetMaster, -1, 1),
    temperature: clamp(params.temperature, -100, 100),
    tint: clamp(params.tint, -100, 100),
    contrast: clamp(params.contrast, -100, 100),
    pivot: clamp(params.pivot, 0, 1),
    saturation: clamp(params.saturation, 0, 200),
    hueRotation: clamp(params.hueRotation, -180, 180),
  };
}

/** Validate tone mapping params */
export function validateGPUToneMappingParams(params: GPUToneMappingParams): GPUToneMappingParams {
  return {
    method: params.method,
    exposure: clampValue(params.exposure, -10, 10),
    whitePoint: clampValue(params.whitePoint, 0.01, 100),
    shoulderStrength: clampValue(params.shoulderStrength, 0, 1),
    linearStrength: clampValue(params.linearStrength, 0, 1),
    linearAngle: clampValue(params.linearAngle, 0, 1),
    toeStrength: clampValue(params.toeStrength, 0, 1),
    toeNumerator: clampValue(params.toeNumerator, 0, 1),
    toeDenominator: clampValue(params.toeDenominator, 0.01, 1),
    linearWhitePoint: clampValue(params.linearWhitePoint, 0.01, 100),
  };
}

/** Validate pipeline config */
export function validateGPUPipelineConfig(config: GPUPipelineConfig): GPUPipelineConfig {
  return {
    backend: config.backend,
    resolution: ['720p', '1080p', '1440p', '4k'].includes(config.resolution) ? config.resolution : '1080p',
    enableLUT: !!config.enableLUT,
    enableColorCorrection: !!config.enableColorCorrection,
    enableToneMapping: !!config.enableToneMapping,
    enableCache: !!config.enableCache,
    maxCacheSize: clampValue(config.maxCacheSize, 1, 256),
    maxCacheBytes: Math.max(1024 * 1024, config.maxCacheBytes ?? 512 * 1024 * 1024),
    inputColorSpace: config.inputColorSpace,
    outputColorSpace: config.outputColorSpace,
    hdrEnabled: !!config.hdrEnabled,
    hdrPeakLuminance: clampValue(config.hdrPeakLuminance, 100, 10000),
  };
}

// ==================== Conversion from existing types ====================

/** Convert from PrimaryWheelParams + PrimarySliderParams to GPUColorCorrectionParams */
export function fromPrimaryWheelAndSliders(
  wheels: PrimaryWheelParams,
  sliders: PrimarySliderParams,
): GPUColorCorrectionParams {
  return {
    lift: { r: wheels.lift.r, g: wheels.lift.g, b: wheels.lift.b },
    liftMaster: wheels.liftMaster,
    gamma: { r: wheels.gamma.r, g: wheels.gamma.g, b: wheels.gamma.b },
    gammaMaster: wheels.gammaMaster,
    gain: { r: wheels.gain.r, g: wheels.gain.g, b: wheels.gain.b },
    gainMaster: wheels.gainMaster,
    offset: { r: wheels.offset.r, g: wheels.offset.g, b: wheels.offset.b },
    offsetMaster: wheels.offsetMaster,
    temperature: sliders.temperature,
    tint: sliders.tint,
    contrast: sliders.contrast,
    pivot: sliders.pivot,
    saturation: sliders.saturation,
    hueRotation: sliders.hue,
  };
}
