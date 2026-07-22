import { useEffect, useMemo, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import {
  getMacroSteps,
  serializeCommandSnapshots,
  type ClipMacro,
  type CommandSnapshot,
} from '../macros/clip-macros';

export function MacroStepsEditor({
  macro,
  onSave,
  onDeleteStep,
}: {
  macro: ClipMacro;
  onSave(raw: string): void;
  onDeleteStep(steps: CommandSnapshot[]): void;
}) {
  const t = zhCN.settings.macros;
  const steps = useMemo(() => getMacroSteps(macro), [macro]);
  const [value, setValue] = useState(() => serializeCommandSnapshots(steps));

  useEffect(() => {
    setValue(serializeCommandSnapshots(steps));
  }, [steps]);

  return (
    <details className="mt-3 rounded-md border border-line bg-panel p-2">
      <summary className="cursor-pointer text-xs font-semibold text-slate-600">{t.editSteps}</summary>
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <button
              key={`${step.type}-${index}`}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-panel"
              type="button"
              data-testid={`macro-delete-step-${macro.id}-${index}`}
              onClick={() => onDeleteStep(steps.filter((_, stepIndex) => stepIndex !== index))}
            >
              <Trash2 size={12} />
              <span>{t.deleteStep(index + 1, step.type)}</span>
            </button>
          ))}
        </div>
        <textarea
          className="h-32 w-full resize-y rounded-md border border-line bg-white p-2 font-mono text-xs text-ink"
          value={value}
          data-testid={`macro-steps-json-${macro.id}`}
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
          type="button"
          data-testid={`macro-save-steps-${macro.id}`}
          onClick={() => onSave(value)}
        >
          <Save size={13} />
          <span>{t.saveSteps}</span>
        </button>
      </div>
    </details>
  );
}
