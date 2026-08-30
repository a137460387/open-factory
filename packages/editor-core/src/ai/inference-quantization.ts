/**
 * AI inference engine — quantization tools and operator fusion optimizer
 */

import type { OperatorFusionPattern } from './inference-types.js';

// ==================== Quantization Tool ====================

export class QuantizationTool {
  static float32ToInt8(data: Float32Array): Int8Array {
    const result = new Int8Array(data.length);
    let maxAbs = 0;

    for (let i = 0; i < data.length; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(data[i]));
    }

    const scale = 127 / maxAbs;

    for (let i = 0; i < data.length; i++) {
      result[i] = Math.round(data[i] * scale);
    }

    return result;
  }

  static int8ToFloat32(data: Int8Array, scale: number): Float32Array {
    const result = new Float32Array(data.length);

    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] / scale;
    }

    return result;
  }

  static float32ToInt4(data: Float32Array): Uint8Array {
    const result = new Uint8Array(Math.ceil(data.length / 2));
    let maxAbs = 0;

    for (let i = 0; i < data.length; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(data[i]));
    }

    const scale = 7 / maxAbs;

    for (let i = 0; i < data.length; i += 2) {
      const val1 = Math.round(data[i] * scale) + 8;
      const val2 = i + 1 < data.length ? Math.round(data[i + 1] * scale) + 8 : 0;
      result[i / 2] = (val1 & 0x0f) | ((val2 & 0x0f) << 4);
    }

    return result;
  }

  static float32ToFloat16(data: Float32Array): Uint16Array {
    const result = new Uint16Array(data.length);

    for (let i = 0; i < data.length; i++) {
      result[i] = QuantizationTool.float32ToFloat16Value(data[i]);
    }

    return result;
  }

  static float16ToFloat32(data: Uint16Array): Float32Array {
    const result = new Float32Array(data.length);

    for (let i = 0; i < data.length; i++) {
      result[i] = QuantizationTool.float16ToFloat32Value(data[i]);
    }

    return result;
  }

  private static float32ToFloat16Value(value: number): number {
    const float32 = new Float32Array(1);
    const int32 = new Int32Array(float32.buffer);
    float32[0] = value;
    const f = int32[0];

    const sign = (f >> 16) & 0x8000;
    const exponent = ((f >> 23) & 0xff) - 127 + 15;
    const mantissa = f & 0x7fffff;

    if (exponent <= 0) {
      return sign;
    } else if (exponent >= 31) {
      return sign | 0x7c00;
    }

    return sign | (exponent << 10) | (mantissa >> 13);
  }

  private static float16ToFloat32Value(value: number): number {
    const sign = (value & 0x8000) << 16;
    const exponent = (value & 0x7c00) >> 10;
    const mantissa = value & 0x03ff;

    if (exponent === 0) {
      return (sign | (mantissa << 13)) >>> 0;
    } else if (exponent === 31) {
      return (sign | 0x7f800000 | (mantissa << 13)) >>> 0;
    }

    return (sign | ((exponent + 112) << 23) | (mantissa << 13)) >>> 0;
  }
}

// ==================== Operator Fusion Optimizer ====================

export class OperatorFusionOptimizer {
  private fusionPatterns: OperatorFusionPattern[] = [
    {
      name: 'conv-bn-relu',
      operators: ['conv2d', 'batchNorm', 'relu'],
      fusedOperator: 'fusedConvBnRelu',
      speedupFactor: 2.5,
    },
    {
      name: 'matmul-add-relu',
      operators: ['matmul', 'add', 'relu'],
      fusedOperator: 'fusedMatmulAddRelu',
      speedupFactor: 1.8,
    },
    {
      name: 'layernorm-gelu',
      operators: ['layerNorm', 'gelu'],
      fusedOperator: 'fusedLayerNormGelu',
      speedupFactor: 1.5,
    },
  ];

  optimize(operators: string[]): { fused: string[]; speedup: number } {
    const result: string[] = [];
    let totalSpeedup = 1;
    let i = 0;

    while (i < operators.length) {
      let matched = false;

      for (const pattern of this.fusionPatterns) {
        const patternLen = pattern.operators.length;
        const slice = operators.slice(i, i + patternLen);

        if (this.arraysEqual(slice, pattern.operators)) {
          result.push(pattern.fusedOperator);
          totalSpeedup *= pattern.speedupFactor;
          i += patternLen;
          matched = true;
          break;
        }
      }

      if (!matched) {
        result.push(operators[i]);
        i++;
      }
    }

    return { fused: result, speedup: totalSpeedup };
  }

  getFusionPattern(name: string): OperatorFusionPattern | undefined {
    return this.fusionPatterns.find((p) => p.name === name);
  }

  addFusionPattern(pattern: OperatorFusionPattern): void {
    this.fusionPatterns.push(pattern);
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }
}
