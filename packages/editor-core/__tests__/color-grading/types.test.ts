import { describe, it, expect } from 'vitest';
import {
  createDefaultPrimaryWheelParams,
  createDefaultPrimarySliderParams,
  createEmptyColorGradingGraph,
  createColorGradingNode,
  validatePrimaryWheelParams,
  validatePrimarySliderParams,
  normalizeColorGradingGraph,
  type CurvesNodeParams,
  type LUTApplyNodeParams,
  type TrackingMaskNodeParams,
} from '../../src/color-grading/types';

describe('createDefaultPrimaryWheelParams', () => {
  it('should create params with all zeros', () => {
    const params = createDefaultPrimaryWheelParams();
    expect(params.lift).toEqual({ r: 0, g: 0, b: 0, y: 0 });
    expect(params.liftMaster).toBe(0);
    expect(params.gamma).toEqual({ r: 0, g: 0, b: 0, y: 0 });
    expect(params.gammaMaster).toBe(0);
    expect(params.gain).toEqual({ r: 0, g: 0, b: 0, y: 0 });
    expect(params.gainMaster).toBe(0);
    expect(params.offset).toEqual({ r: 0, g: 0, b: 0, y: 0 });
    expect(params.offsetMaster).toBe(0);
  });
});

describe('createDefaultPrimarySliderParams', () => {
  it('should create params with defaults', () => {
    const params = createDefaultPrimarySliderParams();
    expect(params.temperature).toBe(0);
    expect(params.tint).toBe(0);
    expect(params.contrast).toBe(0);
    expect(params.pivot).toBe(0.5);
    expect(params.saturation).toBe(100);
    expect(params.hue).toBe(0);
  });
});

describe('createEmptyColorGradingGraph', () => {
  it('should create empty graph', () => {
    const graph = createEmptyColorGradingGraph();
    expect(graph.nodes).toEqual([]);
    expect(graph.connections).toEqual([]);
    expect(graph.activeNodeId).toBeNull();
  });
});

describe('createColorGradingNode', () => {
  it('should create primary-wheel node with default params', () => {
    const node = createColorGradingNode('primary-wheel');
    expect(node.type).toBe('primary-wheel');
    expect(node.enabled).toBe(true);
    expect(node.params).toEqual(createDefaultPrimaryWheelParams());
    expect(node.id).toMatch(/^color-node-/);
  });

  it('should create primary-slider node with default params', () => {
    const node = createColorGradingNode('primary-slider');
    expect(node.type).toBe('primary-slider');
    expect(node.params).toEqual(createDefaultPrimarySliderParams());
  });

  it('should set custom position', () => {
    const node = createColorGradingNode('primary-wheel', { x: 100, y: 200 });
    expect(node.position).toEqual({ x: 100, y: 200 });
  });
});

describe('validatePrimaryWheelParams', () => {
  it('should clamp values to valid range', () => {
    const params = validatePrimaryWheelParams({
      lift: { r: 2, g: -2, b: 0.5, y: 0 },
      liftMaster: 1.5,
      gamma: { r: 0, g: 0, b: 0, y: 0 },
      gammaMaster: 0,
      gain: { r: 0, g: 0, b: 0, y: 0 },
      gainMaster: 0,
      offset: { r: 0, g: 0, b: 0, y: 0 },
      offsetMaster: 0,
    });
    expect(params.lift.r).toBe(1);
    expect(params.lift.g).toBe(-1);
    expect(params.lift.b).toBe(0.5);
    expect(params.liftMaster).toBe(1);
  });

  it('should pass through valid values', () => {
    const valid = createDefaultPrimaryWheelParams();
    const result = validatePrimaryWheelParams(valid);
    expect(result).toEqual(valid);
  });
});

describe('validatePrimarySliderParams', () => {
  it('should clamp values to valid range', () => {
    const params = validatePrimarySliderParams({
      temperature: 150,
      tint: -150,
      contrast: 50,
      pivot: 2,
      saturation: -10,
      hue: 200,
    });
    expect(params.temperature).toBe(100);
    expect(params.tint).toBe(-100);
    expect(params.contrast).toBe(50);
    expect(params.pivot).toBe(1);
    expect(params.saturation).toBe(0);
    expect(params.hue).toBe(180);
  });
});

describe('normalizeColorGradingGraph', () => {
  it('should return empty graph for null/undefined', () => {
    expect(normalizeColorGradingGraph(null)).toEqual(createEmptyColorGradingGraph());
    expect(normalizeColorGradingGraph(undefined)).toEqual(createEmptyColorGradingGraph());
  });

  it('should normalize valid graph', () => {
    const input = {
      nodes: [
        { id: 'n1', type: 'primary-wheel', enabled: true, params: createDefaultPrimaryWheelParams() },
      ],
      connections: [],
      activeNodeId: 'n1',
    };
    const result = normalizeColorGradingGraph(input);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('n1');
    expect(result.activeNodeId).toBe('n1');
  });

  it('should filter out invalid nodes', () => {
    const input = {
      nodes: [
        { id: 'n1', type: 'primary-wheel' },
        { invalid: true },
        null,
      ],
      connections: [],
      activeNodeId: null,
    };
    const result = normalizeColorGradingGraph(input);
    expect(result.nodes).toHaveLength(1);
  });

  it('should clamp wheel params during normalization', () => {
    const input = {
      nodes: [
        {
          id: 'n1',
          type: 'primary-wheel',
          params: {
            lift: { r: 5, g: 0, b: 0, y: 0 },
            liftMaster: 0,
            gamma: { r: 0, g: 0, b: 0, y: 0 },
            gammaMaster: 0,
            gain: { r: 0, g: 0, b: 0, y: 0 },
            gainMaster: 0,
            offset: { r: 0, g: 0, b: 0, y: 0 },
            offsetMaster: 0,
          },
        },
      ],
      connections: [],
      activeNodeId: null,
    };
    const result = normalizeColorGradingGraph(input);
    expect((result.nodes[0].params as any).lift.r).toBe(1);
  });
});

