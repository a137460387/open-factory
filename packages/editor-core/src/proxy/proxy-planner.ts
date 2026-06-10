import { buildCachePaths, getMediaCacheKey } from '../cache/cache-key';
import type { MediaAsset } from '../model';
import type { ProxyPlan, ProxySettings } from './proxy-types';

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  maxWidth: 960,
  maxHeight: 540,
  videoBitrate: '1600k',
  minSourceBytes: 200 * 1024 * 1024
};

export function shouldGenerateProxy(asset: MediaAsset, settings: ProxySettings = DEFAULT_PROXY_SETTINGS): boolean {
  if (asset.type !== 'video') {
    return false;
  }
  if (asset.proxyPath && asset.proxyStatus === 'ready') {
    return false;
  }
  const largeBytes = typeof asset.size === 'number' && asset.size >= settings.minSourceBytes;
  const largeDimensions = asset.width > settings.maxWidth || asset.height > settings.maxHeight;
  return largeBytes || largeDimensions;
}

export function buildProxyPlan(asset: MediaAsset, cacheDir: string, settings: ProxySettings = DEFAULT_PROXY_SETTINGS): ProxyPlan | null {
  if (!shouldGenerateProxy(asset, settings) || !asset.size || !asset.mtimeMs) {
    return null;
  }
  const key = getMediaCacheKey({ path: asset.path, size: asset.size, mtimeMs: asset.mtimeMs, formatVersion: `proxy-${settings.maxWidth}x${settings.maxHeight}-${settings.videoBitrate}` });
  const paths = buildCachePaths('proxy', key);
  const dimensions = fitWithin(asset.width, asset.height, settings.maxWidth, settings.maxHeight);
  return {
    assetId: asset.id,
    inputPath: asset.path,
    outputPath: `${cacheDir.replace(/\\/g, '/').replace(/\/+$/g, '')}/${paths.dataPath}`,
    width: dimensions.width,
    height: dimensions.height,
    videoBitrate: settings.videoBitrate,
    reason: asset.size >= settings.minSourceBytes ? 'large-file' : 'large-resolution'
  };
}

export function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: maxWidth, height: maxHeight };
  }
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const fittedWidth = Math.max(2, Math.round((width * scale) / 2) * 2);
  const fittedHeight = Math.max(2, Math.round((height * scale) / 2) * 2);
  return { width: fittedWidth, height: fittedHeight };
}
