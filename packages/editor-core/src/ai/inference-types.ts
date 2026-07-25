/**
 * AI inference engine — type definitions and constants
 */

export type ComputeBackend = 'webgpu' | 'webgl2' | 'wasm' | 'cpu' | 'auto';
export type QuantizationType = 'fp32' | 'fp16' | 'int8' | 'int4';
export type ModelType = 'asr' | 'semantic' | 'vision' | 'llm' | 'custom';

export interface InferenceConfig {
  backend: ComputeBackend;
  quantization: QuantizationType;
  batchSize: number;
  maxSequenceLength: number;
  enableOperatorFusion: boolean;
  enableMemoryMapping: boolean;
  warmupIterations: number;
}

export const DEFAULT_INFERENCE_CONFIG: InferenceConfig = {
  backend: 'webgpu',
  quantization: 'fp16',
  batchSize: 1,
  maxSequenceLength: 512,
  enableOperatorFusion: true,
  enableMemoryMapping: true,
  warmupIterations: 3,
};

export interface TensorDescriptor {
  shape: number[];
  dtype: 'float32' | 'float16' | 'int8' | 'int4';
  data: ArrayBuffer;
}

export interface InferenceResult {
  output: TensorDescriptor;
  inferenceTimeMs: number;
  backend: ComputeBackend;
  quantization: QuantizationType;
  memoryUsedBytes: number;
}

export interface OperatorFusionPattern {
  name: string;
  operators: string[];
  fusedOperator: string;
  speedupFactor: number;
}
