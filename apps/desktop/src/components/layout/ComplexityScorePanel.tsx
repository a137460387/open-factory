import { lazy, Suspense } from 'react';
import type { Project } from '@open-factory/editor-core';

const ComplexityScorePanelComponent = lazy(() =>
  import('../../complexity/ComplexityScorePanel').then((module) => ({ default: module.ComplexityScorePanel })),
);

interface ComplexityScorePanelWrapperProps {
  open: boolean;
  project: Project;
  onClose: () => void;
}

/**
 * 复杂度评分面板组件。
 * 从 EditorShell 中提取，负责渲染 ComplexityScorePanel。
 */
export function ComplexityScorePanelWrapper({ open, project, onClose }: ComplexityScorePanelWrapperProps) {
  if (!open) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ComplexityScorePanelComponent project={project} onClose={onClose} />
    </Suspense>
  );
}
