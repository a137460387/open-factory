import { lazy, Suspense } from 'react';
import { getTimelineDuration, type Project } from '@open-factory/editor-core';

const RoughCutComparePanelComponent = lazy(() =>
  import('../SmartRoughCut/RoughCutComparePanel').then((module) => ({ default: module.RoughCutComparePanel })),
);

interface RoughCutComparePanelWrapperProps {
  open: boolean;
  project: Project;
  onClose: () => void;
}

/**
 * 粗剪对比面板组件。
 * 从 EditorShell 中提取，负责渲染 RoughCutComparePanel。
 */
export function RoughCutComparePanelWrapper({ open, project, onClose }: RoughCutComparePanelWrapperProps) {
  if (!open || !project) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <RoughCutComparePanelComponent
          highlights={[]}
          rhythmResult={null}
          sourceDuration={getTimelineDuration(project.timeline)}
          onApply={onClose}
          onClose={onClose}
        />
      </div>
    </Suspense>
  );
}
