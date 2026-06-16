import { normalizeCollaborationNotes, type CollaborationNote, type CollaborationNoteType, type Project } from './model';
import { getTimelineDuration } from './timeline';
import { formatReportDuration, normalizeReportLocale, reportHtmlLang, reportLanguageLabel, type ReportLocale } from './project/report-i18n';

export interface CollaborationReportOptions {
  generatedAt?: string;
  locale?: ReportLocale;
}

export interface CollaborationReportRow {
  index: number;
  id: string;
  type: CollaborationNoteType;
  authorName: string;
  authorColor: string;
  start: number;
  end?: number;
  text: string;
  mediaPath?: string;
  resolved: boolean;
}

export interface CollaborationReport {
  projectName: string;
  duration: number;
  generatedAt: string;
  locale: ReportLocale;
  notes: CollaborationReportRow[];
}

const labels: Record<ReportLocale, Record<string, string>> = {
  zh: {
    title: '协同标注报告',
    generatedAt: '生成时间',
    language: '语言',
    project: '项目',
    duration: '时长',
    noteCount: '标注数',
    list: '标注列表',
    index: '序号',
    shot: '截图',
    author: '标注者',
    time: '时间',
    type: '类型',
    content: '内容',
    status: '状态',
    resolved: '已解决',
    open: '未解决',
    comment: '时间点评论',
    highlight: '时间段高亮',
    replacement: '建议替换',
    empty: '无协同标注。'
  },
  en: {
    title: 'Collaboration Notes Report',
    generatedAt: 'Generated At',
    language: 'Language',
    project: 'Project',
    duration: 'Duration',
    noteCount: 'Notes',
    list: 'Notes',
    index: '#',
    shot: 'Shot',
    author: 'Author',
    time: 'Time',
    type: 'Type',
    content: 'Content',
    status: 'Status',
    resolved: 'Resolved',
    open: 'Open',
    comment: 'Point Comment',
    highlight: 'Range Highlight',
    replacement: 'Replacement Suggestion',
    empty: 'No collaboration notes.'
  }
};

export function sortCollaborationNotes(notes: readonly CollaborationNote[]): CollaborationNote[] {
  return normalizeCollaborationNotes([...notes]);
}

export function filterCollaborationNotesByAuthor(notes: readonly CollaborationNote[], authorName?: string): CollaborationNote[] {
  const normalized = sortCollaborationNotes(notes);
  const filter = authorName?.trim().toLocaleLowerCase();
  if (!filter) {
    return normalized;
  }
  return normalized.filter((note) => note.authorName.toLocaleLowerCase() === filter);
}

export function toggleCollaborationNoteResolved(notes: readonly CollaborationNote[], noteId: string, resolved?: boolean, updatedAt = new Date().toISOString()): CollaborationNote[] {
  return sortCollaborationNotes(
    notes.map((note) => {
      if (note.id !== noteId) {
        return note;
      }
      return {
        ...note,
        resolved: resolved ?? !note.resolved,
        updatedAt
      };
    })
  );
}

export function buildCollaborationReport(project: Project, options: CollaborationReportOptions = {}): CollaborationReport {
  const locale = normalizeReportLocale(options.locale);
  return {
    projectName: project.name,
    duration: getTimelineDuration(project.timeline),
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    locale,
    notes: sortCollaborationNotes(project.collaborationNotes ?? []).map((note, index) => ({
      index: index + 1,
      id: note.id,
      type: note.type,
      authorName: note.authorName,
      authorColor: note.authorColor,
      start: note.start,
      end: note.end,
      text: note.text,
      mediaPath: note.mediaPath,
      resolved: note.resolved
    }))
  };
}

export function buildCollaborationReportHtml(project: Project, options: CollaborationReportOptions = {}): string {
  return renderCollaborationReportHtml(buildCollaborationReport(project, options));
}

export function renderCollaborationReportHtml(report: CollaborationReport): string {
  const t = labels[report.locale];
  return `<!doctype html>
<html lang="${reportHtmlLang(report.locale)}">
<head>
  <meta charset="utf-8" />
  <title>${t.title} - ${escapeHtml(report.projectName)}</title>
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
    .shot { width: 176px; height: 99px; background: #101827; color: #cbd5e1; border-radius: 4px; display: grid; place-items: center; font-size: 12px; }
    .author { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; }
    .empty { color: #64748b; }
  </style>
</head>
<body>
  <h1>${t.title}：${escapeHtml(report.projectName)}</h1>
  <div class="meta">${t.generatedAt}：${escapeHtml(report.generatedAt)} · ${t.language}：${reportLanguageLabel(report.locale)}</div>
  <section class="overview" data-section="collaboration-overview">
    <div><span>${t.project}</span><strong>${escapeHtml(report.projectName)}</strong></div>
    <div><span>${t.duration}</span><strong>${formatReportDuration(report.duration, report.locale)}</strong></div>
    <div><span>${t.noteCount}</span><strong>${report.notes.length}</strong></div>
  </section>
  <h2>${t.list}</h2>
  <table data-section="collaboration-notes">
    <thead>
      <tr><th>${t.index}</th><th>${t.shot}</th><th>${t.author}</th><th>${t.time}</th><th>${t.type}</th><th>${t.content}</th><th>${t.status}</th></tr>
    </thead>
    <tbody>${renderRows(report.notes, report.locale)}</tbody>
  </table>
</body>
</html>`;
}

function renderRows(rows: CollaborationReportRow[], locale: ReportLocale): string {
  const t = labels[locale];
  if (rows.length === 0) {
    return `<tr><td colspan="7" class="empty">${t.empty}</td></tr>`;
  }
  return rows
    .map((row) => {
      const typeLabel = t[row.type] ?? row.type;
      const time = row.end !== undefined && row.end > row.start ? `${formatReportDuration(row.start, locale)} - ${formatReportDuration(row.end, locale)}` : formatReportDuration(row.start, locale);
      const content = row.mediaPath ? `${escapeHtml(row.text)}<br /><small>${escapeHtml(row.mediaPath)}</small>` : escapeHtml(row.text);
      return `<tr data-note-id="${escapeHtml(row.id)}">
        <td>${row.index}</td>
        <td><div class="shot">${escapeHtml(formatReportDuration(row.start, locale))}</div></td>
        <td><span class="author"><span class="dot" style="background:${escapeHtml(row.authorColor)}"></span>${escapeHtml(row.authorName)}</span></td>
        <td>${escapeHtml(time)}</td>
        <td>${escapeHtml(typeLabel)}</td>
        <td>${content}</td>
        <td>${row.resolved ? t.resolved : t.open}</td>
      </tr>`;
    })
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
