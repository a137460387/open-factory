// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';

// vitest 未开 globals，testing-library 自动 cleanup 不会注册；
// 不显式清理时前一个用例的容器滞留 body，getByTestId 会跨用例命中。
afterEach(() => {
  cleanup();
});

// MediaBin 模块图会 import tauri-bridge（及其子 barrel）。测试只验证渲染结构，
// 用 importOriginal + Proxy 兜底：真实导出保留，未列出的函数回落为 no-op vi.fn。
// 注意 get 陷阱必须对 'then' 返回 undefined，否则模块被当成 thenable 导致挂起。
vi.mock('../../lib/tauri-bridge', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return new Proxy(actual, {
    get(target, prop) {
      if (prop === 'then' || typeof prop !== 'string') return undefined;
      if (prop in target) return target[prop];
      return vi.fn();
    },
  });
});

// 可控状态 holder（vi.mock 工厂被提升，须用 vi.hoisted 共享可变引用）
const holder = vi.hoisted(() => ({
  smartAlbumId: 'none' as string,
  media: [] as unknown[],
}));

vi.mock('./useMediaBinState', () => ({
  useMediaBinState: () => createMediaBinStateMock(),
}));

import type { MediaAsset, MediaFolder } from '@open-factory/editor-core';
import { MediaBin, selectMediaGridScopeMedia } from './MediaBin';

// jsdom 无 ResizeObserver（useColumnCount 与 virtualizer 都会用到）
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  // jsdom 无 Element.prototype.scrollTo，virtualizer 的 scrollToIndex 会走到
  (Element.prototype as unknown as Record<string, unknown>).scrollTo = vi.fn();
});

function createMediaBinStateMock(): Record<string, unknown> {
  const media = holder.media as MediaAsset[];
  const smartAlbumId = holder.smartAlbumId;
  const values: Record<string, unknown> = {
    dragOver: false,
    search: '',
    filter: 'all',
    quickFilter: 'all',
    sceneFilter: 'all',
    smartAlbumId,
    smartAlbums: smartAlbumId === 'none' ? [] : [{ id: smartAlbumId, assetIds: media.map((asset) => asset.id) }],
    mediaLibraryView: { mode: 'grid', gridSize: 'medium', sortKey: 'importedAt', sortDirection: 'desc' },
    mediaInfo: undefined,
    sourcePaths: undefined,
    effectPresets: [],
    effectPresetsLoading: false,
    effectPresetsError: undefined,
    selectedMediaIds: new Set<string>(),
    batchMetadataAssets: [],
    batchRenameAssets: [],
    detailsAssetId: null,
    detailsAsset: null,
    subclipDialogAssetId: undefined,
    editingSubclipId: undefined,
    expandedSubclipAssetIds: new Set<string>(),
    aiAnalysisAsset: undefined,
    qualityResults: new Map(),
    qualityErrors: new Map(),
    qualityLoading: new Set<string>(),
    aiSearchMode: false,
    organizePanelOpen: false,
    projectPath: '',
    _effectivePinnedIds: new Set<string>(),
    sortedVisibleMedia: media,
    mediaHighlights: new Map(),
    importedTimelineMedia: media,
    jobs: [],
    runnerActive: false,
    runningJob: null,
    pendingCount: 0,
    failedCount: 0,
    selectedVideoIds: [],
  };
  return new Proxy(values, {
    get(target, prop) {
      if (prop === 'then' || typeof prop !== 'string') return undefined;
      if (prop in target) return target[prop];
      return vi.fn();
    },
  });
}

function makeAsset(id: string, folderId?: string): MediaAsset {
  return {
    id,
    name: `${id}.mp4`,
    path: `C:/Media/${id}.mp4`,
    type: 'video',
    duration: 5,
    width: 1920,
    height: 1080,
    fps: 30,
    sizeBytes: 1000,
    importedAt: Date.now(),
    folderId,
  } as unknown as MediaAsset;
}

