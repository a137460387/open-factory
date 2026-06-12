import { describe, expect, it, vi } from 'vitest';
import { createProject } from '@open-factory/editor-core';
import type { BackupSettings } from '../settings/appSettings';
import {
  buildWebdavProjectBackupRequest,
  createLocalBackupPath,
  runProjectBackupAfterSave,
  runLocalBackup,
  sanitizeBackupStem,
  selectExpiredLocalBackups
} from './projectBackup';

describe('project backup', () => {
  const backupNow = new Date('2026-06-12T14:05:06.789Z');

  it('creates local backup filenames with a safe project stem and UTC timestamp', () => {
    expect(createLocalBackupPath('C:/Backups/', 'Demo: Cut 01', 'C:/Projects/demo.cutproj.json', backupNow)).toBe(
      'C:/Backups/Demo-Cut-01-20260612-140506-789.cutproj.json'
    );
    expect(sanitizeBackupStem('***')).toBe('project');
  });

  it('selects only backups beyond the newest 10 for rotation', () => {
    const expired = selectExpiredLocalBackups(
      Array.from({ length: 12 }, (_, index) => ({
        path: `C:/Backups/Demo-20260612-120${String(index).padStart(2, '0')}-000.cutproj.json`,
        mtimeMs: index
      }))
    );

    expect(expired.map((entry) => entry.mtimeMs)).toEqual([1, 0]);
  });

  it('writes a local backup and removes expired files for the same project stem', async () => {
    const project = createProject('Demo');
    const expectedPath = createLocalBackupPath('C:/Backups', project.name, 'C:/Projects/demo.cutproj.json', backupNow);
    const writes: Array<{ path: string; contents: string }> = [];
    const removed: string[] = [];
    const scanned = [
      expectedPath,
      ...Array.from({ length: 10 }, (_, index) => `C:/Backups/Demo-old-${index}.cutproj.json`),
      'C:/Backups/Other-old.cutproj.json'
    ];

    const status = await runLocalBackup(
      project,
      'C:/Projects/demo.cutproj.json',
      '{"schemaVersion":2}',
      { local: { enabled: true, directory: 'C:/Backups' }, webdav: { enabled: false } },
      {
        writeFile: async (path, contents) => {
          writes.push({ path, contents });
        },
        scanDirectory: async () => scanned,
        getFileStat: async (path) => ({ path, size: 1, mtimeMs: path === expectedPath ? 100 : Number(path.match(/old-(\d+)/)?.[1] ?? 0) }),
        removeFile: async (path) => {
          removed.push(path);
        }
      },
      () => backupNow
    );

    expect(status).toEqual({ ok: true, path: expectedPath });
    expect(writes).toEqual([{ path: expectedPath, contents: '{"schemaVersion":2}' }]);
    expect(removed).toEqual(['C:/Backups/Demo-old-0.cutproj.json']);
  });

  it('persists the last backup timestamp after a successful save backup', async () => {
    const savedSettings: Partial<BackupSettings>[] = [];
    const status = await runProjectBackupAfterSave(createProject('Demo'), 'C:/Projects/demo.cutproj.json', '{}', {
      readSettings: async () => ({ local: { enabled: true, directory: 'C:/Backups' }, webdav: { enabled: false } }),
      saveSettings: async (settings) => {
        savedSettings.push(settings);
        return settings as BackupSettings;
      },
      writeFile: async () => undefined,
      scanDirectory: async () => [],
      getFileStat: async (path) => ({ path, size: 1, mtimeMs: 1 }),
      removeFile: async () => undefined,
      now: () => backupNow
    });

    expect(status.lastBackupAt).toBe(backupNow.toISOString());
    expect(savedSettings[0].lastBackupAt).toBe(backupNow.toISOString());
  });

  it('builds WebDAV PUT request args without reading password from settings.json', async () => {
    const settings: BackupSettings = {
      local: { enabled: false },
      webdav: { enabled: true, url: 'https://dav.example.test/projects/demo.cutproj.json', username: 'editor' }
    };

    await expect(
      buildWebdavProjectBackupRequest('C:/Projects/demo.cutproj.json', '{"schemaVersion":2}', settings, {
        readWebdavPassword: async () => 'secret'
      })
    ).resolves.toEqual({
      url: 'https://dav.example.test/projects/demo.cutproj.json',
      username: 'editor',
      password: 'secret',
      projectPath: 'C:/Projects/demo.cutproj.json',
      contents: '{"schemaVersion":2}'
    });
  });

  it('warns instead of blocking project save when WebDAV backup fails', async () => {
    const warn = vi.fn();
    const savedSettings: Partial<BackupSettings>[] = [];
    const status = await runProjectBackupAfterSave(createProject('Demo'), 'C:/Projects/demo.cutproj.json', '{}', {
      readSettings: async () => ({
        local: { enabled: false },
        webdav: { enabled: true, url: 'https://dav.example.test/demo.cutproj.json', username: 'editor' }
      }),
      saveSettings: async (settings) => {
        savedSettings.push(settings);
        return settings as BackupSettings;
      },
      readWebdavPassword: async () => 'secret',
      putWebdavProject: async () => {
        throw new Error('PUT 403');
      },
      warn
    });

    expect(status.webdav).toEqual({ ok: false, warning: 'PUT 403' });
    expect(status.warning).toBe('PUT 403');
    expect(savedSettings[0].lastBackupWarning).toBe('PUT 403');
    expect(warn).toHaveBeenCalledWith('PUT 403');
  });
});
