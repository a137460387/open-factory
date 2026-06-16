import { Check, Eye, FolderOpen, WandSparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ApplyStyleCommand,
  applyStyleToClip,
  calculateStyleSummary,
  deserializeProject,
  type Clip,
  type CutProjectFile,
  type Project,
  type StyleSummary,
  type StyleTransferScope
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { openFileDialog, readFile } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { commandManager, timelineAccessor } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';

interface StyleTransferDialogProps {
  project: Project;
  selectedClipId?: string | null;
  selectedClipIds: string[];
  onClose(): void;
}

const ALL_SOURCE_CLIPS = '__all__';

export default function StyleTransferDialog({ project, selectedClipId, selectedClipIds, onClose }: StyleTransferDialogProps) {
  const t = zhCN.styleTransfer;
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const [sourceProject, setSourceProject] = useState<Project>();
  const [sourceProjectName, setSourceProjectName] = useState(t.currentProject);
  const [sourceClipId, setSourceClipId] = useState<string>(ALL_SOURCE_CLIPS);
  const [targetClipId, setTargetClipId] = useState<string>(selectedClipId ?? selectedClipIds[0] ?? '');
  const [strength, setStrength] = useState(100);
  const [scope, setScope] = useState<StyleTransferScope>({ color: true, effects: true, lut: true });
  const [summary, setSummary] = useState<StyleSummary>();
  const [previewClip, setPreviewClip] = useState<Clip>();
  const activeSourceProject = sourceProject ?? project;
  const sourceClips = useMemo(() => collectProjectClips(activeSourceProject), [activeSourceProject]);
  const targetClips = useMemo(() => collectProjectClips(project), [project]);
  const activeTargetClip = targetClips.find((clip) => clip.id === targetClipId) ?? targetClips[0];
  const activeTargetClipId = activeTargetClip?.id ?? '';
  const activeSummary = summary;

  function buildSummary(): StyleSummary | undefined {
    const clips = sourceClipId === ALL_SOURCE_CLIPS ? sourceClips : sourceClips.filter((clip) => clip.id === sourceClipId);
    if (clips.length === 0) {
      showToast({ kind: 'warning', title: t.failedTitle, message: t.noSourceClips });
      return undefined;
    }
    const nextSummary = calculateStyleSummary(clips);
    setSummary(nextSummary);
    setPreviewClip(undefined);
    return nextSummary;
  }

  async function chooseSourceProject(): Promise<void> {
    try {
      const [path] = await openFileDialog(false, [{ name: zhCN.projectFiles.projectFilter, extensions: ['cutproj.json', 'json'] }]);
      if (!path) {
        return;
      }
      const contents = await readFile(path);
      const loaded = deserializeProject(JSON.parse(contents) as CutProjectFile, path);
      setSourceProject(loaded);
      setSourceProjectName(loaded.name);
      setSourceClipId(ALL_SOURCE_CLIPS);
      setSummary(undefined);
      setPreviewClip(undefined);
      showToast({ kind: 'success', title: t.sourceLoadedTitle, message: loaded.name });
    } catch (error) {
      showToast({ kind: 'warning', title: t.failedTitle, message: error instanceof Error ? error.message : t.failedMessage });
    }
  }

  function previewStyle(): void {
    const nextSummary = activeSummary ?? buildSummary();
    const target = activeTargetClip;
    if (!nextSummary || !target) {
      return;
    }
    setPreviewClip(applyStyleToClip(target, nextSummary, { strength, scope }));
  }

  function applyStyle(): void {
    const nextSummary = activeSummary ?? buildSummary();
    const target = activeTargetClip;
    if (!nextSummary || !target) {
      showToast({ kind: 'warning', title: t.failedTitle, message: t.noTargetClip });
      return;
    }
    try {
      commandManager.execute(new ApplyStyleCommand(timelineAccessor, nextSummary, { strength, scope, clipIds: [target.id] }));
      setSelectedClipIds([target.id]);
      showToast({ kind: 'success', title: t.appliedTitle, message: t.appliedMessage(target.name) });
      onClose();
    } catch (error) {
      showToast({ kind: 'warning', title: t.failedTitle, message: error instanceof Error ? error.message : t.failedMessage });
    }
  }

  function updateScope(key: keyof StyleTransferScope, value: boolean): void {
    setScope((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="style-transfer-dialog">
      <section className="grid max-h-[88vh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
            <p className="text-xs text-slate-500">{sourceProjectName}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-panel"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="style-transfer-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 overflow-auto p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-500">{t.source}</h3>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-2 rounded-md border border-line px-2 text-xs font-medium text-slate-700 hover:bg-panel"
                  data-testid="style-transfer-load-source-button"
                  onClick={() => void chooseSourceProject()}
                >
                  <FolderOpen size={14} />
                  {t.chooseSourceProject}
                </button>
              </div>
              <label className="block text-xs font-medium text-slate-600">
                {t.sourceClip}
                <select
                  className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm text-ink"
                  value={sourceClipId}
                  data-testid="style-transfer-source-clip-select"
                  onChange={(event) => {
                    setSourceClipId(event.target.value);
                    setSummary(undefined);
                    setPreviewClip(undefined);
                  }}
                >
                  <option value={ALL_SOURCE_CLIPS}>{t.allSourceClips}</option>
                  {sourceClips.map((clip) => (
                    <option key={clip.id} value={clip.id}>
                      {clip.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={sourceClips.length === 0}
                data-testid="style-transfer-extract-button"
                onClick={buildSummary}
              >
                <WandSparkles size={15} />
                {t.extract}
              </button>
              <div className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600" data-testid="style-transfer-summary">
                {summary ? t.summary(summary.clipCount, summary.effects.length, summary.lutPath ? 1 : 0) : t.noSummary}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-500">{t.target}</h3>
              <label className="block text-xs font-medium text-slate-600">
                {t.targetClip}
                <select
                  className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm text-ink"
                  value={activeTargetClipId}
                  data-testid="style-transfer-target-clip-select"
                  onChange={(event) => {
                    setTargetClipId(event.target.value);
                    setPreviewClip(undefined);
                  }}
                >
                  {targetClips.map((clip) => (
                    <option key={clip.id} value={clip.id}>
                      {clip.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                <span className="flex items-center justify-between">
                  <span>{t.strength}</span>
                  <span className="tabular-nums">{strength}%</span>
                </span>
                <input
                  className="mt-2 w-full accent-brand"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={strength}
                  data-testid="style-transfer-strength-slider"
                  onChange={(event) => {
                    setStrength(Number(event.target.value));
                    setPreviewClip(undefined);
                  }}
                />
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                <label className="flex items-center gap-2 rounded-md border border-line px-2 py-2">
                  <input type="checkbox" className="h-4 w-4 accent-brand" checked={scope.color} data-testid="style-transfer-color-checkbox" onChange={(event) => updateScope('color', event.target.checked)} />
                  {t.color}
                </label>
                <label className="flex items-center gap-2 rounded-md border border-line px-2 py-2">
                  <input type="checkbox" className="h-4 w-4 accent-brand" checked={scope.effects} data-testid="style-transfer-effects-checkbox" onChange={(event) => updateScope('effects', event.target.checked)} />
                  {t.effects}
                </label>
                <label className="flex items-center gap-2 rounded-md border border-line px-2 py-2">
                  <input type="checkbox" className="h-4 w-4 accent-brand" checked={scope.lut} data-testid="style-transfer-lut-checkbox" onChange={(event) => updateScope('lut', event.target.checked)} />
                  {t.lut}
                </label>
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!activeTargetClip}
                data-testid="style-transfer-preview-button"
                onClick={previewStyle}
              >
                <Eye size={15} />
                {t.preview}
              </button>
              <div className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600" data-testid="style-transfer-preview-result">
                {previewClip ? formatPreviewDelta(activeTargetClip, previewClip) : t.noPreview}
              </div>
            </section>
          </div>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" className="h-9 rounded-md border border-line px-3 text-sm text-slate-700 hover:bg-panel" data-testid="style-transfer-cancel-button" onClick={onClose}>
            {zhCN.common.cancel}
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-brand px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!activeTargetClip || sourceClips.length === 0}
            data-testid="style-transfer-apply-button"
            onClick={applyStyle}
          >
            <Check size={15} />
            {t.apply}
          </button>
        </footer>
      </section>
    </div>
  );
}

function collectProjectClips(project: Project): Clip[] {
  return project.timeline.tracks.flatMap((track) => track.clips);
}

function formatPreviewDelta(before: Clip | undefined, after: Clip): string {
  if (!before) {
    return after.name;
  }
  const delta = after.colorCorrection.brightness - before.colorCorrection.brightness;
  const saturation = after.colorCorrection.saturation - before.colorCorrection.saturation;
  return zhCN.styleTransfer.previewDelta(delta, saturation, after.effects?.length ?? 0);
}
