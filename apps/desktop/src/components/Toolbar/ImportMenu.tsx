import { FileDown, Captions } from 'lucide-react';
import { useState } from 'react';
import type { SubtitleDataImportMode } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { MenuDropdown } from './MenuDropdown';

export function ImportMenu({
  open,
  onToggle,
  onImportMedia,
  onImportSubtitles,
  onImportDataSubtitles,
}: {
  open: boolean;
  onToggle(): void;
  onImportMedia(): void;
  onImportSubtitles(): void;
  onImportDataSubtitles(mode: SubtitleDataImportMode): void;
}) {
  const t = zhCN.toolbar;
  const [subtitleDataImportMode, setSubtitleDataImportMode] = useState<SubtitleDataImportMode>('append');
  const close = () => onToggle();
  return (
    <MenuDropdown label={t.importMenu} open={open} onToggle={onToggle} testId="toolbar-import-menu-button">
      <div className="min-w-64">
        <button
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-panel"
          type="button"
          data-testid="toolbar-import-media-menu-item"
          onClick={() => {
            close();
            onImportMedia();
          }}
        >
          <FileDown size={14} />
          <span>{t.importMedia}</span>
        </button>
        <button
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-panel"
          type="button"
          data-testid="toolbar-import-subtitles-menu-item"
          onClick={() => {
            close();
            onImportSubtitles();
          }}
        >
          <Captions size={14} />
          <span>{t.importSubtitles}</span>
        </button>
        <div className="my-2 h-px bg-line" />
        <label
          className="mb-1 block px-2 text-[11px] font-medium uppercase tracking-wide text-slate-500"
          htmlFor="subtitle-data-import-mode-select"
        >
          {t.subtitleDataImportMode}
        </label>
        <select
          id="subtitle-data-import-mode-select"
          className="mb-2 h-8 w-full rounded border border-line bg-white px-2 text-xs text-slate-700"
          value={subtitleDataImportMode}
          data-testid="subtitle-data-import-mode-select"
          onChange={(event) => setSubtitleDataImportMode(event.target.value as SubtitleDataImportMode)}
        >
          <option value="append">{t.subtitleDataImportModes.append}</option>
          <option value="new-track">{t.subtitleDataImportModes['new-track']}</option>
          <option value="replace-current-track">{t.subtitleDataImportModes['replace-current-track']}</option>
        </select>
        <button
          className="flex w-full items-center gap-2 rounded bg-brand px-2 py-2 text-left text-sm font-medium text-white"
          type="button"
          data-testid="import-data-subtitles-button"
          onClick={() => {
            close();
            onImportDataSubtitles(subtitleDataImportMode);
          }}
        >
          <Captions size={14} />
          <span>{t.importDataSubtitles}</span>
        </button>
      </div>
    </MenuDropdown>
  );
}
