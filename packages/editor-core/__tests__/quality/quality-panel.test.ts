import { describe, it, expect } from 'vitest';
import {
  createInitialQualityPanelState,
  qualityPanelReducer,
  getFilteredIssues,
  getIssueStats,
  getGradeColor,
  getSeverityColor,
  getSeverityLabel,
  getCategoryLabel,
  formatInspectionDuration,
} from '../../src/quality/quality-panel';
import type { QualityReport, InspectorQualityIssue } from '../../src/quality/types';

function makeIssue(overrides: Partial<InspectorQualityIssue> = {}): InspectorQualityIssue {
  return {
    id: 'issue-1',
    category: 'technical',
    type: 'black-frame',
    severity: 'warning',
    description: '黑场',
    suggestion: '删除黑帧',
    autoFixable: false,
    ...overrides,
  };
}

function makeReport(issues: InspectorQualityIssue[]): QualityReport {
  return {
    id: 'report-1',
    timestamp: Date.now(),
    duration: 100,
    overallScore: 80,
    grade: 'B',
    issues,
    frameAnalyses: [],
    audioAnalyses: [],
    pacingSegments: [],
    sceneTransitions: [],
    complianceResults: [],
    summary: {
      technicalScore: 80,
      contentScore: 80,
      complianceScore: 80,
      totalIssues: issues.length,
      criticalCount: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
    } as never,
  };
}

describe('quality-panel: 初始状态', () => {
  it('createInitialQualityPanelState 返回 idle 相位', () => {
    const state = createInitialQualityPanelState();
    expect(state.phase).toBe('idle');
    expect(state.progress).toBe(0);
    expect(state.currentStep).toBe('');
    expect(state.report).toBeUndefined();
    expect(state.error).toBeUndefined();
    expect(state.selectedIssueId).toBeUndefined();
  });

  it('初始过滤器为空', () => {
    const state = createInitialQualityPanelState();
    expect(state.filters.severity).toEqual([]);
    expect(state.filters.category).toEqual([]);
    expect(state.filters.autoFixableOnly).toBe(false);
  });

  it('初始 config 来自 DEFAULT_INSPECTOR_CONFIG', () => {
    const state = createInitialQualityPanelState();
    expect(state.config).toBeDefined();
    expect(state.config).toEqual(expect.objectContaining({}));
  });
});

