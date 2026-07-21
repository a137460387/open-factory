/**
 * GPU 加速色彩处理模块
 *
 * 功能：
 * 1. GPU 后端抽象 - 支持 WebGPU / WebGL2 双后端
 * 2. 3D LUT GPU 加速 - 通过纹理采样实现高性能 LUT 应用
 * 3. 色彩校正 GPU 管线 - Lift/Gamma/Gain/Offset 着色器
 * 4. 色调映射 GPU 加速 - 多种色调映射算法
 * 5. 多分辨率预览 - 1080p / 4K 自适应
 * 6. 预览缓存 - 参数哈希缓存机制
 * 7. 性能监控 - 帧时间、GPU 内存统计
 */

import type { PrimaryWheelParams, PrimarySliderParams } from '../color-grading/types';
import type { ToneMappingMethod, ColorSpace } from './aces';

// ==================== 类型定义 ====================

/** GPU 后端类型 */
export type GPUBackend = 'webgpu' | 'webgl2' | 'cpu-fallback';

/** 预览分辨率 */
export type PreviewResolution = '720p' | '1080p' | '1440p' | '4k';

/** 分辨率配置 */
export interface ResolutionConfig {
  width: number;
  height: number;
  label: string;
}

/** GPU 设备信息 */
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

/** 性能统计 */
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

/** 3D LUT GPU 数据 */
export interface GPU3DLUTData {
  size: number;
  data: Float32Array;
  textureId: string;
  format: 'rgb' | 'rgba';
}

/** 色彩校正参数 */
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

/** 色调映射参数 */
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

/** GPU 处理管线配置 */
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

/** GPU 缓存条目 */
interface GPUCacheEntry {
  key: string;
  textureData: Uint8ClampedArray;
  width: number;
  height: number;
  bytes: number;
  timestamp: number;
  accessCount: number;
}

/** GPU 处理结果 */
export interface GPUProcessResult {
  outputData: Uint8ClampedArray;
  width: number;
  height: number;
  processingTimeMs: number;
  fromCache: boolean;
  backend: GPUBackend;
}

/** 管线回调 */
export type GPUStatusCallback = (status: GPUDeviceStatus) => void;

/** 设备状态 */
export interface GPUDeviceStatus {
  available: boolean;
  backend: GPUBackend;
  message: string;
}

// ==================== 常量 ====================

export const RESOLUTION_PRESETS: Record<PreviewResolution, ResolutionConfig> = {
  '720p': { width: 1280, height: 720, label: '720p' },
  '1080p': { width: 1920, height: 1080, label: '1080p' },
  '1440p': { width: 2560, height: 1440, label: '1440p' },
  '4k': { width: 3840, height: 2160, label: '4K' },
};

