import {
  BUILTIN_SUBTITLE_STYLE_TEMPLATES,
  normalizeSubtitleStyleTemplateStyle,
  type SubtitleStyle,
  type SubtitleStyleTemplate,
} from '@open-factory/editor-core';
import { fsExists, getAppDataDir, readFile, writeFile } from './tauri-bridge';

interface StoredSubtitleStyleTemplatesFile {
  schemaVersion: 1;
  templates: Array<Omit<SubtitleStyleTemplate, 'kind'>>;
}

export interface SubtitleStyleTemplateStorage {
  getAppDataDir(): Promise<string> | string;
  fsExists(path: string): Promise<boolean> | boolean;
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
}

const SUBTITLE_STYLE_TEMPLATES_FILE = 'subtitle-styles.json';

const bridgeSubtitleStyleTemplateStorage: SubtitleStyleTemplateStorage = {
  getAppDataDir,
  fsExists,
  readFile,
  writeFile,
};

export function getSubtitleStyleTemplatesPath(appDataDir: string): string {
  return `${appDataDir.replace(/[\\/]+$/, '')}/${SUBTITLE_STYLE_TEMPLATES_FILE}`;
}

export async function loadSubtitleStyleTemplates(
  storage: SubtitleStyleTemplateStorage = bridgeSubtitleStyleTemplateStorage,
): Promise<SubtitleStyleTemplate[]> {
  const customTemplates = await loadCustomSubtitleStyleTemplates(storage);
  return mergeSubtitleStyleTemplates(customTemplates);
}

export async function saveCustomSubtitleStyleTemplate(
  name: string,
  style: Partial<SubtitleStyle>,
  storage: SubtitleStyleTemplateStorage = bridgeSubtitleStyleTemplateStorage,
): Promise<SubtitleStyleTemplate[]> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Subtitle style template name is required');
  }
  const customs = await loadCustomSubtitleStyleTemplates(storage);
  const nextTemplate: SubtitleStyleTemplate = {
    id: createCustomSubtitleStyleTemplateId(trimmedName, customs),
    kind: 'custom',
    name: trimmedName,
    style: normalizeSubtitleStyleTemplateStyle(style),
  };
  await writeCustomSubtitleStyleTemplates([...customs, nextTemplate], storage);
  return mergeSubtitleStyleTemplates([...customs, nextTemplate]);
}

export async function deleteCustomSubtitleStyleTemplate(
  id: string,
  storage: SubtitleStyleTemplateStorage = bridgeSubtitleStyleTemplateStorage,
): Promise<SubtitleStyleTemplate[]> {
  if (BUILTIN_SUBTITLE_STYLE_TEMPLATES.some((template) => template.id === id)) {
    throw new Error('Built-in subtitle style templates cannot be deleted');
  }
  const customs = await loadCustomSubtitleStyleTemplates(storage);
  const remaining = customs.filter((template) => template.id !== id);
  await writeCustomSubtitleStyleTemplates(remaining, storage);
  return mergeSubtitleStyleTemplates(remaining);
}

export function parseStoredSubtitleStyleTemplates(contents: string): SubtitleStyleTemplate[] {
  try {
    const parsed = JSON.parse(contents) as Partial<StoredSubtitleStyleTemplatesFile>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.templates)) {
      return [];
    }
    return parsed.templates.flatMap((template) => {
      if (!template || typeof template.id !== 'string' || typeof template.name !== 'string') {
        return [];
      }
      return [
        {
          id: template.id,
          kind: 'custom' as const,
          name: template.name.trim() || 'Custom',
          style: normalizeSubtitleStyleTemplateStyle(template.style ?? {}),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function serializeCustomSubtitleStyleTemplates(templates: SubtitleStyleTemplate[]): string {
  const payload: StoredSubtitleStyleTemplatesFile = {
    schemaVersion: 1,
    templates: templates
      .filter((template) => template.kind === 'custom')
      .map((template) => ({
        id: template.id,
        name: template.name,
        style: normalizeSubtitleStyleTemplateStyle(template.style),
      })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function mergeSubtitleStyleTemplates(customTemplates: SubtitleStyleTemplate[]): SubtitleStyleTemplate[] {
  const builtinIds = new Set(BUILTIN_SUBTITLE_STYLE_TEMPLATES.map((template) => template.id));
  return [
    ...BUILTIN_SUBTITLE_STYLE_TEMPLATES,
    ...customTemplates
      .filter((template) => template.kind === 'custom' && !builtinIds.has(template.id))
      .map((template) => ({
        ...template,
        kind: 'custom' as const,
        style: normalizeSubtitleStyleTemplateStyle(template.style),
      })),
  ];
}

async function loadCustomSubtitleStyleTemplates(
  storage: SubtitleStyleTemplateStorage,
): Promise<SubtitleStyleTemplate[]> {
  const path = getSubtitleStyleTemplatesPath(await storage.getAppDataDir());
  if (!(await storage.fsExists(path))) {
    return [];
  }
  return parseStoredSubtitleStyleTemplates(await storage.readFile(path));
}

async function writeCustomSubtitleStyleTemplates(
  templates: SubtitleStyleTemplate[],
  storage: SubtitleStyleTemplateStorage,
): Promise<void> {
  const path = getSubtitleStyleTemplatesPath(await storage.getAppDataDir());
  await storage.writeFile(path, serializeCustomSubtitleStyleTemplates(templates));
}

function createCustomSubtitleStyleTemplateId(name: string, templates: SubtitleStyleTemplate[]): string {
  const used = new Set([...BUILTIN_SUBTITLE_STYLE_TEMPLATES, ...templates].map((template) => template.id));
  const base = `custom-${
    name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'subtitle-style'
  }`;
  if (!used.has(base)) {
    return base;
  }
  let index = 2;
  while (used.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}