describe('quality-panel: reducer 状态转换', () => {
  it('START_INSPECTION 进入 inspecting 相位', () => {
    const state = qualityPanelReducer(createInitialQualityPanelState(), {
      type: 'START_INSPECTION',
    });
    expect(state.phase).toBe('inspecting');
    expect(state.progress).toBe(0);
    expect(state.currentStep).toBe('准备质检...');
    expect(state.report).toBeUndefined();
    expect(state.error).toBeUndefined();
  });

  it('UPDATE_PROGRESS 更新进度和步骤', () => {
    let state = qualityPanelReducer(createInitialQualityPanelState(), { type: 'START_INSPECTION' });
    state = qualityPanelReducer(state, { type: 'UPDATE_PROGRESS', progress: 50, step: '分析帧' });
    expect(state.progress).toBe(50);
    expect(state.currentStep).toBe('分析帧');
  });

  it('INSPECTION_COMPLETE 设置报告并标记完成', () => {
    const report = makeReport([makeIssue()]);
    let state = qualityPanelReducer(createInitialQualityPanelState(), { type: 'START_INSPECTION' });
    state = qualityPanelReducer(state, { type: 'INSPECTION_COMPLETE', report });

    expect(state.phase).toBe('complete');
    expect(state.progress).toBe(100);
    expect(state.currentStep).toBe('质检完成');
    expect(state.report).toBe(report);
  });

  it('INSPECTION_ERROR 设置错误相位', () => {
    let state = qualityPanelReducer(createInitialQualityPanelState(), { type: 'START_INSPECTION' });
    state = qualityPanelReducer(state, { type: 'INSPECTION_ERROR', error: '分析失败' });

    expect(state.phase).toBe('error');
    expect(state.error).toBe('分析失败');
  });

  it('UPDATE_CONFIG 合并配置', () => {
    const state = qualityPanelReducer(createInitialQualityPanelState(), {
      type: 'UPDATE_CONFIG',
      config: { targetPlatform: 'youtube-4k' } as never,
    });
    expect((state.config as Record<string, unknown>).targetPlatform).toBe('youtube-4k');
  });

  it('SELECT_ISSUE 设置选中 ID', () => {
    let state = qualityPanelReducer(createInitialQualityPanelState(), {
      type: 'SELECT_ISSUE',
      issueId: 'issue-5',
    });
    expect(state.selectedIssueId).toBe('issue-5');

    state = qualityPanelReducer(state, { type: 'SELECT_ISSUE', issueId: undefined });
    expect(state.selectedIssueId).toBeUndefined();
  });

  it('TOGGLE_SEVERITY_FILTER 切换严重级别过滤', () => {
    let state = createInitialQualityPanelState();
    state = qualityPanelReducer(state, { type: 'TOGGLE_SEVERITY_FILTER', severity: 'critical' });
    expect(state.filters.severity).toContain('critical');

    state = qualityPanelReducer(state, { type: 'TOGGLE_SEVERITY_FILTER', severity: 'critical' });
    expect(state.filters.severity).not.toContain('critical');
  });

  it('TOGGLE_CATEGORY_FILTER 切换类别过滤', () => {
    let state = createInitialQualityPanelState();
    state = qualityPanelReducer(state, { type: 'TOGGLE_CATEGORY_FILTER', category: 'content' });
    expect(state.filters.category).toContain('content');

    state = qualityPanelReducer(state, { type: 'TOGGLE_CATEGORY_FILTER', category: 'content' });
    expect(state.filters.category).not.toContain('content');
  });

  it('TOGGLE_AUTO_FIXABLE_FILTER 切换仅可自动修复', () => {
    let state = createInitialQualityPanelState();
    expect(state.filters.autoFixableOnly).toBe(false);

    state = qualityPanelReducer(state, { type: 'TOGGLE_AUTO_FIXABLE_FILTER' });
    expect(state.filters.autoFixableOnly).toBe(true);

    state = qualityPanelReducer(state, { type: 'TOGGLE_AUTO_FIXABLE_FILTER' });
    expect(state.filters.autoFixableOnly).toBe(false);
  });

  it('RESET 恢复初始状态', () => {
    let state = qualityPanelReducer(createInitialQualityPanelState(), { type: 'START_INSPECTION' });
    state = qualityPanelReducer(state, { type: 'RESET' });
    expect(state.phase).toBe('idle');
    expect(state.progress).toBe(0);
  });

  it('未知 action 返回原状态', () => {
    const initial = createInitialQualityPanelState();
    const state = qualityPanelReducer(initial, { type: 'UNKNOWN' } as never);
    expect(state).toBe(initial);
  });
});

