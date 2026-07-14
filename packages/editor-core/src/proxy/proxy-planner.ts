import { buildCachePaths, getMediaCacheKey } from '../cache/cache-key';
import type { MediaAsset } from '../model';
import { getCfrTargetFrameRate } from '../vfr';
import type { ProxyPlan, ProxySettings } from './proxy-types';

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  maxWidth: 1280,
  maxHeight: 720,
  videoBitrate: '2500k',
  triggerShortEdge: 1080,
};

export function shouldGenerateProxy(asset: MediaAsset, settings: ProxySettings = DEFAULT_PROXY_SETTINGS): boolean {
  if (asset.type !== 'video') {
    return false;
  }
  if (asset.proxyPath && asset.proxyStatus === 'ready') {
    return false;
  }
  return getProxyTriggerReason(asset, settings) !== null;
}

export function buildProxyPlan(
  asset: MediaAsset,
  appDataDir: string,
  settings: ProxySettings = DEFAULT_PROXY_SETTINGS,
  options: { force?: boolean; cfrFrameRate?: number; sourceStart?: number; sourceDuration?: number } = {},
): ProxyPlan | null {
  const force = options.force === true;
  const cfrFrameRate =
    options.cfrFrameRate ??
    (force && asset.variableFrameRate
      ? getCfrTargetFrameRate(
          { avgFrameRate: asset.avgFrameRate, realFrameRate: asset.realFrameRate },
          asset.frameRate ?? 30,
        )
      : undefined);
  const sourceStart = normalizeProxySegmentValue(options.sourceStart);
  const sourceDuration = normalizeProxySegmentValue(options.sourceDuration);
  if (asset.type !== 'video' || (!cfrFrameRate && asset.proxyPath && asset.proxyStatus === 'ready')) {
    return null;
  }
  if ((!force && !cfrFrameRate && !shouldGenerateProxy(asset, settings)) || !asset.size || !asset.mtimeMs) {
    return null;
  }
  const key = getMediaCacheKey({
    path: asset.path,
    size: asset.size,
    mtimeMs: asset.mtimeMs,
    formatVersion: `proxy-${settings.maxWidth}x${settings.maxHeight}-${settings.videoBitrate}${cfrFrameRate ? `-cfr-${cfrFrameRate}` : ''}${sourceStart !== undefined || sourceDuration !== undefined ? `-seg-${sourceStart ?? 0}-${sourceDuration ?? 0}` : ''}`,
  });
  const paths = buildCachePaths('proxy', key);
  const dimensions = fitWithin(asset.width, asset.height, settings.maxWidth, settings.maxHeight);
  const reason = cfrFrameRate ? 'vfr-cfr' : (getProxyTriggerReason(asset, settings) ?? 'manual');
  return {
    assetId: asset.id,
    inputPath: asset.path,
    outputPath: `${appDataDir.replace(/\\/g, '/').replace(/\/+$/g, '')}/${paths.dataPath}`,
    width: dimensions.width,
    height: dimensions.height,
    videoBitrate: settings.videoBitrate,
    reason,
    cfrFrameRate,
    sourceStart,
    sourceDuration,
  };
}

export function getProxyTriggerReason(
  asset: MediaAsset,
  settings: ProxySettings = DEFAULT_PROXY_SETTINGS,
): ProxyPlan['reason'] | null {
  if (asset.type !== 'video') {
    return null;
  }
  if (isEditingCodec(asset.videoCodec)) {
    return 'editing-codec';
  }
  const safeThreshold = Math.max(1, Math.round(settings.triggerShortEdge));
  const shortEdge = Math.min(Math.max(0, asset.width), Math.max(0, asset.height));
  return shortEdge > safeThreshold ? 'large-resolution' : null;
}

export function isEditingCodec(codec: unknown): boolean {
  if (typeof codec !== 'string') {
    return false;
  }
  const normalized = codec
    .trim()
    .toLowerCase()
    .replace(/[\s.-]+/g, '_');
  return normalized === 'hevc' || normalized === 'h265' || normalized === 'h_265' || normalized.startsWith('prores');
}

export function fitWithin(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: maxWidth, height: maxHeight };
  }
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const fittedWidth = Math.max(2, Math.round((width * scale) / 2) * 2);
  const fittedHeight = Math.max(2, Math.round((height * scale) / 2) * 2);
  return { width: fittedWidth, height: fittedHeight };
}

function normalizeProxySegmentValue(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.round(value * 1000) / 1000);
}
