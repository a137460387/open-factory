import { describe, it, expect } from 'vitest';
import {
  createAudioMixPreset,
  serializeAudioMixPreset,
  deserializeAudioMixPreset,
  BUILTIN_AUDIO_PRESETS
} from '../src/audio/audio-mix-presets';

describe('audio-mix-presets', () => {
  describe('createAudioMixPreset', () => {
    it('should create preset with required fields', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain);

      expect(preset.name).toBe('Test Preset');
      expect(preset.chain).toEqual(chain);
      expect(preset.id).toBeDefined();
      expect(preset.createdAt).toBeDefined();
      expect(preset.updatedAt).toBeDefined();
    });

    it('should generate unique id', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset1 = createAudioMixPreset('Preset 1', chain);
      const preset2 = createAudioMixPreset('Preset 2', chain);

      expect(preset1.id).not.toBe(preset2.id);
    });

    it('should use default author if not provided', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain);

      expect(preset.author).toBe('User');
    });

    it('should use custom author if provided', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain, { author: 'Custom Author' });

      expect(preset.author).toBe('Custom Author');
    });

    it('should use custom description if provided', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain, { description: 'Custom Description' });

      expect(preset.description).toBe('Custom Description');
    });

    it('should use custom tags if provided', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain, { tags: ['custom', 'test'] });

      expect(preset.tags).toEqual(['custom', 'test']);
    });

    it('should use empty tags by default', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain);

      expect(preset.tags).toEqual([]);
    });

    it('should set createdAt and updatedAt to same time', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain);

      expect(preset.createdAt).toBe(preset.updatedAt);
    });

    it('should create valid ISO date strings', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain);

      expect(() => new Date(preset.createdAt)).not.toThrow();
      expect(() => new Date(preset.updatedAt)).not.toThrow();
    });
  });

  describe('serializeAudioMixPreset', () => {
    it('should serialize preset to JSON string', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain);

      const serialized = serializeAudioMixPreset(preset);

      expect(typeof serialized).toBe('string');
      expect(() => JSON.parse(serialized)).not.toThrow();
    });

    it('should include schema version', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain);

      const serialized = serializeAudioMixPreset(preset);
      const parsed = JSON.parse(serialized);

      expect(parsed.schemaVersion).toBe(1);
    });

    it('should include kind field', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain);

      const serialized = serializeAudioMixPreset(preset);
      const parsed = JSON.parse(serialized);

      expect(parsed.kind).toBe('open-factory.audio-mix-preset');
    });

    it('should include preset data', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain);

      const serialized = serializeAudioMixPreset(preset);
      const parsed = JSON.parse(serialized);

      expect(parsed.preset).toBeDefined();
      expect(parsed.preset.name).toBe('Test Preset');
      expect(parsed.preset.chain).toEqual(chain);
    });
  });

  describe('deserializeAudioMixPreset', () => {
    it('should deserialize valid preset JSON', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: {}, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain);
      const serialized = serializeAudioMixPreset(preset);

      const deserialized = deserializeAudioMixPreset(serialized);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.name).toBe('Test Preset');
      expect(deserialized!.chain).toEqual(chain);
    });

    it('should return null for invalid JSON', () => {
      const result = deserializeAudioMixPreset('invalid json');

      expect(result).toBeNull();
    });

    it('should return null for wrong schema version', () => {
      const invalidJson = JSON.stringify({
        schemaVersion: 2,
        kind: 'open-factory.audio-mix-preset',
        preset: {}
      });

      const result = deserializeAudioMixPreset(invalidJson);

      expect(result).toBeNull();
    });

    it('should return null for wrong kind', () => {
      const invalidJson = JSON.stringify({
        schemaVersion: 1,
        kind: 'wrong-kind',
        preset: {}
      });

      const result = deserializeAudioMixPreset(invalidJson);

      expect(result).toBeNull();
    });

    it('should preserve all preset fields', () => {
      const chain = [
        { id: 'eq', effectType: 'eq-4band', enabled: true, params: { lowFreq: 80 }, wetDry: 1, order: 0 }
      ];
      const preset = createAudioMixPreset('Test Preset', chain, {
        author: 'Test Author',
        description: 'Test Description',
        tags: ['test', 'audio']
      });
      const serialized = serializeAudioMixPreset(preset);

      const deserialized = deserializeAudioMixPreset(serialized);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.id).toBe(preset.id);
      expect(deserialized!.author).toBe('Test Author');
      expect(deserialized!.description).toBe('Test Description');
      expect(deserialized!.tags).toEqual(['test', 'audio']);
      expect(deserialized!.createdAt).toBe(preset.createdAt);
      expect(deserialized!.updatedAt).toBe(preset.updatedAt);
    });
  });

  describe('BUILTIN_AUDIO_PRESETS', () => {
    it('should have at least one preset', () => {
      expect(BUILTIN_AUDIO_PRESETS.length).toBeGreaterThan(0);
    });

    it('should have valid preset structure', () => {
      for (const preset of BUILTIN_AUDIO_PRESETS) {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.author).toBeDefined();
        expect(preset.chain).toBeDefined();
        expect(Array.isArray(preset.chain)).toBe(true);
        expect(preset.createdAt).toBeDefined();
        expect(preset.updatedAt).toBeDefined();
      }
    });

    it('should have podcast preset', () => {
      const podcastPreset = BUILTIN_AUDIO_PRESETS.find(p => p.id === 'builtin-podcast');

      expect(podcastPreset).toBeDefined();
      expect(podcastPreset!.name).toBe('播客优化');
    });

    it('should have music preset', () => {
      const musicPreset = BUILTIN_AUDIO_PRESETS.find(p => p.id === 'builtin-music');

      expect(musicPreset).toBeDefined();
      expect(musicPreset!.name).toBe('音乐增强');
    });

    it('should have valid effect chain for each preset', () => {
      for (const preset of BUILTIN_AUDIO_PRESETS) {
        for (const effect of preset.chain) {
          expect(effect.id).toBeDefined();
          expect(effect.effectType).toBeDefined();
          expect(typeof effect.enabled).toBe('boolean');
          expect(effect.params).toBeDefined();
          expect(typeof effect.wetDry).toBe('number');
          expect(typeof effect.order).toBe('number');
        }
      }
    });

    it('should have ordered effect chains', () => {
      for (const preset of BUILTIN_AUDIO_PRESETS) {
        const orders = preset.chain.map(e => e.order);
        const sortedOrders = [...orders].sort((a, b) => a - b);
        expect(orders).toEqual(sortedOrders);
      }
    });
  });

  describe('roundtrip serialization', () => {
    it('should preserve data through serialize/deserialize cycle', () => {
      const chain = [
        { id: 'hp', effectType: 'high-pass', enabled: true, params: { frequency: 80 }, wetDry: 1, order: 0 },
        { id: 'comp', effectType: 'compressor', enabled: true, params: { threshold: -20, ratio: 4 }, wetDry: 1, order: 1 }
      ];
      const original = createAudioMixPreset('Test Preset', chain, {
        author: 'Test Author',
        description: 'Test Description',
        tags: ['test']
      });

      const serialized = serializeAudioMixPreset(original);
      const deserialized = deserializeAudioMixPreset(serialized);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.id).toBe(original.id);
      expect(deserialized!.name).toBe(original.name);
      expect(deserialized!.author).toBe(original.author);
      expect(deserialized!.description).toBe(original.description);
      expect(deserialized!.tags).toEqual(original.tags);
      expect(deserialized!.chain).toEqual(original.chain);
      expect(deserialized!.createdAt).toBe(original.createdAt);
      expect(deserialized!.updatedAt).toBe(original.updatedAt);
    });
  });
});
