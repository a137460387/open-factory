import { describe, it, expect } from 'vitest';
import { BusRouter } from '../../src/audio/bus-router';
import type { RoutingGraph, RoutingNode, RoutingValidationError } from '../../src/audio/bus-router';
import type { AudioBus, MixerChannel } from '../../src/audio/mixer-types';

// ─── helpers ────────────────────────────────────────────────

function makeMasterBus(id = 'master-1'): AudioBus {
  return {
    id,
    name: 'Master',
    type: 'master',
    effectsChain: [],
    volume: 0,
    pan: 0,
    muted: false,
    outputBusId: null,
  };
}

function makeBus(overrides: Partial<AudioBus> & { id: string }): AudioBus {
  return {
    name: 'Bus',
    type: 'submix',
    effectsChain: [],
    volume: 0,
    pan: 0,
    muted: false,
    outputBusId: null,
    ...overrides,
  };
}

function makeChannel(overrides: Partial<MixerChannel> & { trackId: string; name: string }): MixerChannel {
  return {
    volume: 0,
    pan: 0,
    muted: false,
    solo: false,
    busAssignments: [],
    inputBus: null,
    effectsChain: [],
    automation: {},
    metering: { peakLevel: -Infinity, rmsLevel: -Infinity, clipCount: 0 },
    ...overrides,
  };
}

// ─── buildRoutingGraph ──────────────────────────────────────

