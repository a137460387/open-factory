import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_COLOR_NODE_GRAPH_TEMPLATES,
  ColorNodeGraphCycleError,
  buildColorNodeGraphFilterPlan,
  createDefaultColorNodeGraph,
  detectColorNodeGraphCycle,
  isDefaultColorNodeCorrection,
  normalizeColorNodeGraph,
  parseColorNodeGraphFile,
  serializeColorNodeGraphFile,
  topologicallySortColorNodeGraph,
  type ColorNodeGraphArtifact,
  type ColorNodeGraph
} from '../src';

describe('color node graph', () => {
  it('builds a depth-first topological filter chain for three serial nodes', () => {
    const graph = makeSerialGraph();

    const plan = buildColorNodeGraphFilterPlan(graph, { inputLabel: 'src', outputLabel: 'grade', clipId: 'clip-a' });

    expect(plan.order.map((node) => node.id)).toEqual(['input', 'node-a', 'node-b', 'node-c', 'output']);
    expect(plan.filters.join(';')).toContain('[src]eq=brightness=0.1:contrast=1:saturation=1[grade_node_a]');
    expect(plan.filters.join(';')).toContain('[grade_node_a]eq=brightness=0:contrast=1.2:saturation=1[grade_node_b]');
    expect(plan.filters.join(';')).toContain('[grade_node_b]eq=brightness=0:contrast=1:saturation=0.8[grade_node_c]');
    expect(plan.filters.at(-1)).toBe('[grade_node_c]copy[grade]');
  });

  it('merges parallel video branches with blend and audio branches with amix', () => {
    const graph: ColorNodeGraph = {
      version: 1,
      outputNodeId: 'parallel',
      nodes: [
        node('input', 'input'),
        node('sequential', 'warm', { brightness: 0.1 }),
        node('sequential', 'cool', { hue: -10 }),
        node('parallel', 'parallel')
      ],
      connections: [
        { id: 'input-warm', from: 'input', to: 'warm' },
        { id: 'input-cool', from: 'input', to: 'cool' },
        { id: 'warm-parallel', from: 'warm', to: 'parallel' },
        { id: 'cool-parallel', from: 'cool', to: 'parallel' }
      ]
    };

    const videoPlan = buildColorNodeGraphFilterPlan(graph, { inputLabel: 'src', outputLabel: 'out', mediaKind: 'video' });
    const audioPlan = buildColorNodeGraphFilterPlan(graph, { inputLabel: 'src', outputLabel: 'out', mediaKind: 'audio' });

    expect(videoPlan.filters.join(';')).toContain('split=2');
    expect(videoPlan.filters.join(';')).toContain('blend=all_mode=average');
    expect(audioPlan.filters.join(';')).toContain('amix=inputs=2:duration=longest:normalize=0');
  });

  it('layers independent source nodes after splitting the shared input label', () => {
    const graph: ColorNodeGraph = {
      version: 1,
      outputNodeId: 'layer',
      nodes: [
        node('sequential', 'base', { brightness: 0.05 }),
        node('sequential', 'top', { saturation: 0.4 }),
        { ...node('layer', 'layer'), blendMode: 'normal' }
      ],
      connections: [
        { id: 'base-layer', from: 'base', to: 'layer' },
        { id: 'top-layer', from: 'top', to: 'layer' }
      ]
    };

    const plan = buildColorNodeGraphFilterPlan(graph, { inputLabel: 'src', outputLabel: 'out', mediaKind: 'video' });

    expect(plan.filters[0]).toBe('[src]split=2[out_base_source][out_top_source]');
    expect(plan.filters.join(';')).toContain('overlay=x=0:y=0:eval=frame[out_layer_merge]');
  });

  it('maps explicit parallel blend modes into FFmpeg blend filters', () => {
    for (const mode of ['addition', 'multiply', 'screen', 'overlay'] as const) {
      const graph: ColorNodeGraph = {
        version: 1,
        outputNodeId: 'parallel',
        nodes: [
          node('sequential', 'base', { brightness: 0.05 }),
          node('sequential', 'top', { saturation: 0.4 }),
          { ...node('parallel', 'parallel'), blendMode: mode, mix: 0.5 }
        ],
        connections: [
          { id: 'base-parallel', from: 'base', to: 'parallel' },
          { id: 'top-parallel', from: 'top', to: 'parallel' }
        ]
      };

      const plan = buildColorNodeGraphFilterPlan(graph, { inputLabel: 'src', outputLabel: 'out', mediaKind: 'video' });

      expect(plan.filters.join(';')).toContain(`blend=all_mode=${mode}:all_opacity=0.5`);
    }
  });

  it('builds log LUT, user LUT, three-way color, and curve artifacts for a LUT node', () => {
    const artifacts: ColorNodeGraphArtifact[] = [];
    const graph: ColorNodeGraph = {
      version: 1,
      outputNodeId: 'look',
      nodes: [
        node('lut', 'look', {
          inputColorSpace: 'slog2',
          brightness: 0.12,
          hue: 12,
          lutPath: "D:\\Looks\\Warm's.cube",
          threeWayColor: {
            lift: { r: 0.05, g: 0, b: 0, intensity: 1 },
            gamma: { r: 0, g: 0.04, b: 0, intensity: 1 },
            gain: { r: 0, g: 0, b: 0.06, intensity: 1 }
          },
          colorCurves: {
            master: [
              { x: 0, y: 0 },
              { x: 0.5, y: 0.62 },
              { x: 1, y: 1 }
            ],
            r: [
              { x: 0, y: 0 },
              { x: 1, y: 1 }
            ],
            g: [
              { x: 0, y: 0 },
              { x: 1, y: 1 }
            ],
            b: [
              { x: 0, y: 0 },
              { x: 1, y: 1 }
            ]
          }
        })
      ],
      connections: []
    };

    const plan = buildColorNodeGraphFilterPlan(graph, {
      inputLabel: 'src',
      outputLabel: 'out',
      clipId: 'clip/look',
      registerArtifact: (artifact) => {
        artifacts.push(artifact);
        return artifact.placeholder;
      }
    });
    const filter = plan.filters.join(';');

    expect(filter).toContain('lut3d=file=__NODE_LOG_LUT_clip_look_slog2_look__');
    expect(filter).toContain("lut3d=file=D\\:/Looks/Warm\\'s.cube");
    expect(filter).toContain('eq=brightness=0.12:contrast=1:saturation=1');
    expect(filter).toContain('hue=h=12');
    expect(filter).toContain('colorbalance=rs=0.05:gm=0.04:bh=0.06');
    expect(filter).toContain('lut1d=file=__NODE_CURVE_LUT_clip_look_look__');
    expect(artifacts.map((artifact) => artifact.kind)).toEqual(['log-lut', 'curve-lut']);
    expect(artifacts[0]).toMatchObject({ fileName: 'node-log-slog2-clip_look-look.cube', nodeId: 'look' });
    expect(artifacts[1].text).toContain('LUT_1D_SIZE 17');
  });

  it('detects cycles without removing the existing connections', () => {
    const graph: ColorNodeGraph = {
      version: 1,
      outputNodeId: 'node-a',
      nodes: [node('sequential', 'node-a'), node('sequential', 'node-b')],
      connections: [
        { id: 'a-b', from: 'node-a', to: 'node-b' },
        { id: 'b-a', from: 'node-b', to: 'node-a' }
      ]
    };

    expect(detectColorNodeGraphCycle(graph)).toEqual(['node-a', 'node-b', 'node-a']);
    expect(normalizeColorNodeGraph(graph).connections).toHaveLength(2);
    expect(() => topologicallySortColorNodeGraph(graph)).toThrow(ColorNodeGraphCycleError);
  });

  it('serializes and parses node graph files round trip', () => {
    const graph = createDefaultColorNodeGraph({ brightness: 0.2, lutPath: 'C:/Looks/warm.cube' });

    const parsed = parseColorNodeGraphFile(serializeColorNodeGraphFile(graph, 'Warm grade'));

    expect(parsed).toEqual(normalizeColorNodeGraph(graph));
  });

  it('rejects unsupported node graph files', () => {
    expect(() => parseColorNodeGraphFile(JSON.stringify({ format: 'other', graph: createDefaultColorNodeGraph() }))).toThrow('Unsupported color node graph file.');
  });

  it('ships complete built-in template parameters', () => {
    expect(BUILT_IN_COLOR_NODE_GRAPH_TEMPLATES.map((template) => template.id).sort()).toEqual(['black-white', 'cinematic', 'landscape', 'negative', 'portrait']);
    for (const template of BUILT_IN_COLOR_NODE_GRAPH_TEMPLATES) {
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.graph.nodes.length).toBeGreaterThanOrEqual(3);
      expect(template.graph.nodes.every((item) => item.correction && item.position && item.name)).toBe(true);
      expect(template.graph.connections.length).toBe(template.graph.nodes.length - 1);
      expect(() => topologicallySortColorNodeGraph(template.graph)).not.toThrow();
    }
  });

  it('uses a single-node default graph when older clips have no colorNodeGraph field', () => {
    const graph = normalizeColorNodeGraph(undefined, { saturation: 0.5 });

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toMatchObject({ id: 'node-default', type: 'sequential', correction: { saturation: 0.5 } });
  });

  it('normalizes invalid nodes, duplicate ids, invalid connections, and missing output ids', () => {
    expect(normalizeColorNodeGraph({ version: 1, nodes: [null], connections: [], outputNodeId: '' } as unknown as ColorNodeGraph, { brightness: 0.3 }).nodes[0].correction.brightness).toBe(0.3);

    const graph = normalizeColorNodeGraph({
      version: 1,
      outputNodeId: 'missing',
      nodes: [
        {
          id: 'dup',
          type: 'unknown',
          name: '   ',
          position: { x: -10, y: Number.NaN },
          correction: { brightness: 9, contrast: -2, saturation: 5, hue: 999, lutPath: '   ' }
        },
        node('layer', 'dup'),
        node('output', 'sink')
      ],
      connections: [
        null,
        { id: 'self', from: 'dup', to: 'dup' },
        { id: 'missing', from: 'missing', to: 'sink' },
        { id: '', from: 'dup', to: 'sink' },
        { id: '', from: 'dup-2', to: 'sink' }
      ]
    } as unknown as ColorNodeGraph);

    expect(graph.nodes.map((item) => item.id)).toEqual(['dup', 'dup-2', 'sink']);
    expect(graph.nodes[0]).toMatchObject({
      type: 'sequential',
      name: 'Sequential 1',
      position: { x: 0, y: 160 },
      correction: { brightness: 1, contrast: 0, saturation: 2, hue: 180, lutPath: null }
    });
    expect(graph.connections.map((connection) => connection.id)).toEqual(['dup-sink', 'dup-2-sink']);
    expect(graph.outputNodeId).toBe('sink');
  });

  it('detects default and non-default node corrections', () => {
    expect(isDefaultColorNodeCorrection(undefined)).toBe(true);
    expect(isDefaultColorNodeCorrection({ brightness: 0.01 })).toBe(false);
  });
});

function makeSerialGraph(): ColorNodeGraph {
  return {
    version: 1,
    outputNodeId: 'output',
    nodes: [
      node('input', 'input'),
      node('sequential', 'node-a', { brightness: 0.1 }),
      node('sequential', 'node-b', { contrast: 1.2 }),
      node('sequential', 'node-c', { saturation: 0.8 }),
      node('output', 'output')
    ],
    connections: [
      { id: 'input-a', from: 'input', to: 'node-a' },
      { id: 'a-b', from: 'node-a', to: 'node-b' },
      { id: 'b-c', from: 'node-b', to: 'node-c' },
      { id: 'c-output', from: 'node-c', to: 'output' }
    ]
  };
}

function node(type: ColorNodeGraph['nodes'][number]['type'], id: string, correction = {}): ColorNodeGraph['nodes'][number] {
  return {
    id,
    type,
    name: id,
    position: { x: 0, y: 0 },
    correction: {
      brightness: 0,
      contrast: 1,
      saturation: 1,
      hue: 0,
      lutPath: null,
      ...correction
    }
  } as ColorNodeGraph['nodes'][number];
}
