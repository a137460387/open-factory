// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock 外部依赖（在 import 之前声明） ──────────────────────

const mockAddMedia = vi.fn();
const mockSetMedia = vi.fn();
const mockSetMediaMetadata = vi.fn();

let mockEditorState: Record<string, any>;

vi.mock('../../store/editorStore', () => ({
  useEditorStore: {
    getState: () => mockEditorState,
  },
}));

vi.mock('../../store/editorSettingsStore', () => ({
  useEditorSettingsStore: {
    getState: () => ({
      setSharedLibraryResources: vi.fn(),
    }),
  },
}));

vi.mock('../../store/editorFeatureStore', () => ({
  useEditorFeatureStore: {
    getState: () => ({
      setDuplicateMediaGroups: vi.fn(),
      setMediaOrganizerGroups: vi.fn(),
      setMediaOrganizerCleanup: vi.fn(),
      setMediaOrganizerScanning: vi.fn(),
      setBatchTranscodeInitialPaths: vi.fn(),
    }),
  },
}));

vi.mock('../../store/editorUIStore', () => ({
  useEditorUIStore: {
    getState: () => ({
      setDuplicateMediaOpen: vi.fn(),
      setMediaOrganizerOpen: vi.fn(),
      setBatchTranscodeOpen: vi.fn(),
    }),
  },
}));

vi.mock('../../store/proxySettingsStore', () => ({
  useProxySettingsStore: {
    getState: () => ({ settings: {} }),
  },
}));

const mockCommandExecute = vi.fn();

vi.mock('../../store/commandManager', () => ({
  commandManager: {
    execute: (...args: any[]) => mockCommandExecute(...args),
    undo: vi.fn(),
  },
  projectAccessor: 'mock-project-accessor',
}));

vi.mock('../../lib/tauri-bridge', () => ({
  batchExtractCoverFrames: vi.fn(),
  bridgeConfirm: vi.fn(),
  moveFile: vi.fn(),
  trashFile: vi.fn(),
  getAppDataDir: vi.fn(() => Promise.resolve('/mock/app-data')),
  openDirectoryDialog: vi.fn(),
  scanDirectory: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
}));

const mockProbeMediaPaths = vi.fn();
const mockPickMediaPaths = vi.fn();

vi.mock('../../lib/media', () => ({
  probeMediaPaths: (...args: any[]) => mockProbeMediaPaths(...args),
  pickMediaPaths: (...args: any[]) => mockPickMediaPaths(...args),
}));

vi.mock('../../lib/duplicateMedia', () => ({
  generateMediaFingerprint: vi.fn(() => Promise.resolve(null)),
  scanDuplicateMediaGroups: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../lib/mediaOrganizer', () => ({
  buildArchiveDestinationPath: vi.fn(),
  buildRenameDestinationPath: vi.fn(),
  scanMediaCleanupReport: vi.fn(() => Promise.resolve({ unused: [] })),
  scanSmartDuplicateMediaGroups: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../media/media-job-store', () => ({
  useMediaJobStore: {
    getState: () => ({
      enqueueProxyJobsForMedia: vi.fn(),
    }),
  },
}));

vi.mock('../../media/media-job-runner', () => ({
  ensureMediaJobRunner: vi.fn(),
}));

vi.mock('../../media/relink', () => ({
  relinkMissingMediaInDirectory: vi.fn(),
  relinkSingleMedia: vi.fn(),
}));

vi.mock('../../shared-library/sharedLibrary', () => ({
  loadSharedLibrary: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../lib/ui-helpers', () => ({
  joinLocalPath: vi.fn((...parts: string[]) => parts.join('/')),
}));

