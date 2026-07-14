import { Activity, Download, Loader2, Play, X } from 'lucide-react';
import type { Clip, ClipContentAnalysis, ContentSceneType, MediaAsset } from '@open-factory/editor-core';
import { CONTENT_SCENE_TYPES } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';

export interface ContentAnalysisTarget {
  clip: Clip;
  asset: MediaAsset;
}

interface ContentAnalysisDialogProps {
  targets: ContentAnalysisTarget[];
  selectedClipIds: string[];
  analyzingClipId?: string;
  onAnalyze(clipId: string): void;
  onAnalyzePreferred(): void;
  onExport(clipId: string): void;
  onClose(): void;
}

export function ContentAnalysisDialog({
  targets,
  selectedClipIds,
  analyzingClipId,
  onAnalyze,
  onAnalyzePreferred,
  onExport,
  onClose,
}: ContentAnalysisDialogProps) {
  const t = zhCN.contentAnalysis;
  const selectedTargets = targets.filter((target) => selectedClipIds.includes(target.clip.id));
  const preferredCount = selectedTargets.length > 0 ? selectedTargets.length : targets.length;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="content-analysis-dialog"
    >
      <section className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <p className="truncate text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel"
            type="button"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="content-analysis-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-panel p-3">
            <div className="min-w-0 text-sm text-slate-600">
              {targets.length === 0 ? t.noTargets : t.targetSummary(targets.length, preferredCount)}
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-[#176858] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={targets.length === 0 || Boolean(analyzingClipId)}
              data-testid="content-analysis-run-button"
              onClick={onAnalyzePreferred}
            >
              {analyzingClipId ? <Loader2 className="animate-spin" size={15} /> : <Activity size={15} />}
              {analyzingClipId ? t.analyzing : t.runAnalysis}
            </button>
          </div>
          <div className="grid min-h-0 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-2" data-testid="content-analysis-target-list">
              {targets.length === 0 ? (
                <div className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">
                  {t.noTargets}
                </div>
              ) : null}
              {targets.map((target) => (
                <TargetRow
                  key={target.clip.id}
                  target={target}
                  selected={selectedClipIds.includes(target.clip.id)}
                  analyzing={analyzingClipId === target.clip.id}
                  onAnalyze={() => onAnalyze(target.clip.id)}
                  onExport={() => onExport(target.clip.id)}
                />
              ))}
            </div>
            <AnalysisOverview targets={targets} />
          </div>
        </div>
      </section>
    </div>
  );
}

function TargetRow({
  target,
  selected,
  analyzing,
  onAnalyze,
  onExport,
}: {
  target: ContentAnalysisTarget;
  selected: boolean;
  analyzing: boolean;
  onAnalyze(): void;
  onExport(): void;
}) {
  const analysis = target.clip.contentAnalysis;
  return (
    <div
      className="rounded-md border border-line bg-white p-3 shadow-sm"
      data-testid={`content-analysis-target-${target.clip.id}`}
      data-analyzed={analysis ? 'true' : 'false'}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink" title={target.clip.name}>
            {target.clip.name}
          </div>
          <div className="truncate text-xs text-slate-500" title={target.asset.path}>
            {selected ? zhCN.contentAnalysis.selected : zhCN.contentAnalysis.clipAsset(target.asset.name)}
          </div>
        </div>
        <span className="rounded bg-panel px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
          {target.clip.type}
        </span>
      </div>
      {analysis ? (
        <SceneTagList analysis={analysis} assetId={target.asset.id} />
      ) : (
        <div className="mt-2 text-xs text-slate-500">{zhCN.contentAnalysis.notAnalyzed}</div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-line bg-panel px-2 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-50"
          type="button"
          disabled={analyzing}
          data-testid={`content-analysis-run-${target.clip.id}`}
          onClick={onAnalyze}
        >
          {analyzing ? <Loader2 className="animate-spin" size={13} /> : <Play size={13} />}
          {analyzing ? zhCN.contentAnalysis.analyzing : zhCN.contentAnalysis.analyzeClip}
        </button>
        <button
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-line bg-white px-2 py-1.5 text-xs font-semibold hover:bg-panel disabled:opacity-50"
          type="button"
          disabled={!analysis}
          data-testid={`content-analysis-export-${target.clip.id}`}
          onClick={onExport}
        >
          <Download size={13} />
          {zhCN.contentAnalysis.exportJson}
        </button>
      </div>
    </div>
  );
}

function AnalysisOverview({ targets }: { targets: ContentAnalysisTarget[] }) {
  const analyzed = targets.filter((target) => target.clip.contentAnalysis);
  const latest = analyzed.at(-1)?.clip.contentAnalysis;
  if (!latest) {
    return (
      <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-500">
        {zhCN.contentAnalysis.emptyOverview}
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-md border border-line bg-white p-4" data-testid="content-analysis-overview">
      <div>
        <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">
          {zhCN.contentAnalysis.sceneTypes}
        </div>
        <SceneTagList analysis={latest} assetId="overview" />
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-500">
          {zhCN.contentAnalysis.emotionCurve}
        </div>
        <EmotionCurve analysis={latest} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Metric label={zhCN.contentAnalysis.segments} value={String(latest.segments.length)} />
        <Metric label={zhCN.contentAnalysis.dialogueTurns} value={String(latest.dialogueTurns.length)} />
        <Metric label={zhCN.contentAnalysis.primaryScene} value={sceneLabel(latest.primarySceneType)} />
      </div>
    </div>
  );
}

function SceneTagList({ analysis, assetId }: { analysis: ClipContentAnalysis; assetId: string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1" data-testid={`scene-tags-${assetId}`}>
      {analysis.sceneTypes.map((sceneType) => (
        <span
          key={sceneType}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
          data-testid={`content-analysis-scene-tag-${sceneType}-${assetId}`}
        >
          {sceneLabel(sceneType)}
        </span>
      ))}
    </div>
  );
}

function EmotionCurve({ analysis }: { analysis: ClipContentAnalysis }) {
  const points = analysis.emotionCurve.length > 0 ? analysis.emotionCurve : [{ time: 0, value: 0, brightness: 0 }];
  const maxTime = Math.max(...points.map((point) => point.time), 1);
  const path = points
    .map((point, index) => {
      const x = (point.time / maxTime) * 100;
      const y = 40 - point.value * 34;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  return (
    <svg
      className="h-28 w-full rounded-md border border-line bg-panel"
      viewBox="0 0 100 40"
      role="img"
      aria-label={zhCN.contentAnalysis.emotionCurve}
      data-testid="content-analysis-emotion-curve"
    >
      <path d={path} fill="none" stroke="#0f766e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-2">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function sceneLabel(sceneType: ContentSceneType): string {
  return zhCN.contentAnalysis.sceneTypeLabels[sceneType] ?? sceneType;
}

export function getSceneTypeOptions(): ContentSceneType[] {
  return [...CONTENT_SCENE_TYPES];
}