describe('createColorGradingNode - new types', () => {
  it('creates curves node with default params', () => {
    const node = createColorGradingNode('curves');
    expect(node.type).toBe('curves');
    expect(node.params).toHaveProperty('master');
    expect(node.params).toHaveProperty('red');
    expect((node.params as CurvesNodeParams).master).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect((node.params as CurvesNodeParams).red).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect((node.params as CurvesNodeParams).green).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect((node.params as CurvesNodeParams).blue).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });

  it('creates lut-apply node with default params', () => {
    const node = createColorGradingNode('lut-apply');
    expect(node.type).toBe('lut-apply');
    expect((node.params as LUTApplyNodeParams).lutId).toBe('');
    expect((node.params as LUTApplyNodeParams).intensity).toBe(1.0);
  });

  it('creates tracking-mask node with default params', () => {
    const node = createColorGradingNode('tracking-mask');
    expect(node.type).toBe('tracking-mask');
    expect((node.params as TrackingMaskNodeParams).trackingData).toEqual([]);
    expect((node.params as TrackingMaskNodeParams).feather).toBe(10);
    expect((node.params as TrackingMaskNodeParams).expand).toBe(0);
    expect((node.params as TrackingMaskNodeParams).invert).toBe(false);
  });

  it('creates output node with empty params', () => {
    const node = createColorGradingNode('output');
    expect(node.type).toBe('output');
    expect(node.params).toEqual({});
  });

  it('creates color-space node with empty params', () => {
    const node = createColorGradingNode('color-space');
    expect(node.type).toBe('color-space');
    expect(node.params).toEqual({});
  });

  it('creates mixer-node with empty params', () => {
    const node = createColorGradingNode('mixer-node');
    expect(node.type).toBe('mixer-node');
    expect(node.params).toEqual({});
  });
});

describe('normalizeColorNode - new types', () => {
  it('normalizes curves node with missing arrays', () => {
    const input = {
      nodes: [{ id: '1', type: 'curves', params: {} }],
      connections: [],
      activeNodeId: null,
    };
    const result = normalizeColorGradingGraph(input);
    const params = result.nodes[0].params as CurvesNodeParams;
    expect(params.master).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(params.red).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(params.green).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(params.blue).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });

  it('preserves valid curves data during normalization', () => {
    const customCurve = [{ x: 0, y: 0 }, { x: 0.5, y: 0.8 }, { x: 1, y: 1 }];
    const input = {
      nodes: [{
        id: '1',
        type: 'curves',
        params: { master: customCurve, red: customCurve, green: customCurve, blue: customCurve },
      }],
      connections: [],
      activeNodeId: null,
    };
    const result = normalizeColorGradingGraph(input);
    const params = result.nodes[0].params as CurvesNodeParams;
    expect(params.master).toEqual(customCurve);
  });

  it('clamps lut-apply intensity to 0-1', () => {
    const input = {
      nodes: [{ id: '1', type: 'lut-apply', params: { lutId: 'test', intensity: 2 } }],
      connections: [],
      activeNodeId: null,
    };
    const result = normalizeColorGradingGraph(input);
    expect((result.nodes[0].params as LUTApplyNodeParams).intensity).toBe(1);
  });

  it('clamps lut-apply intensity to 0-1 (negative)', () => {
    const input = {
      nodes: [{ id: '1', type: 'lut-apply', params: { lutId: 'test', intensity: -0.5 } }],
      connections: [],
      activeNodeId: null,
    };
    const result = normalizeColorGradingGraph(input);
    expect((result.nodes[0].params as LUTApplyNodeParams).intensity).toBe(0);
  });

  it('defaults lut-apply params when missing', () => {
    const input = {
      nodes: [{ id: '1', type: 'lut-apply', params: {} }],
      connections: [],
      activeNodeId: null,
    };
    const result = normalizeColorGradingGraph(input);
    expect((result.nodes[0].params as LUTApplyNodeParams).lutId).toBe('');
    expect((result.nodes[0].params as LUTApplyNodeParams).intensity).toBe(1);
  });

  it('normalizes tracking-mask with defaults', () => {
    const input = {
      nodes: [{ id: '1', type: 'tracking-mask', params: {} }],
      connections: [],
      activeNodeId: null,
    };
    const result = normalizeColorGradingGraph(input);
    const params = result.nodes[0].params as TrackingMaskNodeParams;
    expect(params.trackingData).toEqual([]);
    expect(params.feather).toBe(10);
    expect(params.expand).toBe(0);
    expect(params.invert).toBe(false);
  });

  it('clamps tracking-mask feather to 0-100', () => {
    const input = {
      nodes: [{ id: '1', type: 'tracking-mask', params: { feather: 150, expand: -200, invert: true } }],
      connections: [],
      activeNodeId: null,
    };
    const result = normalizeColorGradingGraph(input);
    const params = result.nodes[0].params as TrackingMaskNodeParams;
    expect(params.feather).toBe(100);
    expect(params.expand).toBe(-100);
    expect(params.invert).toBe(true);
  });

  it('normalizes output node with empty params', () => {
    const input = {
      nodes: [{ id: '1', type: 'output', params: { foo: 'bar' } }],
      connections: [],
      activeNodeId: null,
    };
    const result = normalizeColorGradingGraph(input);
    expect(result.nodes[0].type).toBe('output');
    expect(result.nodes[0].params).toEqual({ foo: 'bar' });
  });
});
