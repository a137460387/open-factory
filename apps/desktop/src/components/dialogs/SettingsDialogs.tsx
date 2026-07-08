import { lazy, Suspense } from 'react';
import { getTimelineDuration } from '@open-factory/editor-core';
import type { Project, Clip } from '@open-factory/editor-core';
import { useEditorUIStore } from '../../store/editorUIStore';
import { useEditorFeatureStore } from '../../store/editorFeatureStore';
import type { TimelineShortcutBindings } from '../../shortcuts/timeline-shortcuts';
import type { ClipMacro, MacroHistoryEntry } from '../../macros/clip-macros';
import type {
  PreviewPerformanceSettings,
  PreviewSkipFrames,
} from '../../lib/preview/preview-performance';
import type { TimelineInteractionSettings } from '../../settings/appSettings';
import { PanelLoading } from '../PanelLoading';

const SettingsDialog = lazy(() =>
  import('../../settings/SettingsDialog').then((m) => ({ default: m.SettingsDialog }))
);
const MacroHistoryDialog = lazy(() =>
  import('../../macros/MacroHistoryDialog').then((m) => ({ default: m.MacroHistoryDialog }))
);
const ErrorKnowledgeDialog = lazy(() =>
  import('../../export-error-knowledge/ErrorKnowledgeDialog').then((m) => ({
    default: m.ErrorKnowledgeDialog,
  }))
);
const SequenceCompareDialog = lazy(() =>
  import('../../sequence-compare/SequenceCompareDialog').then((m) => ({
    default: m.SequenceCompareDialog,
  }))
);
const SubtitleSyncPanel = lazy(() =>
  import('../../subtitle-sync-monitor/SubtitleSyncPanel').then((m) => ({
    default: m.SubtitleSyncPanel,
  }))
);
const ProxyBatchVerifyDialog = lazy(() =>
  import('../../proxy-batch-verify/ProxyBatchVerifyDialog').then((m) => ({
    default: m.ProxyBatchVerifyDialog,
  }))
);
const FormatConverterDialog = lazy(() =>
  import('../FormatConverterDialog').then((m) => ({ default: m.FormatConverterDialog }))
);
const EmotionAnalysisPanel = lazy(() =>
  import('../EmotionAnalysisPanel').then((m) => ({ default: m.EmotionAnalysisPanel }))
);
const ExportHistoryClassifierPanel = lazy(() =>
  import('../ExportHistoryClassifierPanel').then((m) => ({
    default: m.ExportHistoryClassifierPanel,
  }))
);

type Updater<T> = T | ((current: T) => T);

export interface SettingsDialogsProps {
  project: Project;
  selectedClip?: Clip;
  shortcutBindings: TimelineShortcutBindings;
  macros: ClipMacro[];
  previewPerformance: PreviewPerformanceSettings;
  timelineInteractionSettings: TimelineInteractionSettings;
  onShortcutBindingsChange: (updater: Updater<TimelineShortcutBindings>) => void;
  onMacrosChange: (updater: Updater<ClipMacro[]>) => void;
  onExecuteMacro: (macro: ClipMacro) => void;
  onPreviewPerformanceChange: (patch: Partial<PreviewPerformanceSettings>) => void;
  onPreviewSkipFramesChange: (skipFrames: PreviewSkipFrames) => void;
  onTimelineInteractionSettingsChange: (patch: Partial<TimelineInteractionSettings>) => void;
  onDeleteProxies: (assetIds: string[]) => void;
  onRegenerateProxies: (assetIds: string[]) => void;
  onMigrateProxies: (targetDirectory: string) => void;
  onRepairSubtitle: (id: string, start: number, duration: number) => void;
}

