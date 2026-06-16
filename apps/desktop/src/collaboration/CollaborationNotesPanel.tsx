import { CheckCircle2, Download, MessageSquareText, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  AddCollaborationNoteCommand,
  UpdateCollaborationNoteCommand,
  buildCollaborationReportHtml,
  filterCollaborationNotesByAuthor,
  secondsToTimecode,
  type CollaborationNote,
  type CollaborationNoteType,
  type Project
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { saveFileDialog, writeFile } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { commandManager, projectAccessor } from '../store/commandManager';
import { readCollaborationIdentitySettings, type CollaborationIdentitySettings } from '../settings/appSettings';

interface CollaborationNotesPanelProps {
  project: Project;
  playheadTime: number;
  onClose(): void;
}

const NOTE_TYPES: CollaborationNoteType[] = ['comment', 'highlight', 'replacement'];

export default function CollaborationNotesPanel({ project, playheadTime, onClose }: CollaborationNotesPanelProps) {
  const t = zhCN.collaboration;
  const [identity, setIdentity] = useState<CollaborationIdentitySettings>({ name: '我', color: '#38bdf8' });
  const [type, setType] = useState<CollaborationNoteType>('comment');
  const [text, setText] = useState('');
  const [mediaPath, setMediaPath] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const authors = useMemo(() => Array.from(new Set((project.collaborationNotes ?? []).map((note) => note.authorName))).sort((left, right) => left.localeCompare(right)), [project.collaborationNotes]);
  const notes = useMemo(() => filterCollaborationNotesByAuthor(project.collaborationNotes ?? [], authorFilter), [authorFilter, project.collaborationNotes]);

  useEffect(() => {
    let canceled = false;
    void readCollaborationIdentitySettings()
      .then((settings) => {
        if (!canceled) {
          setIdentity(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load collaboration identity', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  function addNote(): void {
    const trimmed = text.trim();
    if (!trimmed) {
      showToast({ kind: 'warning', title: t.addFailedTitle, message: t.emptyText });
      return;
    }
    const start = Math.max(0, playheadTime);
    const end = type === 'comment' ? undefined : start + 2;
    try {
      commandManager.execute(
        new AddCollaborationNoteCommand(projectAccessor, {
          type,
          authorName: identity.name,
          authorColor: identity.color,
          start,
          ...(end !== undefined ? { end } : {}),
          text: trimmed,
          ...(type === 'replacement' && mediaPath.trim() ? { mediaPath: mediaPath.trim() } : {}),
          resolved: false
        })
      );
      setText('');
      setMediaPath('');
      showToast({ kind: 'success', title: t.addedTitle, message: trimmed });
    } catch (error) {
      showToast({ kind: 'warning', title: t.addFailedTitle, message: error instanceof Error ? error.message : t.addFailedMessage });
    }
  }

  function toggleResolved(note: CollaborationNote): void {
    try {
      commandManager.execute(new UpdateCollaborationNoteCommand(projectAccessor, note.id, { resolved: !note.resolved }));
    } catch (error) {
      showToast({ kind: 'warning', title: t.updateFailedTitle, message: error instanceof Error ? error.message : t.updateFailedMessage });
    }
  }

  async function exportReport(): Promise<void> {
    try {
      const path = await saveFileDialog(`${project.name}-collaboration-notes.html`, [{ name: t.reportFilter, extensions: ['html'] }]);
      if (!path) {
        return;
      }
      await writeFile(path, buildCollaborationReportHtml(project, { locale: 'zh' }));
      showToast({ kind: 'success', title: t.exportedTitle, message: path });
    } catch (error) {
      showToast({ kind: 'warning', title: t.exportFailedTitle, message: error instanceof Error ? error.message : t.exportFailedMessage });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="collaboration-notes-panel">
      <section className="grid max-h-[88vh] w-full max-w-4xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <MessageSquareText size={18} className="text-slate-500" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
              <p className="text-xs text-slate-500" data-testid="collaboration-identity-summary">
                {identity.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-panel"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="collaboration-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        <div className="grid gap-3 border-b border-line bg-panel px-4 py-3 sm:grid-cols-[140px_minmax(0,1fr)_140px]">
          <label className="text-xs font-medium text-slate-600">
            {t.type}
            <select className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm text-ink" value={type} data-testid="collaboration-type-select" onChange={(event) => setType(event.target.value as CollaborationNoteType)}>
              {NOTE_TYPES.map((item) => (
                <option key={item} value={item}>
                  {t.types[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            {t.content}
            <input
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm text-ink"
              value={text}
              placeholder={t.contentPlaceholder}
              data-testid="collaboration-note-input"
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="mt-5 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-medium text-white"
            data-testid="collaboration-add-note-button"
            onClick={addNote}
          >
            <Plus size={15} />
            {t.add}
          </button>
          {type === 'replacement' ? (
            <label className="text-xs font-medium text-slate-600 sm:col-span-3">
              {t.mediaPath}
              <input
                className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm text-ink"
                value={mediaPath}
                placeholder="C:/Media/alt-take.mp4"
                data-testid="collaboration-media-path-input"
                onChange={(event) => setMediaPath(event.target.value)}
              />
            </label>
          ) : null}
        </div>

        <div className="min-h-0 overflow-auto p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-medium text-slate-600">
              {t.authorFilter}
              <select className="ml-2 h-8 rounded-md border border-line bg-white px-2 text-xs text-ink" value={authorFilter} data-testid="collaboration-author-filter" onChange={(event) => setAuthorFilter(event.target.value)}>
                <option value="">{t.allAuthors}</option>
                {authors.map((author) => (
                  <option key={author} value={author}>
                    {author}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-slate-500" data-testid="collaboration-note-count">
              {t.count(notes.length)}
            </span>
          </div>
          {notes.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-line bg-panel text-sm text-slate-500" data-testid="collaboration-empty">
              {t.empty}
            </div>
          ) : (
            <div className="space-y-2" data-testid="collaboration-note-list">
              {notes.map((note) => (
                <article key={note.id} className="rounded-md border border-line bg-white p-3 shadow-sm" data-testid="collaboration-note-card" data-note-id={note.id} data-resolved={note.resolved ? 'true' : 'false'}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: note.authorColor }} />
                          {note.authorName}
                        </span>
                        <span>{t.types[note.type]}</span>
                        <span className="tabular-nums">{formatNoteTime(note, project)}</span>
                      </div>
                      <p className="mt-1 text-sm text-ink">{note.text}</p>
                      {note.mediaPath ? <p className="mt-1 truncate text-xs text-slate-500">{note.mediaPath}</p> : null}
                    </div>
                    <button
                      type="button"
                      className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium ${note.resolved ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-line text-slate-600 hover:bg-panel'}`}
                      data-testid="collaboration-resolve-button"
                      onClick={() => toggleResolved(note)}
                    >
                      <CheckCircle2 size={14} />
                      {note.resolved ? t.resolved : t.markResolved}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm text-slate-700 hover:bg-panel"
            data-testid="collaboration-export-report-button"
            onClick={() => void exportReport()}
          >
            <Download size={15} />
            {t.exportReport}
          </button>
        </footer>
      </section>
    </div>
  );
}

function formatNoteTime(note: CollaborationNote, project: Project): string {
  const fps = project.settings.fps || 30;
  const format = project.settings.timecodeFormat ?? 'ndf';
  const start = secondsToTimecode(note.start, fps, format);
  if (note.end !== undefined && note.end > note.start) {
    return `${start} - ${secondsToTimecode(note.end, fps, format)}`;
  }
  return start;
}
