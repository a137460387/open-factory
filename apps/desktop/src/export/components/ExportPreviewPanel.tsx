import type { FfmpegCapabilities } from "@open-factory/editor-core";
import { Image as ImageIcon } from "lucide-react";
import { zhCN } from "../../i18n/strings";
import { formatDuration } from "../lib/pipelineHelpers";

export interface ExportPreviewThumbnail {
  id: string;
  kind: string;
  label: string;
  time: number;
  path: string;
  src: string;
  durationMs: number;
}

export interface ExportPreviewPanelProps {
  isAudioOnly: boolean;
  previewRunning: boolean;
  previewError: string | undefined;
  previewSamples: ExportPreviewThumbnail[];
  capabilities: FfmpegCapabilities | undefined;
  onPreview: () => void;
}

export function ExportPreviewPanel({
  isAudioOnly,
  previewRunning,
  previewError,
  previewSamples,
  capabilities,
  onPreview,
}: ExportPreviewPanelProps) {
  const t = zhCN.exportDialog;

  if (isAudioOnly) return null;

  return (
            <div
              className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3"
              data-testid="export-preview-panel"
            >
              <label className="pt-1.5 text-xs font-medium text-slate-600">{t.preview.title}</label>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={previewRunning || capabilities?.available === false}
                    data-testid="export-preview-button"
                    onClick={() => void previewExport()}
                  >
                    <ImageIcon size={13} />
                    {previewRunning ? t.preview.running : t.preview.button}
                  </button>
                  <span className="text-xs text-slate-500" data-testid="export-preview-status">
                    {previewRunning
                      ? t.preview.runningDescription
                      : previewSamples.length === 3
                        ? t.preview.readyMessage
                        : t.preview.description}
                  </span>
                </div>
                {previewError ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-800">
                    {previewError}
                  </div>
                ) : null}
                {previewSamples.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-3" data-testid="export-preview-thumbnails">
                    {previewSamples.map((sample) => (
                      <figure
                        key={sample.id}
                        className="overflow-hidden rounded-md border border-line bg-panel"
                        data-testid="export-preview-thumbnail"
                        data-path={sample.path}
                      >
                        <div className="aspect-video bg-black">
                          <img
                            className="h-full w-full object-cover"
                            src={sample.src}
                            alt={sample.label}
                            data-testid="export-preview-image"
                            loading="lazy"
                          />
                        </div>
                        <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-slate-600">
                          <span className="font-medium text-slate-700">{sample.label}</span>
                          <span className="tabular-nums">{formatDuration(sample.time)}</span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

  );
}
