import { buildProxyPlan, type MediaAsset } from '@open-factory/editor-core';
import { generateProxy, getCacheDir } from '../lib/tauri-bridge';

export async function createProxyForAsset(asset: MediaAsset): Promise<MediaAsset> {
  const cacheDir = await getCacheDir();
  const plan = buildProxyPlan(asset, cacheDir);
  if (!plan) {
    throw new Error('This media does not need a proxy file.');
  }
  const result = await generateProxy(plan);
  return {
    ...asset,
    proxyPath: result.proxyPath,
    proxyStatus: 'ready',
    proxyError: undefined
  };
}

export function getPreviewMediaPath(asset: MediaAsset): string {
  return asset.proxyStatus === 'ready' && asset.proxyPath ? asset.proxyPath : asset.path;
}

export function getAudioPreviewMediaPath(asset: MediaAsset): string {
  return asset.path;
}
