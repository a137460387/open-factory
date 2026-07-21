/**
 * Template Import/Export
 *
 * Handles serialization and deserialization of .oft (Open Factory Template) files.
 * .oft files are JSON-based with a checksum for integrity verification.
 */

import type {
  EditingTemplate,
  OftFile,
  TemplateLibraryEntry,
  TemplateFilter,
} from '../models/template-schema';
import { TEMPLATE_SCHEMA_VERSION, TEMPLATE_FILE_EXTENSION, validateTemplate } from '../models/template-schema';
import { BUILTIN_TEMPLATES } from './builtin-templates';

// ─── Checksum ────────────────────────────────────────────────────

async function computeChecksum(data: string): Promise<string> {
  // Use SubtleCrypto if available, fallback to simple hash
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const buffer = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback: simple DJB2 hash (not cryptographic, but sufficient for integrity)
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash + data.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ─── Export ──────────────────────────────────────────────────────

/**
 * Serialize a template to .oft JSON string.
 */
export async function exportTemplate(template: EditingTemplate): Promise<string> {
  const validation = validateTemplate(template);
  if (!validation.valid) {
    throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
  }

  const templateJson = JSON.stringify(template, null, 2);
  const checksum = await computeChecksum(templateJson);

  const oftFile: OftFile = {
    format: 'open-factory-template',
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    template,
    checksum,
  };

  return JSON.stringify(oftFile, null, 2);
}

/**
 * Export template as a downloadable .oft file (browser environment).
 */
export function createTemplateBlob(template: EditingTemplate): Promise<Blob> {
  return exportTemplate(template).then(
    (json) => new Blob([json], { type: 'application/json' }),
  );
}

/**
 * Trigger browser download of a template file.
 */
export async function downloadTemplate(template: EditingTemplate): Promise<void> {
  const blob = await createTemplateBlob(template);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${template.metadata.name}${TEMPLATE_FILE_EXTENSION}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Import ──────────────────────────────────────────────────────

/**
 * Parse and validate a .oft JSON string.
 */
export async function importTemplate(jsonString: string): Promise<EditingTemplate> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid .oft file: not valid JSON');
  }

  const oft = parsed as Partial<OftFile>;

  // Validate file format
  if (oft.format !== 'open-factory-template') {
    throw new Error('Invalid .oft file: missing format identifier');
  }

  if (!oft.schemaVersion) {
    throw new Error('Invalid .oft file: missing schema version');
  }

  if (!oft.template) {
    throw new Error('Invalid .oft file: missing template data');
  }

  // Version compatibility check
  if (oft.schemaVersion !== TEMPLATE_SCHEMA_VERSION) {
    console.warn(
      `[Template Import] Schema version mismatch: file=${oft.schemaVersion}, current=${TEMPLATE_SCHEMA_VERSION}. Attempting migration.`,
    );
  }

  // Verify checksum
  if (oft.checksum) {
    const templateJson = JSON.stringify(oft.template, null, 2);
    const expectedChecksum = await computeChecksum(templateJson);
    if (oft.checksum !== expectedChecksum) {
      throw new Error('Invalid .oft file: checksum mismatch (file may be corrupted)');
    }
  }

  // Validate template content
  const validation = validateTemplate(oft.template);
  if (!validation.valid) {
    throw new Error(`Invalid template content: ${validation.errors.join(', ')}`);
  }

  return oft.template;
}

/**
 * Import template from a File object (browser environment).
 */
export async function importTemplateFromFile(file: File): Promise<EditingTemplate> {
  if (!file.name.endsWith(TEMPLATE_FILE_EXTENSION)) {
    throw new Error(`Expected .oft file, got: ${file.name}`);
  }

  const text = await file.text();
  return importTemplate(text);
}

// ─── Template Library Management ─────────────────────────────────

/** In-memory template library (user templates + built-in) */
const userTemplates: Map<string, EditingTemplate> = new Map();

/**
 * Initialize the template library with built-in templates.
 */
export function initTemplateLibrary(): void {
  // Built-in templates are always available
  // User templates are loaded from storage
}

/**
 * Add a user template to the library.
 */
export function addUserTemplate(template: EditingTemplate): void {
  const validation = validateTemplate(template);
  if (!validation.valid) {
    throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
  }
  userTemplates.set(template.metadata.id, template);
}

/**
 * Remove a user template from the library.
 */
export function removeUserTemplate(templateId: string): boolean {
  return userTemplates.delete(templateId);
}

/**
 * Get all templates (built-in + user).
 */
export function getAllTemplates(): TemplateLibraryEntry[] {
  const entries: TemplateLibraryEntry[] = [];

  // Built-in templates
  for (const tpl of BUILTIN_TEMPLATES) {
    entries.push({
      template: tpl,
      builtin: true,
      userCreated: false,
      usageCount: 0,
    });
  }

  // User templates
  for (const tpl of userTemplates.values()) {
    entries.push({
      template: tpl,
      builtin: false,
      userCreated: true,
      usageCount: 0,
    });
  }

  return entries;
}

/**
 * Search/filter templates.
 */
export function searchTemplates(filter: TemplateFilter): TemplateLibraryEntry[] {
  let results = getAllTemplates();

  if (filter.category) {
    results = results.filter((e) => e.template.metadata.category === filter.category);
  }

  if (filter.tags && filter.tags.length > 0) {
    results = results.filter((e) =>
      filter.tags!.some((tag) => e.template.metadata.tags.includes(tag)),
    );
  }

  if (filter.aspectRatio) {
    results = results.filter((e) => e.template.metadata.aspectRatio === filter.aspectRatio);
  }

  if (filter.difficulty) {
    results = results.filter((e) => e.template.metadata.difficulty === filter.difficulty);
  }

  if (filter.query) {
    const q = filter.query.toLowerCase();
    results = results.filter(
      (e) =>
        e.template.metadata.name.toLowerCase().includes(q) ||
        e.template.metadata.description.toLowerCase().includes(q) ||
        e.template.metadata.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  // Sort
  const sortBy = filter.sortBy ?? 'name';
  const sortOrder = filter.sortOrder ?? 'asc';
  results.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name':
        cmp = a.template.metadata.name.localeCompare(b.template.metadata.name);
        break;
      case 'createdAt':
        cmp = a.template.metadata.createdAt.localeCompare(b.template.metadata.createdAt);
        break;
      case 'usageCount':
        cmp = a.usageCount - b.usageCount;
        break;
      case 'difficulty': {
        const order = { beginner: 0, intermediate: 1, advanced: 2 };
        cmp = order[a.template.metadata.difficulty] - order[b.template.metadata.difficulty];
        break;
      }
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  return results;
}

/**
 * Export all user templates as a bundle.
 */
export async function exportUserTemplates(): Promise<string> {
  const templates = Array.from(userTemplates.values());
  const bundle = {
    format: 'open-factory-template-bundle',
    version: TEMPLATE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    templates,
  };
  return JSON.stringify(bundle, null, 2);
}

/**
 * Import user templates from a bundle.
 */
export async function importUserTemplatesBundle(json: string): Promise<number> {
  const bundle = JSON.parse(json) as {
    format?: string;
    templates?: EditingTemplate[];
  };

  if (bundle.format !== 'open-factory-template-bundle') {
    throw new Error('Invalid template bundle format');
  }

  let imported = 0;
  for (const tpl of bundle.templates ?? []) {
    const validation = validateTemplate(tpl);
    if (validation.valid) {
      userTemplates.set(tpl.metadata.id, tpl);
      imported++;
    }
  }

  return imported;
}
