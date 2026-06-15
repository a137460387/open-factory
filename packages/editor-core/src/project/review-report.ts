import type { Project, ReviewAnnotation } from '../model';
import { getTimelineDuration } from '../timeline';
import { secondsToTimecode } from '../time';

export interface ReviewReportOptions {
  generatedAt?: string;
}

export interface ReviewReportAnnotationRow {
  index: number;
  id: string;
  time: number;
  type: ReviewAnnotation['type'];
  text: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReviewReport {
  projectName: string;
  duration: number;
  fps: number;
  generatedAt: string;
  annotations: ReviewReportAnnotationRow[];
}

export function buildReviewReport(project: Project, options: ReviewReportOptions = {}): ReviewReport {
  const fps = project.settings.fps || 30;
  return {
    projectName: project.name,
    duration: getTimelineDuration(project.timeline),
    fps,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    annotations: [...(project.reviewAnnotations ?? [])]
      .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id))
      .map((annotation, index) => ({
        index: index + 1,
        id: annotation.id,
        time: annotation.time,
        type: annotation.type,
        text: annotation.text,
        color: annotation.color,
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height
      }))
  };
}

export function buildReviewReportHtml(project: Project, options: ReviewReportOptions = {}): string {
  return renderReviewReportHtml(buildReviewReport(project, options));
}

export function renderReviewReportHtml(report: ReviewReport): string {
  const fps = report.fps;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>评审报告 - ${escapeHtml(report.projectName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 24px 0 10px; }
    .meta { color: #64748b; margin-bottom: 20px; }
    .overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; border: 1px solid #d7dde8; background: #f8fafc; padding: 12px; }
    .overview div { display: grid; gap: 3px; }
    .overview span { color: #64748b; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #d7dde8; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    .shot { width: 176px; height: 99px; background: #101827; border-radius: 4px; overflow: hidden; display: block; }
    .empty { color: #64748b; }
  </style>
</head>
<body>
  <h1>评审报告：${escapeHtml(report.projectName)}</h1>
  <div class="meta">生成时间：${escapeHtml(report.generatedAt)}</div>
  <section class="overview" data-section="review-overview">
    <div><span>项目</span><strong>${escapeHtml(report.projectName)}</strong></div>
    <div><span>时长</span><strong>${formatDuration(report.duration, fps)}</strong></div>
    <div><span>帧率</span><strong>${formatNumber(report.fps)} fps</strong></div>
    <div><span>批注数</span><strong>${report.annotations.length}</strong></div>
  </section>
  <h2>批注列表</h2>
  <table data-section="review-annotations">
    <thead>
      <tr><th>序号</th><th>截图</th><th>时间</th><th>类型</th><th>文字</th><th>位置</th></tr>
    </thead>
    <tbody>${renderAnnotationRows(report.annotations, fps)}</tbody>
  </table>
</body>
</html>`;
}

function renderAnnotationRows(rows: ReviewReportAnnotationRow[], fps: number): string {
  if (rows.length === 0) {
    return '<tr><td colspan="6" class="empty">无评审批注。</td></tr>';
  }
  return rows
    .map(
      (row) => `<tr data-review-annotation-id="${escapeHtml(row.id)}">
        <td>${row.index}</td>
        <td>${renderShotSvg(row)}</td>
        <td>${formatDuration(row.time, fps)}</td>
        <td>${escapeHtml(formatAnnotationType(row.type))}</td>
        <td>${escapeHtml(row.text)}</td>
        <td>x ${formatPercent(row.x)} / y ${formatPercent(row.y)} / w ${formatPercent(row.width)} / h ${formatPercent(row.height)}</td>
      </tr>`
    )
    .join('');
}

function renderShotSvg(row: ReviewReportAnnotationRow): string {
  const x = clamp(row.x) * 176;
  const y = clamp(row.y) * 99;
  const width = row.type === 'arrow' ? row.width * 176 : Math.max(4, Math.abs(row.width) * 176);
  const height = row.type === 'arrow' ? row.height * 99 : Math.max(4, Math.abs(row.height) * 99);
  const color = escapeHtml(row.color);
  if (row.type === 'arrow') {
    return `<svg class="shot" viewBox="0 0 176 99" role="img" aria-label="批注截图示意"><defs><marker id="arrow-${escapeHtml(row.id)}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="${color}" /></marker></defs><line x1="${formatSvgNumber(x)}" y1="${formatSvgNumber(y)}" x2="${formatSvgNumber(x + width)}" y2="${formatSvgNumber(y + height)}" stroke="${color}" stroke-width="3" marker-end="url(#arrow-${escapeHtml(row.id)})" /></svg>`;
  }
  if (row.type === 'text') {
    return `<svg class="shot" viewBox="0 0 176 99" role="img" aria-label="批注截图示意"><rect x="${formatSvgNumber(x)}" y="${formatSvgNumber(y)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" rx="3" fill="${color}" opacity="0.25" stroke="${color}" stroke-width="2" /><text x="${formatSvgNumber(x + 5)}" y="${formatSvgNumber(y + 16)}" fill="#fff" font-size="12">T</text></svg>`;
  }
  return `<svg class="shot" viewBox="0 0 176 99" role="img" aria-label="批注截图示意"><rect x="${formatSvgNumber(x)}" y="${formatSvgNumber(y)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" fill="${color}" opacity="0.16" stroke="${color}" stroke-width="3" /></svg>`;
}

function formatAnnotationType(type: ReviewAnnotation['type']): string {
  if (type === 'arrow') {
    return '箭头';
  }
  if (type === 'rectangle') {
    return '矩形';
  }
  return '文字';
}

function formatDuration(seconds: number, fps: number): string {
  return secondsToTimecode(Math.max(0, seconds), fps, 'ndf');
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatSvgNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
