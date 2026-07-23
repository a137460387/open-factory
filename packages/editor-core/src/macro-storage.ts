/**
 * Macro Storage - Persistent storage for macro definitions
 *
 * Handles saving, loading, importing, and exporting macros.
 * Supports file-based storage with JSON serialization.
 */

import type {
  MacroDefinition,
  MacroLibrary,
  MacroCategory,
} from './macro-types';

const STORAGE_KEY = 'open-factory-macros';
const MACRO_VERSION = '1.0.0';

/**
 * Macro storage manager
 */
export class MacroStorage {
  private library: MacroLibrary;

  constructor() {
    this.library = this.loadLibrary();
  }

  // ─── Library Management ──────────────────────────────────────────────────

  /** Get all macros */
  getAllMacros(): MacroDefinition[] {
    return [...this.library.macros];
  }

  /** Get macro by ID */
  getMacro(id: string): MacroDefinition | undefined {
    return this.library.macros.find(m => m.id === id);
  }

  /** Save a macro */
  saveMacro(macro: MacroDefinition): void {
    const existingIndex = this.library.macros.findIndex(m => m.id === macro.id);
    const updatedMacro = {
      ...macro,
      updatedAt: new Date().toISOString(),
      version: MACRO_VERSION,
    };

    if (existingIndex >= 0) {
      this.library.macros[existingIndex] = updatedMacro;
    } else {
      this.library.macros.push(updatedMacro);
    }

    this.persistLibrary();
  }

  /** Delete a macro */
  deleteMacro(id: string): boolean {
    const initialLength = this.library.macros.length;
    this.library.macros = this.library.macros.filter(m => m.id !== id);

    if (this.library.macros.length < initialLength) {
      // Remove from categories
      for (const category of this.library.categories) {
        category.macroIds = category.macroIds.filter(mId => mId !== id);
      }
      this.persistLibrary();
      return true;
    }
    return false;
  }

  /** Update macro metadata */
  updateMacroMetadata(
    id: string,
    updates: Partial<Pick<MacroDefinition, 'name' | 'description' | 'tags'>>,
  ): boolean {
    const macro = this.getMacro(id);
    if (!macro) return false;

    Object.assign(macro, updates, { updatedAt: new Date().toISOString() });
    this.persistLibrary();
    return true;
  }

  // ─── Categories ──────────────────────────────────────────────────────────

  /** Get all categories */
  getCategories(): MacroCategory[] {
    return [...this.library.categories];
  }

