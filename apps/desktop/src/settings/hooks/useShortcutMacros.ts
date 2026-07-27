import {useState, useEffect, useMemo, useCallback} from 'react';
import {showToast} from '../../lib/toast';
import {
  writeCustomKeybindings,
} from '../../shortcuts/keybindings';
import {
  eventToAccelerator,
  getEffectiveTimelineShortcutBindings,
  detectTimelineShortcutConflicts,
  type TimelineShortcutAction,
  type TimelineShortcutBindings,
} from '../../shortcuts/timeline-shortcuts';
import {
  writeClipMacros,
  importClipMacrosFromDialog,
  exportClipMacrosToDialog,
  parseCommandSnapshotsJson,
  detectMacroShortcutConflicts,
  type ClipMacro,
  type CommandSnapshot,
  type MacroShortcutConflict,
} from '../../macros/clip-macros';
import {zhCN} from '../../i18n/strings';

export function useShortcutMacros(
  shortcutBindings: TimelineShortcutBindings,
  onShortcutBindingsChange: (bindings: TimelineShortcutBindings) => void,
  macros: ClipMacro[],
  onMacrosChange: (macros: ClipMacro[]) => void,
) {
  const t = zhCN.settings;
  const [capturingAction, setCapturingAction] = useState<TimelineShortcutAction>();
  const [capturingMacroId, setCapturingMacroId] = useState<string>();

  const effectiveBindings = useMemo(
    () => getEffectiveTimelineShortcutBindings(shortcutBindings),
    [shortcutBindings],
  );
  const conflicts = useMemo(
    () => detectTimelineShortcutConflicts(shortcutBindings),
    [shortcutBindings],
  );
  const macroConflicts = useMemo(
    () => detectMacroShortcutConflicts(macros, shortcutBindings),
    [macros, shortcutBindings],
  );

  const updateShortcutBinding = useCallback(
    async (nextBindings: TimelineShortcutBindings) => {
      try {
        const saved = await writeCustomKeybindings(nextBindings);
        onShortcutBindingsChange(saved);
      } catch (shortcutError) {
        showToast({
          kind: 'warning',
          title: t.shortcuts.saveFailed,
          message: shortcutError instanceof Error ? shortcutError.message : t.shortcuts.saveFailedMessage,
        });
      }
    },
    [onShortcutBindingsChange, t],
  );

  const updateMacros = useCallback(
    async (nextMacros: ClipMacro[]) => {
      try {
        const saved = await writeClipMacros(nextMacros);
        onMacrosChange(saved);
      } catch (macroError) {
        showToast({
          kind: 'warning',
          title: t.macros.saveFailed,
          message: macroError instanceof Error ? macroError.message : t.macros.saveFailedMessage,
        });
      }
    },
    [onMacrosChange, t],
  );

  const updateMacroShortcut = useCallback(
    async (macroId: string, accelerator: string) => {
      await updateMacros(macros.map((macro) => (macro.id === macroId ? {...macro, shortcut: accelerator} : macro)));
    },
    [macros, updateMacros],
  );

  const resetMacroShortcut = useCallback(
    (macroId: string) => {
      void updateMacros(macros.map((macro) => (macro.id === macroId ? {...macro, shortcut: undefined} : macro)));
    },
    [macros, updateMacros],
  );

  const updateMacroSteps = useCallback(
    async (macroId: string, steps: CommandSnapshot[]) => {
      if (steps.length === 0) {
        showToast({kind: 'warning', title: t.macros.saveFailed, message: t.macros.invalidSteps});
        return;
      }
      await updateMacros(macros.map((macro) => (macro.id === macroId ? {...macro, patch: undefined, steps} : macro)));
    },
    [macros, updateMacros, t],
  );

  const updateMacroStepsFromJson = useCallback(
    async (macroId: string, raw: string) => {
      const steps = parseCommandSnapshotsJson(raw);
      if (steps.length === 0) {
        showToast({kind: 'warning', title: t.macros.saveFailed, message: t.macros.invalidSteps});
        return;
      }
      await updateMacroSteps(macroId, steps);
    },
    [updateMacroSteps, t],
  );

  const importMacros = useCallback(async () => {
    try {
      const imported = await importClipMacrosFromDialog();
      if (imported) {
        onMacrosChange(imported);
        showToast({kind: 'success', title: t.macros.imported, message: t.macros.importedMessage(imported.length)});
      }
    } catch (macroError) {
      showToast({
        kind: 'warning',
        title: t.macros.importFailed,
        message: macroError instanceof Error ? macroError.message : t.macros.importFailedMessage,
      });
    }
  }, [onMacrosChange, t]);

  const exportMacros = useCallback(async () => {
    try {
      const path = await exportClipMacrosToDialog(macros);
      if (path) {
        showToast({kind: 'success', title: t.macros.exported, message: path});
      }
    } catch (macroError) {
      showToast({
        kind: 'warning',
        title: t.macros.exportFailed,
        message: macroError instanceof Error ? macroError.message : t.macros.exportFailedMessage,
      });
    }
  }, [macros, t]);

  const formatMacroConflict = useCallback(
    (conflict: MacroShortcutConflict): string => {
      if (conflict.type === 'timeline' && conflict.timelineAction) {
        return (t.shortcuts.actions as Record<string, string>)[conflict.timelineAction] ?? conflict.timelineAction;
      }
      return conflict.macroName ?? conflict.macroId ?? t.macros.unknownMacro;
    },
    [t],
  );

  const resetShortcut = useCallback(
    (action: TimelineShortcutAction) => {
      const next = {...shortcutBindings};
      delete next[action];
      void updateShortcutBinding(next);
    },
    [shortcutBindings, updateShortcutBinding],
  );

  const resetAllShortcuts = useCallback(() => {
    void updateShortcutBinding({});
  }, [updateShortcutBinding]);

  useEffect(() => {
    if (!capturingAction) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const accelerator = eventToAccelerator({
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      });
      event.preventDefault();
      event.stopPropagation();
      if (!accelerator) {
        return;
      }
      void updateShortcutBinding({...shortcutBindings, [capturingAction]: [accelerator]});
      setCapturingAction(undefined);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturingAction, shortcutBindings, updateShortcutBinding]);

  useEffect(() => {
    if (!capturingMacroId) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const accelerator = eventToAccelerator({
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      });
      event.preventDefault();
      event.stopPropagation();
      if (!accelerator) {
        return;
      }
      void updateMacroShortcut(capturingMacroId, accelerator);
      setCapturingMacroId(undefined);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturingMacroId, macros, updateMacroShortcut]);

  return {
    capturingAction,
    setCapturingAction,
    capturingMacroId,
    setCapturingMacroId,
    effectiveBindings,
    conflicts,
    macroConflicts,
    resetAllShortcuts,
    resetShortcut,
    importMacros,
    exportMacros,
    formatMacroConflict,
    updateMacroStepsFromJson,
    updateMacroSteps,
    resetMacroShortcut,
  };
}
