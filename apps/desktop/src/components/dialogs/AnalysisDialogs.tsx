import { lazy, Suspense } from 'react';
import type { Project, Clip, MediaAsset, Track } from '@open-factory/editor-core';
import { useEditorUIStore } from '../../store/editorUIStore';
import { useEditorFeatureStore } from '../../store/editorFeatureStore';
import type { ContentAnalysisTarget } from '../../media/ContentAnalysisDialog';
import type { VideoStitchWizardSettings } from '../../video-stitching/VideoStitchWizardDialog';
import {
  normalizeOperationReplaySpeed,
  UpdateClipCommand,
  type OperationRecordingFile,
  type OperationReplaySpeed,
  type SpeakerDiarizationSegment,
  type TimelineColorAnalysisResult,
  type SceneColorDifference,
  type ColorAnalysisClipSample,
  type PerformanceProfilerReport,
} from '@open-factory/editor-core';
import { PanelLoading } from '../PanelLoading';

const LutEditorDialog = lazy(() =>
  import('../../lut-editor/LutEditorDialog').then((m) => ({ default: m.LutEditorDialog }))
);
const ColorNodeEditorDialog = lazy(() =>
  import('../../color-node-editor/ColorNodeEditorDialog').then((m) => ({ default: m.ColorNodeEditorDialog }))
);
const ColorAnalysisDialog = lazy(() =>
  import('../../color-analysis/ColorAnalysisDialog').then((m) => ({ default: m.ColorAnalysisDialog }))
);
const AudioSpectrumDialog = lazy(() => import('../../media/AudioSpectrumDialog'));
const VideoStitchWizardDialog = lazy(() =>
  import('../../video-stitching/VideoStitchWizardDialog').then((m) => ({ default: m.VideoStitchWizardDialog }))
);
const SceneReorderDialog = lazy(() =>
  import('../../scene-reorder/SceneReorderDialog').then((m) => ({ default: m.SceneReorderDialog }))
);
const StyleTransferDialog = lazy(() => import('../../style-transfer/StyleTransferDialog'));
const OperationReplayDialog = lazy(() => import('../../operation-recording/OperationReplayDialog'));
const SpeakerDiarizationDialog = lazy(() => import('../../speaker-diarization/SpeakerDiarizationDialog'));
const SmartRecommendationsDialog = lazy(() => import('../../smart-recommendations/SmartRecommendationsDialog'));
const ContentAnalysisDialog = lazy(() =>
  import('../../media/ContentAnalysisDialog').then((m) => ({ default: m.ContentAnalysisDialog }))
);
const ProfilerDialog = lazy(() =>
  import('../../profiler/ProfilerDialog').then((m) => ({ default: m.ProfilerDialog }))
);
const RhythmAnalysisDialog = lazy(() =>
  import('../../analysis/RhythmAnalysisDialog').then((m) => ({ default: m.RhythmAnalysisDialog }))
);

export interface AnalysisDialogsProps {
  project: Project;
  selectedClip?: Clip;
  selectedClipId?: string;
  selectedClipIds: string[];
  commandManager: { execute: (command: any) => void };
  timelineAccessor: any;
  // Color analysis
  colorAnalysisResults: TimelineColorAnalysisResult[];
  colorAnalysisJumps: SceneColorDifference[];
  colorAnalysisBusy: boolean;
  runTimelineColorAnalysis: () => void;
  alignTimelineColorToReference: (referenceClipId: string) => void;
  // Audio spectrum
  seekSpectrumTime: (asset: MediaAsset, sourceTime: number) => void;
  setSpectrumSelectionRange: (range: { inPoint: number; outPoint: number }) => void;
  splitSpectrumAtTime: (asset: MediaAsset, sourceTime: number) => void;
  // Video stitch wizard
  importVideosForStitchWizard: () => Promise<string[]>;
  generateVideoStitchTimeline: (settings: VideoStitchWizardSettings) => void;
  // Operation replay
  operationRecording: OperationRecordingFile | undefined;
  operationRecordingActive: boolean;
  operationReplayRunning: boolean;
  operationRecordingStep: number;
  operationReplaySpeed: OperationReplaySpeed;
  startOperationRecording: () => void;
  stopOperationRecording: () => void;
  saveOperationRecording: () => void;
  loadOperationRecording: () => void;
  replayOperationRecording: () => void;
  pauseOperationReplay: () => void;
  jumpOperationRecording: (stepIndex: number) => void;
  exportOperationRecordingSlides: () => void;
  // Speaker diarization
  speakerDiarizationResult: { sourceName: string; segments: SpeakerDiarizationSegment[]; tracks: Track[] } | undefined;
  applySpeakerDiarization: () => void;
  // Smart recommendations
  addAssetToTimeline: (assetId: string) => void;
  // Content analysis
  contentAnalysisTargets: ContentAnalysisTarget[];
  contentAnalysisRunningClipId?: string;
  analyzeContentClip: (clipId: string) => void;
  analyzePreferredContentTargets: () => void;
  exportContentAnalysis: (clipId: string) => void;
  // Profiler
  profilerRecording: boolean;
  profilerElapsedMs: number;
  profilerReport: PerformanceProfilerReport | undefined;
  startProfilerRecording: () => void;
  stopProfilerRecording: () => void;
  exportProfilerReportJson: () => void;
}