vi.mock('@open-factory/editor-core', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    AddMediaFolderCommand: vi.fn(),
    RenameMediaFolderCommand: vi.fn(),
    DeleteMediaFolderCommand: vi.fn(),
    SetMediaFolderCollapsedCommand: vi.fn(),
    MoveMediaToFolderCommand: vi.fn(),
    BatchUpdateMetadataCommand: vi.fn(),
    BatchRenameMediaCommand: vi.fn(),
    MergeMediaCommand: vi.fn(),
    RemoveMediaCommand: vi.fn(),
    AddSubclipCommand: vi.fn(),
    UpdateSubclipCommand: vi.fn(),
    DeleteSubclipCommand: vi.fn(),
    UpdateProjectReleaseVersionCommand: vi.fn(),
    ConformMediaCommand: vi.fn(),
    LoadProjectCommand: vi.fn(),
    buildCoverFrameBatchTasks: vi.fn(() => []),
    createId: vi.fn((prefix: string) => `${prefix}-mock-id`),
    dirname: vi.fn(() => '/mock/dir'),
    normalizeProjectWorkingColorSpace: vi.fn(() => 'sRGB'),
    getColorSpaceDisplayName: vi.fn(() => 'sRGB'),
    getProjectFrameRateConversionTarget: vi.fn(() => 30),
    isFrameRateMismatch: vi.fn(() => false),
    replaceMediaPathBasename: vi.fn((path: string, name: string) => `/mock/${name}.mp4`),
    matchConformByFilename: vi.fn(() => []),
    buildConformPreflight: vi.fn(() => []),
    buildConformMediaReplacements: vi.fn(() => []),
    buildConformReport: vi.fn(() => ({ successCount: 0, warningCount: 0, failureCount: 0 })),
    applyArchiveRelinkPlan: vi.fn((_project: any, entries: any[]) => ({ ..._project, media: [] })),
    buildVideoStitchSequence: vi.fn(),
  };
});

// ── 导入被测 Hook ────────────────────────────────────────────

import { useEditorShellMediaCallbacks } from '../useEditorShellMediaCallbacks';
import { showToast } from '../../lib/toast';
import { relinkSingleMedia, relinkMissingMediaInDirectory } from '../../media/relink';
import { scanDuplicateMediaGroups } from '../../lib/duplicateMedia';
import { moveFile as bridgeMoveFile } from '../../lib/tauri-bridge';
import {
  AddMediaFolderCommand,
  DeleteMediaFolderCommand,
  RenameMediaFolderCommand,
  SetMediaFolderCollapsedCommand,
  MoveMediaToFolderCommand,
  BatchUpdateMetadataCommand,
  BatchRenameMediaCommand,
  MergeMediaCommand,
  RemoveMediaCommand,
  AddSubclipCommand,
  UpdateSubclipCommand,
  DeleteSubclipCommand,
  UpdateProjectReleaseVersionCommand,
} from '@open-factory/editor-core';

// ── 辅助工具 ─────────────────────────────────────────────────

const createMockMediaAsset = (overrides: Partial<any> = {}): any => ({
  id: 'asset-1',
  name: 'test-video.mp4',
  path: '/mock/media/test-video.mp4',
  type: 'video',
  duration: 10,
  frameRate: 30,
  ...overrides,
});

const defaultDeps = {
  runAutomationForMedia: vi.fn(() => Promise.resolve()),
};

// ── 测试 ─────────────────────────────────────────────────────

