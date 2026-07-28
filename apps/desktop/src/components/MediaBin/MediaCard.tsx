import {getMediaVersionLabel, isFrameRateMismatch, shouldGenerateProxy, formatTimeShort, type ClipContentAnalysis, type MediaAsset, type MediaFlag, type MediaLabelColor, type MediaMetadata} from '@open-factory/editor-core';
import type {VisualHighlightMarker} from '@open-factory/editor-core/visual-highlight-engine';
import {Link2, Plus, Star} from 'lucide-react';
import {useContext, useRef, useState} from 'react';
import {computeMediaPreviewDelay, isMediaPreviewable} from './media-hover-preview';
import {clsx} from 'clsx';
import {zhCN} from '../../i18n/strings';
import {useProxySettingsStore} from '../../store/proxySettingsStore';
import {MediaCardExtrasCtx, MediaGridNavCtx, SubclipCtx, MEDIA_CARD_DRAG_MIME} from './MediaCardTypes';
import type {MediaCardExtras, MediaGridNavCtxValue, SubclipContextValue} from './MediaCardTypes';
import {formatFrameRateLabel, formatMediaColorProfile, formatMediaResolution, formatDuration, focusMediaCardByKeyboard} from './MediaCardUtils';
import {MediaSceneTagList, ProxyStatus} from './MediaCardSubcomponents';
import {MediaCardContextMenu} from './MediaCardContextMenu';
import {MediaCardThumbnail} from './MediaCardThumbnail';
import {MediaCardSubclipList} from './MediaCardSubclipList';

// Re-export public API for backward compatibility
export {MediaCardExtrasCtx, MediaGridNavCtx, SubclipCtx, MEDIA_CARD_DRAG_MIME, SUBCLIP_DRAG_MIME} from './MediaCardTypes';
export type {MediaCardExtras, MediaGridNavCtxValue, SubclipContextValue} from './MediaCardTypes';
export {formatFrameRateLabel, formatMediaColorProfile, formatMediaFormat, formatMediaResolution} from './MediaCardUtils';
export {IconPreview} from './MediaCardSubcomponents';

// ---------------------------------------------------------------------------
// MediaCard
// ---------------------------------------------------------------------------

