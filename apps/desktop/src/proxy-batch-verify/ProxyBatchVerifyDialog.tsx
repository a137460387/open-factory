import { useState, useCallback } from 'react';
import { X, ShieldCheck, RefreshCw, CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import type { ProxyBatchVerifyReport, ProxyVerifyResult, ProxyRepairProgress, ProxyRepairHistoryEntry, ProxyVerifySchedule, MediaAsset } from '@open-factory/editor-core';
import { buildBatchVerifyReport, classifyProxyVerifyResult, collectRepairAssetIds, createRepairProgress, updateRepairProgress, buildRepairHistoryEntry } from '@open-factory/editor-core';

interface ProxyBatchVerifyDialogProps {
  media: MediaAsset[];
  onClose(): void;
  onVerifyAsset?(assetId: string): Promise<{ exists: boolean; readable: boolean; proxyMtimeMs?: number; proxySize?: number; sourceMtimeMs?: number }>;
  onRepairAsset?(assetId: string): Promise<boolean>;
}

export function ProxyBatchVerifyDialog({ media, onClose, onVerifyAsset, onRepairAsset }: ProxyBatchVerifyDialogProps) {
  const t = zhCN.proxyBatchVerify;
  const assetsWithProxy = media.filter(m => m.proxyPath);
  const [report, setReport] = useState<ProxyBatchVerifyReport | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [repairing, setRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState<ProxyRepairProgress | null>(null);
  const [history, setHistory] = useState<ProxyRepairHistoryEntry[]>([]);
  const [schedule, setSchedule] = useState<ProxyVerifySchedule>('manual');

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    const results: ProxyVerifyResult[] = [];
    for (let i = 0; i < assetsWithProxy.length; i++) {
      setProgress(t.progress(i + 1, assetsWithProxy.length));
      const asset = assetsWithProxy[i];
      if (onVerifyAsset) {
        const stat = await onVerifyAsset(asset.id);
        results.push(classifyProxyVerifyResult(asset, stat.exists, stat.readable,
          stat.proxyMtimeMs ? { mtimeMs: stat.proxyMtimeMs, size: stat.proxySize ?? 0 } : undefined,
          stat.sourceMtimeMs ? { mtimeMs: stat.sourceMtimeMs, size: 0 } : undefined));
      } else {
        results.push(classifyProxyVerifyResult(asset, true, true));
      }
    }
    setReport(buildBatchVerifyReport(results));
    setVerifying(false);
    setProgress('');
  }, [assetsWithProxy, onVerifyAsset, t]);

  const handleRepairAll = useCallback(async () => {
    if (!report) return;
    setRepairing(true);
    const ids = collectRepairAssetIds(report);
    const prog = createRepairProgress(ids.length);
    setRepairProgress(prog);
    const startedAt = Date.now();
    let current = prog;
    for (const id of ids) {
      if (onRepairAsset) {
        const ok = await onRepairAsset(id);
        current = updateRepairProgress(current, id, ok, ok ? undefined : 'repair_failed');
      } else {
        current = updateRepairProgress(current, id, true);
      }
      setRepairProgress({ ...current });
    }
    setHistory(prev => [...prev, buildRepairHistoryEntry(current, startedAt)]);
    await handleVerify();
    setRepairing(false);
    setRepairProgress(null);
  }, [report, onRepairAsset, handleVerify]);

  const issueCount = report ? report.expiredCount + report.corruptCount + report.missingCount : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="proxy-batch-verify-dialog">
      <section className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel" type="button" onClick={onClose} data-testid="proxy-verify-close-button"><X size={16} /></button>
        </header>
        <div className="flex items-center gap-3 border-b border-line px-4 py-2">
          <button className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-[#176858]" type="button" onClick={handleVerify} disabled={verifying || assetsWithProxy.length === 0} data-testid="proxy-verify-start-button">
            <ShieldCheck size={13} /> {t.verifyAll}
          </button>
          {assetsWithProxy.length === 0 && <span className="text-xs text-slate-500">{t.noProxies}</span>}
          {verifying && <span className="text-xs text-slate-500">{progress || t.verifying}</span>}
          <label className="ml-auto text-xs font-medium text-slate-600">
            {t.schedule}
            <select className="ml-2 rounded border border-line bg-white px-2 py-1 text-xs" value={schedule} onChange={e => setSchedule(e.target.value as ProxyVerifySchedule)} data-testid="proxy-verify-schedule-select">
              <option value="startup">{t.scheduleStartup}</option>
              <option value="weekly">{t.scheduleWeekly}</option>
              <option value="manual">{t.scheduleManual}</option>
            </select>
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {report && (
            <>
              <div className="mb-4 grid grid-cols-4 gap-2" data-testid="proxy-verify-summary">
                <StatCard icon={<CheckCircle size={14} className="text-green-500" />} label={t.healthy} count={report.healthyCount} />
                <StatCard icon={<AlertTriangle size={14} className="text-amber-500" />} label={t.expired} count={report.expiredCount} />
                <StatCard icon={<XCircle size={14} className="text-red-500" />} label={t.corrupt} count={report.corruptCount} />
                <StatCard icon={<HelpCircle size={14} className="text-slate-500" />} label={t.missing} count={report.missingCount} />
              </div>
              {issueCount > 0 && (
                <button className="mb-3 inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-[#176858] disabled:opacity-50" type="button" onClick={handleRepairAll} disabled={repairing} data-testid="proxy-verify-repair-all-button">
                  <RefreshCw size={13} className={repairing ? 'animate-spin' : ''} /> {t.repairAll}
                </button>
              )}
              {repairProgress && (
                <p className="mb-3 text-xs text-slate-600" data-testid="proxy-verify-repair-progress">
                  {t.repairSuccess(repairProgress.completed)} · {t.repairFailed(repairProgress.failed)}
                </p>
              )}
              <div className="space-y-1" data-testid="proxy-verify-results">
                {report.results.map(r => (
                  <div key={r.assetId} className="flex items-center justify-between rounded border border-line bg-panel px-2 py-1.5 text-xs">
                    <span className="truncate text-ink">{r.assetName}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      r.category === 'healthy' ? 'bg-green-50 text-green-700' :
                      r.category === 'expired' ? 'bg-amber-50 text-amber-700' :
                      r.category === 'corrupt' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
                    }`}>{t[r.category]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {history.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <h3 className="mb-2 text-xs font-semibold text-slate-700">{t.repairHistory}</h3>
              {history.map((h, i) => (
                <p key={i} className="text-xs text-slate-500">{t.historyEntry(h.successCount, h.failCount, h.durationMs + 'ms')}</p>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 rounded border border-line bg-panel px-2 py-1.5">
      {icon}
      <div>
        <div className="text-xs font-medium text-ink">{label}</div>
        <div className="text-sm font-semibold tabular-nums text-ink">{count}</div>
      </div>
    </div>
  );
}
