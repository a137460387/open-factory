import { useMemo } from 'react';
import { BookOpen, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import type { NarrativeAnalysisResult, NarrativeGenerationResult, NarrativeAct } from '@open-factory/editor-core';
import { featureStrings } from '../../i18n/featureStrings';

interface NarrativeTimelineProps {
  narrative: NarrativeAnalysisResult;
  storyline?: NarrativeGenerationResult;
}

const ACT_COLORS: Record<NarrativeAct['label'], string> = {
  setup: '#3b82f6',
  development: '#eab308',
  climax: '#ef4444',
  resolution: '#22c55e',
};

const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
} as const;

const SEVERITY_COLORS = {
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  critical: 'text-red-400',
} as const;

export function NarrativeTimeline({ narrative, storyline }: NarrativeTimelineProps) {
  const t = featureStrings.smartCreation;

  const actSegments = useMemo(() => {
    const { acts } = narrative.structure;
    if (acts.length === 0) return [];
    const totalStart = acts[0].start;
    const totalEnd = acts[acts.length - 1].end;
    const totalDuration = totalEnd - totalStart || 1;

    return acts.map((act, i) => ({
      ...act,
      widthPct: ((act.end - act.start) / totalDuration) * 100,
      index: i,
    }));
  }, [narrative.structure]);

  const arcPoints = useMemo(() => {
    const { points } = narrative.arc;
    if (points.length === 0) return '';
    const maxTime = Math.max(...points.map((p) => p.time), 1);
    const w = 400;
    const h = 60;
    const pad = 4;
    const parts = points.map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${(pad + (p.time / maxTime) * (w - pad * 2)).toFixed(1)} ${(pad + (1 - p.tension) * (h - pad * 2)).toFixed(1)}`,
    );
    return parts.join(' ');
  }, [narrative.arc]);

  return (
    <div data-testid="narrative-timeline" className="space-y-3">
      {/* Score badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <BookOpen size={12} />
          <span>{t.narrativeStructure}</span>
        </div>
        <div
          data-testid="narrative-score"
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            narrative.score >= 70
              ? 'bg-green-900/40 text-green-300'
              : narrative.score >= 40
                ? 'bg-yellow-900/40 text-yellow-300'
                : 'bg-red-900/40 text-red-300'
          }`}
        >
          {t.score}: {narrative.score}
        </div>
      </div>

      {/* Act structure bar */}
      {actSegments.length > 0 && (
        <div data-testid="narrative-acts" className="space-y-1">
          <div className="flex h-6 rounded overflow-hidden border border-neutral-700">
            {actSegments.map((act) => (
              <div
                key={act.index}
                data-testid={`narrative-act-${act.label}`}
                className="flex items-center justify-center text-[9px] text-white/90 font-medium"
                style={{
                  width: `${act.widthPct}%`,
                  backgroundColor: ACT_COLORS[act.label],
                  minWidth: '2px',
                }}
              >
                {act.widthPct > 10 && t.actLabels[act.label]}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-neutral-600">
            {actSegments.map((act) => (
              <span key={act.index} style={{ width: `${act.widthPct}%`, textAlign: 'center' }}>
                {t.actLabels[act.label]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Narrative arc visualization */}
      {arcPoints && (
        <div data-testid="narrative-arc">
          <svg width="100%" viewBox="0 0 400 60" className="w-full">
            <defs>
              <linearGradient id="arcGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {/* Baseline */}
            <line x1={4} y1={56} x2={396} y2={56} stroke="rgba(255,255,255,0.06)" />
            {/* Arc line */}
            <path d={arcPoints} fill="none" stroke="#8b5cf6" strokeWidth={1.5} strokeLinejoin="round" />
            {/* Peak marker */}
            <circle
              cx={
                4 +
                (narrative.arc.peakTime /
                  Math.max(narrative.arc.points[narrative.arc.points.length - 1]?.time ?? 1, 1)) *
                  392
              }
              cy={4 + (1 - (narrative.arc.points.find((p) => p.time === narrative.arc.peakTime)?.tension ?? 0.5)) * 52}
              r={4}
              fill="#ef4444"
              stroke="#fca5a5"
              strokeWidth={1}
            />
          </svg>
        </div>
      )}

      {/* Storyline segments */}
      {storyline && storyline.storyline.length > 0 && (
        <div data-testid="narrative-storyline" className="space-y-1">
          <div className="text-xs text-neutral-400 mb-1">
            {t.storylineSegments(storyline.storyline.length)} ({storyline.template})
          </div>
          {storyline.storyline.map((seg) => (
            <div
              key={seg.id}
              data-testid={`storyline-segment-${seg.id}`}
              className="flex items-center gap-2 text-xs bg-neutral-800 rounded p-1.5"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    ACT_COLORS[
                      seg.purpose === 'setup'
                        ? 'setup'
                        : seg.purpose === 'climax'
                          ? 'climax'
                          : seg.purpose === 'resolution'
                            ? 'resolution'
                            : 'development'
                    ],
                }}
              />
              <span className="text-neutral-300 flex-1 truncate">{seg.purpose}</span>
              <span className="text-neutral-500 font-mono">{seg.duration.toFixed(1)}s</span>
              <span className="text-neutral-600">{seg.transitionType}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {narrative.suggestions.length > 0 && (
        <div data-testid="narrative-suggestions" className="space-y-1">
          {narrative.suggestions.map((suggestion, i) => {
            const Icon = SEVERITY_ICONS[suggestion.severity];
            const color = SEVERITY_COLORS[suggestion.severity];
            return (
              <div
                key={i}
                data-testid={`narrative-suggestion-${i}`}
                className="flex items-start gap-1.5 text-xs text-neutral-400 bg-neutral-800/50 rounded p-1.5"
              >
                <Icon size={12} className={`shrink-0 mt-0.5 ${color}`} />
                <span>{suggestion.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
