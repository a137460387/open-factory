/**
 * 媒体索引集成模块
 * 在媒体导入后自动写入 SQLite 索引并生成 AI 标签
 */
import type { MediaAsset } from '@open-factory/editor-core';
import type { MediaIndexAsset, AutoTagRequest } from '../lib/tauri-bridge';
import {
  initMediaIndexDb,
  batchUpsertMediaAssets,
  batchAutoTagAssets,
} from '../lib/tauri-bridge';

/**
 * 将 MediaAsset 转换为 MediaIndexAsset
 */
export function mediaAssetToIndexAsset(asset: MediaAsset): MediaIndexAsset {
  return {
    id: asset.id,
    path: asset.path,
    name: asset.name,
    assetType: asset.type,
    fileSize: asset.size,
    durationMs: asset.duration ? Math.round(asset.duration * 1000) : undefined,
    width: asset.width,
    height: asset.height,
    frameRate: asset.frameRate,
    videoCodec: asset.videoCodec,
    audioCodec: asset.audioCodec,
    colorSpace: asset.colorProfile?.colorSpace,
    labelColor: undefined,
    rating: undefined,
    flag: undefined,
    importedAt: asset.importedAt || new Date().toISOString(),
    thumbnailPath: asset.thumbnailCachePath,
    proxyPath: asset.proxyPath,
  };
}

/**
 * 将 MediaAsset 转换为 AutoTagRequest
 */
export function mediaAssetToAutoTagRequest(asset: MediaAsset, projectPath: string): AutoTagRequest {
  return {
    projectPath,
    assetId: asset.id,
    name: asset.name,
    assetType: asset.type,
    durationMs: asset.duration ? Math.round(asset.duration * 1000) : undefined,
    width: asset.width,
    height: asset.height,
    frameRate: asset.frameRate,
    videoCodec: asset.videoCodec,
    audioCodec: asset.audioCodec,
    colorSpace: asset.colorProfile?.colorSpace,
    fileSize: asset.size,
  };
}

/**
 * 索引导入的媒体资产并生成 AI 标签
 *
 * 导入管道集成点：
 * 1. 初始化项目数据库（如果不存在）
 * 2. 调用自动打标引擎生成标签并写入 asset_tags 表
 * 3. 批量写入资产索引到 media_assets 表
 *
 * 该函数是 fire-and-forget 模式，不会阻塞导入流程
 */
export async function indexAndTagImportedMedia(
  importedMedia: MediaAsset[],
  projectPath: string,
): Promise<void> {
  if (importedMedia.length === 0 || !projectPath) return;

  try {
    // 1. 确保数据库已初始化
    await initMediaIndexDb(projectPath);

    // 2. 调用自动打标（Rust 端会同时写入 tags 和 asset_tags 表）
    const tagRequests = importedMedia.map((asset) =>
      mediaAssetToAutoTagRequest(asset, projectPath),
    );
    await batchAutoTagAssets(projectPath, tagRequests);

    // 3. 批量写入资产索引（media_assets 表）
    const indexAssets = importedMedia.map((asset) => mediaAssetToIndexAsset(asset));
    await batchUpsertMediaAssets(projectPath, indexAssets);
  } catch (error) {
    // 索引失败不应阻断导入流程
    console.warn('媒体索引写入失败（不影响导入）:', error);
  }
}
