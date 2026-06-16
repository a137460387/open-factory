import { useEffect, useMemo, useRef } from 'react';
import { Download, FileJson, X } from 'lucide-react';
import { analyzeClipRhythm, buildRhythmAnalysisHtml, formatReportDuration, serializeRhythmAnalysisJson, type Project, type ReportLocale, type RhythmAnalysisReport } from '@open-factory/editor-core';
import { getLanguage, zhCN } from '../i18n/strings';
import { saveFileDialog, writeFile } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';

interface RhythmAnalysisDialogProps {
  project: Project;
  onClose(): void;
}

export function RhythmAnalysisDialog({ project, onClose }: RhythmAnalysisDialogProps) {
  const t = zhCN.rhythmAnalysis;
  const locale = getLanguage() as ReportLocale;
  const report = useMemo(() => analyzeClipRhythm(project), [project]);

  async function exportJson(): Promise<void> {
    const outputPath = await saveFileDialog(`${project.name}-rhythm-analysis.json`, [{ name: zhCN.fileDialogs.json, extensions: ['json'] }]);
    if (!outputPath) {
      return;
    }
    await writeFile(outputPath, serializeRhythmAnalysisJson(report));
    showToast({ kind: 'success', title: t.exported, message: outputPath });
  }

  async function exportHtml(): Promise<void> {
    const outputPath = await saveFileDialog(`${project.name}-rhythm-analysis.html`, [{ name: zhCN.fileDialogs.htmlReport, extensions: ['html', 'htm'] }]);
    if (!outputPath) {
      return;
    }
    await writeFile(outputPath, buildRhythmAnalysisHtml(report, locale));
    showToast({ kind: 'success', title: t.exported, message: outputPath });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="rhythm-analysis-dialog">
      <section className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <p className="truncate text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel" type="button" title={zhCN.common.close} aria-label={zhCN.common.close} data-testid="rhythm-analysis-close-button" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <RhythmStats report={report} locale={locale} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-md border border-line bg-white p-3">
              <div className="mb-2 text-sm font-semibold text-ink">{t.cutCurve}</div>
              <RhythmCurveCanvas report={report} />
            </section>
            <section className="rounded-md border border-line bg-panel p-3">
              <div className="mb-2 text-sm font-semibold text-ink">{t.references}</div>
              <div className="space-y-2" data-testid="rhythm-analysis-reference-list">
                {report.references.map((reference) => (
                  <div key={reference.type} className="grid grid-cols-[1fr_auto] gap-2 rounded border border-line bg-white px-2 py-1.5 text-xs">
                    <span className="font-medium text-slate-700">{t.referenceTypes[reference.type]}</span>
                    <span className="tabular-nums text-slate-500">{formatReportDuration(reference.averageShotDuration, locale)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-line bg-white p-3">
              <div className="mb-2 text-sm font-semibold text-ink">{t.changePoints}</div>
              <RhythmChangeTable report={report} locale={locale} />
            </div>
            <div className="rounded-md border border-line bg-white p-3">
              <div className="mb-2 text-sm font-semibold text-ink">{t.suggestions}</div>
              {report.suggestions.length > 0 ? (
                <ul className="space-y-2 text-sm text-slate-700" data-testid="rhythm-analysis-suggestion-list">
                  {report.suggestions.map((suggestion) => (
                    <li key={suggestion} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                      {suggestion}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded border border-line bg-panel px-3 py-4 text-sm text-slate-500" data-testid="rhythm-analysis-no-suggestions">
                  {t.noSuggestions}
                </div>
              )}
            </div>
          </section>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
          <button className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-panel" type="button" data-testid="rhythm-analysis-export-json-button" onClick={() => void exportJson()}>
            <FileJson size={15} />
            {t.exportJson}
          </button>
          <button className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-[#176858]" type="button" data-testid="rhythm-analysis-export-html-button" onClick={() => void exportHtml()}>
            <Download size={15} />
            {t.exportHtml}
          </button>
        </footer>
      </section>
    </div>
  );
}

function RhythmStats({ report, locale }: { report: RhythmAnalysisReport; locale: ReportLocale }) {
  const t = zhCN.rhythmAnalysis;
  const stats = [
    { key: 'shot-count', label: t.shotCount, value: String(report.shotCount) },
    { key: 'average-shot', label: t.averageShot, value: formatReportDuration(report.averageShotDuration, locale) },
    { key: 'shortest-shot', label: t.shortestShot, value: formatReportDuration(report.shortestShotDuration, locale) },
    { key: 'longest-shot', label: t.longestShot, value: formatReportDuration(report.longestShotDuration, locale) },
    { key: 'change-points', label: t.changePointCount, value: String(report.changePoints.length) }
  ];
  return (
    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" data-testid="rhythm-analysis-stats">
      {stats.map((stat) => (
        <div key={stat.key} className="rounded-md border border-line bg-panel p-3" data-testid={`rhythm-analysis-stat-${stat.key}`}>
          <div className="text-[11px] font-medium text-slate-500">{stat.label}</div>
          <div className="mt-1 truncate text-base font-semibold text-ink">{stat.value}</div>
        </div>
      ))}
    </section>
  );
}

function RhythmCurveCanvas({ report }: { report: RhythmAnalysisReport }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const t = zhCN.rhythmAnalysis;
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#cbd5e1';
    context.lineWidth = 1;
    for (let index = 0; index <= 4; index += 1) {
      const y = 16 + index * ((height - 32) / 4);
      context.beginPath();
      context.moveTo(12, y);
      context.lineTo(width - 12, y);
      context.stroke();
    }
    const points = report.cutFrequencyCurve;
    if (points.length === 0) {
      context.fillStyle = '#64748b';
      context.font = '13px sans-serif';
      context.fillText(t.noCurveData, 18, height / 2);
      return;
    }
    const maxTime = Math.max(1, points.at(-1)?.time ?? 1);
    const maxCuts = Math.max(1, ...points.map((point) => point.cutsPerSecond));
    context.strokeStyle = '#0f766e';
    context.lineWidth = 2;
    context.beginPath();
    points.forEach((point, index) => {
      const x = 18 + (point.time / maxTime) * (width - 36);
      const y = height - 18 - (point.cutsPerSecond / maxCuts) * (height - 36);
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
    context.fillStyle = '#0f766e';
    for (const point of points) {
      const x = 18 + (point.time / maxTime) * (width - 36);
      const y = height - 18 - (point.cutsPerSecond / maxCuts) * (height - 36);
      context.beginPath();
      context.arc(x, y, 3, 0, Math.PI * 2);
      context.fill();
    }
  }, [report, t.noCurveData]);
  return <canvas ref={canvasRef} className="h-56 w-full rounded-md border border-line bg-panel" width={720} height={240} role="img" aria-label={t.cutCurve} data-testid="rhythm-analysis-curve-canvas" />;
}

function RhythmChangeTable({ report, locale }: { report: RhythmAnalysisReport; locale: ReportLocale }) {
  const t = zhCN.rhythmAnalysis;
  if (report.changePoints.length === 0) {
    return <div className="rounded border border-line bg-panel px-3 py-4 text-sm text-slate-500">{t.noChangePoints}</div>;
  }
  return (
    <table className="w-full border-collapse text-xs" data-testid="rhythm-analysis-change-table">
      <thead>
        <tr>
          <th className="border border-line bg-panel px-2 py-1 text-left">{t.time}</th>
          <th className="border border-line bg-panel px-2 py-1 text-left">{t.previousShot}</th>
          <th className="border border-line bg-panel px-2 py-1 text-left">{t.nextShot}</th>
          <th className="border border-line bg-panel px-2 py-1 text-left">{t.ratio}</th>
        </tr>
      </thead>
      <tbody>
        {report.changePoints.map((point) => (
          <tr key={`${point.previousClipId}-${point.nextClipId}-${point.time}`}>
            <td className="border border-line px-2 py-1">{formatReportDuration(point.time, locale)}</td>
            <td className="border border-line px-2 py-1">{formatReportDuration(point.previousDuration, locale)}</td>
            <td className="border border-line px-2 py-1">{formatReportDuration(point.nextDuration, locale)}</td>
            <td className="border border-line px-2 py-1">{point.ratio}x</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
