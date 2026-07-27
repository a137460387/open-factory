/**
 * AI inference engine — core orchestrator
 */
import type { ComputeBackend, QuantizationType, ModelType, InferenceConfig, TensorDescriptor, InferenceResult } from './inference-types.js';
export declare class InferenceEngine {
    private config;
    private webgpuBackend;
    private webgl2Backend;
    private fusionOptimizer;
    private asrAccelerator;
    private semanticAccelerator;
    private activeBackend;
    private initialized;
    constructor(config?: Partial<InferenceConfig>);
    initialize(): Promise<boolean>;
    infer(modelType: ModelType, input: TensorDescriptor): Promise<InferenceResult>;
    getBackend(): ComputeBackend;
    isGPUAccelerated(): boolean;
    getOptimizationReport(): {
        backend: ComputeBackend;
        quantization: QuantizationType;
        fusionSpeedup: number;
        gpuAccelerated: boolean;
    };
    destroy(): void;
    private inferASR;
    private inferSemantic;
    private inferVision;
    private inferLLM;
    private inferGeneric;
}
export declare function createInferenceEngine(config?: Partial<InferenceConfig>): InferenceEngine;
export declare function createDefaultInferenceEngine(): InferenceEngine;
export declare function createQuantizedInferenceEngine(quantization: QuantizationType): InferenceEngine;
//# sourceMappingURL=inference-engine-core.d.ts.map