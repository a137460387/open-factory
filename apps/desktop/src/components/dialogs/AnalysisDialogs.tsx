import {lazy, Suspense, useMemo, useState} from 'react';
import {X} from 'lucide-react';
import {zhCN} from '../../i18n/strings';
import type {Project, Clip, MediaAsset, Track, BeatSensitivity, ColorGradingGraph} from '@open-factory/editor-core';
import type {Command} from '@open-factory/editor-core';
import type {TimelineAccessor} from '@open-factory/editor-core';
import {useDialogStore} from '../../store/dialogStore';
import {useCollaborationStore} from '../../store/collaborationStore';
import {useSpectrumAsset, useSetSpectrumAsset} from '../../store/mediaFeatureStore';
import {useSetSpeakerDiarizationResult} from '../../store/aiFeatureStore';
import {useSetOperationReplaySpeed, useSetOperationRecording, useSetOperationRecordingActive, useSetOperationReplayRunning, useSetOperationRecordingStep} from '../../store/timelineFeatureStore';
import type {ContentAnalysisTarget} from '../../media/ContentAnalysisDialog';
import type {VideoStitchWizardSettings} from '../../video-stitching/VideoStitchWizardDialog';
import {normalizeOperationReplaySpeed, UpdateClipCommand, createColorGradingNode, createEmptyColorGradingGraph, type OperationRecordingFile, type OperationReplaySpeed, type SpeakerDiarizationSegment, type TimelineColorAnalysisResult, type SceneColorDifference, type PerformanceProfilerReport} from '@open-factory/editor-core';
import {PanelLoading} from '../PanelLoading';

const LutEditorDialog = lazy(() =>
  import('../../lut-editor/LutEditorDialog').then((m) => ({ default: m.LutEditorDialog })),
);
const ColorNodeEditorDialog = lazy(() =>
  import('../../color-node-editor/ColorNodeEditorDialog').then((m) => ({ default: m.ColorNodeEditorDialog })),
);
const ColorAnalysisDialog = lazy(() =>
  import('../../color-analysis/ColorAnalysisDialog').then((m) => ({ default: m.ColorAnalysisDialog })),
);
const AudioSpectrumDialog = lazy(() => import('../../media/AudioSpectrumDialog'));
const VideoStitchWizardDialog = lazy(() =>
  import('../../video-stitching/VideoStitchWizardDialog').then((m) => ({ default: m.VideoStitchWizardDialog })),
);
const SceneReorderDialog = lazy(() =>
  import('../../scene-reorder/SceneReorderDialog').then((m) => ({ default: m.SceneReorderDialog })),
);
const StyleTransferDialog = lazy(() => import('../../style-transfer/StyleTransferDialog'));
const OperationReplayDialog = lazy(() => import('../../operation-recording/OperationReplayDialog'));
const SpeakerDiarizationDialog = lazy(() => import('../../speaker-diarization/SpeakerDiarizationDialog'));
const SmartRecommendationsDialog = lazy(() => import('../../smart-recommendations/SmartRecommendationsDialog'));
const ContentAnalysisDialog = lazy(() =>
  import('../../media/ContentAnalysisDialog').then((m) => ({ default: m.ContentAnalysisDialog })),
);
const ProfilerDialog = lazy(() => import('../../profiler/ProfilerDialog').then((m) => ({ default: m.ProfilerDialog })));
const RhythmAnalysisDialog = lazy(() =>
  import('../../analysis/RhythmAnalysisDialog').then((m) => ({ default: m.RhythmAnalysisDialog })),
);
const SmartMontageDialog = lazy(() =>
  import('../SmartMontage/SmartMontageDialog').then((m) => ({ default: m.SmartMontageDialog })),
);
const ColorGradingWorkspace = lazy(() =>
  import('../ColorGrading/ColorGradingWorkspace').then((m) => ({ default: m.ColorGradingWorkspace })),
);

