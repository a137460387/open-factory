import { logError } from "../../lib/error-handlers";
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock 外部依赖 ────────────────────────────────────────────

const mockSetMedia = vi.fn();
const mockCommandExecute = vi.fn();
const mockMoveFile = vi.fn();
const mockRemoveFile = vi.fn();
const mockCreateProxyForAsset = vi.fn() as any;
const mockBuildProxyMigration = vi.fn(() => []) as any;
const mockGetProjectFrameRateConversionTarget = vi.fn(() => 30) as any;
const mockGetCfrTargetFrameRate = vi.fn(() => 30) as any;

let mockEditorState: Record<string, any>;

vi.mock('../../store/editorStore', () => {
  const store = (selector?: any) => {
    if (typeof selector === 'function') return selector(mockEditorState);
    return undefined;
  };
  store.getState = () => mockEditorState;
  return { useEditorStore: store };
});

vi.mock('../../store/commandManager', () => ({
  commandManager: {
    execute: (...args: any[]) => mockCommandExecute(...args),
  },
  projectAccessor: {
    getProject: () => mockEditorState?.project,
    setProject: vi.fn(),
  },
}));

vi.mock('../../media/proxy', () => ({
  createProxyForAsset: (...args: any[]) => mockCreateProxyForAsset(...args),
}));

vi.mock('../../lib/tauri-bridge', () => ({
  moveFile: (...args: any[]) => mockMoveFile(...args),
  removeFile: (...args: any[]) => mockRemoveFile(...args),
}));

vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('@open-factory/editor-core', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    MigrateProxiesCommand: vi.fn(),
    getProjectFrameRateConversionTarget: (...args: any[]) => mockGetProjectFrameRateConversionTarget(...args),
    getCfrTargetFrameRate: (...args: any[]) => mockGetCfrTargetFrameRate(...args),
    buildProxyMigration: (...args: any[]) => mockBuildProxyMigration(...args),
  };
});

// ── 导入被测 Hook ────────────────────────────────────────────

import { useProxyCallbacks } from '../useEditorShellProxyCallbacks';
import { showToast } from '../../lib/toast';

// ── 测试 ─────────────────────────────────────────────────────

const DEFAULT_PROXY_SETTINGS = { maxWidth: 1920, maxHeight: 1080, videoBitrate: '5M', triggerShortEdge: 640 };

