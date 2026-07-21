'use client';

import { useInstallPlugin } from '@/hooks/useInstallPlugin';

interface InstallButtonProps {
  readonly pluginId: string;
  readonly pluginName: string;
  readonly isInstalled?: boolean;
  readonly permissions?: readonly string[];
}

export function InstallButton({
  pluginId: _pluginId,
  pluginName,
  isInstalled = false,
  permissions = [],
}: InstallButtonProps) {
  const install = useInstallPlugin({
    hasPermissions: permissions.length > 0,
  });

  if (isInstalled) {
    return (
      <button className="flex items-center gap-2 rounded-lg border border-[rgba(var(--success-rgb),0.2)] bg-[rgba(var(--success-rgb),0.1)] px-5 py-2.5 text-sm font-medium text-[var(--success)]">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Installed
      </button>
    );
  }

  if (install.state === 'confirming') {
    return (
      <div className="w-72 rounded-xl border border-[rgba(var(--warning-rgb),0.2)] bg-[var(--surface-1)] p-4 space-y-3">
        <p className="text-xs font-medium text-[var(--warning)]">
          This plugin requests special permissions:
        </p>
        <ul className="space-y-1.5">
          {permissions.map((perm) => (
            <li
              key={perm}
              className="flex items-start gap-2 text-xs text-[var(--text-secondary)]"
            >
              <svg className="mt-0.5 h-3 w-3 flex-shrink-0 text-[var(--warning)]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              {perm}
            </li>
          ))}
        </ul>
        <div className="flex gap-2 pt-1">
          <button
            onClick={install.confirmInstall}
            className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Accept & Install
          </button>
          <button
            onClick={install.cancelInstall}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (install.state === 'installing') {
    return (
      <div className="w-56 space-y-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${install.progress}%` }}
          />
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">
          Installing {pluginName}... {install.progress}%
        </p>
      </div>
    );
  }

  if (install.state === 'success') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[rgba(var(--success-rgb),0.2)] bg-[rgba(var(--success-rgb),0.1)] px-5 py-2.5 text-sm font-medium text-[var(--success)]">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Installed Successfully
      </div>
    );
  }

  if (install.state === 'error') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-[var(--danger)]">{install.error}</p>
        <button
          onClick={install.reset}
          className="rounded-lg bg-[var(--danger)] px-5 py-2.5 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: 'rgba(var(--danger-rgb), 0.8)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={install.startInstall}
      className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
    >
      Install Plugin
    </button>
  );
}
