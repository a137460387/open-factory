import { lazy, Suspense } from 'react';
import type { ParsedCommand } from '@open-factory/editor-core/natural-language-commands';

const CommandPalette = lazy(() =>
  import('../CommandPalette/CommandPalette').then((module) => ({ default: module.CommandPalette })),
);

interface CommandPalettePanelProps {
  open: boolean;
  onClose: () => void;
  onExecute: (cmd: ParsedCommand) => void;
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
