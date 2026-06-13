import { describe, expect, it } from 'vitest';
import {
  MAX_MEDIA_FOLDER_DEPTH,
  addMediaFolderToProject,
  collectSmartAlbums,
  deleteMediaFolder,
  getMediaFolderDepth,
  moveMediaAssetsToFolder,
  getSmartAlbumAssetIds,
  normalizeMediaFolders,
  normalizeMediaFolderId,
  normalizeMediaImportedAt,
  renameMediaFolder,
  setMediaFolderCollapsed,
  type MediaAsset
} from '../src';
import { makeProject } from './test-utils';

describe('media folders and smart albums', () => {
  it('creates, renames, collapses, moves media into, and deletes folders with media returning to root', () => {
    const project = makeProject();
    const { project: withFolder, folder } = addMediaFolderToProject(project, { id: 'folder-a', name: '  B-roll  ' }, '2026-06-13T01:00:00.000Z');
    const renamed = renameMediaFolder(withFolder, folder.id, 'Selects');
    const collapsed = setMediaFolderCollapsed(renamed, folder.id, true);
    const moved = moveMediaAssetsToFolder(collapsed, ['asset-1'], folder.id);

    expect(moved.mediaFolders).toEqual([
      {
        id: 'folder-a',
        name: 'Selects',
        parentId: null,
        collapsed: true,
        createdAt: '2026-06-13T01:00:00.000Z'
      }
    ]);
    expect(moved.media[0].folderId).toBe('folder-a');

    const deleted = deleteMediaFolder(moved, folder.id);
    expect(deleted.mediaFolders).toEqual([]);
    expect(deleted.media[0].folderId).toBeNull();
  });

  it('limits nested folders to three levels', () => {
    let project = makeProject();
    for (const id of ['one', 'two', 'three']) {
      project = addMediaFolderToProject(project, { id, name: id, parentId: project.mediaFolders.at(-1)?.id }).project;
    }

    expect(project.mediaFolders.map((folder) => folder.id)).toEqual(['one', 'two', 'three']);
    expect(() => addMediaFolderToProject(project, { id: 'four', name: 'four', parentId: 'three' })).toThrow(`${MAX_MEDIA_FOLDER_DEPTH} levels`);
  });

  it('normalizes invalid folder data, cycles, duplicate ids, and stale asset folder ids', () => {
    const folders = normalizeMediaFolders([
      { id: ' root ', name: ' Root ', parentId: null, collapsed: true, createdAt: 'bad-date' },
      { id: 'root', name: 'Duplicate', parentId: null, collapsed: false, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'child/a', name: '', parentId: ' root ', collapsed: false, createdAt: '2026-01-02T00:00:00.000Z' },
      { id: '', name: 'Skipped', parentId: null, collapsed: false, createdAt: '2026-01-03T00:00:00.000Z' },
      { id: 'orphan', name: 'Orphan', parentId: 'missing', collapsed: false, createdAt: '2026-01-04T00:00:00.000Z' }
    ]);

    expect(folders).toEqual([
      { id: 'root', name: 'Root', parentId: null, collapsed: true, createdAt: '1970-01-01T00:00:00.000Z' },
      { id: 'child-a', name: 'New Folder', parentId: null, collapsed: false, createdAt: '2026-01-02T00:00:00.000Z' },
      { id: 'orphan', name: 'Orphan', parentId: null, collapsed: false, createdAt: '2026-01-04T00:00:00.000Z' }
    ]);
    expect(normalizeMediaFolderId('missing', folders)).toBeNull();
    expect(normalizeMediaFolderId('root', folders)).toBe('root');
    expect(getMediaFolderDepth([{ id: 'a', name: 'A', parentId: 'b', collapsed: false, createdAt: 'x' }, { id: 'b', name: 'B', parentId: 'a', collapsed: false, createdAt: 'x' }], 'a')).toBe(MAX_MEDIA_FOLDER_DEPTH + 1);
  });

  it('deletes nested folders and moves descendant media back to root', () => {
    let project = makeProject();
    project = addMediaFolderToProject(project, { id: 'one', name: 'One' }).project;
    project = addMediaFolderToProject(project, { id: 'two', name: 'Two', parentId: 'one' }).project;
    project = addMediaFolderToProject(project, { id: 'three', name: 'Three', parentId: 'two' }).project;
    project = moveMediaAssetsToFolder(project, ['asset-1'], 'three');

    const deleted = deleteMediaFolder(project, 'one');

    expect(deleted.mediaFolders).toEqual([]);
    expect(deleted.media[0].folderId).toBeNull();
  });

  it('groups smart albums by format, duration, and recent import date', () => {
    const now = Date.parse('2026-06-13T00:00:00.000Z');
    const media: MediaAsset[] = [
      makeAsset('video', 'video', 'intro.mp4', 12, '2026-06-12T00:00:00.000Z'),
      makeAsset('audio', 'audio', 'mix.wav', 120, '2026-05-01T00:00:00.000Z'),
      makeAsset('image', 'image', 'still.png', 0, '2026-06-10T00:00:00.000Z'),
      makeAsset('svg', 'image', 'logo.svg', 0, '2026-06-11T00:00:00.000Z'),
      makeAsset('long', 'video', 'feature.mov', 420, '2026-01-01T00:00:00.000Z')
    ];

    const albums = Object.fromEntries(collectSmartAlbums(media, now).map((album) => [album.id, album.assetIds]));

    expect(albums['format-video']).toEqual(['video', 'long']);
    expect(albums['format-audio']).toEqual(['audio']);
    expect(albums['format-image']).toEqual(['image']);
    expect(albums['format-svg']).toEqual(['svg']);
    expect(albums['duration-short']).toEqual(['video', 'image', 'svg']);
    expect(albums['duration-medium']).toEqual(['audio']);
    expect(albums['duration-long']).toEqual(['long']);
    expect(albums['recent-imports']).toEqual(['video', 'image', 'svg']);
    expect(getSmartAlbumAssetIds(media, 'format-svg', now)).toEqual(['svg']);
    expect(getSmartAlbumAssetIds(media, 'recent-imports', now)).toEqual(['video', 'image', 'svg']);
    expect(normalizeMediaImportedAt('bad-date', '2026-06-13T00:00:00.000Z')).toBe('2026-06-13T00:00:00.000Z');
    expect(normalizeMediaImportedAt('bad-date', 'also-bad')).toBeUndefined();
  });
});

function makeAsset(id: string, type: MediaAsset['type'], name: string, duration: number, importedAt: string): MediaAsset {
  return {
    id,
    type,
    name,
    path: `C:/Media/${name}`,
    duration,
    width: type === 'audio' ? 0 : 1280,
    height: type === 'audio' ? 0 : 720,
    importedAt
  };
}
