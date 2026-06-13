import { buildProxyPlan, type MediaAsset, type ProxySettings } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { generateProxy, getAppDataDir } from '../lib/tauri-bridge';

export interface ProxyGenerationOptions {
  force?: boolean;
}

export async function createProxyForAsset(asset: MediaAsset, settings?: ProxySettings, options: ProxyGenerationOptions = {}): Promise<MediaAsset> {
  const appDataDir = await getAppDataDir();
  const plan = buildProxyPlan(asset, appDataDir, settings, options);
  if (!plan) {
    throw new Error(zhCN.errors.proxyNotNeeded);
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
