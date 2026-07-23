import { lazy, Suspense } from 'react';

const CommandPalette = lazy(() =>
  import('./CommandPalette/CommandPalette').then((module) => ({ default: module.CommandPalette })),
);

interface CommandPalettePanelProps {
  open: boolean;
  onClose: () => void;
  onExecute: (cmd: any) => void;
}

/**
 * 命令面板组件。
 * 从 EditorShell 中提取，负责渲染 CommandPalette。
 */
export function CommandPalettePanel({ open, onClose, onExecute }: CommandPalettePanelProps) {
  return (
    <Suspense fallback={null}>
      <CommandPalette open={open} onClose={onClose} onExecute={onExecute} />
    </Suspense>
  );
}
