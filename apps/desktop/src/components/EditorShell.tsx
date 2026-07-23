import { Suspense, useCallback, useState } from 'react';
import { getTimelineDuration } from '@open-factory/editor-core';
import { Toolbar } from './Toolbar';
import { ErrorBoundary } from './common/ErrorBoundary';
import { useAutosave } from '../hooks/useAutosave';
import { useCloseGuard } from '../hooks/useCloseGuard';
import { useExportQueue } from '../hooks/useExportQueue';
import { useMacroShortcuts } from '../hooks/useMacroShortcuts';
import { useEditorShellSettings } from '../hooks/useEditorShellSettings';
import { useEditorShellInteractions } from '../hooks/useEditorShellInteractions';
import { useShortcuts } from '../hooks/useShortcuts';
import { useEditorShellStoreSubscriptions } from '../hooks/useEditorShellStoreSubscriptions';
import { useEditorShellDerivedState } from '../hooks/useEditorShellDerivedState';
import { useEditorShellEffects } from '../hooks/useEditorShellEffects';
import { useEditorShellOrchestrator } from '../hooks/useEditorShellOrchestrator';
import { PerformanceAlertIcon } from './PerformanceAlertIcon';
import { ShellFloatingDialogs } from './layout/ShellFloatingDialogs';
import { ShellMainArea } from './layout/ShellMainArea';
import { useBackgroundMediaJobs } from '../media/useBackgroundMediaJobs';
import {
  ComplexityScorePanel,
  AutoAudioSyncDialog,
  CommandPalette,
  GestureTutorialOverlay,
  RoughCutComparePanel,
} from './lazyComponents';
import { revealExport } from '../lib/exportVideo';
import { writeAutosaveIntervalSeconds } from '../lib/projectFiles';
import { zhCN } from '../i18n/strings';
import type { PreviewQualityMode } from '../lib/preview/preview-performance';

