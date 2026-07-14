import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/tauri-bridge', () => ({
  initMediaIndexDb: vi.fn(),
  batchUpsertMediaAssets: vi.fn(),
  batchAutoTagAssets: vi.fn(),
}));

import {
  mediaAssetToIndexAsset,
  mediaAssetToAutoTagRequest,
  indexAndTagImportedMedia,
} from './media-index-integration';
import { initMediaIndexDb, batchUpsertMediaAssets, batchAutoTagAssets } from '../lib/tauri-bridge';
import type { MediaAsset } from '@open-factory/editor-core';

const mockInitMediaIndexDb = vi.mocked(initMediaIndexDb);
const mockBatchUpsertMediaAssets = vi.mocked(batchUpsertMediaAssets);
const mockBatchAutoTagAssets = vi.mocked(batchAutoTagAssets);

function makeTestAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 'test-asset-1',
    type: 'video',
    name: 'test-video.mp4',
    path: '/test/test-video.mp4',
    duration: 60,
    width: 1920,
    height: 1080,
    frameRate: 30,
    videoCodec: 'h264',
    audioCodec: 'aac',
    size: 100 * 1024 * 1024,
    importedAt: '2026-07-13T00:00:00Z',
    colorProfile: { colorSpace: 'bt709' },
    ...overrides,
  } as MediaAsset;
}

describe('media-index-integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mediaAssetToIndexAsset', () => {
    it('正确转换 MediaAsset 为 MediaIndexAsset', () => {
      const asset = makeTestAsset();
      const result = mediaAssetToIndexAsset(asset);

      expect(result.id).toBe('test-asset-1');
      expect(result.path).toBe('/test/test-video.mp4');
      expect(result.name).toBe('test-video.mp4');
      expect(result.assetType).toBe('video');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.frameRate).toBe(30);
      expect(result.videoCodec).toBe('h264');
      expect(result.durationMs).toBe(60000);
      expect(result.colorSpace).toBe('bt709');
    });

    it('处理缺失可选字段', () => {
      const asset = makeTestAsset({
        size: undefined,
        frameRate: undefined,
        videoCodec: undefined,
        colorProfile: undefined,
      });
      const result = mediaAssetToIndexAsset(asset);

      expect(result.fileSize).toBeUndefined();
      expect(result.frameRate).toBeUndefined();
      expect(result.videoCodec).toBeUndefined();
      expect(result.colorSpace).toBeUndefined();
    });
  });

  describe('mediaAssetToAutoTagRequest', () => {
    it('正确构建打标请求', () => {
      const asset = makeTestAsset();
      const result = mediaAssetToAutoTagRequest(asset, '/test/project');

      expect(result.projectPath).toBe('/test/project');
      expect(result.assetId).toBe('test-asset-1');
      expect(result.name).toBe('test-video.mp4');
      expect(result.assetType).toBe('video');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.durationMs).toBe(60000);
    });
  });

  describe('indexAndTagImportedMedia', () => {
    it('空媒体列表时不执行任何操作', async () => {
      await indexAndTagImportedMedia([], '/test/project');

      expect(mockInitMediaIndexDb).not.toHaveBeenCalled();
      expect(mockBatchAutoTagAssets).not.toHaveBeenCalled();
      expect(mockBatchUpsertMediaAssets).not.toHaveBeenCalled();
    });

    it('无项目路径时不执行任何操作', async () => {
      const assets = [makeTestAsset()];
      await indexAndTagImportedMedia(assets, '');

      expect(mockInitMediaIndexDb).not.toHaveBeenCalled();
    });

    it('正常流程：初始化数据库 -> 自动打标 -> 写入索引', async () => {
      mockInitMediaIndexDb.mockResolvedValue(undefined);
      mockBatchAutoTagAssets.mockResolvedValue([{ tags: ['1080p', '视频', 'H.264'] }]);
      mockBatchUpsertMediaAssets.mockResolvedValue(1);

      const assets = [makeTestAsset()];
      await indexAndTagImportedMedia(assets, '/test/project');

      // 1. 初始化数据库
      expect(mockInitMediaIndexDb).toHaveBeenCalledWith('/test/project');

      // 2. 自动打标
      expect(mockBatchAutoTagAssets).toHaveBeenCalledWith('/test/project', [
        expect.objectContaining({
          assetId: 'test-asset-1',
          assetType: 'video',
          width: 1920,
          height: 1080,
        }),
      ]);

      // 3. 写入索引
      expect(mockBatchUpsertMediaAssets).toHaveBeenCalledWith('/test/project', [
        expect.objectContaining({
          id: 'test-asset-1',
          assetType: 'video',
        }),
      ]);
    });

    it('数据库初始化失败时不阻断流程', async () => {
      mockInitMediaIndexDb.mockRejectedValue(new Error('DB init failed'));

      const assets = [makeTestAsset()];
      // 不应抛出异常
      await indexAndTagImportedMedia(assets, '/test/project');

      expect(mockBatchAutoTagAssets).not.toHaveBeenCalled();
      expect(mockBatchUpsertMediaAssets).not.toHaveBeenCalled();
    });

    it('自动打标失败时不阻断流程', async () => {
      mockInitMediaIndexDb.mockResolvedValue(undefined);
      mockBatchAutoTagAssets.mockRejectedValue(new Error('Tag failed'));
      mockBatchUpsertMediaAssets.mockResolvedValue(1);

      const assets = [makeTestAsset()];
      // 不应抛出异常
      await indexAndTagImportedMedia(assets, '/test/project');
    });

    it('批量处理多个资产', async () => {
      mockInitMediaIndexDb.mockResolvedValue(undefined);
      mockBatchAutoTagAssets.mockResolvedValue([{ tags: ['1080p', '视频'] }, { tags: ['音频'] }]);
      mockBatchUpsertMediaAssets.mockResolvedValue(2);

      const assets = [
        makeTestAsset({ id: 'v1', name: 'video.mp4', type: 'video' }),
        makeTestAsset({ id: 'a1', name: 'audio.mp3', type: 'audio' }),
      ];
      await indexAndTagImportedMedia(assets, '/test/project');

      expect(mockBatchAutoTagAssets).toHaveBeenCalledWith(
        '/test/project',
        expect.arrayContaining([
          expect.objectContaining({ assetId: 'v1' }),
          expect.objectContaining({ assetId: 'a1' }),
        ]),
      );
      expect(mockBatchUpsertMediaAssets).toHaveBeenCalledWith(
        '/test/project',
        expect.arrayContaining([expect.objectContaining({ id: 'v1' }), expect.objectContaining({ id: 'a1' })]),
      );
    });
  });
});
