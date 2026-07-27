/**
 * AI inference engine — quantization tools and operator fusion optimizer
 */
import type { OperatorFusionPattern } from './inference-types.js';
export declare class QuantizationTool {
    static float32ToInt8(data: Float32Array): Int8Array;
    static int8ToFloat32(data: Int8Array, scale: number): Float32Array;
    static float32ToInt4(data: Float32Array): Uint8Array;
    static float32ToFloat16(data: Float32Array): Uint16Array;
    static float16ToFloat32(data: Uint16Array): Float32Array;
    private static float32ToFloat16Value;
    private static float16ToFloat32Value;
}
export declare class OperatorFusionOptimizer {
    private fusionPatterns;
    optimize(operators: string[]): {
        fused: string[];
        speedup: number;
    };
    getFusionPattern(name: string): OperatorFusionPattern | undefined;
    addFusionPattern(pattern: OperatorFusionPattern): void;
    private arraysEqual;
}
//# sourceMappingURL=inference-quantization.d.ts.map