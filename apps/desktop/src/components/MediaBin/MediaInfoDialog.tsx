import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { MediaAnalysis, MediaAsset } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export type MediaInfoState = { asset: MediaAsset; loading: boolean; analysis?: MediaAnalysis; error?: string };

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

export function formatDuration(duration: number): string {
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-panel p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-normal text-[var(--color-text-secondary)]">
        {title}
      </h3>
      <div className="grid gap-1 text-sm">{children}</div>
    </section>
  );
}

function InfoRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
      <div className="text-xs font-medium text-[var(--color-text-muted)]">{label}</div>
      <div className="min-w-0 break-words text-sm text-ink" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

function BitrateChart({ points }: { points: MediaAnalysis['bitratePoints'] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#cbd5e1';
    context.lineWidth = 1;
    for (let y = 24; y < height; y += 24) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    if (points.length === 0) {
      context.fillStyle = '#64748b';
      context.font = '12px sans-serif';
      context.fillText(zhCN.mediaBin.mediaInfo.noBitrateData, 12, 26);
      return;
    }
    const maxRate = Math.max(...points.map((point) => point.bitRate), 1);
    const maxTime = Math.max(...points.map((point) => point.time), 1);
    context.strokeStyle = '#0f766e';
    context.lineWidth = 2;
    context.beginPath();
    points.forEach((point, index) => {
      const x = (point.time / maxTime) * (width - 16) + 8;
      const y = height - 8 - (point.bitRate / maxRate) * (height - 16);
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
  }, [points]);

  return (
    <canvas
      ref={canvasRef}
      className="h-32 w-full rounded-md border border-line bg-[var(--color-bg-elevated)]"
      width={640}
      height={128}
      data-testid="media-info-bitrate-chart"
    />
  );
}

export function MediaInfoDialog({ state, onClose }: { state: MediaInfoState; onClose(): void }) {
  const t = zhCN.mediaBin.mediaInfo;
  const analysis = state.analysis;
  const firstVideo = analysis?.videoStreams[0];
  const firstAudio = analysis?.audioStreams[0];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="media-info-dialog"
    >
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-[var(--color-bg-elevated)] shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink">{t.title}</h2>
            <div className="truncate text-xs text-[var(--color-text-muted)]">{state.asset.name}</div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-panel"
            type="button"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="media-info-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {state.loading ? (
            <div className="rounded-md border border-line bg-panel p-3 text-sm text-[var(--color-text-secondary)]">
              {t.loading}
            </div>
          ) : null}
          {state.error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{state.error}</div>
          ) : null}
          {analysis ? (
            <div className="space-y-4">
              <InfoSection title={t.basic}>
                <InfoRow
                  label={t.format}
                  value={analysis.format.formatLongName ?? analysis.format.formatName ?? zhCN.common.unavailable}
                  testId="media-info-format"
                />
                <InfoRow label={t.duration} value={formatDuration(analysis.format.duration ?? state.asset.duration)} />
                <InfoRow label={t.fileSize} value={formatBytes(analysis.fileSize ?? analysis.format.size)} />
                <InfoRow label={t.createdTime} value={formatDateTime(analysis.createdTimeMs)} />
                <InfoRow label={t.bitRate} value={formatBitRate(analysis.format.bitRate)} />
              </InfoSection>
              <InfoSection title={t.video}>
                {firstVideo ? (
                  <>
                    <InfoRow
                      label={t.codec}
                      value={firstVideo.codecLongName ?? firstVideo.codecName ?? zhCN.common.unavailable}
                      testId="media-info-codec"
                    />
                    <InfoRow
                      label={t.resolution}
                      value={
                        firstVideo.width && firstVideo.height
                          ? `${firstVideo.width} x ${firstVideo.height}`
                          : zhCN.common.unavailable
                      }
                      testId="media-info-resolution"
                    />
                    <InfoRow
                      label={t.frameRate}
                      value={firstVideo.frameRate ? `${firstVideo.frameRate.toFixed(2)} fps` : zhCN.common.unavailable}
                    />
                    <InfoRow label={t.bitRate} value={formatBitRate(firstVideo.bitRate)} />
                    <InfoRow
                      label={t.colorSpace}
                      value={
                        [firstVideo.colorPrimaries, firstVideo.colorTransfer, firstVideo.colorSpace]
                          .filter(Boolean)
                          .join(' / ') || zhCN.common.unavailable
                      }
                    />
                    <InfoRow label={t.pixelFormat} value={firstVideo.pixelFormat ?? zhCN.common.unavailable} />
                    <InfoRow
                      label={t.hdrMetadata}
                      value={firstVideo.hdrMetadata.length > 0 ? firstVideo.hdrMetadata.join(', ') : zhCN.common.none}
                    />
                  </>
                ) : (
                  <div className="text-sm text-[var(--color-text-muted)]">{t.noVideo}</div>
                )}
              </InfoSection>
              <InfoSection title={t.audio}>
                {firstAudio ? (
                  <>
                    <InfoRow
                      label={t.codec}
                      value={firstAudio.codecLongName ?? firstAudio.codecName ?? zhCN.common.unavailable}
                    />
                    <InfoRow
                      label={t.sampleRate}
                      value={firstAudio.sampleRate ? `${firstAudio.sampleRate} Hz` : zhCN.common.unavailable}
                    />
                    <InfoRow
                      label={t.channels}
                      value={
                        firstAudio.channels
                          ? `${firstAudio.channels}${firstAudio.channelLayout ? ` (${firstAudio.channelLayout})` : ''}`
                          : zhCN.common.unavailable
                      }
                    />
                    <InfoRow label={t.bitRate} value={formatBitRate(firstAudio.bitRate)} />
                    <InfoRow
                      label={t.loudness}
                      value={
                        firstAudio.integratedLufs !== undefined
                          ? `${firstAudio.integratedLufs.toFixed(1)} LUFS`
                          : (analysis.loudnessError ?? zhCN.common.unavailable)
                      }
                      testId="media-info-loudness"
                    />
                  </>
                ) : (
                  <div className="text-sm text-[var(--color-text-muted)]">{t.noAudio}</div>
                )}
              </InfoSection>
              <InfoSection title={t.bitrateChart}>
                <BitrateChart points={analysis.bitratePoints} />
              </InfoSection>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
