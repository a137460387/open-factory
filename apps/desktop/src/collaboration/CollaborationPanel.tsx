import { Users, Lock, MessageSquareText, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useCollaborationStore } from '../store/collaborationStore';
import { collaborationController } from './local-network';
import { zhCN } from '../i18n/strings';

interface CollaborationPanelProps {
  onClose(): void;
}

/** 本机模拟协同的会话面板：会话创建/邀请信息/在线成员/评论/会话锁定状态。 */
export default function CollaborationPanel({ onClose }: CollaborationPanelProps) {
  const t = zhCN.collabPanel;
  const enabled = useCollaborationStore((s) => s.enabled);
  const sessionId = useCollaborationStore((s) => s.sessionId);
  const sessionLockedBy = useCollaborationStore((s) => s.sessionLockedBy);
  const users = useCollaborationStore((s) => s.users);
  const localUserId = useCollaborationStore((s) => s.userId);
  const operations = useCollaborationStore((s) => s.operations);
  const [commentText, setCommentText] = useState('');
  const [creating, setCreating] = useState(false);

  const sessionActive = enabled && Boolean(sessionId);
  const statusText = sessionActive ? t.statusCreated : t.statusDisconnected;
  const comments = operations.filter((operation) => operation.kind === 'comment');
  const userNameOf = (userId: string) => users.find((user) => user.userId === userId)?.name ?? userId;

  async function createSession(): Promise<void> {
    setCreating(true);
    try {
      await collaborationController.createSession({ port: 37822 });
    } finally {
      setCreating(false);
    }
  }

  async function submitComment(): Promise<void> {
    const trimmed = commentText.trim();
    if (!trimmed) {
      return;
    }
    setCommentText('');
    await collaborationController.broadcastComment(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="collaboration-panel">
      <section className="grid max-h-[88vh] w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Users size={18} className="text-slate-500" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
              <p className="text-xs text-slate-500" data-testid="collab-session-status">
                {statusText}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-panel"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="collab-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 space-y-4 overflow-auto p-4">
          {/* 会话创建 / 会话信息 */}
          {sessionActive ? (
            <div className="space-y-2 rounded-md border border-line bg-panel p-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-medium">{t.sessionIdLabel}</span>
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink" data-testid="collab-session-id">
                  {sessionId}
                </code>
              </div>
              <div className="rounded-md border border-line bg-white p-3" data-testid="collab-invite-section">
                <p className="text-xs font-semibold text-ink">{t.inviteTitle}</p>
                <p className="mt-1 text-xs text-slate-500">{t.inviteDescription}</p>
                <p className="mt-1 text-xs text-slate-600">{t.inviteJoinHint(sessionId ?? '', 37822)}</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-brand px-3 text-sm font-medium text-white disabled:opacity-50"
              data-testid="collab-create-session-button"
              disabled={creating}
              onClick={() => void createSession()}
            >
              <Plus size={15} />
              {t.createSession}
            </button>
          )}

          {/* 会话锁定状态（仅展示，不拦截编辑广播） */}
          {sessionLockedBy ? (
            <div
              className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
              data-testid="collab-lock-status"
            >
              <Lock size={14} />
              {t.lockedBy(userNameOf(sessionLockedBy))}
            </div>
          ) : null}

          {/* 在线成员 */}
          <div>
            <h3 className="mb-2 text-xs font-semibold text-slate-600">{t.onlineUsers}</h3>
            {users.length === 0 ? (
              <p className="rounded-md border border-dashed border-line bg-panel px-3 py-2 text-xs text-slate-500">
                {t.noUsers}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {users.map((user) => (
                  <li
                    key={user.userId}
                    className="flex items-center justify-between gap-2 rounded-md border border-line bg-white px-3 py-2"
                    data-testid={`collab-user-${user.userId}`}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-ink">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: user.color ?? '#38bdf8' }} />
                      {user.name}
                      {user.userId === localUserId ? <span className="text-[10px] text-slate-400">({zhCN.collabPanel.online})</span> : null}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                      data-testid={`collab-user-${user.userId}-status`}
                      data-online="true"
                    >
                      {t.online}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 评论 */}
          <div>
            <h3 className="mb-2 text-xs font-semibold text-slate-600">{t.commentsTitle}</h3>
            {comments.length === 0 ? (
              <p className="rounded-md border border-dashed border-line bg-panel px-3 py-2 text-xs text-slate-500">
                {t.noComments}
              </p>
            ) : (
              <ul className="space-y-1.5" data-testid="collab-comment-list">
                {comments.map((operation) => (
                  <li key={operation.id} className="rounded-md border border-line bg-white px-3 py-2">
                    <p className="text-[11px] text-slate-400">{userNameOf(operation.userId)}</p>
                    <p className="text-xs text-ink">{String(operation.params.text ?? '')}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-4 py-3">
          <input
            className="h-9 min-w-0 flex-1 rounded-md border border-line bg-white px-2 text-sm text-ink"
            value={commentText}
            placeholder={t.commentPlaceholder}
            data-testid="collab-comment-input"
            onChange={(event) => setCommentText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void submitComment();
              }
            }}
          />
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-sm font-medium text-white"
            data-testid="collab-comment-submit"
            onClick={() => void submitComment()}
          >
            <MessageSquareText size={14} />
            {t.commentSubmit}
          </button>
        </footer>
      </section>
    </div>
  );
}
