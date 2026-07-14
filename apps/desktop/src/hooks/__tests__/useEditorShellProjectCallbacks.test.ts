// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock 外部依赖（在 import 之前声明） ──────────────────────

const mockSetProject = vi.fn();
const mockSetProjectPath = vi.fn();
const mockSetDirty = vi.fn();
const mockSetPlayheadTime = vi.fn();
const mockClearSelectedClipIds = vi.fn();
const mockSetTemplateExportPreset = vi.fn();
const mockSetProjectPasswordRequest = vi.fn();
const mockSetArchiveProgress = vi.fn();
const mockSetTimelineTemplateMode = vi.fn();
const mockSetProjectEncryptionSaveOpen = vi.fn();
const mockSetSnapshotNameOpen = vi.fn();
const mockSetProjectTemplateOpen = vi.fn();
const mockSetLastBackupAt = vi.fn();
const mockSetTutorialSignals = vi.fn();
const mockSetTutorialProgress = vi.fn();
const mockSetTutorialCelebrationVisible = vi.fn();
const mockCommandExecute = vi.fn();
const mockCommandClear = vi.fn();

let mockEditorState: Record<string, any>;

vi.mock('../../store/editorStore', () => ({
  useEditorStore: {
    getState: () => mockEditorState,
  },
}));

vi.mock('../../store/editorSettingsStore', () => ({
  useEditorSettingsStore: {
    getState: () => ({
      setLastBackupAt: mockSetLastBackupAt,
      setTutorialSignals: mockSetTutorialSignals,
      setTutorialProgress: mockSetTutorialProgress,
      setTutorialCelebrationVisible: mockSetTutorialCelebrationVisible,
    }),
  },
}));

vi.mock('../../store/editorFeatureStore', () => ({
  useEditorFeatureStore: {
    getState: () => ({
      setProjectPasswordRequest: mockSetProjectPasswordRequest,
      setArchiveProgress: mockSetArchiveProgress,
      setTemplateExportPreset: mockSetTemplateExportPreset,
      setTimelineTemplateMode: mockSetTimelineTemplateMode,
    }),
  },
}));

vi.mock('../../store/editorUIStore', () => ({
  useEditorUIStore: {
    getState: () => ({
      setProjectEncryptionSaveOpen: mockSetProjectEncryptionSaveOpen,
      setSnapshotNameOpen: mockSetSnapshotNameOpen,
      setProjectTemplateOpen: mockSetProjectTemplateOpen,
    }),
  },
}));

vi.mock('../../store/commandManager', () => ({
  commandManager: {
    execute: (...args: any[]) => mockCommandExecute(...args),
    clear: (...args: any[]) => mockCommandClear(...args),
  },
  projectAccessor: {
    getProject: () => mockEditorState?.project,
    setProject: (p: any) => mockEditorState?.setProject?.(p),
  },
}));

vi.mock('../../lib/projectFiles', () => ({
  chooseProjectSavePath: vi.fn(),
  chooseProjectToOpen: vi.fn(),
  confirmDiscardChanges: vi.fn(),
  deleteAutosaveAfterSave: vi.fn(),
  isEncryptedProjectPath: vi.fn(() => false),
  readProjectFile: vi.fn(),
  writeProjectFile: vi.fn(),
  setActiveProjectEncryptionPassword: vi.fn(),
}));

vi.mock('../../lib/tauri-bridge', () => ({
  bridgeConfirm: vi.fn(),
  copyFile: vi.fn(),
  openDirectoryDialog: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../../settings/appSettings', () => ({
  readBackupSettings: vi.fn(() => Promise.resolve({ lastBackupAt: undefined })),
  saveTutorialProgressSettings: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../lib/projectArchive', () => ({
  createProjectArchivePlan: vi.fn(),
  writeProjectArchive: vi.fn(),
}));

vi.mock('../../lib/mediaReport', () => ({
  collectProjectArchivePreflight: vi.fn(),
}));

vi.mock('../../lib/projectSnapshots', () => ({
  saveProjectSnapshot: vi.fn(),
}));