describe('useProxyCallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditorState = {
      project: {
        name: 'TestProject',
        media: [
          { id: 'video-1', name: 'test.mp4', type: 'video', proxyPath: undefined, proxyStatus: 'none' },
          { id: 'video-2', name: 'test2.mp4', type: 'video', proxyPath: '/path/to/proxy.mp4', proxyStatus: 'ready' },
          { id: 'audio-1', name: 'audio.mp3', type: 'audio', proxyPath: undefined },
        ],
      },
      setMedia: mockSetMedia,
    };
  });

  it('导出所有预期的函数', () => {
    const { result } = renderHook(() =>
      useProxyCallbacks({
        proxySettings: DEFAULT_PROXY_SETTINGS,
        projectFps: 30,
      })
    );

    expect(result.current.generateProxyForMedia).toBeDefined();
    expect(result.current.deleteProxiesForMedia).toBeDefined();
    expect(result.current.regenerateProxiesForMedia).toBeDefined();
    expect(result.current.migrateProxiesToDirectory).toBeDefined();
    expect(result.current.convertVfrMediaToCfr).toBeDefined();
  });

  // --- generateProxyForMedia ---
  it('generateProxyForMedia 对非 video 类型资产不执行操作', async () => {
    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    await result.current.generateProxyForMedia('audio-1');

    expect(mockSetMedia).not.toHaveBeenCalled();
  });

  it('generateProxyForMedia 对不存在的资产 ID 不执行操作', async () => {
    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    await result.current.generateProxyForMedia('nonexistent-id');

    expect(mockSetMedia).not.toHaveBeenCalled();
  });

  it('generateProxyForMedia 成功时更新 media 为 proxy 资产', async () => {
    const proxyAsset = { id: 'video-1', name: 'test.mp4', type: 'video', proxyPath: '/proxy/test.mp4', proxyStatus: 'ready' };
    mockCreateProxyForAsset.mockResolvedValue(proxyAsset);

    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    await result.current.generateProxyForMedia('video-1');

    // 第一次调用设为 pending，第二次设为结果
    expect(mockSetMedia).toHaveBeenCalledTimes(2);
    // 验证第一次设为 pending
    const firstCallMedia = mockSetMedia.mock.calls[0][0];
    expect(firstCallMedia.find((m: any) => m.id === 'video-1').proxyStatus).toBe('pending');
    // 验证成功提示
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('generateProxyForMedia 失败时设置 error 状态并显示错误提示', async () => {
    mockCreateProxyForAsset.mockRejectedValue(new Error('FFmpeg failed'));

    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    await result.current.generateProxyForMedia('video-1');

    // 验证 error 状态
    expect(mockSetMedia).toHaveBeenCalledTimes(2);
    const errorMedia = mockSetMedia.mock.calls[1][0];
    expect(errorMedia.find((m: any) => m.id === 'video-1').proxyStatus).toBe('error');
    expect(errorMedia.find((m: any) => m.id === 'video-1').proxyError).toBe('FFmpeg failed');
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });

  // --- deleteProxiesForMedia ---
  it('deleteProxiesForMedia 清除指定资产的代理路径', async () => {
    mockRemoveFile.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    await result.current.deleteProxiesForMedia(['video-2']);

    expect(mockRemoveFile).toHaveBeenCalledWith('/path/to/proxy.mp4');
    expect(mockSetMedia).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('deleteProxiesForMedia 在无代理路径时不调用 removeFile', async () => {
    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    await result.current.deleteProxiesForMedia(['video-1']);

    expect(mockRemoveFile).not.toHaveBeenCalled();
    expect(mockSetMedia).toHaveBeenCalled();
  });

  it('deleteProxiesForMedia 即使 removeFile 失败也会继续清除状态（错误被 catch 吞掉）', async () => {
    mockRemoveFile.mockRejectedValue(new Error('Permission denied'));

    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    await result.current.deleteProxiesForMedia(['video-2']);

    // removeFile 的错误被 .catch(logError("useEditorShellProxyCallbacks.test")) 吞掉，仍然会走到 setMedia 和 success toast
    expect(mockRemoveFile).toHaveBeenCalled();
    expect(mockSetMedia).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  // --- migrateProxiesToDirectory ---
  it('migrateProxiesToDirectory 在无代理需要迁移时显示提示', async () => {
    mockBuildProxyMigration.mockReturnValue([]);

    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    await result.current.migrateProxiesToDirectory('/new/path');

    expect(mockCommandExecute).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'info' }));
  });

  it('migrateProxiesToDirectory 成功迁移时执行 command 并显示成功提示', async () => {
    const updates = [
      { fromPath: '/old/proxy.mp4', toPath: '/new/proxy.mp4', assetId: 'video-2' },
    ];
    mockBuildProxyMigration.mockReturnValue(updates);
    mockMoveFile.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    await result.current.migrateProxiesToDirectory('/new/path');

    expect(mockMoveFile).toHaveBeenCalledWith('/old/proxy.mp4', '/new/proxy.mp4');
    expect(mockCommandExecute).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('migrateProxiesToDirectory 迁移失败时显示错误提示（moved 为空时不回滚）', async () => {
    const updates = [
      { fromPath: '/old/proxy.mp4', toPath: '/new/proxy.mp4', assetId: 'video-2' },
    ];
    mockBuildProxyMigration.mockReturnValue(updates);
    // 第一次 moveFile 就失败，moved 数组为空，回滚循环不执行
    mockMoveFile.mockRejectedValue(new Error('Disk full'));

    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    await result.current.migrateProxiesToDirectory('/new/path');

    // 只调用了一次 moveFile（失败的那次），回滚循环因为 moved 为空不执行
    expect(mockMoveFile).toHaveBeenCalledTimes(1);
    expect(mockMoveFile).toHaveBeenCalledWith('/old/proxy.mp4', '/new/proxy.mp4');
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });

  // --- convertVfrMediaToCfr ---
  it('convertVfrMediaToCfr 对非 video 类型资产不执行操作', () => {
    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    result.current.convertVfrMediaToCfr('audio-1');

    expect(mockCreateProxyForAsset).not.toHaveBeenCalled();
  });

  it('convertVfrMediaToCfr 对不存在的资产不执行操作', () => {
    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    result.current.convertVfrMediaToCfr('nonexistent');

    expect(mockCreateProxyForAsset).not.toHaveBeenCalled();
  });

  it('convertVfrMediaToCfr 对 video 资产调用 generateProxyForMedia 带 cfrFrameRate', async () => {
    mockGetProjectFrameRateConversionTarget.mockReturnValue(30);
    mockCreateProxyForAsset.mockResolvedValue({ id: 'video-1', proxyStatus: 'ready' });

    const { result } = renderHook(() =>
      useProxyCallbacks({ proxySettings: DEFAULT_PROXY_SETTINGS, projectFps: 30 })
    );

    result.current.convertVfrMediaToCfr('video-1');

    // 应该调用 generateProxyForMedia
    await vi.waitFor(() => {
      expect(mockCreateProxyForAsset).toHaveBeenCalled();
    });
  });
});
