import type { SpeakerDiarizationSegment, Track } from '@open-factory/editor-core';
import { X } from 'lucide-react';
import { zhCN } from '../i18n/strings';

interface SpeakerDiarizationDialogProps {
  segments: SpeakerDiarizationSegment[];
  tracks: Track[];
  sourceName: string;
  onApply(): void;
  onClose(): void;
}

export default function SpeakerDiarizationDialog({
  segments,
  tracks,
  sourceName,
  onApply,
  onClose,
}: SpeakerDiarizationDialogProps) {
  const t = zhCN.speakerDiarization;
  const lowCount = segments.filter((segment) => segment.confidenceLabel === 'low').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="speaker-diarization-dialog"
    >
      <section className="flex max-h-[82vh] w-full max-w-3xl flex-col rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.summary(sourceName, tracks.length, segments.length)}</p>
          </div>
          <button
            className="rounded p-1 text-slate-500 hover:bg-panel"
            type="button"
            aria-label={t.close}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          {lowCount > 0 ? (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
              data-testid="speaker-diarization-low-confidence"
            >
              {t.lowConfidenceNotice(lowCount)}
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-[180px_1fr]">
            <div className="rounded-md border border-line bg-panel p-3">
              <div className="text-xs font-semibold text-slate-700">{t.tracks}</div>
              <div className="mt-2 space-y-2">
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    className="rounded border border-line bg-white px-2 py-1.5 text-xs text-slate-700"
                    data-testid="speaker-diarization-track"
                  >
                    <div className="font-semibold">{track.name}</div>
                    <div className="text-slate-500">{t.clipCount(track.clips.length)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-line bg-white">
              <div className="border-b border-line px-3 py-2 text-xs font-semibold text-slate-700">{t.segments}</div>
              <div className="max-h-72 overflow-y-auto p-2">
                {segments.map((segment, index) => (
                  <div
                    key={segment.id}
                    className={`mb-2 rounded border px-3 py-2 text-xs ${segment.confidenceLabel === 'low' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-line bg-white text-slate-700'}`}
                    data-testid="speaker-diarization-segment"
                    data-confidence={segment.confidenceLabel}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{t.segmentLabel(index + 1, segment.speakerIndex + 1)}</span>
                      <span>{t.confidence(segment.confidenceLabel, segment.confidence)}</span>
                    </div>
                    <div className="mt-1 text-slate-500">{t.range(segment.start, segment.end)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-panel"
            type="button"
            onClick={onClose}
          >
            {t.close}
          </button>
          <button
            className="rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-[#176858]"
            type="button"
            data-testid="speaker-diarization-apply"
            onClick={onApply}
          >
            {t.apply}
          </button>
        </div>
      </section>
    </div>
  );
}
