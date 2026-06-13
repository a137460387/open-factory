import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  AddAdjustmentLayerCommand,
  AddClipCommand,
  AddProjectAnnotationCommand,
  AddTrackCommand,
  AddTransitionCommand,
  CreateMulticamSequenceCommand,
  DEFAULT_PROJECT_ANNOTATION_COLOR,
  DeleteClipsCommand,
  ImportEDLCommand,
  LoadProjectCommand,
  MergeMediaCommand,
  NewProjectCommand,
  RemoveMediaCommand,
  RippleDeleteCommand,
  SplitClipCommand,
  UpdateClipCommand,
  createId,
  createProject,
  createTrack,
  buildVideoStitchSequence,
  dirname,
  getTimelineDuration,
  instantiateProjectTemplate,
  instantiateTitleTemplate,
  type DuplicateMediaGroup,
  type DuplicateMediaIssue,
  type MissingMediaIssue,
  type OrphanMediaIssue,
  type ProjectHealthReport,
  type Project,
  type ProjectTemplateId,
  type ProxyMissingIssue,
  type TitleTemplateId
} from '@open-factory/editor-core';
import { ChevronLeft, ChevronRight, GripHorizontal } from 'lucide-react';
import { Toolbar } from './Toolbar';
import { ErrorBoundary } from './common/ErrorBoundary';
import { MediaBin } from './MediaBin/MediaBin';
import { Timeline } from './Timeline/Timeline';
import { useAutosave } from '../hooks/useAutosave';
import { useCloseGuard } from '../hooks/useCloseGuard';
import { useMacroShortcuts } from '../hooks/useMacroShortcuts';
import { useShortcuts } from '../hooks/useShortcuts';
import { readCustomKeybindings } from '../shortcuts/keybindings';
import type { TimelineShortcutBindings } from '../shortcuts/timeline-shortcuts';
import { cancelQueuedExportTask } from '../export/export-queue-runner';
import { useExportQueueStore } from '../export/export-queue-store';
import { chooseCurrentFrameExportPath, revealExport, startCurrentFrameExport } from '../lib/exportVideo';
import { clearMediaCache } from '../cache/cache-service';
import { createAdjustmentLayerClip, createClipFromAsset, findPreferredTrack } from '../lib/clipFactory';
import { zhCN } from '../i18n/strings';
import {
  clampTimelineHeight,
  DEFAULT_EDITOR_LAYOUT_SETTINGS,
  getEffectivePanelState,
  type EditorLayoutSettings
} from '../layout/layoutSettings';
import type { ExportPreset } from '../export/export-presets';
import { pickMediaPaths, probeMediaPaths } from '../lib/media';
import { scanDuplicateMediaGroups } from '../lib/duplicateMedia';
import { buildSubtitleTrackFromSrt, isSubtitlePath, pickSubtitlePaths, readSubtitleText } from '../lib/subtitles';
import { createProjectArchivePlan, writeProjectArchive, type ArchiveProgress } from '../lib/projectArchive';
import { collectProjectArchivePreflight, saveOfflineMediaReport } from '../lib/mediaReport';
import { saveProjectSnapshot } from '../lib/projectSnapshots';
import { scanProjectHealth } from '../lib/projectHealth';
import { createSharePackageFromProject, type SharePackageWorkflowProgress } from '../lib/sharePackage';
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
import { bridgeConfirm, copyFile as bridgeCopyFile, openDirectoryDialog, writeFile as bridgeWriteFile } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import {
  appendMacroHistoryEntry,
  findMacroTargetClip,
  readClipMacros,
  readMacroHistory,
  type ClipMacro,
  type MacroHistoryEntry
} from '../macros/clip-macros';
import { readBackupSettings, readLayoutSettings, saveLayoutSettings } from '../settings/appSettings';
import { createProxyForAsset } from '../media/proxy';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import { DuplicateMediaDialog, type DuplicateMediaMergeSelection } from '../media/DuplicateMediaDialog';
import { useMediaJobStore } from '../media/media-job-store';
import { relinkMissingMediaInDirectory, relinkSingleMedia } from '../media/relink';
import { useBackgroundMediaJobs } from '../media/useBackgroundMediaJobs';
import { ProjectHealthDialog } from '../project-health/ProjectHealthDialog';
import { ProjectTemplateDialog } from '../project-templates/ProjectTemplateDialog';
import { commandManager, projectAccessor, timelineAccessor } from '../store/commandManager';
import { selectClipById, useEditorStore } from '../store/editorStore';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import type { VideoStitchWizardSettings } from '../video-stitching/VideoStitchWizardDialog';

const AudioMixer = lazy(() => import('./AudioMixer/AudioMixer').then((module) => ({ default: module.AudioMixer })));
const Inspector = lazy(() => import('./Inspector/Inspector').then((module) => ({ default: module.Inspector })));
const PreviewCanvas = lazy(() => import('./PreviewCanvas/PreviewCanvas').then((module) => ({ default: module.PreviewCanvas })));
const SmartRoughCutPanel = lazy(() => import('./SmartRoughCut/SmartRoughCutPanel').then((module) => ({ default: module.SmartRoughCutPanel })));
const HistoryPanel = lazy(() => import('./History/HistoryPanel').then((module) => ({ default: module.HistoryPanel })));
const ExportDialog = lazy(() => import('../export/ExportDialog').then((module) => ({ default: module.ExportDialog })));
const SettingsDialog = lazy(() => import('../settings/SettingsDialog').then((module) => ({ default: module.SettingsDialog })));
const MacroHistoryDialog = lazy(() => import('../macros/MacroHistoryDialog').then((module) => ({ default: module.MacroHistoryDialog })));
const TimelineExportDialog = lazy(() => import('../timeline-export/TimelineExportDialog').then((module) => ({ default: module.TimelineExportDialog })));
const BatchTranscodeDialog = lazy(() => import('../media/BatchTranscodeDialog').then((module) => ({ default: module.BatchTranscodeDialog })));
const VideoStitchWizardDialog = lazy(() => import('../video-stitching/VideoStitchWizardDialog').then((module) => ({ default: module.VideoStitchWizardDialog })));
const SnapshotNameDialog = lazy(() => import('../project-snapshots/SnapshotNameDialog').then((module) => ({ default: module.SnapshotNameDialog })));
const SnapshotHistoryDialog = lazy(() => import('../project-snapshots/SnapshotHistoryDialog').then((module) => ({ default: module.SnapshotHistoryDialog })));

