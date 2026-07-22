import { FilePlus } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import { serializeAutomationRulesJson, type AutomationRule } from '../automation/automation-rules';

const AUTOMATION_RULE_EXAMPLE = [
  {
    trigger: 'on-import',
    conditions: [{ field: 'duration', op: '>', value: 300 }],
    actions: [{ type: 'generate-proxy' }, { type: 'add-tag', value: 'green' }],
  },
];

export function AutomationSettingsPanel({
  rules,
  rulesJson,
  error,
  onRulesJsonChange,
  onSave,
  onToggleRule,
}: {
  rules: AutomationRule[];
  rulesJson: string;
  error?: string;
  onRulesJsonChange(value: string): void;
  onSave(): void;
  onToggleRule(ruleId: string, enabled: boolean): void;
}) {
  const t = zhCN.settings.automation;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
        </div>
        <button
          className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
          type="button"
          data-testid="automation-rules-example-button"
          onClick={() => onRulesJsonChange(serializeAutomationRulesJson(AUTOMATION_RULE_EXAMPLE as AutomationRule[]))}
        >
          {t.example}
        </button>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        {t.editorLabel}
        <textarea
          className="mt-1 min-h-56 w-full resize-y rounded-md border border-line bg-white px-3 py-2 font-mono text-xs text-ink"
          value={rulesJson}
          spellCheck={false}
          data-testid="automation-rules-json-editor"
          onChange={(event) => onRulesJsonChange(event.target.value)}
        />
      </label>
      {error ? (
        <div
          className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800"
          data-testid="automation-rules-error"
        >
          {error}
        </div>
      ) : null}
      <button
        className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95"
        type="button"
        data-testid="automation-rules-save-button"
        onClick={onSave}
      >
        {t.save}
      </button>
      <div className="rounded-md border border-line bg-white p-3" data-testid="automation-rules-list">
        {rules.length === 0 ? <div className="text-sm text-slate-500">{t.empty}</div> : null}
        <div className="space-y-2">
          {rules.map((rule) => (
            <label
              key={rule.id}
              className="flex items-start gap-2 rounded-md border border-line bg-panel p-2 text-xs text-slate-600"
              data-testid="automation-rule-row"
            >
              <input
                className="mt-0.5 h-4 w-4 accent-brand"
                type="checkbox"
                checked={rule.enabled}
                data-testid={`automation-rule-enabled-${rule.id}`}
                onChange={(event) => onToggleRule(rule.id, event.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-800">{rule.name ?? rule.id}</span>
                <span className="mt-1 block text-slate-500">{t.ruleSummary(rule.trigger, rule.actions.length)}</span>
              </span>
              <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {rule.enabled ? t.enabled : t.disabled}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
