import { useRef, useEffect, useMemo } from 'react';
import {
  aggregateByProvider,
  aggregateByFeature,
  aggregateDailyTrend,
  generateRecommendations,
  calculateMonthlyCost,
  getUsedFeatures,
  type AIFeatureUsageRecord,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';

const t = zhCN.settings.aiServices;
const CHART_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export function AIUsageStatsPanel() {
  const store = useAISettingsStore();
  const records = store.usageRecords as AIFeatureUsageRecord[];
  const costAlertThreshold = store.costAlertThreshold;

  const providerStats = useMemo(() => aggregateByProvider(records), [records]);
  const featureStats = useMemo(() => aggregateByFeature(records), [records]);
  const dailyTrend = useMemo(() => aggregateDailyTrend(records), [records]);
  const monthlyCost = useMemo(() => calculateMonthlyCost(records), [records]);
  const usedFeatures = useMemo(() => getUsedFeatures(records), [records]);
  const recommendations = useMemo(() => generateRecommendations(usedFeatures), [usedFeatures]);

  const barChartRef = useRef<HTMLCanvasElement>(null);
  const lineChartRef = useRef<HTMLCanvasElement>(null);

  // Draw horizontal bar chart for feature usage
  useEffect(() => {
    const canvas = barChartRef.current;
    if (!canvas || featureStats.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const barHeight = 24;
    const gap = 6;
    const height = featureStats.length * (barHeight + gap) + 10;
    canvas.height = height * dpr;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    const width = canvas.clientWidth;
    const maxCount = Math.max(...featureStats.map((s) => s.callCount), 1);
    ctx.clearRect(0, 0, width, height);

    featureStats.forEach((stat, i) => {
      const y = i * (barHeight + gap) + 5;
      const barWidth = (stat.callCount / maxCount) * (width - 140);
      ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
      ctx.fillRect(120, y, barWidth, barHeight);
      ctx.fillStyle = '#334155';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const label = t.serviceLabels[stat.service as keyof typeof t.serviceLabels] ?? stat.service;
      ctx.fillText(label, 115, y + barHeight / 2);
      ctx.textAlign = 'left';
      ctx.fillText(String(stat.callCount), 120 + barWidth + 4, y + barHeight / 2);
    });
  }, [featureStats]);

  // Draw line chart for daily trend
  useEffect(() => {
    const canvas = lineChartRef.current;
    if (!canvas || dailyTrend.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const height = 150;
    canvas.height = height * dpr;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    const width = canvas.clientWidth;
    const maxCount = Math.max(...dailyTrend.map((d) => d.callCount), 1);
    const padding = { top: 10, bottom: 25, left: 35, right: 10 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.round(maxCount - (maxCount / 4) * i)), padding.left - 4, y);
    }

    // Line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    dailyTrend.forEach((point, i) => {
      const x = padding.left + (i / (dailyTrend.length - 1 || 1)) * chartW;
      const y = padding.top + chartH - (point.callCount / maxCount) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // X axis labels (first and last date)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (dailyTrend.length > 0) {
      ctx.fillText(dailyTrend[0].date.slice(5), padding.left, height - padding.bottom + 6);
      ctx.fillText(dailyTrend[dailyTrend.length - 1].date.slice(5), width - padding.right, height - padding.bottom + 6);
    }
  }, [dailyTrend]);

  // Pie chart using SVG
  const pieSlices = useMemo(() => {
    if (providerStats.length === 0) return [];
    const total = providerStats.reduce((sum, s) => sum + s.callCount, 0);
    const cx = 50, cy = 50, r = 40;
    let angle = 0;
    return providerStats.map((stat, i) => {
      const fraction = stat.callCount / total;
      const startAngle = angle;
      angle += fraction * 2 * Math.PI;
      const endAngle = angle;
      const largeArc = fraction > 0.5 ? 1 : 0;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const d = fraction >= 1
        ? `M${cx},${cy - r} A${r},${r} 0 1,1 ${cx - 0.01},${cy - r} Z`
        : `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
      return { d, color: CHART_COLORS[i % CHART_COLORS.length], label: stat.providerId, pct: (fraction * 100).toFixed(1) };
    });
  }, [providerStats]);

  if (records.length === 0) {
    return <div className="p-3 text-xs text-slate-500">{t.noUsageData}</div>;
  }

  return (
    <div className="space-y-4 p-1" data-testid="ai-usage-stats">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-line bg-panel p-2">
          <div className="text-lg font-semibold text-ink">{records.length}</div>
          <div className="text-[10px] text-slate-500">{t.totalCalls}</div>
        </div>
        <div className="rounded-md border border-line bg-panel p-2">
          <div className="text-lg font-semibold text-ink">{providerStats.reduce((s, p) => s + p.callCount, 0)}</div>
          <div className="text-[10px] text-slate-500">{t.monthlyCalls}</div>
        </div>
        <div className="rounded-md border border-line bg-panel p-2">
          <div className="text-lg font-semibold text-ink">{monthlyCost.toFixed(2)} {t.costUnit}</div>
          <div className="text-[10px] text-slate-500">{t.monthlyCost}</div>
        </div>
      </div>

      {/* Feature frequency bar chart */}
      {featureStats.length > 0 ? (
        <div>
          <h5 className="text-xs font-semibold text-ink mb-1">{t.featureFrequency}</h5>
          <canvas ref={barChartRef} className="w-full" data-testid="usage-bar-chart" />
        </div>
      ) : null}

      {/* Provider distribution pie chart */}
      {pieSlices.length > 0 ? (
        <div>
          <h5 className="text-xs font-semibold text-ink mb-1">{t.providerDistribution}</h5>
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 100 100" width="100" height="100" data-testid="usage-pie-chart">
              {pieSlices.map((slice, i) => (
                <path key={i} d={slice.d} fill={slice.color} />
              ))}
            </svg>
            <div className="space-y-1 text-[10px]">
              {pieSlices.map((slice, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: slice.color }} />
                  <span className="text-slate-600">{slice.label}</span>
                  <span className="text-slate-400">{slice.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Daily trend line chart */}
      <div>
        <h5 className="text-xs font-semibold text-ink mb-1">{t.dailyTrend}</h5>
        <canvas ref={lineChartRef} className="w-full" data-testid="usage-line-chart" />
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 ? (
        <div>
          <h5 className="text-xs font-semibold text-ink mb-1">{t.recommendations}</h5>
          <div className="space-y-1">
            {recommendations.map((rec, i) => (
              <div key={i} className="rounded-md border border-line bg-panel px-2 py-1.5 text-[11px] text-slate-700" data-testid={`ai-recommendation-${i}`}>
                <span className="font-medium">{t.serviceLabels[rec.feature as keyof typeof t.serviceLabels] ?? rec.feature}</span>
                <span className="ml-1 text-slate-500">
                  {(t as unknown as Record<string, string>)[rec.reasonKey] ?? rec.reasonKey}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Cost alert threshold */}
      <div>
        <h5 className="text-xs font-semibold text-ink mb-1">{t.costAlertTitle}</h5>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600">{t.costAlertThreshold}</label>
          <input
            type="number"
            className="w-24 rounded-md border border-line bg-panel px-2 py-1 text-xs text-ink"
            value={costAlertThreshold}
            min={0}
            step={10}
            onChange={(e) => store.setCostAlertThreshold(Number(e.target.value))}
            data-testid="cost-alert-threshold"
          />
        </div>
      </div>
    </div>
  );
}
