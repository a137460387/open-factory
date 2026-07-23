import { lazy, Suspense } from 'react';

const ComplexityScorePanelComponent = lazy(() =>
  import('../../complexity/ComplexityScorePanel').then((module) => ({ default: module.ComplexityScorePanel })),
);

interface ComplexityScorePanelWrapperProps {
  open: boolean;
  project: any;
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
