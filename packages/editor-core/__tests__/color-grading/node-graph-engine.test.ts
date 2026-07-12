import { describe, it, expect } from 'vitest';
import { NodeGraphEngine } from '../../src/color-grading/node-graph-engine';
import { createColorGradingNode, createEmptyColorGradingGraph } from '../../src/color-grading/types';
import type { ColorGradingGraph, CurvesNodeParams, LUTApplyNodeParams, TrackingMaskNodeParams } from '../../src/color-grading/types';

describe('NodeGraphEngine.topologicalSort', () => {
  it('should return empty array for empty graph', () => {
    const graph = createEmptyColorGradingGraph();
    const sorted = NodeGraphEngine.topologicalSort(graph);
    expect(sorted).toEqual([]);
  });

  it('should sort single node', () => {
    const node = createColorGradingNode('primary-wheel');
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
    const node1 = createColorGradingNode('primary-wheel', { x: 0, y: 0 });
    const node2 = createColorGradingNode('primary-slider', { x: 200, y: 0 });
    const node3 = createColorGradingNode('output', { x: 400, y: 0 });

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
    const node1 = createColorGradingNode('primary-wheel');
    const node2 = createColorGradingNode('primary-slider');

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
    const node = createColorGradingNode('primary-wheel');
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
    const node1 = createColorGradingNode('primary-wheel');
    const node2 = createColorGradingNode('primary-slider');

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
    const node = createColorGradingNode('primary-wheel');
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
    const node = createColorGradingNode('primary-wheel');
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
    const node = createColorGradingNode('primary-wheel');
    const graph: ColorGradingGraph = {
      nodes: [node, { ...node }], // same ID
      connections: [],
      activeNodeId: null,
    };
    const errors = NodeGraphEngine.validateGraph(graph);
    expect(errors.some(e => e.includes('duplicate'))).toBe(true);
  });
});

