import type { Project, ReviewAnnotation } from '../model';
import { getTimelineDuration } from '../timeline';
import {
  formatReportDuration,
  formatReportNumber,
  normalizeReportLocale,
  reportHtmlLang,
  reportLanguageLabel,
  type ReportLocale,
} from './report-i18n';

export interface ReviewReportOptions {
  generatedAt?: string;
  locale?: ReportLocale;
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
  locale: ReportLocale;
  annotations: ReviewReportAnnotationRow[];
}

const reviewReportLabels: Record<ReportLocale, Record<string, string>> = {
  zh: {
    title: '评审报告',
    generatedAt: '生成时间',
    language: '语言',
    project: '项目',
    duration: '时长',
    fps: '帧率',
    annotationCount: '批注数',
    annotationList: '批注列表',
    index: '序号',
    shot: '截图',
    time: '时间',
    type: '类型',
    text: '文字',
    position: '位置',
    empty: '无评审批注。',
    shotAria: '批注截图示意',
    arrow: '箭头',
    rectangle: '矩形',
    textType: '文字',
  },
  en: {
    title: 'Review Report',
    generatedAt: 'Generated At',
    language: 'Language',
    project: 'Project',
    duration: 'Duration',
    fps: 'Frame Rate',
    annotationCount: 'Annotations',
    annotationList: 'Annotation List',
    index: '#',
    shot: 'Shot',
    time: 'Time',
    type: 'Type',
    text: 'Text',
    position: 'Position',
    empty: 'No review annotations.',
    shotAria: 'Review annotation preview',
    arrow: 'Arrow',
    rectangle: 'Rectangle',
    textType: 'Text',
  },
};

export function buildReviewReport(project: Project, options: ReviewReportOptions = {}): ReviewReport {
  const fps = project.settings.fps || 30;
  const locale = normalizeReportLocale(options.locale);
  return {
    projectName: project.name,
    duration: getTimelineDuration(project.timeline),
    fps,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    locale,
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
        height: annotation.height,
      })),
  };
}

export function buildReviewReportHtml(project: Project, options: ReviewReportOptions = {}): string {
  return renderReviewReportHtml(buildReviewReport(project, options));
}

export function renderReviewReportHtml(report: ReviewReport): string {
  const labels = reviewReportLabels[report.locale];
  return `<!doctype html>
<html lang="${reportHtmlLang(report.locale)}">
<head>
  <meta charset="utf-8" />
  <title>${labels.title} - ${escapeHtml(report.projectName)}</title>
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
  <h1>${labels.title}：${escapeHtml(report.projectName)}</h1>
  <div class="meta">${labels.generatedAt}：${escapeHtml(report.generatedAt)} · ${labels.language}：${reportLanguageLabel(report.locale)}</div>
  <section class="overview" data-section="review-overview">
    <div><span>${labels.project}</span><strong>${escapeHtml(report.projectName)}</strong></div>
    <div><span>${labels.duration}</span><strong>${formatReportDuration(report.duration, report.locale)}</strong></div>
    <div><span>${labels.fps}</span><strong>${formatReportNumber(report.fps)} fps</strong></div>
    <div><span>${labels.annotationCount}</span><strong>${report.annotations.length}</strong></div>
  </section>
  <h2>${labels.annotationList}</h2>
  <table data-section="review-annotations">
    <thead>
      <tr><th>${labels.index}</th><th>${labels.shot}</th><th>${labels.time}</th><th>${labels.type}</th><th>${labels.text}</th><th>${labels.position}</th></tr>
    </thead>
    <tbody>${renderAnnotationRows(report.annotations, report.locale)}</tbody>
  </table>
</body>
</html>`;
}

function renderAnnotationRows(rows: ReviewReportAnnotationRow[], locale: ReportLocale): string {
  const labels = reviewReportLabels[locale];
  if (rows.length === 0) {
    return `<tr><td colspan="6" class="empty">${labels.empty}</td></tr>`;
  }
  return rows
    .map(
      (row) => `<tr data-review-annotation-id="${escapeHtml(row.id)}">
        <td>${row.index}</td>
        <td>${renderShotSvg(row, locale)}</td>
        <td>${formatReportDuration(row.time, locale)}</td>
        <td>${escapeHtml(formatAnnotationType(row.type, locale))}</td>
        <td>${escapeHtml(row.text)}</td>
        <td>x ${formatPercent(row.x)} / y ${formatPercent(row.y)} / w ${formatPercent(row.width)} / h ${formatPercent(row.height)}</td>
      </tr>`,
    )
    .join('');
}

function renderShotSvg(row: ReviewReportAnnotationRow, locale: ReportLocale): string {
  const labels = reviewReportLabels[locale];
  const x = clamp(row.x) * 176;
  const y = clamp(row.y) * 99;
  const width = row.type === 'arrow' ? row.width * 176 : Math.max(4, Math.abs(row.width) * 176);
  const height = row.type === 'arrow' ? row.height * 99 : Math.max(4, Math.abs(row.height) * 99);
  const color = escapeHtml(row.color);
  if (row.type === 'arrow') {
    return `<svg class="shot" viewBox="0 0 176 99" role="img" aria-label="${labels.shotAria}"><defs><marker id="arrow-${escapeHtml(row.id)}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="${color}" /></marker></defs><line x1="${formatSvgNumber(x)}" y1="${formatSvgNumber(y)}" x2="${formatSvgNumber(x + width)}" y2="${formatSvgNumber(y + height)}" stroke="${color}" stroke-width="3" marker-end="url(#arrow-${escapeHtml(row.id)})" /></svg>`;
  }
  if (row.type === 'text') {
    return `<svg class="shot" viewBox="0 0 176 99" role="img" aria-label="${labels.shotAria}"><rect x="${formatSvgNumber(x)}" y="${formatSvgNumber(y)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" rx="3" fill="${color}" opacity="0.25" stroke="${color}" stroke-width="2" /><text x="${formatSvgNumber(x + 5)}" y="${formatSvgNumber(y + 16)}" fill="#fff" font-size="12">T</text></svg>`;
  }
  return `<svg class="shot" viewBox="0 0 176 99" role="img" aria-label="${labels.shotAria}"><rect x="${formatSvgNumber(x)}" y="${formatSvgNumber(y)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" fill="${color}" opacity="0.16" stroke="${color}" stroke-width="3" /></svg>`;
}

function formatAnnotationType(type: ReviewAnnotation['type'], locale: ReportLocale): string {
  const labels = reviewReportLabels[locale];
  if (type === 'arrow') {
    return labels.arrow;
  }
  if (type === 'rectangle') {
    return labels.rectangle;
  }
  return labels.textType;
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
