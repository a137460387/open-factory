import type { MediaVersionCompareRequest, MediaAsset } from '@open-factory/editor-core';
import { convertLocalFileSrc } from '../lib/tauri-bridge';
import { zhCN } from '../i18n/strings';

export function MediaVersionComparePanel({
  request,
  media,
  onClose,
}: {
  request: MediaVersionCompareRequest;
  media: MediaAsset[];
  onClose(): void;
}) {
  const leftAsset = media.find((asset) => asset.id === request.left.assetId);
  const rightAsset = media.find((asset) => asset.id === request.right.assetId);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      data-testid="media-version-compare-panel"
    >
      <section className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{zhCN.mediaBin.versionCompareTitle}</h2>
            <div className="truncate text-xs text-slate-500">
              {zhCN.mediaBin.versionCompareTime(request.time.toFixed(2))}
            </div>
          </div>
          <button
            className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-panel"
            type="button"
            data-testid="media-version-compare-close"
            onClick={onClose}
          >
            {zhCN.common.close}
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
          <MediaVersionPreviewCard
            entry={request.left}
            asset={leftAsset}
            time={request.time}
            testId="media-version-compare-left"
          />
          <MediaVersionPreviewCard
            entry={request.right}
            asset={rightAsset}
            time={request.time}
            testId="media-version-compare-right"
          />
        </div>
      </section>
    </div>
  );
}

function MediaVersionPreviewCard({
  entry,
  asset,
  time,
  testId,
}: {
  entry: MediaVersionCompareRequest['left'];
  asset?: MediaAsset;
  time: number;
  testId: string;
}) {
  const src = asset ? `${convertLocalFileSrc(asset.path)}#t=${Math.max(0, time).toFixed(3)}` : undefined;
  return (
    <div
      className="min-w-0 rounded-md border border-line bg-panel p-3"
      data-testid={testId}
      data-media-id={entry.assetId}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{entry.label}</div>
          <div className="truncate text-xs text-slate-500" title={entry.path}>
            {entry.name}
          </div>
        </div>
        <span className="rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {entry.isOriginal ? zhCN.mediaBin.versionOriginal : zhCN.mediaBin.versionVariant}
        </span>
      </div>
      <div className="checkerboard grid aspect-video place-items-center overflow-hidden rounded-md border border-line bg-white">
        {asset?.type === 'image' && src ? <img className="h-full w-full object-contain" src={src} alt="" /> : null}
        {asset?.type === 'video' && src ? (
          <video className="h-full w-full bg-black object-contain" src={src} controls muted preload="metadata" />
        ) : null}
        {asset?.type === 'audio' && src ? (
          <audio className="w-full px-3" src={src} controls preload="metadata" />
        ) : null}
        {!asset ? (
          <div className="px-3 text-center text-xs text-slate-500">{zhCN.mediaBin.versionMediaMissing}</div>
        ) : null}
      </div>
    </div>
  );
}
