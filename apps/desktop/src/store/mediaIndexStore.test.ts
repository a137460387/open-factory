import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock tauri-bridge 模块
vi.mock('../lib/tauri-bridge', () => ({
  searchMediaAssets: vi.fn(),
  getAllTags: vi.fn(),
}));

import { useMediaIndexStore } from './mediaIndexStore';
import { searchMediaAssets, getAllTags } from '../lib/tauri-bridge';

const mockSearchMediaAssets = vi.mocked(searchMediaAssets);
const mockGetAllTags = vi.mocked(getAllTags);

describe('mediaIndexStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useMediaIndexStore.setState({
      searchQuery: { projectPath: '' },
      searchResults: null,
      isSearching: false,
      allTags: [],
      tagsLoading: false,
    });
    vi.clearAllMocks();
  });

  describe('setProjectPath', () => {
    it('设置项目路径并重置状态', () => {
      const { setProjectPath } = useMediaIndexStore.getState();
      setProjectPath('/test/project');

      const state = useMediaIndexStore.getState();
      expect(state.searchQuery.projectPath).toBe('/test/project');
      expect(state.searchResults).toBeNull();
      expect(state.allTags).toEqual([]);
    });
  });

  describe('setSearchQuery', () => {
    it('更新搜索查询并触发搜索', async () => {
      mockSearchMediaAssets.mockResolvedValue({
        assets: [],
        total: 0,
        page: 1,
        pageSize: 50,
      });

      const { setProjectPath, setSearchQuery } = useMediaIndexStore.getState();
      setProjectPath('/test/project');
      setSearchQuery({ text: 'test' });

      // 等待异步搜索完成
      await vi.waitFor(() => {
        expect(mockSearchMediaAssets).toHaveBeenCalled();
      });
    });
  });

  describe('executeSearch', () => {
    it('无项目路径时不执行搜索', async () => {
      const { executeSearch } = useMediaIndexStore.getState();
      await executeSearch();

      expect(mockSearchMediaAssets).not.toHaveBeenCalled();
    });

    it('执行搜索并更新结果', async () => {
      const mockResult = {
        assets: [
          {
            id: '1',
            path: '/test/video.mp4',
            name: 'video.mp4',
            assetType: 'video',
            importedAt: '2026-07-13T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      };
      mockSearchMediaAssets.mockResolvedValue(mockResult);

      const { setProjectPath, executeSearch } = useMediaIndexStore.getState();
      setProjectPath('/test/project');
      await executeSearch();

      const state = useMediaIndexStore.getState();
      expect(state.searchResults).toEqual(mockResult);
      expect(state.isSearching).toBe(false);
    });

    it('搜索失败时设置 isSearching 为 false', async () => {
      mockSearchMediaAssets.mockRejectedValue(new Error('搜索失败'));

      const { setProjectPath, executeSearch } = useMediaIndexStore.getState();
      setProjectPath('/test/project');
      await executeSearch();

      const state = useMediaIndexStore.getState();
      expect(state.isSearching).toBe(false);
      expect(state.searchResults).toBeNull();
    });
  });

  describe('标签过滤', () => {
    it('添加标签过滤', () => {
      const { setProjectPath, addTagFilter } = useMediaIndexStore.getState();
      setProjectPath('/test/project');
      addTagFilter('4K');

      const state = useMediaIndexStore.getState();
      expect(state.searchQuery.tags).toContain('4K');
    });

    it('不重复添加标签', () => {
      const { setProjectPath, addTagFilter } = useMediaIndexStore.getState();
      setProjectPath('/test/project');
      addTagFilter('4K');
      addTagFilter('4K');

      const state = useMediaIndexStore.getState();
      expect(state.searchQuery.tags).toEqual(['4K']);
    });

    it('移除标签过滤', () => {
      const { setProjectPath, addTagFilter, removeTagFilter } =
        useMediaIndexStore.getState();
      setProjectPath('/test/project');
      addTagFilter('4K');
      addTagFilter('HDR');
      removeTagFilter('4K');

      const state = useMediaIndexStore.getState();
      expect(state.searchQuery.tags).toEqual(['HDR']);
    });
  });

  describe('类型过滤', () => {
    it('切换类型过滤', () => {
      const { setProjectPath, toggleAssetType } = useMediaIndexStore.getState();
      setProjectPath('/test/project');
      toggleAssetType('video');

      expect(useMediaIndexStore.getState().searchQuery.assetTypes).toContain('video');

      toggleAssetType('video');
      expect(useMediaIndexStore.getState().searchQuery.assetTypes).not.toContain('video');
    });

    it('支持多类型选择', () => {
      const { setProjectPath, toggleAssetType } = useMediaIndexStore.getState();
      setProjectPath('/test/project');
      toggleAssetType('video');
      toggleAssetType('audio');

      const state = useMediaIndexStore.getState();
      expect(state.searchQuery.assetTypes).toContain('video');
      expect(state.searchQuery.assetTypes).toContain('audio');
    });
  });

  describe('分辨率过滤', () => {
    it('设置分辨率范围', () => {
      const { setProjectPath, setResolutionRange } = useMediaIndexStore.getState();
      setProjectPath('/test/project');
      setResolutionRange(1920, 3840);

      const state = useMediaIndexStore.getState();
      expect(state.searchQuery.minWidth).toBe(1920);
      expect(state.searchQuery.maxWidth).toBe(3840);
    });

    it('清除分辨率范围', () => {
      const { setProjectPath, setResolutionRange } = useMediaIndexStore.getState();
      setProjectPath('/test/project');
      setResolutionRange(1920, 3840);
      setResolutionRange();

      const state = useMediaIndexStore.getState();
      expect(state.searchQuery.minWidth).toBeUndefined();
      expect(state.searchQuery.maxWidth).toBeUndefined();
    });
  });

  describe('时长过滤', () => {
    it('设置时长范围', () => {
      const { setProjectPath, setDurationRange } = useMediaIndexStore.getState();
      setProjectPath('/test/project');
      setDurationRange(10000, 60000);

      const state = useMediaIndexStore.getState();
      expect(state.searchQuery.minDurationMs).toBe(10000);
      expect(state.searchQuery.maxDurationMs).toBe(60000);
    });
  });

  describe('clearFilters', () => {
    it('清除所有筛选条件但保留项目路径', () => {
      const { setProjectPath, addTagFilter, toggleAssetType, clearFilters } =
        useMediaIndexStore.getState();
      setProjectPath('/test/project');
      addTagFilter('4K');
      toggleAssetType('video');

      clearFilters();

      const state = useMediaIndexStore.getState();
      expect(state.searchQuery.projectPath).toBe('/test/project');
      expect(state.searchQuery.tags).toBeUndefined();
      expect(state.searchQuery.assetTypes).toBeUndefined();
      expect(state.searchResults).toBeNull();
    });
  });

  describe('refreshTags', () => {
    it('获取标签列表', async () => {
      const mockTags = [
        { id: 1, name: '4K', count: 5 },
        { id: 2, name: 'HDR', count: 3 },
      ];
      mockGetAllTags.mockResolvedValue(mockTags);

      const { refreshTags } = useMediaIndexStore.getState();
      await refreshTags('/test/project');

      const state = useMediaIndexStore.getState();
      expect(state.allTags).toEqual(mockTags);
      expect(state.tagsLoading).toBe(false);
    });

    it('获取标签失败时设置 loading 为 false', async () => {
      mockGetAllTags.mockRejectedValue(new Error('获取失败'));

      const { refreshTags } = useMediaIndexStore.getState();
      await refreshTags('/test/project');

      const state = useMediaIndexStore.getState();
      expect(state.tagsLoading).toBe(false);
    });
  });
});
