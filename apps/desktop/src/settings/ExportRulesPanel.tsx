import { FolderOpen } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import type { ExportConditionRule } from './appSettings';

export const EXPORT_RULE_COPY_SUCCESS_ID = 'copy-success';
const EXPORT_RULE_FAILURE_NOTIFICATION_ID = 'failure-notification';
const EXPORT_RULE_QUEUE_TONE_ID = 'queue-tone';

export function getExportRule(rules: ExportConditionRule[], id: string, fallback: ExportConditionRule): ExportConditionRule {
  return rules.find((rule) => rule.id === id) ?? fallback;
}

export function defaultExportCopyRule(): ExportConditionRule {
  return {
    id: EXPORT_RULE_COPY_SUCCESS_ID,
    enabled: false,
    trigger: 'export-success',
    action: 'copy-to-directory',
  };
}

function defaultExportFailureNotificationRule(): ExportConditionRule {
  return {
    id: EXPORT_RULE_FAILURE_NOTIFICATION_ID,
    enabled: false,
    trigger: 'export-failure',
    action: 'system-notification',
  };
}

function defaultExportQueueToneRule(): ExportConditionRule {
  return {
    id: EXPORT_RULE_QUEUE_TONE_ID,
    enabled: false,
    trigger: 'queue-complete',
    action: 'play-tone',
  };
}

export function upsertExportRule(rules: ExportConditionRule[], nextRule: ExportConditionRule): ExportConditionRule[] {
  const existingIndex = rules.findIndex((rule) => rule.id === nextRule.id);
  if (existingIndex === -1) {
    return [...rules, nextRule];
  }
  return rules.map((rule, index) => (index === existingIndex ? nextRule : rule));
}

export function ExportRulesSettingsPanel({
  rules,
  onRuleChange,
  onChooseCopyDirectory,
}: {
  rules: ExportConditionRule[];
  onRuleChange(rule: ExportConditionRule): void;
  onChooseCopyDirectory(): void;
}) {
  const t = zhCN.settings.exportRules;
  const copyRule = getExportRule(rules, EXPORT_RULE_COPY_SUCCESS_ID, defaultExportCopyRule());
  const failureNotificationRule = getExportRule(
    rules,
    EXPORT_RULE_FAILURE_NOTIFICATION_ID,
    defaultExportFailureNotificationRule(),
  );
  const queueToneRule = getExportRule(rules, EXPORT_RULE_QUEUE_TONE_ID, defaultExportQueueToneRule());

  return (
    <div className="rounded-md border border-line bg-white p-3" data-testid="settings-export-rules-panel">
      <div>
        <div className="text-sm font-semibold text-ink">{t.title}</div>
        <p className="text-xs text-slate-500">{t.description}</p>
      </div>
      <div className="mt-3 space-y-3">
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            className="mt-0.5 h-4 w-4 accent-brand"
            type="checkbox"
            checked={copyRule.enabled}
            data-testid="settings-export-rule-copy-success-toggle"
            onChange={(event) => onRuleChange({ ...copyRule, enabled: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-slate-700">{t.copyOnSuccess}</span>
            <span className="mt-1 block">{t.copyOnSuccessDescription}</span>
          </span>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.copyDirectory}
          <div className="mt-1 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-sm text-ink"
              value={copyRule.targetDirectory ?? ''}
              data-testid="settings-export-rule-copy-directory-input"
              onChange={(event) => onRuleChange({ ...copyRule, targetDirectory: event.target.value })}
            />
            <button
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
              type="button"
              title={t.chooseDirectory}
              aria-label={t.chooseDirectory}
              data-testid="settings-export-rule-copy-directory-choose"
              onClick={onChooseCopyDirectory}
            >
              <FolderOpen size={15} />
            </button>
          </div>
          <span className="mt-1 block text-[11px] font-normal text-slate-500">{t.variableHelp}</span>
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            className="mt-0.5 h-4 w-4 accent-brand"
            type="checkbox"
            checked={failureNotificationRule.enabled}
            data-testid="settings-export-rule-failure-notification-toggle"
            onChange={(event) => onRuleChange({ ...failureNotificationRule, enabled: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-slate-700">{t.notifyOnFailure}</span>
            <span className="mt-1 block">{t.notifyOnFailureDescription}</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            className="mt-0.5 h-4 w-4 accent-brand"
            type="checkbox"
            checked={queueToneRule.enabled}
            data-testid="settings-export-rule-queue-tone-toggle"
            onChange={(event) => onRuleChange({ ...queueToneRule, enabled: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-slate-700">{t.playToneOnQueueComplete}</span>
            <span className="mt-1 block">{t.playToneOnQueueCompleteDescription}</span>
          </span>
        </label>
      </div>
    </div>
  );
}
