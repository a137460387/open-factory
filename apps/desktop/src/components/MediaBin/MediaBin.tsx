import { TITLE_TEMPLATE_IDS, filterMediaAssets, shouldGenerateProxy, type MediaAsset, type MediaBinFilter, type MediaLabelColor, type MediaMetadata, type TitleTemplateId } from '@open-factory/editor-core';
import { AlertCircle, BadgeCheck, FileAudio2, FileImage, FileText, FileVideo2, Gauge, Import, Link2, Loader2, Merge, Plus, Search, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { zhCN } from '../../i18n/strings';
import { isTauriRuntime } from '../../lib/tauri';
import { TITLE_TEMPLATE_DRAG_MIME } from '../../lib/titleTemplates';
import { listenDragDrop } from '../../lib/tauri-bridge';
import { useMediaJobStore } from '../../media/media-job-store';
import { useProxySettingsStore } from '../../store/proxySettingsStore';

interface MediaBinProps {
  media: MediaAsset[];
  mediaMetadata: Record<string, MediaMetadata>;
  onImport(): void;
  onImportPaths(paths: string[]): void;
  onBatchTranscode(paths: string[]): void;
  onScanDuplicates(): void;
  onAddToTimeline(assetId: string): void;
  onRelink(assetId: string): void;
  onRelinkAll(): void;
  onGenerateProxy(assetId: string): void;
  onSetLabel(assetId: string, labelColor?: MediaLabelColor): void;
  onAddTitleTemplate(templateId: TitleTemplateId): void;
}

type MediaBinView = MediaBinFilter | 'titles';

export function MediaBin({ media, mediaMetadata, onImport, onImportPaths, onBatchTranscode, onScanDuplicates, onAddToTimeline, onRelink, onRelinkAll, onGenerateProxy, onSetLabel, onAddTitleTemplate }: MediaBinProps) {
  const t = zhCN.mediaBin;
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MediaBinView>('all');
  const missingCount = media.filter((asset) => asset.missing).length;
  const visibleMedia = filter === 'titles' ? [] : filterMediaAssets(media, { query: search, filter, metadata: mediaMetadata });
  const jobs = useMediaJobStore((state) => state.jobs);
  const runnerActive = useMediaJobStore((state) => state.runnerActive);
  const clearFinishedJobs = useMediaJobStore((state) => state.clearFinishedJobs);
  const runningJob = jobs.find((job) => job.status === 'running');
  const pendingCount = jobs.filter((job) => job.status === 'pending').length;
  const failedCount = jobs.filter((job) => job.status === 'error').length;

  useEffect(() => {
    if (!isTauriRuntime()) {
      return undefined;
    }
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenDragDrop((payload) => {
        setDragOver(payload.type === 'over');
        if (payload.type === 'drop' && payload.paths?.length) {
          onImportPaths(payload.paths);
        }
      }).then((dispose) => {
        if (disposed) {
          dispose();
        } else {
          unlisten = dispose;
        }
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onImportPaths]);

  return (
    <aside
      className={clsx('flex min-h-0 flex-col bg-white', dragOver && 'ring-2 ring-inset ring-brand')}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const paths = Array.from(event.dataTransfer.files)
          .map((file) => (file as File & { path?: string }).path)
          .filter((path): path is string => Boolean(path));
        if (paths.length > 0) {
          onImportPaths(paths);
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div>
          <div className="text-sm font-semibold">{t.title}</div>
          <div className="text-xs text-slate-500">{t.itemCount(media.length)}</div>
        </div>
        <div className="flex items-center gap-2">
          {missingCount > 0 ? (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 text-xs font-medium text-amber-900 hover:bg-amber-100"
              onClick={onRelinkAll}
              data-testid="relink-all-button"
            >
              <Link2 size={14} />
              {t.relinkFolder}
            </button>
          ) : null}
          <button
            className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            onClick={onScanDuplicates}
            data-testid="scan-duplicate-media-button"
          >
            <Merge size={15} />
            {t.scanDuplicates}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]"
            onClick={onImport}
            data-testid="import-media-button"
          >
            <Import size={16} />
            {t.import}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-3 space-y-2">
          <label className="relative block">
            <span className="sr-only">{t.searchPlaceholder}</span>
            <Search className="pointer-events-none absolute left-2 top-2.5 text-slate-400" size={15} />
            <input
              className="w-full rounded-md border border-line bg-white py-2 pl-8 pr-2 text-sm text-ink"
              value={search}
              placeholder={t.searchPlaceholder}
              data-testid="media-search-input"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-3 gap-1" data-testid="media-filter-bar">
            {(['all', 'video', 'audio', 'image', 'tagged', 'titles'] as MediaBinView[]).map((item) => (
              <button
                key={item}
                className={clsx(
                  'rounded-md border px-1.5 py-1 text-xs font-semibold',
                  filter === item ? 'border-brand bg-white text-brand' : 'border-line bg-white text-slate-600 hover:bg-panel'
                )}
                type="button"
                data-testid={`media-filter-${item}`}
                onClick={() => setFilter(item)}
              >
                {t.filters[item]}
              </button>
            ))}
          </div>
        </div>
        {filter !== 'titles' && jobs.length > 0 ? (
          <div className="mb-3 rounded-md border border-line bg-panel p-2 text-xs" data-testid="media-job-queue">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-slate-700">{t.mediaJobs}</div>
                <div className="truncate text-slate-500">
                  {runningJob ? `${t.jobType[runningJob.type]} · ${runningJob.assetName}` : runnerActive ? t.preparingQueue : zhCN.common.idle} · {t.pendingCount(pendingCount)}
                  {failedCount > 0 ? ` · ${t.failedCount(failedCount)}` : ''}
                </div>
              </div>
              <button className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium hover:bg-white/80" onClick={clearFinishedJobs}>
                {zhCN.common.clear}
              </button>
            </div>
          </div>
        ) : null}
        {filter === 'titles' ? (
          <TitleTemplateGrid onAddTitleTemplate={onAddTitleTemplate} />
        ) : media.length === 0 ? (
          <button
            className="flex h-full min-h-[220px] w-full flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-panel p-6 text-center text-sm text-slate-600"
            onClick={onImport}
          >
            <Import className="mb-3 text-slate-500" size={30} />
            {t.emptyDrop}
          </button>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {visibleMedia.map((asset) => (
              <MediaCard
                key={asset.id}
                asset={asset}
                metadata={mediaMetadata[asset.id]}
                onAdd={() => onAddToTimeline(asset.id)}
                onRelink={() => onRelink(asset.id)}
                onGenerateProxy={() => onGenerateProxy(asset.id)}
                onSetLabel={(labelColor) => onSetLabel(asset.id, labelColor)}
                onBatchTranscode={() => onBatchTranscode([asset.path])}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function TitleTemplateGrid({ onAddTitleTemplate }: { onAddTitleTemplate(templateId: TitleTemplateId): void }) {
  return (
    <div className="grid grid-cols-1 gap-3" data-testid="title-template-grid">
      <div className="rounded-md border border-line bg-panel px-3 py-2 text-xs font-medium text-slate-600">
        {zhCN.mediaBin.titleTemplateCount(TITLE_TEMPLATE_IDS.length)}
      </div>
      {TITLE_TEMPLATE_IDS.map((templateId) => {
        const label = zhCN.titleTemplates[templateId];
        return (
          <div
            key={templateId}
            className="rounded-md border border-line bg-white p-3 shadow-sm"
            draggable
            data-testid={`title-template-card-${templateId}`}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'copy';
              event.dataTransfer.setData(TITLE_TEMPLATE_DRAG_MIME, templateId);
            }}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-panel text-brand">
                <FileText size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{label.name}</div>
                <div className="truncate text-xs text-slate-500">{label.defaultText}</div>
              </div>
            </div>
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-sm font-medium hover:bg-white"
              type="button"
              data-testid={`add-title-template-${templateId}`}
              onClick={() => onAddTitleTemplate(templateId)}
            >
              <Plus size={15} />
              {zhCN.mediaBin.addTitleTemplate}
            </button>
          </div>
        );
      })}
    </div>
  );
}

const MEDIA_LABEL_COLORS: Array<{ key: MediaLabelColor; value: string }> = [
  { key: 'red', value: '#ef4444' },
  { key: 'orange', value: '#f97316' },
  { key: 'yellow', value: '#eab308' },
  { key: 'green', value: '#22c55e' },
  { key: 'blue', value: '#3b82f6' },
  { key: 'purple', value: '#a855f7' }
];

function MediaCard({
  asset,
  metadata,
  onAdd,
  onRelink,
  onGenerateProxy,
  onSetLabel,
  onBatchTranscode
}: {
  asset: MediaAsset;
  metadata?: MediaMetadata;
  onAdd(): void;
  onRelink(): void;
  onGenerateProxy(): void;
  onSetLabel(labelColor?: MediaLabelColor): void;
  onBatchTranscode(): void;
}) {
  const proxySettings = useProxySettingsStore((state) => state.settings);
  const proxyStatus = asset.proxyStatus ?? (asset.type === 'video' ? 'none' : undefined);
  const canGenerateProxy = asset.type === 'video' && (shouldGenerateProxy(asset, proxySettings) || proxyStatus === 'error');
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const labelColor = metadata?.labelColor;
  return (
    <div
      className={clsx('relative overflow-hidden rounded-md border bg-white shadow-sm', asset.missing ? 'border-rose-300' : 'border-line')}
      data-testid={`media-card-${asset.id}`}
      data-missing={asset.missing ? 'true' : 'false'}
      data-label-color={labelColor ?? 'none'}
      onContextMenu={(event) => {
        event.preventDefault();
        setLabelMenuOpen(true);
      }}
    >
      <div className="checkerboard relative aspect-video">
        {asset.thumbnail ? <img className="h-full w-full object-cover" src={asset.thumbnail} alt="" /> : <IconPreview type={asset.type} />}
        {asset.missing ? <span className="absolute left-2 top-2 rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white" data-testid={`missing-media-badge-${asset.id}`}>{zhCN.common.missing}</span> : null}
        {labelColor ? <span className="absolute right-2 top-2 h-4 w-4 rounded-full border border-white shadow" style={{ backgroundColor: labelColorToHex(labelColor) }} data-testid={`media-label-${asset.id}`} /> : null}
      </div>
      {labelMenuOpen ? (
        <div className="absolute right-2 top-2 z-10 w-40 rounded-md border border-line bg-white p-2 text-xs shadow-soft" data-testid={`media-label-menu-${asset.id}`}>
          {asset.type === 'video' ? (
            <button
              className="mb-2 inline-flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left font-medium text-slate-700 hover:bg-panel"
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
          ) : null}
          <div className="mb-2 flex items-center gap-1 font-semibold text-slate-700">
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
                style={{ backgroundColor: color.value }}
                data-testid={`media-label-color-${color.key}`}
                onClick={() => {
                  onSetLabel(color.key);
                  setLabelMenuOpen(false);
                }}
              />
            ))}
          </div>
          <button
            className="mt-2 w-full rounded-md border border-line px-2 py-1 text-left font-medium text-slate-600 hover:bg-panel"
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
        <div className="truncate text-sm font-medium" title={asset.path}>
          {asset.name}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>{zhCN.mediaBin.assetType[asset.type]}</span>
          <span>{asset.type === 'audio' ? formatDuration(asset.duration) : `${asset.width || '-'}x${asset.height || '-'}`}</span>
        </div>
        {asset.type === 'video' ? (
          <ProxyStatus status={proxyStatus} error={asset.proxyError} canGenerate={canGenerateProxy} onGenerateProxy={onGenerateProxy} assetId={asset.id} />
        ) : null}
        {asset.relativePath ? <div className="mt-1 truncate text-[11px] text-slate-400">{asset.relativePath}</div> : null}
        <button
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-sm font-medium hover:bg-white"
          onClick={onAdd}
          data-testid={`add-to-timeline-${asset.id}`}
        >
          <Plus size={15} />
          {zhCN.mediaBin.addToTimeline}
        </button>
        {asset.missing ? (
          <button
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            onClick={onRelink}
            data-testid={`relink-media-${asset.id}`}
          >
            <Link2 size={15} />
            {zhCN.mediaBin.relink}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function labelColorToHex(color: MediaLabelColor): string {
  return MEDIA_LABEL_COLORS.find((item) => item.key === color)?.value ?? '#64748b';
}

function ProxyStatus({
  status,
  error,
  canGenerate,
  onGenerateProxy,
  assetId
}: {
  status: MediaAsset['proxyStatus'];
  error?: string;
  canGenerate: boolean;
  onGenerateProxy(): void;
  assetId: string;
}) {
  const icon = status === 'ready' ? <BadgeCheck size={13} /> : status === 'pending' ? <Loader2 className="animate-spin" size={13} /> : status === 'error' ? <AlertCircle size={13} /> : <Gauge size={13} />;
  const label = status === 'ready' ? zhCN.mediaBin.proxyStatus.ready : status === 'pending' ? zhCN.mediaBin.proxyStatus.pending : status === 'error' ? zhCN.mediaBin.proxyStatus.error : canGenerate ? zhCN.mediaBin.proxyStatus.recommended : zhCN.mediaBin.proxyStatus.notNeeded;
  const tone =
    status === 'ready'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'pending'
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : status === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-slate-200 bg-slate-50 text-slate-600';
  return (
    <div className="mt-2 space-y-1">
      <div className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`} title={error} data-testid={`proxy-status-${assetId}`} data-proxy-status={status ?? 'none'}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {canGenerate || status === 'pending' || status === 'ready' ? (
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-2 py-1.5 text-xs font-medium hover:bg-panel disabled:opacity-50"
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

function IconPreview({ type }: { type: MediaAsset['type'] }) {
  const Icon = type === 'video' ? FileVideo2 : type === 'audio' ? FileAudio2 : FileImage;
  return (
    <div className="flex h-full items-center justify-center text-slate-500">
      <Icon size={36} />
    </div>
  );
}

function formatDuration(duration: number): string {
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}
