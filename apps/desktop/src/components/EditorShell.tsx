import { useCallback, useEffect, useMemo, useState } from 'react';
import { AddClipCommand, AddTrackCommand, DeleteClipsCommand, SplitClipCommand, getTimelineDuration } from '@open-factory/editor-core';
import { Toolbar } from './Toolbar';
import { AudioMixer } from './AudioMixer/AudioMixer';
import { ErrorBoundary } from './common/ErrorBoundary';
import { Inspector } from './Inspector/Inspector';
import { MediaBin } from './MediaBin/MediaBin';
import { PreviewCanvas } from './PreviewCanvas/PreviewCanvas';
import { Timeline } from './Timeline/Timeline';
import { ExportDialog } from '../export/ExportDialog';
import { useAutosave } from '../hooks/useAutosave';
import { useCloseGuard } from '../hooks/useCloseGuard';
import { useShortcuts } from '../hooks/useShortcuts';
import { cancelQueuedExportTask } from '../export/export-queue-runner';
import { useExportQueueStore } from '../export/export-queue-store';
import { revealExport } from '../lib/exportVideo';
import { clearMediaCache } from '../cache/cache-service';
import { createClipFromAsset, findPreferredTrack } from '../lib/clipFactory';
import { pickMediaPaths, probeMediaPaths } from '../lib/media';
import { buildSubtitleTrackFromSrt, isSubtitlePath, pickSubtitlePaths, readSubtitleText } from '../lib/subtitles';
import {
  chooseProjectSavePath,
  chooseProjectToOpen,
  confirmDiscardChanges,
  deleteAutosaveAfterSave,
  discardAutosaveRecovery,
  findStartupAutosaveRecovery,
  readAutosaveIntervalSeconds,
  readProjectFile,
  restoreAutosaveRecovery,
  writeAutosaveIntervalSeconds,
  writeProjectFile,
  type AutosaveRecoveryCandidate
} from '../lib/projectFiles';
import { showToast } from '../lib/toast';
import { createProxyForAsset } from '../media/proxy';
import { relinkMissingMediaInDirectory, relinkSingleMedia } from '../media/relink';
import { useBackgroundMediaJobs } from '../media/useBackgroundMediaJobs';
import { commandManager, timelineAccessor } from '../store/commandManager';
import { selectClipById, useEditorStore } from '../store/editorStore';

