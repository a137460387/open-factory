import type {MediaAsset, MediaLabelColor} from '@open-factory/editor-core';
import {formatTimeShort} from '@open-factory/editor-core';
import type {KeyboardEvent as ReactKeyboardEvent} from 'react';
import {zhCN} from '../../i18n/strings';
import {getMediaKeyboardNavigationIndex} from './media-keyboard';
import {MEDIA_LABEL_COLORS, type MediaGridNavCtxValue} from './MediaCardTypes';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function labelColorToHex(color: MediaLabelColor): string {
  return MEDIA_LABEL_COLORS.find((item) => item.key === color)?.value ?? '#64748b';
}

export function formatFrameRateLabel(frameRate: number): string {
  const rounded = Math.round(frameRate * 100) / 100;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}fps`;
}

export function formatMediaColorProfile(asset: MediaAsset): string {
  return asset.colorProfile?.label ?? zhCN.common.unavailable;
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

export function formatPreciseFrameRate(frameRate: number): string {
  return `${(Math.round(frameRate * 1000) / 1000).toFixed(3)} fps`;
}

export const formatDuration = formatTimeShort;

// ---------------------------------------------------------------------------
// Keyboard navigation helper
// ---------------------------------------------------------------------------

export function focusMediaCardByKeyboard(event: ReactKeyboardEvent<HTMLElement>, nav: MediaGridNavCtxValue): void {
  const ref = nav.pendingFocusRef;
  const domIndex = Number(event.currentTarget.getAttribute('data-media-index'));
  const currentIndex = ref.current ?? domIndex;
  if (!Number.isFinite(currentIndex)) return;
  const nextIndex = getMediaKeyboardNavigationIndex({
    currentIndex,
    itemCount: nav.mediaCount,
    columnCount: nav.columnCount,
    key: event.key,
  });
  if (nextIndex === undefined) return;
  ref.current = nextIndex;
  nav.scrollToMediaIndex(nextIndex);
  const grid = event.currentTarget.closest('[data-media-card-grid="true"]');
  function focusWhenReady(attempts: number): void {
    if (ref.current !== nextIndex) return;
    const target = grid?.querySelector<HTMLElement>(`[data-media-index="${nextIndex}"]`);
    if (target) {
      target.focus();
      if (ref.current === nextIndex) ref.current = null;
    } else if (attempts < 10) {
      requestAnimationFrame(() => focusWhenReady(attempts + 1));
    } else {
      ref.current = null;
    }
  }
  focusWhenReady(0);
}
