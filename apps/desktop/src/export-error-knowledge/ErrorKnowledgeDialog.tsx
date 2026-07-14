import { useState } from 'react';
import { X, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import type { ErrorKnowledgeMatch, ErrorKnowledgeStore, ErrorFeedbackRecord } from '@open-factory/editor-core';
import {
  getTopMatches,
  buildFeedbackMap,
  addFeedback,
  createDefaultKnowledgeStore,
  mergeKnowledgeUpdate,
} from '@open-factory/editor-core';

interface ErrorKnowledgeDialogProps {
  stderr: string;
  onClose(): void;
}

export function ErrorKnowledgeDialog({ stderr, onClose }: ErrorKnowledgeDialogProps) {
  const t = zhCN.errorKnowledge;
  const [store, setStore] = useState<ErrorKnowledgeStore>(() => createDefaultKnowledgeStore());
  const feedbackMap = buildFeedbackMap(store.feedback);
  const matches = getTopMatches(stderr, store.entries, feedbackMap, 3);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState(false);

  function handleFeedback(entryId: string, helpful: boolean) {
    setStore((prev) => addFeedback(prev, entryId, helpful));
    setFeedbackGiven((prev) => new Set(prev).add(entryId));
  }

  async function handleUpdate() {
    setUpdating(true);
    try {
      const resp = await fetch(
        'https://gist.githubusercontent.com/open-factory/error-knowledge-base/main/error-knowledge.json',
      );
      if (!resp.ok) throw new Error('fetch failed');
      const remote = await resp.json();
      if (Array.isArray(remote)) {
        setStore((prev) => mergeKnowledgeUpdate(prev, remote, 'github-gist'));
      }
    } catch {
      // network unavailable, use local
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="error-knowledge-dialog"
    >
      <section className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-panel"
              type="button"
              disabled={updating}
              onClick={handleUpdate}
              data-testid="error-knowledge-update-button"
            >
              <RefreshCw size={12} className={updating ? 'animate-spin' : ''} />
              {t.updateAvailable}
            </button>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel"
              type="button"
              onClick={onClose}
              data-testid="error-knowledge-close-button"
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {matches.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{t.noMatches}</p>
          ) : (
            <div className="space-y-3" data-testid="error-knowledge-matches">
              {matches.map((match, index) => (
                <MatchCard
                  key={match.entry.id}
                  match={match}
                  index={index}
                  t={t}
                  feedbackGiven={feedbackGiven.has(match.entry.id)}
                  onFeedback={(helpful) => handleFeedback(match.entry.id, helpful)}
                />
              ))}
            </div>
          )}
        </div>
        <footer className="border-t border-line px-4 py-2 text-xs text-slate-400">
          {t.entryCount(store.entries.length)}
        </footer>
      </section>
    </div>
  );
}

function MatchCard({
  match,
  index,
  t,
  feedbackGiven,
  onFeedback,
}: {
  match: ErrorKnowledgeMatch;
  index: number;
  t: typeof zhCN.errorKnowledge;
  feedbackGiven: boolean;
  onFeedback(helpful: boolean): void;
}) {
  const catLabel = t.categories[match.entry.category] ?? match.entry.category;
  return (
    <div className="rounded-md border border-line bg-white p-3" data-testid={`error-knowledge-match-${index}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <span className="mr-2 inline-block rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand">
            {catLabel}
          </span>
          <span className="text-sm font-semibold text-ink">{match.entry.label}</span>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{t.matchScore(match.score)}</span>
      </div>
      {match.entry.causes.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-xs font-medium text-slate-600">{t.causes}</div>
          <ul className="list-disc pl-4 text-xs text-slate-700">
            {match.entry.causes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      {match.entry.solutions.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-xs font-medium text-slate-600">{t.solutions}</div>
          <ol className="list-decimal pl-4 text-xs text-slate-700">
            {match.entry.solutions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
      {match.entry.links.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-xs font-medium text-slate-600">{t.relatedLinks}</div>
          <ul className="list-disc pl-4 text-xs">
            {match.entry.links.map((l, i) => (
              <li key={i}>
                <a className="text-brand underline" href={l} target="_blank" rel="noreferrer">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 border-t border-line pt-2">
        <span className="text-xs text-slate-500">{t.helpful}</span>
        {feedbackGiven ? (
          <span className="text-xs text-brand">{t.feedbackRecorded}</span>
        ) : (
          <>
            <button
              className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-xs text-slate-600 hover:bg-panel"
              type="button"
              onClick={() => onFeedback(true)}
              data-testid={`error-knowledge-helpful-yes-${index}`}
            >
              <ThumbsUp size={11} /> {t.helpfulYes}
            </button>
            <button
              className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-xs text-slate-600 hover:bg-panel"
              type="button"
              onClick={() => onFeedback(false)}
              data-testid={`error-knowledge-helpful-no-${index}`}
            >
              <ThumbsDown size={11} /> {t.helpfulNo}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
