import { useState, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import {
  DEFAULT_MEDIA_RENAME_TEMPLATE,
  buildMediaRenamePreview,
  type BatchEditableMediaMetadata,
  type MediaAsset,
  type MediaRenamePreviewItem,
  type MediaRenameRules,
} from '@open-factory/editor-core';

export function BatchTextField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  testId: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
      {label}
      <input
        className="rounded-lg border border-line px-2 py-1.5 text-sm font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function buildBatchMetadataPatch(fields: Record<keyof BatchEditableMediaMetadata, string>): BatchEditableMediaMetadata {
  const metadata: BatchEditableMediaMetadata = {};
  if (fields.title.trim()) {
    metadata.title = fields.title.trim();
  }
  if (fields.author.trim()) {
    metadata.author = fields.author.trim();
  }
  if (fields.description.trim()) {
    metadata.description = fields.description.trim();
  }
  if (fields.copyright.trim()) {
    metadata.copyright = fields.copyright.trim();
  }
  if (fields.date.trim()) {
    metadata.date = fields.date.trim();
  }
  return metadata;
}

function formatBatchRenameDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function BatchMetadataDialog({
  assets,
  onClose,
  onSubmit,
}: {
  assets: MediaAsset[];
  onClose(): void;
  onSubmit(metadata: BatchEditableMediaMetadata): void;
}) {
  const t = zhCN.mediaBin.batchMetadataDialog;
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [copyright, setCopyright] = useState('');
  const [date, setDate] = useState('');
  const metadata = buildBatchMetadataPatch({ title, author, description, copyright, date });
  const canSubmit = Object.keys(metadata).length > 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-metadata-title"
      data-testid="batch-metadata-dialog"
    >
      <form
        className="w-full max-w-lg rounded-md border border-line bg-[var(--color-bg-elevated)] p-4 shadow-soft"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) {
            onSubmit(metadata);
          }
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink" id="batch-metadata-title">
              {t.title}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t.summary(assets.length)}</p>
          </div>
          <button
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-panel"
            type="button"
            aria-label={zhCN.common.close}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-3">
          <BatchTextField
            label={t.fields.title}
            value={title}
            onChange={setTitle}
            testId="batch-metadata-title-input"
          />
          <BatchTextField
            label={t.fields.author}
            value={author}
            onChange={setAuthor}
            testId="batch-metadata-author-input"
          />
          <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
            {t.fields.description}
            <textarea
              className="min-h-20 rounded-lg border border-line px-2 py-1.5 text-sm font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              value={description}
              data-testid="batch-metadata-description-input"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BatchTextField
              label={t.fields.copyright}
              value={copyright}
              onChange={setCopyright}
              testId="batch-metadata-copyright-input"
            />
            <BatchTextField label={t.fields.date} value={date} onChange={setDate} testId="batch-metadata-date-input" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            onClick={onClose}
          >
            {zhCN.common.cancel}
          </button>
          <button
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            type="submit"
            disabled={!canSubmit}
            data-testid="batch-metadata-confirm-button"
          >
            {t.apply}
          </button>
        </div>
      </form>
    </div>
  );
}

