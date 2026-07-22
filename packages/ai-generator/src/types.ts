/**
 * AI Generator type definitions
 */

// ============================================================
// Generation Types
// ============================================================

export type GenerationType = 'text-to-video' | 'image-to-video' | 'interactive';

export type VideoQuality = 'low' | 'medium' | 'high' | 'ultra';

export type VideoStyle = 'cinematic' | 'anime' | 'realistic' | 'artistic' | 'abstract';

export type ComputeBackend = 'webgpu' | 'webgl' | 'cpu';

export type ModelPrecision = 'fp32' | 'fp16' | 'int8' | 'int4';

// ============================================================
// Generation Options
// ============================================================

export interface TextToVideoOptions {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  style?: VideoStyle;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
  quality?: VideoQuality;
}

export interface ImageToVideoOptions {
  image: Blob | File;
  prompt?: string;
  motionStrength: number;
  width: number;
  height: number;
  duration: number;
  fps: number;
  seed?: number;
  quality?: VideoQuality;
}

export interface InteractiveOptions {
  prompt: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  previewQuality: VideoQuality;
  onPreview?: (frame: ImageData) => void;
  onProgress?: (progress: number) => void;
}

// ============================================================
// Generation Results
// ============================================================

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  fps: number;
  generationTime: number;
  modelVersion: string;
  computeBackend: ComputeBackend;
  precision: ModelPrecision;
}

export interface TextToVideoResult {
  video: Blob;
  metadata: VideoMetadata;
}

export interface ImageToVideoResult {
  video: Blob;
  metadata: VideoMetadata & {
    sourceImageSize: { width: number; height: number };
  };
}

// ============================================================
// Model Types
// ============================================================

export interface ModelConfig {
  id: string;
  name: string;
  version: string;
  type: GenerationType;
  precision: ModelPrecision;
  inputShape: number[];
  outputShape: number[];
  quantized: boolean;
  fileSize: number;
  checksum: string;
}

export interface ModelManifest {
  models: ModelConfig[];
  defaultModel: string;
  supportedPrecisions: ModelPrecision[];
  minMemoryMB: number;
  recommendedMemoryMB: number;
}

// ============================================================
// Compute Engine Types
// ============================================================

export interface ComputeCapabilities {
  backend: ComputeBackend;
  maxTextureSize: number;
  maxBufferSize: number;
  maxComputeWorkgroupSize: [number, number, number];
  supportsF16: boolean;
  supportsInt8: boolean;
  memoryMB: number;
}

export interface ComputeEngine {
  readonly backend: ComputeBackend;
  readonly capabilities: ComputeCapabilities;

  initialize(): Promise<void>;
  createBuffer(data: Float32Array): Promise<unknown>;
  createTexture(data: Uint8Array, width: number, height: number): Promise<unknown>;
  execute(program: unknown, inputs: unknown[]): Promise<Float32Array>;
  dispose(): void;
}

// ============================================================
// Pipeline Types
// ============================================================

export interface PipelineStage {
  name: string;
  execute(inputs: unknown[]): Promise<unknown[]>;
  dispose(): void;
}

export interface GenerationPipeline {
  readonly type: GenerationType;
  readonly stages: PipelineStage[];

  initialize(): Promise<void>;
  execute(options: unknown): Promise<Blob>;
  dispose(): void;
}

// ============================================================
// Interactive Generator Types
// ============================================================

export interface InteractiveGenerator {
  readonly isRunning: boolean;
  readonly currentPreview: ImageData | null;
  readonly progress: number;

  start(options: InteractiveOptions): Promise<void>;
  updatePrompt(prompt: string): void;
  updateParams(params: Partial<InteractiveOptions>): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  getPreview(): ImageData | null;
  getFinalVideo(): Promise<Blob>;
  dispose(): void;
}

// ============================================================
// Usage Limit Types
// ============================================================

export type UserTier = 'free' | 'creator' | 'pro';

export interface UsageLimits {
  dailyGenerations: number;
  maxDuration: number;
  maxResolution: string;
  priority: 'low' | 'medium' | 'high';
}

export const USAGE_LIMITS: Record<UserTier, UsageLimits> = {
  free: {
    dailyGenerations: 5,
    maxDuration: 5,
    maxResolution: '720p',
    priority: 'low',
  },
  creator: {
    dailyGenerations: 50,
    maxDuration: 10,
    maxResolution: '1080p',
    priority: 'medium',
  },
  pro: {
    dailyGenerations: -1,
    maxDuration: 30,
    maxResolution: '4k',
    priority: 'high',
  },
};

// ============================================================
// Content Safety Types
// ============================================================

export interface ContentFilterConfig {
  blockNSFW: boolean;
  blockViolence: boolean;
  blockHateSpeech: boolean;
  customBlocklist: string[];
}

export interface ContentSafetyResult {
  safe: boolean;
  flags: string[];
  confidence: number;
}

// ============================================================
// Event Types
// ============================================================

export type GeneratorEvent =
  | { type: 'progress'; progress: number; stage: string }
  | { type: 'preview'; frame: ImageData }
  | { type: 'complete'; video: Blob; metadata: VideoMetadata }
  | { type: 'error'; error: Error }
  | { type: 'cancelled' };

export type GeneratorEventHandler = (event: GeneratorEvent) => void;
