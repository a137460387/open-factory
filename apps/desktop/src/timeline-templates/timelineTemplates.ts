import {
  BUILT_IN_TIMELINE_TEMPLATES,
  normalizeTimelineTemplateDefinition,
  type TimelineTemplateDefinition,
} from '@open-factory/editor-core';
import { fsExists, getAppDataDir, readFile, scanDirectory, writeFile } from '../lib/tauri-bridge';

export interface TimelineTemplateStorage {
  getAppDataDir(): Promise<string> | string;
  fsExists(path: string): Promise<boolean> | boolean;
  scanDirectory(path: string, depth?: number): Promise<string[]> | string[];
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
}

const TIMELINE_TEMPLATES_DIR = 'timeline-templates';
const TIMELINE_TEMPLATE_EXTENSION = '.oftimeline.json';

const bridgeTimelineTemplateStorage: TimelineTemplateStorage = {
  getAppDataDir,
  fsExists,
  scanDirectory,
  readFile,
  writeFile,
};

export function getTimelineTemplatesDir(appDataDir: string): string {
  return `${appDataDir.replace(/[\\/]+$/, '')}/${TIMELINE_TEMPLATES_DIR}`;
}

export function getTimelineTemplatePath(appDataDir: string, templateId: string): string {
  return `${getTimelineTemplatesDir(appDataDir)}/${sanitizeTemplateFileName(templateId)}${TIMELINE_TEMPLATE_EXTENSION}`;
}

export async function loadTimelineTemplates(
  storage: TimelineTemplateStorage = bridgeTimelineTemplateStorage,
): Promise<TimelineTemplateDefinition[]> {
  const customTemplates = await loadCustomTimelineTemplates(storage);
  const customIds = new Set(customTemplates.map((template) => template.id));
  return [...customTemplates, ...BUILT_IN_TIMELINE_TEMPLATES.filter((template) => !customIds.has(template.id))];
}

export async function saveTimelineTemplate(
  template: TimelineTemplateDefinition,
  storage: TimelineTemplateStorage = bridgeTimelineTemplateStorage,
): Promise<TimelineTemplateDefinition[]> {
  const appDataDir = await storage.getAppDataDir();
  const path = getTimelineTemplatePath(appDataDir, template.id);
  await storage.writeFile(path, `${JSON.stringify(template, null, 2)}\n`);
  return loadTimelineTemplates(storage);
}

export function parseTimelineTemplateFile(contents: string): TimelineTemplateDefinition | undefined {
  try {
    return normalizeTimelineTemplateDefinition(JSON.parse(contents));
  } catch {
    return undefined;
  }
}

async function loadCustomTimelineTemplates(storage: TimelineTemplateStorage): Promise<TimelineTemplateDefinition[]> {
  const dir = getTimelineTemplatesDir(await storage.getAppDataDir());
  if (!(await storage.fsExists(dir))) {
    return [];
  }
  let files: string[] = [];
  try {
    files = await storage.scanDirectory(dir, 1);
  } catch {
    return [];
  }
  const templates: TimelineTemplateDefinition[] = [];
  for (const file of files.filter((path) => path.endsWith(TIMELINE_TEMPLATE_EXTENSION))) {
    try {
      const parsed = parseTimelineTemplateFile(await storage.readFile(file));
      if (parsed) {
        templates.push(parsed);
      }
    } catch {
      // Ignore unreadable user templates so one corrupt file does not block the dialog.
    }
  }
  return templates.sort(
    (left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? '') || left.name.localeCompare(right.name),
  );
}

function sanitizeTemplateFileName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'timeline-template'
  );
}
