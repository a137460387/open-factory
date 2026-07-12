import type { ColorGradingGraph, ColorNode, ColorNodeParams } from './types';

/** Node execution result */
export interface NodeExecutionResult {
  nodeId: string;
  uniforms: Record<string, number | number[]>;
  fragmentSnippets: string[];
}

/** Graph execution result */
export interface GraphExecutionResult {
  nodeResults: NodeExecutionResult[];
  combinedUniforms: Record<string, number | number[]>;
}

/** Graph validation error */
export type GraphValidationError = string;

export class NodeGraphEngine {
  /**
   * Topological sort of nodes using Kahn's algorithm.
   * @throws if a cycle is detected
   */
  static topologicalSort(graph: ColorGradingGraph): ColorNode[] {
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

    const sorted: ColorNode[] = [];
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
    const combinedUniforms: Record<string, number | number[]> = {};

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
    node: ColorNode,
    _previousResults: NodeExecutionResult[]
  ): NodeExecutionResult {
    switch (node.type) {
      case 'primary-wheel':
        return this.executePrimaryWheel(node);
      case 'primary-slider':
        return this.executePrimarySlider(node);
      default:
        return { nodeId: node.id, uniforms: {}, fragmentSnippets: [] };
    }
  }

  private static executePrimaryWheel(node: ColorNode): NodeExecutionResult {
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

  private static executePrimarySlider(node: ColorNode): NodeExecutionResult {
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
