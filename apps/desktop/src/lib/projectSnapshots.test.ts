import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '@open-factory/editor-core';
import {
  createSnapshotFileName,
  deleteProjectSnapshot,
  getSnapshotDir,
  listProjectSnapshots,
  pruneProjectSnapshots,
  readProjectSnapshot,
  saveProjectSnapshot,
} from './projectSnapshots';
import { setActiveProjectEncryptionPassword } from './projectFiles';
import type { TauriMocks } from './tauri-bridge';

describe('project snapshots', () => {
  const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';
  const files = new Map<string, string>();
  const mtimes = new Map<string, number>();
  const removed: string[] = [];

  beforeEach(() => {
    files.clear();
    mtimes.clear();
    removed.length = 0;
    setActiveProjectEncryptionPassword(undefined);
    vi.stubGlobal('window', {
      __TAURI_MOCKS__: {
        getAppDataDir: () => appDataDir,
        writeFile: (path, contents) => {
          files.set(path, contents);
          mtimes.set(path, 2_000);
        },
        encryptProjectFile: (path, contents, password) => {
          files.set(path, `enc:${password}:${contents}`);
          mtimes.set(path, 2_000);
        },
        decryptProjectFile: (path, password) => {
          const prefix = `enc:${password}:`;
          const value = files.get(path) ?? '';
          if (!value.startsWith(prefix)) {
            throw new Error('密码错误');
          }
          return value.slice(prefix.length);
        },
        readFile: (path) => {
          const value = files.get(path);
          if (value === undefined) {
            throw new Error(`missing ${path}`);
          }
          return value;
        },
        removeFile: (path) => {
          removed.push(path);
          files.delete(path);
        },
        fsExists: (path) => path.endsWith('/snapshots/project-1') || files.has(path),
        scanDirectory: (path) => Array.from(files.keys()).filter((file) => file.startsWith(`${path}/`)),
        getFileStat: (path) => ({ path, size: files.get(path)?.length ?? 0, mtimeMs: mtimes.get(path) ?? 0 }),
      } satisfies TauriMocks,
    });
  });

  afterEach(() => {
    setActiveProjectEncryptionPassword(undefined);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('saves, lists, reads, and deletes named snapshots', async () => {
    const project = { ...createProject('Snapshot CRUD'), id: 'project-1' };

    const snapshot = await saveProjectSnapshot(project, 'Before trim', 'C:/Projects/demo.cutproj.json');
    expect(snapshot.name).toBe('Before trim');
    expect(snapshot.path).toContain('/snapshots/project-1/');
    expect(snapshot.path).toContain('Before%20trim.cutproj.json');

    const listed = await listProjectSnapshots('project-1');
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ name: 'Before trim', path: snapshot.path });

    const restored = await readProjectSnapshot(snapshot, 'C:/Projects/demo.cutproj.json');
    expect(restored.id).toBe('project-1');
    expect(restored.name).toBe('Snapshot CRUD');

    await deleteProjectSnapshot(snapshot);
    expect(removed).toContain(snapshot.path);
    expect(files.has(snapshot.path)).toBe(false);
  });

  it('prunes snapshots beyond the newest 20 entries', async () => {
    const dir = await getSnapshotDir('project-1');
    for (let index = 0; index < 22; index += 1) {
      const fileName = createSnapshotFileName(`Snap ${index}`, new Date(Date.UTC(2026, 0, 1, 0, 0, index, 0)));
      const path = `${dir}/${fileName}`;
      files.set(path, JSON.stringify({ schemaVersion: 2, project: { id: 'project-1' } }));
      mtimes.set(path, index);
    }

    const pruned = await pruneProjectSnapshots('project-1', 20);

    expect(pruned.map((snapshot) => snapshot.name)).toEqual(['Snap 1', 'Snap 0']);
    expect(removed).toHaveLength(2);
    await expect(listProjectSnapshots('project-1')).resolves.toHaveLength(20);
  });

  it('saves encrypted snapshots with the active project password', async () => {
    const project = { ...createProject('Encrypted Snapshot'), id: 'project-1' };
    setActiveProjectEncryptionPassword('secret');

    const snapshot = await saveProjectSnapshot(project, 'Locked', 'C:/Projects/demo.cutproj.enc');
    expect(snapshot.path).toContain('Locked.cutproj.enc');
    expect(files.get(snapshot.path)).toContain('enc:secret:');
    await expect(listProjectSnapshots('project-1')).resolves.toHaveLength(1);

    const restored = await readProjectSnapshot(snapshot, 'C:/Projects/demo.cutproj.enc');
    expect(restored.name).toBe('Encrypted Snapshot');
  });
});
