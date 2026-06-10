import { shouldGenerateProxy, type MediaAsset } from '@open-factory/editor-core';
import { AlertCircle, BadgeCheck, FileAudio2, FileImage, FileVideo2, Gauge, Import, Link2, Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { isTauriRuntime } from '../../lib/tauri';
import { listenDragDrop } from '../../lib/tauri-bridge';
import { useMediaJobStore } from '../../media/media-job-store';

interface MediaBinProps {
  media: MediaAsset[];
  onImport(): void;
  onImportPaths(paths: string[]): void;
  onAddToTimeline(assetId: string): void;
  onRelink(assetId: string): void;
  onRelinkAll(): void;
  onGenerateProxy(assetId: string): void;
}

export function MediaBin({ media, onImport, onImportPaths, onAddToTimeline, onRelink, onRelinkAll, onGenerateProxy }: MediaBinProps) {
  const [dragOver, setDragOver] = useState(false);
  const missingCount = media.filter((asset) => asset.missing).length;
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
          <div className="text-sm font-semibold">Media</div>
          <div className="text-xs text-slate-500">{media.length} item(s)</div>
        </div>
        <div className="flex items-center gap-2">
          {missingCount > 0 ? (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 text-xs font-medium text-amber-900 hover:bg-amber-100"
              onClick={onRelinkAll}
              data-testid="relink-all-button"
            >
              <Link2 size={14} />
              Relink Folder
            </button>
          ) : null}
          <button
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]"
            onClick={onImport}
            data-testid="import-media-button"
          >
            <Import size={16} />
            Import
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {jobs.length > 0 ? (
          <div className="mb-3 rounded-md border border-line bg-panel p-2 text-xs" data-testid="media-job-queue">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-slate-700">Media jobs</div>
                <div className="truncate text-slate-500">
                  {runningJob ? `${runningJob.type} · ${runningJob.assetName}` : runnerActive ? 'Preparing queue' : 'Idle'} · {pendingCount} pending
                  {failedCount > 0 ? ` · ${failedCount} failed` : ''}
                </div>
              </div>
              <button className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium hover:bg-white/80" onClick={clearFinishedJobs}>
                Clear
              </button>
            </div>
          </div>
        ) : null}
        {media.length === 0 ? (
          <button
            className="flex h-full min-h-[220px] w-full flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-panel p-6 text-center text-sm text-slate-600"
            onClick={onImport}
          >
            <Import className="mb-3 text-slate-500" size={30} />
            Drop media files here or click to import.
          </button>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {media.map((asset) => (
              <MediaCard
                key={asset.id}
                asset={asset}
                onAdd={() => onAddToTimeline(asset.id)}
                onRelink={() => onRelink(asset.id)}
                onGenerateProxy={() => onGenerateProxy(asset.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function MediaCard({ asset, onAdd, onRelink, onGenerateProxy }: { asset: MediaAsset; onAdd(): void; onRelink(): void; onGenerateProxy(): void }) {
  const proxyStatus = asset.proxyStatus ?? (asset.type === 'video' ? 'none' : undefined);
  const canGenerateProxy = asset.type === 'video' && (shouldGenerateProxy(asset) || proxyStatus === 'error');
  return (
    <div className={clsx('overflow-hidden rounded-md border bg-white shadow-sm', asset.missing ? 'border-rose-300' : 'border-line')} data-testid={`media-card-${asset.id}`}>
      <div className="checkerboard relative aspect-video">
        {asset.thumbnail ? <img className="h-full w-full object-cover" src={asset.thumbnail} alt="" /> : <IconPreview type={asset.type} />}
        {asset.missing ? <span className="absolute left-2 top-2 rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white">Missing</span> : null}
      </div>
      <div className="p-2">
        <div className="truncate text-sm font-medium" title={asset.path}>
          {asset.name}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>{asset.type}</span>
          <span>{asset.type === 'audio' ? formatDuration(asset.duration) : `${asset.width || '-'}x${asset.height || '-'}`}</span>
        </div>
        {asset.type === 'video' ? (
          <ProxyStatus status={proxyStatus} error={asset.proxyError} canGenerate={canGenerateProxy} onGenerateProxy={onGenerateProxy} assetId={asset.id} />
        ) : null}
        {asset.relativePath ? <div className="mt-1 truncate text-[11px] text-slate-400">{asset.relativePath}</div> : null}
        <button
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-sm font-medium hover:bg-white"
          onClick={onAdd}
        >
          <Plus size={15} />
          Add to timeline
        </button>
        {asset.missing ? (
          <button
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            onClick={onRelink}
            data-testid={`relink-media-${asset.id}`}
          >
            <Link2 size={15} />
            Relink
          </button>
        ) : null}
      </div>
    </div>
  );
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
  const label = status === 'ready' ? 'Proxy ready' : status === 'pending' ? 'Proxy pending' : status === 'error' ? 'Proxy failed' : canGenerate ? 'Proxy recommended' : 'Proxy not needed';
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
      <div className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`} title={error}>
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
          Generate proxy
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