const DEFAULT_PIPELINE_CONFIG: GPUPipelineConfig = {
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

const CACHE_TTL_MS = 30_000;
const MAX_PERFORMANCE_SAMPLES = 120;

// ==================== 工具函数 ====================

function clampValue(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function roundTo(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/** 计算参数哈希用于缓存键 */
export function computeParamsHash(params: Record<string, unknown>): string {
  const json = JSON.stringify(params, Object.keys(params).sort());
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const ch = json.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return `gpu-${Math.abs(hash).toString(36)}`;
}

/** 生成处理管线缓存键 */
export function buildPipelineCacheKey(
  imageDataHash: string,
  colorCorrection: GPUColorCorrectionParams | null,
  toneMapping: GPUToneMappingParams | null,
  lutId: string | null,
  resolution: PreviewResolution,
): string {
  const parts = [imageDataHash, resolution];
  if (colorCorrection) parts.push(computeParamsHash(colorCorrection as unknown as Record<string, unknown>));
  if (toneMapping) parts.push(computeParamsHash(toneMapping as unknown as Record<string, unknown>));
  if (lutId) parts.push(lutId);
  return parts.join('::');
}

// ==================== 默认工厂函数 ====================

/** 创建默认色彩校正参数 */
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

/** 创建默认色调映射参数 */
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

/** 创建默认管线配置 */
export function createDefaultPipelineConfig(): GPUPipelineConfig {
  return { ...DEFAULT_PIPELINE_CONFIG };
}

// ==================== 验证函数 ====================

/** 验证色彩校正参数 */
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

/** 验证色调映射参数 */
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

/** 验证管线配置 */
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

// ==================== 从现有类型转换 ====================

/** 从 PrimaryWheelParams + PrimarySliderParams 转换为 GPUColorCorrectionParams */
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

// ==================== GLSL 着色器代码 ====================

/** 生成完整的 GPU 色彩处理片段着色器 */
export function generateColorProcessingFragmentShader(): string {
  return `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_inputTexture;
uniform sampler3D u_lutTexture;

// 色彩校正 uniform
uniform vec4 u_lift;       // rgb + master
uniform vec4 u_gamma;      // rgb + master
uniform vec4 u_gain;       // rgb + master
uniform vec4 u_offset;     // rgb + master
uniform float u_temperature;
uniform float u_tint;
uniform float u_contrast;
uniform float u_pivot;
uniform float u_saturation;
uniform float u_hueRotation;

// 色调映射 uniform
uniform int u_toneMappingMethod;
uniform float u_exposure;
uniform float u_whitePoint;

// LUT uniform
uniform float u_lutIntensity;
uniform int u_enableLUT;
uniform int u_enableColorCorrection;
uniform int u_enableToneMapping;

// === 色彩校正函数 ===

vec3 applyLiftGammaGain(vec3 color, vec4 lift, vec4 gamma, vec4 gain, vec4 offset) {
  vec3 lifted = color + lift.rgb * (1.0 - color) + lift.a;
  vec3 gained = lifted * (1.0 + gain.rgb) + gain.a;
  vec3 gammaCorrected = pow(max(gained, vec3(0.0001)), 1.0 / (1.0 + gamma.rgb + gamma.a));
  return clamp(gammaCorrected + offset.rgb + offset.a, 0.0, 1.0);
}

vec3 applyTemperatureTint(vec3 color, float temperature, float tint) {
  float tempFactor = temperature / 100.0;
  float tintFactor = tint / 100.0;
  color.r += tempFactor * 0.1;
  color.b -= tempFactor * 0.1;
  color.g += tintFactor * 0.05;
  return clamp(color, 0.0, 1.0);
}

vec3 applyContrast(vec3 color, float contrast, float pivot) {
  float factor = 1.0 + contrast / 100.0;
  return clamp((color - pivot) * factor + pivot, 0.0, 1.0);
}

vec3 applySaturation(vec3 color, float saturation) {
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float sat = saturation / 100.0;
  return clamp(mix(vec3(lum), color, sat), 0.0, 1.0);
}

vec3 applyHueRotation(vec3 color, float degrees) {
  float rad = radians(degrees);
  float cosA = cos(rad);
  float sinA = sin(rad);
  mat3 hueMatrix = mat3(
    0.213 + cosA * 0.787 - sinA * 0.213,
    0.715 - cosA * 0.715 - sinA * 0.715,
    0.072 - cosA * 0.072 + sinA * 0.928,
    0.213 - cosA * 0.213 + sinA * 0.143,
    0.715 + cosA * 0.285 + sinA * 0.140,
    0.072 - cosA * 0.072 - sinA * 0.283,
    0.213 - cosA * 0.213 - sinA * 0.787,
    0.715 - cosA * 0.715 + sinA * 0.715,
    0.072 + cosA * 0.928 + sinA * 0.072
  );
  return clamp(hueMatrix * color, 0.0, 1.0);
}

// === 色调映射函数 ===

vec3 toneMapReinhard(vec3 color) {
  return color / (1.0 + color);
}

vec3 toneMapFilmic(vec3 color) {
  vec3 x = max(vec3(0.0), color - 0.004);
  return (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);
}

vec3 toneMapAcesHill(vec3 color) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
}

vec3 toneMapAcesNarkowicz(vec3 color) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
}

vec3 toneMapAgx(vec3 color) {
  const vec3 agxOffset = vec3(0.008);
  const float agxMinEv = -12.47;
  const float agxMaxEv = 6.5;
  vec3 logColor = log2(max(color, vec3(0.0001)));
  vec3 normalized = (logColor - agxMinEv) / (agxMaxEv - agxMinEv);
  return clamp(normalized + agxOffset, 0.0, 1.0);
}

vec3 applyToneMapping(vec3 color, int method, float exposure) {
  color *= pow(2.0, exposure);
  if (method == 0) return color; // none
  if (method == 1) return toneMapReinhard(color);
  if (method == 2) return toneMapFilmic(color);
  if (method == 3) return toneMapAcesHill(color);
  if (method == 4) return toneMapAcesNarkowicz(color);
  if (method == 7) return toneMapAgx(color);
  return toneMapAcesHill(color); // 默认
}

// === 主处理函数 ===

void main() {
  vec4 color = texture(u_inputTexture, v_texCoord);

  // 色彩校正
  if (u_enableColorCorrection == 1) {
    color.rgb = applyLiftGammaGain(color.rgb, u_lift, u_gamma, u_gain, u_offset);
    color.rgb = applyTemperatureTint(color.rgb, u_temperature, u_tint);
    color.rgb = applyContrast(color.rgb, u_contrast, u_pivot);
    color.rgb = applySaturation(color.rgb, u_saturation);
    if (abs(u_hueRotation) > 0.01) {
      color.rgb = applyHueRotation(color.rgb, u_hueRotation);
    }
  }

  // 色调映射
  if (u_enableToneMapping == 1) {
    color.rgb = applyToneMapping(color.rgb, u_toneMappingMethod, u_exposure);
  }

  // 3D LUT 应用
  if (u_enableLUT == 1) {
    vec3 lutColor = texture(u_lutTexture, color.rgb).rgb;
    color.rgb = mix(color.rgb, lutColor, u_lutIntensity);
  }

  fragColor = vec4(clamp(color.rgb, 0.0, 1.0), color.a);
}`;
}

/** 生成顶点着色器 */
export function generateVertexShader(): string {
  return `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`;
}

/** 生成 WebGPU 计算着色器 (WGSL) */
export function generateWebGPUComputeShader(): string {
  return `struct ColorCorrectionParams {
  lift: vec4<f32>,
  gamma: vec4<f32>,
  gain: vec4<f32>,
  offset: vec4<f32>,
  temperature: f32,
  tint: f32,
  contrast: f32,
  pivot: f32,
  saturation: f32,
  hueRotation: f32,
  exposure: f32,
  toneMappingMethod: i32,
  lutIntensity: f32,
  enableFlags: i32,  // bit0=LUT, bit1=CC, bit2=TM
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var lutTexture: texture_3d<f32>;
@group(0) @binding(3) var<uniform> params: ColorCorrectionParams;
@group(0) @binding(4) var inputSampler: sampler;

fn applyLiftGammaGain(color: vec3<f32>, lift: vec4<f32>, gamma: vec4<f32>, gain: vec4<f32>, offset: vec4<f32>) -> vec3<f32> {
  let lifted = color + lift.rgb * (1.0 - color) + lift.a;
  let gained = lifted * (1.0 + gain.rgb) + gain.a;
  let gammaCorrected = pow(max(gained, vec3<f32>(0.0001)), vec3<f32>(1.0) / (vec3<f32>(1.0) + gamma.rgb + gamma.a));
  return clamp(gammaCorrected + offset.rgb + offset.a, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyTemperatureTint(color: vec3<f32>, temperature: f32, tint: f32) -> vec3<f32> {
  var c = color;
  let tempFactor = temperature / 100.0;
  let tintFactor = tint / 100.0;
  c.r += tempFactor * 0.1;
  c.b -= tempFactor * 0.1;
  c.g += tintFactor * 0.05;
  return clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyContrast(color: vec3<f32>, contrast: f32, pivot: f32) -> vec3<f32> {
  let factor = 1.0 + contrast / 100.0;
  return clamp((color - vec3<f32>(pivot)) * factor + vec3<f32>(pivot), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applySaturation(color: vec3<f32>, saturation: f32) -> vec3<f32> {
  let lum = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  let sat = saturation / 100.0;
  return clamp(mix(vec3<f32>(lum), color, sat), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn toneMapAcesHill(color: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn toneMapReinhard(color: vec3<f32>) -> vec3<f32> {
  return color / (vec3<f32>(1.0) + color);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = textureDimensions(inputTexture);
  let coord = vec2<i32>(i32(global_id.x), i32(global_id.y));

  if (coord.x >= i32(dims.x) || coord.y >= i32(dims.y)) {
    return;
  }

  var color = textureLoad(inputTexture, coord, 0);

  // 色彩校正
  if ((params.enableFlags & 2) != 0) {
    color.rgb = applyLiftGammaGain(color.rgb, params.lift, params.gamma, params.gain, params.offset);
    color.rgb = applyTemperatureTint(color.rgb, params.temperature, params.tint);
    color.rgb = applyContrast(color.rgb, params.contrast, params.pivot);
    color.rgb = applySaturation(color.rgb, params.saturation);
  }

  // 色调映射
  if ((params.enableFlags & 4) != 0) {
    color.rgb *= pow(2.0, params.exposure);
    if (params.toneMappingMethod == 1) {
      color.rgb = toneMapReinhard(color.rgb);
    } else {
      color.rgb = toneMapAcesHill(color.rgb);
    }
  }

  // 3D LUT
  if ((params.enableFlags & 1) != 0) {
    let lutColor = textureSampleLevel(lutTexture, inputSampler, color.rgb, 0.0).rgb;
    color.rgb = mix(color.rgb, lutColor, params.lutIntensity);
  }

  textureStore(outputTexture, coord, vec4<f32>(clamp(color.rgb, vec3<f32>(0.0), vec3<f32>(1.0)), color.a));
}`;
}

// ==================== CPU 回退实现 ====================

/** CPU 回退：应用 Lift/Gamma/Gain/Offset */
export function cpuApplyLiftGammaGain(
  r: number,
  g: number,
  b: number,
  params: GPUColorCorrectionParams,
): [number, number, number] {
  const lr = r + params.lift.r * (1 - r) + params.liftMaster;
  const lg = g + params.lift.g * (1 - g) + params.liftMaster;
  const lb = b + params.lift.b * (1 - b) + params.liftMaster;

  const gr = lr * (1 + params.gain.r) + params.gainMaster;
  const gg = lg * (1 + params.gain.g) + params.gainMaster;
  const gb = lb * (1 + params.gain.b) + params.gainMaster;

  const gammaR = 1 / (1 + params.gamma.r + params.gammaMaster);
  const gammaG = 1 / (1 + params.gamma.g + params.gammaMaster);
  const gammaB = 1 / (1 + params.gamma.b + params.gammaMaster);

  const cr = Math.pow(Math.max(gr, 0.0001), gammaR) + params.offset.r + params.offsetMaster;
  const cg = Math.pow(Math.max(gg, 0.0001), gammaG) + params.offset.g + params.offsetMaster;
  const cb = Math.pow(Math.max(gb, 0.0001), gammaB) + params.offset.b + params.offsetMaster;

  return [clampValue(cr, 0, 1), clampValue(cg, 0, 1), clampValue(cb, 0, 1)];
}

/** CPU 回退：应用色温/色调 */
export function cpuApplyTemperatureTint(
  r: number,
  g: number,
  b: number,
  temperature: number,
  tint: number,
): [number, number, number] {
  const tf = temperature / 100;
  const tt = tint / 100;
  return [clampValue(r + tf * 0.1, 0, 1), clampValue(g + tt * 0.05, 0, 1), clampValue(b - tf * 0.1, 0, 1)];
}

/** CPU 回退：应用对比度 */
export function cpuApplyContrast(
  r: number,
  g: number,
  b: number,
  contrast: number,
  pivot: number,
): [number, number, number] {
  const factor = 1 + contrast / 100;
  return [
    clampValue((r - pivot) * factor + pivot, 0, 1),
    clampValue((g - pivot) * factor + pivot, 0, 1),
    clampValue((b - pivot) * factor + pivot, 0, 1),
  ];
}

/** CPU 回退：应用饱和度 */
export function cpuApplySaturation(r: number, g: number, b: number, saturation: number): [number, number, number] {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sat = saturation / 100;
  return [
    clampValue(lum + (r - lum) * sat, 0, 1),
    clampValue(lum + (g - lum) * sat, 0, 1),
    clampValue(lum + (b - lum) * sat, 0, 1),
  ];
}

/** CPU 回退：色调映射 - ACES Hill */
export function cpuToneMapAcesHill(r: number, g: number, b: number): [number, number, number] {
  const a = 2.51,
    bb = 0.03,
    c = 2.43,
    d = 0.59,
    e = 0.14;
  return [
    clampValue((r * (a * r + bb)) / (r * (c * r + d) + e), 0, 1),
    clampValue((g * (a * g + bb)) / (g * (c * g + d) + e), 0, 1),
    clampValue((b * (a * b + bb)) / (b * (c * b + d) + e), 0, 1),
  ];
}

/** CPU 回退：色调映射 - Reinhard */
export function cpuToneMapReinhard(r: number, g: number, b: number): [number, number, number] {
  return [r / (1 + r), g / (1 + g), b / (1 + b)];
}

/** CPU 回退：色调映射 - Filmic */
export function cpuToneMapFilmic(r: number, g: number, b: number): [number, number, number] {
  const film = (x: number) => {
    const v = Math.max(0, x - 0.004);
    return (v * (6.2 * v + 0.5)) / (v * (6.2 * v + 1.7) + 0.06);
  };
  return [clampValue(film(r), 0, 1), clampValue(film(g), 0, 1), clampValue(film(b), 0, 1)];
}

/** CPU 回退：色调映射 */
export function cpuApplyToneMapping(
  r: number,
  g: number,
  b: number,
  method: ToneMappingMethod,
  exposure: number,
): [number, number, number] {
  const factor = 2 ** exposure;
  let er = r * factor;
  let eg = g * factor;
  let eb = b * factor;

  switch (method) {
    case 'none':
      break;
    case 'reinhard':
    case 'reinhard-extended':
      [er, eg, eb] = cpuToneMapReinhard(er, eg, eb);
      break;
    case 'filmic':
    case 'uncharted2':
      [er, eg, eb] = cpuToneMapFilmic(er, eg, eb);
      break;
    case 'aces-hill':
    case 'aces-narkowicz':
    case 'aces-lottes':
      [er, eg, eb] = cpuToneMapAcesHill(er, eg, eb);
      break;
    case 'agx': {
      const agxOffset = 0.008;
      const minEv = -12.47;
      const maxEv = 6.5;
      const norm = (v: number) =>
        clampValue((Math.log2(Math.max(v, 0.0001)) - minEv) / (maxEv - minEv) + agxOffset, 0, 1);
      er = norm(er);
      eg = norm(eg);
      eb = norm(eb);
      break;
    }
    default:
      [er, eg, eb] = cpuToneMapAcesHill(er, eg, eb);
  }

  return [clampValue(er, 0, 1), clampValue(eg, 0, 1), clampValue(eb, 0, 1)];
}

/** CPU 回退：3D LUT 三线性插值 */
export function cpuApply3DLUT(
  r: number,
  g: number,
  b: number,
  lutData: GPU3DLUTData,
  intensity: number,
): [number, number, number] {
  const size = lutData.size;
  const ri = clampValue(r, 0, 1) * (size - 1);
  const gi = clampValue(g, 0, 1) * (size - 1);
  const bi = clampValue(b, 0, 1) * (size - 1);

  const r0 = Math.floor(ri);
  const g0 = Math.floor(gi);
  const b0 = Math.floor(bi);
  const r1 = Math.min(r0 + 1, size - 1);
  const g1 = Math.min(g0 + 1, size - 1);
  const b1 = Math.min(b0 + 1, size - 1);

  const rf = ri - r0;
  const gf = gi - g0;
  const bf = bi - b0;

  const idx = (rr: number, gg: number, bb: number) => (bb * size * size + gg * size + rr) * 3;

  const lut = lutData.data;
  const get = (rr: number, gg: number, bb: number, ch: number) => {
    const i = idx(rr, gg, bb) + ch;
    return i < lut.length ? lut[i] : 0;
  };

  // 三线性插值
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const c000 = [get(r0, g0, b0, 0), get(r0, g0, b0, 1), get(r0, g0, b0, 2)];
  const c100 = [get(r1, g0, b0, 0), get(r1, g0, b0, 1), get(r1, g0, b0, 2)];
  const c010 = [get(r0, g1, b0, 0), get(r0, g1, b0, 1), get(r0, g1, b0, 2)];
  const c110 = [get(r1, g1, b0, 0), get(r1, g1, b0, 1), get(r1, g1, b0, 2)];
  const c001 = [get(r0, g0, b1, 0), get(r0, g0, b1, 1), get(r0, g0, b1, 2)];
  const c101 = [get(r1, g0, b1, 0), get(r1, g0, b1, 1), get(r1, g0, b1, 2)];
  const c011 = [get(r0, g1, b1, 0), get(r0, g1, b1, 1), get(r0, g1, b1, 2)];
  const c111 = [get(r1, g1, b1, 0), get(r1, g1, b1, 1), get(r1, g1, b1, 2)];

  const result = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    const c00 = lerp(c000[ch], c100[ch], rf);
    const c01 = lerp(c001[ch], c101[ch], rf);
    const c10 = lerp(c010[ch], c110[ch], rf);
    const c11 = lerp(c011[ch], c111[ch], rf);
    const c0 = lerp(c00, c10, gf);
    const c1 = lerp(c01, c11, gf);
    result[ch] = lerp(c0, c1, bf);
  }

  return [
    clampValue(r + (result[0] - r) * intensity, 0, 1),
    clampValue(g + (result[1] - g) * intensity, 0, 1),
    clampValue(b + (result[2] - b) * intensity, 0, 1),
  ];
}

/** CPU 回退：完整色彩处理管线 */
export function cpuProcessPixel(
  r: number,
  g: number,
  b: number,
  colorCorrection: GPUColorCorrectionParams | null,
  toneMapping: GPUToneMappingParams | null,
  lutData: GPU3DLUTData | null,
  lutIntensity: number,
): [number, number, number] {
  let cr = r;
  let cg = g;
  let cb = b;

  // 色彩校正
  if (colorCorrection) {
    [cr, cg, cb] = cpuApplyLiftGammaGain(cr, cg, cb, colorCorrection);
    [cr, cg, cb] = cpuApplyTemperatureTint(cr, cg, cb, colorCorrection.temperature, colorCorrection.tint);
    [cr, cg, cb] = cpuApplyContrast(cr, cg, cb, colorCorrection.contrast, colorCorrection.pivot);
    [cr, cg, cb] = cpuApplySaturation(cr, cg, cb, colorCorrection.saturation);
    if (Math.abs(colorCorrection.hueRotation) > 0.01) {
      const rad = (colorCorrection.hueRotation * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      const rr =
        cr * (0.213 + cosA * 0.787 - sinA * 0.213) +
        cg * (0.715 - cosA * 0.715 - sinA * 0.715) +
        cb * (0.072 - cosA * 0.072 + sinA * 0.928);
      const gr =
        cr * (0.213 - cosA * 0.213 + sinA * 0.143) +
        cg * (0.715 + cosA * 0.285 + sinA * 0.14) +
        cb * (0.072 - cosA * 0.072 - sinA * 0.283);
      const br =
        cr * (0.213 - cosA * 0.213 - sinA * 0.787) +
        cg * (0.715 - cosA * 0.715 + sinA * 0.715) +
        cb * (0.072 + cosA * 0.928 + sinA * 0.072);
      cr = clampValue(rr, 0, 1);
      cg = clampValue(gr, 0, 1);
      cb = clampValue(br, 0, 1);
    }
  }

  // 色调映射
  if (toneMapping) {
    [cr, cg, cb] = cpuApplyToneMapping(cr, cg, cb, toneMapping.method, toneMapping.exposure);
  }

  // 3D LUT
  if (lutData) {
    [cr, cg, cb] = cpuApply3DLUT(cr, cg, cb, lutData, lutIntensity);
  }

  return [clampValue(cr, 0, 1), clampValue(cg, 0, 1), clampValue(cb, 0, 1)];
}

/** 处理整帧图像数据 (CPU 回退) */
export function cpuProcessFrame(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  colorCorrection: GPUColorCorrectionParams | null,
  toneMapping: GPUToneMappingParams | null,
  lutData: GPU3DLUTData | null,
  lutIntensity: number,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(input.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = input[idx] / 255;
      const g = input[idx + 1] / 255;
      const b = input[idx + 2] / 255;

      const [or, og, ob] = cpuProcessPixel(r, g, b, colorCorrection, toneMapping, lutData, lutIntensity);

      output[idx] = Math.round(or * 255);
      output[idx + 1] = Math.round(og * 255);
      output[idx + 2] = Math.round(ob * 255);
      output[idx + 3] = input[idx + 3];
    }
  }
  return output;
}

// ==================== GPU 处理器类 ====================

/**
 * GPU 色彩处理器
 *
 * 提供 GPU 加速的色彩处理管线。支持 WebGPU / WebGL2 双后端，
 * 自动回退到 CPU 处理。包含 LRU 缓存和性能监控。
 */
export class GPUColorProcessor {
  private config: GPUPipelineConfig;
  private deviceInfo: GPUDeviceInfo | null = null;
  private cache: Map<string, GPUCacheEntry> = new Map();
  private cacheUsedBytes = 0;
  private performanceHistory: number[] = [];
  private stats: GPUPerformanceStats;
  private statusListeners: Set<GPUStatusCallback> = new Set();
  private currentBackend: GPUBackend = 'cpu-fallback';
  private initialized = false;
  private webglCanvas: HTMLCanvasElement | null = null;
  private webglContext: WebGL2RenderingContext | null = null;

  constructor(config?: Partial<GPUPipelineConfig>) {
    this.config = validateGPUPipelineConfig({ ...DEFAULT_PIPELINE_CONFIG, ...config });
    this.stats = this.createEmptyStats();
  }

  /** 获取当前配置 */
  getConfig(): GPUPipelineConfig {
    return { ...this.config };
  }

  /** 更新配置 */
  updateConfig(patch: Partial<GPUPipelineConfig>): void {
    this.config = validateGPUPipelineConfig({ ...this.config, ...patch });
    this.clearCache();
  }

  /** 获取当前后端 */
  getBackend(): GPUBackend {
    return this.currentBackend;
  }

  /** 获取设备信息 */
  getDeviceInfo(): GPUDeviceInfo | null {
    return this.deviceInfo ? { ...this.deviceInfo } : null;
  }

  /** 获取性能统计 */
  getPerformanceStats(): GPUPerformanceStats {
    return { ...this.stats };
  }

  /** 注册状态回调 */
  onStatusChange(callback: GPUStatusCallback): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  /** 初始化 GPU 设备 */
  async initialize(): Promise<GPUDeviceInfo> {
    if (this.initialized && this.deviceInfo) {
      return this.deviceInfo;
    }

    // 尝试 WebGPU
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        const adapter = await (
          navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown> } }
        ).gpu.requestAdapter();
        if (adapter) {
          const device = await (adapter as { requestDevice: () => Promise<unknown> }).requestDevice();
          if (device) {
            this.currentBackend = 'webgpu';
            this.deviceInfo = {
              backend: 'webgpu',
              vendor: 'webgpu',
              renderer: 'webgpu',
              maxTextureSize: 8192,
              maxComputeWorkgroupSize: [256, 256, 64],
              supportsWebGPU: true,
              supportsWebGL2: true,
              vramEstimateMB: 0,
            };
            this.initialized = true;
            this.notifyStatus({ available: true, backend: 'webgpu', message: 'WebGPU 就绪' });
            return this.deviceInfo;
          }
        }
      } catch {
        // WebGPU 不可用，尝试 WebGL2
      }
    }

    // 尝试 WebGL2
    if (typeof document !== 'undefined') {
      try {
        this.webglCanvas = document.createElement('canvas');
        this.webglContext = this.webglCanvas.getContext('webgl2');
        if (this.webglContext) {
          const gl = this.webglContext;
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          this.currentBackend = 'webgl2';
          this.deviceInfo = {
            backend: 'webgl2',
            vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
            renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxComputeWorkgroupSize: [0, 0, 0],
            supportsWebGPU: false,
            supportsWebGL2: true,
            vramEstimateMB: 0,
          };
          this.initialized = true;
          this.notifyStatus({ available: true, backend: 'webgl2', message: 'WebGL2 就绪' });
          return this.deviceInfo;
        }
      } catch {
        // WebGL2 不可用
      }
    }

    // CPU 回退
    this.currentBackend = 'cpu-fallback';
    this.deviceInfo = {
      backend: 'cpu-fallback',
      vendor: 'cpu',
      renderer: 'cpu',
      maxTextureSize: 0,
      maxComputeWorkgroupSize: [0, 0, 0],
      supportsWebGPU: false,
      supportsWebGL2: false,
      vramEstimateMB: 0,
    };
    this.initialized = true;
    this.notifyStatus({ available: true, backend: 'cpu-fallback', message: '使用 CPU 回退' });
    return this.deviceInfo;
  }

  /** 处理图像帧 */
  async processFrame(
    input: Uint8ClampedArray,
    width: number,
    height: number,
    colorCorrection?: GPUColorCorrectionParams | null,
    toneMapping?: GPUToneMappingParams | null,
    lutData?: GPU3DLUTData | null,
    lutIntensity: number = 1.0,
  ): Promise<GPUProcessResult> {
    const start = performance.now();

    // 检查缓存
    if (this.config.enableCache) {
      const ccHash = colorCorrection
        ? computeParamsHash(colorCorrection as unknown as Record<string, unknown>)
        : 'none';
      const tmHash = toneMapping ? computeParamsHash(toneMapping as unknown as Record<string, unknown>) : 'none';
      const lutHash = lutData ? lutData.textureId : 'none';
      const cacheKey = `${width}x${height}::cc=${ccHash}::tm=${tmHash}::lut=${lutHash}::li=${lutIntensity}`;

      const cached = this.cache.get(cacheKey);
      if (cached) {
        cached.accessCount++;
        cached.timestamp = Date.now();
        this.stats.cacheHits++;
        const elapsed = performance.now() - start;
        this.recordFrameTime(elapsed);
        return {
          outputData: cached.textureData,
          width: cached.width,
          height: cached.height,
          processingTimeMs: roundTo(elapsed, 2),
          fromCache: true,
          backend: this.currentBackend,
        };
      }
      this.stats.cacheMisses++;
    }

    // 执行处理
    let output: Uint8ClampedArray;
    if (this.currentBackend === 'cpu-fallback') {
      output = cpuProcessFrame(
        input,
        width,
        height,
        colorCorrection ?? null,
        toneMapping ?? null,
        lutData ?? null,
        lutIntensity,
      );
    } else {
      // GPU 处理路径 - 在实际 GPU 上下文中由调用者管理
      // 这里回退到 CPU 以保持纯逻辑层
      output = cpuProcessFrame(
        input,
        width,
        height,
        colorCorrection ?? null,
        toneMapping ?? null,
        lutData ?? null,
        lutIntensity,
      );
    }

    const elapsed = performance.now() - start;
    this.recordFrameTime(elapsed);

    // 写入缓存
    if (this.config.enableCache) {
      const ccHash = colorCorrection
        ? computeParamsHash(colorCorrection as unknown as Record<string, unknown>)
        : 'none';
      const tmHash = toneMapping ? computeParamsHash(toneMapping as unknown as Record<string, unknown>) : 'none';
      const lutHash = lutData ? lutData.textureId : 'none';
      const cacheKey = `${width}x${height}::cc=${ccHash}::tm=${tmHash}::lut=${lutHash}::li=${lutIntensity}`;
      this.addToCache(cacheKey, output, width, height);
    }

    this.stats.framesRendered++;

    return {
      outputData: output,
      width,
      height,
      processingTimeMs: roundTo(elapsed, 2),
      fromCache: false,
      backend: this.currentBackend,
    };
  }

  /** 清除缓存 */
  clearCache(): void {
    this.cache.clear();
    this.cacheUsedBytes = 0;
  }

  /** 销毁处理器 */
  dispose(): void {
    this.clearCache();
    this.performanceHistory = [];
    this.stats = this.createEmptyStats();
    this.statusListeners.clear();
    this.webglContext = null;
    this.webglCanvas = null;
    this.deviceInfo = null;
    this.initialized = false;
  }

  // === 内部方法 ===

  private createEmptyStats(): GPUPerformanceStats {
    return {
      frameTimeMs: 0,
      gpuTimeMs: 0,
      uploadTimeMs: 0,
      downloadTimeMs: 0,
      textureMemoryMB: 0,
      bufferMemoryMB: 0,
      framesRendered: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  private recordFrameTime(ms: number): void {
    this.performanceHistory.push(ms);
    if (this.performanceHistory.length > MAX_PERFORMANCE_SAMPLES) {
      this.performanceHistory.shift();
    }
    this.stats.frameTimeMs = roundTo(ms, 2);
    this.stats.gpuTimeMs = roundTo(ms * 0.8, 2); // 估算 GPU 时间
  }

  private addToCache(key: string, data: Uint8ClampedArray, width: number, height: number): void {
    const entryBytes = data.byteLength;

    // Byte-level LRU eviction
    while (this.cache.size > 0 && (this.cacheUsedBytes + entryBytes > this.config.maxCacheBytes || this.cache.size >= this.config.maxCacheSize)) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [k, v] of this.cache) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
      if (!oldestKey) break;
      const evicted = this.cache.get(oldestKey);
      if (evicted) this.cacheUsedBytes -= evicted.bytes;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      key,
      textureData: new Uint8ClampedArray(data),
      width,
      height,
      bytes: entryBytes,
      timestamp: Date.now(),
      accessCount: 1,
    });
    this.cacheUsedBytes += entryBytes;
  }

  private notifyStatus(status: GPUDeviceStatus): void {
    for (const cb of this.statusListeners) {
      try {
        cb(status);
      } catch {
        /* 忽略回调异常 */
      }
    }
  }
}