export function EditorShell() {
  useEditorShellSettings();
  const { applyWorkspaceLayoutById, toggleProjectDocumentation } = useEditorShellInteractions();

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [gestureTutorialOpen, setGestureTutorialOpen] = useState(false);
  const [roughCutCompareOpen, setRoughCutCompareOpen] = useState(false);

  const store = useEditorShellStoreSubscriptions();
  const {
    project, selectedClipId, selectedClipIds, isPlaying, inPoint, outPoint, dirty, projectPath,
    setProject, setMedia, addMedia, setSelectedKeyframes, setMediaMetadata, setDirty, setProjectPath,
    setSelectedClipId, setSelectedClipIds, clearSelectedClipIds,
    setPlayheadTime, setIsPlaying, setPlaybackRate, setInPoint, setOutPoint,
    setBatchTranscodeOpen, setBatchWatermarkOpen, setBatchProjectProcessingOpen,
    setLutEditorOpen, setColorNodeEditorOpen, setColorAnalysisOpen,
    professionalNleExportOpen, setProfessionalNleExportOpen, mediaPrecheckOpen, setMediaPrecheckOpen,
    setVideoStitchWizardOpen, setSmartMontageOpen,
    syncCompareOpen, setSyncCompareOpen, setSceneReorderOpen, setStyleTransferOpen,
    collaborationNotesOpen, setCollaborationNotesOpen, setOperationRecordingOpen,
    complexityScoreOpen, setComplexityScoreOpen, setSmartRecommendationsOpen, setContentAnalysisOpen, setProfilerOpen,
    setRhythmAnalysisOpen, autoAudioSyncOpen, setAutoAudioSyncOpen,
    setErrorKnowledgeOpen, setSequenceCompareOpen, setSubtitleSyncOpen, setProxyVerifyOpen,
    setFormatConverterOpen, setEmotionAnalysisOpen, setExportHistoryClassifierOpen, setMacroHistoryOpen,
    lastBackupAt, setLastBackupAt,
    pipLayoutPosition, setPiPLayoutPosition, customSplitLayouts, setCustomSplitLayouts,
    batchTranscodeInitialPaths, setBatchTranscodeInitialPaths,
    thumbnailGeneratorAssetIds, setThumbnailGeneratorAssetIds,
    colorAnalysisBusy, setColorAnalysisBusy, colorAnalysisResults, setColorAnalysisResults,
    colorAnalysisJumps, setColorAnalysisJumps, colorHeatmapPoints, setColorHeatmapPoints,
    colorAnalysisSamples, setColorAnalysisSamples, setGifExportAsset, setSpectrumAsset,
    mediaVersionCompare, setMediaVersionCompare,
    setFormatConverterMockFiles, setMockSubtitleClips, setMockExportHistory,
    demucsAvailability, setDemucsAvailability,
    audioSeparationClipId, setAudioSeparationClipId, audioSeparationProgress, setAudioSeparationProgress,
    speakerDiarizationRunning, setSpeakerDiarizationRunning, speakerDiarizationResult, setSpeakerDiarizationResult,
    autoAudioSyncRunning, setAutoAudioSyncRunning,
    autoAudioSyncPrimaryClipId, setAutoAudioSyncPrimaryClipId,
    autoAudioSyncMode, setAutoAudioSyncMode, autoAudioSyncResults, setAutoAudioSyncResults,
    recordingTask, setRecordingTask, recordingElapsedSeconds, setRecordingElapsedSeconds,
    operationRecording, operationRecordingActive, operationRecordingStep, operationReplaySpeed, operationReplayRunning,
    profilerRecording, profilerElapsedMs, profilerReport,
    projectHealthReport, projectHealthScanning, projectHealthRepairReport,
    mediaHealthScanning, mediaHealthDashboard, mediaHealthAutoShowEnabled, setMediaHealthAutoShowEnabled,
    mediaHealthDashboardOpen, setMediaHealthDashboardOpen, setMediaHealthDashboard, setMediaHealthScanning,
    aiChatEditorOpen, setAiChatEditorOpen, aiRoughCutOpen, setAiRoughCutOpen,
    beatSyncOpen, setBeatSyncOpen, contextualTranslationOpen, setContextualTranslationOpen,
    directorModeOpen, setDirectorModeOpen, duplicateMediaOpen, setDuplicateMediaOpen,
    highlightReelOpen, setHighlightReelOpen, historyPanelOpen, setHistoryPanelOpen,
    mediaOrganizerOpen, setMediaOrganizerOpen, musicMatchOpen, setMusicMatchOpen,
    narrationOpen, setNarrationOpen, pasteKeyframeDialogOpen, setPasteKeyframeDialogOpen,
    previewWindowOpen, setPreviewWindowOpen, projectDocumentationOpen, setProjectDocumentationOpen,
    projectEncryptionSaveOpen, setProjectEncryptionSaveOpen, projectHealthOpen, setProjectHealthOpen,
    projectTemplateOpen, setProjectTemplateOpen, releaseWorkflowOpen, setReleaseWorkflowOpen,
    reviewMode, setReviewMode, shortcutCheatsheetOpen, setShortcutCheatsheetOpen,
    smartCreationOpen, setSmartCreationOpen, smartRoughCutOpen, setSmartRoughCutOpen,
    snapshotCompareOpen, setSnapshotCompareOpen, snapshotHistoryOpen, setSnapshotHistoryOpen,
    snapshotNameOpen, setSnapshotNameOpen, storyboardOpen, setStoryboardOpen,
    timelineCompareOpen, setTimelineCompareOpen, timelineSearchOpen, setTimelineSearchOpen,
    videoSummaryOpen, setVideoSummaryOpen,
    setSettingsOpen, setAssistEditingOpen, setContentGenerationOpen, setQualityAssessmentOpen,
    layoutSettings, setLayoutSettings, viewportSize, setViewportSize,
    persistLayoutPatch, persistPanelVisibilityPatch,
    beatSensitivity, setBeatSensitivity, beatSyncSpeedEnabled, setBeatSyncSpeedEnabled,
    beatSyncManualBpm, setBeatSyncManualBpm, sceneDetectionRequestId, setSceneDetectionRequestId,
    collaborationIdentity, setCollaborationIdentity,
    tutorialProgress, setTutorialProgress, tutorialCelebrationVisible, setTutorialCelebrationVisible,
    tutorialSignals, setTutorialSignals,
    safeFrameGuides, setSafeFrameGuides, thumbnailTrackVisible, setThumbnailTrackVisible,
    timelineMinimapVisible, setTimelineMinimapVisible, timelineHeatmap, setTimelineHeatmap,
    previewPerformance, setPreviewPerformance, previewWindowResolutionScale, setPreviewWindowResolutionScale,
    timelineGridSettings, setTimelineGridSettings, timelineInteractionSettings, setTimelineInteractionSettings,
    shortcutBindings, setShortcutBindings, macros, setMacros,
    sharedLibraryResources, setSharedLibraryResources, autosaveIntervalSeconds, setAutosaveIntervalSeconds,
    contentAnalysisRunningClipId, setContentAnalysisRunningClipId,
    duplicateMediaGroups, setDuplicateMediaGroups, macroRecordingActive, macroRecordingStepCount,
    mediaOrganizerGroups, setMediaOrganizerGroups, mediaOrganizerCleanup, setMediaOrganizerCleanup,
    mediaOrganizerScanning, setMediaOrganizerScanning,
    pasteKeyframeDialogGroups, setPasteKeyframeDialogGroups,
    projectPasswordRequest, setProjectPasswordRequest, recoveryCandidate, setRecoveryCandidate,
    archiveProgress, setArchiveProgress,
    setProjectHealthReport, setProjectHealthScanning, setProjectHealthRepairReport,
    timelineTemplateMode, setTimelineTemplateMode, templateExportPreset, setTemplateExportPreset,
    collaborationEnabled, proxySettings, demucsExecutablePath, recordingSettings,
  } = store;

  const exportQueue = useExportQueue(project);
  const {
    lastExportPath, setLastExportPath,
    exportDialogOpen, setExportDialogOpen,
    timelineExportDialogOpen, setTimelineExportDialogOpen,
    exportQueueRecovery, sharePackageProgress, sharePackageBusy,
    cancelCurrentExport, createCurrentSharePackage, exportCurrentFrame,
    restoreExportQueueRecovery, discardExportQueueRecovery,
  } = exportQueue;

  const derived = useEditorShellDerivedState({
    project,
    selectedClipId: selectedClipId ?? null,
    selectedClipIds,
    demucsAvailability,
    audioSeparationClipId: audioSeparationClipId ?? null,
    speakerDiarizationRunning,
    autoAudioSyncRunning,
    autoAudioSyncPrimaryClipId: autoAudioSyncPrimaryClipId ?? null,
    layoutSettings,
    viewportSize,
    reviewMode,
  });
  const {
    selectedClip, selectedClips, selectedClipMedia, allTimelineClips, visualTimelineClipRefs,
    selectedClipLocked, syncCompareClipRefs, canOpenSyncCompare, canOpenSceneDetection, canOpenSceneReorder,
    contentAnalysisTargets, mediaContentAnalysis, speakerDiarizationTarget,
    autoAudioSyncTargets, resolvedAutoAudioSyncPrimaryClipId, autoAudioSyncDialogTargets,
    canSeparateSelectedAudio, canRunSpeakerDiarization, canOpenAutoAudioSync, canDetectBeats,
    canCreateMulticamSequence, selectedPiPClips, canApplyPiPLayout, selectedSplitLayoutClips, canApplySplitLayout,
    selectedClipTimelineBeatTimes, beatSyncBeatTimes, detectedBeatBpm,
    canSnapToBeats, canSplitToBeats, timelineHeightPx, effectivePanels, reviewVisibility,
    workspaceLayouts, editorGridRows, mainGridColumns, rightPanelRows,
  } = derived;

  // Orchestrator: all callback hooks consolidated
  const oc = useEditorShellOrchestrator(store, derived, exportQueue, {
    setCommandPaletteOpen, setGestureTutorialOpen, setRoughCutCompareOpen,
  });

  // Effects, autosave, close guard, shortcuts
  useEditorShellEffects({
    projectPath: projectPath ?? null,
    tutorialProgress: tutorialProgress ?? { enabled: true, currentStep: 0, completed: false, dismissed: false } as any,
    tutorialSignals, setTutorialProgress, setTutorialCelebrationVisible,
    demucsExecutablePath, setDemucsAvailability,
    audioSeparationClipId: audioSeparationClipId ?? null,
    setAudioSeparationProgress,
    recordingTask: recordingTask ?? null,
    setRecordingElapsedSeconds,
    detectedBeatBpm, selectedClipId: selectedClipId ?? null,
    setBeatSyncManualBpm,
    refreshSharedLibraryResources: oc.refreshSharedLibraryResources,
    setFormatConverterOpen, setEmotionAnalysisOpen, setExportHistoryClassifierOpen,
    setFormatConverterMockFiles, setMockSubtitleClips, setMockExportHistory,
    setArchiveProgress, setCommandPaletteOpen, setGestureTutorialOpen,
  });
  useBackgroundMediaJobs(project.media);
  useAutosave(autosaveIntervalSeconds);
  useCloseGuard(oc.saveProject);
  useShortcuts(oc.inlineShortcutHandlers, shortcutBindings);
  useMacroShortcuts(macros, oc.executeMacro);

  // Close all AI panels (shared by toggle handlers)
  const closeAllAiPanels = useCallback(() => {
    setHistoryPanelOpen(false);
    setProjectDocumentationOpen(false);
    setSmartRoughCutOpen(false);
    setAiRoughCutOpen(false);
    setDirectorModeOpen(false);
    setMusicMatchOpen(false);
    setHighlightReelOpen(false);
    setContextualTranslationOpen(false);
    setAiChatEditorOpen(false);
    setVideoSummaryOpen(false);
    setNarrationOpen(false);
  }, [
    setHistoryPanelOpen, setProjectDocumentationOpen,
    setSmartRoughCutOpen, setAiRoughCutOpen, setDirectorModeOpen,
    setMusicMatchOpen, setHighlightReelOpen, setContextualTranslationOpen,
    setAiChatEditorOpen, setVideoSummaryOpen, setNarrationOpen,
  ]);

  return (
    <ErrorBoundary name={zhCN.panels.editor}>
      <div
        className="grid h-full min-w-0 overflow-hidden bg-[#edeff3] text-ink transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: editorGridRows }}
        data-testid="editor-shell"
      >
        <Toolbar
          onNewProject={oc.newProject}
          onNewFromTemplate={() => setProjectTemplateOpen(true)}
          onSaveTimelineTemplate={() => setTimelineTemplateMode('save')}
          onNewFromTimelineTemplate={() => setTimelineTemplateMode('new')}
          onOpenProject={oc.openProject}
          onSaveProject={() => void oc.saveProject()}
          onSaveEncryptedProject={oc.saveEncryptedProject}
          onArchiveProject={() => void oc.archiveCurrentProject()}
          onOpenReleaseWorkflow={() => setReleaseWorkflowOpen(true)}
          onCreateMediaReport={() => void oc.createMediaReport()}
          onCreateClipReport={() => void oc.createClipReport()}
          onGenerateVideoSummary={() => setVideoSummaryOpen(true)}
          onGenerateNarration={() => setNarrationOpen(true)}
          onOpenAssistEditing={() => setAssistEditingOpen(true)}
          onOpenContentGeneration={() => setContentGenerationOpen(true)}
          onOpenQualityAssessment={() => setQualityAssessmentOpen(true)}
          onCreateSharePackage={() => void createCurrentSharePackage()}
          onConformMedia={() => void oc.conformMedia()}
          onImportBookmarks={() => void oc.importBookmarks()}
          onExportBookmarks={() => void oc.exportBookmarks()}
          onSaveSnapshot={() => setSnapshotNameOpen(true)}
          onOpenSnapshotHistory={() => setSnapshotHistoryOpen(true)}
          onOpenSnapshotCompare={() => setSnapshotCompareOpen(true)}
          onOpenTimelineCompare={() => setTimelineCompareOpen(true)}
          onImportMedia={() => void oc.importMedia()}
          onBatchTranscode={() => oc.openBatchTranscode()}
          onOpenBatchWatermark={() => setBatchWatermarkOpen(true)}
          onOpenBatchProjectProcessing={() => setBatchProjectProcessingOpen(true)}
          onOpenMediaPrecheck={() => setMediaPrecheckOpen(true)}
          onOpenMediaOrganizer={oc.openMediaOrganizer}
          onOpenMediaHealthDashboard={oc.openMediaHealthDashboard}
          onOpenVideoStitchWizard={() => setVideoStitchWizardOpen(true)}
          onOpenSmartMontage={() => setSmartMontageOpen(true)}
          onAddMotionGraphic={oc.addMotionGraphic}
          onOpenThumbnailGenerator={() => setThumbnailGeneratorAssetIds([])}
          onOpenLutEditor={() => setLutEditorOpen(true)}
          onOpenColorNodeEditor={oc.openColorNodeEditor}
          onOpenColorAnalysis={oc.openColorAnalysis}
          onOpenSyncCompare={oc.openSyncCompare}
          onOpenSceneDetection={() => setSceneDetectionRequestId((id) => id + 1)}
          onOpenSceneReorder={() => setSceneReorderOpen(true)}
          onOpenStyleTransfer={() => setStyleTransferOpen(true)}
          onOpenCollaborationNotes={() => setCollaborationNotesOpen(true)}
          onOpenOperationRecording={() => setOperationRecordingOpen(true)}
          onOpenComplexityScore={() => setComplexityScoreOpen(true)}
          onOpenSmartRecommendations={() => setSmartRecommendationsOpen(true)}
          onOpenContentAnalysis={() => setContentAnalysisOpen(true)}
          onOpenPerformanceProfiler={() => setProfilerOpen(true)}
          onOpenRhythmAnalysis={() => setRhythmAnalysisOpen(true)}
          onOpenBeatSync={() => setBeatSyncOpen(true)}
          onDetectBeats={() => void oc.detectSelectedBeats()}
          onSnapToBeats={oc.snapSelectedToBeats}
          onSplitToBeats={oc.splitSelectedToBeats}
          onOpenAutoAudioSync={oc.openAutoAudioSync}
          onOpenMacroHistory={() => setMacroHistoryOpen(true)}
          onStartMacroRecording={oc.startMacroRecording}
          onStopMacroRecording={() => void oc.stopMacroRecording()}
          onImportSubtitles={() => void oc.importSubtitles()}
          onImportDataSubtitles={(mode) => void oc.importDataSubtitles(mode)}
          onStartRecording={(source) => void oc.startEditorRecording(source)}
          onStopRecording={() => void oc.stopEditorRecording()}
          onExportVideo={() => setExportDialogOpen(true)}
          onExportTimeline={() => setTimelineExportDialogOpen(true)}
          onExportProfessionalNle={() => setProfessionalNleExportOpen(true)}
          onExportCurrentFrame={() => void exportCurrentFrame()}
          onCancelExport={() => void cancelCurrentExport()}
          onSplitSelected={oc.splitSelected}
          onToggleSmartRoughCut={() => {
            setHistoryPanelOpen(false);
            setProjectDocumentationOpen(false);
            setSmartRoughCutOpen((open) => !open);
          }}
          onToggleAIRoughCut={() => { closeAllAiPanels(); setAiRoughCutOpen((open) => !open); }}
          onToggleDirectorMode={() => { closeAllAiPanels(); setDirectorModeOpen((open) => !open); }}
          onToggleMusicMatch={() => { closeAllAiPanels(); setMusicMatchOpen((open) => !open); }}
          onToggleHighlightReel={() => { closeAllAiPanels(); setHighlightReelOpen((open) => !open); }}
          onToggleContextualTranslation={() => { closeAllAiPanels(); setContextualTranslationOpen((open) => !open); }}
          onToggleAIChatEditor={() => { closeAllAiPanels(); setAiChatEditorOpen((open) => !open); }}
          onToggleSmartCreation={() => { closeAllAiPanels(); setSmartCreationOpen((open) => !open); }}
          onSeparateAudio={() => void oc.separateSelectedAudio()}
          onCancelAudioSeparation={() => void oc.cancelAudioSeparation()}
          onRunSpeakerDiarization={() => void oc.runSpeakerDiarization()}
          onCreateMulticamSequence={oc.createMulticamSequence}
          onApplyPiPLayout={oc.applyPiPLayout}
          onApplySplitLayout={oc.applySplitLayout}
          onSaveCustomSplitLayout={(ratio) => oc.saveCustomSplitLayout(ratio)}
          canCreateMulticamSequence={canCreateMulticamSequence}
          canApplyPiPLayout={canApplyPiPLayout}
          canApplySplitLayout={canApplySplitLayout}
          canOpenSyncCompare={canOpenSyncCompare}
          canOpenSceneDetection={canOpenSceneDetection}
          canOpenSceneReorder={canOpenSceneReorder}
          pipLayoutPosition={pipLayoutPosition}
          onPiPLayoutPositionChange={setPiPLayoutPosition}
          customSplitLayouts={customSplitLayouts}
          canDetectBeats={canDetectBeats}
          canSnapToBeats={canSnapToBeats}
          canSplitToBeats={canSplitToBeats}
          canOpenAutoAudioSync={canOpenAutoAudioSync}
          beatSensitivity={beatSensitivity}
          onBeatSensitivityChange={setBeatSensitivity}
          canSeparateAudio={canSeparateSelectedAudio}
          audioSeparationRunning={Boolean(audioSeparationClipId)}
          audioSeparationProgress={audioSeparationProgress}
          canRunSpeakerDiarization={canRunSpeakerDiarization}
          speakerDiarizationRunning={speakerDiarizationRunning}
          autoAudioSyncRunning={autoAudioSyncRunning}
          macroRecordingActive={macroRecordingActive}
          macroRecordingStepCount={macroRecordingStepCount}
          recordingActive={Boolean(recordingTask)}
          recordingElapsedSeconds={recordingElapsedSeconds}
          smartRoughCutOpen={smartRoughCutOpen}
          aiRoughCutOpen={aiRoughCutOpen}
          directorModeOpen={directorModeOpen}
          musicMatchOpen={musicMatchOpen}
          highlightReelOpen={highlightReelOpen}
          contextualTranslationOpen={contextualTranslationOpen}
          aiChatEditorOpen={aiChatEditorOpen}
          smartCreationOpen={smartCreationOpen}
          historyPanelOpen={historyPanelOpen}
          projectDocumentationOpen={projectDocumentationOpen}
          storyboardOpen={storyboardOpen}
          workspaceLayouts={workspaceLayouts}
          activeWorkspaceLayoutId={layoutSettings.activeWorkspaceLayoutId}
          onApplyWorkspaceLayout={applyWorkspaceLayoutById}
          onSaveWorkspaceLayout={() => void oc.saveCurrentWorkspaceLayout()}
          safeFrameGuides={safeFrameGuides}
          thumbnailTrackVisible={thumbnailTrackVisible}
          timelineMinimapVisible={timelineMinimapVisible}
          timelineHeatmap={timelineHeatmap}
          previewQualityMode={previewPerformance.qualityMode}
          previewWindowOpen={previewWindowOpen}
          timelineGridSettings={timelineGridSettings}
          reviewMode={reviewMode}
          onToggleReviewMode={() => setReviewMode((mode) => !mode)}
          onCreateReviewReport={() => void oc.createReviewReport()}
          onPreviewQualityModeChange={(qualityMode: PreviewQualityMode) =>
            oc.updatePreviewPerformance({ qualityMode, adaptiveEnabled: false })
          }
          onPopoutPreview={() => void oc.openDetachedPreview()}
          onToggleTimelineGridSnap={oc.toggleTimelineGridSnap}
          onTimelineGridUnitChange={oc.changeTimelineGridUnit}
          onToggleStoryboard={() => setStoryboardOpen((open) => !open)}
          onToggleSafeFrameGuides={oc.toggleSafeFrameGuides}
          onToggleThumbnailTrack={oc.toggleThumbnailTrackVisible}
          onToggleTimelineMinimap={oc.toggleTimelineMinimapVisible}
          onTimelineHeatmapChange={oc.updateTimelineHeatmap}
          onToggleHistoryPanel={() => {
            setSmartRoughCutOpen(false);
            setAiRoughCutOpen(false);
            setProjectDocumentationOpen(false);
            setHistoryPanelOpen((open) => {
              const next = !open;
              persistPanelVisibilityPatch({ history: next });
              return next;
            });
          }}
          onToggleProjectDocumentation={toggleProjectDocumentation}
          onUndo={oc.undo}
          onRedo={oc.redo}
          onClearCache={() => void oc.clearCache()}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenErrorKnowledge={() => setErrorKnowledgeOpen(true)}
          onOpenSequenceCompare={() => setSequenceCompareOpen(true)}
          onOpenSubtitleSync={() => setSubtitleSyncOpen(true)}
          onOpenProxyVerify={() => setProxyVerifyOpen(true)}
          onOpenFormatConverter={() => setFormatConverterOpen(true)}
          onOpenEmotionAnalysis={() => setEmotionAnalysisOpen(true)}
          onOpenExportHistoryClassifier={() => setExportHistoryClassifierOpen(true)}
          onStartTutorial={oc.startTutorial}
          onOpenProjectHealth={oc.openProjectHealth}
          sharePackageBusy={sharePackageBusy}
          autosaveIntervalSeconds={autosaveIntervalSeconds}
          onAutosaveIntervalSecondsChange={(seconds) => {
            setAutosaveIntervalSeconds(writeAutosaveIntervalSeconds(seconds));
          }}
          lastExportPath={lastExportPath}
          onRevealExport={lastExportPath ? () => void revealExport(lastExportPath) : undefined}
          lastBackupAt={lastBackupAt}
        />
        <div className="absolute right-3 top-2 z-10">
          <PerformanceAlertIcon />
        </div>
        <ShellMainArea
          mainGridColumns={mainGridColumns}
          effectivePanels={effectivePanels}
          layoutSettings={layoutSettings}
          reviewMode={reviewMode}
          previewWindowOpen={previewWindowOpen}
          safeFrameGuides={safeFrameGuides}
          previewPerformance={previewPerformance}
          handleProfilerFrame={oc.handleProfilerFrame}
          addReviewAnnotationAtPlayhead={oc.addReviewAnnotationAtPlayhead}
          createReviewReport={oc.createReviewReport}
          reembedPreviewWindow={oc.reembedPreviewWindow}
          persistPanelVisibilityPatch={persistPanelVisibilityPatch}
          reviewVisibility={reviewVisibility}
          timelineHeightPx={timelineHeightPx}
          storyboardOpen={storyboardOpen}
          thumbnailTrackVisible={thumbnailTrackVisible}
          timelineMinimapVisible={timelineMinimapVisible}
          timelineHeatmap={timelineHeatmap}
          colorHeatmapPoints={colorHeatmapPoints}
          colorAnalysisJumps={colorAnalysisJumps}
          timelineGridSettings={timelineGridSettings}
          reduceMotion={timelineInteractionSettings.reduceMotion}
          convertVfrMediaToCfr={oc.convertVfrMediaToCfr}
          sceneDetectionRequestId={sceneDetectionRequestId}
          onRoughCutCompare={() => setRoughCutCompareOpen(true)}
          leftPanelCallbacks={oc.leftPanelCallbacks}
          beginTimelineResize={oc.beginTimelineResize}
        />
        <Suspense fallback={null}>
          {complexityScoreOpen ? (
            <ComplexityScorePanel project={project} onClose={() => setComplexityScoreOpen(false)} />
          ) : null}
          {autoAudioSyncOpen ? (
            <AutoAudioSyncDialog
              targets={autoAudioSyncDialogTargets}
              primaryClipId={resolvedAutoAudioSyncPrimaryClipId}
              mode={autoAudioSyncMode}
              running={autoAudioSyncRunning}
              results={autoAudioSyncResults}
              onPrimaryChange={(clipId) => setAutoAudioSyncPrimaryClipId(clipId)}
              onModeChange={(mode) => setAutoAudioSyncMode(mode)}
              onAnalyze={() => void oc.runAutoAudioSync()}
              onApply={() => void oc.applyAutoAudioSync()}
              onClose={() => setAutoAudioSyncOpen(false)}
            />
          ) : null}
        </Suspense>
        <ShellFloatingDialogs {...oc.floatingDialogsCallbacks} />
        <Suspense fallback={null}>
          <CommandPalette
            open={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            onExecute={(cmd) => {
              switch (cmd.type) {
                case 'play':
                case 'pause':
                  setIsPlaying(!isPlaying);
                  break;
                case 'undo':
                  oc.undo();
                  break;
                case 'redo':
                  oc.redo();
                  break;
                case 'go-to':
                  if (cmd.timeRef !== undefined) setPlayheadTime(cmd.timeRef);
                  break;
                case 'export':
                  setExportDialogOpen(true);
                  break;
                default:
                  break;
              }
            }}
          />
          <GestureTutorialOverlay
            open={gestureTutorialOpen}
            onClose={() => {
              setGestureTutorialOpen(false);
              localStorage.setItem('open-factory:gesture-tutorial-seen', '1');
            }}
          />
          {roughCutCompareOpen && project ? (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
              <RoughCutComparePanel
                highlights={[]}
                rhythmResult={null}
                sourceDuration={getTimelineDuration(project.timeline)}
                onApply={() => setRoughCutCompareOpen(false)}
                onClose={() => setRoughCutCompareOpen(false)}
              />
            </div>
          ) : null}
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
