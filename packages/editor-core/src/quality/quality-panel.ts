/**
 * Quality Inspector Panel
 * Data layer for the "AI Quality Report" UI panel
 * Manages inspection state, progress tracking, and result presentation
 */

import type {
  QualityReport,
  QualityIssue,
  InspectorConfig,
  IssueSeverity,
  IssueCategory,
} from '../quality/types';

import {
  DEFAULT_INSPECTOR_CONFIG,
  PLATFORM_SPECS,
} from '../quality/types';

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
  /** Inspection progress (0-100) */
  progress: number;
  /** Current inspection step description */
  currentStep: string;
  /** Quality report result */
  report?: QualityReport;
  /** Selected issue for details */
  selectedIssueId?: string;
  /** Filter settings */
  filters: {
    severity: IssueSeverity[];
    category: IssueCategory[];
    autoFixableOnly: boolean;
  };
  /** Error message if phase is error */
  error?: string;
}

export function createInitialQualityPanelState(): QualityPanelState {
  return {
    phase: 'idle',
    config: { ...DEFAULT_INSPECTOR_CONFIG },
    progress: 0,
    currentStep: '',
    filters: {
      severity: [],
      category: [],
      autoFixableOnly: false,
    },
  };
}

// ─── Panel Actions ──────────────────────────────────────────────

export type QualityPanelAction =
  | { type: 'START_INSPECTION' }
  | { type: 'UPDATE_PROGRESS'; progress: number; step: string }
  | { type: 'INSPECTION_COMPLETE'; report: QualityReport }
  | { type: 'INSPECTION_ERROR'; error: string }
  | { type: 'UPDATE_CONFIG'; config: Partial<InspectorConfig> }
  | { type: 'SELECT_ISSUE'; issueId: string | undefined }
  | { type: 'TOGGLE_SEVERITY_FILTER'; severity: IssueSeverity }
  | { type: 'TOGGLE_CATEGORY_FILTER'; category: IssueCategory }
  | { type: 'TOGGLE_AUTO_FIXABLE_FILTER' }
  | { type: 'RESET' };

/**
 * Pure state reducer for the quality inspection panel
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
        currentStep: '准备质检...',
        report: undefined,
        error: undefined,
      };

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        progress: action.progress,
        currentStep: action.step,
      };

    case 'INSPECTION_COMPLETE':
      return {
        ...state,
        phase: 'complete',
        progress: 100,
        currentStep: '质检完成',
        report: action.report,
      };

    case 'INSPECTION_ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.error,
      };

    case 'UPDATE_CONFIG':
      return {
        ...state,
        config: { ...state.config, ...action.config },
      };

    case 'SELECT_ISSUE':
      return {
        ...state,
        selectedIssueId: action.issueId,
      };

    case 'TOGGLE_SEVERITY_FILTER': {
      const current = state.filters.severity;
      const newSeverity = current.includes(action.severity)
        ? current.filter((s) => s !== action.severity)
        : [...current, action.severity];
      return {
        ...state,
        filters: { ...state.filters, severity: newSeverity },
      };
    }

    case 'TOGGLE_CATEGORY_FILTER': {
      const current = state.filters.category;
      const newCategory = current.includes(action.category)
        ? current.filter((c) => c !== action.category)
        : [...current, action.category];
      return {
        ...state,
        filters: { ...state.filters, category: newCategory },
      };
    }

    case 'TOGGLE_AUTO_FIXABLE_FILTER':
      return {
        ...state,
        filters: { ...state.filters, autoFixableOnly: !state.filters.autoFixableOnly },
      };

    case 'RESET':
      return createInitialQualityPanelState();

    default:
      return state;
  }
}

// ─── Selectors ──────────────────────────────────────────────────

/**
 * Get filtered issues based on current filters
 */
export function getFilteredIssues(state: QualityPanelState): QualityIssue[] {
  if (!state.report) return [];

  let issues = state.report.issues;

  if (state.filters.severity.length > 0) {
    issues = issues.filter((i) => state.filters.severity.includes(i.severity));
  }

  if (state.filters.category.length > 0) {
    issues = issues.filter((i) => state.filters.category.includes(i.category));
  }

  if (state.filters.autoFixableOnly) {
    issues = issues.filter((i) => i.autoFixable);
  }

  return issues;
}

/**
 * Get issue statistics by severity
 */
export function getIssueStats(report: QualityReport): Record<IssueSeverity, number> {
  return {
    critical: report.issues.filter((i) => i.severity === 'critical').length,
    error: report.issues.filter((i) => i.severity === 'error').length,
    warning: report.issues.filter((i) => i.severity === 'warning').length,
    info: report.issues.filter((i) => i.severity === 'info').length,
  };
}

/**
 * Get grade color for display
 */
export function getGradeColor(grade: QualityReport['grade']): string {
  switch (grade) {
    case 'A':
      return '#22c55e';
    case 'B':
      return '#84cc16';
    case 'C':
      return '#eab308';
    case 'D':
      return '#f97316';
    case 'F':
      return '#ef4444';
  }
}

/**
 * Get severity color for display
 */
export function getSeverityColor(severity: IssueSeverity): string {
  switch (severity) {
    case 'critical':
      return '#dc2626';
    case 'error':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    case 'info':
      return '#3b82f6';
  }
}

/**
 * Get severity label in Chinese
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
  }
}

/**
 * Get category label in Chinese
 */
export function getCategoryLabel(category: IssueCategory): string {
  switch (category) {
    case 'technical':
      return '技术缺陷';
    case 'content':
      return '内容问题';
    case 'compliance':
      return '格式合规';
  }
}

/**
 * Format inspection duration
 */
export function formatInspectionDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}
