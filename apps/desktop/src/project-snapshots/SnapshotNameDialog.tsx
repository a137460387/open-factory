import { useState } from 'react';
import { zhCN } from '../i18n/strings';

interface SnapshotNameDialogProps {
  defaultName: string;
  onConfirm(name: string): void;
  onClose(): void;
}

export function SnapshotNameDialog({ defaultName, onConfirm, onClose }: SnapshotNameDialogProps) {
  const t = zhCN.projectSnapshots;
  const [name, setName] = useState(defaultName.trim() || t.defaultName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="snapshot-name-dialog">
      <form
        className="w-full max-w-sm rounded-md border border-line bg-white p-4 shadow-soft"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(name);
        }}
      >
        <div className="text-base font-semibold text-ink">{t.saveTitle}</div>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          {t.nameLabel}
          <input
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink"
            value={name}
            autoFocus
            data-testid="snapshot-name-input"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel" type="button" onClick={onClose}>
            {zhCN.common.cancel}
          </button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-[#176858]" type="submit" data-testid="snapshot-name-save-button">
            {t.save}
          </button>
        </div>
      </form>
    </div>
  );
}