export interface AnalysisDialogsProps {
  project: Project;
  selectedClip?: Clip;
  selectedClipId?: string;
  selectedClipIds: string[];
  commandManager: { execute: (command: Command) => void };
  timelineAccessor: TimelineAccessor;
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
  // Smart montage
  generateSmartMontage: (config: {
    videoAssetIds: string[];
    audioAssetId: string;
    beatTimes: number[];
    sensitivity: BeatSensitivity;
  }) => void;
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
  generateSmartMontage,
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
  // UI open/close states from useDialogStore
  const lutEditorOpen = useDialogStore((s) => s.lutEditorOpen);
  const setLutEditorOpen = useDialogStore((s) => s.setLutEditorOpen);
  const colorNodeEditorOpen = useDialogStore((s) => s.colorNodeEditorOpen);
  const setColorNodeEditorOpen = useDialogStore((s) => s.setColorNodeEditorOpen);
  const colorAnalysisOpen = useDialogStore((s) => s.colorAnalysisOpen);
  const setColorAnalysisOpen = useDialogStore((s) => s.setColorAnalysisOpen);
  const colorGradingWorkspaceOpen = useDialogStore((s) => s.colorGradingWorkspaceOpen);
  const setColorGradingWorkspaceOpen = useDialogStore((s) => s.setColorGradingWorkspaceOpen);
  // 协作查看者角色 → 调色工作台只读
  const collabPermission = useCollaborationStore((s) => s.permission);
  const videoStitchWizardOpen = useDialogStore((s) => s.videoStitchWizardOpen);
  const setVideoStitchWizardOpen = useDialogStore((s) => s.setVideoStitchWizardOpen);
  const sceneReorderOpen = useDialogStore((s) => s.sceneReorderOpen);
  const setSceneReorderOpen = useDialogStore((s) => s.setSceneReorderOpen);
  const styleTransferOpen = useDialogStore((s) => s.styleTransferOpen);
  const setStyleTransferOpen = useDialogStore((s) => s.setStyleTransferOpen);
  const operationRecordingOpen = useDialogStore((s) => s.operationRecordingOpen);
  const setOperationRecordingOpen = useDialogStore((s) => s.setOperationRecordingOpen);
  const smartRecommendationsOpen = useDialogStore((s) => s.smartRecommendationsOpen);
  const setSmartRecommendationsOpen = useDialogStore((s) => s.setSmartRecommendationsOpen);
  const contentAnalysisOpen = useDialogStore((s) => s.contentAnalysisOpen);
  const setContentAnalysisOpen = useDialogStore((s) => s.setContentAnalysisOpen);
  const profilerOpen = useDialogStore((s) => s.profilerOpen);
  const setProfilerOpen = useDialogStore((s) => s.setProfilerOpen);
  const rhythmAnalysisOpen = useDialogStore((s) => s.rhythmAnalysisOpen);
  const setRhythmAnalysisOpen = useDialogStore((s) => s.setRhythmAnalysisOpen);
  const smartMontageOpen = useDialogStore((s) => s.smartMontageOpen);
  const setSmartMontageOpen = useDialogStore((s) => s.setSmartMontageOpen);

  // Data from sub-store selector hooks
  const spectrumAsset = useSpectrumAsset();
  const setSpectrumAsset = useSetSpectrumAsset();
  const setOperationReplaySpeed = useSetOperationReplaySpeed();
  const setSpeakerDiarizationResult = useSetSpeakerDiarizationResult();
  const setOperationRecording = useSetOperationRecording();
  const setOperationRecordingActive = useSetOperationRecordingActive();
  const setOperationReplayRunning = useSetOperationReplayRunning();
  const setOperationRecordingStep = useSetOperationRecordingStep();

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
      {colorGradingWorkspaceOpen ? (
        <ColorGradingWorkspaceDialog
          clip={selectedClip && selectedClip.type !== 'audio' ? selectedClip : undefined}
          readOnly={collabPermission === 'read-only'}
          onPersistGraph={(clipId, graph) => {
            commandManager.execute(new UpdateClipCommand(timelineAccessor, clipId, { colorGradingGraph: graph }));
          }}
          onClose={() => setColorGradingWorkspaceOpen(false)}
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
        <SceneReorderDialog
          project={project}
          selectedClipIds={selectedClipIds}
          onClose={() => setSceneReorderOpen(false)}
        />
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
        <SmartRecommendationsDialog
          project={project}
          onAddToTimeline={addAssetToTimeline}
          onClose={() => setSmartRecommendationsOpen(false)}
        />
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
      {smartMontageOpen ? (
        <SmartMontageDialog
          media={project.media}
          onGenerate={(config) => void generateSmartMontage(config)}
          onClose={() => setSmartMontageOpen(false)}
        />
      ) : null}
    </Suspense>
  );
}

/** 独立调色工作台：无节点时注入默认 primary-wheel 节点，保证色轮始终可见。 */
function buildInitialColorGradingGraph(clip?: Clip): ColorGradingGraph {
  const existing = clip?.colorGradingGraph;
  if (existing && existing.nodes.length > 0) {
    return existing;
  }
  const node = createColorGradingNode('primary-wheel', { x: 60, y: 60 });
  return { ...createEmptyColorGradingGraph(), nodes: [node], activeNodeId: node.id };
}

function ColorGradingWorkspaceDialog({
  clip,
  readOnly,
  onPersistGraph,
  onClose,
}: {
  clip?: Clip;
  readOnly: boolean;
  onPersistGraph: (clipId: string, graph: ColorGradingGraph) => void;
  onClose: () => void;
}) {
  const initialGraph = useMemo(() => buildInitialColorGradingGraph(clip), [clip]);
  const [graph, setGraph] = useState<ColorGradingGraph>(initialGraph);

  const handleChange = (next: ColorGradingGraph) => {
    setGraph(next);
    if (clip) {
      onPersistGraph(clip.id, next);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="color-grading-dialog">
      <section className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-line bg-gray-900 shadow-soft">
        <header className="flex items-center justify-between gap-3 border-b border-gray-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-100">{zhCN.toolbar.colorGradingWorkspace}</h2>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 text-gray-300 hover:bg-gray-800"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="color-grading-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <div className="min-h-[420px] flex-1 overflow-hidden">
          <ColorGradingWorkspace graph={graph} onGraphChange={handleChange} readOnly={readOnly} />
        </div>
      </section>
    </div>
  );
}
