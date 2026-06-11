import { useEffect, useMemo, useState } from 'react';
import { Star, X } from 'lucide-react';
import { UpdateClipCommand, type Clip, type Project, type Timeline } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { loadLutLibrary, toggleLutFavorite, type LutLibraryItem } from '../lib/lutLibrary';
import { showToast } from '../lib/toast';
import { writeCustomKeybindings } from '../shortcuts/keybindings';
import {
  TIMELINE_SHORTCUT_DEFINITIONS,
  detectTimelineShortcutConflicts,
  eventToAccelerator,
  getEffectiveTimelineShortcutBindings,
  type TimelineShortcutAction,
  type TimelineShortcutBindings
} from '../shortcuts/timeline-shortcuts';
import { commandManager, timelineAccessor } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';

interface SettingsDialogProps {
  open: boolean;
  project: Project;
  selectedClip?: Clip;
  shortcutBindings: TimelineShortcutBindings;
  onShortcutBindingsChange(bindings: TimelineShortcutBindings): void;
  onClose(): void;
}

type SettingsTab = 'lut-library' | 'shortcuts';

export function SettingsDialog({ open, project, selectedClip, shortcutBindings, onShortcutBindingsChange, onClose }: SettingsDialogProps) {
  const t = zhCN.settings;
  const setPreviewTimeline = useEditorStore((state) => state.setPreviewTimeline);
  const [tab, setTab] = useState<SettingsTab>('lut-library');
  const [items, setItems] = useState<LutLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [capturingAction, setCapturingAction] = useState<TimelineShortcutAction>();
  const selectedClipCanUseLut = selectedClip?.type === 'video' || selectedClip?.type === 'image';
  const effectiveBindings = useMemo(() => getEffectiveTimelineShortcutBindings(shortcutBindings), [shortcutBindings]);
  const conflicts = useMemo(() => detectTimelineShortcutConflicts(shortcutBindings), [shortcutBindings]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void refresh();
    return () => setPreviewTimeline(undefined);
  }, [open, setPreviewTimeline]);

  useEffect(() => {
    if (!capturingAction) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const accelerator = eventToAccelerator({
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey
      });
      event.preventDefault();
      event.stopPropagation();
      if (!accelerator) {
        return;
      }
      void updateShortcutBinding({ ...shortcutBindings, [capturingAction]: [accelerator] });
      setCapturingAction(undefined);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturingAction, shortcutBindings]);

  if (!open) {
    return null;
  }

  async function refresh() {
    try {
      setLoading(true);
      setError(undefined);
      setItems(await loadLutLibrary());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t.lutLibrary.loadFailedMessage;
      setError(message);
      showToast({ kind: 'warning', title: t.lutLibrary.loadFailed, message });
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setPreviewTimeline(undefined);
    onClose();
  }

  function preview(item: LutLibraryItem) {
    if (!selectedClipCanUseLut || !selectedClip) {
      showToast({ kind: 'warning', title: t.lutLibrary.noClipSelected, message: t.lutLibrary.noClipSelectedMessage });
      return;
    }
    setPreviewTimeline(buildPreviewTimelineWithLut(project.timeline, selectedClip.id, item.path));
  }

  function apply(item: LutLibraryItem) {
    if (!selectedClipCanUseLut || !selectedClip) {
      showToast({ kind: 'warning', title: t.lutLibrary.noClipSelected, message: t.lutLibrary.noClipSelectedMessage });
      return;
    }
    try {
      commandManager.execute(new UpdateClipCommand(timelineAccessor, selectedClip.id, { colorCorrection: { lutPath: item.path } }));
      setPreviewTimeline(undefined);
      showToast({ kind: 'success', title: t.lutLibrary.applied, message: item.name });
    } catch (applyError) {
      showToast({ kind: 'warning', title: t.lutLibrary.applyFailed, message: applyError instanceof Error ? applyError.message : t.lutLibrary.applyFailedMessage });
    }
  }

  async function toggleFavorite(item: LutLibraryItem) {
    try {
      const favorites = new Set(await toggleLutFavorite(item.path));
      setItems((current) => current.map((entry) => ({ ...entry, favorite: favorites.has(entry.path) })));
    } catch (favoriteError) {
      showToast({ kind: 'warning', title: t.lutLibrary.favoriteFailed, message: favoriteError instanceof Error ? favoriteError.message : t.lutLibrary.favoriteFailedMessage });
    }
  }

  async function updateShortcutBinding(nextBindings: TimelineShortcutBindings) {
    try {
      const saved = await writeCustomKeybindings(nextBindings);
      onShortcutBindingsChange(saved);
    } catch (shortcutError) {
      showToast({ kind: 'warning', title: t.shortcuts.saveFailed, message: shortcutError instanceof Error ? shortcutError.message : t.shortcuts.saveFailedMessage });
    }
  }

  function resetShortcut(action: TimelineShortcutAction) {
    const next = { ...shortcutBindings };
    delete next[action];
    void updateShortcutBinding(next);
  }

  function resetAllShortcuts() {
    void updateShortcutBinding({});
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="settings-dialog">
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <div className="text-xs text-slate-500">{t.subtitle}</div>
          </div>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel" type="button" title={zhCN.common.close} aria-label={zhCN.common.close} data-testid="settings-close-button" onClick={close}>
            <X size={16} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <nav className="w-44 shrink-0 border-r border-line bg-panel p-2">
            <button
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'lut-library' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-lut-library"
              onClick={() => setTab('lut-library')}
            >
              {t.tabs.lutLibrary}
            </button>
            <button
              className={`mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${tab === 'shortcuts' ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}
              type="button"
              data-testid="settings-tab-shortcuts"
              onClick={() => setTab('shortcuts')}
            >
              {t.tabs.shortcuts}
            </button>
          </nav>
          <main className="min-w-0 flex-1 overflow-y-auto p-4">
            {tab === 'lut-library' ? (
              <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">{t.lutLibrary.title}</h3>
                <p className="text-xs text-slate-500">{selectedClipCanUseLut ? t.lutLibrary.readyForClip(selectedClip?.name ?? '') : t.lutLibrary.noClipSelectedMessage}</p>
              </div>
              <button
                className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                type="button"
                onClick={() => void refresh()}
                data-testid="lut-library-refresh-button"
              >
                {t.lutLibrary.refresh}
              </button>
            </div>
            {loading ? <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.lutLibrary.loading}</div> : null}
            {error ? <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div> : null}
            {!loading && items.length === 0 ? <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.lutLibrary.empty}</div> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <div key={item.path} className="rounded-md border border-line bg-white p-3 shadow-sm" data-testid="lut-library-item">
                  <div className="flex items-start gap-3">
                    <div className="h-[54px] w-24 shrink-0 overflow-hidden rounded bg-slate-100">
                      {item.previewDataUrl ? <img className="h-full w-full object-cover" src={item.previewDataUrl} alt="" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink" title={item.path}>{item.name}</div>
                      <div className="truncate text-xs text-slate-500" title={item.path}>{item.path}</div>
                    </div>
                    <button
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line ${item.favorite ? 'bg-amber-50 text-amber-600' : 'bg-white text-slate-500'} hover:bg-panel`}
                      type="button"
                      title={item.favorite ? t.lutLibrary.unfavorite : t.lutLibrary.favorite}
                      aria-label={item.favorite ? t.lutLibrary.unfavorite : t.lutLibrary.favorite}
                      data-testid="lut-library-favorite-button"
                      onClick={() => void toggleFavorite(item)}
                    >
                      <Star size={15} fill={item.favorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      disabled={!selectedClipCanUseLut}
                      data-testid="lut-library-preview-button"
                      onClick={() => preview(item)}
                    >
                      {t.lutLibrary.preview}
                    </button>
                    <button
                      className="flex-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#176858] disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      disabled={!selectedClipCanUseLut}
                      data-testid="lut-library-apply-button"
                      onClick={() => apply(item)}
                    >
                      {t.lutLibrary.apply}
                    </button>
                  </div>
                </div>
              ))}
            </div>
              </>
            ) : (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{t.shortcuts.title}</h3>
                    <p className="text-xs text-slate-500">{t.shortcuts.description}</p>
                  </div>
                  <button className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel" type="button" onClick={resetAllShortcuts} data-testid="shortcuts-reset-all-button">
                    {t.shortcuts.resetAll}
                  </button>
                </div>
                <div className="space-y-2">
                  {TIMELINE_SHORTCUT_DEFINITIONS.map((definition) => {
                    const conflictList = conflicts[definition.action];
                    const hasConflict = conflictList.length > 0;
                    const label = t.shortcuts.actions[definition.action];
                    return (
                      <div
                        key={definition.action}
                        className={`rounded-md border p-3 ${hasConflict ? 'border-rose-300 bg-rose-50' : 'border-line bg-white'}`}
                        data-testid={`shortcut-row-${definition.action}`}
                        data-conflict={hasConflict ? 'true' : 'false'}
                      >
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-ink">{label}</div>
                            {hasConflict ? <div className="text-xs font-medium text-rose-700">{t.shortcuts.conflict(conflictList.join(', '))}</div> : null}
                          </div>
                          <button
                            className="min-w-28 rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-slate-700"
                            type="button"
                            data-testid={`shortcut-bind-${definition.action}`}
                            onClick={() => setCapturingAction(definition.action)}
                          >
                            {capturingAction === definition.action ? t.shortcuts.pressKeys : effectiveBindings[definition.action].join(' / ')}
                          </button>
                          <button
                            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                            type="button"
                            data-testid={`shortcut-reset-${definition.action}`}
                            onClick={() => resetShortcut(definition.action)}
                          >
                            {zhCN.common.reset}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function buildPreviewTimelineWithLut(timeline: Timeline, clipId: string, lutPath: string): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) =>
        clip.id === clipId
          ? {
              ...clip,
              colorCorrection: {
                ...clip.colorCorrection,
                lutPath
              }
            }
          : clip
      )
    }))
  };
}