export function BatchRenameDialog({
  assets,
  allAssets,
  onClose,
  onConfirm,
}: {
  assets: MediaAsset[];
  allAssets: MediaAsset[];
  onClose(): void;
  onConfirm(preview: MediaRenamePreviewItem[], renameFiles: boolean): void;
}) {
  const t = zhCN.mediaBin.batchRenameDialog;
  const [template, setTemplate] = useState(DEFAULT_MEDIA_RENAME_TEMPLATE);
  const [sequencePrefix, setSequencePrefix] = useState(false);
  const [datePrefix, setDatePrefix] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseTransform, setCaseTransform] = useState<MediaRenameRules['caseTransform']>('none');
  const [removeSpecialCharacters, setRemoveSpecialCharacters] = useState(false);
  const [startIndex, setStartIndex] = useState(1);
  const [date, setDate] = useState(formatBatchRenameDate(new Date()));
  const [renameFiles, setRenameFiles] = useState(false);
  const templateRef = useRef<HTMLInputElement>(null);
  const rules = useMemo<MediaRenameRules>(
    () => ({
      template,
      sequencePrefix,
      datePrefix,
      find: findText.trim() || undefined,
      replace: replaceText,
      caseTransform,
      removeSpecialCharacters,
      startIndex,
      date,
    }),
    [
      caseTransform,
      date,
      datePrefix,
      findText,
      removeSpecialCharacters,
      replaceText,
      sequencePrefix,
      startIndex,
      template,
    ],
  );
  const preview = useMemo(() => buildMediaRenamePreview(assets, allAssets, rules), [assets, allAssets, rules]);
  const hasChanges = preview.some((item) => item.changed);
  const insertTemplateToken = (token: string) => {
    const input = templateRef.current;
    const start = input?.selectionStart ?? template.length;
    const end = input?.selectionEnd ?? template.length;
    const next = `${template.slice(0, start)}${token}${template.slice(end)}`;
    setTemplate(next);
    requestAnimationFrame(() => {
      templateRef.current?.focus();
      templateRef.current?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-rename-title"
      data-testid="batch-rename-dialog"
    >
      <form
        className="grid max-h-[88vh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] rounded-md border border-line bg-[var(--color-bg-elevated)] shadow-soft"
        onSubmit={(event) => {
          event.preventDefault();
          if (hasChanges) {
            onConfirm(preview, renameFiles);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div>
            <h2 className="text-base font-semibold text-ink" id="batch-rename-title">
              {t.title}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t.summary(assets.length)}</p>
          </div>
          <button
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-panel"
            type="button"
            aria-label={zhCN.common.close}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)]">
            <div className="space-y-3">
              <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                {t.template}
                <input
                  ref={templateRef}
                  className="rounded-lg border border-line px-2 py-1.5 text-sm font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                  value={template}
                  list="media-rename-template-variables"
                  data-testid="batch-rename-template-input"
                  onChange={(event) => setTemplate(event.target.value)}
                />
              </label>
              <datalist id="media-rename-template-variables">
                {t.variableTokens.map((token) => (
                  <option key={token} value={token} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-1" aria-label={t.variableHint}>
                {t.variableTokens.map((token) => (
                  <button
                    key={token}
                    className="rounded border border-line bg-panel px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                    type="button"
                    onClick={() => insertTemplateToken(token)}
                  >
                    {token}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                  {t.startIndex}
                  <input
                    className="rounded-lg border border-line px-2 py-1.5 text-sm font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                    type="number"
                    min={1}
                    value={startIndex}
                    onChange={(event) => setStartIndex(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <BatchTextField label={t.date} value={date} onChange={setDate} testId="batch-rename-date-input" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BatchTextField
                  label={t.find}
                  value={findText}
                  onChange={setFindText}
                  testId="batch-rename-find-input"
                />
                <BatchTextField
                  label={t.replace}
                  value={replaceText}
                  onChange={setReplaceText}
                  testId="batch-rename-replace-input"
                />
              </div>
              <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                {t.caseTransform}
                <select
                  className="rounded-lg border border-line px-2 py-1.5 text-sm font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                  value={caseTransform}
                  onChange={(event) => setCaseTransform(event.target.value as MediaRenameRules['caseTransform'])}
                >
                  <option value="none">{t.caseOptions.none}</option>
                  <option value="lower">{t.caseOptions.lower}</option>
                  <option value="upper">{t.caseOptions.upper}</option>
                  <option value="title">{t.caseOptions.title}</option>
                </select>
              </label>
              <div className="grid gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                <label className="inline-flex items-center gap-2">
                  <input
                    className="h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={sequencePrefix}
                    onChange={(event) => setSequencePrefix(event.target.checked)}
                  />
                  {t.sequencePrefix}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    className="h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={datePrefix}
                    onChange={(event) => setDatePrefix(event.target.checked)}
                  />
                  {t.datePrefix}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    className="h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={removeSpecialCharacters}
                    onChange={(event) => setRemoveSpecialCharacters(event.target.checked)}
                  />
                  {t.removeSpecialCharacters}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    className="h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={renameFiles}
                    data-testid="batch-rename-files-checkbox"
                    onChange={(event) => setRenameFiles(event.target.checked)}
                  />
                  {t.renameFiles}
                </label>
              </div>
            </div>
            <div className="min-h-0 rounded-md border border-line bg-panel">
              <div className="border-b border-line px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                {t.preview}
              </div>
              <div className="max-h-[420px] overflow-y-auto p-2">
                {preview.map((item) => (
                  <div
                    key={item.assetId}
                    className="mb-2 rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 text-xs last:mb-0"
                    data-testid="batch-rename-preview-row"
                    data-next-name={item.nextName}
                  >
                    <div className="truncate text-[var(--color-text-muted)]" title={item.originalName}>
                      {item.originalName}
                    </div>
                    <div className="mt-1 truncate font-semibold text-ink" title={item.nextName}>
                      {item.nextName}
                    </div>
                    {item.conflictSuffix ? (
                      <div className="mt-1 text-[11px] text-amber-700">{t.conflictSuffix(item.conflictSuffix)}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line p-4">
          <button
            className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            onClick={onClose}
          >
            {zhCN.common.cancel}
          </button>
          <button
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            type="submit"
            disabled={!hasChanges}
            data-testid="batch-rename-confirm-button"
          >
            {t.confirm}
          </button>
        </div>
      </form>
    </div>
  );
}
