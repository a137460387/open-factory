/**
 * AI inference engine — core orchestrator
 */

import type {
  ComputeBackend,
  QuantizationType,
  ModelType,
  InferenceConfig,
  TensorDescriptor,
  InferenceResult,
} from './inference-types.js';

import { DEFAULT_INFERENCE_CONFIG } from './inference-types.js';
import { WebGPUBackend, WebGL2Backend } from './inference-backends.js';
import { OperatorFusionOptimizer } from './inference-quantization.js';
import { ASRAccelerator, SemanticExtractorAccelerator } from './inference-accelerators.js';
import { logger } from '../utils/logger.js';

export class InferenceEngine {
  private config: InferenceConfig;
  private webgpuBackend: WebGPUBackend;
  private webgl2Backend: WebGL2Backend;
  private fusionOptimizer: OperatorFusionOptimizer;
  private asrAccelerator: ASRAccelerator | null = null;
  private semanticAccelerator: SemanticExtractorAccelerator | null = null;
  private activeBackend: WebGPUBackend | WebGL2Backend | null = null;
  private initialized = false;

  constructor(config: Partial<InferenceConfig> = {}) {
    this.config = { ...DEFAULT_INFERENCE_CONFIG, ...config };
    this.webgpuBackend = new WebGPUBackend();
    this.webgl2Backend = new WebGL2Backend();
    this.fusionOptimizer = new OperatorFusionOptimizer();
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

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

  async infer(
    modelType: ModelType,
    input: TensorDescriptor,
  ): Promise<InferenceResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    let output: TensorDescriptor;

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

  getBackend(): ComputeBackend {
    if (this.activeBackend instanceof WebGPUBackend) return 'webgpu';
    if (this.activeBackend instanceof WebGL2Backend) return 'webgl2';
    return 'cpu';
  }

  isGPUAccelerated(): boolean {
    return this.activeBackend !== null;
  }

  getOptimizationReport(): {
    backend: ComputeBackend;
    quantization: QuantizationType;
    fusionSpeedup: number;
    gpuAccelerated: boolean;
  } {
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

  destroy(): void {
    this.webgpuBackend.destroy();
    this.webgl2Backend.destroy();
    this.initialized = false;
  }

  private async inferASR(input: TensorDescriptor): Promise<TensorDescriptor> {
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

  private async inferSemantic(input: TensorDescriptor): Promise<TensorDescriptor> {
    if (this.semanticAccelerator) {
      const text = new TextDecoder().decode(input.data);
      const embedding = await this.semanticAccelerator.extractEmbedding(text);
      return {
        shape: [768],
        dtype: 'float32',
        data: embedding.buffer as ArrayBuffer,
      };
    }

    return this.inferGeneric(input);
  }

  private async inferVision(input: TensorDescriptor): Promise<TensorDescriptor> {
    return this.inferGeneric(input);
  }

  private async inferLLM(input: TensorDescriptor): Promise<TensorDescriptor> {
    return this.inferGeneric(input);
  }

  private async inferGeneric(_input: TensorDescriptor): Promise<TensorDescriptor> {
    throw new Error(
      'NotImplementedError: inferGeneric requires a loaded model. ' +
      'No GPU backend available and no CPU fallback model is configured.',
    );
  }
}

// ==================== Factory Functions ====================

export function createInferenceEngine(config?: Partial<InferenceConfig>): InferenceEngine {
  return new InferenceEngine(config);
}

export function createDefaultInferenceEngine(): InferenceEngine {
  return new InferenceEngine(DEFAULT_INFERENCE_CONFIG);
}

export function createQuantizedInferenceEngine(quantization: QuantizationType): InferenceEngine {
  return new InferenceEngine({ ...DEFAULT_INFERENCE_CONFIG, quantization });
}
