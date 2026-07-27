import type { ColorGradingGraph, ColorGradingNode } from './types';
/** Uniform value that can be a scalar, array, or structured descriptor */
export type UniformValue = number | number[] | Float32Array | {
    type: string;
    value: number | number[] | Float32Array | null;
    [key: string]: unknown;
};
/** Node execution result */
export interface NodeExecutionResult {
    nodeId: string;
    uniforms: Record<string, UniformValue>;
    fragmentSnippets: string[];
}
/** Graph execution result */
export interface GraphExecutionResult {
    nodeResults: NodeExecutionResult[];
    combinedUniforms: Record<string, UniformValue>;
}
/** Graph validation error */
export type GraphValidationError = string;
/**
 * 调色节点图执行引擎
 *
 * 将调色节点图（ColorGradingGraph）编译为 WebGL uniform 值和 fragment shader 代码片段。
 * 支持拓扑排序、环检测、节点执行和 uniform 合并。
 *
 * @example
 * ```ts
 * const result = NodeGraphEngine.execute(graph);
 * // result.combinedUniforms 包含所有 uniform 值
 * // result.nodeResults 包含每个节点的 shader 代码片段
 * ```
 */
export declare class NodeGraphEngine {
    /**
     * 使用 Kahn 算法对节点图进行拓扑排序。
     * @param graph - 调色节点图
     * @returns 排序后的节点数组
     * @throws 如果检测到循环依赖则抛出错误
     */
    static topologicalSort(graph: ColorGradingGraph): ColorGradingNode[];
    /**
     * Execute the color grading node graph.
     */
    static execute(graph: ColorGradingGraph): GraphExecutionResult;
    /**
     * Execute a single node.
     */
    private static executeNode;
    private static executePrimaryWheel;
    private static executePrimarySlider;
    private static executeHSLQualifier;
    private static executeWindowMask;
    /**
     * Execute a curves node - generates a 256-entry LUT from curve control points.
     */
    private static executeCurves;
    /**
     * Execute a LUT apply node - returns sampler3D reference and intensity.
     */
    private static executeLUTApply;
    /**
     * Execute a tracking mask node - returns feather, expand, and invert uniforms.
     */
    private static executeTrackingMask;
    /**
     * Validate graph structure.
     */
    static validateGraph(graph: ColorGradingGraph): GraphValidationError[];
}
//# sourceMappingURL=node-graph-engine.d.ts.map