const mediaBinProps = {
  mediaFolders: [] as MediaFolder[],
  mediaMetadata: {},
  mediaContentAnalysis: {},
  projectFrameRate: 30,
  onImport: () => {},
  onImportPaths: () => {},
  onBatchTranscode: () => {},
  onBatchGenerateCovers: () => {},
  onGenerateThumbnails: () => {},
  onExportGif: () => {},
  onAnalyzeSpectrum: () => {},
  onScanDuplicates: () => {},
  onAddToTimeline: () => {},
  onAddVersion: () => {},
  onCompareVersions: () => {},
  onAddAdjustmentLayer: () => {},
  onRelink: () => {},
  onRelinkAll: () => {},
  onGenerateProxy: () => {},
  onConvertToCfr: () => {},
  onSetLabel: () => {},
  onSetRating: () => {},
  onSetFlag: () => {},
  onBatchUpdateMetadata: () => {},
  onBatchRenameMedia: () => {},
  onAddTitleTemplate: () => {},
  onCreateFolder: () => {},
  onRenameFolder: () => {},
  onDeleteFolder: () => {},
  onSetFolderCollapsed: () => {},
  onMoveMediaToFolder: () => {},
  onApplyEffectPreset: () => {},
};

describe('selectMediaGridScopeMedia（切数据不切组件的数据契约）', () => {
  it('普通 scope（none）：只保留未分类素材（已分类由文件夹树渲染）', () => {
    const media = [makeAsset('a'), makeAsset('b', 'folder-1'), makeAsset('c')];
    expect(selectMediaGridScopeMedia(media, 'none').map((asset) => asset.id)).toEqual(['a', 'c']);
  });

  it('智能相册 scope：不过滤文件夹，全量可见素材直接进网格', () => {
    const media = [makeAsset('a'), makeAsset('b', 'folder-1'), makeAsset('c')];
    expect(selectMediaGridScopeMedia(media, 'rating-five').map((asset) => asset.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('MediaBin 网格常驻挂载（方案 E：scope 切换只换数据不重挂载）', () => {
  it('普通→智能相册：media-grid-view 保持同一 DOM 实例，文件夹 chrome 卸载', () => {
    holder.media = [makeAsset('a'), makeAsset('b'), makeAsset('c')];
    holder.smartAlbumId = 'none';
    const { getByTestId, queryByTestId, rerender } = render(<MediaBin media={holder.media as MediaAsset[]} {...mediaBinProps} />);

    const gridBefore = getByTestId('media-grid-view');
    expect(gridBefore).toBeTruthy();
    // 普通 scope：根拖放区（folder chrome）在位
    expect(queryByTestId('media-folder-root-dropzone')).toBeTruthy();

    // 切到智能相册（模拟点击 smart-album-* 后的状态变化）
    holder.smartAlbumId = 'rating-five';
    rerender(<MediaBin media={holder.media as MediaAsset[]} {...mediaBinProps} />);

    expect(getByTestId('media-grid-view')).toBe(gridBefore); // 同一节点 ⇒ 未重挂载
    expect(queryByTestId('media-folder-root-dropzone')).toBeNull(); // chrome 已卸载
  });

  it('智能相册→普通：网格仍保持同一 DOM 实例（双向常驻），chrome 恢复', () => {
    holder.media = [makeAsset('a'), makeAsset('b')];
    holder.smartAlbumId = 'rating-five';
    const { getByTestId, queryByTestId, rerender } = render(<MediaBin media={holder.media as MediaAsset[]} {...mediaBinProps} />);

    const gridBefore = getByTestId('media-grid-view');
    expect(queryByTestId('media-folder-root-dropzone')).toBeNull();

    holder.smartAlbumId = 'none';
    rerender(<MediaBin media={holder.media as MediaAsset[]} {...mediaBinProps} />);

    expect(getByTestId('media-grid-view')).toBe(gridBefore);
    expect(queryByTestId('media-folder-root-dropzone')).toBeTruthy();
  });

  it('media 为空：渲染空态导入按钮而非网格（与重构前一致）', () => {
    holder.media = [];
    holder.smartAlbumId = 'none';
    const { container } = render(<MediaBin media={[]} {...mediaBinProps} />);
    expect(container.querySelector('[data-testid="media-grid-view"]')).toBeNull();
  });
});
