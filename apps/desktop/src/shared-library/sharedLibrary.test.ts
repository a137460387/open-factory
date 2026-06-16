import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SUBTITLE_STYLE, type SubtitleStyleTemplate } from '@open-factory/editor-core';
import {
  addSharedLibraryResource,
  exportSharedLibrary,
  getSharedLibraryIndexPath,
  importSharedLibrary,
  loadSharedLibrary,
  parseSharedLibraryIndex,
  removeSharedLibraryResource,
  serializeSharedLibraryIndex,
  sharedResourceToSubtitleStyleTemplate,
  subtitleStyleTemplateToSharedResource,
  upsertSharedLibraryResource,
  type SharedLibraryArchiveClient,
  type SharedLibraryStorage
} from './sharedLibrary';

describe('shared library', () => {
  it('persists shared resources with CRUD operations', async () => {
    const files = new Map<string, string>();
    const storage = makeStorage(files);

    const created = await addSharedLibraryResource(
      {
        id: 'shared-style-review',
        type: 'subtitle-style',
        name: 'Review White',
        payload: { style: { ...DEFAULT_SUBTITLE_STYLE, color: '#ffffff' } }
      },
      'overwrite',
      storage
    );

    expect(created.action).toBe('created');
    expect(await loadSharedLibrary(storage)).toHaveLength(1);
    expect(files.has(getSharedLibraryIndexPath(APP_DATA))).toBe(true);

    const remaining = await removeSharedLibraryResource('shared-style-review', storage);
    expect(remaining).toEqual([]);
  });

  it('increments versions on overwrite and keeps both resources when requested', () => {
    const first = upsertSharedLibraryResource([], { id: 'resource-a', type: 'subtitle-style', name: 'Review White' }, 'overwrite', '2026-06-16T00:00:00.000Z');
    const overwritten = upsertSharedLibraryResource(first.resources, { id: 'resource-b', type: 'subtitle-style', name: 'Review White' }, 'overwrite', '2026-06-16T00:01:00.000Z');
    const keptBoth = upsertSharedLibraryResource(overwritten.resources, { id: 'resource-c', type: 'subtitle-style', name: 'Review White' }, 'keep-both', '2026-06-16T00:02:00.000Z');

    expect(overwritten.resource.id).toBe('resource-a');
    expect(overwritten.resource.version).toBe(2);
    expect(keptBoth.action).toBe('kept-both');
    expect(keptBoth.resources).toHaveLength(2);
    expect(keptBoth.resource.version).toBe(3);
  });

  it('serializes and parses a library index', () => {
    const serialized = serializeSharedLibraryIndex([{ id: 'macro-a', type: 'macro', name: 'Normalize', version: 1, updatedAt: '2026-06-16T00:00:00.000Z', payload: { steps: [] } }]);

    expect(parseSharedLibraryIndex(serialized)).toEqual([
      { id: 'macro-a', type: 'macro', name: 'Normalize', version: 1, updatedAt: '2026-06-16T00:00:00.000Z', payload: { steps: [] }, filePath: undefined }
    ]);
    expect(parseSharedLibraryIndex('not-json')).toEqual([]);
  });

  it('converts subtitle style templates to and from shared resources', () => {
    const template: SubtitleStyleTemplate = { id: 'custom-review', kind: 'custom', name: 'Review White', style: { ...DEFAULT_SUBTITLE_STYLE, outlineWidth: 2 } };

    const resource = subtitleStyleTemplateToSharedResource(template);
    const restored = sharedResourceToSubtitleStyleTemplate({ ...resource, version: 1, updatedAt: '2026-06-16T00:00:00.000Z' });

    expect(resource.type).toBe('subtitle-style');
    expect(restored).toMatchObject({ id: 'shared-custom-review', kind: 'custom', name: 'Review White' });
    expect(restored?.style.outlineWidth).toBe(2);
  });

  it('exports and imports shared library zip archives through the archive client', async () => {
    const files = new Map<string, string>();
    const storage = makeStorage(files);
    await addSharedLibraryResource({ id: 'style-a', type: 'subtitle-style', name: 'Review White', payload: { style: DEFAULT_SUBTITLE_STYLE } }, 'overwrite', storage);
    const archiveClient: SharedLibraryArchiveClient = {
      createSharedLibraryArchive: vi.fn(({ outputPath }) => ({ outputPath, fileCount: 1, durationMs: 3 })),
      importSharedLibraryArchive: vi.fn(() => ({
        destinationDir: `${APP_DATA}/shared-library`,
        fileCount: 1,
        manifestContents: serializeSharedLibraryIndex([{ id: 'style-b', type: 'subtitle-style', name: 'Review Yellow', version: 1, updatedAt: '2026-06-16T00:00:00.000Z', payload: { style: { ...DEFAULT_SUBTITLE_STYLE, color: '#ffff00' } } }])
      }))
    };

    await expect(exportSharedLibrary('C:/Exports/team.oflibrary.zip', storage, archiveClient)).resolves.toMatchObject({ outputPath: 'C:/Exports/team.oflibrary.zip' });
    expect(archiveClient.createSharedLibraryArchive).toHaveBeenCalledWith(expect.objectContaining({ outputPath: 'C:/Exports/team.oflibrary.zip', manifestContents: expect.stringContaining('Review White') }));

    const imported = await importSharedLibrary('C:/Exports/team.oflibrary.zip', 'keep-both', storage, archiveClient);
    expect(imported[0].resource.name).toBe('Review Yellow');
    expect((await loadSharedLibrary(storage)).map((resource) => resource.name)).toContain('Review Yellow');
  });
});

const APP_DATA = 'C:/Users/E2E/AppData/Roaming/open-factory';

function makeStorage(files: Map<string, string>): SharedLibraryStorage {
  return {
    getAppDataDir: () => APP_DATA,
    fsExists: (path) => files.has(path),
    readFile: (path) => files.get(path) ?? '',
    writeFile: (path, contents) => {
      files.set(path, contents);
    }
  };
}
