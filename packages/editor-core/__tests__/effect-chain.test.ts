import { describe, it, expect } from 'vitest';
import { EffectChainEngine } from '../src/audio/effect-chain';
import type { AudioEffectSlot } from '../src/audio/mixer-types';

function makeEffect(overrides: Partial<AudioEffectSlot> = {}): AudioEffectSlot {
  return {
    id: 'fx-1',
    effectType: 'compressor',
    enabled: true,
    params: { threshold: -20, ratio: 4 },
    wetDry: 1,
    order: 0,
    ...overrides,
  };
}

describe('EffectChainEngine', () => {
  describe('sortChain', () => {
    it('sorts by order', () => {
      const effects = [
        makeEffect({ id: 'a', order: 2 }),
        makeEffect({ id: 'b', order: 1 }),
        makeEffect({ id: 'c', order: 3 }),
      ];
      const sorted = EffectChainEngine.sortChain(effects);
      expect(sorted.map((e) => e.id)).toEqual(['b', 'a', 'c']);
    });

    it('filters out disabled effects', () => {
      const effects = [
        makeEffect({ id: 'a', enabled: true, order: 1 }),
        makeEffect({ id: 'b', enabled: false, order: 2 }),
      ];
      const sorted = EffectChainEngine.sortChain(effects);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe('a');
    });

    it('returns empty for empty input', () => {
      expect(EffectChainEngine.sortChain([])).toEqual([]);
    });

    it('does not mutate input', () => {
      const effects = [makeEffect({ id: 'a', order: 2 }), makeEffect({ id: 'b', order: 1 })];
      const original = [...effects];
      EffectChainEngine.sortChain(effects);
      expect(effects).toEqual(original);
    });
  });

  describe('validateParams', () => {
    it('clamps compressor threshold to range', () => {
      const result = EffectChainEngine.validateParams('compressor', { threshold: -100 });
      expect(result.threshold).toBe(-60);
    });

    it('clamps compressor ratio to range', () => {
      const result = EffectChainEngine.validateParams('compressor', { ratio: 100 });
      expect(result.ratio).toBe(20);
    });

    it('preserves params within range', () => {
      const result = EffectChainEngine.validateParams('compressor', { threshold: -20, ratio: 4 });
      expect(result.threshold).toBe(-20);
      expect(result.ratio).toBe(4);
    });

    it('returns params unchanged for unknown effect type', () => {
      const params = { foo: 42 };
      const result = EffectChainEngine.validateParams('unknown' as any, params);
      expect(result).toEqual(params);
    });

    it('does not mutate input params', () => {
      const params = { threshold: -100 };
      EffectChainEngine.validateParams('compressor', params);
      expect(params.threshold).toBe(-100);
    });
  });

  describe('describeNodeGraph', () => {
    it('returns descriptions for enabled effects', () => {
      const effects = [
        makeEffect({ effectType: 'compressor', params: { threshold: -20 }, wetDry: 0.8, order: 1 }),
      ];
      const graph = EffectChainEngine.describeNodeGraph(effects);
      expect(graph).toHaveLength(1);
      expect(graph[0].type).toBe('compressor');
      expect(graph[0].wetDry).toBe(0.8);
    });

    it('skips disabled effects', () => {
      const effects = [makeEffect({ enabled: false })];
      expect(EffectChainEngine.describeNodeGraph(effects)).toEqual([]);
    });
  });
});