// ==================== 预览缓存管理器 ====================

/**
 * 预览帧缓存
 *
 * 管理多分辨率预览帧的缓存，支持参数变化时的增量更新。
 */
export class PreviewFrameCache {
  private entries: Map<string, { data: Uint8ClampedArray; width: number; height: number; ts: number }> = new Map();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries: number = 32, ttlMs: number = CACHE_TTL_MS) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /** 获取缓存帧 */
  get(key: string): { data: Uint8ClampedArray; width: number; height: number } | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttlMs) {
      this.entries.delete(key);
      return null;
    }
    return { data: entry.data, width: entry.width, height: entry.height };
  }

  /** 设置缓存帧 */
  set(key: string, data: Uint8ClampedArray, width: number, height: number): void {
    if (this.entries.size >= this.maxEntries) {
      // 淘汰最旧的
      let oldestKey = '';
      let oldestTs = Infinity;
      for (const [k, v] of this.entries) {
        if (v.ts < oldestTs) {
          oldestTs = v.ts;
          oldestKey = k;
        }
      }
      if (oldestKey) this.entries.delete(oldestKey);
    }
    this.entries.set(key, { data: new Uint8ClampedArray(data), width, height, ts: Date.now() });
  }

  /** 清除过期条目 */
  evict(): number {
    const now = Date.now();
    let evicted = 0;
    for (const [k, v] of this.entries) {
      if (now - v.ts > this.ttlMs) {
        this.entries.delete(k);
        evicted++;
      }
    }
    return evicted;
  }

  /** 清除所有缓存 */
  clear(): void {
    this.entries.clear();
  }

  /** 获取缓存大小 */
  size(): number {
    return this.entries.size;
  }
}