describe('BusRouter.buildRoutingGraph', () => {
  it('creates master bus node', () => {
    const master = makeMasterBus();
    const graph = BusRouter.buildRoutingGraph([], [], master);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].id).toBe(master.id);
    expect(graph.nodes[0].type).toBe('bus');
    expect(graph.nodes[0].name).toBe('Master');
  });

  it('creates bus nodes that output to master by default', () => {
    const master = makeMasterBus();
    const bus = makeBus({ id: 'bus-drums', name: 'Drums' });
    const graph = BusRouter.buildRoutingGraph([], [bus], master);

    const busNode = graph.nodes.find(n => n.id === 'bus-drums');
    expect(busNode).toBeDefined();
    expect(busNode!.outputs).toEqual([master.id]);
  });

  it('creates bus nodes that output to specified outputBusId', () => {
    const master = makeMasterBus();
    const busA = makeBus({ id: 'bus-a', name: 'A', outputBusId: 'bus-b' });
    const busB = makeBus({ id: 'bus-b', name: 'B' });
    const graph = BusRouter.buildRoutingGraph([], [busA, busB], master);

    const nodeA = graph.nodes.find(n => n.id === 'bus-a');
    expect(nodeA!.outputs).toEqual(['bus-b']);
  });

  it('creates channel nodes with bus assignments', () => {
    const master = makeMasterBus();
    const bus = makeBus({ id: 'bus-vocals', name: 'Vocals' });
    const ch = makeChannel({
      trackId: 'track-1',
      name: 'Voice',
      busAssignments: [{ busId: 'bus-vocals', level: 0.8, enabled: true }],
    });

    const graph = BusRouter.buildRoutingGraph([ch], [bus], master);

    const chNode = graph.nodes.find(n => n.id === 'track-1');
    expect(chNode).toBeDefined();
    expect(chNode!.type).toBe('channel');
    expect(chNode!.outputs).toEqual(['bus-vocals']);
  });

  it('channels with no bus assignments default to master', () => {
    const master = makeMasterBus();
    const ch = makeChannel({ trackId: 'track-1', name: 'Voice' });

    const graph = BusRouter.buildRoutingGraph([ch], [], master);

    const chNode = graph.nodes.find(n => n.id === 'track-1');
    expect(chNode!.outputs).toEqual([master.id]);
  });

  it('skips disabled bus assignments', () => {
    const master = makeMasterBus();
    const bus = makeBus({ id: 'bus-fx', name: 'FX' });
    const ch = makeChannel({
      trackId: 'track-1',
      name: 'Voice',
      busAssignments: [
        { busId: 'bus-fx', level: 0.5, enabled: false },
      ],
    });

    const graph = BusRouter.buildRoutingGraph([ch], [bus], master);

    // Disabled assignment means no outputs, so channel defaults to master
    const chNode = graph.nodes.find(n => n.id === 'track-1');
    expect(chNode!.outputs).toEqual([master.id]);
  });

  it('creates connections for enabled bus assignments', () => {
    const master = makeMasterBus();
    const bus = makeBus({ id: 'bus-1', name: 'Bus1' });
    const ch = makeChannel({
      trackId: 'track-1',
      name: 'Ch1',
      busAssignments: [{ busId: 'bus-1', level: 0.7, enabled: true }],
    });

    const graph = BusRouter.buildRoutingGraph([ch], [bus], master);

    const conn = graph.connections.find(c => c.fromId === 'track-1' && c.toId === 'bus-1');
    expect(conn).toBeDefined();
    expect(conn!.level).toBe(0.7);
  });

  it('creates bus-to-bus connections', () => {
    const master = makeMasterBus();
    const bus = makeBus({ id: 'bus-1', name: 'Bus1', sendLevel: 0.6 });
    const graph = BusRouter.buildRoutingGraph([], [bus], master);

    const conn = graph.connections.find(c => c.fromId === 'bus-1' && c.toId === master.id);
    expect(conn).toBeDefined();
    expect(conn!.level).toBe(0.6);
  });

  it('defaults sendLevel to 1 when not specified', () => {
    const master = makeMasterBus();
    const bus = makeBus({ id: 'bus-1', name: 'Bus1' });
    const graph = BusRouter.buildRoutingGraph([], [bus], master);

    const conn = graph.connections.find(c => c.fromId === 'bus-1');
    expect(conn!.level).toBe(1);
  });

  it('builds reverse input references', () => {
    const master = makeMasterBus();
    const ch = makeChannel({ trackId: 'track-1', name: 'Ch1' });

    const graph = BusRouter.buildRoutingGraph([ch], [], master);

    const masterNode = graph.nodes.find(n => n.id === master.id);
    expect(masterNode!.inputs).toContain('track-1');
  });

  it('handles multiple channels routing to same bus', () => {
    const master = makeMasterBus();
    const bus = makeBus({ id: 'bus-1', name: 'Bus1' });
    const ch1 = makeChannel({
      trackId: 'track-1',
      name: 'Ch1',
      busAssignments: [{ busId: 'bus-1', level: 1, enabled: true }],
    });
    const ch2 = makeChannel({
      trackId: 'track-2',
      name: 'Ch2',
      busAssignments: [{ busId: 'bus-1', level: 0.5, enabled: true }],
    });

    const graph = BusRouter.buildRoutingGraph([ch1, ch2], [bus], master);

    const busNode = graph.nodes.find(n => n.id === 'bus-1');
    expect(busNode!.inputs).toContain('track-1');
    expect(busNode!.inputs).toContain('track-2');
  });

  it('handles channel with inputBus set', () => {
    const master = makeMasterBus();
    const bus = makeBus({ id: 'bus-1', name: 'Bus1' });
    const ch = makeChannel({
      trackId: 'track-1',
      name: 'Ch1',
      inputBus: 'bus-1',
      busAssignments: [{ busId: 'bus-1', level: 1, enabled: true }],
    });

    const graph = BusRouter.buildRoutingGraph([ch], [bus], master);

    const chNode = graph.nodes.find(n => n.id === 'track-1');
    expect(chNode!.inputs).toEqual(['bus-1']);
  });
});

// ─── validateRouting ────────────────────────────────────────

