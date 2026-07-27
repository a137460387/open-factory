/**
 * AI inference engine — core orchestrator
 */
import { DEFAULT_INFERENCE_CONFIG } from './inference-types.js';
import { WebGPUBackend, WebGL2Backend } from './inference-backends.js';
import { OperatorFusionOptimizer } from './inference-quantization.js';
import { ASRAccelerator, SemanticExtractorAccelerator } from './inference-accelerators.js';
import { logger } from '../utils/logger.js';
export class InferenceEngine {
    config;
    webgpuBackend;
    webgl2Backend;
    fusionOptimizer;
    asrAccelerator = null;
    semanticAccelerator = null;
    activeBackend = null;
    initialized = false;
    constructor(config = {}) {
        this.config = { ...DEFAULT_INFERENCE_CONFIG, ...config };
        this.webgpuBackend = new WebGPUBackend();
        this.webgl2Backend = new WebGL2Backend();
        this.fusionOptimizer = new OperatorFusionOptimizer();
    }
    async initialize() {
        if (this.initialized)
            return true;
        // Try WebGPU first
        if (this.config.backend === 'webgpu' || this.config.backend === 'auto') {
            const webgpuAvailable = await this.webgpuBackend.initialize();
            if (webgpuAvailable) {
                this.activeBackend = this.webgpuBackend;
                logger.debug('Using WebGPU backend');
            }
        }
        // Fallback to WebGL2
        if (!this.activeBackend) {
            const webgl2Available = await this.webgl2Backend.initialize();
            if (webgl2Available) {
                this.activeBackend = this.webgl2Backend;
                logger.debug('Using WebGL2 backend');
            }
        }
        if (!this.activeBackend) {
            logger.warn('No GPU backend available, using CPU');
            this.activeBackend = null;
        }
        // Initialize accelerators
        if (this.activeBackend) {
            this.asrAccelerator = new ASRAccelerator(this.activeBackend);
            this.semanticAccelerator = new SemanticExtractorAccelerator(this.activeBackend);
            await this.asrAccelerator.initialize();
            await this.semanticAccelerator.initialize();
        }
        this.initialized = true;
        return true;
    }
    async infer(modelType, input) {
        if (!this.initialized) {
            await this.initialize();
        }
        const startTime = performance.now();
        let output;
        switch (modelType) {
            case 'asr':
                output = await this.inferASR(input);
                break;
            case 'semantic':
                output = await this.inferSemantic(input);
                break;
            case 'vision':
                output = await this.inferVision(input);
                break;
            case 'llm':
                output = await this.inferLLM(input);
                break;
            default:
                output = await this.inferGeneric(input);
        }
        const inferenceTime = performance.now() - startTime;
        return {
            output,
            inferenceTimeMs: inferenceTime,
            backend: this.activeBackend instanceof WebGPUBackend ? 'webgpu' : 'webgl2',
            quantization: this.config.quantization,
            memoryUsedBytes: output.data.byteLength,
        };
    }
    getBackend() {
        if (this.activeBackend instanceof WebGPUBackend)
            return 'webgpu';
        if (this.activeBackend instanceof WebGL2Backend)
            return 'webgl2';
        return 'cpu';
    }
    isGPUAccelerated() {
        return this.activeBackend !== null;
    }
    getOptimizationReport() {
        const { speedup } = this.fusionOptimizer.optimize([
            'conv2d', 'batchNorm', 'relu', 'matmul', 'add', 'relu',
        ]);
        return {
            backend: this.getBackend(),
            quantization: this.config.quantization,
            fusionSpeedup: speedup,
            gpuAccelerated: this.isGPUAccelerated(),
        };
    }
    destroy() {
        this.webgpuBackend.destroy();
        this.webgl2Backend.destroy();
        this.initialized = false;
    }
    async inferASR(input) {
        if (this.asrAccelerator) {
            const audioData = new Float32Array(input.data);
            const result = await this.asrAccelerator.transcribe(audioData);
            return {
                shape: [result.length],
                dtype: 'float32',
                data: new TextEncoder().encode(result).buffer,
            };
        }
        return this.inferGeneric(input);
    }
    async inferSemantic(input) {
        if (this.semanticAccelerator) {
            const text = new TextDecoder().decode(input.data);
            const embedding = await this.semanticAccelerator.extractEmbedding(text);
            return {
                shape: [768],
                dtype: 'float32',
                data: embedding.buffer,
            };
        }
        return this.inferGeneric(input);
    }
    async inferVision(input) {
        return this.inferGeneric(input);
    }
    async inferLLM(input) {
        return this.inferGeneric(input);
    }
    async inferGeneric(_input) {
        throw new Error('NotImplementedError: inferGeneric requires a loaded model. ' +
            'No GPU backend available and no CPU fallback model is configured.');
    }
}
// ==================== Factory Functions ====================
export function createInferenceEngine(config) {
    return new InferenceEngine(config);
}
export function createDefaultInferenceEngine() {
    return new InferenceEngine(DEFAULT_INFERENCE_CONFIG);
}
export function createQuantizedInferenceEngine(quantization) {
    return new InferenceEngine({ ...DEFAULT_INFERENCE_CONFIG, quantization });
}
//# sourceMappingURL=inference-engine-core.js.map