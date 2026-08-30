import {
  Activity,
  Archive,
  Camera,
  ClipboardList,
  GitCompareArrows,
  History,
  ImageDown,
  Mic2,
  Palette,
  Scissors,
  Wand2,
  WandSparkles,
  MessageSquareText,
} from 'lucide-react';
import type { BeatSensitivity } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { featureStrings } from '../../i18n/featureStrings';
import { MenuDropdown, MenuItem, MenuSeparator } from './MenuDropdown';

export function ToolsMenu({
  open,
  onToggle,
  canOpenSyncCompare,
  canOpenSceneDetection,
  canOpenSceneReorder,
  canDetectBeats,
  canSnapToBeats,
  canSplitToBeats,
  canOpenAutoAudioSync,
  canSeparateAudio,
  audioSeparationRunning,
  audioSeparationProgress,
  canRunSpeakerDiarization,
  speakerDiarizationRunning,
  autoAudioSyncRunning,
  macroRecordingActive,
  macroRecordingStepCount,
  beatSensitivity,
  onBeatSensitivityChange,
  onBatchTranscode,
  onOpenBatchWatermark,
  onOpenBatchProjectProcessing,
  onOpenMediaPrecheck,
  onOpenProxyVerify,
  onOpenMediaOrganizer,
  onOpenMediaHealthDashboard,
  onOpenVideoStitchWizard,
  onOpenSmartMontage,
  onAddMotionGraphic,
  onOpenThumbnailGenerator,
  onOpenLutEditor,
  onOpenColorNodeEditor,
  onOpenColorAnalysis,
  onOpenErrorKnowledge,
  onOpenFormatConverter,
  onOpenEmotionAnalysis,
  onOpenExportHistoryClassifier,
  onOpenSyncCompare,
  onOpenSceneReorder,
  onOpenSceneDetection,
  onOpenStyleTransfer,
  onOpenCollaborationNotes,
  onOpenCollaborationPanel,
  onOpenColorGradingWorkspace,
  onOpenOperationRecording,
  onOpenComplexityScore,
  onOpenSmartRecommendations,
  onOpenContentAnalysis,
  onOpenPerformanceProfiler,
  onOpenRhythmAnalysis,
  onOpenSubtitleSync,
  onOpenBeatSync,
  onDetectBeats,
  onSnapToBeats,
  onSplitToBeats,
  onSeparateAudio,
  onCancelAudioSeparation,
  onRunSpeakerDiarization,
  onOpenAutoAudioSync,
  onGenerateNarration,
  onOpenAssistEditing,
  onOpenContentGeneration,
  onOpenQualityAssessment,
  onOpenMacroHistory,
  onStartMacroRecording,
  onStopMacroRecording,
}: {
  open: boolean;
  onToggle(): void;
  canOpenSyncCompare: boolean;
  canOpenSceneDetection: boolean;
  canOpenSceneReorder: boolean;
  canDetectBeats: boolean;
  canSnapToBeats: boolean;
  canSplitToBeats: boolean;
  canOpenAutoAudioSync: boolean;
  canSeparateAudio: boolean;
  audioSeparationRunning: boolean;
  audioSeparationProgress?: number;
  canRunSpeakerDiarization: boolean;
  speakerDiarizationRunning: boolean;
  autoAudioSyncRunning: boolean;
  macroRecordingActive: boolean;
  macroRecordingStepCount: number;
  beatSensitivity: BeatSensitivity;
  onBeatSensitivityChange(sensitivity: BeatSensitivity): void;
  onBatchTranscode(): void;
  onOpenBatchWatermark(): void;
  onOpenBatchProjectProcessing(): void;
  onOpenMediaPrecheck(): void;
  onOpenProxyVerify(): void;
  onOpenMediaOrganizer(): void;
  onOpenMediaHealthDashboard(): void;
  onOpenVideoStitchWizard(): void;
  onOpenSmartMontage(): void;
  onAddMotionGraphic(): void;
  onOpenThumbnailGenerator(): void;
  onOpenLutEditor(): void;
  onOpenColorNodeEditor(): void;
  onOpenColorAnalysis(): void;
  onOpenErrorKnowledge(): void;
  onOpenFormatConverter(): void;
  onOpenEmotionAnalysis(): void;
  onOpenExportHistoryClassifier(): void;
  onOpenSyncCompare(): void;
  onOpenSceneReorder(): void;
  onOpenSceneDetection(): void;
  onOpenStyleTransfer(): void;
  onOpenCollaborationNotes(): void;
  onOpenCollaborationPanel(): void;
  onOpenColorGradingWorkspace(): void;
  onOpenOperationRecording(): void;
  onOpenComplexityScore(): void;
  onOpenSmartRecommendations(): void;
  onOpenContentAnalysis(): void;
  onOpenPerformanceProfiler(): void;
  onOpenRhythmAnalysis(): void;
  onOpenSubtitleSync(): void;
  onOpenBeatSync(): void;
  onDetectBeats(): void;
  onSnapToBeats(): void;
  onSplitToBeats(): void;
  onSeparateAudio(): void;
  onCancelAudioSeparation(): void;
  onRunSpeakerDiarization(): void;
  onOpenAutoAudioSync(): void;
  onGenerateNarration(): void;
  onOpenAssistEditing(): void;
  onOpenContentGeneration(): void;
  onOpenQualityAssessment(): void;
  onOpenMacroHistory(): void;
  onStartMacroRecording(): void;
  onStopMacroRecording(): void;
}) {
  const t = zhCN.toolbar;
  const close = () => onToggle();
  return (
    <MenuDropdown label={t.toolsMenu} open={open} onToggle={onToggle} testId="toolbar-tools-menu-button">
      <MenuItem
        label={t.batchTranscode}
        testId="toolbar-tools-batch-transcode-menu-item"
        onClick={() => {
          close();
          onBatchTranscode();
        }}
      />
      <MenuItem
        label={t.batchWatermark}
        testId="toolbar-tools-batch-watermark-menu-item"
        icon={<ImageDown size={14} />}
        onClick={() => {
          close();
          onOpenBatchWatermark();
        }}
      />
      <MenuItem
        label={t.batchProjectProcessing}
        testId="toolbar-tools-batch-project-menu-item"
        icon={<ClipboardList size={14} />}
        onClick={() => {
          close();
          onOpenBatchProjectProcessing();
        }}
      />
      <MenuItem
        label={t.mediaPrecheck}
        testId="toolbar-tools-media-precheck-menu-item"
        onClick={() => {
          close();
          onOpenMediaPrecheck();
        }}
      />
      <MenuItem
        label={zhCN.proxyBatchVerify.title}
        testId="toolbar-tools-proxy-verify-menu-item"
        onClick={() => {
          close();
          onOpenProxyVerify();
        }}
      />
      <MenuItem
        label={t.mediaOrganizer}
        testId="toolbar-tools-media-organizer-menu-item"
        icon={<Archive size={14} />}
        onClick={() => {
          close();
          onOpenMediaOrganizer();
        }}
      />
      <MenuItem
        label={t.mediaHealthDashboard}
        testId="toolbar-tools-media-health-dashboard-menu-item"
        icon={<Activity size={14} />}
        onClick={() => {
          close();
          onOpenMediaHealthDashboard();
        }}
      />
      <MenuItem
        label={t.videoStitchWizard}
        testId="toolbar-tools-video-stitch-menu-item"
        onClick={() => {
          close();
          onOpenVideoStitchWizard();
        }}
      />
      <MenuItem
        label="AI 智能混剪"
        testId="toolbar-tools-smart-montage-menu-item"
        icon={<Wand2 size={14} />}
        onClick={() => {
          close();
          onOpenSmartMontage();
        }}
      />
      <MenuItem
        label={t.motionGraphic}
        testId="toolbar-tools-motion-graphic-menu-item"
        icon={<WandSparkles size={14} />}
        onClick={() => {
          close();
          onAddMotionGraphic();
        }}
      />
      <MenuItem
        label={t.thumbnailGenerator}
        testId="toolbar-tools-thumbnail-generator-menu-item"
        icon={<Camera size={14} />}
        onClick={() => {
          close();
          onOpenThumbnailGenerator();
        }}
      />
      <MenuItem
        label={t.lutEditor}
        testId="toolbar-tools-lut-editor-menu-item"
        icon={<WandSparkles size={14} />}
        onClick={() => {
          close();
          onOpenLutEditor();
        }}
      />
      <MenuItem
        label={t.colorNodeEditor}
        testId="toolbar-tools-color-node-editor-menu-item"
        icon={<GitCompareArrows size={14} />}
        onClick={() => {
          close();
          onOpenColorNodeEditor();
        }}
      />
      <MenuItem
        label={t.colorAnalysis}
        testId="toolbar-tools-color-analysis-menu-item"
        icon={<Activity size={14} />}
        onClick={() => {
          close();
          onOpenColorAnalysis();
        }}
      />
      <MenuItem
        label={zhCN.errorKnowledge.title}
        testId="toolbar-tools-error-knowledge-menu-item"
        onClick={() => {
          close();
          onOpenErrorKnowledge();
        }}
      />
      <MenuItem
        label={featureStrings.formatConverter.title}
        testId="toolbar-tools-format-converter-menu-item"
        icon={<Wand2 size={14} />}
        onClick={() => {
          close();
          onOpenFormatConverter();
        }}
      />
      <MenuItem
        label={featureStrings.subtitleEmotion.title}
        testId="toolbar-tools-emotion-analysis-menu-item"
        icon={<Palette size={14} />}
        onClick={() => {
          close();
          onOpenEmotionAnalysis();
        }}
      />
      <MenuItem
        label={featureStrings.exportHistory.title}
        testId="toolbar-tools-export-history-menu-item"
        icon={<History size={14} />}
        onClick={() => {
          close();
          onOpenExportHistoryClassifier();
        }}
      />
      <MenuItem
        label={t.syncCompare}
        testId="toolbar-tools-sync-compare-menu-item"
        disabled={!canOpenSyncCompare}
        icon={<GitCompareArrows size={14} />}
        onClick={() => {
          close();
          onOpenSyncCompare();
        }}
      />
      <MenuItem
        label={t.sceneReorder}
        testId="toolbar-tools-scene-reorder-menu-item"
        disabled={!canOpenSceneReorder}
        icon={<WandSparkles size={14} />}
        onClick={() => {
          close();
          onOpenSceneReorder();
        }}
      />
      <MenuItem
        label={t.sceneDetection}
        testId="toolbar-tools-scene-detection-menu-item"
        disabled={!canOpenSceneDetection}
        icon={<Scissors size={14} />}
        onClick={() => {
          close();
          onOpenSceneDetection();
        }}
      />
      <MenuItem
        label={t.styleTransfer}
        testId="toolbar-tools-style-transfer-menu-item"
        icon={<WandSparkles size={14} />}
        onClick={() => {
          close();
          onOpenStyleTransfer();
        }}
      />
      <MenuItem
        label={t.collaborationNotes}
        testId="toolbar-tools-collaboration-notes-menu-item"
        icon={<MessageSquareText size={14} />}
        onClick={() => {
          close();
          onOpenCollaborationNotes();
        }}
      />
      <MenuItem
        label={t.collaborationPanel}
        testId="toolbar-tools-collaboration-menu-item"
        icon={<MessageSquareText size={14} />}
        onClick={() => {
          close();
          onOpenCollaborationPanel();
        }}
      />
      <MenuItem
        label={t.colorGradingWorkspace}
        testId="toolbar-tools-color-grading-menu-item"
        icon={<Palette size={14} />}
        onClick={() => {
          close();
          onOpenColorGradingWorkspace();
        }}
      />
      <MenuItem
        label={t.operationRecording}
        testId="toolbar-tools-operation-recording-menu-item"
        icon={<History size={14} />}
        onClick={() => {
          close();
          onOpenOperationRecording();
        }}
      />
      <MenuItem
        label={t.complexityScore}
        testId="toolbar-tools-complexity-score-menu-item"
        icon={<Activity size={14} />}
        onClick={() => {
          close();
          onOpenComplexityScore();
        }}
      />
      <MenuItem
        label={t.smartRecommendations}
        testId="toolbar-tools-smart-recommendations-menu-item"
        icon={<WandSparkles size={14} />}
        onClick={() => {
          close();
          onOpenSmartRecommendations();
        }}
      />
      <MenuItem
        label={t.contentAnalysis}
        testId="toolbar-tools-content-analysis-menu-item"
        icon={<Activity size={14} />}
        onClick={() => {
          close();
          onOpenContentAnalysis();
        }}
      />
      <MenuItem
        label={t.performanceProfiler}
        testId="toolbar-tools-performance-profiler-menu-item"
        icon={<Activity size={14} />}
        onClick={() => {
          close();
          onOpenPerformanceProfiler();
        }}
      />
      <MenuItem
        label={t.rhythmAnalysis}
        testId="toolbar-tools-rhythm-analysis-menu-item"
        icon={<Activity size={14} />}
        onClick={() => {
          close();
          onOpenRhythmAnalysis();
        }}
      />
      <MenuItem
        label={zhCN.subtitleSyncMonitor.title}
        testId="toolbar-tools-subtitle-sync-menu-item"
        onClick={() => {
          close();
          onOpenSubtitleSync();
        }}
      />
      <MenuItem
        label={t.beatSync}
        testId="toolbar-tools-beat-sync-menu-item"
        icon={<Activity size={14} />}
        onClick={() => {
          close();
          onOpenBeatSync();
        }}
      />
      <BeatSensitivityRow sensitivity={beatSensitivity} onChange={onBeatSensitivityChange} />
      <MenuItem
        label={t.detectBeats}
        testId="toolbar-tools-detect-beats-menu-item"
        disabled={!canDetectBeats}
        onClick={() => {
          close();
          onDetectBeats();
        }}
      />
      <MenuItem
        label={t.snapToBeats}
        testId="toolbar-tools-snap-to-beats-menu-item"
        disabled={!canSnapToBeats}
        onClick={() => {
          close();
          onSnapToBeats();
        }}
      />
      <MenuItem
        label={t.splitToBeats}
        testId="toolbar-tools-split-to-beats-menu-item"
        disabled={!canSplitToBeats}
        onClick={() => {
          close();
          onSplitToBeats();
        }}
      />
      <MenuItem
        label={audioSeparationRunning ? t.cancelAudioSeparation : t.audioSeparation}
        testId="toolbar-tools-audio-separation-menu-item"
        disabled={!canSeparateAudio && !audioSeparationRunning}
        icon={
          audioSeparationRunning && audioSeparationProgress !== undefined ? (
            <span className="text-xs text-slate-500">{Math.round(audioSeparationProgress * 100)}%</span>
          ) : undefined
        }
        onClick={() => {
          close();
          if (audioSeparationRunning) onCancelAudioSeparation();
          else onSeparateAudio();
        }}
      />
      <MenuItem
        label={t.speakerDiarization}
        testId="toolbar-tools-speaker-diarization-menu-item"
        disabled={!canRunSpeakerDiarization || speakerDiarizationRunning}
        icon={<Mic2 size={14} />}
        onClick={() => {
          close();
          onRunSpeakerDiarization();
        }}
      />
      <MenuItem
        label={t.autoAudioSync}
        testId="toolbar-tools-auto-audio-sync-menu-item"
        disabled={!canOpenAutoAudioSync || autoAudioSyncRunning}
        icon={<Activity size={14} />}
        onClick={() => {
          close();
          onOpenAutoAudioSync();
        }}
      />
      <MenuItem
        label={zhCN.aiNarration.title}
        testId="toolbar-tools-narration-menu-item"
        onClick={() => {
          close();
          onGenerateNarration();
        }}
      />
      <MenuItem
        label="AI 辅助剪辑"
        testId="toolbar-tools-assist-editing-menu-item"
        onClick={() => {
          close();
          onOpenAssistEditing();
        }}
      />
      <MenuItem
        label="AI 内容生成"
        testId="toolbar-tools-content-generation-menu-item"
        onClick={() => {
          close();
          onOpenContentGeneration();
        }}
      />
      <MenuItem
        label="AI 质量评估"
        testId="toolbar-tools-quality-assessment-menu-item"
        onClick={() => {
          close();
          onOpenQualityAssessment();
        }}
      />
      <MenuItem
        label={t.macroHistory}
        testId="toolbar-tools-macro-history-menu-item"
        onClick={() => {
          close();
          onOpenMacroHistory();
        }}
      />
      <MenuItem
        label={t.startMacroRecording}
        testId="toolbar-tools-start-macro-recording-menu-item"
        disabled={macroRecordingActive}
        onClick={() => {
          close();
          onStartMacroRecording();
        }}
      />
      <MenuItem
        label={t.stopMacroRecording}
        testId="toolbar-tools-stop-macro-recording-menu-item"
        disabled={!macroRecordingActive}
        icon={<span className="text-xs text-slate-500">{t.macroRecordingSteps(macroRecordingStepCount)}</span>}
        onClick={() => {
          close();
          onStopMacroRecording();
        }}
      />
    </MenuDropdown>
  );
}

function BeatSensitivityRow({
  sensitivity,
  onChange,
}: {
  sensitivity: BeatSensitivity;
  onChange(sensitivity: BeatSensitivity): void;
}) {
  const t = zhCN.toolbar;
  return (
    <label
      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs text-slate-600"
      data-testid="toolbar-tools-beat-sensitivity-row"
    >
      <span>{t.beatSensitivity}</span>
      <select
        className="rounded border border-line bg-white px-2 py-1 text-xs text-slate-700"
        value={sensitivity}
        data-testid="toolbar-tools-beat-sensitivity-select"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onChange(event.target.value as BeatSensitivity)}
      >
        <option value="low">{t.beatSensitivityOptions.low}</option>
        <option value="medium">{t.beatSensitivityOptions.medium}</option>
        <option value="high">{t.beatSensitivityOptions.high}</option>
      </select>
    </label>
  );
}
