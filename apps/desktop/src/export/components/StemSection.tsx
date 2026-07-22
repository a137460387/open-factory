import type { ExportStemFormat, ExportStemMode } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';

export interface StemTrack {
  trackIndex: number;
  trackName: string;
  selected: boolean;
  format: ExportStemFormat;
}

export function StemSection({
  stemMode,
  setStemMode,
  stemTracks,
  setStemTracks,
}: {
  stemMode: ExportStemMode;
  setStemMode: (mode: ExportStemMode) => void;
  stemTracks: StemTrack[];
  setStemTracks: React.Dispatch<React.SetStateAction<StemTrack[]>>;
}) {
  const t = zhCN.exportDialog;
  return (
    <div
      className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3"
      data-testid="export-stem-tab"
    >
      <label className="pt-1 text-xs font-medium text-slate-600">{t.stem.title}</label>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">{t.stem.description}</p>
        <div className="grid gap-2 md:grid-cols-[1fr_220px]">
          <label className="block text-xs font-medium text-slate-600">
            {t.stem.format}
            <select
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-xs"
              value={stemMode}
              onChange={(event) => setStemMode(event.target.value as ExportStemMode)}
              data-testid="export-stem-mode-select"
            >
              <option value="independent">{t.stem.modes.independent}</option>
              <option value="combined">{t.stem.modes.combined}</option>
              <option value="stems-only">{t.stem.modes['stems-only']}</option>
            </select>
          </label>
          <div className="text-xs text-slate-500">{t.stem.modeDescriptions[stemMode]}</div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">{t.stem.trackList}</label>
            <div className="flex gap-2">
              <button
                className="text-[11px] text-brand hover:underline"
                type="button"
                onClick={() => setStemTracks((prev) => prev.map((track) => ({ ...track, selected: true })))}
                data-testid="export-stem-select-all"
              >
                {t.stem.selectAll}
              </button>
              <button
                className="text-[11px] text-brand hover:underline"
                type="button"
                onClick={() => setStemTracks((prev) => prev.map((track) => ({ ...track, selected: false })))}
                data-testid="export-stem-deselect-all"
              >
                {t.stem.deselectAll}
              </button>
            </div>
          </div>
          {stemTracks.length === 0 ? (
            <p className="text-xs text-slate-500">{t.stem.noAudioTracks}</p>
          ) : (
            <div className="space-y-1" data-testid="export-stem-track-list">
              {stemTracks.map((track) => (
                <label
                  key={track.trackIndex}
                  className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5 text-xs"
                  data-testid={`export-stem-track-${track.trackIndex}`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-brand"
                    checked={track.selected}
                    onChange={(event) =>
                      setStemTracks((prev) =>
                        prev.map((item) =>
                          item.trackIndex === track.trackIndex
                            ? { ...item, selected: event.target.checked }
                            : item,
                        ),
                      )
                    }
                  />
                  <span className="flex-1 font-medium text-slate-700">{track.trackName}</span>
                  <select
                    className="rounded-md border border-line px-1 py-0.5 text-[11px]"
                    value={track.format}
                    onChange={(event) =>
                      setStemTracks((prev) =>
                        prev.map((item) =>
                          item.trackIndex === track.trackIndex
                            ? { ...item, format: event.target.value as ExportStemFormat }
                            : item,
                        ),
                      )
                    }
                    data-testid={`export-stem-format-${track.trackIndex}`}
                  >
                    <option value="default">{t.stem.formatOptions.default}</option>
                    <option value="wav">{t.stem.formatOptions.wav}</option>
                    <option value="aiff">{t.stem.formatOptions.aiff}</option>
                    <option value="m4a">{t.stem.formatOptions.m4a}</option>
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="text-[11px] text-slate-400">{t.stem.namingRule}</div>
      </div>
    </div>
  );
}
