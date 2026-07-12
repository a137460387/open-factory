import type { ColorGradingGraph, ColorGradingNode, ColorGradingNodeParams, CurvesNodeParams, LUTApplyNodeParams, TrackingMaskNodeParams } from './types';
import { sampleCurve } from './color-curves';

/** Uniform value that can be a scalar, array, or structured descriptor */
export type UniformValue =
  | number
  | number[]
  | Float32Array
  | { type: string; value: number | number[] | Float32Array | null; [key: string]: unknown };

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

export class NodeGraphEngine {
  /**
   * Topological sort of nodes using Kahn's algorithm.
   * @throws if a cycle is detected
   */
  static topologicalSort(graph: ColorGradingGraph): ColorGradingNode[] {
    const { nodes, connections } = graph;
    if (nodes.length === 0) return [];

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    // Build adjacency list and in-degree map
    for (const conn of connections) {
      if (nodeMap.has(conn.fromNodeId) && nodeMap.has(conn.toNodeId)) {
        adjacency.get(conn.fromNodeId)!.push(conn.toNodeId);
        inDegree.set(conn.toNodeId, (inDegree.get(conn.toNodeId) || 0) + 1);
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const sorted: ColorGradingNode[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      sorted.push(nodeMap.get(id)!);
      for (const neighbor of adjacency.get(id) || []) {
        const newDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (sorted.length !== nodes.length) {
      throw new Error('Cycle detected in color grading node graph');
    }

    return sorted;
  }

  /**
   * Execute the color grading node graph.
   */
  static execute(graph: ColorGradingGraph): GraphExecutionResult {
    const enabledNodes = graph.nodes.filter(n => n.enabled);
    if (enabledNodes.length === 0) {
      return { nodeResults: [], combinedUniforms: {} };
    }

    const enabledGraph: ColorGradingGraph = {
      ...graph,
      nodes: enabledNodes,
      connections: graph.connections.filter(c => {
        const fromEnabled = enabledNodes.some(n => n.id === c.fromNodeId);
        const toEnabled = enabledNodes.some(n => n.id === c.toNodeId);
        return fromEnabled && toEnabled;
      }),
    };

    const sorted = this.topologicalSort(enabledGraph);
    const nodeResults: NodeExecutionResult[] = [];
    const combinedUniforms: Record<string, UniformValue> = {};

    for (const node of sorted) {
      const result = this.executeNode(node, nodeResults);
      nodeResults.push(result);

      // Merge uniforms
      Object.assign(combinedUniforms, result.uniforms);
    }

    return { nodeResults, combinedUniforms };
  }

  /**
   * Execute a single node.
   */
  private static executeNode(
    node: ColorGradingNode,
    _previousResults: NodeExecutionResult[]
  ): NodeExecutionResult {
    switch (node.type) {
      case 'primary-wheel':
        return this.executePrimaryWheel(node);
      case 'primary-slider':
        return this.executePrimarySlider(node);
      case 'hsl-qualifier':
        return this.executeHSLQualifier(node);
      case 'window-mask':
        return this.executeWindowMask(node);
      case 'curves':
        return this.executeCurves(node);
      case 'lut-apply':
        return this.executeLUTApply(node);
      case 'tracking-mask':
        return this.executeTrackingMask(node);
      case 'output':
      case 'color-space':
      case 'mixer-node':
        // Auxiliary nodes do not generate shader code
        return { nodeId: node.id, uniforms: {}, fragmentSnippets: [] };
      default:
        return { nodeId: node.id, uniforms: {}, fragmentSnippets: [] };
    }
  }

  private static executePrimaryWheel(node: ColorGradingNode): NodeExecutionResult {
    const p = node.params as any;
    const prefix = `cg_${node.id.replace(/-/g, '_')}`;

    return {
      nodeId: node.id,
      uniforms: {
        [`${prefix}_lift`]: [p.lift.r, p.lift.g, p.lift.b, p.liftMaster],
        [`${prefix}_gamma`]: [p.gamma.r, p.gamma.g, p.gamma.b, p.gammaMaster],
        [`${prefix}_gain`]: [p.gain.r, p.gain.g, p.gain.b, p.gainMaster],
        [`${prefix}_offset`]: [p.offset.r, p.offset.g, p.offset.b, p.offsetMaster],
      },
      fragmentSnippets: [
        `// Primary Wheel: ${node.id}`,
        `color = applyLiftGammaGain(color, ${prefix}_lift, ${prefix}_gamma, ${prefix}_gain, ${prefix}_offset);`,
      ],
    };
  }

  private static executePrimarySlider(node: ColorGradingNode): NodeExecutionResult {
    const p = node.params as any;
    const prefix = `cg_${node.id.replace(/-/g, '_')}`;

    return {
      nodeId: node.id,
      uniforms: {
        [`${prefix}_temperature`]: p.temperature / 100,
        [`${prefix}_tint`]: p.tint / 100,
        [`${prefix}_contrast`]: p.contrast / 100,
        [`${prefix}_pivot`]: p.pivot,
        [`${prefix}_saturation`]: p.saturation / 100,
        [`${prefix}_hue`]: (p.hue / 180) * 3.14159,
      },
      fragmentSnippets: [
        `// Primary Slider: ${node.id}`,
        `color = applyTemperatureTint(color, ${prefix}_temperature, ${prefix}_tint);`,
        `color = applyContrast(color, ${prefix}_contrast, ${prefix}_pivot);`,
        `color = applySaturation(color, ${prefix}_saturation);`,
        `color = applyHueRotation(color, ${prefix}_hue);`,
      ],
    };
  }

  private static executeHSLQualifier(node: ColorGradingNode): NodeExecutionResult {
    const p = node.params as any;
    const prefix = `cg_${node.id.replace(/-/g, '_')}`;

    return {
      nodeId: node.id,
      uniforms: {
        [`${prefix}_hueRange`]: [p.hueRange.center, p.hueRange.width, p.hueRange.softness],
        [`${prefix}_satRange`]: [p.saturationRange.min, p.saturationRange.max, p.saturationRange.softness],
        [`${prefix}_lumRange`]: [p.luminanceRange.min, p.luminanceRange.max, p.luminanceRange.softness],
        [`${prefix}_adjustments1`]: [p.adjustments.hueShift, p.adjustments.saturation, p.adjustments.brightness],
        [`${prefix}_adjustments2`]: [p.adjustments.contrast, p.adjustments.temperature, p.adjustments.tint],
        [`${prefix}_matteClean`]: p.matteClean,
      },
      fragmentSnippets: [
        `// HSL Qualifier: ${node.id}`,
        `{`,
        `  vec3 hsl = rgbToHsl(color.rgb);`,
        `  color = applyHSLQualifier(color, hsl);`,
        `}`,
      ],
    };
  }

  private static executeWindowMask(node: ColorGradingNode): NodeExecutionResult {
    const p = node.params as any;
    const prefix = `cg_${node.id.replace(/-/g, '_')}`;

    if (p.shape === 'circle') {
      return {
        nodeId: node.id,
        uniforms: {
          [`${prefix}_center`]: [p.circle.center.x, p.circle.center.y],
          [`${prefix}_radius`]: p.circle.radius,
          [`${prefix}_softness`]: p.circle.softness,
          [`${prefix}_invert`]: p.invert ? 1.0 : 0.0,
        },
        fragmentSnippets: [
          `// Circle Mask: ${node.id}`,
          `color *= circleMask(v_uv);`,
        ],
      };
    }

    if (p.shape === 'linear-gradient') {
      return {
        nodeId: node.id,
        uniforms: {
          [`${prefix}_start`]: [p.linearGradient.startPoint.x, p.linearGradient.startPoint.y],
          [`${prefix}_end`]: [p.linearGradient.endPoint.x, p.linearGradient.endPoint.y],
          [`${prefix}_softness`]: p.linearGradient.softness,
          [`${prefix}_invert`]: p.invert ? 1.0 : 0.0,
        },
        fragmentSnippets: [
          `// Gradient Mask: ${node.id}`,
          `color *= gradientMask(v_uv);`,
        ],
      };
    }

    // Polygon mask not yet supported in WebGL
    return { nodeId: node.id, uniforms: {}, fragmentSnippets: [] };
  }

  /**
   * Execute a curves node - generates a 256-entry LUT from curve control points.
   */
  private static executeCurves(node: ColorGradingNode): NodeExecutionResult {
    const p = node.params as CurvesNodeParams;
    const lutData = new Float32Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      const x = i / 255;
      lutData[i * 4] = sampleCurve(p.red, x);
      lutData[i * 4 + 1] = sampleCurve(p.green, x);
      lutData[i * 4 + 2] = sampleCurve(p.blue, x);
      lutData[i * 4 + 3] = sampleCurve(p.master, x);
    }
    return {
      nodeId: node.id,
      uniforms: {
        [`u_curvesLUT_${node.id}`]: { type: 'sampler2D', value: lutData, width: 256, height: 1 },
      },
      fragmentSnippets: [`color = applyCurves_${node.id}(color);`],
    };
  }

  /**
   * Execute a LUT apply node - returns sampler3D reference and intensity.
   */
  private static executeLUTApply(node: ColorGradingNode): NodeExecutionResult {
    const p = node.params as LUTApplyNodeParams;
    return {
      nodeId: node.id,
      uniforms: {
        [`u_lut3D_${node.id}`]: { type: 'sampler3D', value: null, lutId: p.lutId },
        [`u_lutIntensity_${node.id}`]: { type: '1f', value: p.intensity },
      },
      fragmentSnippets: [`color = applyLUT_${node.id}(color);`],
    };
  }

  /**
   * Execute a tracking mask node - returns feather, expand, and invert uniforms.
   */
  private static executeTrackingMask(node: ColorGradingNode): NodeExecutionResult {
    const p = node.params as TrackingMaskNodeParams;
    return {
      nodeId: node.id,
      uniforms: {
        [`u_trackingMaskFeather_${node.id}`]: { type: '1f', value: p.feather },
        [`u_trackingMaskExpand_${node.id}`]: { type: '1f', value: p.expand },
        [`u_trackingMaskInvert_${node.id}`]: { type: '1i', value: p.invert ? 1 : 0 },
      },
      fragmentSnippets: [`color = applyTrackingMask_${node.id}(color, v_texCoord);`],
    };
  }

  /**
   * Validate graph structure.
   */
  static validateGraph(graph: ColorGradingGraph): GraphValidationError[] {
    const errors: GraphValidationError[] = [];
    const nodeIds = new Set<string>();

    // Check duplicate IDs
    for (const node of graph.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);
    }

    // Check dangling connections
    for (const conn of graph.connections) {
      if (!nodeIds.has(conn.fromNodeId)) {
        errors.push(`Connection references non-existent from node: ${conn.fromNodeId}`);
      }
      if (!nodeIds.has(conn.toNodeId)) {
        errors.push(`Connection references non-existent to node: ${conn.toNodeId}`);
      }
    }

    // Check self-connections
    for (const conn of graph.connections) {
      if (conn.fromNodeId === conn.toNodeId) {
        errors.push(`Self-connection detected on node: ${conn.fromNodeId}`);
      }
    }

    return errors;
  }
}
