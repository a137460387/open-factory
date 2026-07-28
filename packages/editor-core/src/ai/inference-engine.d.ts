/**
 * AI inference engine — barrel re-export
 *
 * All implementation has been split into focused modules:
 * - inference-types.ts: Type definitions and constants
 * - inference-backends.ts: WebGPU and WebGL2 backends
 * - inference-quantization.ts: Quantization tools and operator fusion
 * - inference-accelerators.ts: ASR and semantic extraction accelerators
 * - inference-engine-core.ts: Main inference engine orchestrator
 */
export type { ComputeBackend, QuantizationType, ModelType, InferenceConfig, TensorDescriptor, InferenceResult, OperatorFusionPattern, } from './inference-types.js';
export { DEFAULT_INFERENCE_CONFIG } from './inference-types.js';
export { WebGPUBackend, WebGL2Backend } from './inference-backends.js';
export { QuantizationTool, OperatorFusionOptimizer } from './inference-quantization.js';
export { ASRAccelerator, SemanticExtractorAccelerator } from './inference-accelerators.js';
export { InferenceEngine, createInferenceEngine, createDefaultInferenceEngine, createQuantizedInferenceEngine, } from './inference-engine-core.js';
//# sourceMappingURL=inference-engine.d.ts.map