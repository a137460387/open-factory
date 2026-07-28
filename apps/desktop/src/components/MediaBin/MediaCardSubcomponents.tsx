import type {ClipContentAnalysis, MediaAsset} from '@open-factory/editor-core';
import {mapScoreToGrade} from '@open-factory/editor-core';
import {AlertCircle, BadgeCheck, FileAudio2, FileImage, FileVideo2, Flag, Gauge, Heart, Loader2} from 'lucide-react';
import {useContext} from 'react';
import {clsx} from 'clsx';
import {zhCN} from '../../i18n/strings';
import {MediaCardExtrasCtx} from './MediaCardTypes';

// ---------------------------------------------------------------------------
// MediaSceneTagList
// ---------------------------------------------------------------------------

export function MediaSceneTagList({ assetId, analysis }: { assetId: string; analysis: ClipContentAnalysis }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1" data-testid={`media-scene-tags-${assetId}`}>
      {analysis.sceneTypes.slice(0, 3).map((sceneType) => (
        <span
          key={sceneType}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
          data-testid={`media-scene-tag-${sceneType}-${assetId}`}
        >
          {zhCN.contentAnalysis.sceneTypeLabels[sceneType]}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProxyStatus
// ---------------------------------------------------------------------------

export function ProxyStatus({
  status,
  error,
  canGenerate,
  onGenerateProxy,
  assetId,
}: {
  status: MediaAsset['proxyStatus'];
  error?: string;
  canGenerate: boolean;
  onGenerateProxy(): void;
  assetId: string;
}) {
  const icon =
    status === 'ready' ? (
      <BadgeCheck size={13} />
    ) : status === 'pending' ? (
      <Loader2 className="animate-spin" size={13} />
    ) : status === 'error' ? (
      <AlertCircle size={13} />
    ) : (
      <Gauge size={13} />
    );
  const label =
    status === 'ready'
      ? zhCN.mediaBin.proxyStatus.ready
      : status === 'pending'
        ? zhCN.mediaBin.proxyStatus.pending
        : status === 'error'
          ? zhCN.mediaBin.proxyStatus.error
          : canGenerate
            ? zhCN.mediaBin.proxyStatus.recommended
            : zhCN.mediaBin.proxyStatus.notNeeded;
  const tone =
    status === 'ready'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'pending'
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : status === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-line bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]';
  return (
    <div className="mt-2 space-y-1">
      <div
        className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
        title={error}
        data-testid={`proxy-status-${assetId}`}
        data-proxy-status={status ?? 'none'}
      >
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {canGenerate || status === 'pending' || status === 'ready' ? (
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs font-medium hover:bg-panel disabled:opacity-50"
          onClick={onGenerateProxy}
          disabled={!canGenerate || status === 'pending'}
          data-testid={`generate-proxy-${assetId}`}
        >
          <Gauge size={14} />
          {zhCN.mediaBin.generateProxy}
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// IconPreview
// ---------------------------------------------------------------------------

export function IconPreview({ type }: { type: MediaAsset['type'] }) {
  const Icon = type === 'video' ? FileVideo2 : type === 'audio' ? FileAudio2 : FileImage;
  return (
    <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
      <Icon size={36} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThumbnailOverlayBadges
// ---------------------------------------------------------------------------

export function ThumbnailOverlayBadges({
  asset,
  labelColor,
  versionCount,
  flag,
  hoverPreviewActive,
  frameRateMismatch,
  highlights,
  onToggleSelected,
  selected,
  setVersionsOpen,
}: {
  asset: MediaAsset;
  labelColor: string | undefined;
  versionCount: number;
  flag: string | undefined;
  hoverPreviewActive: boolean;
  frameRateMismatch: boolean;
  highlights: import('@open-factory/editor-core/visual-highlight-engine').VisualHighlightMarker[] | undefined;
  onToggleSelected(): void;
  selected: boolean;
  setVersionsOpen: (fn: (open: boolean) => boolean) => void;
}) {
  const extras = useContext(MediaCardExtrasCtx);

  return (
    <div className="checkerboard relative aspect-video">
      <label
        className="absolute left-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded border border-white/80 bg-white/90 shadow"
        title={zhCN.mediaBin.selectForThumbnail}
        aria-label={zhCN.mediaBin.selectForThumbnail}
        data-testid={`media-select-${asset.id}`}
        onClick={(event) => event.stopPropagation()}
      >
        <input className="h-4 w-4 accent-brand" type="checkbox" checked={selected} onChange={onToggleSelected} />
      </label>
      {asset.thumbnail ? (
        <img className="h-full w-full object-cover" src={asset.thumbnail} alt="" loading="lazy" />
      ) : (
        <IconPreview type={asset.type} />
      )}
      {hoverPreviewActive && isMediaPreviewable(asset.type) && !asset.missing ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={convertLocalFileSrc(asset.path)}
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          data-testid={`media-hover-preview-${asset.id}`}
        />
      ) : null}
      {asset.missing ? (
        <span
          className="absolute left-2 top-10 rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white"
          data-testid={`missing-media-badge-${asset.id}`}
        >
          {zhCN.common.missing}
        </span>
      ) : null}
      {asset.variableFrameRate ? (
        <span
          className="absolute left-2 top-10 rounded bg-sky-700 px-2 py-1 text-xs font-semibold text-white shadow"
          title={zhCN.mediaBin.vfrTooltip}
          data-testid={`vfr-badge-${asset.id}`}
        >
          {zhCN.mediaBin.vfrBadge}
        </span>
      ) : null}
      {asset.type === 'video' && asset.frameRate ? (
        <span
          className={clsx(
            'absolute bottom-2 right-2 rounded px-2 py-0.5 text-[11px] font-semibold shadow',
            frameRateMismatch ? 'bg-orange-500 text-white' : 'bg-black/70 text-white',
          )}
          title={zhCN.mediaBin.frameRateTooltip(formatPreciseFrameRate(asset.frameRate))}
          data-testid={`media-frame-rate-${asset.id}`}
          data-frame-rate={asset.frameRate}
          data-frame-rate-mismatch={frameRateMismatch ? 'true' : 'false'}
        >
          {formatFrameRateLabel(asset.frameRate)}
        </span>
      ) : null}
      {versionCount > 1 ? (
        <button
          className="absolute right-2 top-2 rounded bg-brand px-2 py-0.5 text-[11px] font-semibold text-white shadow"
          type="button"
          title={zhCN.mediaBin.versionBadgeTitle(versionCount)}
          data-testid={`media-version-badge-${asset.id}`}
          onClick={(event) => {
            event.stopPropagation();
            setVersionsOpen((open) => !open);
          }}
        >
          {zhCN.mediaBin.versionBadge(versionCount)}
        </button>
      ) : null}
      {labelColor ? (
        <span
          className={clsx(
            'absolute right-2 h-4 w-4 rounded-full border border-white shadow',
            versionCount > 1 ? 'top-8' : 'top-2',
          )}
          style={{ backgroundColor: labelColor }}
          data-testid={`media-label-${asset.id}`}
        />
      ) : null}
      {extras?.favoriteIds.has(asset.id) ? (
        <span
          className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 shadow"
          data-testid={`media-favorite-badge-${asset.id}`}
        >
          <Heart size={12} className="text-rose-500" fill="currentColor" />
        </span>
      ) : null}
      {extras?.qualityLoading.has(asset.id) ? (
        <span
          className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 shadow"
          data-testid={`quality-badge-loading-${asset.id}`}
        >
          <Loader2 size={12} className="animate-spin text-[var(--color-text-muted)]" />
        </span>
      ) : null}
      {extras?.qualityResults.has(asset.id)
        ? (() => {
            const g = mapScoreToGrade(extras.qualityResults.get(asset.id)!.overallScore);
            return (
              <span
                className={clsx(
                  'absolute left-2 top-2 z-10 flex items-center justify-center rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold shadow',
                  g === 'green' ? 'text-emerald-600' : g === 'yellow' ? 'text-amber-500' : 'text-rose-600',
                )}
                title={
                  zhCN.mediaBin.aiQualityAssessment.scoreBadge +
                  ': ' +
                  extras.qualityResults.get(asset.id)!.overallScore
                }
                data-testid={`quality-badge-${asset.id}`}
              >
                {extras.qualityResults.get(asset.id)!.overallScore}
              </span>
            );
          })()
        : null}
      {flag ? (
        <span
          className={clsx(
            'absolute left-2 bottom-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-white shadow',
            flag === 'green' ? 'bg-emerald-600' : 'bg-rose-600',
          )}
          data-testid={`media-flag-badge-${asset.id}`}
        >
          <Flag size={11} fill="currentColor" />
          {flag === 'green' ? zhCN.mediaBin.flagGreen : zhCN.mediaBin.flagRed}
        </span>
      ) : null}
      {highlights && highlights.length > 0 ? (
        <HighlightBadge count={highlights.length} className="absolute left-2 bottom-8 z-10" />
      ) : null}
    </div>
  );
}

function isMediaPreviewable(type: MediaAsset['type']): boolean {
  return type === 'video' || type === 'audio';
}

function formatPreciseFrameRate(frameRate: number): string {
  return `${(Math.round(frameRate * 1000) / 1000).toFixed(3)} fps`;
}

function formatFrameRateLabel(frameRate: number): string {
  const rounded = Math.round(frameRate * 100) / 100;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}fps`;
}
