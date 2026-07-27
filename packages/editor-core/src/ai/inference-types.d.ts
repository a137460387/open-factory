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
export declare const DEFAULT_INFERENCE_CONFIG: InferenceConfig;
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
//# sourceMappingURL=inference-types.d.ts.map