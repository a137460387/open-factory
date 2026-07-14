import type { ChannelAutomation, AutomationCurve, AutomationPoint } from './mixer-types';

export interface AutomationEvaluationResult {
  volume: number;
  pan: number;
  effectParams: Record<string, number>;
}

export function evaluateAutomation(automation: ChannelAutomation, timeSeconds: number): AutomationEvaluationResult {
  return {
    volume: automation.volume
      ? evaluateCurve(automation.volume.points, timeSeconds, automation.volume.points[0]?.curve ?? 'linear')
      : 0,
    pan: automation.pan
      ? evaluateCurve(automation.pan.points, timeSeconds, automation.pan.points[0]?.curve ?? 'linear')
      : 0,
    effectParams: automation
      ? Object.fromEntries(
          Object.entries(automation)
            .filter(([key]) => key !== 'volume' && key !== 'pan')
            .filter((entry): entry is [string, AutomationCurve] => entry[1] !== undefined)
            .map(([key, curve]) => [key, evaluateCurve(curve.points, timeSeconds, curve.points[0]?.curve ?? 'linear')]),
        )
      : {},
  };
}

export function evaluateCurve(
  points: AutomationPoint[],
  time: number,
  curveType: 'linear' | 'bezier' | 'step' | 'smooth',
): number {
  if (!points.length) return 0;
  if (points.length === 1) return points[0].value;

  // Sort points by time
  const sorted = [...points].sort((a, b) => a.time - b.time);

  // Boundary clamping
  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

  // Find the bounding segment
  let i = 0;
  while (i < sorted.length - 1 && sorted[i + 1].time < time) i++;

  const p0 = sorted[i];
  const p1 = sorted[i + 1];
  const t = (time - p0.time) / (p1.time - p0.time);

  switch (curveType) {
    case 'step':
      return p0.value;
    case 'linear':
      return p0.value + (p1.value - p0.value) * t;
    case 'smooth': {
      // Catmull-Rom spline interpolation
      const pPrev = i > 0 ? sorted[i - 1] : p0;
      const pNext = i < sorted.length - 2 ? sorted[i + 2] : p1;
      return catmullRom(pPrev.value, p0.value, p1.value, pNext.value, t);
    }
    case 'bezier':
      // Simplified bezier: uses cubic Hermite if handles available, else linear
      if (p0.handleOut || p1.handleIn) {
        return cubicHermite(p0, p1, t);
      }
      return p0.value + (p1.value - p0.value) * t;
    default:
      return p0.value + (p1.value - p0.value) * t;
  }
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function cubicHermite(p0: AutomationPoint, p1: AutomationPoint, t: number): number {
  // Tangent values from handles (scaled by segment duration)
  const duration = p1.time - p0.time;
  const m0 = p0.handleOut
    ? ((p0.handleOut.value - p0.value) / (p0.handleOut.time - p0.time)) * duration
    : p1.value - p0.value;
  const m1 = p1.handleIn
    ? ((p1.value - p1.handleIn.value) / (p1.time - p1.handleIn.time)) * duration
    : p1.value - p0.value;

  const t2 = t * t;
  const t3 = t2 * t;

  // Hermite basis functions
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return h00 * p0.value + h10 * m0 + h01 * p1.value + h11 * m1;
}