describe('useEditorShellMediaCallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommandExecute.mockReset();
    mockEditorState = {
      project: {
        name: 'Test Project',
        media: [createMockMediaAsset()],
        mediaMetadata: {},
        settings: { fps: 30, workingColorSpace: 'sRGB', vfrHandling: 'ignore', width: 1920, height: 1080 },
        timeline: { tracks: [] },
      },
      projectPath: '/mock/path/test.cutproj.json',
      addMedia: mockAddMedia,
      setMedia: mockSetMedia,
      setMediaMetadata: mockSetMediaMetadata,
    };
  });

  // ── createMediaFolder ────────────────────────────────────────

  describe('createMediaFolder', () => {
    it('执行 AddMediaFolderCommand 创建文件夹', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.createMediaFolder();

      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
      expect(AddMediaFolderCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        expect.objectContaining({ name: expect.any(String) }),
      );
    });

    it('支持传入 parentId 创建子文件夹', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.createMediaFolder('parent-folder-id');

      expect(AddMediaFolderCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        expect.objectContaining({ parentId: 'parent-folder-id' }),
      );
    });

    it('命令执行失败时显示警告 toast', () => {
      mockCommandExecute.mockImplementation(() => {
        throw new Error('文件夹名称重复');
      });

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.createMediaFolder();

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'warning' }),
      );
    });
  });

  // ── deleteMediaFolder ────────────────────────────────────────

  describe('deleteMediaFolder', () => {
    it('执行 DeleteMediaFolderCommand 删除文件夹', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.deleteMediaFolder('folder-to-delete');

      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
      expect(DeleteMediaFolderCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        'folder-to-delete',
      );
    });
  });

  // ── renameMediaFolder ────────────────────────────────────────

  describe('renameMediaFolder', () => {
    it('执行 RenameMediaFolderCommand 重命名文件夹', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.renameMediaFolder('folder-1', '新名称');

      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
      expect(RenameMediaFolderCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        'folder-1',
        '新名称',
      );
    });
  });

  // ── relinkMedia ──────────────────────────────────────────────

  describe('relinkMedia', () => {
    it('重链接成功时更新媒体并显示成功 toast', async () => {
      const relinkedAsset = createMockMediaAsset({ id: 'asset-1', path: '/new/path/test-video.mp4', name: 'test-video.mp4' });
      vi.mocked(relinkSingleMedia).mockResolvedValue(relinkedAsset);

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.relinkMedia('asset-1');

      expect(relinkSingleMedia).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'asset-1' }),
      );
      expect(mockSetMedia).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'success' }),
      );
    });

    it('资产不存在时不执行任何操作', async () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.relinkMedia('nonexistent-id');

      expect(relinkSingleMedia).not.toHaveBeenCalled();
      expect(mockSetMedia).not.toHaveBeenCalled();
    });

    it('relinkSingleMedia 返回 null 时不执行更新', async () => {
      vi.mocked(relinkSingleMedia).mockResolvedValue(null as any);

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.relinkMedia('asset-1');

      expect(mockSetMedia).not.toHaveBeenCalled();
    });

    it('重链接失败时显示错误 toast', async () => {
      vi.mocked(relinkSingleMedia).mockRejectedValue(new Error('文件未找到'));

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.relinkMedia('asset-1');

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // ── batchRenameMedia ─────────────────────────────────────────

  describe('batchRenameMedia', () => {
    it('对变更项执行 BatchRenameMediaCommand', async () => {
      const preview = [
        { assetId: 'asset-1', changed: true, nextName: '重命名后的文件' },
        { assetId: 'asset-2', changed: false, nextName: '未变更' },
      ];

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.batchRenameMedia(['asset-1', 'asset-2'], preview as any, false);

      expect(BatchRenameMediaCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        expect.arrayContaining([
          expect.objectContaining({ assetId: 'asset-1', name: '重命名后的文件' }),
        ]),
      );
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'success' }),
      );
    });

    it('无变更项时不执行命令', async () => {
      const preview = [
        { assetId: 'asset-1', changed: false, nextName: '原名' },
      ];

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.batchRenameMedia(['asset-1'], preview as any, false);

      expect(mockCommandExecute).not.toHaveBeenCalled();
    });

    it('renameFiles=true 时会移动文件', async () => {
      vi.mocked(bridgeMoveFile).mockResolvedValue(undefined as any);
      const preview = [
        { assetId: 'asset-1', changed: true, nextName: '新名称' },
      ];

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.batchRenameMedia(['asset-1'], preview as any, true);

      expect(bridgeMoveFile).toHaveBeenCalled();
    });

    it('文件移动失败时回滚命令并显示错误', async () => {
      mockCommandExecute.mockImplementation(() => {}); // 第一次调用成功
      vi.mocked(bridgeMoveFile).mockRejectedValue(new Error('权限不足'));
      const preview = [
        { assetId: 'asset-1', changed: true, nextName: '新名称' },
      ];

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.batchRenameMedia(['asset-1'], preview as any, true);

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // ── handleAddSubclip ─────────────────────────────────────────

  describe('handleAddSubclip', () => {
    it('执行 AddSubclipCommand 并显示成功 toast', () => {
      const subclip = { id: 'sub-1', name: '精彩片段', inPoint: 5, outPoint: 10 };

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.handleAddSubclip(subclip as any);

      expect(AddSubclipCommand).toHaveBeenCalledWith('mock-project-accessor', subclip);
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'success' }),
      );
    });
  });

  // ── handleDeleteSubclip ──────────────────────────────────────

  describe('handleDeleteSubclip', () => {
    it('执行 DeleteSubclipCommand 并显示提示 toast', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.handleDeleteSubclip('sub-1');

      expect(DeleteSubclipCommand).toHaveBeenCalledWith('mock-project-accessor', 'sub-1');
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'info' }),
      );
    });
  });

  // ── mergeDuplicateMediaGroups ────────────────────────────────

  describe('mergeDuplicateMediaGroups', () => {
    it('对每个选择组执行 MergeMediaCommand', () => {
      const selections = [
        { keepAssetId: 'asset-1', assetIds: ['asset-2'] },
        { keepAssetId: 'asset-3', assetIds: ['asset-4'] },
      ];

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.mergeDuplicateMediaGroups(selections as any);

      expect(MergeMediaCommand).toHaveBeenCalledTimes(2);
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'success' }),
      );
    });

    it('命令执行失败时显示错误 toast', () => {
      mockCommandExecute.mockImplementation(() => {
        throw new Error('合并失败');
      });

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.mergeDuplicateMediaGroups([
        { keepAssetId: 'asset-1', assetIds: ['asset-2'] },
      ] as any);

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // ── importMedia ──────────────────────────────────────────────

  describe('importMedia', () => {
    it('成功导入媒体后显示成功 toast', async () => {
      const media = [createMockMediaAsset()];
      mockPickMediaPaths.mockResolvedValue(['/mock/media/test.mp4']);
      mockProbeMediaPaths.mockResolvedValue({ media, duplicateCount: 0 });

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.importMedia();

      expect(mockAddMedia).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'success' }),
      );
      expect(defaultDeps.runAutomationForMedia).toHaveBeenCalledWith('on-import', media);
    });

    it('无路径选择时不执行导入', async () => {
      mockPickMediaPaths.mockResolvedValue([]);

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.importMedia();

      expect(mockProbeMediaPaths).not.toHaveBeenCalled();
      expect(mockAddMedia).not.toHaveBeenCalled();
    });

    it('检测到重复时显示重复提示', async () => {
      mockPickMediaPaths.mockResolvedValue(['/mock/media/test.mp4']);
      mockProbeMediaPaths.mockResolvedValue({ media: [createMockMediaAsset()], duplicateCount: 2 });

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.importMedia();

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'info' }),
      );
    });

    it('导入失败时显示错误 toast', async () => {
      mockPickMediaPaths.mockRejectedValue(new Error('文件读取失败'));

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.importMedia();

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // ── updateProjectReleaseVersion ──────────────────────────────

  describe('updateProjectReleaseVersion', () => {
    it('执行 UpdateProjectReleaseVersionCommand', async () => {
      const { UpdateProjectReleaseVersionCommand } = await import('@open-factory/editor-core');
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.updateProjectReleaseVersion('1.0.0');

      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
    });
  });

  // ── relinkAllMissing ─────────────────────────────────────────

  describe('relinkAllMissing', () => {
    it('批量重链接成功时更新媒体并显示成功 toast', async () => {
      vi.mocked(relinkMissingMediaInDirectory).mockResolvedValue({
        media: [createMockMediaAsset()],
        relinkedCount: 2,
        warnings: [],
      });

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.relinkAllMissing();

      expect(relinkMissingMediaInDirectory).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'asset-1' })]),
      );
      expect(mockSetMedia).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'success' }),
      );
    });

    it('批量重链接失败时显示错误 toast', async () => {
      vi.mocked(relinkMissingMediaInDirectory).mockRejectedValue(
        new Error('扫描目录失败'),
      );

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.relinkAllMissing();

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // ── scanDuplicateMedia ───────────────────────────────────────

  describe('scanDuplicateMedia', () => {
    it('扫描到重复媒体时打开重复媒体对话框', async () => {
      const groups = [{ keepAssetId: 'asset-1', removeAssetIds: ['asset-2'] }];
      vi.mocked(scanDuplicateMediaGroups).mockResolvedValue(groups as any);

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.scanDuplicateMedia();

      expect(scanDuplicateMediaGroups).toHaveBeenCalled();
    });

    it('无重复媒体时显示提示 toast', async () => {
      vi.mocked(scanDuplicateMediaGroups).mockResolvedValue([]);

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.scanDuplicateMedia();

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'info' }),
      );
    });

    it('扫描失败时显示错误 toast', async () => {
      vi.mocked(scanDuplicateMediaGroups).mockRejectedValue(
        new Error('指纹生成失败'),
      );

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      await result.current.scanDuplicateMedia();

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // ── handleUpdateSubclip ──────────────────────────────────────

  describe('handleUpdateSubclip', () => {
    it('执行 UpdateSubclipCommand 更新子剪辑', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.handleUpdateSubclip('sub-1', { name: '更新后的名称' });

      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
      expect(UpdateSubclipCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        'sub-1',
        { name: '更新后的名称' },
      );
    });
  });

  // ── setMediaFolderCollapsed ──────────────────────────────────

  describe('setMediaFolderCollapsed', () => {
    it('执行 SetMediaFolderCollapsedCommand 折叠文件夹', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.setMediaFolderCollapsed('folder-1', true);

      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
      expect(SetMediaFolderCollapsedCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        'folder-1',
        true,
      );
    });

    it('执行 SetMediaFolderCollapsedCommand 展开文件夹', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.setMediaFolderCollapsed('folder-1', false);

      expect(SetMediaFolderCollapsedCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        'folder-1',
        false,
      );
    });
  });

  // ── moveMediaToFolder ───────────────────────────────────────

  describe('moveMediaToFolder', () => {
    it('执行 MoveMediaToFolderCommand 移动媒体到文件夹', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.moveMediaToFolder(['asset-1', 'asset-2'], 'folder-1');

      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
      expect(MoveMediaToFolderCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        ['asset-1', 'asset-2'],
        'folder-1',
      );
    });

    it('移动到根目录时 folderId 为 null', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.moveMediaToFolder(['asset-1'], null);

      expect(MoveMediaToFolderCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        ['asset-1'],
        null,
      );
    });
  });

  // ── batchUpdateMediaMetadata ─────────────────────────────────

  describe('batchUpdateMediaMetadata', () => {
    it('对多个资产执行 BatchUpdateMetadataCommand 并显示成功 toast', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.batchUpdateMediaMetadata(['asset-1', 'asset-2'], { title: '测试标题' });

      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
      expect(BatchUpdateMetadataCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        expect.arrayContaining([
          expect.objectContaining({ assetId: 'asset-1', metadata: { title: '测试标题' } }),
          expect.objectContaining({ assetId: 'asset-2', metadata: { title: '测试标题' } }),
        ]),
      );
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'success' }),
      );
    });

    it('空资产列表时不执行命令', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.batchUpdateMediaMetadata([], { title: '测试标题' });

      expect(mockCommandExecute).not.toHaveBeenCalled();
    });
  });

  // ── removeMediaOrganizerReferences ───────────────────────────

  describe('removeMediaOrganizerReferences', () => {
    it('执行 RemoveMediaCommand 移除媒体引用', () => {
      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.removeMediaOrganizerReferences(['asset-1', 'asset-2']);

      expect(mockCommandExecute).toHaveBeenCalledTimes(1);
      expect(RemoveMediaCommand).toHaveBeenCalledWith(
        'mock-project-accessor',
        ['asset-1', 'asset-2'],
      );
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'success' }),
      );
    });

    it('命令执行失败时显示错误 toast', () => {
      mockCommandExecute.mockImplementation(() => {
        throw new Error('移除失败');
      });

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.removeMediaOrganizerReferences(['asset-1']);

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // ── jumpToMediaAsset ─────────────────────────────────────────

  describe('jumpToMediaAsset', () => {
    it('查找 DOM 元素并滚动到视图中', () => {
      const mockElement = { scrollIntoView: vi.fn(), focus: vi.fn() };
      vi.spyOn(document, 'querySelector').mockReturnValue(mockElement as any);

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      result.current.jumpToMediaAsset('asset-1');

      expect(document.querySelector).toHaveBeenCalledWith('[data-testid="media-card-asset-1"]');
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
      expect(mockElement.focus).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('找不到元素时不抛出异常', () => {
      vi.spyOn(document, 'querySelector').mockReturnValue(null);

      const { result } = renderHook(() => useEditorShellMediaCallbacks(defaultDeps));
      expect(() => result.current.jumpToMediaAsset('nonexistent')).not.toThrow();

      vi.restoreAllMocks();
    });
  });
});
