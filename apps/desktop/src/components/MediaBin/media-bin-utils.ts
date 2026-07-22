import type { CSSProperties } from 'react';
import type { MediaAsset, MediaLabelColor } from '@open-factory/editor-core';
import type { TimelineLabelColor } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export const MEDIA_CARD_DRAG_MIME = 'application/x-open-factory-media-id';
export const SUBCLIP_DRAG_MIME = 'application/x-open-factory-subclip';

export const MEDIA_LABEL_COLORS: Array<{ key: MediaLabelColor; value: string }> = [
  { key: 'red', value: '#ef4444' },
  { key: 'orange', value: '#f97316' },
  { key: 'yellow', value: '#eab308' },
  { key: 'green', value: '#22c55e' },
  { key: 'blue', value: '#3b82f6' },
  { key: 'purple', value: '#a855f7' },
];
export const MEDIA_LABEL_COLOR_STYLES: Record<string, CSSProperties> = Object.fromEntries(
  MEDIA_LABEL_COLORS.map((c) => [c.key, { backgroundColor: c.value }]),
);

export const TIMELINE_COLORS: Array<{ key: TimelineLabelColor; value: string }> = [
  { key: 'red', value: '#ef4444' },
  { key: 'orange', value: '#f97316' },
  { key: 'amber', value: '#f59e0b' },
  { key: 'yellow', value: '#eab308' },
  { key: 'lime', value: '#84cc16' },
  { key: 'green', value: '#22c55e' },
  { key: 'teal', value: '#14b8a6' },
  { key: 'cyan', value: '#06b6d4' },
  { key: 'blue', value: '#3b82f6' },
  { key: 'indigo', value: '#6366f1' },
  { key: 'purple', value: '#a855f7' },
  { key: 'pink', value: '#ec4899' },
];
export const TIMELINE_COLOR_STYLES: Record<string, CSSProperties> = Object.fromEntries(
  TIMELINE_COLORS.map((c) => [c.key, { backgroundColor: c.value }]),
);

export function labelColorToHex(color: MediaLabelColor): string {
  return MEDIA_LABEL_COLORS.find((item) => item.key === color)?.value ?? '#64748b';
}

export function formatFrameRateLabel(frameRate: number): string {
  const rounded = Math.round(frameRate * 100) / 100;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}fps`;
}

export function formatMediaFormat(asset: MediaAsset): string {
  const extension = asset.name.includes('.') ? asset.name.split('.').pop()?.toUpperCase() : undefined;
  return extension ? `${zhCN.mediaBin.assetType[asset.type]} / ${extension}` : zhCN.mediaBin.assetType[asset.type];
}

export function formatMediaResolution(asset: MediaAsset): string {
  if (asset.type === 'audio') {
    return zhCN.common.unavailable;
  }
  return asset.width && asset.height ? `${asset.width} x ${asset.height}` : zhCN.common.unavailable;
}

export function formatMediaColorProfile(asset: MediaAsset): string {
  return asset.colorProfile?.label ?? zhCN.common.unavailable;
}

export function formatPreciseFrameRate(frameRate: number): string {
  return `${(Math.round(frameRate * 1000) / 1000).toFixed(3)} fps`;
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes)) {
    return zhCN.common.unavailable;
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Math.max(0, bytes);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatBitRate(bitRate?: number): string {
  if (bitRate === undefined || !Number.isFinite(bitRate)) {
    return zhCN.common.unavailable;
  }
  if (bitRate >= 1_000_000) {
    return `${(bitRate / 1_000_000).toFixed(2)} Mbps`;
  }
  if (bitRate >= 1_000) {
    return `${(bitRate / 1_000).toFixed(1)} kbps`;
  }
  return `${Math.round(bitRate)} bps`;
}

export function formatDateTime(timestamp?: number): string {
  if (timestamp === undefined || !Number.isFinite(timestamp)) {
    return zhCN.common.unavailable;
  }
  return new Date(timestamp).toLocaleString();
}

export function formatImportedAt(importedAt?: string): string {
  if (!importedAt) {
    return zhCN.common.unavailable;
  }
  const timestamp = Date.parse(importedAt);
  if (!Number.isFinite(timestamp)) {
    return zhCN.common.unavailable;
  }
  return new Date(timestamp).toLocaleDateString();
}
