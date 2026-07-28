import type { Project, VideoClip } from './model-types';
export type StressScenarioId = 'mega-clips' | 'long-timeline' | 'mass-keyframes' | 'deep-nested';
export interface StressScenarioDef {
    id: StressScenarioId;
    label: string;
    description: string;
}
export declare const STRESS_SCENARIOS: StressScenarioDef[];
export interface StressPerfMetrics {
    clipCount: number;
    totalDurationSec: number;
    maxKeyframesPerClip: number;
    nestingDepth: number;
    renderTimeMs: number;
    memoryUsageMb: number;
    exportEstimateSec: number;
}
export interface StressBaseline {
    renderTimeMs: number;
    memoryUsageMb: number;
    exportEstimateSec: number;
}
export interface StressPerfVerdict {
    metric: keyof StressBaseline;
    current: number;
    baseline: number | undefined;
    degraded: boolean;
}
export interface StressReport {
    scenarioId: StressScenarioId;
    startedAt: number;
    completedAt: number;
    metrics: StressPerfMetrics;
    verdicts: StressPerfVerdict[];
    version: string;
}
export declare function createVideoClipForStress(trackId: string, start: number, duration: number, index: number): VideoClip;
export declare function generateMegaClipsProject(clipCount?: number): {
    project: Project;
    trackId: string;
};
export declare function generateLongTimelineProject(targetHours?: number): {
    project: Project;
    trackId: string;
};
export declare function generateMassKeyframesProject(keyframeCount?: number): {
    project: Project;
    trackId: string;
    clipId: string;
};
export declare function generateDeepNestedProject(depth?: number): {
    project: Project;
    sequenceIds: string[];
};
export declare function generateStressScenario(scenarioId: StressScenarioId): {
    project: Project;
    metrics: Pick<StressPerfMetrics, 'clipCount' | 'totalDurationSec' | 'maxKeyframesPerClip' | 'nestingDepth'>;
};
export declare function measurePerfMetrics(baseMetrics: Pick<StressPerfMetrics, 'clipCount' | 'totalDurationSec' | 'maxKeyframesPerClip' | 'nestingDepth'>, renderTimeMs: number, memoryUsageMb: number, exportEstimateSec: number): StressPerfMetrics;
export declare function compareWithBaseline(metrics: StressPerfMetrics, baseline: StressBaseline | undefined): StressPerfVerdict[];
export declare function buildStressReport(scenarioId: StressScenarioId, startedAt: number, metrics: StressPerfMetrics, baseline: StressBaseline | undefined, version: string): StressReport;
export declare function serializeStressReport(report: StressReport): string;
export declare function createIsolatedProjectContext<T>(generator: () => T): {
    result: T;
    cleanup: () => void;
};
//# sourceMappingURL=stress-test.d.ts.map