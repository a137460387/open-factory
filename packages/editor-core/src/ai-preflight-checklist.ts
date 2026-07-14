/**
 * AI export preflight checklist.
 *
 * Aggregates existing detection data (flash warnings, continuity warnings,
 * color consistency, reading speed, loudness, shake, anomalies) into a
 * structured report, with AI summary generation support.
 */

import type { Project, SubtitleClip, VideoClip } from './model-types';

// --- Types ---

export interface PreflightIssue {
  id: string;
  category: PreflightCategory;
  severity: 'critical' | 'warning';
  message: string;
  time?: number;
  clipId?: string;
}

export type PreflightCategory =
  'flash' | 'continuity' | 'colorConsistency' | 'readingSpeed' | 'loudness' | 'shake' | 'anomaly';

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

// --- Core functions ---

/**
 * Aggregate all existing detection data from a project into preflight issues.
 * Only reads already-generated fields; does not trigger any new analysis.
 * Empty/missing fields are skipped.
 */
export function aggregatePreflightIssues(project: Project): PreflightIssue[] {
  const issues: PreflightIssue[] = [];

  // Flash warnings from clips
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.type !== 'video') continue;
      const vc = clip as VideoClip;
      if (vc.flashWarnings) {
        for (const fw of vc.flashWarnings) {
          issues.push({
            id: `flash-${vc.id}-${fw.startTime}`,
            category: 'flash',
            severity: fw.severity === 'high' ? 'critical' : 'warning',
            message: `闪烁警告: flashRate=${fw.flashRate.toFixed(1)}, severity=${fw.severity}${fw.isRedFlash ? ', 红色闪烁' : ''}`,
            time: fw.startTime,
            clipId: vc.id,
          });
        }
      }
      if (vc.anomalies) {
        for (const anom of vc.anomalies) {
          issues.push({
            id: `anomaly-${vc.id}-${anom.startTime}`,
            category: 'anomaly',
            severity: anom.severity === 'high' ? 'critical' : 'warning',
            message: `异常片段: ${anom.type}, ${anom.startTime.toFixed(1)}s-${anom.endTime.toFixed(1)}s, severity=${anom.severity}`,
            time: anom.startTime,
            clipId: vc.id,
          });
        }
      }
      if (vc.stabilization?.analyzed && vc.stabilization.shakeScore != null && vc.stabilization.shakeScore > 50) {
        issues.push({
          id: `shake-${vc.id}`,
          category: 'shake',
          severity: vc.stabilization.shakeScore > 80 ? 'critical' : 'warning',
          message: `画面抖动: shakeScore=${vc.stabilization.shakeScore.toFixed(1)}`,
          time: vc.start,
          clipId: vc.id,
        });
      }
    }
  }

  // Continuity warnings from timeline
  if (project.timeline.continuityWarnings) {
    for (const cw of project.timeline.continuityWarnings) {
      issues.push({
        id: `continuity-${cw.clipAId}-${cw.clipBId}-${cw.type}`,
        category: 'continuity',
        severity: 'warning',
        message: `连续性警告: ${cw.type} - ${cw.reason}`,
        clipId: cw.clipAId,
      });
    }
  }

  // Color consistency warnings from timeline
  if (project.timeline.colorConsistencyWarnings) {
    for (const ccw of project.timeline.colorConsistencyWarnings) {
      issues.push({
        id: `color-${ccw.clipAId}-${ccw.clipBId}-${ccw.type}`,
        category: 'colorConsistency',
        severity: 'warning',
        message: `色彩一致性: ${ccw.type} - ${ccw.reason}`,
        clipId: ccw.clipAId,
      });
    }
  }

  // Reading speed warnings from subtitle segments
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.type !== 'subtitle') continue;
      const sc = clip as SubtitleClip;
      if (sc.readingSpeedWarning) {
        const rsw = sc.readingSpeedWarning;
        issues.push({
          id: `readingSpeed-${sc.id}`,
          category: 'readingSpeed',
          severity: rsw.severity === 'critical' ? 'critical' : 'warning',
          message: `阅读速度过快: ${rsw.charsPerSecond.toFixed(1)} 字/秒 (推荐最大 ${rsw.recommendedMax.toFixed(1)})`,
          time: sc.start,
          clipId: sc.id,
        });
      }
    }
  }

  // Loudness suggestion from project
  if (project.loudnessSuggestion) {
    const ls = project.loudnessSuggestion;
    issues.push({
      id: `loudness-${ls.targetPlatform}`,
      category: 'loudness',
      severity: Math.abs(ls.suggestedGainDb) > 6 ? 'critical' : 'warning',
      message: `响度适配: 实测 ${ls.measuredLUFS.toFixed(1)} LUFS, 目标 ${ls.targetLUFS.toFixed(1)} LUFS (${ls.targetPlatform}), 建议增益 ${ls.suggestedGainDb > 0 ? '+' : ''}${ls.suggestedGainDb.toFixed(1)} dB`,
    });
  }

  return issues;
}

/**
 * Group issues by category. Skips empty categories.
 */
export function groupIssuesByCategory(issues: PreflightIssue[]): Record<string, PreflightIssue[]> {
  const grouped: Record<string, PreflightIssue[]> = {};
  for (const issue of issues) {
    if (!grouped[issue.category]) grouped[issue.category] = [];
    grouped[issue.category].push(issue);
  }
  return grouped;
}

/**
 * Build an AI prompt summarizing all preflight issues for AI summary generation.
 */
export function buildPreflightAIPrompt(issues: PreflightIssue[]): string {
  if (issues.length === 0) return '项目无任何警告或问题，可以直接导出。';

  const lines = [
    '你是一个专业的视频导出前检查助手。以下是一个视频项目的导出前检查结果。',
    '请根据问题数据生成一个简洁的总结（≤100字），统计critical和warning数量，并给出优先处理建议。',
    '',
    '返回严格JSON格式:',
    '{',
    '  "summary": "总结文本",',
    '  "criticalCount": 数字,',
    '  "warningCount": 数字,',
    '  "recommendations": ["建议1", "建议2"]',
    '}',
    '',
    '检测到的问题:',
  ];

  for (const issue of issues) {
    lines.push(`  [${issue.severity.toUpperCase()}][${issue.category}] ${issue.message}`);
  }

  return lines.join('\n');
}

/**
 * Parse AI preflight summary response.
 */
export function parsePreflightAIResponse(json: string): PreflightAIResponse | null {
  try {
    const parsed = JSON.parse(json) as PreflightAIResponse;
    if (typeof parsed.summary !== 'string') return null;
    if (typeof parsed.criticalCount !== 'number' || typeof parsed.warningCount !== 'number') return null;
    if (!Array.isArray(parsed.recommendations)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Acknowledge (dismiss) a specific issue by ID. Returns a new report with the
 * issue ID added to acknowledgedIssueIds (deduped).
 */
export function acknowledgePreflightIssue(report: PreflightReport, issueId: string): PreflightReport {
  if (report.acknowledgedIssueIds.includes(issueId)) return report;
  return {
    ...report,
    acknowledgedIssueIds: [...report.acknowledgedIssueIds, issueId],
  };
}
