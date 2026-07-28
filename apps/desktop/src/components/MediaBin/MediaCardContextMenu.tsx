import type {MediaAsset, MediaFlag, MediaLabelColor} from '@open-factory/editor-core';
import {GalleryHorizontal, FileVideo2, Gauge, Heart, ImageDown, Info, List, Plus, Scissors, Search, Sparkles, Star, Tag} from 'lucide-react';
import {useContext} from 'react';
import {zhCN} from '../../i18n/strings';
import {MEDIA_LABEL_COLORS, MEDIA_LABEL_COLOR_STYLES, MediaCardExtrasCtx, SubclipCtx, type MediaCardMenuActions} from './MediaCardTypes';
import {formatDuration} from './MediaCardUtils';

// ---------------------------------------------------------------------------
// MediaCardContextMenu
// ---------------------------------------------------------------------------

export function MediaCardContextMenu({
  asset,
  labelColor,
  flag,
  batchSelectionCount,
  versionCount,
  actions,
  setLabelMenuOpen,
}: {
  asset: MediaAsset;
  labelColor: string | undefined;
  flag: MediaFlag | undefined;
  batchSelectionCount: number;
  versionCount: number;
  actions: MediaCardMenuActions;
  setLabelMenuOpen: (open: boolean) => void;
}) {
  const extras = useContext(MediaCardExtrasCtx);
  const sc = useContext(SubclipCtx);

  return (
    <div
      className="absolute right-2 top-2 z-10 w-48 rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 text-xs shadow-soft"
      data-testid={`media-label-menu-${asset.id}`}
    >
      {batchSelectionCount > 1 ? (
        <>
          <button
            className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            data-testid="batch-edit-metadata-menu-item"
            onClick={() => {
              actions.onOpenBatchMetadata();
              setLabelMenuOpen(false);
            }}
          >
            <Tag size={13} />
            {zhCN.mediaBin.batchEditMetadata}
          </button>
          <button
            className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            data-testid="batch-rename-media-menu-item"
            onClick={() => {
              actions.onOpenBatchRename();
              setLabelMenuOpen(false);
            }}
          >
            <List size={13} />
            {zhCN.mediaBin.batchRename}
          </button>
        </>
      ) : null}
      {extras ? (
        <button
          className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
          type="button"
          data-testid="batch-quality-scan"
          onClick={() => {
            extras.onBatchQualityScan();
            setLabelMenuOpen(false);
          }}
        >
          <Gauge size={13} />
          {zhCN.mediaBin.aiQualityAssessment.batchScan}
        </button>
      ) : null}
      <button
        className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
        type="button"
        data-testid={`media-info-${asset.id}`}
        onClick={() => {
          actions.onShowInfo();
          setLabelMenuOpen(false);
        }}
      >
        <Info size={13} />
        {zhCN.mediaBin.mediaInfo.menuItem}
      </button>
      {sc && (asset.type === 'video' || asset.type === 'audio') ? (
        <button
          className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
          type="button"
          data-testid={`media-new-subclip-${asset.id}`}
          onClick={() => {
            sc.onOpenSubclipDialog(asset.id);
            setLabelMenuOpen(false);
          }}
        >
          <Scissors size={13} />
          {zhCN.subclip.newSubclip}
        </button>
      ) : null}
      <button
        className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
        type="button"
        data-testid={`media-add-version-${asset.id}`}
        onClick={() => {
          actions.onAddVersion();
          setLabelMenuOpen(false);
        }}
      >
        <Plus size={13} />
        {zhCN.mediaBin.addVersion}
      </button>
      <button
        className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
        type="button"
        data-testid={`media-find-source-${asset.id}`}
        onClick={() => {
          actions.onFindSources();
          setLabelMenuOpen(false);
        }}
      >
        <Search size={13} />
        {zhCN.mediaBin.findSourceFiles}
      </button>
      <button
        className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={versionCount < 2}
        data-testid={`media-compare-versions-${asset.id}`}
        onClick={() => {
          actions.onCompareVersions();
          setLabelMenuOpen(false);
        }}
      >
        <GalleryHorizontal size={13} />
        {zhCN.mediaBin.compareVersions}
      </button>
      {asset.type === 'video' ? (
        <>
          <button
            className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            data-testid={`media-batch-transcode-${asset.id}`}
            onClick={() => {
              actions.onBatchTranscode();
              setLabelMenuOpen(false);
            }}
          >
            <FileVideo2 size={13} />
            {zhCN.mediaBin.batchTranscode}
          </button>
          <button
            className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            data-testid={`media-export-gif-${asset.id}`}
            onClick={() => {
              actions.onExportGif();
              setLabelMenuOpen(false);
            }}
          >
            <ImageDown size={13} />
            {zhCN.mediaBin.exportGif}
          </button>
        </>
      ) : null}
      {asset.type === 'video' || asset.type === 'audio' ? (
        <button
          className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
          type="button"
          data-testid={`media-spectrum-analysis-${asset.id}`}
          onClick={() => {
            actions.onAnalyzeSpectrum();
            setLabelMenuOpen(false);
          }}
        >
          <Gauge size={13} />
          {zhCN.mediaBin.spectrumAnalysis}
        </button>
      ) : null}
      {extras ? (
        <button
          className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
          type="button"
          data-testid={`media-reveal-in-timeline-${asset.id}`}
          onClick={() => {
            extras.onRevealInTimeline(asset.id);
            setLabelMenuOpen(false);
          }}
        >
          <Search size={13} />
          {zhCN.matchFrame.revealInTimeline}
        </button>
      ) : null}
      {extras ? (
        <button
          className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
          type="button"
          data-testid={`media-toggle-favorite-${asset.id}`}
          onClick={() => {
            extras.onToggleFavorite(asset.id);
            setLabelMenuOpen(false);
          }}
        >
          <Heart
            size={13}
            className={extras.favoriteIds.has(asset.id) ? 'text-rose-500' : ''}
            fill={extras.favoriteIds.has(asset.id) ? 'currentColor' : 'none'}
          />
          {extras.favoriteIds.has(asset.id)
            ? zhCN.mediaFavorites.removeFromFavorites
            : zhCN.mediaFavorites.addToFavorites}
        </button>
      ) : null}
      {extras ? (
        <button
          className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
          type="button"
          data-testid={`media-pin-to-session-${asset.id}`}
          onClick={() => {
            extras.onPinToSession(asset.id);
            setLabelMenuOpen(false);
          }}
        >
          <Star
            size={13}
            className={extras.pinnedIds.has(asset.id) ? 'text-amber-500' : ''}
            fill={extras.pinnedIds.has(asset.id) ? 'currentColor' : 'none'}
          />
          {zhCN.mediaFavorites.pinToSession}
        </button>
      ) : null}
      {(asset.type === 'video' || asset.type === 'image') && extras ? (
        <button
          className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
          type="button"
          data-testid={`media-ai-analyze-${asset.id}`}
          onClick={() => {
            extras.onAnalyzeAI(asset.id);
            setLabelMenuOpen(false);
          }}
        >
          <Sparkles size={13} />
          {zhCN.inspector.aiContentAnalysis.title}
        </button>
      ) : null}
      {extras ? (
        <button
          className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
          type="button"
          disabled={extras.qualityLoading.has(asset.id)}
          data-testid={`media-quality-assess-${asset.id}`}
          onClick={() => {
            extras.onQualityAssess(asset.id);
            setLabelMenuOpen(false);
          }}
        >
          <Gauge size={13} />
          {extras.qualityLoading.has(asset.id)
            ? zhCN.mediaBin.aiQualityAssessment.assessing
            : zhCN.mediaBin.aiQualityAssessment.assess}
        </button>
      ) : null}
      <div className="mb-2 flex items-center gap-1 font-semibold text-[var(--color-text-secondary)]">
        <Tag size={13} />
        {zhCN.mediaBin.label}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MEDIA_LABEL_COLORS.map((color) => (
          <button
            key={color.key}
            className="h-7 rounded border border-line"
            type="button"
            title={zhCN.mediaBin.labelColors[color.key]}
            style={MEDIA_LABEL_COLOR_STYLES[color.key]}
            data-testid={`media-label-color-${color.key}`}
            onClick={() => {
              actions.onSetLabel(color.key);
              setLabelMenuOpen(false);
            }}
          />
        ))}
      </div>
      <button
        className="mt-2 w-full rounded-md border border-line px-2 py-1 text-left font-medium text-[var(--color-text-secondary)] hover:bg-panel"
        type="button"
        data-testid="media-label-clear"
        onClick={() => {
          actions.onSetLabel(undefined);
          setLabelMenuOpen(false);
        }}
      >
        {zhCN.mediaBin.clearLabel}
      </button>
    </div>
  );
}
