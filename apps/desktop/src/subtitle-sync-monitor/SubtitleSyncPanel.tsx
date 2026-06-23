import { useState, useCallback } from 'react';
import { X, AlertTriangle, CheckCircle, Scan, Wrench } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import type { SubtitleSyncSensitivity, SubtitleSyncReport, SubtitleTimingReference, Track } from '@open-factory/editor-core';
import { batchScanSubtitleSync, mapSensitivityLabel, calculateSingleSubtitleRepair } from '@open-factory/editor-core';

interface SubtitleSyncPanelProps {
  tracks: Track[];
  timingRefs: SubtitleTimingReference[];
  projectDuration: number;
  onClose(): void;
  onRepairSubtitle(subtitleClipId: string, newStart: number, newDuration: number): void;
}

export function SubtitleSyncPanel({ tracks, timingRefs, projectDuration, onClose, onRepairSubtitle }: SubtitleSyncPanelProps) {
  const t = zhCN.subtitleSyncMonitor;
  const [sensitivity, setSensitivity] = useState<SubtitleSyncSensitivity>('standard');
  const [report, setReport] = useState<SubtitleSyncReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [repairedIds, setRepairedIds] = useState<Set<string>>(new Set());

  const handleScan = useCallback(() => {
    setScanning(true);
    const result = batchScanSubtitleSync(tracks, timingRefs, sensitivity);
    setReport(result);
    setScanning(false);
  }, [tracks, timingRefs, sensitivity]);

  function handleRepair(subtitleClipId: string) {
    const subtitle = tracks.flatMap(tr => tr.clips).find(c => c.id === subtitleClipId);
    if (!subtitle || subtitle.type !== 'subtitle') return;
    const ref = timingRefs[0];
    if (!ref) return;
    const result = calculateSingleSubtitleRepair(subtitle, ref, projectDuration);
    if (result) {
      onRepairSubtitle(subtitleClipId, result.start, result.duration);
      setRepairedIds(prev => new Set(prev).add(subtitleClipId));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="subtitle-sync-panel">
      <section className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel" type="button" onClick={onClose} data-testid="subtitle-sync-close-button"><X size={16} /></button>
        </header>
        <div className="flex items-center gap-3 border-b border-line px-4 py-2">
          <label className="text-xs font-medium text-slate-600">
            {t.sensitivity}
            <select className="ml-2 rounded border border-line bg-white px-2 py-1 text-xs" value={sensitivity} onChange={e => setSensitivity(mapSensitivityLabel(e.target.value))} data-testid="subtitle-sync-sensitivity-select">
              <option value="strict">{t.sensitivityStrict}</option>
              <option value="standard">{t.sensitivityStandard}</option>
              <option value="loose">{t.sensitivityLoose}</option>
            </select>
          </label>
          <button className="ml-auto inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-[#176858]" type="button" onClick={handleScan} disabled={scanning} data-testid="subtitle-sync-scan-button">
            <Scan size={13} /> {t.scanAll}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {scanning && <p className="py-4 text-center text-sm text-slate-500">{t.scanning}</p>}
          {!scanning && report && report.warningCount === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-slate-500">
              <CheckCircle size={32} className="text-green-500" />
              <p className="text-sm">{t.noWarnings}</p>
            </div>
          )}
          {!scanning && report && report.warningCount > 0 && (
            <div className="space-y-2" data-testid="subtitle-sync-warnings">
              <p className="mb-3 text-xs text-slate-600">
                {t.totalSubtitles(report.totalSubtitles)} · {t.alignedCount(report.alignedCount)} · {t.warningCount(report.warningCount)}
              </p>
              {report.warnings.map(w => (
                <div key={w.subtitleClipId} className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-2" data-testid={`subtitle-sync-warning-${w.subtitleClipId}`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <span className="text-xs text-amber-800">{t.offsetMs(w.offsetMs)} · {w.severity === 'major' ? t.severityMajor : t.severityMinor}</span>
                  </div>
                  {repairedIds.has(w.subtitleClipId) ? (
                    <span className="text-xs text-green-600">{t.repairSuccess}</span>
                  ) : (
                    <button className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-xs text-slate-700 hover:bg-panel" type="button" onClick={() => handleRepair(w.subtitleClipId)} data-testid={`subtitle-sync-repair-${w.subtitleClipId}`}>
                      <Wrench size={11} /> {t.repair}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