describe('BusRouter.validateRouting', () => {
  it('returns no errors for a valid graph', () => {
    const graph: RoutingGraph = {
      nodes: [
        { id: 'master', type: 'bus', name: 'Master', outputs: [], inputs: ['ch1'] },
        { id: 'ch1', type: 'channel', name: 'Ch1', outputs: ['master'], inputs: [] },
      ],
      connections: [{ fromId: 'ch1', toId: 'master', level: 1 }],
    };

    const errors = BusRouter.validateRouting(graph);
    expect(errors).toEqual([]);
  });

  it('detects dangling reference (missing source)', () => {
    const graph: RoutingGraph = {
      nodes: [
        { id: 'master', type: 'bus', name: 'Master', outputs: [], inputs: [] },
      ],
      connections: [{ fromId: 'ghost', toId: 'master', level: 1 }],
    };

    const errors = BusRouter.validateRouting(graph);
    const dangling = errors.filter(e => e.type === 'dangling-reference');
    expect(dangling.length).toBeGreaterThanOrEqual(1);
    expect(dangling.some(e => e.nodeId === 'ghost')).toBe(true);
  });

  it('detects dangling reference (missing target)', () => {
    const graph: RoutingGraph = {
      nodes: [
        { id: 'ch1', type: 'channel', name: 'Ch1', outputs: [], inputs: [] },
      ],
      connections: [{ fromId: 'ch1', toId: 'ghost', level: 1 }],
    };

    const errors = BusRouter.validateRouting(graph);
    const dangling = errors.filter(e => e.type === 'dangling-reference');
    expect(dangling.length).toBeGreaterThanOrEqual(1);
    expect(dangling.some(e => e.nodeId === 'ghost')).toBe(true);
  });

  it('detects a cycle', () => {
    const graph: RoutingGraph = {
      nodes: [
        { id: 'a', type: 'bus', name: 'A', outputs: ['b'], inputs: ['b'] },
        { id: 'b', type: 'bus', name: 'B', outputs: ['a'], inputs: ['a'] },
      ],
      connections: [
        { fromId: 'a', toId: 'b', level: 1 },
        { fromId: 'b', toId: 'a', level: 1 },
      ],
    };

    const errors = BusRouter.validateRouting(graph);
    const cycles = errors.filter(e => e.type === 'cycle');
    expect(cycles.length).toBeGreaterThanOrEqual(1);
  });

  it('detects a longer cycle (a->b->c->a)', () => {
    const graph: RoutingGraph = {
      nodes: [
        { id: 'a', type: 'bus', name: 'A', outputs: ['b'], inputs: ['c'] },
        { id: 'b', type: 'bus', name: 'B', outputs: ['c'], inputs: ['a'] },
        { id: 'c', type: 'bus', name: 'C', outputs: ['a'], inputs: ['b'] },
      ],
      connections: [
        { fromId: 'a', toId: 'b', level: 1 },
        { fromId: 'b', toId: 'c', level: 1 },
        { fromId: 'c', toId: 'a', level: 1 },
      ],
    };

    const errors = BusRouter.validateRouting(graph);
    expect(errors.some(e => e.type === 'cycle')).toBe(true);
  });

  it('detects orphan nodes', () => {
    const graph: RoutingGraph = {
      nodes: [
        { id: 'master', type: 'bus', name: 'Master', outputs: [], inputs: [] },
        { id: 'orphan', type: 'bus', name: 'Orphan', outputs: [], inputs: [] },
      ],
      connections: [],
    };

    const errors = BusRouter.validateRouting(graph);
    const orphans = errors.filter(e => e.type === 'orphan');
    expect(orphans.length).toBeGreaterThanOrEqual(1);
    expect(orphans.some(e => e.nodeId === 'orphan')).toBe(true);
  });

  it('does not flag nodes with connections as orphans', () => {
    const graph: RoutingGraph = {
      nodes: [
        { id: 'master', type: 'bus', name: 'Master', outputs: [], inputs: ['ch1'] },
        { id: 'ch1', type: 'channel', name: 'Ch1', outputs: ['master'], inputs: [] },
      ],
      connections: [{ fromId: 'ch1', toId: 'master', level: 1 }],
    };

    const errors = BusRouter.validateRouting(graph);
    expect(errors.filter(e => e.type === 'orphan')).toEqual([]);
  });
});

// ─── topologicalSort ────────────────────────────────────────