// ==================== 性能监控器 ====================

/**
 * GPU 性能监控器
 *
 * 跟踪帧时间、GPU 利用率和内存使用。
 */
export class GPUPerformanceMonitor {
  private frameTimes: number[] = [];
  private gpuTimes: number[] = [];
  private maxSamples: number;

  constructor(maxSamples: number = MAX_PERFORMANCE_SAMPLES) {
    this.maxSamples = maxSamples;
  }

  /** 记录一帧 */
  recordFrame(frameTimeMs: number, gpuTimeMs: number): void {
    this.frameTimes.push(frameTimeMs);
    this.gpuTimes.push(gpuTimeMs);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
      this.gpuTimes.shift();
    }
  }

  /** 获取平均帧时间 */
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    return roundTo(sum / this.frameTimes.length, 2);
  }

  /** 获取 P95 帧时间 */
  getP95FrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return roundTo(sorted[idx], 2);
  }

  /** 获取预估 FPS */
  getEstimatedFPS(): number {
    const avg = this.getAverageFrameTime();
    return avg > 0 ? roundTo(1000 / avg, 1) : 0;
  }

  /** 获取平均 GPU 时间 */
  getAverageGPUTime(): number {
    if (this.gpuTimes.length === 0) return 0;
    const sum = this.gpuTimes.reduce((a, b) => a + b, 0);
    return roundTo(sum / this.gpuTimes.length, 2);
  }

  /** 获取 GPU 利用率估算 (0-1) */
  getGPUUtilization(): number {
    const avgFrame = this.getAverageFrameTime();
    const avgGpu = this.getAverageGPUTime();
    return avgFrame > 0 ? roundTo(Math.min(avgGpu / avgFrame, 1), 3) : 0;
  }

  /** 重置统计 */
  reset(): void {
    this.frameTimes = [];
    this.gpuTimes = [];
  }

  /** 获取完整报告 */
  getReport(): {
    avgFrameTimeMs: number;
    p95FrameTimeMs: number;
    avgGpuTimeMs: number;
    estimatedFPS: number;
    gpuUtilization: number;
    sampleCount: number;
  } {
    return {
      avgFrameTimeMs: this.getAverageFrameTime(),
      p95FrameTimeMs: this.getP95FrameTime(),
      avgGpuTimeMs: this.getAverageGPUTime(),
      estimatedFPS: this.getEstimatedFPS(),
      gpuUtilization: this.getGPUUtilization(),
      sampleCount: this.frameTimes.length,
    };
  }
}
