import { describe, expect, it } from 'vitest';
import { serializeTimelineTemplate, type Project } from '@open-factory/editor-core';
import { getTimelineTemplatePath, getTimelineTemplatesDir, loadTimelineTemplates, parseTimelineTemplateFile, saveTimelineTemplate, type TimelineTemplateStorage } from './timelineTemplates';

describe('timeline template storage', () => {
  it('writes templates into the AppData timeline-templates directory', async () => {
    const files = new Map<string, string>();
    const storage = makeStorage(files);
    const template = serializeTimelineTemplate(makeProject(), { id: 'demo-template', name: 'Demo Template', createdAt: '2026-06-16T00:00:00.000Z' });

    const templates = await saveTimelineTemplate(template, storage);

    const path = getTimelineTemplatePath('C:/Users/E2E/AppData/Roaming/open-factory', 'demo-template');
    expect(path).toBe('C:/Users/E2E/AppData/Roaming/open-factory/timeline-templates/demo-template.oftimeline.json');
    expect(files.has(path)).toBe(true);
    expect(templates.find((item) => item.id === 'demo-template')).toBeTruthy();
  });

  it('loads custom templates with built-ins and skips corrupt files', async () => {
    const files = new Map<string, string>();
    const storage = makeStorage(files);
    const custom = serializeTimelineTemplate(makeProject(), { id: 'custom-template', name: 'Custom Template', createdAt: '2026-06-16T00:00:00.000Z' });
    files.set(getTimelineTemplatePath('C:/Users/E2E/AppData/Roaming/open-factory', 'custom-template'), JSON.stringify(custom));
    files.set(`${getTimelineTemplatesDir('C:/Users/E2E/AppData/Roaming/open-factory')}/broken.oftimeline.json`, 'not-json');

    const templates = await loadTimelineTemplates(storage);

    expect(templates[0].id).toBe('custom-template');
    expect(templates.some((template) => template.id === 'interview-two-camera')).toBe(true);
  });

  it('parses invalid template files as undefined', () => {
    expect(parseTimelineTemplateFile('not-json')).toBeUndefined();
  });
});

function makeStorage(files: Map<string, string>): TimelineTemplateStorage {
  const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';
  return {
    getAppDataDir: () => appDataDir,
    fsExists: (path) => path === getTimelineTemplatesDir(appDataDir) || files.has(path),
    scanDirectory: (path) => Array.from(files.keys()).filter((file) => file.startsWith(`${path}/`)),
    readFile: (path) => files.get(path) ?? '',
    writeFile: (path, contents) => {
      files.set(path, contents);
    }
  };
}

function makeProject(): Project {
  return {
    version: '0.2',
    id: 'project',
    name: 'Project',
    createdAt: '2026-06-16T00:00:00.000Z',
    updatedAt: '2026-06-16T00:00:00.000Z',
    masterVolume: 1,
    settings: { fps: 30, timecodeFormat: 'ndf', width: 1920, height: 1080 },
    media: [],
    mediaFolders: [],
    mediaMetadata: {},
    annotations: [],
    reviewAnnotations: [],
    collaborationNotes: [],
    timelineNotes: [],
    bookmarks: [],
    beatMarkers: [],
    exportRanges: [],
    protectedRanges: [],
    clipGroups: [],
    speakers: [],
    documentation: {},
    timeline: { tracks: [] },
    sequences: [],
    activeSequenceId: 'sequence-main'
  };
}