export function MediaCard({
  asset,
  metadata,
  contentAnalysis,
  projectFrameRate,
  onAdd,
  onAddVersion,
  onCompareVersions,
  onRelink,
  onGenerateProxy,
  onConvertToCfr,
  onSetLabel,
  onSetRating,
  onSetFlag,
  onBatchTranscode,
  onExportGif,
  onAnalyzeSpectrum,
  onShowInfo,
  onFindSources,
  selected,
  onToggleSelected,
  batchSelectionCount,
  onOpenBatchMetadata,
  onOpenBatchRename,
  mediaIndex,
  highlights,
}: {
  asset: MediaAsset;
  metadata?: MediaMetadata;
  contentAnalysis?: ClipContentAnalysis;
  projectFrameRate: number;
  onAdd(): void;
  onAddVersion(): void;
  onCompareVersions(): void;
  onRelink(): void;
  onGenerateProxy(): void;
  onConvertToCfr(): void;
  onSetLabel(labelColor?: MediaLabelColor): void;
  onSetRating(rating: number): void;
  onSetFlag(flag?: MediaFlag): void;
  onBatchTranscode(): void;
  onExportGif(): void;
  onAnalyzeSpectrum(): void;
  onShowInfo(): void;
  onFindSources(): void;
  selected: boolean;
  onToggleSelected(): void;
  batchSelectionCount: number;
  onOpenBatchMetadata(): void;
  onOpenBatchRename(): void;
  mediaIndex: number;
  highlights?: VisualHighlightMarker[];
}) {
  const proxySettings = useProxySettingsStore((state) => state.settings);
  const proxyStatus = asset.proxyStatus ?? (asset.type === 'video' ? 'none' : undefined);
  const canGenerateProxy =
    asset.type === 'video' && (shouldGenerateProxy(asset, proxySettings) || proxyStatus === 'error');
  const frameRateMismatch = asset.type === 'video' && isFrameRateMismatch(asset.frameRate, projectFrameRate);
  const canConvertFrameRate = asset.type === 'video' && (asset.variableFrameRate || frameRateMismatch);
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [hoverPreviewActive, setHoverPreviewActive] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const labelColor = metadata?.labelColor;
  const rating = metadata?.rating ?? 0;
  const flag = metadata?.flag;
  const mediaVersions = metadata?.versions ?? [];
  const versionCount = 1 + mediaVersions.length;
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-lg border bg-[var(--color-bg-elevated)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]',
        asset.missing ? 'border-rose-300' : 'border-line',
      )}
      data-testid={`media-card-${asset.id}`}
      data-media-card="true"
      data-media-index={mediaIndex}
      data-missing={asset.missing ? 'true' : 'false'}
      data-folder-id={asset.folderId ?? 'root'}
      data-label-color={labelColor ?? 'none'}
      data-rating={rating}
      data-flag={flag ?? 'none'}
      role="group"
      aria-label={`${asset.name} ${zhCN.mediaBin.assetType[asset.type]}`}
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(MEDIA_CARD_DRAG_MIME, asset.id);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          const nav = useContext(MediaGridNavCtx);
          if (nav) focusMediaCardByKeyboard(event, nav);
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          onAdd();
          return;
        }
        if (event.key === ' ' || event.code === 'Space') {
          event.preventDefault();
          if (isMediaPreviewable(asset.type) && !asset.missing) {
            setHoverPreviewActive(true);
            setTimeout(() => setHoverPreviewActive(false), 3000);
          } else {
            onShowInfo();
          }
          return;
        }
        if (event.key.toLowerCase() === 'g') {
          event.preventDefault();
          onSetFlag('green');
        }
        if (event.key.toLowerCase() === 'x') {
          event.preventDefault();
          onSetFlag('red');
        }
        if (event.key.toLowerCase() === 'u') {
          event.preventDefault();
          onSetFlag(undefined);
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        setLabelMenuOpen(true);
      }}
      onMouseEnter={() => {
        if (!isMediaPreviewable(asset.type)) return;
        const { schedule, cancel } = computeMediaPreviewDelay();
        cancel(hoverTimerRef.current);
        hoverTimerRef.current = schedule(() => setHoverPreviewActive(true));
      }}
      onMouseLeave={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = undefined;
        setHoverPreviewActive(false);
      }}
    >
      <MediaCardThumbnail
        asset={asset}
        labelColor={labelColor}
        versionCount={versionCount}
        flag={flag}
        hoverPreviewActive={hoverPreviewActive}
        frameRateMismatch={frameRateMismatch}
        highlights={highlights}
        selected={selected}
        onToggleSelected={onToggleSelected}
        setVersionsOpen={setVersionsOpen}
      />
      {labelMenuOpen ? (
        <MediaCardContextMenu
          asset={asset}
          labelColor={labelColor}
          flag={flag}
          batchSelectionCount={batchSelectionCount}
          versionCount={versionCount}
          actions={{
            onShowInfo,
            onAddVersion,
            onFindSources,
            onCompareVersions,
            onBatchTranscode,
            onExportGif,
            onAnalyzeSpectrum,
            onSetLabel,
            onSetRating,
            onSetFlag,
            onOpenBatchMetadata,
            onOpenBatchRename,
            onAdd,
            onRelink,
            onGenerateProxy,
            onConvertToCfr,
            onToggleSelected,
          }}
          setLabelMenuOpen={setLabelMenuOpen}
        />
      ) : null}
      <div className="p-2">
        <div className="truncate text-sm font-medium" title={asset.path} data-testid={`media-name-${asset.id}`}>
          {asset.name}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
          <span>{zhCN.mediaBin.assetType[asset.type]}</span>
          <span>
            {asset.type === 'audio' ? formatDuration(asset.duration) : `${asset.width || '-'}x${asset.height || '-'}`}
          </span>
        </div>
        <div
          className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]"
          data-testid={`media-color-profile-${asset.id}`}
        >
          {formatMediaColorProfile(asset)}
        </div>
        {contentAnalysis ? <MediaSceneTagList assetId={asset.id} analysis={contentAnalysis} /> : null}
        {asset.aiAnalysis?.tags && asset.aiAnalysis.tags.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1" data-testid={`ai-tags-${asset.id}`}>
            {asset.aiAnalysis.tags.slice(0, 5).map((tag, i) => (
              <span
                key={i}
                className="inline-block rounded-full bg-[var(--color-accent)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]"
              >
                {tag}
              </span>
            ))}
            {asset.aiAnalysis.scene ? (
              <span className="inline-block text-[10px] text-[var(--color-text-muted)]" title={asset.aiAnalysis.scene}>
                {asset.aiAnalysis.scene}
              </span>
            ) : null}
          </div>
        ) : null}
        {asset.type === 'video' ? (
          <ProxyStatus
            status={proxyStatus}
            error={asset.proxyError}
            canGenerate={canGenerateProxy}
            onGenerateProxy={onGenerateProxy}
            assetId={asset.id}
          />
        ) : null}
        {canConvertFrameRate ? (
          <button
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100"
            type="button"
            data-testid={`convert-cfr-${asset.id}`}
            onClick={onConvertToCfr}
          >
            {frameRateMismatch
              ? zhCN.mediaBin.convertFrameRateToProject(formatFrameRateLabel(projectFrameRate))
              : zhCN.mediaBin.convertToCfr}
          </button>
        ) : null}
        {asset.relativePath ? (
          <div className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]">{asset.relativePath}</div>
        ) : null}
        {versionsOpen && versionCount > 1 ? (
          <div
            className="mt-2 space-y-1 rounded-md border border-line bg-panel p-2 text-[11px]"
            data-testid={`media-version-list-${asset.id}`}
          >
            <div
              className="flex items-center justify-between gap-2 rounded bg-[var(--color-bg-elevated)] px-2 py-1"
              data-testid={`media-version-row-${asset.id}-${asset.id}`}
            >
              <span className="font-semibold text-[var(--color-text-secondary)]">{getMediaVersionLabel(0)}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--color-text-muted)]">{asset.name}</span>
              <span className="text-[var(--color-text-muted)]">{zhCN.mediaBin.versionOriginal}</span>
            </div>
            {mediaVersions.map((version, index) => (
              <div
                key={version.id}
                className="flex items-center justify-between gap-2 rounded bg-[var(--color-bg-elevated)] px-2 py-1"
                data-testid={`media-version-row-${asset.id}-${version.id}`}
              >
                <span className="font-semibold text-[var(--color-text-secondary)]">
                  {version.label || getMediaVersionLabel(index + 1)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[var(--color-text-muted)]" title={version.path}>
                  {version.name}
                </span>
                <span className="text-[var(--color-text-muted)]">{formatDuration(version.duration ?? 0)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center" data-testid={`media-rating-${asset.id}`} aria-label={zhCN.mediaBin.rating}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={clsx(
                  'rounded p-0.5',
                  value <= rating ? 'text-amber-400 hover:text-amber-500' : 'text-slate-300 hover:text-amber-300',
                )}
                title={zhCN.mediaBin.ratingValue(value)}
                aria-label={zhCN.mediaBin.ratingValue(value)}
                data-testid={`media-rating-star-${asset.id}-${value}`}
                data-rating-value={value}
                onClick={(event) => {
                  event.stopPropagation();
                  onSetRating(rating === value ? 0 : value);
                }}
              >
                <Star size={14} fill={value <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1" aria-label={zhCN.mediaBin.flag}>
            <button
              type="button"
              className={clsx(
                'rounded border px-1.5 py-0.5 text-[11px] font-semibold',
                flag === 'green'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-line text-[var(--color-text-muted)] hover:bg-panel',
              )}
              title={zhCN.mediaBin.flagGreenShortcut}
              data-testid={`media-flag-green-${asset.id}`}
              onClick={() => onSetFlag(flag === 'green' ? undefined : 'green')}
            >
              G
            </button>
            <button
              type="button"
              className={clsx(
                'rounded border px-1.5 py-0.5 text-[11px] font-semibold',
                flag === 'red'
                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                  : 'border-line text-[var(--color-text-muted)] hover:bg-panel',
              )}
              title={zhCN.mediaBin.flagRedShortcut}
              data-testid={`media-flag-red-${asset.id}`}
              onClick={() => onSetFlag(flag === 'red' ? undefined : 'red')}
            >
              X
            </button>
            {flag ? (
              <button
                type="button"
                className="rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)] hover:bg-panel"
                title={zhCN.mediaBin.flagClearShortcut}
                data-testid={`media-flag-clear-${asset.id}`}
                onClick={() => onSetFlag(undefined)}
              >
                U
              </button>
            ) : null}
          </div>
        </div>
        <button
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-sm font-medium hover:bg-[var(--color-bg-secondary)]"
          type="button"
          onClick={onAdd}
          data-testid={`add-to-timeline-${asset.id}`}
        >
          <Plus size={15} />
          {zhCN.mediaBin.addToTimeline}
        </button>
        {asset.missing ? (
          <button
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            type="button"
            onClick={onRelink}
            data-testid={`relink-media-${asset.id}`}
          >
            <Link2 size={15} />
            {zhCN.mediaBin.relink}
          </button>
        ) : null}
        <MediaCardSubclipList asset={asset} />
      </div>
    </div>
  );
}
