import { describe, it, expect } from 'vitest';
import {
  createColorGradingPreset,
  serializeColorGradingPreset,
  deserializeColorGradingPreset,
  validateColorGradingPreset,
  BUILTIN_COLOR_PRESETS,
} from '../../src/color-grading/color-grading-presets';
import type { ColorGradingGraph } from '../../src/color-grading/types';

const emptyGraph: ColorGradingGraph = {
  nodes: [],
  connections: [],
  activeNodeId: null,
};

const sampleGraph: ColorGradingGraph = {
  nodes: [
    {
      id: 'node-1',
      type: 'primary-wheel',
      enabled: true,
      params: {
        lift: { r: 0, g: 0, b: 0, y: 0 },
        liftMaster: 0,
        gamma: { r: 0, g: 0, b: 0, y: 0 },
        gammaMaster: 0,
        gain: { r: 0.05, g: 0.03, b: -0.03, y: 0 },
        gainMaster: 0,
        offset: { r: 0, g: 0, b: 0, y: 0 },
        offsetMaster: 0,
      },
      inputs: [],
      output: null,
      position: { x: 0, y: 0 },
    },
  ],
  connections: [],
  activeNodeId: null,
};

describe('createColorGradingPreset', () => {
  it('creates a preset with required fields', () => {
    const preset = createColorGradingPreset('Test Preset', emptyGraph);

    expect(preset.name).toBe('Test Preset');
    expect(preset.graph).toBe(emptyGraph);
    expect(preset.author).toBe('User');
    expect(preset.tags).toEqual([]);
    expect(preset.id).toMatch(/^preset-/);
    expect(Date.parse(preset.createdAt)).not.toBeNaN();
    expect(Date.parse(preset.updatedAt)).not.toBeNaN();
    expect(preset.createdAt).toBe(preset.updatedAt);
  });

  it('creates a preset with custom options', () => {
    const preset = createColorGradingPreset('Custom', sampleGraph, {
      author: 'TestAuthor',
      description: 'A test preset',
      tags: ['cinematic', 'warm'],
      thumbnail: 'data:image/png;base64,abc',
    });

    expect(preset.author).toBe('TestAuthor');
    expect(preset.description).toBe('A test preset');
    expect(preset.tags).toEqual(['cinematic', 'warm']);
    expect(preset.thumbnail).toBe('data:image/png;base64,abc');
  });

  it('generates unique ids for different presets', () => {
    const p1 = createColorGradingPreset('A', emptyGraph);
    const p2 = createColorGradingPreset('B', emptyGraph);
    expect(p1.id).not.toBe(p2.id);
  });
});

describe('serializeColorGradingPreset', () => {
  it('serializes a preset to a JSON string with correct schema', () => {
    const preset = createColorGradingPreset('Serialize Test', emptyGraph, { author: 'Dev' });
    const json = serializeColorGradingPreset(preset);
    const parsed = JSON.parse(json);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.kind).toBe('open-factory.color-grading-preset');
    expect(parsed.preset.name).toBe('Serialize Test');
    expect(parsed.preset.author).toBe('Dev');
  });

  it('produces valid JSON with formatting', () => {
    const preset = createColorGradingPreset('Formatted', emptyGraph);
    const json = serializeColorGradingPreset(preset);
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });
});

describe('deserializeColorGradingPreset', () => {
  it('roundtrips through serialize/deserialize', () => {
    const original = createColorGradingPreset('Roundtrip', sampleGraph, {
      author: 'Tester',
      description: 'Roundtrip test',
      tags: ['test'],
    });
    const json = serializeColorGradingPreset(original);
    const restored = deserializeColorGradingPreset(json);

    expect(restored).not.toBeNull();
    expect(restored!.id).toBe(original.id);
    expect(restored!.name).toBe(original.name);
    expect(restored!.author).toBe(original.author);
    expect(restored!.description).toBe(original.description);
    expect(restored!.tags).toEqual(original.tags);
    expect(restored!.graph).toEqual(original.graph);
  });

  it('returns null for invalid schemaVersion', () => {
    const json = JSON.stringify({ schemaVersion: 2, kind: 'open-factory.color-grading-preset', preset: {} });
    expect(deserializeColorGradingPreset(json)).toBeNull();
  });

  it('returns null for wrong kind', () => {
    const json = JSON.stringify({ schemaVersion: 1, kind: 'wrong-kind', preset: {} });
    expect(deserializeColorGradingPreset(json)).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(deserializeColorGradingPreset('not json')).toBeNull();
    expect(deserializeColorGradingPreset('')).toBeNull();
  });
});

describe('validateColorGradingPreset', () => {
  it('returns true for a valid preset', () => {
    const preset = createColorGradingPreset('Valid', emptyGraph);
    expect(validateColorGradingPreset(preset)).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(validateColorGradingPreset(null)).toBe(false);
    expect(validateColorGradingPreset(undefined)).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(validateColorGradingPreset('string')).toBe(false);
    expect(validateColorGradingPreset(42)).toBe(false);
  });

  it('returns false when required fields are missing', () => {
    expect(validateColorGradingPreset({ id: 'x', name: 'x', author: 'x' })).toBe(false);
    expect(validateColorGradingPreset({ id: 'x', name: 'x', graph: {}, createdAt: 'x' })).toBe(false);
    expect(validateColorGradingPreset({ id: 123, name: 'x', author: 'x', graph: {}, createdAt: 'x' })).toBe(false);
  });
});

describe('BUILTIN_COLOR_PRESETS', () => {
  it('contains at least one preset', () => {
    expect(BUILTIN_COLOR_PRESETS.length).toBeGreaterThan(0);
  });

  it('each builtin preset passes validation', () => {
    for (const preset of BUILTIN_COLOR_PRESETS) {
      expect(validateColorGradingPreset(preset)).toBe(true);
    }
  });

  it('each builtin preset has a valid graph with nodes', () => {
    for (const preset of BUILTIN_COLOR_PRESETS) {
      expect(preset.graph).toBeDefined();
      expect(Array.isArray(preset.graph.nodes)).toBe(true);
      expect(preset.graph.nodes.length).toBeGreaterThan(0);
    }
  });

  it('each builtin preset serializes and deserializes correctly', () => {
    for (const preset of BUILTIN_COLOR_PRESETS) {
      const json = serializeColorGradingPreset(preset);
      const restored = deserializeColorGradingPreset(json);
      expect(restored).toEqual(preset);
    }
  });

  it('cinematic preset has expected structure', () => {
    const cinematic = BUILTIN_COLOR_PRESETS.find((p) => p.id === 'builtin-cinematic');
    expect(cinematic).toBeDefined();
    expect(cinematic!.name).toBe('电影感');
    expect(cinematic!.tags).toContain('cinematic');
    expect(cinematic!.graph.nodes.length).toBe(2);
    expect(cinematic!.graph.nodes[0].type).toBe('primary-wheel');
    expect(cinematic!.graph.nodes[1].type).toBe('primary-slider');
  });

  it('vintage preset has expected structure', () => {
    const vintage = BUILTIN_COLOR_PRESETS.find((p) => p.id === 'builtin-vintage');
    expect(vintage).toBeDefined();
    expect(vintage!.name).toBe('复古');
    expect(vintage!.tags).toContain('vintage');
    expect(vintage!.graph.nodes.length).toBe(2);
  });
});