export function EditorShell() {
  const project = useEditorStore((state) => state.project);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClipIds = useEditorStore((state) => state.selectedClipIds);
  const selectedKeyframe = useEditorStore((state) => state.selectedKeyframe);
  const playheadTime = useEditorStore((state) => state.playheadTime);
  const dirty = useEditorStore((state) => state.dirty);
  const projectPath = useEditorStore((state) => state.projectPath);
  const setProject = useEditorStore((state) => state.setProject);
  const setMedia = useEditorStore((state) => state.setMedia);
  const addMedia = useEditorStore((state) => state.addMedia);
  const proxySettings = useProxySettingsStore((state) => state.settings);
  const setMediaMetadata = useEditorStore((state) => state.setMediaMetadata);
  const setDirty = useEditorStore((state) => state.setDirty);
  const setProjectPath = useEditorStore((state) => state.setProjectPath);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const clearSelectedClipIds = useEditorStore((state) => state.clearSelectedClipIds);
  const setPlayheadTime = useEditorStore((state) => state.setPlayheadTime);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const setPlaybackRate = useEditorStore((state) => state.setPlaybackRate);
  const setInPoint = useEditorStore((state) => state.setInPoint);
  const setOutPoint = useEditorStore((state) => state.setOutPoint);
  const [lastExportPath, setLastExportPath] = useState<string>();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [timelineExportDialogOpen, setTimelineExportDialogOpen] = useState(false);
  const [batchTranscodeOpen, setBatchTranscodeOpen] = useState(false);
  const [batchTranscodeInitialPaths, setBatchTranscodeInitialPaths] = useState<string[]>([]);
  const [videoStitchWizardOpen, setVideoStitchWizardOpen] = useState(false);
  const [snapshotNameOpen, setSnapshotNameOpen] = useState(false);
  const [snapshotHistoryOpen, setSnapshotHistoryOpen] = useState(false);
  const [projectTemplateOpen, setProjectTemplateOpen] = useState(false);
  const [templateExportPreset, setTemplateExportPreset] = useState<ExportPreset>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [smartRoughCutOpen, setSmartRoughCutOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [macroHistoryOpen, setMacroHistoryOpen] = useState(false);
  const [projectHealthOpen, setProjectHealthOpen] = useState(false);
  const [projectHealthReport, setProjectHealthReport] = useState<ProjectHealthReport>();
  const [projectHealthScanning, setProjectHealthScanning] = useState(false);
  const [duplicateMediaGroups, setDuplicateMediaGroups] = useState<DuplicateMediaGroup[]>([]);
  const [duplicateMediaOpen, setDuplicateMediaOpen] = useState(false);
  const [shortcutBindings, setShortcutBindings] = useState<TimelineShortcutBindings>({});
  const [macros, setMacros] = useState<ClipMacro[]>([]);
  const [macroHistory, setMacroHistory] = useState<MacroHistoryEntry[]>([]);
  const [autosaveIntervalSeconds, setAutosaveIntervalSeconds] = useState(() => readAutosaveIntervalSeconds());
  const [recoveryCandidate, setRecoveryCandidate] = useState<AutosaveRecoveryCandidate>();
  const [archiveProgress, setArchiveProgress] = useState<ArchiveProgress>();
  const [sharePackageProgress, setSharePackageProgress] = useState<SharePackageWorkflowProgress>();
  const [sharePackageBusy, setSharePackageBusy] = useState(false);
  const [layoutSettings, setLayoutSettings] = useState<EditorLayoutSettings>(DEFAULT_EDITOR_LAYOUT_SETTINGS);
  const [viewportSize, setViewportSize] = useState(() => readViewportSize());
  const [lastBackupAt, setLastBackupAt] = useState<string>();

  const selectedClip = useMemo(() => selectClipById(project, selectedClipId), [project, selectedClipId]);
  const selectedClipLocked = useMemo(
    () => Boolean(selectedClip && project.timeline.tracks.find((track) => track.id === selectedClip.trackId)?.locked),
    [project.timeline.tracks, selectedClip]
  );
  const canCreateMulticamSequence = useMemo(() => {
    if (selectedClipIds.length < 2 || selectedClipIds.length > 8) {
      return false;
    }
    const selected = selectedClipIds
      .map((id) => project.timeline.tracks.flatMap((track) => track.clips.map((clip) => ({ clip, track }))).find((item) => item.clip.id === id))
      .filter(Boolean);
    return (
      selected.length === selectedClipIds.length &&
      selected.every((item) => item?.track.type === 'video' && (item.clip.type === 'video' || item.clip.type === 'image'))
    );
  }, [project.timeline.tracks, selectedClipIds]);
  const timelineHeightPx = clampTimelineHeight(layoutSettings.timelineHeightPx, viewportSize.height);
  const effectivePanels = useMemo(() => getEffectivePanelState(layoutSettings, viewportSize.width), [layoutSettings, viewportSize.width]);
  const editorGridRows = `auto minmax(0,1fr) 6px ${timelineHeightPx}px`;
  const mainGridColumns = `${effectivePanels.leftPanelCollapsed ? 48 : 280}px minmax(0,1fr) ${effectivePanels.rightPanelCollapsed ? 48 : 360}px`;

  const persistLayoutPatch = useCallback((patch: Partial<EditorLayoutSettings>) => {
    setLayoutSettings((current) => {
      const next = { ...current, ...patch };
      void saveLayoutSettings(next).catch((error) => {
        console.warn('Unable to save layout settings', error);
      });
      return next;
    });
  }, []);

  const beginTimelineResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = timelineHeightPx;
      let nextHeight = startHeight;
      const onPointerMove = (moveEvent: PointerEvent) => {
        nextHeight = clampTimelineHeight(startHeight + startY - moveEvent.clientY, readViewportSize().height);
        setLayoutSettings((current) => ({ ...current, timelineHeightPx: nextHeight }));
      };
      const finish = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        setLayoutSettings((current) => {
          const next = { ...current, timelineHeightPx: nextHeight };
          void saveLayoutSettings(next).catch((error) => {
            console.warn('Unable to save layout settings', error);
          });
          return next;
        });
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    },
    [timelineHeightPx]
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
    try {
      setLastBackupAt((await readBackupSettings()).lastBackupAt);
    } catch (error) {
      console.warn(zhCN.settings.backup.statusSaveFailed, error);
    }
    setProjectPath(targetPath);
    setDirty(false);
    showToast({ kind: 'success', title: zhCN.editorToasts.projectSaved });
  }, [project, projectPath, setDirty, setProjectPath]);

  const archiveCurrentProject = useCallback(async () => {
    try {
      const preflight = await collectProjectArchivePreflight(project);
      if (preflight.missingRows.length > 0) {
        const shouldContinue = await bridgeConfirm(zhCN.projectArchive.missingMediaConfirm(preflight.missingRows.length), {
          title: zhCN.projectArchive.title,
          kind: 'warning'
        });
        if (!shouldContinue) {
          return;
        }
      }
      const archiveParentDir = projectPath ? dirname(projectPath) : await openDirectoryDialog();
      if (!archiveParentDir) {
        return;
      }
      const plan = createProjectArchivePlan(project, archiveParentDir, { skipSourcePaths: preflight.missingPaths });
      setArchiveProgress({ copied: 0, total: plan.copyTasks.filter((task) => task.copyRequired).length });
      await writeProjectArchive(plan, { copyFile: bridgeCopyFile, writeFile: bridgeWriteFile }, setArchiveProgress);
      commandManager.clear();
      setProject(plan.project, plan.projectPath);
      setProjectPath(plan.projectPath);
      setDirty(false);
      showToast({ kind: 'success', title: zhCN.projectArchive.success, message: plan.projectPath });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.projectArchive.failed, message: error instanceof Error ? error.message : zhCN.projectArchive.failedMessage });
    } finally {
      setArchiveProgress(undefined);
    }
  }, [project, projectPath, setDirty, setProject, setProjectPath]);

  const createMediaReport = useCallback(async () => {
    try {
      const outputPath = await saveOfflineMediaReport(project);
      if (outputPath) {
        showToast({ kind: 'success', title: zhCN.mediaReport.success, message: outputPath });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.mediaReport.failed, message: error instanceof Error ? error.message : zhCN.mediaReport.failedMessage });
    }
  }, [project]);

  const createCurrentSharePackage = useCallback(async () => {
    if (sharePackageBusy) {
      return;
    }
    try {
      setSharePackageBusy(true);
      const result = await createSharePackageFromProject(project, { onProgress: setSharePackageProgress });
      if (result) {
        showToast({ kind: 'success', title: zhCN.sharePackage.success, message: result.outputPath });
        setLastExportPath(result.outputPath);
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.sharePackage.failed, message: error instanceof Error ? error.message : zhCN.sharePackage.failedMessage });
    } finally {
      setSharePackageProgress(undefined);
      setSharePackageBusy(false);
    }
  }, [project, sharePackageBusy]);

  useEffect(() => {
    let canceled = false;
    void findStartupAutosaveRecovery()
      .then((candidate) => {
        if (!canceled && candidate) {
          setRecoveryCandidate(candidate);
        }
      })
      .catch((error) => {
        console.warn(zhCN.editorToasts.autosaveCheckFailed, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readCustomKeybindings()
      .then((bindings) => {
        if (!canceled) {
          setShortcutBindings(bindings);
        }
      })
      .catch((error) => {
        console.warn(zhCN.settings.shortcuts.loadFailed, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readClipMacros()
      .then((entries) => {
        if (!canceled) {
          setMacros(entries);
        }
      })
      .catch((error) => {
        console.warn(zhCN.settings.macros.saveFailed, error);
      });
    void readMacroHistory()
      .then((entries) => {
        if (!canceled) {
          setMacroHistory(entries);
        }
      })
      .catch((error) => {
        console.warn(zhCN.macros.history.title, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readBackupSettings()
      .then((settings) => {
        if (!canceled) {
          setLastBackupAt(settings.lastBackupAt);
        }
      })
      .catch((error) => {
        console.warn(zhCN.settings.backup.statusSaveFailed, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readLayoutSettings()
      .then((settings) => {
        if (!canceled) {
          setLayoutSettings(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load layout settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const updateViewport = () => setViewportSize(readViewportSize());
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const importMedia = useCallback(async () => {
    try {
      const paths = await pickMediaPaths();
      if (paths.length === 0) {
        return;
      }
      const result = await probeMediaPaths(paths, project.media);
      if (result.duplicateCount > 0) {
        showToast({ kind: 'info', title: zhCN.editorToasts.duplicateTitle, message: zhCN.editorToasts.duplicateMessage(result.duplicateCount) });
      }
      if (result.media.length > 0) {
        addMedia(result.media);
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaImported, message: zhCN.editorToasts.mediaImportedMessage(result.media.length) });
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.importFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.importFailedMessage });
    }
  }, [addMedia, project.media]);

  const openBatchTranscode = useCallback((paths: string[] = []) => {
    setBatchTranscodeInitialPaths(paths);
    setBatchTranscodeOpen(true);
  }, []);

  const importVideosForStitchWizard = useCallback(async (): Promise<string[]> => {
    try {
      const paths = await pickMediaPaths();
      if (paths.length === 0) {
        return [];
      }
      const result = await probeMediaPaths(paths, useEditorStore.getState().project.media);
      if (result.media.length > 0) {
        addMedia(result.media);
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaImported, message: zhCN.editorToasts.mediaImportedMessage(result.media.length) });
      }
      if (result.duplicateCount > 0) {
        showToast({ kind: 'info', title: zhCN.editorToasts.duplicateTitle, message: zhCN.editorToasts.duplicateMessage(result.duplicateCount) });
      }
      return result.media.filter((asset) => asset.type === 'video').map((asset) => asset.id);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.videoStitchWizard.importFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.importFailedMessage });
      return [];
    }
  }, [addMedia]);

  const generateVideoStitchTimeline = useCallback(
    (settings: VideoStitchWizardSettings) => {
      try {
        const currentProject = useEditorStore.getState().project;
        const assets = settings.assetIds.flatMap((assetId) => {
          const asset = currentProject.media.find((item) => item.id === assetId && item.type === 'video');
          return asset ? [asset] : [];
        });
        if (assets.length < 2) {
          throw new Error(zhCN.videoStitchWizard.empty);
        }
        const track = createTrack({
          id: createId('track'),
          type: 'video',
          name: zhCN.videoStitchWizard.trackName,
          clips: []
        });
        const sequence = buildVideoStitchSequence(
          assets.map((asset) => ({ mediaId: asset.id, name: asset.name, duration: asset.duration || 5 })),
          {
            trackId: track.id,
            transitionEnabled: settings.transitionEnabled,
            transitionDuration: settings.transitionDuration
          }
        );
        commandManager.execute(new AddTrackCommand(timelineAccessor, track));
        for (const clip of sequence.clips) {
          commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        }
        for (const transition of sequence.transitions) {
          commandManager.execute(new AddTransitionCommand(timelineAccessor, transition));
        }
        setSelectedClipIds(sequence.clips.map((clip) => clip.id));
        setPlayheadTime(0);
        setTemplateExportPreset({
          id: 'video-stitch-wizard',
          name: zhCN.videoStitchWizard.exportPresetName,
          description: zhCN.videoStitchWizard.exportPresetDescription,
          builtin: true,
          settings: {
            width: settings.width,
            height: settings.height,
            fps: settings.fps,
            videoCodec: 'libx264',
            audioCodec: 'aac',
            format: 'mp4',
            outputMode: 'video',
            scaleMode: 'fit',
            targetAspectRatio: 'source',
            reframeOffsetX: 0,
            reframeOffsetY: 0,
            hardwareEncoding: false
          }
        });
        setVideoStitchWizardOpen(false);
        setExportDialogOpen(true);
        showToast({ kind: 'success', title: zhCN.videoStitchWizard.createdTitle, message: zhCN.videoStitchWizard.createdMessage(sequence.clips.length) });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.videoStitchWizard.generateFailed, message: error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage });
      }
    },
    [setPlayheadTime, setSelectedClipIds]
  );

  const saveNamedSnapshot = useCallback(
    async (name: string) => {
      try {
        const snapshot = await saveProjectSnapshot(project, name, projectPath);
        setSnapshotNameOpen(false);
        showToast({ kind: 'success', title: zhCN.projectSnapshots.saved, message: snapshot.name });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectSnapshots.saveFailed, message: error instanceof Error ? error.message : zhCN.projectSnapshots.saveFailed });
      }
    },
    [project, projectPath]
  );

  const restoreSnapshotProject = useCallback(
    (snapshotProject: Project) => {
      commandManager.execute(new LoadProjectCommand(projectAccessor, snapshotProject, zhCN.projectSnapshots.restoreCommand));
      clearSelectedClipIds();
      setPlayheadTime(0);
    },
    [clearSelectedClipIds, setPlayheadTime]
  );

  const scanDuplicateMedia = useCallback(async () => {
    try {
      const groups = await scanDuplicateMediaGroups(useEditorStore.getState().project.media);
      if (groups.length === 0) {
        showToast({ kind: 'info', title: zhCN.duplicateMedia.empty });
        return;
      }
      setDuplicateMediaGroups(groups);
      setDuplicateMediaOpen(true);
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.duplicateMedia.scanFailed,
        message: error instanceof Error ? error.message : zhCN.duplicateMedia.scanFailedMessage
      });
    }
  }, []);

  const mergeDuplicateMediaGroups = useCallback((selections: DuplicateMediaMergeSelection[]) => {
    try {
      for (const selection of selections) {
        commandManager.execute(new MergeMediaCommand(projectAccessor, selection.keepAssetId, selection.assetIds));
      }
      setDuplicateMediaOpen(false);
      setDuplicateMediaGroups([]);
      showToast({ kind: 'success', title: zhCN.duplicateMedia.mergedTitle, message: zhCN.duplicateMedia.mergedMessage(selections.length) });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
    }
  }, []);

  const importSubtitles = useCallback(async () => {
    try {
      const paths = await pickSubtitlePaths();
      await importSubtitlePaths(paths);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.subtitleImportFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.subtitleImportFailedMessage });
    }
  }, [project.timeline]);

  const addAssetToTimeline = useCallback(
    (assetId: string) => {
      const asset = project.media.find((item) => item.id === assetId);
      const track = asset ? findPreferredTrack(project.timeline, asset) : undefined;
      if (!asset || !track) {
        showToast({ kind: 'error', title: zhCN.editorToasts.noCompatibleTrack, message: zhCN.editorToasts.noCompatibleTrackMessage });
        return;
      }
      try {
        const clip = createClipFromAsset(asset, track, project.timeline);
        commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        setSelectedClipId(clip.id);
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
      }
    },
    [project, setSelectedClipId]
  );

  const addAdjustmentLayer = useCallback(() => {
    try {
      const adjustmentTrackCount = project.timeline.tracks.filter((track) => track.type === 'video' && track.clips.some((clip) => clip.type === 'adjustment')).length;
      const track = createTrack({
        id: createId('track'),
        type: 'video',
        name: zhCN.timeline.adjustmentTrackName(adjustmentTrackCount + 1),
        clips: []
      });
      const clip = createAdjustmentLayerClip(track, project.timeline);
      commandManager.execute(new AddAdjustmentLayerCommand(timelineAccessor, track, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
    }
  }, [project.timeline, setSelectedClipId]);

  const addTitleTemplate = useCallback(
    (templateId: TitleTemplateId) => {
      const track = project.timeline.tracks.find((item) => item.type === 'text');
      if (!track) {
        showToast({ kind: 'warning', title: zhCN.timeline.noTextTrackTitle, message: zhCN.timeline.noTextTrackMessage });
        return;
      }
      try {
        const label = zhCN.titleTemplates[templateId];
        const clip = instantiateTitleTemplate(templateId, track, project.timeline, {
          name: label.name,
          text: label.defaultText
        });
        commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        setSelectedClipId(clip.id);
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.addClipFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage });
      }
    },
    [project.timeline, setSelectedClipId]
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
        showToast({ kind: 'success', title: zhCN.editorToasts.mediaRelinked, message: relinked.name });
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.relinkFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.relinkFailedMessage });
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
        title: zhCN.editorToasts.relinkComplete,
        message: zhCN.editorToasts.relinkCompleteMessage(result.relinkedCount, result.warnings.length)
      });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.relinkFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.relinkMissingFailedMessage });
    }
  }, [project.media, setMedia]);

  const refreshProjectHealth = useCallback(async () => {
    try {
      setProjectHealthScanning(true);
      const state = useEditorStore.getState();
      setProjectHealthReport(await scanProjectHealth(state.project, useProxySettingsStore.getState().settings));
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.projectHealth.toasts.scanFailed,
        message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.scanFailedMessage
      });
    } finally {
      setProjectHealthScanning(false);
    }
  }, []);

  const openProjectHealth = useCallback(() => {
    setProjectHealthOpen(true);
    void refreshProjectHealth();
  }, [refreshProjectHealth]);

  const relinkMissingFromHealth = useCallback(
    async (issue: MissingMediaIssue) => {
      const state = useEditorStore.getState();
      const asset = state.project.media.find((item) => item.id === issue.assetId);
      if (!asset) {
        return;
      }
      try {
        const relinked = await relinkSingleMedia(asset);
        if (relinked) {
          const current = useEditorStore.getState();
          current.setMedia(current.project.media.map((item) => (item.id === issue.assetId ? relinked : item)));
          showToast({ kind: 'success', title: zhCN.editorToasts.mediaRelinked, message: relinked.name });
        }
        await refreshProjectHealth();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.editorToasts.relinkFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.relinkFailedMessage });
      }
    },
    [refreshProjectHealth]
  );

  const removeOrphanFromHealth = useCallback(
    async (issue: OrphanMediaIssue) => {
      try {
        commandManager.execute(new RemoveMediaCommand(projectAccessor, issue.assetId));
        showToast({ kind: 'success', title: zhCN.projectHealth.toasts.orphanRemoved, message: issue.name });
        await refreshProjectHealth();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshProjectHealth]
  );

  const mergeDuplicateFromHealth = useCallback(
    async (issue: DuplicateMediaIssue) => {
      try {
        commandManager.execute(new MergeMediaCommand(projectAccessor, issue.keepAssetId, issue.assets.map((asset) => asset.assetId)));
        showToast({ kind: 'success', title: zhCN.projectHealth.toasts.duplicateMerged });
        await refreshProjectHealth();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshProjectHealth]
  );

  const queueProxyFromHealth = useCallback(
    async (issue: ProxyMissingIssue) => {
      const asset = useEditorStore.getState().project.media.find((item) => item.id === issue.assetId);
      if (!asset) {
        return;
      }
      try {
        useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings);
        void ensureMediaJobRunner();
        showToast({ kind: 'success', title: zhCN.projectHealth.toasts.proxyQueued, message: issue.name });
        await refreshProjectHealth();
      } catch (error) {
        showToast({ kind: 'error', title: zhCN.projectHealth.toasts.fixFailed, message: error instanceof Error ? error.message : zhCN.projectHealth.toasts.fixFailedMessage });
      }
    },
    [refreshProjectHealth]
  );

  const executeNewProject = useCallback(
    (nextProject: ReturnType<typeof createProject>, nextTemplatePreset?: ExportPreset) => {
      commandManager.execute(
        new NewProjectCommand(
          {
            getProject: projectAccessor.getProject,
            setProject: (project) => setProject(project, undefined)
          },
          nextProject,
          zhCN.toolbar.newProject
        )
      );
      commandManager.clear();
      setProjectPath(undefined);
      setDirty(false);
      setTemplateExportPreset(nextTemplatePreset);
    },
    [setDirty, setProject, setProjectPath]
  );

  const newProject = useCallback(async () => {
    if (dirty && !(await confirmDiscardChanges())) {
      return;
    }
    executeNewProject(createProject(zhCN.project.defaultName));
  }, [dirty, executeNewProject]);

  const createProjectFromTemplate = useCallback(
    async (templateId: ProjectTemplateId) => {
      if (dirty && !(await confirmDiscardChanges())) {
        return;
      }
      const copy = projectTemplateCopy(templateId);
      const instance = instantiateProjectTemplate(templateId, { name: copy.name });
      executeNewProject(instance.project, {
        id: `template-${templateId}`,
        name: copy.name,
        description: copy.description,
        builtin: true,
        settings: instance.exportSettings
      });
      setProjectTemplateOpen(false);
    },
    [dirty, executeNewProject]
  );

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
      setTemplateExportPreset(undefined);
      showToast({ kind: 'success', title: zhCN.editorToasts.projectOpened });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.openFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.openFailedMessage });
    }
  }, [dirty, setProject]);

  const splitSelected = useCallback(() => {
    if (!selectedClip) {
      return;
    }
    try {
      commandManager.execute(new SplitClipCommand(timelineAccessor, selectedClip.id, playheadTime));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.splitUnavailable, message: error instanceof Error ? error.message : zhCN.editorToasts.splitUnavailableMessage });
    }
  }, [playheadTime, selectedClip]);

  const createMulticamSequence = useCallback(() => {
    try {
      const command = new CreateMulticamSequenceCommand(projectAccessor, selectedClipIds, zhCN.timeline.multicamSequenceName(project.sequences.length));
      commandManager.execute(command);
      if (command.multicamClipId) {
        setSelectedClipId(command.multicamClipId);
        setSelectedClipIds([command.multicamClipId]);
      }
      showToast({ kind: 'success', title: zhCN.editorToasts.multicamCreated });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.editorToasts.multicamCreateFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.multicamCreateFailedMessage });
    }
  }, [project.sequences.length, selectedClipIds, setSelectedClipId, setSelectedClipIds]);

  const importEdlTimeline = useCallback(
    (contents: string, path: string) => {
      const fileName = path.split(/[\\/]/).pop()?.replace(/\.edl$/i, '') || undefined;
      const command = new ImportEDLCommand(projectAccessor, contents, { sequenceName: fileName });
      commandManager.execute(command);
      clearSelectedClipIds();
      setPlayheadTime(0);
      const result = command.result;
      return {
        title: result?.title ?? fileName ?? zhCN.timelineExport.importEdl,
        matchedCount: result?.matchedCount ?? 0,
        missingCount: result?.missingCount ?? 0
      };
    },
    [clearSelectedClipIds, setPlayheadTime]
  );

  const deleteSelected = useCallback(() => {
    const ids = useEditorStore.getState().selectedClipIds;
    if (ids.length === 0) {
      return;
    }
    commandManager.execute(new DeleteClipsCommand(timelineAccessor, ids));
    clearSelectedClipIds();
  }, [clearSelectedClipIds]);

  const rippleDeleteSelected = useCallback(() => {
    const ids = useEditorStore.getState().selectedClipIds;
    if (ids.length === 0) {
      return;
    }
    commandManager.execute(new RippleDeleteCommand(timelineAccessor, ids));
    clearSelectedClipIds();
  }, [clearSelectedClipIds]);

  const cancelCurrentExport = useCallback(async () => {
    const runningTask = useExportQueueStore.getState().tasks.find((task) => task.status === 'running');
    if (runningTask) {
      await cancelQueuedExportTask(runningTask.id);
      showToast({ kind: 'info', title: zhCN.editorToasts.exportCanceled, message: runningTask.name });
    }
  }, []);

  const exportCurrentFrame = useCallback(async () => {
    const state = useEditorStore.getState();
    try {
      const outputPath = await chooseCurrentFrameExportPath(state.project, state.playheadTime);
      if (!outputPath) {
        return;
      }
      await startCurrentFrameExport(state.project, outputPath, state.playheadTime, {
        onProgress: () => undefined,
        onWarnings: (warnings) => {
          if (warnings.length > 0) {
            showToast({ kind: 'warning', title: zhCN.exportDialog.exportWarningTitle, message: warnings.join('\n') });
          }
        }
      });
      setLastExportPath(outputPath);
      showToast({ kind: 'success', title: zhCN.editorToasts.currentFrameExported, message: outputPath });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.editorToasts.currentFrameExportFailed,
        message: error instanceof Error ? error.message : zhCN.editorToasts.currentFrameExportFailedMessage
      });
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
        const proxyAsset = await createProxyForAsset({ ...asset, proxyStatus: 'pending', proxyError: undefined }, proxySettings);
        setMedia(useEditorStore.getState().project.media.map((item) => (item.id === assetId ? proxyAsset : item)));
        showToast({ kind: 'success', title: zhCN.editorToasts.proxyReady, message: proxyAsset.name });
      } catch (error) {
        setMedia(
          useEditorStore
            .getState()
            .project.media.map((item) =>
              item.id === assetId
                ? { ...item, proxyStatus: 'error', proxyError: error instanceof Error ? error.message : zhCN.editorToasts.proxyFailedMessage }
                : item
            )
        );
        showToast({ kind: 'error', title: zhCN.editorToasts.proxyFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.proxyFailedMessage });
      }
    },
    [proxySettings, setMedia]
  );

  const clearCache = useCallback(async () => {
    try {
      await clearMediaCache();
      showToast({ kind: 'success', title: zhCN.editorToasts.cacheCleared });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.cacheClearFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.cacheClearFailedMessage });
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

  const addAnnotationAtPlayhead = useCallback(() => {
    const state = useEditorStore.getState();
    try {
      commandManager.execute(
        new AddProjectAnnotationCommand(projectAccessor, {
          time: state.playheadTime,
          text: zhCN.timeline.annotationLabel((state.project.annotations?.length ?? 0) + 1),
          color: DEFAULT_PROJECT_ANNOTATION_COLOR
        })
      );
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.timeline.annotationRejectedTitle, message: error instanceof Error ? error.message : zhCN.timeline.addAnnotationFailed });
    }
  }, []);

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
      rippleDeleteSelected,
      splitSelected,
      selectAll: () => setSelectedClipIds(useEditorStore.getState().project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.id))),
      clearSelection: clearSelectedClipIds,
      addAnnotation: addAnnotationAtPlayhead,
      undo,
      redo,
      save: () => void saveProject(),
      exportCurrentFrame: () => void exportCurrentFrame()
    }),
    [
      addAnnotationAtPlayhead,
      clearSelectedClipIds,
      deleteSelected,
      exportCurrentFrame,
      forwardPlayback,
      pausePlayback,
      redo,
      reversePlayback,
      rippleDeleteSelected,
      saveProject,
      setInPoint,
      setOutPoint,
      setSelectedClipIds,
      splitSelected,
      stepFrame,
      togglePlayback,
      undo
    ]
  );

  const recordMacroHistory = useCallback(async (entry: MacroHistoryEntry) => {
    try {
      setMacroHistory(await appendMacroHistoryEntry(entry));
    } catch (error) {
      console.warn(zhCN.macros.history.title, error);
    }
  }, []);

  const executeMacro = useCallback(
    async (macro: ClipMacro) => {
      const state = useEditorStore.getState();
      const target = findMacroTargetClip(state.project.timeline, state.selectedClipIds, state.playheadTime);
      const baseEntry = {
        id: createId('macro-history'),
        macroId: macro.id,
        macroName: macro.name,
        triggeredAt: new Date().toISOString(),
        shortcut: macro.shortcut
      };
      if (!target) {
        await recordMacroHistory({
          ...baseEntry,
          success: false,
          error: zhCN.settings.macros.noTargetClip
        });
        showToast({ kind: 'warning', title: zhCN.settings.macros.noTargetClip, message: zhCN.settings.macros.noTargetClipMessage });
        return;
      }
      try {
        commandManager.execute(new UpdateClipCommand(timelineAccessor, target.id, macro.patch));
        setSelectedClipId(target.id);
        await recordMacroHistory({
          ...baseEntry,
          targetClipId: target.id,
          targetClipName: target.name,
          success: true
        });
        showToast({ kind: 'success', title: zhCN.settings.macros.executed, message: `${macro.name} · ${target.name}` });
      } catch (error) {
        const message = error instanceof Error ? error.message : zhCN.settings.macros.executeFailed;
        await recordMacroHistory({
          ...baseEntry,
          targetClipId: target.id,
          targetClipName: target.name,
          success: false,
          error: message
        });
        showToast({ kind: 'warning', title: zhCN.settings.macros.executeFailed, message });
      }
    },
    [recordMacroHistory, setSelectedClipId]
  );

  useAutosave(autosaveIntervalSeconds);
  useCloseGuard(saveProject);
  useShortcuts(shortcutHandlers, shortcutBindings);
  useMacroShortcuts(macros, executeMacro);
  useBackgroundMediaJobs(project.media);

  return (
    <ErrorBoundary name={zhCN.panels.editor}>
      <div className="grid h-full min-w-0 overflow-hidden bg-[#edeff3] text-ink" style={{ gridTemplateRows: editorGridRows }} data-testid="editor-shell">
        <Toolbar
          onNewProject={newProject}
          onNewFromTemplate={() => setProjectTemplateOpen(true)}
          onOpenProject={openProject}
          onSaveProject={() => void saveProject()}
          onArchiveProject={() => void archiveCurrentProject()}
          onCreateMediaReport={() => void createMediaReport()}
          onCreateSharePackage={() => void createCurrentSharePackage()}
          onSaveSnapshot={() => setSnapshotNameOpen(true)}
          onOpenSnapshotHistory={() => setSnapshotHistoryOpen(true)}
          onImportMedia={() => void importMedia()}
          onBatchTranscode={() => openBatchTranscode()}
          onOpenVideoStitchWizard={() => setVideoStitchWizardOpen(true)}
          onOpenMacroHistory={() => setMacroHistoryOpen(true)}
          onImportSubtitles={() => void importSubtitles()}
          onExportVideo={() => setExportDialogOpen(true)}
          onExportTimeline={() => setTimelineExportDialogOpen(true)}
          onExportCurrentFrame={() => void exportCurrentFrame()}
          onCancelExport={() => void cancelCurrentExport()}
          onSplitSelected={splitSelected}
          onToggleSmartRoughCut={() => {
            setHistoryPanelOpen(false);
            setSmartRoughCutOpen((open) => !open);
          }}
          onCreateMulticamSequence={createMulticamSequence}
          canCreateMulticamSequence={canCreateMulticamSequence}
          smartRoughCutOpen={smartRoughCutOpen}
          historyPanelOpen={historyPanelOpen}
          onToggleHistoryPanel={() => {
            setSmartRoughCutOpen(false);
            setHistoryPanelOpen((open) => !open);
          }}
          onUndo={undo}
          onRedo={redo}
          onClearCache={() => void clearCache()}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenProjectHealth={openProjectHealth}
          sharePackageBusy={sharePackageBusy}
          autosaveIntervalSeconds={autosaveIntervalSeconds}
          onAutosaveIntervalSecondsChange={(seconds) => {
            setAutosaveIntervalSeconds(writeAutosaveIntervalSeconds(seconds));
          }}
          lastExportPath={lastExportPath}
          onRevealExport={lastExportPath ? () => void revealExport(lastExportPath) : undefined}
          lastBackupAt={lastBackupAt}
        />
        <main
          className="grid min-h-0 min-w-0 gap-px bg-line"
          style={{ gridTemplateColumns: mainGridColumns }}
          data-testid="editor-main-layout"
          data-left-collapsed={effectivePanels.leftPanelCollapsed ? 'true' : 'false'}
          data-right-collapsed={effectivePanels.rightPanelCollapsed ? 'true' : 'false'}
          data-right-auto-collapsed={effectivePanels.rightPanelAutoCollapsed ? 'true' : 'false'}
        >
          {effectivePanels.leftPanelCollapsed ? (
            <CollapsedPanelRail
              side="left"
              label={zhCN.layout.mediaPanelCollapsed}
              title={zhCN.layout.expandMediaPanel}
              testId="left-panel-expand-button"
              onClick={() => persistLayoutPatch({ leftPanelCollapsed: false })}
            />
          ) : (
            <section className="relative h-full min-h-0 min-w-0 overflow-hidden" data-testid="left-panel" data-collapsed="false">
              <button
                className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white/95 text-slate-600 shadow-sm hover:bg-panel"
                type="button"
                title={zhCN.layout.collapseMediaPanel}
                aria-label={zhCN.layout.collapseMediaPanel}
                data-testid="left-panel-collapse-button"
                onClick={() => persistLayoutPatch({ leftPanelCollapsed: true })}
              >
                <ChevronLeft size={16} />
              </button>
              <MediaBin
                media={project.media}
                mediaMetadata={project.mediaMetadata}
                onImport={() => void importMedia()}
                onImportPaths={(paths) => void importDropped(paths)}
                onBatchTranscode={(paths) => openBatchTranscode(paths)}
                onScanDuplicates={() => void scanDuplicateMedia()}
                onAddToTimeline={addAssetToTimeline}
                onAddAdjustmentLayer={addAdjustmentLayer}
                onRelink={(assetId) => void relinkMedia(assetId)}
                onRelinkAll={() => void relinkAllMissing()}
                onGenerateProxy={(assetId) => void generateProxyForMedia(assetId)}
                onSetLabel={(assetId, labelColor) => setMediaMetadata(assetId, labelColor ? { labelColor } : undefined)}
                onAddTitleTemplate={addTitleTemplate}
              />
            </section>
          )}
          <ErrorBoundary name={zhCN.panels.preview}>
            <Suspense fallback={<PanelLoading label={zhCN.panels.preview} />}>
              <PreviewCanvas />
            </Suspense>
          </ErrorBoundary>
          {effectivePanels.rightPanelCollapsed ? (
            <CollapsedPanelRail
              side="right"
              label={zhCN.layout.inspectorPanelCollapsed}
              title={zhCN.layout.expandInspectorPanel}
              testId="right-panel-expand-button"
              onClick={() => persistLayoutPatch({ rightPanelCollapsed: false })}
            />
          ) : (
            <aside className="relative grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_220px] gap-px bg-line" data-testid="right-panel" data-collapsed="false">
              <button
                className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white/95 text-slate-600 shadow-sm hover:bg-panel"
                type="button"
                title={zhCN.layout.collapseInspectorPanel}
                aria-label={zhCN.layout.collapseInspectorPanel}
                data-testid="right-panel-collapse-button"
                onClick={() => persistLayoutPatch({ rightPanelCollapsed: true })}
              >
                <ChevronRight size={16} />
              </button>
              <ErrorBoundary name={historyPanelOpen ? zhCN.panels.history : smartRoughCutOpen ? zhCN.panels.smartRoughCut : zhCN.panels.inspector}>
                <Suspense fallback={<PanelLoading label={historyPanelOpen ? zhCN.panels.history : smartRoughCutOpen ? zhCN.panels.smartRoughCut : zhCN.panels.inspector} />}>
                  {historyPanelOpen ? (
                    <HistoryPanel />
                  ) : smartRoughCutOpen ? (
                    <SmartRoughCutPanel selectedClip={selectedClip} media={project.media} />
                  ) : (
                    <Inspector
                      clip={selectedClip}
                      selectedCount={selectedClipIds.length}
                      selectedClipLocked={selectedClipLocked}
                      selectedKeyframe={selectedKeyframe}
                      media={project.media}
                      playheadTime={playheadTime}
                    />
                  )}
                </Suspense>
              </ErrorBoundary>
              <ErrorBoundary name={zhCN.panels.audioMixer}>
                <Suspense fallback={<PanelLoading label={zhCN.panels.audioMixer} compact />}>
                  <AudioMixer />
                </Suspense>
              </ErrorBoundary>
            </aside>
          )}
        </main>
        <div
          className="flex cursor-row-resize items-center justify-center bg-line text-slate-500 transition hover:bg-brand/20 hover:text-brand"
          role="separator"
          aria-orientation="horizontal"
          aria-label={zhCN.layout.resizeTimeline}
          data-testid="timeline-resize-handle"
          onPointerDown={beginTimelineResize}
        >
          <GripHorizontal size={18} />
        </div>
        <section className="min-h-0 overflow-hidden" data-testid="timeline-panel" style={{ height: timelineHeightPx }}>
          <ErrorBoundary name={zhCN.panels.timeline}>
            <Timeline />
          </ErrorBoundary>
        </section>
        <Suspense fallback={null}>
          {exportDialogOpen ? (
            <ExportDialog
              project={project}
              initialPreset={templateExportPreset}
              onClose={() => setExportDialogOpen(false)}
              onCompleted={(path) => {
                setLastExportPath(path);
              }}
              onRelinkMissing={() => void relinkAllMissing()}
            />
          ) : null}
          {projectTemplateOpen ? <ProjectTemplateDialog onSelect={(templateId) => void createProjectFromTemplate(templateId)} onClose={() => setProjectTemplateOpen(false)} /> : null}
          {timelineExportDialogOpen ? <TimelineExportDialog project={project} onClose={() => setTimelineExportDialogOpen(false)} onImportEdl={importEdlTimeline} /> : null}
          {snapshotNameOpen ? <SnapshotNameDialog defaultName={project.name} onConfirm={(name) => void saveNamedSnapshot(name)} onClose={() => setSnapshotNameOpen(false)} /> : null}
          {snapshotHistoryOpen ? (
            <SnapshotHistoryDialog projectId={project.id} projectPath={projectPath} onRestore={restoreSnapshotProject} onClose={() => setSnapshotHistoryOpen(false)} />
          ) : null}
          {batchTranscodeOpen ? (
            <BatchTranscodeDialog
              initialPaths={batchTranscodeInitialPaths}
              existingMedia={project.media}
              onImport={addMedia}
              onClose={() => {
                setBatchTranscodeOpen(false);
                setBatchTranscodeInitialPaths([]);
              }}
            />
          ) : null}
          {videoStitchWizardOpen ? (
            <VideoStitchWizardDialog
              media={project.media}
              projectSettings={project.settings}
              onImportVideos={importVideosForStitchWizard}
              onGenerate={generateVideoStitchTimeline}
              onClose={() => setVideoStitchWizardOpen(false)}
            />
          ) : null}
          {settingsOpen ? (
            <SettingsDialog
              open={settingsOpen}
              project={project}
              selectedClip={selectedClip}
              shortcutBindings={shortcutBindings}
              macros={macros}
              onShortcutBindingsChange={setShortcutBindings}
              onMacrosChange={setMacros}
              onClose={() => setSettingsOpen(false)}
            />
          ) : null}
          {macroHistoryOpen ? <MacroHistoryDialog entries={macroHistory} onClose={() => setMacroHistoryOpen(false)} /> : null}
        </Suspense>
        {projectHealthOpen ? (
          <ProjectHealthDialog
            report={projectHealthReport}
            scanning={projectHealthScanning}
            onClose={() => setProjectHealthOpen(false)}
            onRescan={() => void refreshProjectHealth()}
            onRelink={(issue) => void relinkMissingFromHealth(issue)}
            onRemoveOrphan={(issue) => void removeOrphanFromHealth(issue)}
            onMergeDuplicate={(issue) => void mergeDuplicateFromHealth(issue)}
            onQueueProxy={(issue) => void queueProxyFromHealth(issue)}
          />
        ) : null}
        {duplicateMediaOpen ? (
          <DuplicateMediaDialog
            groups={duplicateMediaGroups}
            onConfirm={mergeDuplicateMediaGroups}
            onClose={() => setDuplicateMediaOpen(false)}
          />
        ) : null}
        {recoveryCandidate ? (
          <AutosaveRecoveryDialog
            onRestore={() => void restoreRecovery()}
            onDiscard={() => void discardRecovery()}
          />
        ) : null}
        {archiveProgress ? <ArchiveProgressDialog progress={archiveProgress} /> : null}
        {sharePackageProgress ? <SharePackageProgressDialog progress={sharePackageProgress} /> : null}
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
      showToast({ kind: 'success', title: zhCN.editorToasts.recoveryRestored, message: recoveryCandidate.autosavePath });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.recoveryFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.recoveryFailedMessage });
    }
  }

  async function discardRecovery(): Promise<void> {
    if (!recoveryCandidate) {
      return;
    }
    try {
      await discardAutosaveRecovery(recoveryCandidate);
      setRecoveryCandidate(undefined);
      showToast({ kind: 'info', title: zhCN.editorToasts.recoveryDiscarded });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.discardFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.discardFailedMessage });
    }
  }

  async function importDropped(paths: string[]): Promise<void> {
    try {
      const subtitlePaths = paths.filter(isSubtitlePath);
      const mediaPaths = paths.filter((path) => !isSubtitlePath(path));
      if (mediaPaths.length > 0) {
        const result = await probeMediaPaths(mediaPaths, project.media);
        if (result.duplicateCount > 0) {
          showToast({ kind: 'info', title: zhCN.editorToasts.duplicateTitle, message: zhCN.editorToasts.duplicateMessage(result.duplicateCount) });
        }
        addMedia(result.media);
      }
      if (subtitlePaths.length > 0) {
        await importSubtitlePaths(subtitlePaths);
      }
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.editorToasts.dropImportFailed, message: error instanceof Error ? error.message : zhCN.editorToasts.dropImportFailedMessage });
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
        showToast({ kind: 'warning', title: zhCN.editorToasts.noSubtitlesFound, message: path });
        continue;
      }
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      importedCount += track.clips.length;
      setSelectedClipId(track.clips[0]?.id);
    }
    if (importedCount > 0) {
      showToast({ kind: 'success', title: zhCN.editorToasts.subtitlesImported, message: zhCN.editorToasts.subtitlesImportedMessage(importedCount) });
    }
  }
}