vi.mock('../../tutorial/tutorialState', () => ({
  normalizeTutorialProgressSettings: vi.fn((v: any) => v),
  skipTutorialProgress: vi.fn((v: any) => ({ ...v, tutorialSkipped: true })),
  DEFAULT_TUTORIAL_SIGNALS: {},
}));

vi.mock('@open-factory/editor-core', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    createProject: vi.fn((name: string) => ({
      version: '0.2',
      id: 'mock-project-id',
      name,
      settings: { fps: 30 },
      timeline: { tracks: [] },
      annotations: [],
      bookmarks: [],
      exportRanges: [],
    })),
    NewProjectCommand: vi.fn(),
    LoadProjectCommand: vi.fn(),
    getTimelineDuration: vi.fn(() => 10),
    instantiateProjectTemplate: vi.fn(() => ({
      project: { name: 'template', timeline: { tracks: [] } },
      exportSettings: {},
    })),
    applyTimelineVersionDiffSelection: vi.fn(),
    replaceProjectActiveTimeline: vi.fn(),
    dirname: vi.fn(() => '/mock/dir'),
  };
});

// ── 导入被测 Hook ────────────────────────────────────────────

import { useEditorShellProjectCallbacks } from '../useEditorShellProjectCallbacks';
import { writeProjectFile, deleteAutosaveAfterSave, chooseProjectSavePath } from '../../lib/projectFiles';
import { showToast } from '../../lib/toast';
import { NewProjectCommand, createProject } from '@open-factory/editor-core';
import { setActiveProjectEncryptionPassword } from '../../lib/projectFiles';

// ── 测试 ─────────────────────────────────────────────────────

