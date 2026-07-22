import { useRef } from 'react';
import DOMPurify from 'dompurify';
import type { Clip, RichTextDocument, RichTextRun } from '@open-factory/editor-core';
import { normalizeRichTextDocument } from '@open-factory/editor-core';
import { Bold, Italic, Underline } from 'lucide-react';
import { zhCN } from '../../i18n/strings';

export function RichTextEditor({
  clip,
  disabled,
  onCommit,
}: {
  clip: Extract<Clip, { type: 'text' }>;
  disabled?: boolean;
  onCommit(richText: RichTextDocument): void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const commitFromDom = () => {
    const element = editorRef.current;
    if (!element || disabled) {
      return;
    }
    const richText = parseRichTextFromElement(element, clip.text);
    onCommit(richText);
  };
  const applyInlineCommand = (command: 'bold' | 'italic' | 'underline') => {
    if (disabled) {
      return;
    }
    document.execCommand(command);
    commitFromDom();
  };
  const applyColor = (color: string) => {
    if (disabled) {
      return;
    }
    document.execCommand('foreColor', false, color);
    commitFromDom();
  };
  const applyFontSize = (fontSize: number) => {
    if (disabled) {
      return;
    }
    document.execCommand('fontSize', false, '4');
    const selection = document.getSelection();
    const anchor = selection?.anchorNode?.parentElement;
    if (anchor?.tagName === 'FONT') {
      anchor.removeAttribute('size');
      anchor.style.fontSize = `${fontSize}px`;
    }
    commitFromDom();
  };
  return (
    <div className="space-y-2" data-testid="rich-text-editor">
      <div className="flex flex-wrap items-center gap-1">
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel disabled:opacity-40"
          type="button"
          title={zhCN.inspector.richText.bold}
          aria-label={zhCN.inspector.richText.bold}
          disabled={disabled}
          data-testid="rich-text-bold-button"
          onMouseDown={(event) => {
            event.preventDefault();
            applyInlineCommand('bold');
          }}
        >
          <Bold size={15} />
        </button>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel disabled:opacity-40"
          type="button"
          title={zhCN.inspector.richText.italic}
          aria-label={zhCN.inspector.richText.italic}
          disabled={disabled}
          data-testid="rich-text-italic-button"
          onMouseDown={(event) => {
            event.preventDefault();
            applyInlineCommand('italic');
          }}
        >
          <Italic size={15} />
        </button>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel disabled:opacity-40"
          type="button"
          title={zhCN.inspector.richText.underline}
          aria-label={zhCN.inspector.richText.underline}
          disabled={disabled}
          data-testid="rich-text-underline-button"
          onMouseDown={(event) => {
            event.preventDefault();
            applyInlineCommand('underline');
          }}
        >
          <Underline size={15} />
        </button>
        <input
          className="h-8 w-10 rounded-lg border border-line bg-[var(--color-bg-elevated)] p-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:opacity-40"
          type="color"
          defaultValue={clip.style.color}
          title={zhCN.inspector.richText.color}
          aria-label={zhCN.inspector.richText.color}
          disabled={disabled}
          data-testid="rich-text-color-input"
          onChange={(event) => applyColor(event.target.value)}
        />
        <select
          className="h-8 rounded-lg border border-line bg-[var(--color-bg-elevated)] px-1 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:opacity-40"
          defaultValue=""
          title={zhCN.inspector.richText.fontSize}
          aria-label={zhCN.inspector.richText.fontSize}
          disabled={disabled}
          data-testid="rich-text-font-size-select"
          onChange={(event) => {
            const size = Number(event.target.value);
            if (Number.isFinite(size) && size > 0) {
              applyFontSize(size);
            }
            event.target.value = '';
          }}
        >
          <option value="" disabled>
            {zhCN.inspector.richText.fontSize}
          </option>
          {[12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64].map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>
      </div>
      <div
        ref={editorRef}
        className="min-h-[4rem] rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-testid="rich-text-editor-content"
        onBlur={commitFromDom}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(richTextToHtml(clip.richText ?? { paragraphs: [{ runs: [{ text: clip.text }] }] })) }}
      />
    </div>
  );
}

export function parseRichTextFromElement(element: HTMLElement, fallbackText: string): RichTextDocument {
  const blockNodes = Array.from(element.childNodes).filter((node) => isParagraphNode(node));
  const paragraphs = (blockNodes.length > 0 ? blockNodes : [element]).map((node) => {
    const runs = collectRichTextRuns(node, {});
    return { runs: runs.length > 0 ? runs : [{ text: '' }] };
  });
  return normalizeRichTextDocument({ paragraphs }, fallbackText);
}

export function collectRichTextRuns(node: Node, inherited: Omit<RichTextRun, 'text'>): RichTextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    return text ? [{ text, ...inherited }] : [];
  }
  if (!(node instanceof HTMLElement)) {
    return Array.from(node.childNodes).flatMap((child) => collectRichTextRuns(child, inherited));
  }
  const next: Omit<RichTextRun, 'text'> = { ...inherited };
  const tag = node.tagName.toLowerCase();
  if (tag === 'b' || tag === 'strong' || Number.parseInt(node.style.fontWeight, 10) >= 600) {
    next.bold = true;
  }
  if (tag === 'i' || tag === 'em' || node.style.fontStyle === 'italic') {
    next.italic = true;
  }
  if (
    tag === 'u' ||
    node.style.textDecorationLine.includes('underline') ||
    node.style.textDecoration.includes('underline')
  ) {
    next.underline = true;
  }
  const color = normalizeCssColorForModel(node.style.color);
  if (color) {
    next.color = color;
  }
  const fontSize = Number.parseFloat(node.style.fontSize);
  if (Number.isFinite(fontSize)) {
    next.fontSize = fontSize;
  }
  if (tag === 'br') {
    return [];
  }
  return Array.from(node.childNodes).flatMap((child) => collectRichTextRuns(child, next));
}

export function richTextToHtml(document: RichTextDocument): string {
  return document.paragraphs
    .map((paragraph) => `<div>${paragraph.runs.map((run) => richTextRunToHtml(run)).join('') || '<br>'}</div>`)
    .join('');
}

export function richTextRunToHtml(run: RichTextRun): string {
  const styles = [
    run.color ? `color:${escapeHtmlAttribute(run.color)}` : '',
    run.fontSize ? `font-size:${run.fontSize}px` : '',
    run.underline ? 'text-decoration:underline' : '',
  ].filter(Boolean);
  let html = `<span${styles.length > 0 ? ` style="${styles.join(';')}"` : ''}>${escapeHtml(run.text)}</span>`;
  if (run.bold) {
    html = `<strong>${html}</strong>`;
  }
  if (run.italic) {
    html = `<em>${html}</em>`;
  }
  return html;
}

export function isParagraphNode(node: Node): boolean {
  return node instanceof HTMLElement && ['div', 'p'].includes(node.tagName.toLowerCase());
}

export function normalizeCssColorForModel(color: string): string | undefined {
  const value = color.trim();
  if (!value) {
    return undefined;
  }
  const rgb = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) {
    return `#${[rgb[1], rgb[2], rgb[3]].map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
  }
  return value;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