describe('NodeGraphEngine.execute - new node types', () => {
  it('executes curves node with default identity LUT', () => {
    const graph = createEmptyColorGradingGraph();
    const node = createColorGradingNode('curves');
    graph.nodes.push(node);
    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(1);
    expect(result.nodeResults[0].uniforms).toHaveProperty(`u_curvesLUT_${node.id}`);
    expect(result.nodeResults[0].fragmentSnippets).toEqual([`color = applyCurves_${node.id}(color);`]);

    // Verify the LUT data is identity for default curves
    const lutUniform = result.nodeResults[0].uniforms[`u_curvesLUT_${node.id}`] as any;
    expect(lutUniform.type).toBe('sampler2D');
    expect(lutUniform.width).toBe(256);
    expect(lutUniform.height).toBe(1);
    expect(lutUniform.value).toBeInstanceOf(Float32Array);
    expect(lutUniform.value.length).toBe(256 * 4);

    // First entry: x=0 -> all channels should be 0
    expect(lutUniform.value[0]).toBeCloseTo(0, 5); // R
    expect(lutUniform.value[1]).toBeCloseTo(0, 5); // G
    expect(lutUniform.value[2]).toBeCloseTo(0, 5); // B
    expect(lutUniform.value[3]).toBeCloseTo(0, 5); // Master

    // Last entry: x=1 -> all channels should be 1
    expect(lutUniform.value[255 * 4]).toBeCloseTo(1, 5);
    expect(lutUniform.value[255 * 4 + 1]).toBeCloseTo(1, 5);
    expect(lutUniform.value[255 * 4 + 2]).toBeCloseTo(1, 5);
    expect(lutUniform.value[255 * 4 + 3]).toBeCloseTo(1, 5);
  });

  it('executes curves node with custom curve points', () => {
    const graph = createEmptyColorGradingGraph();
    const node = createColorGradingNode('curves');
    // Red channel: boost midtones
    (node.params as CurvesNodeParams).red = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.7 },
      { x: 1, y: 1 },
    ];
    graph.nodes.push(node);
    const result = NodeGraphEngine.execute(graph);
    const lutUniform = result.nodeResults[0].uniforms[`u_curvesLUT_${node.id}`] as any;
    // At x=0.5, red channel (index 128, red at offset 0) should be ~0.7
    expect(lutUniform.value[128 * 4]).toBeGreaterThan(0.5);
  });

  it('executes lut-apply node', () => {
    const graph = createEmptyColorGradingGraph();
    const node = createColorGradingNode('lut-apply');
    (node.params as LUTApplyNodeParams).lutId = 'test-lut';
    (node.params as LUTApplyNodeParams).intensity = 0.8;
    graph.nodes.push(node);
    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(1);

    const lut3D = result.nodeResults[0].uniforms[`u_lut3D_${node.id}`] as any;
    expect(lut3D.type).toBe('sampler3D');
    expect(lut3D.lutId).toBe('test-lut');
    expect(lut3D.value).toBeNull();

    const intensity = result.nodeResults[0].uniforms[`u_lutIntensity_${node.id}`] as any;
    expect(intensity.type).toBe('1f');
    expect(intensity.value).toBe(0.8);
    expect(result.nodeResults[0].fragmentSnippets).toEqual([`color = applyLUT_${node.id}(color);`]);
  });

  it('executes tracking-mask node', () => {
    const graph = createEmptyColorGradingGraph();
    const node = createColorGradingNode('tracking-mask');
    (node.params as TrackingMaskNodeParams).feather = 15;
    (node.params as TrackingMaskNodeParams).expand = 5;
    (node.params as TrackingMaskNodeParams).invert = true;
    graph.nodes.push(node);
    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(1);

    const feather = result.nodeResults[0].uniforms[`u_trackingMaskFeather_${node.id}`] as any;
    expect(feather.type).toBe('1f');
    expect(feather.value).toBe(15);

    const expand = result.nodeResults[0].uniforms[`u_trackingMaskExpand_${node.id}`] as any;
    expect(expand.type).toBe('1f');
    expect(expand.value).toBe(5);

    const invert = result.nodeResults[0].uniforms[`u_trackingMaskInvert_${node.id}`] as any;
    expect(invert.type).toBe('1i');
    expect(invert.value).toBe(1);
    expect(result.nodeResults[0].fragmentSnippets).toEqual([
      `color = applyTrackingMask_${node.id}(color, v_texCoord);`,
    ]);
  });

  it('handles output node as no-op', () => {
    const graph = createEmptyColorGradingGraph();
    const node = createColorGradingNode('output');
    graph.nodes.push(node);
    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(1);
    expect(result.nodeResults[0].uniforms).toEqual({});
    expect(result.nodeResults[0].fragmentSnippets).toEqual([]);
  });

  it('handles color-space node as no-op', () => {
    const graph = createEmptyColorGradingGraph();
    const node = createColorGradingNode('color-space');
    graph.nodes.push(node);
    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(1);
    expect(result.nodeResults[0].uniforms).toEqual({});
    expect(result.nodeResults[0].fragmentSnippets).toEqual([]);
  });

  it('handles mixer-node as no-op', () => {
    const graph = createEmptyColorGradingGraph();
    const node = createColorGradingNode('mixer-node');
    graph.nodes.push(node);
    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(1);
    expect(result.nodeResults[0].uniforms).toEqual({});
    expect(result.nodeResults[0].fragmentSnippets).toEqual([]);
  });

  it('executes full pipeline with all node types', () => {
    const wheel = createColorGradingNode('primary-wheel');
    const slider = createColorGradingNode('primary-slider');
    const curves = createColorGradingNode('curves');
    const lut = createColorGradingNode('lut-apply');
    const tracking = createColorGradingNode('tracking-mask');
    const output = createColorGradingNode('output');

    const graph: ColorGradingGraph = {
      nodes: [wheel, slider, curves, lut, tracking, output],
      connections: [
        { id: 'c1', fromNodeId: wheel.id, fromOutput: 'out', toNodeId: slider.id, toInput: 'in' },
        { id: 'c2', fromNodeId: slider.id, fromOutput: 'out', toNodeId: curves.id, toInput: 'in' },
        { id: 'c3', fromNodeId: curves.id, fromOutput: 'out', toNodeId: lut.id, toInput: 'in' },
        { id: 'c4', fromNodeId: lut.id, fromOutput: 'out', toNodeId: tracking.id, toInput: 'in' },
        { id: 'c5', fromNodeId: tracking.id, fromOutput: 'out', toNodeId: output.id, toInput: 'in' },
      ],
      activeNodeId: output.id,
    };

    const result = NodeGraphEngine.execute(graph);
    expect(result.nodeResults).toHaveLength(6);
    expect(result.combinedUniforms).toHaveProperty(`u_curvesLUT_${curves.id}`);
    expect(result.combinedUniforms).toHaveProperty(`u_lut3D_${lut.id}`);
    expect(result.combinedUniforms).toHaveProperty(`u_trackingMaskFeather_${tracking.id}`);
  });
});
