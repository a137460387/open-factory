import { useEffect, useState } from 'react';
import { Merge, X } from 'lucide-react';
import type { DuplicateMediaGroup } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';

export interface DuplicateMediaMergeSelection {
  groupId: string;
  keepAssetId: string;
  assetIds: string[];
}

interface DuplicateMediaDialogProps {
  groups: DuplicateMediaGroup[];
  onConfirm(selections: DuplicateMediaMergeSelection[]): void;
  onClose(): void;
}

export function DuplicateMediaDialog({ groups, onConfirm, onClose }: DuplicateMediaDialogProps) {
  const t = zhCN.duplicateMedia;
  const [keepByGroup, setKeepByGroup] = useState<Record<string, string>>({});

  useEffect(() => {
    setKeepByGroup(Object.fromEntries(groups.map((group) => [group.id, group.keepAssetId])));
  }, [groups]);

  const selections = groups.map((group) => ({
    groupId: group.id,
    keepAssetId: keepByGroup[group.id] ?? group.keepAssetId,
    assetIds: group.assets.map((asset) => asset.assetId),
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="duplicate-media-dialog"
    >
      <section className="w-full max-w-2xl rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{t.title(groups.length)}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button
            className="rounded p-1 text-slate-500 hover:bg-panel"
            type="button"
            aria-label={zhCN.common.close}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4 text-sm">
          {groups.length === 0 ? (
            <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.empty}</div>
          ) : null}
          {groups.map((group) => (
            <div key={group.id} className="rounded-md border border-line p-3" data-testid="duplicate-media-group">
              <div className="mb-2 text-xs font-semibold text-slate-700">
                {t.groupSummary(group.assets.length, formatBytes(group.size))}
              </div>
              <div className="space-y-2">
                {group.assets.map((asset) => (
                  <label
                    key={asset.assetId}
                    className="grid grid-cols-[auto_1fr] gap-2 rounded-md bg-panel px-2 py-2 text-xs text-slate-600"
                  >
                    <input
                      className="mt-1 accent-brand"
                      type="radio"
                      name={`duplicate-${group.id}`}
                      value={asset.assetId}
                      checked={(keepByGroup[group.id] ?? group.keepAssetId) === asset.assetId}
                      data-testid="duplicate-media-keep-radio"
                      onChange={() => setKeepByGroup((current) => ({ ...current, [group.id]: asset.assetId }))}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-800">{asset.name}</span>
                      <span className="block truncate" title={asset.path}>
                        {asset.path}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel"
            type="button"
            onClick={onClose}
          >
            {t.cancel}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858] disabled:opacity-50"
            type="button"
            disabled={groups.length === 0}
            data-testid="duplicate-media-merge-button"
            onClick={() => onConfirm(selections)}
          >
            <Merge size={15} />
            {t.merge}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
