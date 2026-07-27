import type {ClipMacro} from '../macros/clip-macros';
import {getMacroSteps} from '../macros/clip-macros';
import {zhCN} from '../i18n/strings';
import {TIMELINE_SHORTCUT_DEFINITIONS} from '../shortcuts/timeline-shortcuts';
import type {TimelineShortcutBindings} from '../shortcuts/timeline-shortcuts';
import {MacroStepsEditor} from './MacroStepsEditor';
import {useShortcutMacros} from './hooks/useShortcutMacros';

interface ShortcutMacrosPanelProps {
  tab: 'shortcuts' | 'macros';
  shortcutBindings: TimelineShortcutBindings;
  onShortcutBindingsChange: (bindings: TimelineShortcutBindings) => void;
  macros: ClipMacro[];
  onMacrosChange: (macros: ClipMacro[]) => void;
  onExecuteMacro: (macro: ClipMacro) => void;
}

export function ShortcutMacrosPanel({
  tab,
  shortcutBindings,
  onShortcutBindingsChange,
  macros,
  onMacrosChange,
  onExecuteMacro,
}: ShortcutMacrosPanelProps) {
  const t = zhCN.settings;
  const {
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
  } = useShortcutMacros(shortcutBindings, onShortcutBindingsChange, macros, onMacrosChange);

  if (tab === 'shortcuts') {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">{t.shortcuts.title}</h3>
            <p className="text-xs text-slate-500">{t.shortcuts.description}</p>
          </div>
          <button
            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            onClick={resetAllShortcuts}
            data-testid="shortcuts-reset-all-button"
          >
            {t.shortcuts.resetAll}
          </button>
        </div>
        <div className="space-y-2">
          {TIMELINE_SHORTCUT_DEFINITIONS.map((definition) => {
            const conflictList = conflicts[definition.action];
            const hasConflict = conflictList.length > 0;
            const label = t.shortcuts.actions[definition.action];
            return (
              <div
                key={definition.action}
                className={`rounded-md border p-3 ${hasConflict ? 'border-rose-300 bg-rose-50' : 'border-line bg-white'}`}
                data-testid={`shortcut-row-${definition.action}`}
                data-conflict={hasConflict ? 'true' : 'false'}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink">{label}</div>
                    {hasConflict ? (
                      <div className="text-xs font-medium text-rose-700">
                        {t.shortcuts.conflict(conflictList.join(', '))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    className="min-w-28 rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-slate-700"
                    type="button"
                    data-testid={`shortcut-bind-${definition.action}`}
                    onClick={() => {
                      setCapturingMacroId(undefined);
                      setCapturingAction(definition.action);
                    }}
                  >
                    {capturingAction === definition.action
                      ? t.shortcuts.pressKeys
                      : effectiveBindings[definition.action].join(' / ')}
                  </button>
                  <button
                    className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                    type="button"
                    data-testid={`shortcut-reset-${definition.action}`}
                    onClick={() => resetShortcut(definition.action)}
                  >
                    {zhCN.common.reset}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.macros.title}</h3>
          <p className="text-xs text-slate-500">{t.macros.description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="macros-import-button"
            onClick={() => void importMacros()}
          >
            {t.macros.import}
          </button>
          <button
            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="macros-export-button"
            onClick={() => void exportMacros()}
          >
            {t.macros.export}
          </button>
        </div>
      </div>
      {macros.length === 0 ? (
        <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">
          {t.macros.empty}
        </div>
      ) : null}
      <div className="space-y-2">
        {macros.map((macro) => {
          const conflictList = macroConflicts[macro.id] ?? [];
          const hasConflict = conflictList.length > 0;
          return (
            <div
              key={macro.id}
              className={`rounded-md border p-3 ${hasConflict ? 'border-rose-300 bg-rose-50' : 'border-line bg-white'}`}
              data-testid={`macro-row-${macro.id}`}
              data-conflict={hasConflict ? 'true' : 'false'}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">{macro.name}</div>
                  {macro.description ? (
                    <div className="text-xs text-slate-500">{macro.description}</div>
                  ) : null}
                  <div className="mt-1 text-xs text-slate-500">
                    {t.macros.stepCount(getMacroSteps(macro).length)}
                  </div>
                  {hasConflict ? (
                    <div className="mt-1 text-xs font-medium text-rose-700">
                      {t.macros.conflict(conflictList.map(formatMacroConflict).join(', '))}
                    </div>
                  ) : null}
                </div>
                <button
                  className="min-w-28 rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-slate-700"
                  type="button"
                  data-testid={`macro-bind-${macro.id}`}
                  onClick={() => {
                    setCapturingAction(undefined);
                    setCapturingMacroId(macro.id);
                  }}
                >
                  {capturingMacroId === macro.id
                    ? t.shortcuts.pressKeys
                    : (macro.shortcut ?? t.macros.bindShortcut)}
                </button>
                <button
                  className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                  type="button"
                  data-testid={`macro-apply-${macro.id}`}
                  onClick={() => onExecuteMacro(macro)}
                >
                  {t.macros.apply}
                </button>
                <button
                  className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
                  type="button"
                  data-testid={`macro-reset-${macro.id}`}
                  onClick={() => resetMacroShortcut(macro.id)}
                >
                  {zhCN.common.reset}
                </button>
              </div>
              <MacroStepsEditor
                macro={macro}
                onSave={(raw) => void updateMacroStepsFromJson(macro.id, raw)}
                onDeleteStep={(steps) => void updateMacroSteps(macro.id, steps)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