export function AnalysisDialogs({
  project,
  selectedClip,
  selectedClipId,
  selectedClipIds,
  commandManager,
  timelineAccessor,
  colorAnalysisResults,
  colorAnalysisJumps,
  colorAnalysisBusy,
  runTimelineColorAnalysis,
  alignTimelineColorToReference,
  seekSpectrumTime,
  setSpectrumSelectionRange,
  splitSpectrumAtTime,
  importVideosForStitchWizard,
  generateVideoStitchTimeline,
  operationRecording,
  operationRecordingActive,
  operationReplayRunning,
  operationRecordingStep,
  operationReplaySpeed,
  startOperationRecording,
  stopOperationRecording,
  saveOperationRecording,
  loadOperationRecording,
  replayOperationRecording,
  pauseOperationReplay,
  jumpOperationRecording,
  exportOperationRecordingSlides,
  speakerDiarizationResult,
  applySpeakerDiarization,
  addAssetToTimeline,
  contentAnalysisTargets,
  contentAnalysisRunningClipId,
  analyzeContentClip,
  analyzePreferredContentTargets,
  exportContentAnalysis,
  profilerRecording,
  profilerElapsedMs,
  profilerReport,
  startProfilerRecording,
  stopProfilerRecording,
  exportProfilerReportJson,
}: AnalysisDialogsProps) {
  // UI open/close states from useEditorUIStore
  const lutEditorOpen = useEditorUIStore((s) => s.lutEditorOpen);
  const setLutEditorOpen = useEditorUIStore((s) => s.setLutEditorOpen);
  const colorNodeEditorOpen = useEditorUIStore((s) => s.colorNodeEditorOpen);
  const setColorNodeEditorOpen = useEditorUIStore((s) => s.setColorNodeEditorOpen);
  const colorAnalysisOpen = useEditorUIStore((s) => s.colorAnalysisOpen);
  const setColorAnalysisOpen = useEditorUIStore((s) => s.setColorAnalysisOpen);
  const videoStitchWizardOpen = useEditorUIStore((s) => s.videoStitchWizardOpen);
  const setVideoStitchWizardOpen = useEditorUIStore((s) => s.setVideoStitchWizardOpen);
  const sceneReorderOpen = useEditorUIStore((s) => s.sceneReorderOpen);
  const setSceneReorderOpen = useEditorUIStore((s) => s.setSceneReorderOpen);
  const styleTransferOpen = useEditorUIStore((s) => s.styleTransferOpen);
  const setStyleTransferOpen = useEditorUIStore((s) => s.setStyleTransferOpen);
  const operationRecordingOpen = useEditorUIStore((s) => s.operationRecordingOpen);
  const setOperationRecordingOpen = useEditorUIStore((s) => s.setOperationRecordingOpen);
  const smartRecommendationsOpen = useEditorUIStore((s) => s.smartRecommendationsOpen);
  const setSmartRecommendationsOpen = useEditorUIStore((s) => s.setSmartRecommendationsOpen);
  const contentAnalysisOpen = useEditorUIStore((s) => s.contentAnalysisOpen);
  const setContentAnalysisOpen = useEditorUIStore((s) => s.setContentAnalysisOpen);
  const profilerOpen = useEditorUIStore((s) => s.profilerOpen);
  const setProfilerOpen = useEditorUIStore((s) => s.setProfilerOpen);
  const rhythmAnalysisOpen = useEditorUIStore((s) => s.rhythmAnalysisOpen);
  const setRhythmAnalysisOpen = useEditorUIStore((s) => s.setRhythmAnalysisOpen);

  // Data from useEditorFeatureStore
  const spectrumAsset = useEditorFeatureStore((s) => s.spectrumAsset);
  const setSpectrumAsset = useEditorFeatureStore((s) => s.setSpectrumAsset);
  const setOperationReplaySpeed = useEditorFeatureStore((s) => s.setOperationReplaySpeed);
  const setSpeakerDiarizationResult = useEditorFeatureStore((s) => s.setSpeakerDiarizationResult);
  const setOperationRecording = useEditorFeatureStore((s) => s.setOperationRecording);
  const setOperationRecordingActive = useEditorFeatureStore((s) => s.setOperationRecordingActive);
  const setOperationReplayRunning = useEditorFeatureStore((s) => s.setOperationReplayRunning);
  const setOperationRecordingStep = useEditorFeatureStore((s) => s.setOperationRecordingStep);

  return (
    <Suspense fallback={<PanelLoading label="分析工具" />}>
      {lutEditorOpen ? <LutEditorDialog onClose={() => setLutEditorOpen(false)} /> : null}
      {colorNodeEditorOpen && selectedClip && selectedClip.type !== 'audio' ? (
        <ColorNodeEditorDialog
          clip={selectedClip}
          onApply={(graph) => {
            commandManager.execute(new UpdateClipCommand(timelineAccessor, selectedClip.id, { colorNodeGraph: graph }));
          }}
          onClose={() => setColorNodeEditorOpen(false)}
        />
      ) : null}
      {colorAnalysisOpen ? (
        <ColorAnalysisDialog
          results={colorAnalysisResults}
          jumps={colorAnalysisJumps}
          busy={colorAnalysisBusy}
          onAnalyze={() => void runTimelineColorAnalysis()}
          onAlign={alignTimelineColorToReference}
          onClose={() => setColorAnalysisOpen(false)}
        />
      ) : null}
      {spectrumAsset ? (
        <AudioSpectrumDialog
          asset={spectrumAsset}
          onClose={() => setSpectrumAsset(undefined)}
          onSeek={(time) => seekSpectrumTime(spectrumAsset, time)}
          onSelection={setSpectrumSelectionRange}
          onSplitAtTime={(time) => splitSpectrumAtTime(spectrumAsset, time)}
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
      {sceneReorderOpen ? (
        <SceneReorderDialog project={project} selectedClipIds={selectedClipIds} onClose={() => setSceneReorderOpen(false)} />
      ) : null}
      {styleTransferOpen ? (
        <StyleTransferDialog
          project={project}
          selectedClipId={selectedClipId}
          selectedClipIds={selectedClipIds}
          onClose={() => setStyleTransferOpen(false)}
        />
      ) : null}
      {operationRecordingOpen ? (
        <OperationReplayDialog
          recording={operationRecording}
          recordingActive={operationRecordingActive}
          replaying={operationReplayRunning}
          currentStep={operationRecordingStep}
          speed={operationReplaySpeed}
          onStartRecording={startOperationRecording}
          onStopRecording={stopOperationRecording}
          onSaveRecording={() => void saveOperationRecording()}
          onLoadRecording={() => void loadOperationRecording()}
          onReplay={replayOperationRecording}
          onPauseReplay={pauseOperationReplay}
          onJump={jumpOperationRecording}
          onSpeedChange={(speed) => setOperationReplaySpeed(normalizeOperationReplaySpeed(speed))}
          onExportSlides={() => void exportOperationRecordingSlides()}
          onClose={() => setOperationRecordingOpen(false)}
        />
      ) : null}
      {speakerDiarizationResult ? (
        <SpeakerDiarizationDialog
          sourceName={speakerDiarizationResult.sourceName}
          segments={speakerDiarizationResult.segments}
          tracks={speakerDiarizationResult.tracks}
          onApply={() => void applySpeakerDiarization()}
          onClose={() => setSpeakerDiarizationResult(undefined)}
        />
      ) : null}
      {smartRecommendationsOpen ? (
        <SmartRecommendationsDialog project={project} onAddToTimeline={addAssetToTimeline} onClose={() => setSmartRecommendationsOpen(false)} />
      ) : null}
      {contentAnalysisOpen ? (
        <ContentAnalysisDialog
          targets={contentAnalysisTargets}
          selectedClipIds={selectedClipIds}
          analyzingClipId={contentAnalysisRunningClipId}
          onAnalyze={(clipId) => void analyzeContentClip(clipId)}
          onAnalyzePreferred={() => void analyzePreferredContentTargets()}
          onExport={(clipId) => void exportContentAnalysis(clipId)}
          onClose={() => setContentAnalysisOpen(false)}
        />
      ) : null}
      {profilerOpen ? (
        <ProfilerDialog
          recording={profilerRecording}
          elapsedMs={profilerElapsedMs}
          report={profilerReport}
          onStart={startProfilerRecording}
          onStop={stopProfilerRecording}
          onExportJson={() => void exportProfilerReportJson()}
          onClose={() => {
            if (profilerRecording) {
              stopProfilerRecording();
            }
            setProfilerOpen(false);
          }}
        />
      ) : null}
      {rhythmAnalysisOpen ? (
        <RhythmAnalysisDialog project={project} onClose={() => setRhythmAnalysisOpen(false)} />
      ) : null}
    </Suspense>
  );
}
