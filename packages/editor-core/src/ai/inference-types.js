/**
 * AI inference engine — type definitions and constants
 */
export const DEFAULT_INFERENCE_CONFIG = {
    backend: 'webgpu',
    quantization: 'fp16',
    batchSize: 1,
    maxSequenceLength: 512,
    enableOperatorFusion: true,
    enableMemoryMapping: true,
    warmupIterations: 3,
};
//# sourceMappingURL=inference-types.js.map