describe('quality-panel: selectors', () => {
  it('getFilteredIssues 无报告时返回空数组', () => {
    const state = createInitialQualityPanelState();
    expect(getFilteredIssues(state)).toEqual([]);
  });

  it('getFilteredIssues 无过滤时返回全部', () => {
    const issues = [makeIssue({ id: '1' }), makeIssue({ id: '2', severity: 'critical' })];
    const report = makeReport(issues);
    let state = qualityPanelReducer(createInitialQualityPanelState(), {
      type: 'INSPECTION_COMPLETE',
      report,
    });
    expect(getFilteredIssues(state)).toHaveLength(2);
  });

  it('getFilteredIssues 按严重级别过滤', () => {
    const issues = [
      makeIssue({ id: '1', severity: 'warning' }),
      makeIssue({ id: '2', severity: 'critical' }),
      makeIssue({ id: '3', severity: 'info' }),
    ];
    let state = qualityPanelReducer(createInitialQualityPanelState(), {
      type: 'INSPECTION_COMPLETE',
      report: makeReport(issues),
    });
    state = qualityPanelReducer(state, { type: 'TOGGLE_SEVERITY_FILTER', severity: 'critical' });

    const filtered = getFilteredIssues(state);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].severity).toBe('critical');
  });

  it('getFilteredIssues 按类别过滤', () => {
    const issues = [
      makeIssue({ id: '1', category: 'technical' }),
      makeIssue({ id: '2', category: 'content' }),
    ];
    let state = qualityPanelReducer(createInitialQualityPanelState(), {
      type: 'INSPECTION_COMPLETE',
      report: makeReport(issues),
    });
    state = qualityPanelReducer(state, { type: 'TOGGLE_CATEGORY_FILTER', category: 'content' });

    expect(getFilteredIssues(state)).toHaveLength(1);
    expect(getFilteredIssues(state)[0].category).toBe('content');
  });

  it('getFilteredIssues 仅显示可自动修复', () => {
    const issues = [
      makeIssue({ id: '1', autoFixable: true }),
      makeIssue({ id: '2', autoFixable: false }),
    ];
    let state = qualityPanelReducer(createInitialQualityPanelState(), {
      type: 'INSPECTION_COMPLETE',
      report: makeReport(issues),
    });
    state = qualityPanelReducer(state, { type: 'TOGGLE_AUTO_FIXABLE_FILTER' });

    expect(getFilteredIssues(state)).toHaveLength(1);
    expect(getFilteredIssues(state)[0].autoFixable).toBe(true);
  });

  it('getIssueStats 按严重级别统计', () => {
    const issues = [
      makeIssue({ severity: 'critical' }),
      makeIssue({ severity: 'critical' }),
      makeIssue({ severity: 'warning' }),
      makeIssue({ severity: 'info' }),
    ];
    const stats = getIssueStats(makeReport(issues));
    expect(stats.critical).toBe(2);
    expect(stats.warning).toBe(1);
    expect(stats.info).toBe(1);
    expect(stats.error).toBe(0);
  });
});

describe('quality-panel: 显示工具函数', () => {
  it('getGradeColor 返回各等级颜色', () => {
    expect(getGradeColor('A')).toBe('#22c55e');
    expect(getGradeColor('B')).toBe('#84cc16');
    expect(getGradeColor('C')).toBe('#eab308');
    expect(getGradeColor('D')).toBe('#f97316');
    expect(getGradeColor('F')).toBe('#ef4444');
  });

  it('getSeverityColor 返回各严重级别颜色', () => {
    expect(getSeverityColor('critical')).toBe('#dc2626');
    expect(getSeverityColor('error')).toBe('#ef4444');
    expect(getSeverityColor('warning')).toBe('#f59e0b');
    expect(getSeverityColor('info')).toBe('#3b82f6');
  });

  it('getSeverityLabel 返回中文标签', () => {
    expect(getSeverityLabel('critical')).toBe('严重');
    expect(getSeverityLabel('error')).toBe('错误');
    expect(getSeverityLabel('warning')).toBe('警告');
    expect(getSeverityLabel('info')).toBe('提示');
  });

  it('getCategoryLabel 返回中文标签', () => {
    expect(getCategoryLabel('technical')).toBe('技术缺陷');
    expect(getCategoryLabel('content')).toBe('内容问题');
    expect(getCategoryLabel('compliance')).toBe('格式合规');
  });

  it('formatInspectionDuration 格式化时长', () => {
    expect(formatInspectionDuration(500)).toBe('500ms');
    expect(formatInspectionDuration(1500)).toBe('1.5s');
    expect(formatInspectionDuration(30000)).toBe('30.0s');
    expect(formatInspectionDuration(90000)).toBe('1.5min');
  });
});