describe('BusRouter.topologicalSort', () => {
  it('sorts a simple linear chain', () => {
    const graph: RoutingGraph = {
      nodes: [
        { id: 'ch1', type: 'channel', name: 'Ch1', outputs: ['bus1'], inputs: [] },
        { id: 'bus1', type: 'bus', name: 'Bus1', outputs: ['master'], inputs: ['ch1'] },
        { id: 'master', type: 'bus', name: 'Master', outputs: [], inputs: ['bus1'] },
      ],
      connections: [
        { fromId: 'ch1', toId: 'bus1', level: 1 },
        { fromId: 'bus1', toId: 'master', level: 1 },
      ],
    };

    const sorted = BusRouter.topologicalSort(graph);
    const ids = sorted.map(n => n.id);

    // ch1 must come before bus1, bus1 before master
    expect(ids.indexOf('ch1')).toBeLessThan(ids.indexOf('bus1'));
    expect(ids.indexOf('bus1')).toBeLessThan(ids.indexOf('master'));
  });

  it('handles multiple independent sources', () => {
    const graph: RoutingGraph = {
      nodes: [
        { id: 'ch1', type: 'channel', name: 'Ch1', outputs: ['master'], inputs: [] },
        { id: 'ch2', type: 'channel', name: 'Ch2', outputs: ['master'], inputs: [] },
        { id: 'master', type: 'bus', name: 'Master', outputs: [], inputs: ['ch1', 'ch2'] },
      ],
      connections: [
        { fromId: 'ch1', toId: 'master', level: 1 },
        { fromId: 'ch2', toId: 'master', level: 1 },
      ],
    };

    const sorted = BusRouter.topologicalSort(graph);
    const ids = sorted.map(n => n.id);

    expect(ids).toContain('ch1');
    expect(ids).toContain('ch2');
    expect(ids).toContain('master');
    expect(ids.indexOf('ch1')).toBeLessThan(ids.indexOf('master'));
    expect(ids.indexOf('ch2')).toBeLessThan(ids.indexOf('master'));
  });

  it('handles diamond topology (ch1->bus1, ch1->bus2, bus1->master, bus2->master)', () => {
    const graph: RoutingGraph = {
      nodes: [
        { id: 'ch1', type: 'channel', name: 'Ch1', outputs: ['bus1', 'bus2'], inputs: [] },
        { id: 'bus1', type: 'bus', name: 'Bus1', outputs: ['master'], inputs: ['ch1'] },
        { id: 'bus2', type: 'bus', name: 'Bus2', outputs: ['master'], inputs: ['ch1'] },
        { id: 'master', type: 'bus', name: 'Master', outputs: [], inputs: ['bus1', 'bus2'] },
      ],
      connections: [
        { fromId: 'ch1', toId: 'bus1', level: 1 },
        { fromId: 'ch1', toId: 'bus2', level: 0.5 },
        { fromId: 'bus1', toId: 'master', level: 1 },
        { fromId: 'bus2', toId: 'master', level: 1 },
      ],
    };

    const sorted = BusRouter.topologicalSort(graph);
    const ids = sorted.map(n => n.id);

    expect(ids.indexOf('ch1')).toBeLessThan(ids.indexOf('bus1'));
    expect(ids.indexOf('ch1')).toBeLessThan(ids.indexOf('bus2'));
    expect(ids.indexOf('bus1')).toBeLessThan(ids.indexOf('master'));
    expect(ids.indexOf('bus2')).toBeLessThan(ids.indexOf('master'));
  });

  it('preserves all nodes in the sorted output', () => {
    const graph: RoutingGraph = {
      nodes: [
        { id: 'a', type: 'channel', name: 'A', outputs: ['b'], inputs: [] },
        { id: 'b', type: 'bus', name: 'B', outputs: [], inputs: ['a'] },
      ],
      connections: [{ fromId: 'a', toId: 'b', level: 1 }],
    };

    const sorted = BusRouter.topologicalSort(graph);
    expect(sorted).toHaveLength(2);
    expect(sorted.map(n => n.id).sort()).toEqual(['a', 'b']);
  });

  it('returns all nodes when there are no connections', () => {
    const graph: RoutingGraph = {
      nodes: [
        { id: 'a', type: 'channel', name: 'A', outputs: [], inputs: [] },
        { id: 'b', type: 'channel', name: 'B', outputs: [], inputs: [] },
      ],
      connections: [],
    };

    const sorted = BusRouter.topologicalSort(graph);
    expect(sorted).toHaveLength(2);
  });
});

// ─── toFfmpegMixFilter ──────────────────────────────────────

