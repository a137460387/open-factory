import { useState } from 'react';
import type { ProjectFileEncryptionOptions } from '../../lib/projectFiles';
import { zhCN } from '../../i18n/strings';

export function ProjectEncryptionSaveDialog({
  onConfirm,
  onClose
}: {
  onConfirm(options: ProjectFileEncryptionOptions): void;
  onClose(): void;
}) {
  const [encrypted, setEncrypted] = useState(true);
  const [password, setPassword] = useState('');
  const t = zhCN.projectFiles;
  const passwordRequired = encrypted && password.trim().length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="project-encryption-dialog">
      <form
        className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft"
        onSubmit={(event) => {
          event.preventDefault();
          if (passwordRequired) {
            return;
          }
          onConfirm(encrypted ? { encrypted: true, password } : {});
        }}
      >
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{t.encryptedSaveTitle}</h2>
          <p className="mt-1 text-xs text-slate-500">{t.encryptedSaveDescription}</p>
        </div>
        <div className="space-y-3 px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              className="h-4 w-4 accent-brand"
              type="checkbox"
              checked={encrypted}
              onChange={(event) => setEncrypted(event.target.checked)}
              data-testid="project-encryption-toggle"
            />
            {t.encryptedSaveToggle}
          </label>
          {encrypted ? (
            <label className="block text-xs font-medium text-slate-600">
              {t.encryptedPasswordLabel}
              <input
                className="mt-1 h-9 w-full rounded-md border border-line px-2 py-1 text-sm text-ink"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                data-testid="project-encryption-password-input"
                autoFocus
              />
            </label>
          ) : null}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">{t.encryptedForgetWarning}</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel" type="button" onClick={onClose} data-testid="project-encryption-cancel-button">
            {zhCN.common.cancel}
          </button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={passwordRequired} data-testid="project-encryption-confirm-button">
            {t.encryptedConfirm}
          </button>
        </div>
      </form>
    </div>
  );
}
