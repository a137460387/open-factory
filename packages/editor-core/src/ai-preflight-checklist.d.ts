/**
 * AI export preflight checklist.
 *
 * Aggregates existing detection data (flash warnings, continuity warnings,
 * color consistency, reading speed, loudness, shake, anomalies) into a
 * structured report, with AI summary generation support.
 */
/** 最小化 Project 引用，避免对 model-types 的循环依赖 */
interface PreflightProjectLike {
    timeline: {
        tracks: Array<{
            clips: Array<{
                type: string;
                id: string;
                start: number;
                flashWarnings?: Array<{
                    startTime: number;
                    flashRate: number;
                    severity: string;
                    isRedFlash: boolean;
                }>;
                anomalies?: Array<{
                    type: string;
                    startTime: number;
                    endTime: number;
                    severity: string;
                }>;
                stabilization?: {
                    analyzed?: boolean;
                    shakeScore?: number | null;
                };
                readingSpeedWarning?: {
                    charsPerSecond: number;
                    recommendedMax: number;
                    severity: string;
                } | null;
            }>;
        }>;
        continuityWarnings?: Array<{
            clipAId: string;
            clipBId: string;
            type: string;
            reason: string;
        }>;
        colorConsistencyWarnings?: Array<{
            clipAId: string;
            clipBId: string;
            type: string;
            reason: string;
        }>;
    };
    loudnessSuggestion?: {
        targetPlatform: string;
        measuredLUFS: number;
        targetLUFS: number;
        suggestedGainDb: number;
    };
}
export interface PreflightIssue {
    id: string;
    category: PreflightCategory;
    severity: 'critical' | 'warning';
    message: string;
    time?: number;
    clipId?: string;
}
export type PreflightCategory = 'flash' | 'continuity' | 'colorConsistency' | 'readingSpeed' | 'loudness' | 'shake' | 'anomaly';
export interface PreflightReport {
    generatedAt: string;
    issuesByCategory: Record<string, PreflightIssue[]>;
    aiSummary: string;
    totalCritical: number;
    totalWarnings: number;
    acknowledgedIssueIds: string[];
}
export interface PreflightAIResponse {
    summary: string;
    criticalCount: number;
    warningCount: number;
    recommendations: string[];
}
/**
 * Aggregate all existing detection data from a project into preflight issues.
 * Only reads already-generated fields; does not trigger any new analysis.
 * Empty/missing fields are skipped.
 */
export declare function aggregatePreflightIssues(project: PreflightProjectLike): PreflightIssue[];
/**
 * Group issues by category. Skips empty categories.
 */
export declare function groupIssuesByCategory(issues: PreflightIssue[]): Record<string, PreflightIssue[]>;
/**
 * Build an AI prompt summarizing all preflight issues for AI summary generation.
 */
export declare function buildPreflightAIPrompt(issues: PreflightIssue[]): string;
/**
 * Parse AI preflight summary response.
 */
export declare function parsePreflightAIResponse(json: string): PreflightAIResponse | null;
/**
 * Acknowledge (dismiss) a specific issue by ID. Returns a new report with the
 * issue ID added to acknowledgedIssueIds (deduped).
 */
export declare function acknowledgePreflightIssue(report: PreflightReport, issueId: string): PreflightReport;
export {};
//# sourceMappingURL=ai-preflight-checklist.d.ts.map