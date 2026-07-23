import {
  getMediaVersionLabel,
  isFrameRateMismatch,
  mapScoreToGrade,
  shouldGenerateProxy,
  formatTimeShort,
  type ClipContentAnalysis,
  type MediaAsset,
  type MediaFlag,
  type MediaLabelColor,
  type MediaMetadata,
  type QualityAssessmentResult,
} from '@open-factory/editor-core';
import type { Subclip, TimelineLabelColor } from '@open-factory/editor-core';
import type { VisualHighlightMarker } from '@open-factory/editor-core/visual-highlight-engine';
import { HighlightBadge } from './HighlightOverlay';
import {
  AlertCircle,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  FileAudio2,
  FileImage,
  FileVideo2,
  Flag,
  GalleryHorizontal,
  Gauge,
  Heart,
  ImageDown,
  Info,
  Link2,
  List,
  Loader2,
  Plus,
  Scissors,
  Search,
  Sparkles,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  createContext,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { computeMediaPreviewDelay, isMediaPreviewable } from './media-hover-preview';
import { getMediaKeyboardNavigationIndex } from './media-keyboard';
import { clsx } from 'clsx';
import { zhCN } from '../../i18n/strings';
import { convertLocalFileSrc } from '../../lib/tauri-bridge';
import { useProxySettingsStore } from '../../store/proxySettingsStore';

// ---------------------------------------------------------------------------
// Contexts & shared types
// ---------------------------------------------------------------------------

export interface MediaCardExtras {
  favoriteIds: Set<string>;
  onToggleFavorite(assetId: string): void;
  onRevealInTimeline(assetId: string): void;
  pinnedIds: Set<string>;
  onPinToSession(assetId: string): void;
  onAnalyzeAI(assetId: string): void;
  qualityResults: Map<string, QualityAssessmentResult>;
  qualityErrors: Map<string, string>;
  qualityLoading: Set<string>;
  onQualityAssess(assetId: string): void;
  onBatchQualityScan(): void;
}
export const MediaCardExtrasCtx = createContext<MediaCardExtras | null>(null);

export interface MediaGridNavCtxValue {
  columnCount: number;
  mediaCount: number;
  scrollToMediaIndex(index: number): void;
  pendingFocusRef: { current: number | null };
}
export const MediaGridNavCtx = createContext<MediaGridNavCtxValue | null>(null);

export interface SubclipContextValue {
  subclips: Subclip[];
  onAddSubclip(subclip: Subclip): void;
  onUpdateSubclip(subclipId: string, patch: Partial<Subclip>): void;
  onDeleteSubclip(subclipId: string): void;
  onAddSubclipToTimeline(assetId: string, subclip: Subclip): void;
  onOpenSubclipDialog(assetId: string, editingSubclipId?: string): void;
  expandedSubclipAssetIds: Set<string>;
  onToggleSubclipExpanded(assetId: string): void;
}
export const SubclipCtx = createContext<SubclipContextValue | null>(null);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MEDIA_CARD_DRAG_MIME = 'application/x-open-factory-media-id';
export const SUBCLIP_DRAG_MIME = 'application/x-open-factory-subclip';

const MEDIA_LABEL_COLORS: Array<{ key: MediaLabelColor; value: string }> = [
  { key: 'red', value: '#ef4444' },
  { key: 'orange', value: '#f97316' },
  { key: 'yellow', value: '#eab308' },
  { key: 'green', value: '#22c55e' },
  { key: 'blue', value: '#3b82f6' },
  { key: 'purple', value: '#a855f7' },
];
const MEDIA_LABEL_COLOR_STYLES: Record<string, CSSProperties> = Object.fromEntries(
  MEDIA_LABEL_COLORS.map((c) => [c.key, { backgroundColor: c.value }]),
);

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function labelColorToHex(color: MediaLabelColor): string {
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

function formatPreciseFrameRate(frameRate: number): string {
  return `${(Math.round(frameRate * 1000) / 1000).toFixed(3)} fps`;
}

const formatDuration = formatTimeShort;

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

function MediaSceneTagList({ assetId, analysis }: { assetId: string; analysis: ClipContentAnalysis }) {
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

function ProxyStatus({
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

export function IconPreview({ type }: { type: MediaAsset['type'] }) {
  const Icon = type === 'video' ? FileVideo2 : type === 'audio' ? FileAudio2 : FileImage;
  return (
    <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
      <Icon size={36} />
    </div>
  );
}

function focusMediaCardByKeyboard(event: ReactKeyboardEvent<HTMLElement>, nav: MediaGridNavCtxValue): void {
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
  const extras = useContext(MediaCardExtrasCtx);
  const sc = useContext(SubclipCtx);
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
            style={{ backgroundColor: labelColorToHex(labelColor) }}
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
      {labelMenuOpen ? (
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
                  onOpenBatchMetadata();
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
                  onOpenBatchRename();
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
              onShowInfo();
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
              onAddVersion();
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
              onFindSources();
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
              onCompareVersions();
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
                  onBatchTranscode();
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
                  onExportGif();
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
                onAnalyzeSpectrum();
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
                  onSetLabel(color.key);
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
              onSetLabel(undefined);
              setLabelMenuOpen(false);
            }}
          >
            {zhCN.mediaBin.clearLabel}
          </button>
        </div>
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
        {sc && sc.subclips.filter((s) => s.sourceMediaId === asset.id).length > 0 ? (
          <div className="mt-2">
            <button
              className="inline-flex w-full items-center gap-1 rounded border border-line bg-panel px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
              type="button"
              data-testid={`toggle-subclips-${asset.id}`}
              onClick={(e) => {
                e.stopPropagation();
                sc.onToggleSubclipExpanded(asset.id);
              }}
            >
              {sc.expandedSubclipAssetIds.has(asset.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Scissors size={11} />
              {zhCN.subclip.subclipCount(sc.subclips.filter((s) => s.sourceMediaId === asset.id).length)}
            </button>
            {sc.expandedSubclipAssetIds.has(asset.id) ? (
              <div className="mt-1 space-y-1" data-testid={`subclip-list-${asset.id}`}>
                {sc.subclips
                  .filter((s) => s.sourceMediaId === asset.id)
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className="rounded border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-[11px] shadow-sm"
                      draggable
                      data-testid={`subclip-card-${sub.id}`}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'copy';
                        event.dataTransfer.setData(
                          SUBCLIP_DRAG_MIME,
                          JSON.stringify({ assetId: asset.id, subclip: sub }),
                        );
                      }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-semibold text-[var(--color-text-secondary)]" title={sub.name}>
                          {sub.name}
                        </span>
                        <span className="shrink-0 text-[var(--color-text-muted)]">
                          {formatDuration(sub.inPoint)} \u2013 {formatDuration(sub.outPoint)}
                        </span>
                      </div>
                      {sub.color ? (
                        <span
                          className="mt-0.5 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: sub.color }}
                        />
                      ) : null}
                      <div className="mt-1 flex items-center gap-1">
                        <button
                          className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                          type="button"
                          data-testid={`add-subclip-to-timeline-${sub.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            sc.onAddSubclipToTimeline(asset.id, sub);
                          }}
                        >
                          {zhCN.subclip.addToTimeline}
                        </button>
                        <button
                          className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                          type="button"
                          data-testid={`edit-subclip-${sub.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            sc.onOpenSubclipDialog(asset.id, sub.id);
                          }}
                        >
                          {zhCN.subclip.editSubclip}
                        </button>
                        <button
                          className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-rose-600 hover:bg-panel"
                          type="button"
                          data-testid={`delete-subclip-${sub.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            sc.onDeleteSubclip(sub.id);
                          }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