  /** Create a category */
  createCategory(name: string, description?: string): MacroCategory {
    const category: MacroCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name,
      description,
      macroIds: [],
    };
    this.library.categories.push(category);
    this.persistLibrary();
    return category;
  }

  /** Add macro to category */
  addToCategory(macroId: string, categoryId: string): boolean {
    const category = this.library.categories.find(c => c.id === categoryId);
    const macro = this.getMacro(macroId);
    if (!category || !macro) return false;

    if (!category.macroIds.includes(macroId)) {
      category.macroIds.push(macroId);
      this.persistLibrary();
    }
    return true;
  }

  /** Remove macro from category */
  removeFromCategory(macroId: string, categoryId: string): boolean {
    const category = this.library.categories.find(c => c.id === categoryId);
    if (!category) return false;

    const initialLength = category.macroIds.length;
    category.macroIds = category.macroIds.filter(id => id !== macroId);

    if (category.macroIds.length < initialLength) {
      this.persistLibrary();
      return true;
    }
    return false;
  }

  /** Get macros in a category */
  getMacrosByCategory(categoryId: string): MacroDefinition[] {
    const category = this.library.categories.find(c => c.id === categoryId);
    if (!category) return [];

    return category.macroIds
      .map(id => this.getMacro(id))
      .filter((m): m is MacroDefinition => m !== undefined);
  }

  // ─── Import/Export ───────────────────────────────────────────────────────

  /** Export a macro to JSON string */
  exportMacro(id: string): string | null {
    const macro = this.getMacro(id);
    if (!macro) return null;

    return JSON.stringify(macro, null, 2);
  }

  /** Export all macros to JSON string */
  exportAll(): string {
    return JSON.stringify(this.library, null, 2);
  }

  /** Import a macro from JSON string */
  importMacro(json: string): MacroDefinition | null {
    try {
      const parsed = JSON.parse(json);

      // Validate basic structure
      if (!this.isValidMacroDefinition(parsed)) {
        return null;
      }

      // Generate new ID to avoid conflicts
      const macro: MacroDefinition = {
        ...parsed,
        id: `macro_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        executionCount: 0,
      };

      this.saveMacro(macro);
      return macro;
    } catch {
      return null;
    }
  }

  /** Import library from JSON string */
  importLibrary(json: string): boolean {
    try {
      const parsed = JSON.parse(json);

      if (!this.isValidLibrary(parsed)) {
        return false;
      }

      // Merge with existing library
      for (const macro of parsed.macros) {
        if (!this.getMacro(macro.id)) {
          this.library.macros.push(macro);
        }
      }

      for (const category of parsed.categories) {
        if (!this.library.categories.find(c => c.id === category.id)) {
          this.library.categories.push(category);
        }
      }

      this.persistLibrary();
      return true;
    } catch {
      return false;
    }
  }

  // ─── Search ──────────────────────────────────────────────────────────────

  /** Search macros by name or tags */
  searchMacros(query: string): MacroDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.library.macros.filter(
      m =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.description.toLowerCase().includes(lowerQuery) ||
        m.tags.some(t => t.toLowerCase().includes(lowerQuery)),
    );
  }

  /** Get recent macros */
  getRecentMacros(limit: number = 10): MacroDefinition[] {
    return [...this.library.macros]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  /** Increment execution count */
  incrementExecutionCount(id: string): void {
    const macro = this.getMacro(id);
    if (macro) {
      macro.executionCount++;
      this.persistLibrary();
    }
  }

  // ─── Validation ──────────────────────────────────────────────────────────

  private isValidMacroDefinition(obj: unknown): obj is MacroDefinition {
    if (typeof obj !== 'object' || obj === null) return false;
    const macro = obj as Record<string, unknown>;
    return (
      typeof macro.name === 'string' &&
      typeof macro.version === 'string' &&
      Array.isArray(macro.operations) &&
      Array.isArray(macro.parameters)
    );
  }

  private isValidLibrary(obj: unknown): obj is MacroLibrary {
    if (typeof obj !== 'object' || obj === null) return false;
    const lib = obj as Record<string, unknown>;
    return Array.isArray(lib.macros) && Array.isArray(lib.categories);
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  private loadLibrary(): MacroLibrary {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (this.isValidLibrary(parsed)) {
            return parsed;
          }
        }
      }
    } catch {
      // Ignore load errors
    }

    return this.createDefaultLibrary();
  }

  private persistLibrary(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        this.library.lastModified = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.library));
      }
    } catch {
      // Ignore save errors
    }
  }

  private createDefaultLibrary(): MacroLibrary {
    return {
      macros: [],
      categories: [
        {
          id: 'builtin',
          name: 'Built-in',
          description: 'Built-in macro templates',
          macroIds: [],
        },
        {
          id: 'custom',
          name: 'Custom',
          description: 'User-created macros',
          macroIds: [],
        },
      ],
      lastModified: new Date().toISOString(),
    };
  }
}

/**
 * Create a macro storage instance
 */
export function createMacroStorage(): MacroStorage {
  return new MacroStorage();
}

/**
 * Macro storage singleton
 */
let macroStorageInstance: MacroStorage | null = null;

export function getMacroStorage(): MacroStorage {
  if (!macroStorageInstance) {
    macroStorageInstance = new MacroStorage();
  }
  return macroStorageInstance;
}
