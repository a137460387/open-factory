import { lazy, Suspense } from 'react';

const GestureTutorialOverlay = lazy(() =>
  import('../GestureControl/GestureTutorial').then((module) => ({ default: module.GestureTutorialOverlay })),
);

interface GestureTutorialPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 手势教程面板组件。
 * 从 EditorShell 中提取，负责渲染 GestureTutorialOverlay。
 */
export function GestureTutorialPanel({ open, onClose }: GestureTutorialPanelProps) {
  return (
    <Suspense fallback={null}>
      <GestureTutorialOverlay open={open} onClose={onClose} />
    </Suspense>
  );
}
