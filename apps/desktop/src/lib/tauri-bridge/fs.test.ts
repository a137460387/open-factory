/**
 * FS Bridge Tests
 *
 * Tests the file system bridge functions that wrap Tauri invoke calls
 * with mock fallback support.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((p: string) => `asset://localhost/${p}`),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn(),
  message: vi.fn(),
}));

vi.mock('../tauri', () => ({
  isTauriRuntime: vi.fn(() => false),
}));

vi.mock('../../i18n/strings', () => ({
  zhCN: {
    closeGuard: {
      message: 'Unsaved changes',
      title: 'Close',
      save: 'Save',
      discard: 'Discard',
      cancel: 'Cancel',
    },
    errors: {
      droppedPathsNotAuthorized: 'Path auth failed',
    },
  },
}));

const mockConfirm = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockRemoveFile = vi.fn();
const mockFsExists = vi.fn();
const mockGetAppDataDir = vi.fn();
const mockGetFileStat = vi.fn();
const mockOpenFileDialog = vi.fn();
const mockSaveFileDialog = vi.fn();
const mockAuthorizePaths = vi.fn();

vi.mock('./mock-types', () => ({
  getTauriMocks: () => ({
    confirm: mockConfirm,
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    removeFile: mockRemoveFile,
    fsExists: mockFsExists,
    getAppDataDir: mockGetAppDataDir,
    getFileStat: mockGetFileStat,
    openFileDialog: mockOpenFileDialog,
    saveFileDialog: mockSaveFileDialog,
    authorizePaths: mockAuthorizePaths,
  }),
}));

import {
  bridgeConfirm,
  readFile,
  writeFile,
  removeFile,
  fsExists,
  getAppDataDir,
  getFileStat,
  openFileDialog,
  convertLocalFileSrc,
} from './fs';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bridgeConfirm', () => {
  it('delegates to mock when available', async () => {
    mockConfirm.mockResolvedValueOnce(true);
    const result = await bridgeConfirm('Are you sure?');
    expect(result).toBe(true);
    expect(mockConfirm).toHaveBeenCalledWith('Are you sure?', undefined);
  });

  it('passes options to mock', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    const result = await bridgeConfirm('Confirm?', { kind: 'warning' });
    expect(result).toBe(false);
    expect(mockConfirm).toHaveBeenCalledWith('Confirm?', { kind: 'warning' });
  });
});

describe('readFile', () => {
  it('delegates to mock', async () => {
    mockReadFile.mockResolvedValueOnce('file contents');
    const result = await readFile('/path/to/file.txt');
    expect(result).toBe('file contents');
    expect(mockReadFile).toHaveBeenCalledWith('/path/to/file.txt');
  });
});

describe('writeFile', () => {
  it('delegates to mock', async () => {
    mockWriteFile.mockResolvedValueOnce(undefined);
    await writeFile('/path/to/file.txt', 'new contents');
    expect(mockWriteFile).toHaveBeenCalledWith('/path/to/file.txt', 'new contents');
  });
});

describe('removeFile', () => {
  it('delegates to mock', async () => {
    mockRemoveFile.mockResolvedValueOnce(undefined);
    await removeFile('/path/to/file.txt');
    expect(mockRemoveFile).toHaveBeenCalledWith('/path/to/file.txt');
  });
});

describe('fsExists', () => {
  it('returns true when file exists', async () => {
    mockFsExists.mockResolvedValueOnce(true);
    expect(await fsExists('/existing/file')).toBe(true);
  });

  it('returns false when file does not exist', async () => {
    mockFsExists.mockResolvedValueOnce(false);
    expect(await fsExists('/missing/file')).toBe(false);
  });
});

describe('getAppDataDir', () => {
  it('returns app data directory path', async () => {
    mockGetAppDataDir.mockResolvedValueOnce('/home/user/.open-factory');
    const result = await getAppDataDir();
    expect(result).toBe('/home/user/.open-factory');
  });
});

describe('getFileStat', () => {
  it('returns file stat object', async () => {
    const stat = { path: '/file.txt', size: 1024, mtimeMs: 1234567890 };
    mockGetFileStat.mockResolvedValueOnce(stat);
    const result = await getFileStat('/file.txt');
    expect(result).toEqual(stat);
  });
});

describe('openFileDialog', () => {
  it('delegates to mock with correct parameters', async () => {
    mockOpenFileDialog.mockResolvedValueOnce(['/selected/file.mp4']);
    const filters = [{ name: 'Video', extensions: ['mp4', 'mov'] }];
    const result = await openFileDialog(true, filters);
    expect(result).toEqual(['/selected/file.mp4']);
    expect(mockOpenFileDialog).toHaveBeenCalledWith({ multiple: true, filters });
  });
});

describe('convertLocalFileSrc', () => {
  it('returns path as-is when not in Tauri runtime', () => {
    const result = convertLocalFileSrc('/path/to/file.mp4');
    expect(result).toBe('/path/to/file.mp4');
  });
});