describe('BusRouter.toFfmpegMixFilter', () => {
  it('returns empty string for no connections', () => {
    const graph: RoutingGraph = { nodes: [], connections: [] };
    expect(BusRouter.toFfmpegMixFilter(graph)).toBe('');
  });

  it('returns empty string for single input', () => {
    const graph: RoutingGraph = {
      nodes: [],
      connections: [{ fromId: 'ch1', toId: 'master', level: 1 }],
    };
    expect(BusRouter.toFfmpegMixFilter(graph)).toBe('');
  });

  it('generates amix filter for 2 inputs', () => {
    const graph: RoutingGraph = {
      nodes: [],
      connections: [
        { fromId: 'ch1', toId: 'master', level: 1 },
        { fromId: 'ch2', toId: 'master', level: 1 },
      ],
    };

    const filter = BusRouter.toFfmpegMixFilter(graph);
    expect(filter).toBe('amix=inputs=2:duration=longest:dropout_transition=2');
  });

  it('generates amix filter for 3 inputs', () => {
    const graph: RoutingGraph = {
      nodes: [],
      connections: [
        { fromId: 'ch1', toId: 'master', level: 1 },
        { fromId: 'ch2', toId: 'master', level: 0.8 },
        { fromId: 'ch3', toId: 'bus1', level: 0.5 },
      ],
    };

    const filter = BusRouter.toFfmpegMixFilter(graph);
    expect(filter).toBe('amix=inputs=3:duration=longest:dropout_transition=2');
  });

  it('counts unique source nodes', () => {
    // One source sending to two targets counts as 1 input
    const graph: RoutingGraph = {
      nodes: [],
      connections: [
        { fromId: 'ch1', toId: 'bus1', level: 1 },
        { fromId: 'ch1', toId: 'bus2', level: 0.5 },
      ],
    };

    const filter = BusRouter.toFfmpegMixFilter(graph);
    expect(filter).toBe('');
  });
});

// ─── integration: build + validate + sort ───────────────────

describe('BusRouter integration', () => {
  it('builds, validates, and sorts a complete mixer setup', () => {
    const master = makeMasterBus('master');
    const drumsBus = makeBus({ id: 'bus-drums', name: 'Drums Bus', sendLevel: 0.9 });
    const vocalBus = makeBus({ id: 'bus-vocals', name: 'Vocal Bus', sendLevel: 0.8 });

    const kick = makeChannel({
      trackId: 'kick',
      name: 'Kick',
      busAssignments: [{ busId: 'bus-drums', level: 1, enabled: true }],
    });
    const snare = makeChannel({
      trackId: 'snare',
      name: 'Snare',
      busAssignments: [{ busId: 'bus-drums', level: 0.9, enabled: true }],
    });
    const vocal = makeChannel({
      trackId: 'vocal',
      name: 'Lead Vocal',
      busAssignments: [{ busId: 'bus-vocals', level: 1, enabled: true }],
    });

    const graph = BusRouter.buildRoutingGraph([kick, snare, vocal], [drumsBus, vocalBus], master);

    // Should have 6 nodes: master + 2 buses + 3 channels
    expect(graph.nodes).toHaveLength(6);

    // Validate - should be clean
    const errors = BusRouter.validateRouting(graph);
    expect(errors).toEqual([]);

    // Sort - channels should come before buses, buses before master
    const sorted = BusRouter.topologicalSort(graph);
    const ids = sorted.map(n => n.id);

    expect(ids.indexOf('kick')).toBeLessThan(ids.indexOf('bus-drums'));
    expect(ids.indexOf('snare')).toBeLessThan(ids.indexOf('bus-drums'));
    expect(ids.indexOf('vocal')).toBeLessThan(ids.indexOf('bus-vocals'));
    expect(ids.indexOf('bus-drums')).toBeLessThan(ids.indexOf('master'));
    expect(ids.indexOf('bus-vocals')).toBeLessThan(ids.indexOf('master'));

    // FFmpeg filter
    const filter = BusRouter.toFfmpegMixFilter(graph);
    expect(filter).toContain('amix');
  });

  it('validates a graph with a cycle from buildRoutingGraph simulation', () => {
    // Manually construct a graph with a cycle to test validation
    const graph: RoutingGraph = {
      nodes: [
        { id: 'a', type: 'bus', name: 'A', outputs: ['b'], inputs: ['b'] },
        { id: 'b', type: 'bus', name: 'B', outputs: ['a'], inputs: ['a'] },
      ],
      connections: [
        { fromId: 'a', toId: 'b', level: 1 },
        { fromId: 'b', toId: 'a', level: 1 },
      ],
    };

    const errors = BusRouter.validateRouting(graph);
    expect(errors.some(e => e.type === 'cycle')).toBe(true);
  });
});