export function EditorShell() {
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const selectedKeyframe = useEditorStore((state) => state.selectedKeyframe);
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const dirty = useEditorStore((state) => state.dirty);
  const projectPath = useEditorStore((state) => state.projectPath);
  const setProject = useEditorStore((state) => state.setProject);
  const resetProject = useEditorStore((state) => state.resetProject);
  const setMedia = useEditorStore((state) => state.setMedia);
  const addMedia = useEditorStore((state) => state.addMedia);
  const setDirty = useEditorStore((state) => state.setDirty);
  const setProjectPath = useEditorStore((state) => state.setProjectPath);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const clearSelectedClipIds = useEditorStore((state) => state.clearSelectedClipIds);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const setPlaybackRate = useEditorStore((state) => state.setPlaybackRate);
  const setInPoint = useEditorStore((state) => state.setInPoint);
  const setOutPoint = useEditorStore((state) => state.setOutPoint);
  const [lastExportPath, setLastExportPath] = useState<string>();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [autosaveIntervalSeconds, setAutosaveIntervalSeconds] = useState(() => readAutosaveIntervalSeconds());
  const [recoveryCandidate, setRecoveryCandidate] = useState<AutosaveRecoveryCandidate>();

  const selectedClip = useMemo(() => selectClipById(project, selectedClipId), [project, selectedClipId]);
  const selectedClipLocked = useMemo(
    () => Boolean(selectedClip && project.timeline.tracks.find((track) => track.id === selectedClip.trackId)?.locked),
    [project.timeline.tracks, selectedClip]
  );

  const saveProject = useCallback(async () => {
    const nextPath = projectPath ?? (await chooseProjectSavePath(`${project.name}.cutproj.json`));
    if (!nextPath && !projectPath) {
      return;
    }
    const targetPath = nextPath ?? projectPath;
    if (!targetPath) {
      return;
    }
    await writeProjectFile(project, targetPath);
    await deleteAutosaveAfterSave(targetPath, projectPath);
    setProjectPath(targetPath);
    setDirty(false);
    showToast({ kind: 'success', title: 'Project saved' });
  }, [project, projectPath, setDirty, setProjectPath]);

  useEffect(() => {
    let canceled = false;
    void findStartupAutosaveRecovery()
      .then((candidate) => {
        if (!canceled && candidate) {
          setRecoveryCandidate(candidate);
        }
      })
      .catch((error) => {
        console.warn('Unable to check autosave recovery', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  const importMedia = useCallback(async () => {
    try {
      const paths = await pickMediaPaths();
      if (paths.length === 0) {
        return;
      }
      const result = await probeMediaPaths(paths, project.media);
      if (result.duplicateCount > 0) {
        showToast({ kind: 'info', title: 'Already exists', message: `${result.duplicateCount} duplicate file(s) were skipped.` });
      }
      if (result.media.length > 0) {
        addMedia(result.media);
        showToast({ kind: 'success', title: 'Media imported', message: `${result.media.length} file(s) added.` });
      }
    } catch (error) {
      showToast({ kind: 'error', title: 'Import failed', message: error instanceof Error ? error.message : 'Unable to import media.' });
    }
  }, [addMedia, project.media]);

  const importSubtitles = useCallback(async () => {
    try {
      const paths = await pickSubtitlePaths();
      await importSubtitlePaths(paths);
    } catch (error) {
      showToast({ kind: 'error', title: 'Subtitle import failed', message: error instanceof Error ? error.message : 'Unable to import subtitles.' });
    }
  }, [project.timeline]);

  const addAssetToTimeline = useCallback(
    (assetId: string) => {
      const asset = project.media.find((item) => item.id === assetId);
      const track = asset ? findPreferredTrack(project.timeline, asset) : undefined;
      if (!asset || !track) {
        showToast({ kind: 'error', title: 'No compatible track', message: 'Add a matching track before placing this asset.' });
        return;
      }
      try {
        const clip = createClipFromAsset(asset, track, project.timeline);
        commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        setSelectedClipId(clip.id);
      } catch (error) {
        showToast({ kind: 'error', title: 'Could not add clip', message: error instanceof Error ? error.message : 'Timeline rejected the clip.' });
      }
    },
    [project, setSelectedClipId]
  );

  const relinkMedia = useCallback(
    async (assetId: string) => {
      const asset = project.media.find((item) => item.id === assetId);
      if (!asset) {
        return;
      }
      try {
        const relinked = await relinkSingleMedia(asset);
        if (!relinked) {
          return;
        }
        setMedia(project.media.map((item) => (item.id === assetId ? relinked : item)));
        showToast({ kind: 'success', title: 'Media relinked', message: relinked.name });
      } catch (error) {
        showToast({ kind: 'error', title: 'Relink failed', message: error instanceof Error ? error.message : 'Unable to relink media.' });
      }
    },
    [project.media, setMedia]
  );

  const relinkAllMissing = useCallback(async () => {
    try {
      const result = await relinkMissingMediaInDirectory(project.media);
      setMedia(result.media);
      showToast({
        kind: result.relinkedCount > 0 ? 'success' : 'warning',
        title: 'Relink complete',
        message: `${result.relinkedCount} missing file(s) relinked.${result.warnings.length > 0 ? ` ${result.warnings.length} warning(s).` : ''}`
      });
    } catch (error) {
      showToast({ kind: 'error', title: 'Relink failed', message: error instanceof Error ? error.message : 'Unable to relink missing media.' });
    }
  }, [project.media, setMedia]);

  const newProject = useCallback(async () => {
    if (dirty && !(await confirmDiscardChanges())) {
      return;
    }
    commandManager.clear();
    resetProject();
  }, [dirty, resetProject]);

  const openProject = useCallback(async () => {
    try {
      if (dirty && !(await confirmDiscardChanges())) {
        return;
      }
      const path = await chooseProjectToOpen();
      if (!path) {
        return;
      }
      const nextProject = await readProjectFile(path);
      commandManager.clear();
      setProject(nextProject, path);
      showToast({ kind: 'success', title: 'Project opened' });
    } catch (error) {
      showToast({ kind: 'error', title: 'Open failed', message: error instanceof Error ? error.message : 'Unable to open project.' });
    }
  }, [dirty, setProject]);

  const splitSelected = useCallback(() => {
    if (!selectedClip) {
      return;
    }
    try {
      commandManager.execute(new SplitClipCommand(timelineAccessor, selectedClip.id, playheadTime));
    } catch (error) {
      showToast({ kind: 'warning', title: 'Split unavailable', message: error instanceof Error ? error.message : 'Move the playhead inside the clip.' });
    }
  }, [playheadTime, selectedClip]);

  const deleteSelected = useCallback(() => {
    const ids = useEditorStore.getState().selectedClipIds;
    if (ids.length === 0) {
      return;
    }
    commandManager.execute(new DeleteClipsCommand(timelineAccessor, ids));
    clearSelectedClipIds();
  }, [clearSelectedClipIds]);

  const cancelCurrentExport = useCallback(async () => {
    const runningTask = useExportQueueStore.getState().tasks.find((task) => task.status === 'running');
    if (runningTask) {
      await cancelQueuedExportTask(runningTask.id);
      showToast({ kind: 'info', title: 'Export canceled', message: runningTask.name });
    }
  }, []);

  const generateProxyForMedia = useCallback(
    async (assetId: string) => {
      const asset = useEditorStore.getState().project.media.find((item) => item.id === assetId);
      if (!asset || asset.type !== 'video') {
        return;
      }
      setMedia(useEditorStore.getState().project.media.map((item) => (item.id === assetId ? { ...item, proxyStatus: 'pending', proxyError: undefined } : item)));
      try {
        const proxyAsset = await createProxyForAsset({ ...asset, proxyStatus: 'pending', proxyError: undefined });
        setMedia(useEditorStore.getState().project.media.map((item) => (item.id === assetId ? proxyAsset : item)));
        showToast({ kind: 'success', title: 'Proxy ready', message: proxyAsset.name });
      } catch (error) {
        setMedia(
          useEditorStore
            .getState()
            .project.media.map((item) =>
              item.id === assetId
                ? { ...item, proxyStatus: 'error', proxyError: error instanceof Error ? error.message : 'Unable to generate proxy.' }
                : item
            )
        );
        showToast({ kind: 'error', title: 'Proxy failed', message: error instanceof Error ? error.message : 'Unable to generate proxy.' });
      }
    },
    [setMedia]
  );

  const clearCache = useCallback(async () => {
    try {
      await clearMediaCache();
      showToast({ kind: 'success', title: 'Cache cleared' });
    } catch (error) {
      showToast({ kind: 'error', title: 'Cache clear failed', message: error instanceof Error ? error.message : 'Unable to clear media cache.' });
    }
  }, []);

  const undo = useCallback(() => commandManager.undo(), []);
  const redo = useCallback(() => commandManager.redo(), []);
  const togglePlayback = useCallback(() => {
    if (getTimelineDuration(project.timeline) === 0) {
      return;
    }
    const isPlaying = useEditorStore.getState().isPlaying;
    if (!isPlaying) {
      setPlaybackRate(1);
    }
    setIsPlaying(!isPlaying);
  }, [project.timeline, setIsPlaying, setPlaybackRate]);
  const reversePlayback = useCallback(() => {
    if (getTimelineDuration(useEditorStore.getState().project.timeline) === 0) {
      return;
    }
    setPlaybackRate(-1);
    setIsPlaying(true);
  }, [setIsPlaying, setPlaybackRate]);
  const pausePlayback = useCallback(() => setIsPlaying(false), [setIsPlaying]);
  const forwardPlayback = useCallback(() => {
    if (getTimelineDuration(useEditorStore.getState().project.timeline) === 0) {
      return;
    }
    setPlaybackRate(1);
    setIsPlaying(true);
  }, [setIsPlaying, setPlaybackRate]);
  const stepFrame = useCallback(
    (direction: -1 | 1) => {
      const state = useEditorStore.getState();
      const fps = state.project.settings.fps || 30;
      setIsPlaying(false);
      setPlaybackRate(1);
      state.setPlayheadTime(state.playheadTime + direction / fps);
    },
    [setIsPlaying, setPlaybackRate]
  );

  const shortcutHandlers = useMemo(
    () => ({
      togglePlayback,
      reversePlayback,
      pausePlayback,
      forwardPlayback,
      stepBackwardFrame: () => stepFrame(-1),
      stepForwardFrame: () => stepFrame(1),
      setInPoint: () => setInPoint(useEditorStore.getState().playheadTime),
      setOutPoint: () => setOutPoint(useEditorStore.getState().playheadTime),
      deleteSelected,
      selectAll: () => setSelectedClipIds(useEditorStore.getState().project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.id))),
      clearSelection: clearSelectedClipIds,
      undo,
      redo,
      save: () => void saveProject()
    }),
    [clearSelectedClipIds, deleteSelected, forwardPlayback, pausePlayback, redo, reversePlayback, saveProject, setInPoint, setOutPoint, setSelectedClipIds, stepFrame, togglePlayback, undo]
  );

  useAutosave(autosaveIntervalSeconds);
  useCloseGuard(saveProject);
  useShortcuts(shortcutHandlers);
  useBackgroundMediaJobs(project.media);

  return (
    <ErrorBoundary name="Editor">
      <div className="grid h-full grid-rows-[auto_1fr_260px] bg-[#edeff3] text-ink">
        <Toolbar
          onNewProject={newProject}
          onOpenProject={openProject}
          onSaveProject={() => void saveProject()}
          onImportMedia={() => void importMedia()}
          onImportSubtitles={() => void importSubtitles()}
          onExportVideo={() => setExportDialogOpen(true)}
          onCancelExport={() => void cancelCurrentExport()}
          onSplitSelected={splitSelected}
          onUndo={undo}
          onRedo={redo}
          onClearCache={() => void clearCache()}
          autosaveIntervalSeconds={autosaveIntervalSeconds}
          onAutosaveIntervalSecondsChange={(seconds) => {
            setAutosaveIntervalSeconds(writeAutosaveIntervalSeconds(seconds));
          }}
          lastExportPath={lastExportPath}
          onRevealExport={lastExportPath ? () => void revealExport(lastExportPath) : undefined}
        />
        <main className="grid min-h-0 grid-cols-[280px_minmax(360px,1fr)_360px] gap-px bg-line">
          <MediaBin
            media={project.media}
            onImport={() => void importMedia()}
            onImportPaths={(paths) => void importDropped(paths)}
            onAddToTimeline={addAssetToTimeline}
            onRelink={(assetId) => void relinkMedia(assetId)}
            onRelinkAll={() => void relinkAllMissing()}
            onGenerateProxy={(assetId) => void generateProxyForMedia(assetId)}
          />
          <ErrorBoundary name="Preview">
            <PreviewCanvas />
          </ErrorBoundary>
          <aside className="grid min-h-0 grid-rows-[minmax(0,1fr)_220px] gap-px bg-line">
            <ErrorBoundary name="Inspector">
              <Inspector
                clip={selectedClip}
                selectedCount={selectedClipIds.length}
                selectedClipLocked={selectedClipLocked}
                selectedKeyframe={selectedKeyframe}
                media={project.media}
                playheadTime={playheadTime}
              />
            </ErrorBoundary>
            <ErrorBoundary name="Audio Mixer">
              <AudioMixer />
            </ErrorBoundary>
          </aside>
        </main>
        <ErrorBoundary name="Timeline">
          <Timeline />
        </ErrorBoundary>
        {exportDialogOpen ? (
          <ExportDialog
            project={project}
            onClose={() => setExportDialogOpen(false)}
            onCompleted={(path) => {
              setLastExportPath(path);
            }}
          />
        ) : null}
        {recoveryCandidate ? (
          <AutosaveRecoveryDialog
            onRestore={() => void restoreRecovery()}
            onDiscard={() => void discardRecovery()}
          />
        ) : null}
      </div>
    </ErrorBoundary>
  );

  async function restoreRecovery(): Promise<void> {
    if (!recoveryCandidate) {
      return;
    }
    try {
      const restored = await restoreAutosaveRecovery(recoveryCandidate);
      commandManager.clear();
      setProject(restored, recoveryCandidate.projectPath);
      setDirty(true);
      setRecoveryCandidate(undefined);
      showToast({ kind: 'success', title: 'Recovery restored', message: recoveryCandidate.autosavePath });
    } catch (error) {
      showToast({ kind: 'error', title: 'Recovery failed', message: error instanceof Error ? error.message : 'Unable to restore autosave.' });
    }
  }

  async function discardRecovery(): Promise<void> {
    if (!recoveryCandidate) {
      return;
    }
    try {
      await discardAutosaveRecovery(recoveryCandidate);
      setRecoveryCandidate(undefined);
      showToast({ kind: 'info', title: 'Recovery discarded' });
    } catch (error) {
      showToast({ kind: 'error', title: 'Discard failed', message: error instanceof Error ? error.message : 'Unable to discard autosave.' });
    }
  }

  async function importDropped(paths: string[]): Promise<void> {
    try {
      const subtitlePaths = paths.filter(isSubtitlePath);
      const mediaPaths = paths.filter((path) => !isSubtitlePath(path));
      if (mediaPaths.length > 0) {
        const result = await probeMediaPaths(mediaPaths, project.media);
        if (result.duplicateCount > 0) {
          showToast({ kind: 'info', title: 'Already exists', message: `${result.duplicateCount} duplicate file(s) were skipped.` });
        }
        addMedia(result.media);
      }
      if (subtitlePaths.length > 0) {
        await importSubtitlePaths(subtitlePaths);
      }
    } catch (error) {
      showToast({ kind: 'error', title: 'Drop import failed', message: error instanceof Error ? error.message : 'Unable to import dropped files.' });
    }
  }

  async function importSubtitlePaths(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    let importedCount = 0;
    for (const path of paths) {
      const contents = await readSubtitleText(path);
      const track = buildSubtitleTrackFromSrt(path, contents, useEditorStore.getState().project.timeline);
      if (track.clips.length === 0) {
        showToast({ kind: 'warning', title: 'No subtitles found', message: path });
        continue;
      }
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      importedCount += track.clips.length;
      setSelectedClipId(track.clips[0]?.id);
    }
    if (importedCount > 0) {
      showToast({ kind: 'success', title: 'Subtitles imported', message: `${importedCount} subtitle clip(s) added.` });
    }
  }
}

function AutosaveRecoveryDialog({ onRestore, onDiscard }: { onRestore(): void; onDiscard(): void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="autosave-recovery-dialog">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">检测到未保存的恢复点，是否恢复？</h2>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3">
          <button className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel" onClick={onDiscard} data-testid="autosave-discard-button">
            放弃
          </button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]" onClick={onRestore} data-testid="autosave-restore-button">
            恢复
          </button>
        </div>
      </section>
    </div>
  );
}
