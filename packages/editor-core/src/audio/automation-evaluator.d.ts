import type { ChannelAutomation, AutomationPoint } from './mixer-types';
export interface AutomationEvaluationResult {
    volume: number;
    pan: number;
    effectParams: Record<string, number>;
}
export declare function evaluateAutomation(automation: ChannelAutomation, timeSeconds: number): AutomationEvaluationResult;
export declare function evaluateCurve(points: AutomationPoint[], time: number, curveType: 'linear' | 'bezier' | 'step' | 'smooth'): number;
//# sourceMappingURL=automation-evaluator.d.ts.map