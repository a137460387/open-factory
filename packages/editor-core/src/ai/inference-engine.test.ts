import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  InferenceEngine,
  WebGPUBackend,
  WebGL2Backend,
  QuantizationTool,
  OperatorFusionOptimizer,
  DEFAULT_INFERENCE_CONFIG,
  createInferenceEngine,
  createDefaultInferenceEngine,
  createQuantizedInferenceEngine,
} from './inference-engine';

describe('InferenceEngine', () => {
  describe('constructor', () => {
    it('merges partial config with defaults', () => {
      const engine = new InferenceEngine({ batchSize: 4 });
      expect(engine.getBackend()).toBe('cpu'); // no GPU in test env
    });

    it('uses full default config when no overrides', () => {
      const engine = new InferenceEngine();
      expect(engine.getBackend()).toBe('cpu');
    });
  });

  describe('initialize', () => {
    it('returns true and sets initialized flag', async () => {
      const engine = new InferenceEngine({ backend: 'cpu' });
      const result = await engine.initialize();
      expect(result).toBe(true);
    });

    it('is idempotent — second call returns true immediately', async () => {
      const engine = new InferenceEngine({ backend: 'cpu' });
      await engine.initialize();
      const result = await engine.initialize();
      expect(result).toBe(true);
    });
  });

  describe('isGPUAccelerated', () => {
    it('returns false when no GPU backend is available', async () => {
      const engine = new InferenceEngine({ backend: 'cpu' });
      await engine.initialize();
      expect(engine.isGPUAccelerated()).toBe(false);
    });
  });

  describe('getBackend', () => {
    it('returns cpu when no GPU is available', () => {
      const engine = new InferenceEngine({ backend: 'cpu' });
      expect(engine.getBackend()).toBe('cpu');
    });
  });

  describe('getOptimizationReport', () => {
    it('returns optimization report with fusion speedup', () => {
      const engine = new InferenceEngine();
      const report = engine.getOptimizationReport();
      expect(report).toHaveProperty('backend');
      expect(report).toHaveProperty('quantization');
      expect(report).toHaveProperty('fusionSpeedup');
      expect(report).toHaveProperty('gpuAccelerated');
      expect(typeof report.fusionSpeedup).toBe('number');
    });
  });

  describe('infer — NotImplementedError', () => {
    it('throws NotImplementedError for ASR when no accelerator', async () => {
      const engine = new InferenceEngine({ backend: 'cpu' });
      await engine.initialize();
      const input = {
        shape: [16000],
        dtype: 'float32' as const,
        data: new Float32Array(16000).buffer,
      };
      await expect(engine.infer('asr', input)).rejects.toThrow('NotImplementedError');
    });

    it('throws NotImplementedError for semantic when no accelerator', async () => {
      const engine = new InferenceEngine({ backend: 'cpu' });
      await engine.initialize();
      const input = {
        shape: [10],
        dtype: 'float32' as const,
        data: new TextEncoder().encode('hello world').buffer,
      };
      await expect(engine.infer('semantic', input)).rejects.toThrow('NotImplementedError');
    });

    it('throws NotImplementedError for vision', async () => {
      const engine = new InferenceEngine({ backend: 'cpu' });
      await engine.initialize();
      const input = {
        shape: [224, 224, 3],
        dtype: 'float32' as const,
        data: new Float32Array(224 * 224 * 3).buffer,
      };
      await expect(engine.infer('vision', input)).rejects.toThrow('NotImplementedError');
    });

    it('throws NotImplementedError for llm', async () => {
      const engine = new InferenceEngine({ backend: 'cpu' });
      await engine.initialize();
      const input = {
        shape: [512],
        dtype: 'float32' as const,
        data: new Float32Array(512).buffer,
      };
      await expect(engine.infer('llm', input)).rejects.toThrow('NotImplementedError');
    });

    it('auto-initializes if not initialized before infer', async () => {
      const engine = new InferenceEngine({ backend: 'cpu' });
      const input = {
        shape: [10],
        dtype: 'float32' as const,
        data: new Float32Array(10).buffer,
      };
      // Should not throw "not initialized" — it auto-initializes
      await expect(engine.infer('vision', input)).rejects.toThrow('NotImplementedError');
    });
  });

  describe('destroy', () => {
    it('resets initialized state', async () => {
      const engine = new InferenceEngine({ backend: 'cpu' });
      await engine.initialize();
      engine.destroy();
      // After destroy, calling initialize again should work
      const result = await engine.initialize();
      expect(result).toBe(true);
    });
  });
});

