import { mkdirSync, writeFileSync } from 'fs';

// 1. ErrorKnowledgeDialog
mkdirSync('apps/desktop/src/export-error-knowledge', { recursive: true });
writeFileSync('apps/desktop/src/export-error-knowledge/ErrorKnowledgeDialog.tsx', `import { useState } from 'react';
import { X, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import type { ErrorKnowledgeMatch, ErrorKnowledgeStore, ErrorFeedbackRecord } from '@open-factory/editor-core';
import { getTopMatches, buildFeedbackMap, addFeedback, createDefaultKnowledgeStore, mergeKnowledgeUpdate, BUILT_IN_ERROR_ENTRIES } from '@open-factory/editor-core';

interface ErrorKnowledgeDialogProps {
  stderr: string;
  onClose(): void;
}

export function ErrorKnowledgeDialog({ stderr, onClose }: ErrorKnowledgeDialogProps) {
  const t = zhCN.errorKnowledge;
  const [store, setStore] = useState<ErrorKnowledgeStore>(() => createDefaultKnowledgeStore());
  const feedbackMap = buildFeedbackMap(store.feedback);
  const matches = getTopMatches(stderr, store.entries, feedbackMap, 3);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState(false);

  function handleFeedback(entryId: string, helpful: boolean) {
    setStore(prev => addFeedback(prev, entryId, helpful));
    setFeedbackGiven(prev => new Set(prev).add(entryId));
  }

  async function handleUpdate() {
    setUpdating(true);
    try {
      const resp = await fetch('https://gist.githubusercontent.com/open-factory/error-knowledge-base/main/error-knowledge.json');
      if (!resp.ok) throw new Error('fetch failed');
      const remote = await resp.json();
      if (Array.isArray(remote)) {
        setStore(prev => mergeKnowledgeUpdate(prev, remote, 'github-gist'));
      }
    } catch {
      // network unavailable, use local
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="error-knowledge-dialog">
      <section className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-panel" type="button" disabled={updating} onClick={handleUpdate} data-testid="error-knowledge-update-button">
              <RefreshCw size={12} className={updating ? 'animate-spin' : ''} />
              {t.updateAvailable}
            </button>
            <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel" type="button" onClick={onClose} data-testid="error-knowledge-close-button">
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {matches.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{t.noMatches}</p>
          ) : (
            <div className="space-y-3" data-testid="error-knowledge-matches">
              {matches.map((match, index) => (
                <MatchCard key={match.entry.id} match={match} index={index} t={t} feedbackGiven={feedbackGiven.has(match.entry.id)} onFeedback={(helpful) => handleFeedback(match.entry.id, helpful)} />
              ))}
            </div>
          )}
        </div>
        <footer className="border-t border-line px-4 py-2 text-xs text-slate-400">
          {t.entryCount(store.entries.length)}
        </footer>
      </section>
    </div>
  );
}

function MatchCard({ match, index, t, feedbackGiven, onFeedback }: {
  match: ErrorKnowledgeMatch;
  index: number;
  t: typeof zhCN.errorKnowledge;
  feedbackGiven: boolean;
  onFeedback(helpful: boolean): void;
}) {
  const catLabel = t.categories[match.entry.category] ?? match.entry.category;
  return (
    <div className="rounded-md border border-line bg-white p-3" data-testid={\`error-knowledge-match-\${index}\`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <span className="mr-2 inline-block rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand">{catLabel}</span>
          <span className="text-sm font-semibold text-ink">{match.entry.label}</span>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{t.matchScore(match.score)}</span>
      </div>
      {match.entry.causes.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-xs font-medium text-slate-600">{t.causes}</div>
          <ul className="list-disc pl-4 text-xs text-slate-700">
            {match.entry.causes.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
      {match.entry.solutions.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-xs font-medium text-slate-600">{t.solutions}</div>
          <ol className="list-decimal pl-4 text-xs text-slate-700">
            {match.entry.solutions.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}
      {match.entry.links.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-xs font-medium text-slate-600">{t.relatedLinks}</div>
          <ul className="list-disc pl-4 text-xs">
            {match.entry.links.map((l, i) => <li key={i}><a className="text-brand underline" href={l} target="_blank" rel="noreferrer">{l}</a></li>)}
          </ul>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 border-t border-line pt-2">
        <span className="text-xs text-slate-500">{t.helpful}</span>
        {feedbackGiven ? (
          <span className="text-xs text-brand">{t.feedbackRecorded}</span>
        ) : (
          <>
            <button className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-xs text-slate-600 hover:bg-panel" type="button" onClick={() => onFeedback(true)} data-testid={\`error-knowledge-helpful-yes-\${index}\`}>
              <ThumbsUp size={11} /> {t.helpfulYes}
            </button>
            <button className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-xs text-slate-600 hover:bg-panel" type="button" onClick={() => onFeedback(false)} data-testid={\`error-knowledge-helpful-no-\${index}\`}>
              <ThumbsDown size={11} /> {t.helpfulNo}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
`);

