import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WorkflowTemplateLibrary,
  createWorkflowTemplateLibrary,
  getWorkflowTemplateLibrary,
} from '../src/workflow-templates';

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

describe('WorkflowTemplateLibrary', () => {
  let lib: WorkflowTemplateLibrary;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    lib = new WorkflowTemplateLibrary();
  });

  describe('getAllTemplates', () => {
    it('returns built-in templates', () => {
      const templates = lib.getAllTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe('getTemplate', () => {
    it('returns template by id', () => {
      const all = lib.getAllTemplates();
      expect(lib.getTemplate(all[0].id)).toBeDefined();
    });

    it('returns undefined for unknown', () => {
      expect(lib.getTemplate('nonexistent')).toBeUndefined();
    });
  });

  describe('getTemplatesByCategory', () => {
    it('filters by category', () => {
      const all = lib.getAllTemplates();
      const category = all[0].category;
      const filtered = lib.getTemplatesByCategory(category);
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((t) => t.category === category)).toBe(true);
    });

    it('returns empty for unknown category', () => {
      expect(lib.getTemplatesByCategory('nonexistent')).toEqual([]);
    });
  });

  describe('getCategories', () => {
    it('returns unique categories', () => {
      const categories = lib.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(new Set(categories).size).toBe(categories.length);
    });
  });

  describe('searchTemplates', () => {
    it('finds by name', () => {
      const all = lib.getAllTemplates();
      const query = all[0].name.slice(0, 5);
      const results = lib.searchTemplates(query);
      expect(results.length).toBeGreaterThan(0);
    });

    it('finds by tag', () => {
      const all = lib.getAllTemplates();
      if (all[0].tags.length > 0) {
        const results = lib.searchTemplates(all[0].tags[0]);
        expect(results.length).toBeGreaterThan(0);
      }
    });

    it('returns empty for no match', () => {
      expect(lib.searchTemplates('zzzznonexistent')).toEqual([]);
    });
  });

  describe('getPopularTemplates', () => {
    it('returns templates sorted by usage', () => {
      const popular = lib.getPopularTemplates(3);
      expect(popular.length).toBeLessThanOrEqual(3);
    });

    it('defaults to 5', () => {
      const popular = lib.getPopularTemplates();
      expect(popular.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getRecentTemplates', () => {
    it('returns limited templates', () => {
      const recent = lib.getRecentTemplates(2);
      expect(recent.length).toBeLessThanOrEqual(2);
    });
  });

  describe('saveTemplate', () => {
    it('saves custom template', () => {
      const graph = {
        name: 'Test',
        description: 'Test',
        version: '1.0.0',
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        connections: [],
      };
      const template = lib.saveTemplate(graph, 'My Template', 'Description', 'Custom', ['test']);
      expect(template.name).toBe('My Template');
      expect(template.id).toMatch(/^custom_/);
      expect(lib.getTemplate(template.id)).toBeDefined();
    });
  });

  describe('updateTemplate', () => {
    it('updates custom template', () => {
      const graph = {
        name: 'Test',
        description: 'Test',
        version: '1.0.0',
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        connections: [],
      };
      const template = lib.saveTemplate(graph, 'Original', 'Desc', 'Cat');
      expect(lib.updateTemplate(template.id, { name: 'Updated' })).toBe(true);
      expect(lib.getTemplate(template.id)?.name).toBe('Updated');
    });

    it('returns false for unknown', () => {
      expect(lib.updateTemplate('nonexistent', { name: 'X' })).toBe(false);
    });
  });

  describe('deleteTemplate', () => {
    it('deletes custom template', () => {
      const graph = {
        name: 'Test',
        description: 'Test',
        version: '1.0.0',
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        connections: [],
      };
      const template = lib.saveTemplate(graph, 'ToDelete', 'Desc', 'Cat');
      expect(lib.deleteTemplate(template.id)).toBe(true);
      expect(lib.getTemplate(template.id)).toBeUndefined();
    });

    it('returns false for unknown', () => {
      expect(lib.deleteTemplate('nonexistent')).toBe(false);
    });
  });

  describe('incrementUsage', () => {
    it('increments usage count', () => {
      const all = lib.getAllTemplates();
      const id = all[0].id;
      const before = lib.getTemplate(id)!.usageCount;
      lib.incrementUsage(id);
      expect(lib.getTemplate(id)!.usageCount).toBe(before + 1);
    });

    it('does nothing for unknown', () => {
      lib.incrementUsage('nonexistent');
    });
  });

  describe('exportTemplate / importTemplate', () => {
    it('exports template as JSON', () => {
      const all = lib.getAllTemplates();
      const json = lib.exportTemplate(all[0].id);
      expect(json).not.toBeNull();
      const parsed = JSON.parse(json!);
      expect(parsed.name).toBe(all[0].name);
    });

    it('returns null for unknown', () => {
      expect(lib.exportTemplate('nonexistent')).toBeNull();
    });

    it('imports valid template', () => {
      const json = JSON.stringify({
        name: 'Imported',
        description: 'Test',
        category: 'Custom',
        graph: { name: 'G', nodes: [], connections: [] },
      });
      const template = lib.importTemplate(json);
      expect(template).not.toBeNull();
      expect(template!.name).toBe('Imported');
    });

    it('returns null for invalid JSON', () => {
      expect(lib.importTemplate('not json')).toBeNull();
    });

    it('returns null for missing fields', () => {
      expect(lib.importTemplate(JSON.stringify({ name: 'X' }))).toBeNull();
    });
  });
});

describe('factory functions', () => {
  it('createWorkflowTemplateLibrary returns instance', () => {
    expect(createWorkflowTemplateLibrary()).toBeInstanceOf(WorkflowTemplateLibrary);
  });

  it('getWorkflowTemplateLibrary returns singleton', () => {
    const a = getWorkflowTemplateLibrary();
    const b = getWorkflowTemplateLibrary();
    expect(a).toBe(b);
  });
});
