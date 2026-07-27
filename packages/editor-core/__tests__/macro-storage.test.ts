import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MacroStorage } from '../src/macro-storage';
import type { MacroDefinition } from '../src/macro-types';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
Object.defineProperty(globalThis, 'window', { value: { localStorage: localStorageMock }, configurable: true });

function makeMacro(overrides: Partial<MacroDefinition> = {}): MacroDefinition {
  return {
    id: 'macro-1',
    name: 'Test Macro',
    description: 'A test macro',
    version: '1.0.0',
    tags: ['test'],
    operations: [{ type: 'set-property', target: 'clip', property: 'opacity', value: 0.5 }],
    parameters: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionCount: 0,
    ...overrides,
  };
}

describe('MacroStorage', () => {
  let storage: MacroStorage;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    storage = new MacroStorage();
  });

  describe('getAllMacros / getMacro', () => {
    it('starts empty', () => {
      expect(storage.getAllMacros()).toEqual([]);
    });

    it('returns undefined for unknown', () => {
      expect(storage.getMacro('nonexistent')).toBeUndefined();
    });
  });

  describe('saveMacro', () => {
    it('saves new macro', () => {
      storage.saveMacro(makeMacro());
      expect(storage.getAllMacros()).toHaveLength(1);
      expect(storage.getMacro('macro-1')).toBeDefined();
    });

    it('updates existing macro', () => {
      storage.saveMacro(makeMacro());
      storage.saveMacro(makeMacro({ name: 'Updated' }));
      expect(storage.getAllMacros()).toHaveLength(1);
      expect(storage.getMacro('macro-1')?.name).toBe('Updated');
    });
  });

  describe('deleteMacro', () => {
    it('deletes macro', () => {
      storage.saveMacro(makeMacro());
      expect(storage.deleteMacro('macro-1')).toBe(true);
      expect(storage.getMacro('macro-1')).toBeUndefined();
    });

    it('returns false for unknown', () => {
      expect(storage.deleteMacro('nonexistent')).toBe(false);
    });

    it('removes from categories', () => {
      storage.saveMacro(makeMacro());
      const cat = storage.createCategory('Test');
      storage.addToCategory('macro-1', cat.id);
      storage.deleteMacro('macro-1');
      expect(storage.getMacrosByCategory(cat.id)).toEqual([]);
    });
  });

  describe('updateMacroMetadata', () => {
    it('updates metadata', () => {
      storage.saveMacro(makeMacro());
      expect(storage.updateMacroMetadata('macro-1', { name: 'New Name' })).toBe(true);
      expect(storage.getMacro('macro-1')?.name).toBe('New Name');
    });

    it('returns false for unknown', () => {
      expect(storage.updateMacroMetadata('nonexistent', { name: 'X' })).toBe(false);
    });
  });

  describe('categories', () => {
    it('creates category', () => {
      const before = storage.getCategories().length;
      const cat = storage.createCategory('My Category', 'Description');
      expect(cat.name).toBe('My Category');
      expect(storage.getCategories()).toHaveLength(before + 1);
    });

    it('adds macro to category', () => {
      storage.saveMacro(makeMacro());
      const cat = storage.createCategory('Cat');
      expect(storage.addToCategory('macro-1', cat.id)).toBe(true);
      expect(storage.getMacrosByCategory(cat.id)).toHaveLength(1);
    });

    it('returns false for unknown macro/category', () => {
      const cat = storage.createCategory('Cat');
      expect(storage.addToCategory('nonexistent', cat.id)).toBe(false);
      expect(storage.addToCategory('macro-1', 'nonexistent')).toBe(false);
    });

    it('does not duplicate macro in category', () => {
      storage.saveMacro(makeMacro());
      const cat = storage.createCategory('Cat');
      storage.addToCategory('macro-1', cat.id);
      storage.addToCategory('macro-1', cat.id);
      expect(storage.getMacrosByCategory(cat.id)).toHaveLength(1);
    });

    it('removes macro from category', () => {
      storage.saveMacro(makeMacro());
      const cat = storage.createCategory('Cat');
      storage.addToCategory('macro-1', cat.id);
      expect(storage.removeFromCategory('macro-1', cat.id)).toBe(true);
      expect(storage.getMacrosByCategory(cat.id)).toEqual([]);
    });

    it('returns false for unknown category on remove', () => {
      expect(storage.removeFromCategory('m', 'nonexistent')).toBe(false);
    });

    it('returns false when macro not in category', () => {
      const cat = storage.createCategory('Cat');
      expect(storage.removeFromCategory('nonexistent', cat.id)).toBe(false);
    });

    it('getMacrosByCategory returns empty for unknown', () => {
      expect(storage.getMacrosByCategory('nonexistent')).toEqual([]);
    });
  });

  describe('import/export', () => {
    it('exports macro as JSON', () => {
      storage.saveMacro(makeMacro());
      const json = storage.exportMacro('macro-1');
      expect(json).not.toBeNull();
      const parsed = JSON.parse(json!);
      expect(parsed.name).toBe('Test Macro');
    });

    it('returns null for unknown', () => {
      expect(storage.exportMacro('nonexistent')).toBeNull();
    });

    it('exports all as JSON', () => {
      storage.saveMacro(makeMacro());
      const json = storage.exportAll();
      const parsed = JSON.parse(json);
      expect(parsed.macros).toHaveLength(1);
    });

    it('imports macro from JSON', () => {
      const json = JSON.stringify(makeMacro({ id: 'original' }));
      const macro = storage.importMacro(json);
      expect(macro).not.toBeNull();
      expect(macro!.name).toBe('Test Macro');
      expect(macro!.id).not.toBe('original'); // new ID generated
    });

    it('returns null for invalid JSON', () => {
      expect(storage.importMacro('not json')).toBeNull();
    });

    it('returns null for missing required fields', () => {
      expect(storage.importMacro(JSON.stringify({ name: 'X' }))).toBeNull();
    });

    it('imports library', () => {
      const library = {
        macros: [makeMacro()],
        categories: [{ id: 'cat-1', name: 'Cat', macroIds: ['macro-1'] }],
      };
      expect(storage.importLibrary(JSON.stringify(library))).toBe(true);
      expect(storage.getAllMacros()).toHaveLength(1);
    });

    it('returns false for invalid library', () => {
      expect(storage.importLibrary('not json')).toBe(false);
      expect(storage.importLibrary(JSON.stringify({ macros: 'not array' }))).toBe(false);
    });

    it('does not duplicate on import', () => {
      storage.saveMacro(makeMacro());
      const library = { macros: [makeMacro()], categories: [] };
      storage.importLibrary(JSON.stringify(library));
      expect(storage.getAllMacros()).toHaveLength(1);
    });
  });

  describe('searchMacros', () => {
    it('finds by name', () => {
      storage.saveMacro(makeMacro());
      expect(storage.searchMacros('Test')).toHaveLength(1);
    });

    it('finds by tag', () => {
      storage.saveMacro(makeMacro());
      expect(storage.searchMacros('test')).toHaveLength(1);
    });

    it('returns empty for no match', () => {
      storage.saveMacro(makeMacro());
      expect(storage.searchMacros('zzzzz')).toEqual([]);
    });
  });

  describe('getRecentMacros', () => {
    it('returns macros sorted by updatedAt', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2020-01-01'));
      storage.saveMacro(makeMacro({ id: 'a' }));
      vi.setSystemTime(new Date('2025-01-01'));
      storage.saveMacro(makeMacro({ id: 'b' }));
      vi.useRealTimers();
      const recent = storage.getRecentMacros();
      expect(recent[0].id).toBe('b');
    });

    it('respects limit', () => {
      for (let i = 0; i < 20; i++) {
        storage.saveMacro(makeMacro({ id: `m-${i}` }));
      }
      expect(storage.getRecentMacros(5)).toHaveLength(5);
    });
  });

  describe('incrementExecutionCount', () => {
    it('increments count', () => {
      storage.saveMacro(makeMacro());
      storage.incrementExecutionCount('macro-1');
      expect(storage.getMacro('macro-1')?.executionCount).toBe(1);
    });

    it('does nothing for unknown', () => {
      storage.incrementExecutionCount('nonexistent');
    });
  });
});
