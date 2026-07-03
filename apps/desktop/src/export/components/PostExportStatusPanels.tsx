import type { ExportPostExportScriptResult, ExportRecoveryReport, PostExportQualityAssuranceResult, PostExportQualityCheckResult } from '@open-factory/editor-core';
import { postExportQualityStatusClass, formatPostExportQualityValue } from '../lib/exportFormatHelpers';
import { zhCN } from '../../i18n/strings';

export function PostExportScriptResultPanel({ result }: { result: ExportPostExportScriptResult }) {
  const t = zhCN.exportDialog.postExportScript;
  return (
    <div
      className={`mt-2 rounded-md border p-2 text-[11px] ${result.success ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
      data-testid="export-post-script-result"
      data-success={String(result.success)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{t.resultTitle}</div>
        <div className="tabular-nums" data-testid="export-post-script-exit-code">
          {t.exitCode(result.exitCode)}
        </div>
      </div>
      <div className="mt-1 truncate font-mono" title={result.resolvedCommand} data-testid="export-post-script-resolved">
        {result.resolvedCommand}
      </div>
      {result.error ? <div className="mt-1 whitespace-pre-wrap text-amber-800" data-testid="export-post-script-error">{result.error}</div> : null}
      {result.stdout ? (
        <pre className="mt-2 max-h-20 overflow-auto rounded bg-white/70 p-2 whitespace-pre-wrap" data-testid="export-post-script-stdout">{result.stdout}</pre>
      ) : null}
      {result.stderr ? (
        <pre className="mt-2 max-h-20 overflow-auto rounded bg-white/70 p-2 whitespace-pre-wrap" data-testid="export-post-script-stderr">{result.stderr}</pre>
      ) : null}
    </div>
  );
}

export function ExportRecoveryPanel({ report }: { report: ExportRecoveryReport }) {
  const t = zhCN.exportDialog.recoveryLog;
  return (
    <div
      className={`mt-2 rounded-md border p-2 text-[11px] ${report.healed ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}
      data-testid="export-recovery-report"
      data-healed={String(report.healed)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{t.title}</div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-current px-2 py-0.5 font-semibold">{report.healed ? t.healed : t.failed}</span>
          <span className="tabular-nums">{t.attempts(report.attempts)}</span>
        </div>
      </div>
      <div className="mt-2 grid gap-1">
        {report.entries.map((entry) => (
          <div
            key={entry.attempt}
            className="rounded-md bg-white/70 p-2"
            data-testid="export-recovery-entry"
            data-kind={entry.errorKind}
            data-action={entry.action}
            data-result={entry.result}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-slate-700">
                {t.attemptLabel(entry.attempt)} · {t.errorKind[entry.errorKind]}
              </div>
              <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold">{t.result[entry.result]}</span>
            </div>
            <div className="mt-1 text-slate-600">{t.action[entry.action]}</div>
            <div className="mt-1 truncate font-mono text-[10px] text-slate-500" title={entry.originalError}>
              {entry.originalError}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PostExportQualityAssurancePanel({ result }: { result: PostExportQualityAssuranceResult }) {
  const t = zhCN.exportDialog.postExportQuality;
  return (
    <div className={`mt-2 rounded-md border p-2 text-[11px] ${postExportQualityStatusClass(result.status)}`} data-testid="post-export-quality-result" data-status={result.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{t.title}</div>
        <div className="rounded-full border border-current px-2 py-0.5 font-semibold" data-testid="post-export-quality-status">
          {t.status[result.status]}
        </div>
      </div>
      {result.retryRecommended ? <div className="mt-1 font-medium text-rose-800">{t.retryRecommended}</div> : null}
      <div className="mt-2 grid gap-1">
        {result.checks.map((check) => (
          <PostExportQualityCheckRow key={check.id} check={check} />
        ))}
      </div>
    </div>
  );
}

export function PostExportQualityCheckRow({ check }: { check: PostExportQualityCheckResult }) {
  const t = zhCN.exportDialog.postExportQuality;
  return (
    <div className="rounded-md bg-white/70 p-2" data-testid={`post-export-quality-check-${check.id}`} data-status={check.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-slate-700">{t.checks[check.id]}</div>
        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${postExportQualityStatusClass(check.status)}`}>{t.status[check.status]}</span>
      </div>
      <div className="mt-1 text-slate-600">{check.message}</div>
      {check.expected !== undefined || check.actual !== undefined ? (
        <div className="mt-1 grid gap-1 text-[10px] text-slate-500 sm:grid-cols-2">
          {check.expected !== undefined ? <div>{t.expected}: {formatPostExportQualityValue(check, check.expected)}</div> : null}
          {check.actual !== undefined ? <div>{t.actual}: {formatPostExportQualityValue(check, check.actual)}</div> : null}
        </div>
      ) : null}
      {check.ranges?.length ? <div className="mt-1 text-[10px] text-slate-500">{t.ranges(check.ranges.length)}</div> : null}
    </div>
  );
}
