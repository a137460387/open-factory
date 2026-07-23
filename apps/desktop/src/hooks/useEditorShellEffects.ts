import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { usePerformanceMonitorStore } from '../store/performanceMonitorStore';
import { initMediaIndexDb, listenBridge, type DemucsProgressEvent } from '../lib/tauri-bridge';
import { getDemucsAvailability } from '../lib/demucs';
import { normalizeTutorialProgressSettings, advanceTutorialProgress, type TutorialProgressSettings, type TutorialSignals } from '../tutorial/tutorialState';
import { saveTutorialProgressSettings } from '../settings/appSettings';

interface EffectsDeps {
  projectPath: string | null;
  tutorialProgress: TutorialProgressSettings;
  tutorialSignals: TutorialSignals;
  setTutorialProgress: (p: TutorialProgressSettings) => void;
  setTutorialCelebrationVisible: (v: boolean) => void;
  demucsExecutablePath: string;
  setDemucsAvailability: (a: any) => void;
  audioSeparationClipId: string | null;
  setAudioSeparationProgress: (p: number) => void;
  recordingTask: { startedAt: number } | null;
  setRecordingElapsedSeconds: (s: number) => void;
  detectedBeatBpm: number | undefined;
  selectedClipId: string | null;
  setBeatSyncManualBpm: (v: string) => void;
  refreshSharedLibraryResources: () => Promise<void>;
  setFormatConverterOpen: (v: boolean) => void;
  setEmotionAnalysisOpen: (v: boolean) => void;
  setExportHistoryClassifierOpen: (v: boolean) => void;
  setFormatConverterMockFiles: (f: any) => void;
  setMockSubtitleClips: (c: any) => void;
  setMockExportHistory: (h: any) => void;
  setArchiveProgress: (p: any) => void;
  setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setGestureTutorialOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * All useEffects extracted from EditorShell.
 */
export function useEditorShellEffects(deps: EffectsDeps) {
  const {
    projectPath,
    tutorialProgress,
    tutorialSignals,
    setTutorialProgress,
    setTutorialCelebrationVisible,
    demucsExecutablePath,
    setDemucsAvailability,
    audioSeparationClipId,
    setAudioSeparationProgress,
    recordingTask,
    setRecordingElapsedSeconds,
    detectedBeatBpm,
    selectedClipId,
    setBeatSyncManualBpm,
    refreshSharedLibraryResources,
    setFormatConverterOpen,
    setEmotionAnalysisOpen,
    setExportHistoryClassifierOpen,
    setFormatConverterMockFiles,
    setMockSubtitleClips,
    setMockExportHistory,
    setArchiveProgress,
    setCommandPaletteOpen,
    setGestureTutorialOpen,
  } = deps;

  // Media index DB init
  useEffect(() => {
    if (projectPath) {
      void initMediaIndexDb(projectPath).catch((error) => {
        console.warn('媒体索引数据库初始化失败:', error);
      });
    }
  }, [projectPath]);

  // Advance tutorial when signals change
  useEffect(() => {
    const current = normalizeTutorialProgressSettings(tutorialProgress);
    const nextProgress = advanceTutorialProgress(current, tutorialSignals);
    if (
      nextProgress.tutorialStep !== current.tutorialStep ||
      nextProgress.tutorialCompleted !== current.tutorialCompleted
    ) {
      setTutorialProgress(nextProgress);
      if (nextProgress.tutorialCompleted) {
        setTutorialCelebrationVisible(true);
      }
      void saveTutorialProgressSettings(nextProgress).catch((error) => {
        console.warn('Unable to save tutorial progress', error);
      });
    }
  }, [tutorialSignals, tutorialProgress, setTutorialProgress, setTutorialCelebrationVisible]);

  // E2E: expose stores for test instrumentation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__PERF_MONITOR_STORE__ = usePerformanceMonitorStore;
      window.__APP_STORE__ = {
        setFormatConverterOpen,
        setEmotionAnalysisOpen,
        setEmotionPanelOpen: setEmotionAnalysisOpen,
        setFormatConverterMockFiles,
        setExportHistoryClassifierOpen,
        setExportHistoryPanelOpen: setExportHistoryClassifierOpen,
        setMockSubtitleClips,
        setMockExportHistory,
        setArchiveProgress,
        setSmartDistributionOpen: useEditorUIStore.getState().setSmartDistributionOpen,
      };
    }
  }, [setFormatConverterOpen, setEmotionAnalysisOpen, setExportHistoryClassifierOpen, setArchiveProgress]);

  // Shared library resources refresh
  useEffect(() => {
    void refreshSharedLibraryResources();
    const onSharedLibraryUpdated = () => {
      void refreshSharedLibraryResources();
    };
    window.addEventListener('open-factory:shared-library-updated', onSharedLibraryUpdated);
    return () => window.removeEventListener('open-factory:shared-library-updated', onSharedLibraryUpdated);
  }, [refreshSharedLibraryResources]);

  // Demucs availability check
  useEffect(() => {
    let canceled = false;
    void getDemucsAvailability({ executablePath: demucsExecutablePath }).then((availability) => {
      if (!canceled) {
        setDemucsAvailability(availability);
      }
    });
    return () => {
      canceled = true;
    };
  }, [demucsExecutablePath]);

  // Demucs progress listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenBridge<DemucsProgressEvent>('demucs-progress', (payload) => {
      if (payload.clipId === audioSeparationClipId) {
        setAudioSeparationProgress(payload.progress);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [audioSeparationClipId]);

  // Recording elapsed timer
  useEffect(() => {
    if (!recordingTask) {
      setRecordingElapsedSeconds(0);
      return undefined;
    }
    const update = () => setRecordingElapsedSeconds((Date.now() - recordingTask.startedAt) / 1000);
    update();
    const interval = window.setInterval(update, 500);
    return () => window.clearInterval(interval);
  }, [recordingTask]);

  // Auto-update beat sync manual BPM when clip changes
  useEffect(() => {
    setBeatSyncManualBpm(detectedBeatBpm ? String(detectedBeatBpm) : '');
  }, [detectedBeatBpm, selectedClipId]);

  // Command palette shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [setCommandPaletteOpen]);

  // Gesture tutorial auto-show on first launch
  useEffect(() => {
    const seen = localStorage.getItem('open-factory:gesture-tutorial-seen');
    if (!seen) {
      const timer = setTimeout(() => setGestureTutorialOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [setGestureTutorialOpen]);
}