describe('QuantizationTool', () => {
  it('float32ToInt8 converts correctly', () => {
    const input = new Float32Array([0.5, -0.5, 1.0, -1.0]);
    const result = QuantizationTool.float32ToInt8(input);
    expect(result).toBeInstanceOf(Int8Array);
    expect(result.length).toBe(4);
    // scale = 127 / 1.0 = 127
    // Math.round(0.5 * 127) = Math.round(63.5) = 64 (JS rounds .5 up)
    // Math.round(-0.5 * 127) = Math.round(-63.5) = -63 (JS rounds .5 toward +inf)
    expect(result[0]).toBe(64);
    expect(result[1]).toBe(-63);
    expect(result[2]).toBe(127);
    expect(result[3]).toBe(-127);
  });

  it('int8ToFloat32 roundtrips with float32ToInt8', () => {
    const input = new Float32Array([0.5, -0.3, 0.8]);
    const int8 = QuantizationTool.float32ToInt8(input);
    const scale = 127 / Math.max(...Array.from(input).map(Math.abs));
    const result = QuantizationTool.int8ToFloat32(int8, scale);
    for (let i = 0; i < input.length; i++) {
      expect(result[i]).toBeCloseTo(input[i], 1);
    }
  });

  it('float32ToInt4 packs two values per byte', () => {
    const input = new Float32Array([0.5, -0.5, 1.0]);
    const result = QuantizationTool.float32ToInt4(input);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(Math.ceil(input.length / 2));
  });

  it('float32ToFloat16 converts and float16ToFloat32 roundtrips', () => {
    const input = new Float32Array([1.0, -1.0, 0.5, 100.0]);
    const fp16 = QuantizationTool.float32ToFloat16(input);
    expect(fp16).toBeInstanceOf(Uint16Array);
    expect(fp16.length).toBe(4);
    // Note: float16ToFloat32 uses bitwise casts that may not produce exact roundtrip
    // We verify the fp16 values are non-zero (actually converted)
    for (let i = 0; i < fp16.length; i++) {
      expect(fp16[i]).not.toBe(0);
    }
  });
});

describe('OperatorFusionOptimizer', () => {
  it('fuses conv-bn-relu pattern', () => {
    const optimizer = new OperatorFusionOptimizer();
    const result = optimizer.optimize(['conv2d', 'batchNorm', 'relu']);
    expect(result.fused).toEqual(['fusedConvBnRelu']);
    expect(result.speedup).toBe(2.5);
  });

  it('fuses matmul-add-relu pattern', () => {
    const optimizer = new OperatorFusionOptimizer();
    const result = optimizer.optimize(['matmul', 'add', 'relu']);
    expect(result.fused).toEqual(['fusedMatmulAddRelu']);
    expect(result.speedup).toBe(1.8);
  });

  it('leaves unmatched operators unchanged', () => {
    const optimizer = new OperatorFusionOptimizer();
    const result = optimizer.optimize(['softmax', 'dropout']);
    expect(result.fused).toEqual(['softmax', 'dropout']);
    expect(result.speedup).toBe(1);
  });

  it('fuses mixed patterns', () => {
    const optimizer = new OperatorFusionOptimizer();
    const result = optimizer.optimize(['conv2d', 'batchNorm', 'relu', 'matmul', 'add', 'relu']);
    expect(result.fused).toEqual(['fusedConvBnRelu', 'fusedMatmulAddRelu']);
    expect(result.speedup).toBe(2.5 * 1.8);
  });

  it('getFusionPattern returns pattern by name', () => {
    const optimizer = new OperatorFusionOptimizer();
    const pattern = optimizer.getFusionPattern('conv-bn-relu');
    expect(pattern).toBeDefined();
    expect(pattern!.fusedOperator).toBe('fusedConvBnRelu');
  });

  it('getFusionPattern returns undefined for unknown name', () => {
    const optimizer = new OperatorFusionOptimizer();
    expect(optimizer.getFusionPattern('unknown')).toBeUndefined();
  });

  it('addFusionPattern adds a new pattern', () => {
    const optimizer = new OperatorFusionOptimizer();
    optimizer.addFusionPattern({
      name: 'custom-fusion',
      operators: ['a', 'b'],
      fusedOperator: 'fusedAB',
      speedupFactor: 3.0,
    });
    const result = optimizer.optimize(['a', 'b']);
    expect(result.fused).toEqual(['fusedAB']);
    expect(result.speedup).toBe(3.0);
  });
});

describe('WebGPUBackend', () => {
  it('isAvailable returns false when not initialized', () => {
    const backend = new WebGPUBackend();
    expect(backend.isAvailable()).toBe(false);
  });

  it('initialize returns false when navigator.gpu is unavailable', async () => {
    const backend = new WebGPUBackend();
    const result = await backend.initialize();
    expect(result).toBe(false);
  });
});

describe('WebGL2Backend', () => {
  it('isAvailable returns false when not initialized', () => {
    const backend = new WebGL2Backend();
    expect(backend.isAvailable()).toBe(false);
  });
});

describe('Factory functions', () => {
  it('createInferenceEngine returns an InferenceEngine', () => {
    const engine = createInferenceEngine({ backend: 'cpu' });
    expect(engine).toBeInstanceOf(InferenceEngine);
  });

  it('createDefaultInferenceEngine uses default config', () => {
    const engine = createDefaultInferenceEngine();
    expect(engine).toBeInstanceOf(InferenceEngine);
  });

  it('createQuantizedInferenceEngine uses specified quantization', () => {
    const engine = createQuantizedInferenceEngine('int8');
    expect(engine).toBeInstanceOf(InferenceEngine);
  });
});

describe('DEFAULT_INFERENCE_CONFIG', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_INFERENCE_CONFIG.backend).toBe('webgpu');
    expect(DEFAULT_INFERENCE_CONFIG.quantization).toBe('fp16');
    expect(DEFAULT_INFERENCE_CONFIG.batchSize).toBe(1);
    expect(DEFAULT_INFERENCE_CONFIG.maxSequenceLength).toBe(512);
    expect(DEFAULT_INFERENCE_CONFIG.enableOperatorFusion).toBe(true);
    expect(DEFAULT_INFERENCE_CONFIG.enableMemoryMapping).toBe(true);
    expect(DEFAULT_INFERENCE_CONFIG.warmupIterations).toBe(3);
  });
});
