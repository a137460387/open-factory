/**
 * Quality Inspector Panel
 * Data layer for the "AI Quality Report" UI panel.
 * Manages inspection state, progress tracking, and result presentation.
 */
import type { InspectorConfig, QualityReport, InspectorQualityIssue, IssueSeverity, IssueCategory } from '../quality/types';
export type QualityPanelPhase = 'idle' | 'configuring' | 'inspecting' | 'complete' | 'error';
export interface QualityPanelState {
    /** Current phase */
    phase: QualityPanelPhase;
    /** Inspector configuration */
    config: InspectorConfig;
    /** Current progress (0-100) */
    progress: number;
    /** Inspection result */
    report?: QualityReport;
    /** Filtered issues */
    filteredIssues: InspectorQualityIssue[];
    /** Active filters */
    filters: {
        severity?: IssueSeverity;
        category?: IssueCategory;
        autoFixableOnly: boolean;
    };
    /** Selected issue for detail view */
    selectedIssueId?: string;
    /** Error message if phase is error */
    error?: string;
}
export declare function createInitialQualityPanelState(): QualityPanelState;
export type QualityPanelAction = {
    type: 'START_INSPECTION';
} | {
    type: 'UPDATE_PROGRESS';
    progress: number;
} | {
    type: 'INSPECTION_COMPLETE';
    report: QualityReport;
} | {
    type: 'INSPECTION_ERROR';
    error: string;
} | {
    type: 'UPDATE_CONFIG';
    config: Partial<InspectorConfig>;
} | {
    type: 'SET_FILTER';
    filter: Partial<QualityPanelState['filters']>;
} | {
    type: 'SELECT_ISSUE';
    issueId: string | undefined;
} | {
    type: 'RESET';
};
/**
 * Pure state reducer for the quality inspector panel.
 * Follows immutable update patterns.
 */
export declare function qualityPanelReducer(state: QualityPanelState, action: QualityPanelAction): QualityPanelState;
/**
 * Get severity color for UI display
 */
export declare function getSeverityColor(severity: IssueSeverity): string;
/**
 * Get severity label for UI display
 */
export declare function getSeverityLabel(severity: IssueSeverity): string;
/**
 * Get category label for UI display
 */
export declare function getCategoryLabel(category: IssueCategory): string;
/**
 * Get grade color for UI display
 */
export declare function getGradeColor(grade: QualityReport['grade']): string;
/**
 * Format issue timeline for display
 */
export declare function formatIssueTimeline(issue: InspectorQualityIssue): string;
/**
 * Get summary statistics for display
 */
export declare function getQualitySummaryStats(report: QualityReport): Array<{
    label: string;
    value: string | number;
    color?: string;
}>;
/**
 * Get platform options for configuration
 */
export declare function getPlatformOptions(): Array<{
    value: string;
    label: string;
}>;
//# sourceMappingURL=panel.d.ts.map