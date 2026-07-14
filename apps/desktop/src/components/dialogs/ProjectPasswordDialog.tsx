import { useState } from 'react';
import { zhCN } from '../../i18n/strings';

export interface ProjectPasswordRequest {
  title: string;
  description: string;
  resolve(password?: string): void;
}

export function ProjectPasswordDialog({
  request,
  onClose,
  onConfirm,
}: {
  request: ProjectPasswordRequest;
  onClose(): void;
  onConfirm(password: string): void;
}) {
  const [password, setPassword] = useState('');
  const disabled = password.trim().length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="project-password-dialog"
    >
      <form
        className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) {
            onConfirm(password);
          }
        }}
      >
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{request.title}</h2>
          <p className="mt-1 text-xs text-slate-500">{request.description}</p>
        </div>
        <div className="space-y-3 px-4 py-3">
          <label className="block text-xs font-medium text-slate-600">
            {zhCN.projectFiles.encryptedPasswordLabel}
            <input
              className="mt-1 h-9 w-full rounded-md border border-line px-2 py-1 text-sm text-ink"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              data-testid="project-password-input"
              autoFocus
            />
          </label>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">
            {zhCN.projectFiles.encryptedForgetWarning}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel"
            type="button"
            onClick={onClose}
            data-testid="project-password-cancel-button"
          >
            {zhCN.common.cancel}
          </button>
          <button
            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858] disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={disabled}
            data-testid="project-password-confirm-button"
          >
            {zhCN.projectFiles.encryptedConfirm}
          </button>
        </div>
      </form>
    </div>
  );
}
