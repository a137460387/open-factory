import { useEffect, useMemo, useState } from 'react';
import { Archive, RefreshCw, Trash2, X } from 'lucide-react';
import {
  expandRenameTemplate,
  type MediaAsset,
  type MediaCleanupReport,
  type SmartDuplicateGroup,
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';

export interface MediaOrganizerDuplicateSelection {
  groupId: string;
  keepAssetId: string;
  removeAssetIds: string[];
}

interface MediaOrganizerDialogProps {
  groups: SmartDuplicateGroup[];
  cleanup?: MediaCleanupReport;
  scanning: boolean;
  onRescan(): void;
  onClose(): void;
  onConfirmDuplicateGroups(selections: MediaOrganizerDuplicateSelection[], moveFilesToTrash: boolean): void;
  onRemoveMediaReferences(assetIds: string[]): void;
  onArchiveUnused(): void;
  onApplyRenameTemplate(template: string): void;
}

export function MediaOrganizerDialog({
  groups,
  cleanup,
  scanning,
  onRescan,
  onClose,
  onConfirmDuplicateGroups,
  onRemoveMediaReferences,
  onArchiveUnused,
  onApplyRenameTemplate,
}: MediaOrganizerDialogProps) {
  const t = zhCN.mediaOrganizer;
  const [confirmedGroups, setConfirmedGroups] = useState<Record<string, boolean>>({});
  const [removeByGroup, setRemoveByGroup] = useState<Record<string, Record<string, boolean>>>({});
  const [renameTemplate, setRenameTemplate] = useState('{date}/{resolution}/{codec}/{index}');
  const [moveFilesToTrash, setMoveFilesToTrash] = useState(false);

  useEffect(() => {
    setConfirmedGroups({});
    setRemoveByGroup(
      Object.fromEntries(
        groups.map((group) => [
          group.id,
          Object.fromEntries(group.assets.map((asset) => [asset.assetId, asset.assetId !== group.keepAssetId])),
        ]),
      ),
    );
  }, [groups]);

  const selections = useMemo(
    () =>
      groups
        .filter((group) => confirmedGroups[group.id])
        .map((group) => ({
          groupId: group.id,
          keepAssetId: group.keepAssetId,
          removeAssetIds: group.assets
            .filter((asset) => asset.assetId !== group.keepAssetId && removeByGroup[group.id]?.[asset.assetId])
            .map((asset) => asset.assetId),
        }))
        .filter((selection) => selection.removeAssetIds.length > 0),
    [confirmedGroups, groups, removeByGroup],
  );
  const renamePreviewAsset = groups[0]?.assets[0];
  const renamePreview = renamePreviewAsset
    ? expandRenameTemplate(renameTemplate, {
        date: renamePreviewAsset.createdAt,
        width: renamePreviewAsset.width,
        height: renamePreviewAsset.height,
        codec: renamePreviewAsset.codec,
        index: 1,
        name: renamePreviewAsset.name,
      })
    : expandRenameTemplate(renameTemplate, { index: 1 });
  const orphaned = cleanup?.orphaned ?? [];
  const unused = cleanup?.unused ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="media-organizer-dialog"
    >
      <section className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel disabled:opacity-50"
              type="button"
              disabled={scanning}
              data-testid="media-organizer-rescan-button"
              onClick={onRescan}
            >
              <RefreshCw size={15} />
              {scanning ? t.scanning : t.rescan}
            </button>
            <button
              className="rounded p-1 text-slate-500 hover:bg-panel"
              type="button"
              aria-label={zhCN.common.close}
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-3">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">{t.duplicatesTitle}</h3>
                <span className="text-xs text-slate-500" data-testid="media-organizer-duplicate-count">
                  {t.groupCount(groups.length)}
                </span>
              </div>
              {groups.length === 0 ? (
                <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">
                  {scanning ? t.scanning : t.noDuplicates}
                </div>
              ) : null}
              <div className="space-y-3">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="rounded-md border border-line p-3"
                    data-testid="media-organizer-duplicate-group"
                  >
                    <label className="mb-3 flex items-start gap-2 text-sm font-medium text-slate-800">
                      <input
                        className="mt-1 accent-brand"
                        type="checkbox"
                        checked={Boolean(confirmedGroups[group.id])}
                        data-testid="media-organizer-confirm-group"
                        onChange={(event) =>
                          setConfirmedGroups((current) => ({ ...current, [group.id]: event.target.checked }))
                        }
                      />
                      <span>
                        {t.confirmGroup}
                        <span className="block text-xs font-normal text-slate-500">
                          {t.similarity(group.similarity)}
                        </span>
                      </span>
                    </label>
                    <div className="space-y-2">
                      {group.assets.map((asset) => {
                        const keep = asset.assetId === group.keepAssetId;
                        return (
                          <label
                            key={asset.assetId}
                            className="grid grid-cols-[auto_1fr] gap-2 rounded-md bg-panel px-2 py-2 text-xs text-slate-600"
                          >
                            <input
                              className="mt-1 accent-brand"
                              type="checkbox"
                              disabled={keep}
                              checked={!keep && Boolean(removeByGroup[group.id]?.[asset.assetId])}
                              data-testid="media-organizer-remove-asset-checkbox"
                              onChange={(event) =>
                                setRemoveByGroup((current) => ({
                                  ...current,
                                  [group.id]: {
                                    ...current[group.id],
                                    [asset.assetId]: event.target.checked,
                                  },
                                }))
                              }
                            />
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="truncate font-medium text-slate-800">{asset.name}</span>
                                {keep ? (
                                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                    {t.keep}
                                  </span>
                                ) : null}
                              </span>
                              <span className="block truncate" title={asset.path}>
                                {asset.path}
                              </span>
                              <span className="mt-1 block text-slate-500">
                                {formatResolution(asset.width, asset.height)} · {formatBytes(asset.size)} ·{' '}
                                {asset.codec ?? t.unknown}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <section className="rounded-md border border-line p-3">
              <h3 className="text-sm font-semibold text-ink">{t.cleanupTitle}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <SummaryBox label={t.orphaned} count={orphaned.length} testId="media-organizer-orphan-count" />
                <SummaryBox label={t.unused} count={unused.length} testId="media-organizer-unused-count" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel disabled:opacity-50"
                  type="button"
                  disabled={orphaned.length === 0}
                  data-testid="media-organizer-remove-orphans-button"
                  onClick={() => onRemoveMediaReferences(orphaned.map((asset) => asset.id))}
                >
                  <Trash2 size={15} />
                  {t.removeOrphans}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel disabled:opacity-50"
                  type="button"
                  disabled={unused.length === 0}
                  data-testid="media-organizer-remove-unused-button"
                  onClick={() => onRemoveMediaReferences(unused.map((asset) => asset.id))}
                >
                  <Trash2 size={15} />
                  {t.removeUnused}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel disabled:opacity-50"
                  type="button"
                  disabled={unused.length === 0}
                  data-testid="media-organizer-archive-unused-button"
                  onClick={onArchiveUnused}
                >
                  <Archive size={15} />
                  {t.archiveUnused}
                </button>
              </div>
            </section>
            <section className="rounded-md border border-line p-3">
              <h3 className="text-sm font-semibold text-ink">{t.renameTitle}</h3>
              <label className="mt-3 block text-xs font-medium text-slate-600">
                {t.renameTemplate}
                <input
                  className="mt-1 w-full rounded-md border border-line px-2 py-2 text-sm"
                  value={renameTemplate}
                  data-testid="media-organizer-rename-template-input"
                  onChange={(event) => setRenameTemplate(event.target.value)}
                />
              </label>
              <div
                className="mt-2 rounded-md bg-panel p-2 text-xs text-slate-600"
                data-testid="media-organizer-rename-preview"
              >
                {renamePreview}
              </div>
              <button
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel disabled:opacity-50"
                type="button"
                disabled={unused.length === 0}
                data-testid="media-organizer-apply-rename-button"
                onClick={() => onApplyRenameTemplate(renameTemplate)}
              >
                {t.applyRename}
              </button>
            </section>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <label className="mr-auto flex items-center gap-2 text-xs text-slate-600">
            <input
              className="accent-brand"
              type="checkbox"
              checked={moveFilesToTrash}
              data-testid="media-organizer-trash-files-checkbox"
              onChange={(event) => setMoveFilesToTrash(event.target.checked)}
            />
            {t.moveFilesToTrash}
          </label>
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
            disabled={selections.length === 0}
            data-testid="media-organizer-remove-selected-button"
            onClick={() => onConfirmDuplicateGroups(selections, moveFilesToTrash)}
          >
            <Trash2 size={15} />
            {t.removeSelected}
          </button>
        </div>
      </section>
    </div>
  );
}

function SummaryBox({ label, count, testId }: { label: string; count: number; testId: string }) {
  return (
    <div className="rounded-md bg-panel p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums" data-testid={testId}>
        {count}
      </div>
    </div>
  );
}

function formatResolution(width?: number, height?: number): string {
  return width && height ? `${width} x ${height}` : zhCN.mediaOrganizer.unknown;
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
