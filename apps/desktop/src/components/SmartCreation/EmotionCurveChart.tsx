import { useState, useCallback, useRef, useMemo } from 'react';
import type { EmotionPoint } from '@open-factory/editor-core';
import { featureStrings } from '../../i18n/featureStrings';
export type { EmotionPoint } from '@open-factory/editor-core';

interface EmotionCurveChartProps {
  curve: EmotionPoint[];
}

const CHART_WIDTH = 440;
const CHART_HEIGHT = 140;
const PADDING = { top: 12, right: 12, bottom: 24, left: 32 };

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function EmotionCurveChart({ curve }: EmotionCurveChartProps) {
  const t = featureStrings.smartCreation;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const { pathD, areaD, points } = useMemo(() => {
    if (curve.length === 0)
      return { pathD: '', areaD: '', points: [] as Array<{ x: number; y: number; index: number }> };

    const maxTime = Math.max(...curve.map((p) => p.time), 1);
    const pts = curve.map((p, i) => ({
      x: PADDING.left + (p.time / maxTime) * plotW,
      y: PADDING.top + (1 - p.value) * plotH,
      index: i,
    }));

    const lineParts = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    const path = lineParts.join(' ');

    const area = `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${PADDING.top + plotH} L ${pts[0].x.toFixed(1)} ${PADDING.top + plotH} Z`;

    return { pathD: path, areaD: area, points: pts };
  }, [curve, plotW, plotH]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || points.length === 0) return;
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let closest = 0;
      let minDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const dist = Math.abs(points[i].x - mx);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }
      setHoverIndex(closest);
    },
    [points],
  );

  const handleMouseLeave = useCallback(() => setHoverIndex(null), []);

  if (curve.length === 0) {
    return (
      <div data-testid="emotion-curve-empty" className="text-xs text-neutral-500 text-center py-6">
        {t.noEmotionData}
      </div>
    );
  }

  const hovered = hoverIndex !== null ? curve[hoverIndex] : null;
  const hoveredPt = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div data-testid="emotion-curve-chart" className="relative">
      <svg
        ref={svgRef}
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        className="w-full"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <line
            key={v}
            x1={PADDING.left}
            y1={PADDING.top + (1 - v) * plotH}
            x2={PADDING.left + plotW}
            y2={PADDING.top + (1 - v) * plotH}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2 2"
          />
        ))}

        {/* Y-axis labels */}
        {[0, 0.5, 1].map((v) => (
          <text
            key={v}
            x={PADDING.left - 4}
            y={PADDING.top + (1 - v) * plotH + 3}
            textAnchor="end"
            className="fill-neutral-600"
            fontSize={9}
          >
            {v.toFixed(1)}
          </text>
        ))}

        {/* Area fill */}
        {areaD && <path d={areaD} fill="url(#emotionGradient)" opacity={0.3} />}

        {/* Line */}
        {pathD && <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth={1.5} strokeLinejoin="round" />}

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoverIndex === i ? 4 : 2}
            fill={hoverIndex === i ? '#a78bfa' : '#8b5cf6'}
            className="transition-all"
          />
        ))}

        {/* Hover indicator */}
        {hoveredPt && (
          <line
            x1={hoveredPt.x}
            y1={PADDING.top}
            x2={hoveredPt.x}
            y2={PADDING.top + plotH}
            stroke="rgba(255,255,255,0.15)"
            strokeDasharray="3 3"
          />
        )}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="emotionGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
      </svg>

      {/* Tooltip */}
      {hovered && hoveredPt && (
        <div
          data-testid="emotion-curve-tooltip"
          className="absolute pointer-events-none bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 shadow-lg"
          style={{
            left: Math.min(hoveredPt.x, CHART_WIDTH - 100),
            top: Math.max(hoveredPt.y - 36, 0),
          }}
        >
          <div>
            {t.time}: {formatTime(hovered.time)}
          </div>
          <div>
            {t.emotionValue}: {hovered.value.toFixed(2)}
          </div>
          <div>
            {t.arousal}: {hovered.arousal.toFixed(2)}
          </div>
          <div className="text-neutral-500">{hovered.source}</div>
        </div>
      )}
    </div>
  );
}
