import type {ClipContentAnalysis, MediaAsset} from '@open-factory/editor-core';
import {AlertCircle, BadgeCheck, FileAudio2, FileImage, FileVideo2, Gauge, Loader2} from 'lucide-react';
import {zhCN} from '../../i18n/strings';

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