export function SettingsDialogs({
  project,
  selectedClip,
  shortcutBindings,
  macros,
  previewPerformance,
  timelineInteractionSettings,
  onShortcutBindingsChange,
  onMacrosChange,
  onExecuteMacro,
  onPreviewPerformanceChange,
  onPreviewSkipFramesChange,
  onTimelineInteractionSettingsChange,
  onDeleteProxies,
  onRegenerateProxies,
  onMigrateProxies,
  onRepairSubtitle,
}: SettingsDialogsProps) {
  const settingsOpen = useEditorUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useEditorUIStore((s) => s.setSettingsOpen);
  const macroHistoryOpen = useEditorUIStore((s) => s.macroHistoryOpen);
  const setMacroHistoryOpen = useEditorUIStore((s) => s.setMacroHistoryOpen);
  const errorKnowledgeOpen = useEditorUIStore((s) => s.errorKnowledgeOpen);
  const setErrorKnowledgeOpen = useEditorUIStore((s) => s.setErrorKnowledgeOpen);
  const sequenceCompareOpen = useEditorUIStore((s) => s.sequenceCompareOpen);
  const setSequenceCompareOpen = useEditorUIStore((s) => s.setSequenceCompareOpen);
  const subtitleSyncOpen = useEditorUIStore((s) => s.subtitleSyncOpen);
  const setSubtitleSyncOpen = useEditorUIStore((s) => s.setSubtitleSyncOpen);
  const proxyVerifyOpen = useEditorUIStore((s) => s.proxyVerifyOpen);
  const setProxyVerifyOpen = useEditorUIStore((s) => s.setProxyVerifyOpen);
  const formatConverterOpen = useEditorUIStore((s) => s.formatConverterOpen);
  const setFormatConverterOpen = useEditorUIStore((s) => s.setFormatConverterOpen);
  const emotionAnalysisOpen = useEditorUIStore((s) => s.emotionAnalysisOpen);
  const setEmotionAnalysisOpen = useEditorUIStore((s) => s.setEmotionAnalysisOpen);
  const exportHistoryClassifierOpen = useEditorUIStore((s) => s.exportHistoryClassifierOpen);
  const setExportHistoryClassifierOpen = useEditorUIStore((s) => s.setExportHistoryClassifierOpen);

  const macroHistory = useEditorFeatureStore((s) => s.macroHistory);
  const formatConverterMockFiles = useEditorFeatureStore((s) => s.formatConverterMockFiles);
  const mockSubtitleClips = useEditorFeatureStore((s) => s.mockSubtitleClips);
  const mockExportHistory = useEditorFeatureStore((s) => s.mockExportHistory);

  return (
    <Suspense fallback={<PanelLoading label="设置" />}>
      {settingsOpen ? (
        <SettingsDialog
          open={settingsOpen}
          project={project}
          selectedClip={selectedClip}
          shortcutBindings={shortcutBindings}
          macros={macros}
          onShortcutBindingsChange={onShortcutBindingsChange}
          onMacrosChange={onMacrosChange}
          onExecuteMacro={(macro) => void onExecuteMacro(macro)}
          previewPerformance={previewPerformance}
          timelineInteractionSettings={timelineInteractionSettings}
          onPreviewPerformanceChange={onPreviewPerformanceChange}
          onPreviewSkipFramesChange={(skipFrames: PreviewSkipFrames) => onPreviewSkipFramesChange(skipFrames)}
          onTimelineInteractionSettingsChange={onTimelineInteractionSettingsChange}
          onDeleteProxies={(assetIds) => onDeleteProxies(assetIds)}
          onRegenerateProxies={(assetIds) => onRegenerateProxies(assetIds)}
          onMigrateProxies={(targetDirectory) => onMigrateProxies(targetDirectory)}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {macroHistoryOpen ? (
        <MacroHistoryDialog entries={macroHistory} onClose={() => setMacroHistoryOpen(false)} />
      ) : null}
      {errorKnowledgeOpen ? (
        <ErrorKnowledgeDialog stderr={""} onClose={() => setErrorKnowledgeOpen(false)} />
      ) : null}
      {sequenceCompareOpen ? (
        <SequenceCompareDialog project={project} onClose={() => setSequenceCompareOpen(false)} />
      ) : null}
      {subtitleSyncOpen ? (
        <SubtitleSyncPanel
          tracks={project.timeline.tracks}
          timingRefs={[]}
          projectDuration={getTimelineDuration(project.timeline)}
          onClose={() => setSubtitleSyncOpen(false)}
          onRepairSubtitle={onRepairSubtitle}
        />
      ) : null}
      {proxyVerifyOpen ? (
        <ProxyBatchVerifyDialog media={project.media} onClose={() => setProxyVerifyOpen(false)} />
      ) : null}
      {formatConverterOpen ? (
        <FormatConverterDialog
          open={formatConverterOpen}
          onClose={() => setFormatConverterOpen(false)}
          initialFiles={formatConverterMockFiles}
        />
      ) : null}
      {emotionAnalysisOpen ? (
        <EmotionAnalysisPanel
          open={emotionAnalysisOpen}
          onClose={() => setEmotionAnalysisOpen(false)}
          subtitleClips={mockSubtitleClips}
          onApplyStyles={() => {}}
        />
      ) : null}
      {exportHistoryClassifierOpen ? (
        <ExportHistoryClassifierPanel
          open={exportHistoryClassifierOpen}
          onClose={() => setExportHistoryClassifierOpen(false)}
          history={mockExportHistory}
        />
      ) : null}
    </Suspense>
  );
}
