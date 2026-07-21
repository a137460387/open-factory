'use client';

import { useState } from 'react';
import type { PermissionGrant } from '@open-factory/plugin-market';

interface PermissionDialogProps {
  readonly pluginName: string;
  readonly permissions: readonly PermissionGrant[];
  readonly onAccept: () => void;
  readonly onReject: () => void;
}

export function PermissionDialog({
  pluginName,
  permissions,
  onAccept,
  onReject,
}: PermissionDialogProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-6 shadow-2xl">
        <h2 className="text-lg font-bold">Permission Request</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          <strong>{pluginName}</strong> requests the following permissions:
        </p>

        <div className="mt-4 space-y-2">
          {permissions.map((perm, i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3"
            >
              <button
                onClick={() =>
                  setExpanded(expanded === i ? null : i)
                }
                className="flex w-full items-center justify-between"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <svg className="h-4 w-4 text-[var(--warning)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  {perm.category}: {perm.target}
                </span>
                <svg
                  className={`h-4 w-4 text-[var(--text-tertiary)] transition-transform ${
                    expanded === i ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {expanded === i && (
                <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                  Operations: {perm.operations.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onAccept}
            className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Accept All
          </button>
          <button
            onClick={onReject}
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
