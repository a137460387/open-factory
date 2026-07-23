import { PerformanceAlertIcon } from '../PerformanceAlertIcon';

/**
 * 性能警告面板组件。
 * 从 EditorShell 中提取，负责渲染 PerformanceAlertIcon。
 */
export function PerformanceAlertPanel() {
  return (
    <div className="absolute right-3 top-2 z-10">
      <PerformanceAlertIcon />
    </div>
  );
}
