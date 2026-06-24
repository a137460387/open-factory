import { useState } from 'react';
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
  const allSequences = project.sequences.length > 0 ? project.sequences : [{ id: project.id, name: project.name, timeline: project.timeline }];
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
    } catch (error) { console.warn('[SequenceCompare] failed to load', error); }
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
              {allSequences.map(s => <option key={s.id} value={s.id}>{s.id === project.id ? t.mainSequence : t.nestedSequence(s.name || s.id)}</option>)}
            </select>
          </label>
          <ArrowLeftRight size={14} className="text-slate-400" />
          <label className="text-xs font-medium text-slate-600">
            {t.selectRight}
            <select className="ml-2 rounded border border-line bg-white px-2 py-1 text-xs" value={rightId} onChange={e => setRightId(e.target.value)} data-testid="sequence-compare-right-select">
              {allSequences.map(s => <option key={s.id} value={s.id}>{s.id === project.id ? t.mainSequence : t.nestedSequence(s.name || s.id)}</option>)}
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
        <div className="flex min-h-0 flex-1">
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
        <div key={clip.id} className="cursor-grab rounded border border-line bg-panel px-2 py-1.5 text-xs text-ink" draggable onDragStart={e => onDragStart(e, clip.id)} data-testid={`sequence-compare-clip-${clip.id}`}>
          {clip.type} · {clip.start.toFixed(2)}s · {clip.duration.toFixed(2)}s
        </div>
      ))}
      {clips.length === 0 && <p className="py-4 text-center text-xs text-slate-400">{sideLabel}</p>}
    </div>
  );
}
