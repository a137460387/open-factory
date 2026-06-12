import { useEffect } from 'react';
import { resolveClipMacroShortcut, type ClipMacro } from '../macros/clip-macros';

export function useMacroShortcuts(macros: ClipMacro[], onExecute: (macro: ClipMacro) => void | Promise<void>): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.tagName === 'BUTTON' ||
        target?.isContentEditable;

      const macro = resolveClipMacroShortcut(
        {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          isTyping
        },
        macros
      );
      if (!macro) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void onExecute(macro);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [macros, onExecute]);
}
