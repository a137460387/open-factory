import { describe, it, expect } from 'vitest';
import { NodeGraphEngine } from '../../src/color-grading/node-graph-engine';
import { createColorNode, createEmptyColorGradingGraph } from '../../src/color-grading/types';
import type { ColorGradingGraph } from '../../src/color-grading/types';

describe('NodeGraphEngine.topologicalSort', () => {
  it('should return empty array for empty graph', () => {
    const graph = createEmptyColorGradingGraph();
    const sorted = NodeGraphEngine.topologicalSort(graph);
    expect(sorted).toEqual([]);
  });

  it('should sort single node', () => {
    const node = createColorNode('primary-wheel');
    const graph: ColorGradingGraph = {
      nodes: [node],
      connections: [],
      activeNodeId: node.id,
    };
    const sorted = NodeGraphEngine.topologicalSort(graph);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe(node.id);
  });

  it('should sort nodes in dependency order', () => {
    const node1 = createColorNode('primary-wheel', { x: 0, y: 0 });
    const node2 = createColorNode('primary-slider', { x: 200, y: 0 });
    const node3 = createColorNode('output', { x: 400, y: 0 });

    const graph: ColorGradingGraph = {
      nodes: [node3, node1, node2], // intentionally out of order
      connections: [
        { id: 'c1', fromNodeId: node1.id, fromOutput: 'out', toNodeId: node2.id, toInput: 'in' },
        { id: 'c2', fromNodeId: node2.id, fromOutput: 'out', toNodeId: node3.id, toInput: 'in' },
      ],
      activeNodeId: null,
    };

    const sorted = NodeGraphEngine.topologicalSort(graph);
    const ids = sorted.map(n => n.id);
    expect(ids.indexOf(node1.id)).toBeLessThan(ids.indexOf(node2.id));
    expect(ids.indexOf(node2.id)).toBeLessThan(ids.indexOf(node3.id));
  });

  it('should detect cycles', () => {
    const node1 = createColorNode('primary-wheel');
    const node2 = createColorNode('primary-slider');

    const graph: ColorGradingGraph = {
      nodes: [node1, node2],
      connections: [
        { id: 'c1', fromNodeId: node1.id, fromOutput: 'out', toNodeId: node2.id, toInput: 'in' },
        { id: 'c2', fromNodeId: node2.id, fromOutput: 'out', toNodeId: node1.id, toInput: 'in' },
      ],
      activeNodeId: null,
    };

    expect(() => NodeGraphEngine.topologicalSort(graph)).toThrow('Cycle detected');
  });
});

describe('NodeGraphEngine.execute', () => {
  it('should return empty result for empty graph', () => {
    const graph = createEmptyColorGradingGraph();
    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toEqual([]);
    expect(result.combinedUniforms).toEqual({});
  });

  it('should execute single primary-wheel node', () => {
    const node = createColorNode('primary-wheel');
    (node.params as any).lift.r = 0.5;

    const graph: ColorGradingGraph = {
      nodes: [node],
      connections: [],
      activeNodeId: node.id,
    };

    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(1);
    expect(result.nodeResults[0].nodeId).toBe(node.id);
    expect(result.nodeResults[0].uniforms).toBeDefined();
  });

  it('should chain multiple nodes', () => {
    const node1 = createColorNode('primary-wheel');
    const node2 = createColorNode('primary-slider');

    const graph: ColorGradingGraph = {
      nodes: [node1, node2],
      connections: [
        { id: 'c1', fromNodeId: node1.id, fromOutput: 'out', toNodeId: node2.id, toInput: 'in' },
      ],
      activeNodeId: node2.id,
    };

    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(2);
  });

  it('should skip disabled nodes', () => {
    const node = createColorNode('primary-wheel');
    node.enabled = false;

    const graph: ColorGradingGraph = {
      nodes: [node],
      connections: [],
      activeNodeId: node.id,
    };

    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(0);
  });
});

describe('NodeGraphEngine.validateGraph', () => {
  it('should validate correct graph', () => {
    const node = createColorNode('primary-wheel');
    const graph: ColorGradingGraph = {
      nodes: [node],
      connections: [],
      activeNodeId: node.id,
    };
    const errors = NodeGraphEngine.validateGraph(graph);
    expect(errors).toEqual([]);
  });

  it('should detect dangling connections', () => {
    const graph: ColorGradingGraph = {
      nodes: [],
      connections: [
        { id: 'c1', fromNodeId: 'nonexistent', fromOutput: 'out', toNodeId: 'also-nonexistent', toInput: 'in' },
      ],
      activeNodeId: null,
    };
    const errors = NodeGraphEngine.validateGraph(graph);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should detect duplicate node IDs', () => {
    const node = createColorNode('primary-wheel');
    const graph: ColorGradingGraph = {
      nodes: [node, { ...node }], // same ID
      connections: [],
      activeNodeId: null,
    };
    const errors = NodeGraphEngine.validateGraph(graph);
    expect(errors.some(e => e.includes('duplicate'))).toBe(true);
  });
});
