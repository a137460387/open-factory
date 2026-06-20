import { AlertTriangle, CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { MediaPrecheckIssue, MediaPrecheckResult, Project } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { runProjectMediaPrecheck } from './media-precheck';

interface MediaPrecheckPanelProps {
  project: Project;
  onClose(): void;
  onJumpToMedia(assetId: string): void;
}

export function MediaPrecheckPanel({ project, onClose, onJumpToMedia }: MediaPrecheckPanelProps) {
  const t = zhCN.mediaPrecheck;
  const [running, setRunning] = useState(true);
  const [results, setResults] = useState<MediaPrecheckResult[]>([]);
  const summary = useMemo(
    () => ({
      pass: results.filter((result) => result.status === 'pass').length,
      warning: results.filter((result) => result.status === 'warning').length,
      error: results.filter((result) => result.status === 'error').length
    }),
    [results]
  );

  useEffect(() => {
    let disposed = false;
    setRunning(true);
    setResults([]);
    void runProjectMediaPrecheck(project)
      .then((nextResults) => {
        if (!disposed) {
          setResults(nextResults);
        }
      })
      .finally(() => {
        if (!disposed) {
          setRunning(false);
        }
      });
    return () => {
      disposed = true;
    };
  }, [project]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="media-precheck-panel">
      <section className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink">{t.title}</h2>
            <div className="text-xs text-slate-500" data-testid="media-precheck-summary">
              {running ? t.running : t.summary(summary.pass, summary.warning, summary.error)}
            </div>
          </div>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel" type="button" title={zhCN.common.close} aria-label={zhCN.common.close} data-testid="media-precheck-close-button" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {running && results.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-line bg-panel p-3 text-sm text-slate-600" data-testid="media-precheck-loading">
              <Loader2 size={16} className="animate-spin" />
              {t.running}
            </div>
          ) : null}
          <div className="space-y-2">
            {results.map((result) => (
              <div key={result.assetId} className="rounded-md border border-line bg-white p-3" data-testid={`media-precheck-row-${result.assetId}`} data-status={result.status}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={result.status} />
                      <div className="truncate text-sm font-semibold text-ink">{result.name}</div>
                      <span className="rounded bg-panel px-1.5 py-0.5 text-xs text-slate-500">{t.status[result.status]}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">{result.path}</div>
                  </div>
                  <button className="shrink-0 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel" type="button" data-testid={`media-precheck-jump-${result.assetId}`} onClick={() => onJumpToMedia(result.assetId)}>
                    {t.jumpToMedia}
                  </button>
                </div>
                {result.issues.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs text-slate-700">
                    {result.issues.map((issue, index) => (
                      <li key={`${issue.type}-${index}`} className={issue.severity === 'error' ? 'text-rose-700' : 'text-amber-700'} data-testid="media-precheck-issue" data-type={issue.type}>
                        {formatIssue(issue)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 text-xs text-emerald-700">{t.noIssues}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusIcon({ status }: { status: MediaPrecheckResult['status'] }) {
  if (status === 'pass') {
    return <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />;
  }
  if (status === 'warning') {
    return <AlertTriangle size={16} className="shrink-0 text-amber-600" />;
  }
  return <XCircle size={16} className="shrink-0 text-rose-600" />;
}

function formatIssue(issue: MediaPrecheckIssue): string {
  const t = zhCN.mediaPrecheck;
  switch (issue.type) {
    case 'ffprobe-error':
      return t.issues.ffprobeError(t.ffprobeCategories[issue.ffprobeError?.category ?? 'unknown'], issue.details ?? '');
    case 'codec':
      return t.issues.codec(issue.details ?? '');
    case 'av-sync':
      return t.issues.avSync(formatSeconds(issue.videoDuration), formatSeconds(issue.audioDuration), formatSeconds(issue.deltaSeconds));
    case 'integrity':
      return t.issues.integrity(issue.details ?? '');
    case 'hdr-sdr':
      return t.issues.hdrSdr(issue.details ?? '');
    case 'file-header-mismatch':
      return issue.details === 'force-imported' ? zhCN.preImport.riskBadge : (issue.details ?? t.issues.unknown);
    default:
      return issue.details ?? t.issues.unknown;
  }
}

function formatSeconds(value: number | undefined): string {
  return value === undefined ? '-' : `${value.toFixed(2)}s`;
}