// 2. SequenceCompareDialog
mkdirSync('apps/desktop/src/sequence-compare', { recursive: true });
writeFileSync('apps/desktop/src/sequence-compare/SequenceCompareDialog.tsx', `import { useState } from 'react';
import { X, ArrowLeftRight } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import type { Sequence, TimelineMarker, Project } from '@open-factory/editor-core';
import { findSyncMarkerPairs, createSequenceCompareLayout, saveSequenceCompareLayout, loadSequenceCompareLayout, normalizeSplitRatio, areSequencesIndependent, collectTimelineMarkers } from '@open-factory/editor-core';

interface SequenceCompareDialogProps {
  project: Project;
  onClose(): void;
  onDragClipToSequence?(clipId: string, targetSequenceId: string, insertTime: number): void;
}

export function SequenceCompareDialog({ project, onClose, onDragClipToSequence }: SequenceCompareDialogProps) {
  const t = zhCN.sequenceCompare;
  const saved = typeof window !== 'undefined' ? loadSequenceCompareLayout() : undefined;
  const allSequences = collectSequences(project);
  const [leftId, setLeftId] = useState(saved?.leftSequenceId ?? allSequences[0]?.id ?? '');
  const [rightId, setRightId] = useState(saved?.rightSequenceId ?? allSequences[1]?.id ?? allSequences[0]?.id ?? '');
  const [splitRatio, setSplitRatio] = useState(normalizeSplitRatio(saved?.splitRatio));
  const [syncMarkersEnabled, setSyncMarkersEnabled] = useState(saved?.syncMarkersEnabled ?? false);

  const leftSeq = allSequences.find(s => s.id === leftId);
  const rightSeq = allSequences.find(s => s.id === rightId);
  const leftMarkers = leftSeq ? collectTimelineMarkers(leftSeq.timeline) : [];
  const rightMarkers = rightSeq ? collectTimelineMarkers(rightSeq.timeline) : [];
  const syncPairs = syncMarkersEnabled ? findSyncMarkerPairs(leftMarkers, rightMarkers) : [];
  const independent = leftSeq && rightSeq ? areSequencesIndependent(leftSeq, rightSeq) : false;

  function handleSave() {
    saveSequenceCompareLayout(createSequenceCompareLayout(leftId, rightId, { splitRatio, syncMarkersEnabled }));
  }

  function handleDragStart(e: React.DragEvent, clipId: string) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ clipId, fromSequenceId: leftId }));
  }

  function handleDrop(e: React.DragEvent, targetSequenceId: string) {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.clipId && onDragClipToSequence) {
        onDragClipToSequence(data.clipId, targetSequenceId, 0);
      }
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="sequence-compare-dialog">
      <section className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">{t.title}</h2>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-panel" type="button" onClick={handleSave} data-testid="sequence-compare-save-layout">{t.splitRatio}</button>
            <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel" type="button" onClick={onClose} data-testid="sequence-compare-close-button"><X size={16} /></button>
          </div>
        </header>
        <div className="flex items-center gap-3 border-b border-line px-4 py-2">
          <label className="text-xs font-medium text-slate-600">
            {t.selectLeft}
            <select className="ml-2 rounded border border-line bg-white px-2 py-1 text-xs" value={leftId} onChange={e => setLeftId(e.target.value)} data-testid="sequence-compare-left-select">
              {allSequences.map(s => <option key={s.id} value={s.id}>{s.id === project.timeline.id ? t.mainSequence : t.nestedSequence(s.name || s.id)}</option>)}
            </select>
          </label>
          <ArrowLeftRight size={14} className="text-slate-400" />
          <label className="text-xs font-medium text-slate-600">
            {t.selectRight}
            <select className="ml-2 rounded border border-line bg-white px-2 py-1 text-xs" value={rightId} onChange={e => setRightId(e.target.value)} data-testid="sequence-compare-right-select">
              {allSequences.map(s => <option key={s.id} value={s.id}>{s.id === project.timeline.id ? t.mainSequence : t.nestedSequence(s.name || s.id)}</option>)}
            </select>
          </label>
          <label className="ml-auto flex items-center gap-1 text-xs text-slate-600">
            <input type="checkbox" className="accent-brand" checked={syncMarkersEnabled} onChange={e => setSyncMarkersEnabled(e.target.checked)} data-testid="sequence-compare-sync-markers-toggle" />
            {t.syncMarkersEnabled}
          </label>
        </div>
        {syncPairs.length > 0 && (
          <div className="border-b border-line bg-amber-50 px-4 py-1.5 text-xs text-amber-800" data-testid="sequence-compare-sync-pairs">
            {syncPairs.map(p => <span key={p.leftMarkerId} className="mr-3 inline-block rounded bg-amber-100 px-1.5 py-0.5">{t.syncMarkerPair(p.label)}</span>)}
          </div>
        )}
        {!independent && leftId !== rightId && (
          <div className="border-b border-line bg-red-50 px-4 py-1.5 text-xs text-red-700">{t.independentRequired}</div>
        )}
        <div className="flex min-h-0 flex-1" style={{ \`\${splitRatio < 0.5 ? 'grid-template-columns' : ''}\` }}>
          <div className="min-h-0 flex-1 overflow-y-auto border-r border-line p-3" style={{ flex: splitRatio }} data-testid="sequence-compare-left-panel"
            onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, leftId)}>
            <SequencePanelContent sequence={leftSeq} sideLabel={t.left} onDragStart={handleDragStart} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3" style={{ flex: 1 - splitRatio }} data-testid="sequence-compare-right-panel"
            onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, rightId)}>
            <SequencePanelContent sequence={rightSeq} sideLabel={t.right} onDragStart={handleDragStart} />
          </div>
        </div>
      </section>
    </div>
  );
}

function SequencePanelContent({ sequence, sideLabel, onDragStart }: { sequence?: Sequence; sideLabel: string; onDragStart(e: React.DragEvent, clipId: string): void }) {
  if (!sequence) return <p className="py-8 text-center text-xs text-slate-400">{sideLabel}</p>;
  const clips = sequence.timeline.tracks.flatMap(t => t.clips);
  return (
    <div className="space-y-1" data-testid="sequence-compare-clip-list">
      {clips.map(clip => (
        <div key={clip.id} className="cursor-grab rounded border border-line bg-panel px-2 py-1.5 text-xs text-ink" draggable onDragStart={e => onDragStart(e, clip.id)} data-testid={\`sequence-compare-clip-\${clip.id}\`}>
          {clip.type} · {clip.start.toFixed(2)}s · {clip.duration.toFixed(2)}s
        </div>
      ))}
      {clips.length === 0 && <p className="py-4 text-center text-xs text-slate-400">{sideLabel}</p>}
    </div>
  );
}

function collectSequences(project: Project): Sequence[] {
  const seqs: Sequence[] = [project];
  for (const clip of project.timeline.tracks.flatMap(t => t.clips)) {
    if (clip.type === 'nested-sequence' && clip.nestedTimeline) {
      seqs.push({ ...project, id: clip.id, name: clip.name ?? clip.id, timeline: clip.nestedTimeline });
    }
  }
  return seqs;
}
`);