describe('useEditorShellProjectCallbacks', () => {
  const mockProject = {
    name: 'Test Project',
    timeline: { tracks: [] },
    settings: { fps: 30 },
    annotations: [],
    bookmarks: [],
    exportRanges: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEditorState = {
      project: mockProject,
      projectPath: '/mock/path/test.cutproj.json',
      dirty: true,
      setProject: mockSetProject,
      setProjectPath: mockSetProjectPath,
      setDirty: mockSetDirty,
      setPlayheadTime: mockSetPlayheadTime,
      clearSelectedClipIds: mockClearSelectedClipIds,
    };
  });

  it('saveProject 使用已有 projectPath 保存文件并重置 dirty 状态', async () => {
    vi.mocked(writeProjectFile).mockResolvedValue(undefined as any);
    vi.mocked(deleteAutosaveAfterSave).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    await result.current.saveProject();

    expect(writeProjectFile).toHaveBeenCalledWith(
      mockProject,
      '/mock/path/test.cutproj.json',
      expect.objectContaining({ encrypted: false }),
    );
    expect(deleteAutosaveAfterSave).toHaveBeenCalledWith(
      '/mock/path/test.cutproj.json',
      '/mock/path/test.cutproj.json',
    );
    expect(mockSetProjectPath).toHaveBeenCalledWith('/mock/path/test.cutproj.json');
    expect(mockSetDirty).toHaveBeenCalledWith(false);
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('saveProject 在没有 projectPath 时调用 chooseProjectSavePath 获取路径', async () => {
    mockEditorState.projectPath = undefined;
    vi.mocked(chooseProjectSavePath).mockResolvedValue('/new/path/test.cutproj.json' as any);
    vi.mocked(writeProjectFile).mockResolvedValue(undefined as any);
    vi.mocked(deleteAutosaveAfterSave).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    await result.current.saveProject();

    expect(chooseProjectSavePath).toHaveBeenCalledWith('Test Project.cutproj.json', false);
    expect(writeProjectFile).toHaveBeenCalledWith(
      mockProject,
      '/new/path/test.cutproj.json',
      expect.objectContaining({ encrypted: false }),
    );
  });

  it('executeNewProject 执行 NewProjectCommand 并重置项目路径和加密密码', () => {
    const nextProject = { name: 'New Project', timeline: { tracks: [] } };

    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    result.current.executeNewProject(nextProject as any);

    expect(mockCommandExecute).toHaveBeenCalledTimes(1);
    expect(NewProjectCommand).toHaveBeenCalled();
    expect(mockCommandClear).toHaveBeenCalled();
    expect(setActiveProjectEncryptionPassword).toHaveBeenCalledWith(undefined);
    expect(mockSetProjectPath).toHaveBeenCalledWith(undefined);
    expect(mockSetDirty).toHaveBeenCalledWith(false);
  });

  it('executeNewProject 设置 templateExportPreset（当传入模板预设时）', () => {
    const nextProject = { name: 'Template Project', timeline: { tracks: [] } };
    const preset = { id: 'template-youtube', name: 'YouTube', builtin: true, settings: {} };

    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    result.current.executeNewProject(nextProject as any, preset as any);

    expect(mockSetTemplateExportPreset).toHaveBeenCalledWith(preset);
  });

  it('startTutorial 重置教程状态并保存进度', () => {
    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    result.current.startTutorial();

    expect(mockSetTutorialCelebrationVisible).toHaveBeenCalledWith(false);
    expect(mockSetTutorialProgress).toHaveBeenCalled();
  });

  // --- saveEncryptedProject ---
  it('saveEncryptedProject 打开加密保存对话框', () => {
    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    result.current.saveEncryptedProject();

    expect(mockSetProjectEncryptionSaveOpen).toHaveBeenCalledWith(true);
  });

  // --- skipTutorial ---
  it('skipTutorial 跳过教程并保存进度', () => {
    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    result.current.skipTutorial();

    expect(mockSetTutorialCelebrationVisible).toHaveBeenCalledWith(false);
    expect(mockSetTutorialProgress).toHaveBeenCalled();
  });

  // --- closeTutorialCelebration ---
  it('closeTutorialCelebration 关闭教程庆祝弹窗', () => {
    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    result.current.closeTutorialCelebration();

    expect(mockSetTutorialCelebrationVisible).toHaveBeenCalledWith(false);
  });

  // --- confirmProjectEncryptionSave ---
  it('confirmProjectEncryptionSave 关闭对话框并调用 saveProject', async () => {
    vi.mocked(writeProjectFile).mockResolvedValue(undefined as any);
    vi.mocked(deleteAutosaveAfterSave).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    await result.current.confirmProjectEncryptionSave({ encrypted: true });

    expect(mockSetProjectEncryptionSaveOpen).toHaveBeenCalledWith(false);
    expect(writeProjectFile).toHaveBeenCalled();
  });

  // --- restoreSnapshotProject ---
  it('restoreSnapshotProject 执行 LoadProjectCommand 并重置状态', () => {
    const snapshotProject = { name: 'Snapshot', timeline: { tracks: [] } };

    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    result.current.restoreSnapshotProject(snapshotProject as any);

    expect(mockCommandExecute).toHaveBeenCalled();
    expect(mockClearSelectedClipIds).toHaveBeenCalled();
    expect(mockSetPlayheadTime).toHaveBeenCalledWith(0);
  });

  // --- newProject ---
  it('newProject 在项目未修改时直接创建新项目', async () => {
    mockEditorState.dirty = false;

    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    await result.current.newProject();

    expect(mockCommandExecute).toHaveBeenCalled();
    expect(createProject).toHaveBeenCalled();
  });

  it('newProject 在项目已修改且用户确认丢弃时创建新项目', async () => {
    mockEditorState.dirty = true;
    const { confirmDiscardChanges } = await import('../../lib/projectFiles');
    vi.mocked(confirmDiscardChanges).mockResolvedValue(true as any);

    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    await result.current.newProject();

    expect(mockCommandExecute).toHaveBeenCalled();
  });

  it('newProject 在项目已修改且用户取消时不创建新项目', async () => {
    mockEditorState.dirty = true;
    const { confirmDiscardChanges } = await import('../../lib/projectFiles');
    vi.mocked(confirmDiscardChanges).mockResolvedValue(false as any);

    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    await result.current.newProject();

    expect(mockCommandExecute).not.toHaveBeenCalled();
  });

  // --- createProjectFromTemplate ---
  it('createProjectFromTemplate 使用模板创建项目', async () => {
    mockEditorState.dirty = false;

    const { result } = renderHook(() => useEditorShellProjectCallbacks());
    await result.current.createProjectFromTemplate('youtube-horizontal');

    expect(mockCommandExecute).toHaveBeenCalled();
    expect(mockSetProjectTemplateOpen).toHaveBeenCalledWith(false);
  });
});
