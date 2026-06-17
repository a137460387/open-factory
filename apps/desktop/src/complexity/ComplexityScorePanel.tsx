import { calculateComplexityScore, createComplexityReport, REFERENCE_COMPLEXITY_PROJECTS, type ComplexityDimensionId, type ComplexityDimensionScore, type Project } from '@open-factory/editor-core';
import { Download, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { zhCN } from '../i18n/strings';
import { calculateComplexityRadarPoints } from './complexityRadar';

interface ComplexityScorePanelProps {
  project: Project;
  onClose(): void;
}

const DIMENSION_ORDER: ComplexityDimensionId[] = ['timelineDensity', 'effectComplexity', 'colorDepth', 'audioComplexity', 'keyframeDensity'];

export function ComplexityScorePanel({ project, onClose }: ComplexityScorePanelProps) {
  const t = zhCN.complexity;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const result = useMemo(() => calculateComplexityScore(project), [project]);
  const dimensions = useMemo(() => DIMENSION_ORDER.map((id) => result.dimensions[id]), [result.dimensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    drawRadar(context, dimensions, canvas.width, canvas.height);
  }, [dimensions]);

  const downloadReport = () => {
    const report = createComplexityReport(project);
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name || 'project'}-complexity-report.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="complexity-score-panel">
      <section className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button className="rounded-md p-1 text-slate-500 hover:bg-panel hover:text-ink" type="button" data-testid="complexity-close-button" aria-label={zhCN.common.close} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="grid min-h-0 gap-4 overflow-y-auto p-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            <div className="rounded-md border border-line bg-panel/50 p-3">
              <div className="text-xs font-semibold text-slate-600">{t.totalScore}</div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-semibold tabular-nums text-ink" data-testid="complexity-score-total">
                  {result.totalScore.toFixed(1)}
                </span>
                <span className="pb-1 text-xs font-semibold text-brand" data-testid="complexity-score-level">
                  {t.levels[result.level]}
                </span>
              </div>
            </div>
            <canvas ref={canvasRef} className="aspect-square w-full rounded-md border border-line bg-slate-950" width={300} height={300} data-testid="complexity-radar-canvas" />
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-[#176858]" type="button" data-testid="complexity-export-json-button" onClick={downloadReport}>
              <Download size={14} />
              {t.exportJson}
            </button>
          </div>
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-2" data-testid="complexity-dimension-list">
              {dimensions.map((dimension) => (
                <DimensionRow key={dimension.id} dimension={dimension} />
              ))}
            </div>
            <section className="rounded-md border border-line p-3">
              <h3 className="text-xs font-semibold text-slate-700">{t.references}</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-3" data-testid="complexity-reference-list">
                {REFERENCE_COMPLEXITY_PROJECTS.map((reference) => (
                  <div key={reference.id} className="rounded-md bg-panel px-3 py-2 text-xs">
                    <div className="font-semibold text-slate-700">{reference.name}</div>
                    <div className="mt-1 tabular-nums text-slate-500">{reference.score}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

function DimensionRow({ dimension }: { dimension: ComplexityDimensionScore }) {
  const t = zhCN.complexity;
  return (
    <article className="rounded-md border border-line p-3 text-xs" data-testid="complexity-dimension-row" data-dimension-id={dimension.id}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-700">{t.dimensions[dimension.id]}</span>
        <span className="tabular-nums text-slate-500">{dimension.score.toFixed(1)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel">
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, dimension.score))}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{dimension.detail}</div>
    </article>
  );
}

function drawRadar(context: CanvasRenderingContext2D, dimensions: readonly ComplexityDimensionScore[], width: number, height: number): void {
  context.clearRect(0, 0, width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 28;
  context.fillStyle = '#020617';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  context.lineWidth = 1;
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    context.beginPath();
    context.arc(centerX, centerY, radius * ring, 0, Math.PI * 2);
    context.stroke();
  }
  const outer = calculateComplexityRadarPoints(
    dimensions.map((dimension) => ({ ...dimension, score: 100 })),
    width,
    height,
    28
  );
  for (const point of outer) {
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(point.x, point.y);
    context.stroke();
  }
  const points = calculateComplexityRadarPoints(dimensions, width, height, 28);
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.closePath();
  context.fillStyle = 'rgba(34, 197, 94, 0.28)';
  context.strokeStyle = '#22c55e';
  context.lineWidth = 2;
  context.fill();
  context.stroke();
  context.fillStyle = '#bbf7d0';
  for (const point of points) {
    context.beginPath();
    context.arc(point.x, point.y, 3, 0, Math.PI * 2);
    context.fill();
  }
}

export default ComplexityScorePanel;
