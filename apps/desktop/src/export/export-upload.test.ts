import { describe, expect, it, vi } from 'vitest';
import { updateExportTaskHistoryUpload, type ExportTaskHistoryEntry } from '@open-factory/editor-core';
import type { ExportUploadSettings } from '../settings/appSettings';
import { resolveExportUploadTarget, runExportUploadForHistoryEntry } from './export-upload';

const entry: ExportTaskHistoryEntry = {
  id: 'task-upload',
  name: 'Upload Export',
  outputPath: 'D:/Renders/out.mp4',
  status: 'success',
  priority: 'normal',
  createdAt: 'created',
  finishedAt: 'finished',
};

const webdavSettings: ExportUploadSettings = {
  enabled: true,
  targetType: 'webdav',
  webdav: { url: 'https://dav.example.test/exports/out.mp4', username: 'editor' },
  local: {},
};

describe('export upload hook', () => {
  it('records upload failure status when WebDAV PUT rejects', async () => {
    let history = [entry];
    const updateHistoryUpload = vi.fn(async (entryId, patch) => {
      history = updateExportTaskHistoryUpload(history, entryId, patch, `time-${patch.status}`);
      return history[0];
    });

    const result = await runExportUploadForHistoryEntry(entry, webdavSettings, {
      copyFile: vi.fn(),
      putWebdavExportFile: vi.fn(async () => {
        throw new Error('PUT 503');
      }),
      readWebdavPassword: vi.fn(async () => 'secret'),
      updateHistoryUpload,
    });

    expect(updateHistoryUpload).toHaveBeenCalledWith(
      'task-upload',
      expect.objectContaining({ status: 'running', targetType: 'webdav' }),
    );
    expect(result?.finished).toMatchObject({
      targetType: 'webdav',
      status: 'error',
      error: 'PUT 503',
      attempts: 1,
    });
  });

  it('retries upload without invoking a new export render', async () => {
    let history: ExportTaskHistoryEntry[] = [
      {
        ...entry,
        upload: {
          targetType: 'webdav',
          status: 'error',
          progress: 1,
          attempts: 1,
          destination: 'https://dav.example.test/exports/out.mp4',
          error: 'PUT 503',
          updatedAt: 'previous',
        },
      },
    ];
    const renderExport = vi.fn();
    const putWebdavExportFile = vi.fn(async () => ({ status: 201, bytes: 4096 }));

    const result = await runExportUploadForHistoryEntry(history[0], webdavSettings, {
      copyFile: vi.fn(),
      putWebdavExportFile,
      readWebdavPassword: vi.fn(async () => 'secret'),
      updateHistoryUpload: async (entryId, patch) => {
        history = updateExportTaskHistoryUpload(history, entryId, patch, `retry-${patch.status}`);
        return history[0];
      },
    });

    expect(renderExport).not.toHaveBeenCalled();
    expect(putWebdavExportFile).toHaveBeenCalledTimes(1);
    expect(result?.finished).toMatchObject({ status: 'success', attempts: 2, progress: 1 });
  });

  it('resolves local copy target next to the original export filename', () => {
    expect(
      resolveExportUploadTarget(entry, {
        enabled: true,
        targetType: 'local',
        webdav: {},
        local: { directory: 'D:/Uploaded' },
      }),
    ).toEqual({ targetType: 'local', destination: 'D:/Uploaded/out.mp4' });
  });
});
