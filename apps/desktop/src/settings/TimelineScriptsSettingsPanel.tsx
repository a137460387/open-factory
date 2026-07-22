import { FilePlus, FolderOpen, Download, Play, Save, Trash2 } from 'lucide-react';
import type { BuiltinTimelineScript } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import type { TimelineScriptFile } from '../scripting/timeline-scripts';

export function TimelineScriptsSettingsPanel({
  builtins,
  files,
  selectedId,
  name,
  code,
  path,
  apiNames,
  running,
  output,
  error,
  onSelectBuiltin,
  onSelectFile,
  onNameChange,
  onCodeChange,
  onNew,
  onSave,
  onDelete,
  onImport,
  onExport,
  onRun,
}: {
  builtins: BuiltinTimelineScript[];
  files: TimelineScriptFile[];
  selectedId: string;
  name: string;
  code: string;
  path?: string;
  apiNames: string[];
  running: boolean;
  output: string[];
  error?: string;
  onSelectBuiltin(script: BuiltinTimelineScript): void;
  onSelectFile(file: TimelineScriptFile): void;
  onNameChange(name: string): void;
  onCodeChange(code: string): void;
  onNew(): void;
  onSave(): void;
  onDelete(): void;
  onImport(): void;
  onExport(): void;
  onRun(): void;
}) {
  const t = zhCN.settings.scripts;
  const appendCompletion = (apiName: string) => {
    const snippet = scriptApiSnippet(apiName);
    onCodeChange(`${code}${code.endsWith('\n') || code.length === 0 ? '' : '\n'}${snippet}`);
  };

  return (
    <div className="space-y-4" data-testid="timeline-scripts-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="timeline-script-new-button"
            onClick={onNew}
          >
            <FilePlus size={13} />
            {t.new}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="timeline-script-import-button"
            onClick={onImport}
          >
            <FolderOpen size={13} />
            {t.import}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="timeline-script-export-button"
            onClick={onExport}
          >
            <Download size={13} />
            {t.export}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-3">
          <section className="rounded-md border border-line bg-panel p-3">
            <h4 className="text-xs font-semibold uppercase tracking-normal text-slate-500">{t.examplesTitle}</h4>
            <div className="mt-2 space-y-1">
              {builtins.map((script) => {
                const label = t.examples[script.id as keyof typeof t.examples];
                return (
                  <button
                    key={script.id}
                    className={`w-full rounded-md px-2 py-2 text-left text-xs ${selectedId === script.id ? 'bg-white font-semibold text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
                    type="button"
                    data-testid={`timeline-script-example-${script.id}`}
                    onClick={() => onSelectBuiltin(script)}
                  >
                    <span className="block truncate">{label.name}</span>
                    <span className="mt-0.5 block line-clamp-2 text-[11px] font-normal text-slate-500">
                      {label.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border border-line bg-panel p-3">
            <h4 className="text-xs font-semibold uppercase tracking-normal text-slate-500">{t.filesTitle}</h4>
            {files.length === 0 ? (
              <div className="mt-2 rounded-md bg-white p-2 text-xs text-slate-500">{t.emptyFiles}</div>
            ) : null}
            <div className="mt-2 space-y-1" data-testid="timeline-script-file-list">
              {files.map((file) => (
                <button
                  key={file.path}
                  className={`w-full rounded-md px-2 py-2 text-left text-xs ${selectedId === file.id ? 'bg-white font-semibold text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
                  type="button"
                  data-testid="timeline-script-file-row"
                  onClick={() => onSelectFile(file)}
                >
                  <span className="block truncate">{file.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-normal text-slate-500">{file.path}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="block text-xs font-medium text-slate-600">
              {t.name}
              <input
                className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                value={name}
                data-testid="timeline-script-name-input"
                onChange={(event) => onNameChange(event.target.value)}
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                className="inline-flex h-9 items-center gap-1 rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-700 hover:bg-panel"
                type="button"
                data-testid="timeline-script-save-button"
                onClick={onSave}
              >
                <Save size={13} />
                {t.save}
              </button>
              <button
                className="inline-flex h-9 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!path}
                data-testid="timeline-script-delete-button"
                onClick={onDelete}
              >
                <Trash2 size={13} />
                {zhCN.common.delete}
              </button>
            </div>
          </div>

          <div className="rounded-md border border-line bg-panel p-2" data-testid="timeline-script-api-completions">
            <div className="flex flex-wrap gap-1.5">
              {apiNames.map((apiName) => (
                <button
                  key={apiName}
                  className="rounded-md border border-line bg-white px-2 py-1 font-mono text-[11px] text-slate-700 hover:bg-panel"
                  type="button"
                  data-testid={`timeline-script-api-${apiName}`}
                  onClick={() => appendCompletion(apiName)}
                >
                  {apiName}
                </button>
              ))}
            </div>
          </div>

          <textarea
            className="h-72 w-full resize-y rounded-md border border-line bg-[#0f172a] p-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-brand"
            value={code}
            spellCheck={false}
            data-testid="timeline-script-editor"
            data-editor="monaco-lite"
            onChange={(event) => onCodeChange(event.target.value)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 truncate text-xs text-slate-500" data-testid="timeline-script-path">
              {path ?? t.unsavedDraft}
            </div>
            <button
              className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={running || code.trim().length === 0}
              data-testid="timeline-script-run-button"
              onClick={onRun}
            >
              <Play size={14} />
              {running ? t.running : t.run}
            </button>
          </div>

          <div
            className={`min-h-24 rounded-md border p-3 font-mono text-xs ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-line bg-white text-slate-700'}`}
            data-testid="timeline-script-output"
          >
            {output.length > 0 ? (
              output.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
            ) : (
              <div className="font-sans text-slate-500">{t.outputEmpty}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function scriptApiSnippet(apiName: string): string {
  if (apiName === 'getClips') {
    return 'const clips = getClips();\n';
  }
  if (apiName === 'updateClip') {
    return 'updateClip("clip-id", { speed: 1.25 });\n';
  }
  if (apiName === 'addClip') {
    return 'addClip({ id: "clip-new", type: "video", name: "New Clip", mediaId: "asset-1", trackId: "track-video", start: 0, duration: 1, trimStart: 0, trimEnd: 0, speed: 1, colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 }, transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }, volume: 1 });\n';
  }
  if (apiName === 'deleteClip') {
    return 'deleteClip("clip-id");\n';
  }
  if (apiName === 'getMarkers') {
    return 'const markers = getMarkers();\n';
  }
  if (apiName === 'addMarker') {
    return 'addMarker(60, "Marker");\n';
  }
  if (apiName === 'exportProject') {
    return 'exportProject("h264-1080p");\n';
  }
  return `${apiName}();\n`;
}