function PanelLoading({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`flex min-h-0 items-center justify-center bg-white text-xs text-slate-500 ${compact ? 'h-full' : 'h-full p-4'}`} data-testid="lazy-panel-loading">
      {label}
    </div>
  );
}

function CollapsedPanelRail({
  side,
  label,
  title,
  testId,
  onClick
}: {
  side: 'left' | 'right';
  label: string;
  title: string;
  testId: string;
  onClick(): void;
}) {
  const Icon = side === 'left' ? ChevronRight : ChevronLeft;
  return (
    <aside className="flex min-h-0 min-w-0 flex-col items-center gap-3 bg-white px-1.5 py-2" data-testid={`${side}-panel`} data-collapsed="true">
      <button
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-panel text-slate-600 hover:bg-white"
        type="button"
        title={title}
        aria-label={title}
        data-testid={testId}
        onClick={onClick}
      >
        <Icon size={16} />
      </button>
      <div className="text-[11px] font-semibold text-slate-500" style={{ writingMode: 'vertical-rl' }}>
        {label}
      </div>
    </aside>
  );
}

function readViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 900 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

function AutosaveRecoveryDialog({ onRestore, onDiscard }: { onRestore(): void; onDiscard(): void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="autosave-recovery-dialog">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.autosaveRecovery.title}</h2>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3">
          <button className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel" onClick={onDiscard} data-testid="autosave-discard-button">
            {zhCN.autosaveRecovery.discard}
          </button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]" onClick={onRestore} data-testid="autosave-restore-button">
            {zhCN.autosaveRecovery.restore}
          </button>
        </div>
      </section>
    </div>
  );
}