// 3. SubtitleSyncPanel
mkdirSync('apps/desktop/src/subtitle-sync-monitor', { recursive: true });
writeFileSync('apps/desktop/src/subtitle-sync-monitor/SubtitleSyncPanel.tsx', `import { useState, useCallback } from 'react';
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
                <div key={w.subtitleClipId} className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-2" data-testid={\`subtitle-sync-warning-\${w.subtitleClipId}\`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <span className="text-xs text-amber-800">{t.offsetMs(w.offsetMs)} · {w.severity === 'major' ? t.severityMajor : t.severityMinor}</span>
                  </div>
                  {repairedIds.has(w.subtitleClipId) ? (
                    <span className="text-xs text-green-600">{t.repairSuccess}</span>
                  ) : (
                    <button className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-xs text-slate-700 hover:bg-panel" type="button" onClick={() => handleRepair(w.subtitleClipId)} data-testid={\`subtitle-sync-repair-\${w.subtitleClipId}\`}>
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
`);

// 4. ProxyBatchVerifyDialog
mkdirSync('apps/desktop/src/proxy-batch-verify', { recursive: true });
writeFileSync('apps/desktop/src/proxy-batch-verify/ProxyBatchVerifyDialog.tsx', `import { useState, useCallback } from 'react';
import { X, ShieldCheck, RefreshCw, CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import type { ProxyBatchVerifyReport, ProxyVerifyResult, ProxyRepairProgress, ProxyRepairHistoryEntry, ProxyVerifySchedule, MediaAsset } from '@open-factory/editor-core';
import { buildBatchVerifyReport, classifyProxyVerifyResult, collectRepairAssetIds, createRepairProgress, updateRepairProgress, buildRepairHistoryEntry, shouldRunScheduledVerify } from '@open-factory/editor-core';

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
                    <span className={\`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold \${
                      r.category === 'healthy' ? 'bg-green-50 text-green-700' :
                      r.category === 'expired' ? 'bg-amber-50 text-amber-700' :
                      r.category === 'corrupt' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
                    }\`}>{t[r.category]}</span>
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
`);

console.log('4 UI components generated successfully');

