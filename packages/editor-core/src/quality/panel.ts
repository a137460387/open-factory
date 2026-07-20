/**
 * Quality Inspector Panel
 * Data layer for the "AI Quality Report" UI panel.
 * Manages inspection state, progress tracking, and result presentation.
 */

import type {
  InspectorConfig,
  QualityReport,
  InspectorQualityIssue,
  IssueSeverity,
  IssueCategory,
} from '../quality/types';

import {
  DEFAULT_INSPECTOR_CONFIG,
  PLATFORM_SPECS,
} from '../quality/types';

import {
  runQualityInspection,
  formatTime,
  scoreToGrade,
} from '../quality/inspector';

// ─── Panel State ────────────────────────────────────────────────

export type QualityPanelPhase =
  | 'idle'
  | 'configuring'
  | 'inspecting'
  | 'complete'
  | 'error';

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

export function createInitialQualityPanelState(): QualityPanelState {
  return {
    phase: 'idle',
    config: { ...DEFAULT_INSPECTOR_CONFIG },
    progress: 0,
    filteredIssues: [],
    filters: {
      autoFixableOnly: false,
    },
  };
}

// ─── Panel Actions ──────────────────────────────────────────────

export type QualityPanelAction =
  | { type: 'START_INSPECTION' }
  | { type: 'UPDATE_PROGRESS'; progress: number }
  | { type: 'INSPECTION_COMPLETE'; report: QualityReport }
  | { type: 'INSPECTION_ERROR'; error: string }
  | { type: 'UPDATE_CONFIG'; config: Partial<InspectorConfig> }
  | { type: 'SET_FILTER'; filter: Partial<QualityPanelState['filters']> }
  | { type: 'SELECT_ISSUE'; issueId: string | undefined }
  | { type: 'RESET' };

/**
 * Pure state reducer for the quality inspector panel.
 * Follows immutable update patterns.
 */
export function qualityPanelReducer(
  state: QualityPanelState,
  action: QualityPanelAction,
): QualityPanelState {
  switch (action.type) {
    case 'START_INSPECTION':
      return {
        ...state,
        phase: 'inspecting',
        progress: 0,
        report: undefined,
        error: undefined,
        selectedIssueId: undefined,
      };

    case 'UPDATE_PROGRESS':
      return { ...state, progress: action.progress };

    case 'INSPECTION_COMPLETE': {
      const filteredIssues = filterIssues(action.report.issues, state.filters);
      return {
        ...state,
        phase: 'complete',
        report: action.report,
        filteredIssues,
        progress: 100,
      };
    }

    case 'INSPECTION_ERROR':
      return { ...state, phase: 'error', error: action.error, progress: 0 };

    case 'UPDATE_CONFIG':
      return { ...state, config: { ...state.config, ...action.config } };

    case 'SET_FILTER': {
      const newFilters = { ...state.filters, ...action.filter };
      const filteredIssues = state.report ? filterIssues(state.report.issues, newFilters) : [];
      return { ...state, filters: newFilters, filteredIssues };
    }

    case 'SELECT_ISSUE':
      return { ...state, selectedIssueId: action.issueId };

    case 'RESET':
      return createInitialQualityPanelState();

    default:
      return state;
  }
}

/**
 * Filter issues based on current filters
 */
function filterIssues(
  issues: InspectorQualityIssue[],
  filters: QualityPanelState['filters'],
): InspectorQualityIssue[] {
  return issues.filter((issue) => {
    if (filters.severity && issue.severity !== filters.severity) return false;
    if (filters.category && issue.category !== filters.category) return false;
    if (filters.autoFixableOnly && !issue.autoFixable) return false;
    return true;
  });
}

// ─── Panel Selectors ────────────────────────────────────────────

/**
 * Get severity color for UI display
 */
export function getSeverityColor(severity: IssueSeverity): string {
  switch (severity) {
    case 'critical':
      return '#dc2626';
    case 'error':
      return '#ea580c';
    case 'warning':
      return '#ca8a04';
    case 'info':
      return '#2563eb';
    default:
      return '#6b7280';
  }
}

/**
 * Get severity label for UI display
 */
export function getSeverityLabel(severity: IssueSeverity): string {
  switch (severity) {
    case 'critical':
      return '严重';
    case 'error':
      return '错误';
    case 'warning':
      return '警告';
    case 'info':
      return '提示';
    default:
      return '未知';
  }
}

/**
 * Get category label for UI display
 */
export function getCategoryLabel(category: IssueCategory): string {
  switch (category) {
    case 'technical':
      return '技术缺陷';
    case 'content':
      return '内容问题';
    case 'compliance':
      return '格式合规';
    default:
      return '其他';
  }
}

/**
 * Get grade color for UI display
 */
export function getGradeColor(grade: QualityReport['grade']): string {
  switch (grade) {
    case 'A':
      return '#16a34a';
    case 'B':
      return '#65a30d';
    case 'C':
      return '#ca8a04';
    case 'D':
      return '#ea580c';
    case 'F':
      return '#dc2626';
    default:
      return '#6b7280';
  }
}

/**
 * Format issue timeline for display
 */
export function formatIssueTimeline(issue: InspectorQualityIssue): string {
  if (!issue.timeRange) return '全局';
  return `${formatTime(issue.timeRange.start)} - ${formatTime(issue.timeRange.end)}`;
}

/**
 * Get summary statistics for display
 */
export function getQualitySummaryStats(report: QualityReport): Array<{
  label: string;
  value: string | number;
  color?: string;
}> {
  return [
    { label: '总分', value: report.overallScore, color: getGradeColor(report.grade) },
    { label: '等级', value: report.grade, color: getGradeColor(report.grade) },
    { label: '问题总数', value: report.summary.totalIssues },
    { label: '严重问题', value: report.summary.criticalIssues, color: getSeverityColor('critical') },
    { label: '错误问题', value: report.summary.errorIssues, color: getSeverityColor('error') },
    { label: '警告问题', value: report.summary.warningIssues, color: getSeverityColor('warning') },
    { label: '可自动修复', value: report.summary.autoFixableCount, color: '#2563eb' },
    { label: '技术评分', value: report.summary.technicalScore },
    { label: '内容评分', value: report.summary.contentScore },
    { label: '合规评分', value: report.summary.complianceScore },
  ];
}

/**
 * Get platform options for configuration
 */
export function getPlatformOptions(): Array<{ value: string; label: string }> {
  return Object.entries(PLATFORM_SPECS).map(([key, spec]) => ({
    value: key,
    label: spec.name,
  }));
}
