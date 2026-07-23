import { lazy, Suspense } from 'react';
import type { AutoAudioSyncApplyMode, AutoAudioSyncResult } from '@open-factory/editor-core';

const AutoAudioSyncDialogComponent = lazy(() =>
  import('../../audio-sync/AutoAudioSyncDialog').then((module) => ({ default: module.AutoAudioSyncDialog })),
);

interface AutoAudioSyncPanelProps {
  open: boolean;
  targets: any[];
  primaryClipId: string;
  mode: AutoAudioSyncApplyMode;
  running: boolean;
  results: AutoAudioSyncResult[];
  onPrimaryChange: (clipId: string) => void;
  onModeChange: (mode: AutoAudioSyncApplyMode) => void;
  onAnalyze: () => void;
  onApply: () => void;
  onClose: () => void;
}

/**
 * 自动音频同步面板组件。
 * 从 EditorShell 中提取，负责渲染 AutoAudioSyncDialog。
 */
export function AutoAudioSyncPanel({
  open,
  targets,
  primaryClipId,
  mode,
  running,
  results,
  onPrimaryChange,
  onModeChange,
  onAnalyze,
  onApply,
  onClose,
}: AutoAudioSyncPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AutoAudioSyncDialogComponent
        targets={targets}
        primaryClipId={primaryClipId}
        mode={mode}
        running={running}
        results={results}
        onPrimaryChange={onPrimaryChange}
        onModeChange={onModeChange}
        onAnalyze={onAnalyze}
        onApply={onApply}
        onClose={onClose}
      />
    </Suspense>
  );
}
