import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '@open-factory/editor-core';
import { runAutosaveTick } from '../hooks/useAutosave';
import { setLanguage } from '../i18n/strings';
import {
  deleteAutosaveAfterSave,
  findStartupAutosaveRecovery,
  getSavedProjectAutosavePath,
  RECENT_PROJECT_PATH_KEY,
  readProjectFile,
  writeProjectFile,
  writeAutosaveProjectSafely,
} from './projectFiles';
import type { TauriMocks } from './tauri-bridge';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

describe('project autosave files', () => {
  let storage: MemoryStorage;
  let writes: Array<{ path: string; contents: string }>;
  let removes: string[];
  let files: Map<string, string>;
  let exists: Map<string, boolean>;
  let mtimes: Map<string, number>;

  beforeEach(() => {
    setLanguage('en');
    storage = new MemoryStorage();
    writes = [];
    removes = [];
    files = new Map();
    exists = new Map();
    mtimes = new Map();
    const mocks: TauriMocks = {
      getAppDataDir: () => 'C:/Users/E2E/AppData/Roaming/open-factory',
      readFile: (path) => {
        const value = files.get(path);
        if (value === undefined) {
          throw new Error(`missing ${path}`);
        }
        return value;
      },
      writeFile: (path, contents) => {
        writes.push({ path, contents });
        files.set(path, contents);
        exists.set(path, true);
        mtimes.set(path, 2_000);
      },
      encryptProjectFile: (path, contents, password) => {
        writes.push({ path, contents: `enc:${password}:${contents}` });
        files.set(path, `enc:${password}:${contents}`);
        exists.set(path, true);
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
      removeFile: (path) => {
        removes.push(path);
        exists.set(path, false);
      },
      fsExists: (path) => exists.get(path) ?? false,
      getFileStat: (path) => ({ path, size: 10, mtimeMs: mtimes.get(path) ?? 0 }),
    };
    vi.stubGlobal('window', {
      localStorage: storage,
      __TAURI_MOCKS__: mocks,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('writes a dirty project during an autosave tick', async () => {
    const project = createProject('Autosave Tick');
    const path = 'C:/Projects/edit.cutproj.json';

    await runAutosaveTick({ project, projectPath: path, dirty: true });

    expect(writes[0].path).toBe(getSavedProjectAutosavePath(path));
    expect(JSON.parse(writes[0].contents).schemaVersion).toBe(2);
  });

  it('skips autosave ticks when there are no unsaved changes', async () => {
    await runAutosaveTick({ project: createProject('Clean'), dirty: false });

    expect(writes).toEqual([]);
  });

  it('deletes saved and unsaved autosaves after a successful save', async () => {
    await deleteAutosaveAfterSave('C:/Projects/edit.cutproj.json', 'C:/Projects/old.cutproj.json');

    expect(removes).toContain('C:/Projects/edit.cutproj.json.autosave');
    expect(removes).toContain('C:/Projects/old.cutproj.json.autosave');
    expect(removes).toContain('C:/Users/E2E/AppData/Roaming/open-factory/unsaved.cutproj.json.autosave');
  });

  it('detects a startup recovery point only when autosave is newer than the project', async () => {
    storage.setItem(RECENT_PROJECT_PATH_KEY, 'C:/Projects/edit.cutproj.json');
    exists.set('C:/Projects/edit.cutproj.json', true);
    exists.set('C:/Projects/edit.cutproj.json.autosave', true);
    mtimes.set('C:/Projects/edit.cutproj.json', 1_000);
    mtimes.set('C:/Projects/edit.cutproj.json.autosave', 2_000);

    await expect(findStartupAutosaveRecovery()).resolves.toMatchObject({
      kind: 'saved-project',
      autosavePath: 'C:/Projects/edit.cutproj.json.autosave',
      projectPath: 'C:/Projects/edit.cutproj.json',
    });

    mtimes.set('C:/Projects/edit.cutproj.json.autosave', 900);
    await expect(findStartupAutosaveRecovery()).resolves.toBeUndefined();
  });

  it('warns instead of interrupting editing when autosave writing fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('window', {
      localStorage: storage,
      __TAURI_MOCKS__: {
        getAppDataDir: () => 'C:/Users/E2E/AppData/Roaming/open-factory',
        writeFile: () => {
          throw new Error('disk full');
        },
      } satisfies TauriMocks,
    });

    await expect(
      writeAutosaveProjectSafely(createProject('Failing'), 'C:/Projects/edit.cutproj.json'),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('writes and reads encrypted project files through the encryption bridge', async () => {
    const project = createProject('Encrypted');
    const path = 'C:/Projects/encrypted.cutproj.enc';

    await writeProjectFile(project, path, { encrypted: true, password: 'secret' });
    expect(writes[0].path).toBe(path);
    expect(writes[0].contents).toContain('enc:secret:');
    expect(writes[0].contents).toContain('"schemaVersion": 2');

    const restored = await readProjectFile(path, path, { password: 'secret' });
    expect(restored.name).toBe('Encrypted');
    await expect(readProjectFile(path, path, { password: 'wrong' })).rejects.toThrow('Wrong password');
  });
});
