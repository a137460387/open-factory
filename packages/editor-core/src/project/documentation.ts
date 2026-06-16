import { getTimelineDuration } from '../timeline';
import type { Project, ProjectDocumentation } from '../model-types';

export const PROJECT_DOCUMENTATION_SECTIONS = [
  { id: 'description', title: '项目说明' },
  { id: 'notes', title: '制作备注' },
  { id: 'copyright', title: '版权信息' },
  { id: 'approvals', title: '审批记录' }
] as const;

export type ProjectDocumentationSectionId = (typeof PROJECT_DOCUMENTATION_SECTIONS)[number]['id'];

export function normalizeProjectDocumentation(input: unknown): ProjectDocumentation {
  const output: ProjectDocumentation = {};
  if (!input || typeof input !== 'object') {
    return output;
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === 'string') {
      output[key] = value;
    }
  }
  return output;
}

export function renderSimpleMarkdown(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeLines: string[] | undefined;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length > 0) {
      html.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
      listItems = [];
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (codeLines) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = undefined;
      } else {
        flushParagraph();
        flushList();
        codeLines = [];
      }
      continue;
    }
    if (codeLines) {
      codeLines.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const list = /^[-*]\s+(.+)$/.exec(trimmed);
    if (list) {
      flushParagraph();
      listItems.push(list[1]);
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  if (codeLines) {
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  return html.join('\n');
}

export function buildProjectDocumentationHtml(project: Project): string {
  const duration = getTimelineDuration(project.timeline);
  const sections = PROJECT_DOCUMENTATION_SECTIONS.map((section) => {
    const markdown = project.documentation?.[section.id] ?? '';
    return `<section data-section="${section.id}"><h2>${escapeHtml(section.title)}</h2>${renderSimpleMarkdown(markdown) || '<p class="empty">无内容。</p>'}</section>`;
  }).join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(project.name)} - 项目文档</title>
  <style>
    body { font-family: Arial, "Microsoft YaHei", sans-serif; margin: 32px; color: #172033; line-height: 1.55; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .meta { margin-bottom: 24px; color: #64748b; font-size: 13px; }
    section { border-top: 1px solid #d9dee8; padding: 18px 0; }
    h2 { font-size: 18px; margin: 0 0 10px; }
    h3 { font-size: 15px; }
    pre { background: #f5f7fb; padding: 12px; overflow: auto; }
    code { font-family: Consolas, monospace; }
    .empty { color: #94a3b8; }
  </style>
</head>
<body>
  <h1>${escapeHtml(project.name)}</h1>
  <div class="meta">时长：${duration.toFixed(2)}s · 更新时间：${escapeHtml(project.updatedAt)}</div>
  ${sections}
</body>
</html>`;
}

function renderInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
