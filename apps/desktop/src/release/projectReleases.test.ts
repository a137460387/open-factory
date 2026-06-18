import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProjectReleaseRecord, runReleaseChecklist, createProject } from '@open-factory/editor-core';
import { getProjectReleaseDir, listProjectReleaseRecords, parseProjectReleaseRecord, saveProjectReleaseRecord } from './projectReleases';
import type { TauriMocks } from '../lib/tauri-bridge';

describe('project release record storage', () => {
  const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';
  const files = new Map<string, string>();
  const mtimes = new Map<string, number>();

  beforeEach(() => {
    files.clear();
    mtimes.clear();
    vi.stubGlobal('window', {
      __TAURI_MOCKS__: {
        getAppDataDir: () => appDataDir,
        writeFile: (path, contents) => {
          files.set(path, contents);
          mtimes.set(path, 2_000);
        },
        readFile: (path) => {
          const value = files.get(path);
          if (value === undefined) {
            throw new Error(`missing ${path}`);
          }
          return value;
        },
        fsExists: (path) => path.includes('/releases/project-1') || files.has(path),
        scanDirectory: (path) => Array.from(files.keys()).filter((file) => file.startsWith(`${path}/`)),
        getFileStat: (path) => ({ path, size: files.get(path)?.length ?? 0, mtimeMs: mtimes.get(path) ?? 0 })
      } satisfies Partial<TauriMocks>
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('saves, lists, and parses changelog-bearing release records', async () => {
    const project = { ...createProject('Release CRUD'), id: 'project-1' };
    const checklist = runReleaseChecklist(project, undefined, { exportPresetId: 'web-1080p' });
    const record = buildProjectReleaseRecord({
      project,
      version: '0.1.1',
      releasedAt: '2026-06-18T02:03:04.000Z',
      checklist,
      exportPath: 'C:/Exports/release.mp4',
      changelog: '## Release\n- Persisted',
      snapshotPath: 'C:/Snapshots/release.cutproj.json'
    });

    const saved = await saveProjectReleaseRecord(record);
    expect(saved.path).toBe(`${await getProjectReleaseDir('project-1')}/release_0.1.1_2026-06-18T02-03-04-000Z.json`);
    expect(parseProjectReleaseRecord(files.get(saved.path) ?? '').changelog).toContain('Persisted');

    const listed = await listProjectReleaseRecords('project-1');
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ version: '0.1.1', path: saved.path, changelog: '## Release\n- Persisted' });
  });
});