function ArchiveProgressDialog({ progress }: { progress: ArchiveProgress }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="archive-progress-dialog">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.projectArchive.title}</h2>
        </div>
        <div className="space-y-2 px-4 py-3">
          <div className="text-sm font-medium text-ink" data-testid="archive-progress-message">
            {zhCN.projectArchive.copying(progress.copied, progress.total)}
          </div>
          <div className="h-2 overflow-hidden rounded bg-panel">
            <div
              className="h-full bg-brand transition-[width]"
              style={{ width: `${progress.total > 0 ? Math.round((progress.copied / progress.total) * 100) : 100}%` }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function SharePackageProgressDialog({ progress }: { progress: SharePackageWorkflowProgress }) {
  const label = progress.stage === 'exporting' ? zhCN.sharePackage.exporting : zhCN.sharePackage.packing(progress.current, progress.total);
  const percent = progress.total > 0 ? Math.round(progress.progress * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="share-package-progress-dialog">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.sharePackage.title}</h2>
        </div>
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm font-medium text-ink">
            <span data-testid="share-package-progress-message">{label}</span>
            <span className="tabular-nums text-slate-500">{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-panel">
            <div className="h-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </section>
    </div>
  );
}

function projectTemplateCopy(templateId: ProjectTemplateId): { name: string; description: string } {
  const templates = zhCN.projectTemplates.templates;
  switch (templateId) {
    case 'vertical-short':
      return templates.verticalShort;
    case 'youtube-horizontal':
      return templates.youtubeHorizontal;
    case 'square-social':
      return templates.squareSocial;
    case 'podcast':
      return templates.podcast;
    case 'cinema':
      return templates.cinema;
  }
}
