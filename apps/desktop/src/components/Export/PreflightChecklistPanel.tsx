import { useCallback, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { zhCN } from '../../i18n/strings';
import {
  aggregatePreflightIssues,
  groupIssuesByCategory,
  acknowledgePreflightIssue,
  type PreflightIssue,
  type PreflightReport,
} from '@open-factory/editor-core';

const categoryLabels: Record<string, string> = {
  flash: '闪烁警告',
  continuity: '连续性',
  colorConsistency: '色彩一致性',
  readingSpeed: '阅读速度',
  loudness: '响度',
  shake: '画面抖动',
  anomaly: '异常片段',
};

export function PreflightChecklistPanel() {
  const project = useEditorStore((s) => s.project);
  const setPlayheadTime = useEditorStore((s) => s.setPlayheadTime);
  const [report, setReport] = useState<PreflightReport | null>(null);

  const handleGenerate = useCallback(() => {
    if (!project) return;
    const issues = aggregatePreflightIssues(project);
    const issuesByCategory = groupIssuesByCategory(issues);
    const totalCritical = issues.filter((i) => i.severity === 'critical').length;
    const totalWarnings = issues.filter((i) => i.severity === 'warning').length;
    const newReport: PreflightReport = {
      generatedAt: new Date().toISOString(),
      issuesByCategory,
      aiSummary: '',
      totalCritical,
      totalWarnings,
      acknowledgedIssueIds: [],
    };
    setReport(newReport);
    // Store in project
    const current = useEditorStore.getState().project;
    if (current) {
      useEditorStore.getState().setProject({ ...current, preflightReport: newReport });
    }
  }, [project]);

  const handleAcknowledge = useCallback(
    (issueId: string) => {
      if (!report) return;
      const updated = acknowledgePreflightIssue(report, issueId);
      setReport(updated);
      const current = useEditorStore.getState().project;
      if (current) {
        useEditorStore.getState().setProject({ ...current, preflightReport: updated });
      }
    },
    [report],
  );

  if (!report) {
    return (
      <div className="px-3 py-2" data-testid="preflight-panel">
        <button
          className="px-3 py-1.5 text-xs bg-accent text-white rounded hover:opacity-90"
          onClick={handleGenerate}
          data-testid="preflight-generate-btn"
        >
          {zhCN.preflightChecklist.title}
        </button>
      </div>
    );
  }

  const allIssues = Object.values(report.issuesByCategory).flat();
  const unackedIssues = allIssues.filter((i) => !report.acknowledgedIssueIds.includes(i.id));
  const categories = Object.entries(report.issuesByCategory);

  return (
    <div className="border-t border-line bg-panel" data-testid="preflight-panel">
      <div className="px-3 py-1.5 text-xs font-medium text-muted select-none">
        {zhCN.preflightChecklist.title}
      </div>
      {unackedIssues.length === 0 ? (
        <div className="px-3 py-2 text-xs text-green-600" data-testid="preflight-all-clear">
          {zhCN.preflightChecklist.allAcknowledged}
        </div>
      ) : (
        <div className="px-2 pb-2 space-y-2">
          <div className="flex gap-2 text-[10px] text-muted px-1">
            <span data-testid="preflight-critical-count">
              {zhCN.preflightChecklist.totalCritical.replace('{count}', String(unackedIssues.filter((i) => i.severity === 'critical').length))}
            </span>
            <span data-testid="preflight-warning-count">
              {zhCN.preflightChecklist.totalWarnings.replace('{count}', String(unackedIssues.filter((i) => i.severity === 'warning').length))}
            </span>
          </div>
          {categories.map(([cat, issues]) => {
            const visibleIssues = issues.filter((i) => !report.acknowledgedIssueIds.includes(i.id));
            if (visibleIssues.length === 0) return null;
            return (
              <div key={cat} data-testid={`preflight-category-${cat}`}>
                <div className="px-1 py-0.5 text-[10px] font-medium text-muted">
                  {categoryLabels[cat] ?? cat} ({visibleIssues.length})
                </div>
                {visibleIssues.map((issue: PreflightIssue) => (
                  <div
                    key={issue.id}
                    className="flex items-center gap-1.5 px-1.5 py-1 rounded text-xs"
                    data-testid={`preflight-issue-${issue.id}`}
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                        issue.severity === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}
                    />
                    <span
                      className="flex-1 truncate cursor-pointer hover:underline"
                      onClick={() => {
                        if (issue.time != null) setPlayheadTime(issue.time);
                      }}
                    >
                      {issue.message}
                    </span>
                    <button
                      className="text-[10px] text-muted hover:text-fg flex-shrink-0"
                      onClick={() => handleAcknowledge(issue.id)}
                      data-testid={`preflight-ack-${issue.id}`}
                    >
                      {zhCN.preflightChecklist.acknowledge}
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
