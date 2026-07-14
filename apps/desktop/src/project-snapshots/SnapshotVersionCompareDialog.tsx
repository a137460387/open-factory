import { diffTimelineVersions, type Project, type TimelineVersionDiffItem } from '@open-factory/editor-core';
import { serializeDiffForAi, parseVersionDiffAiResponse } from '@open-factory/editor-core';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { zhCN } from '../i18n/strings';
import { listProjectSnapshots, readProjectSnapshot, type ProjectSnapshotEntry } from '../lib/projectSnapshots';
import { callAiApi, readAiApiKey } from '../lib/tauri-bridge';
import { useAISettingsStore } from '../store/aiSettingsStore';
import { showToast } from '../lib/toast';

interface SnapshotVersionCompareDialogProps {
  project: Project;
  projectPath?: string;
  onApply(source: Project, itemIds: string[]): void;
  onClose(): void;
}

interface LoadedVersion {
  id: string;
  label: string;
  project: Project;
  entry?: ProjectSnapshotEntry;
}

export function SnapshotVersionCompareDialog({
  project,
  projectPath,
  onApply,
  onClose,
}: SnapshotVersionCompareDialogProps) {
  const t = zhCN.projectSnapshots;
  const [versions, setVersions] = useState<LoadedVersion[]>([{ id: 'current', label: t.currentVersion, project }]);
  const [baseId, setBaseId] = useState('current');
  const [targetId, setTargetId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState<{ summary: string; highlights: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const providers = useAISettingsStore((s) => s.providers);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      setLoading(true);
      try {
        const entries = await listProjectSnapshots(project.id);
        const loaded = await Promise.all(
          entries.map(async (entry) => ({
            id: entry.path,
            label: entry.name,
            entry,
            project: await readProjectSnapshot(entry, projectPath),
          })),
        );
        if (!disposed) {
          const nextVersions = [{ id: 'current', label: t.currentVersion, project }, ...loaded];
          setVersions(nextVersions);
          setTargetId((current) => current || loaded[0]?.id || '');
        }
      } catch (error) {
        showToast({
          kind: 'warning',
          title: t.compareFailed,
          message: error instanceof Error ? error.message : t.compareFailed,
        });
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      disposed = true;
    };
  }, [project, project.id, projectPath, t.compareFailed, t.currentVersion]);

  const handleAiSummary = async () => {
    if (!base || !target || items.length === 0) return;
    const provider = providers.find((p) => p.enabled);
    if (!provider) return;
    setAiLoading(true);
    try {
      const apiKey = await readAiApiKey(provider.id);
      const snapshotDiffItems = items.map((item) => ({
        type:
          item.type === 'clip-added'
            ? ('added' as const)
            : item.type === 'clip-deleted'
              ? ('removed' as const)
              : ('modified' as const),
        clipId: item.clipId,
        trackId: item.trackId,
        detail: item.label,
      }));
      const payload = serializeDiffForAi(snapshotDiffItems);
      const response = await callAiApi(
        {
          providerId: provider.id,
          baseUrl: provider.baseUrl,
          model: provider.defaultModel,
          messages: [
            { role: 'system', content: '\u7248\u672c\u5bf9\u6bd4\u6458\u8981\u52a9\u624b' },
            { role: 'user', content: payload },
          ],
          temperature: 0.3,
          timeoutSecs: 30,
        },
        apiKey,
      );
      const parsed = JSON.parse(response.content);
      const aiResponse = parseVersionDiffAiResponse(parsed);
      setAiSummary(aiResponse);
      setShowAiModal(true);
    } catch (err) {
      showToast({
        kind: 'error',
        title: zhCN.projectSnapshots.aiVersionDiff.failedTitle,
        message: err instanceof Error ? err.message : zhCN.projectSnapshots.aiVersionDiff.failedMessage,
      });
    } finally {
      setAiLoading(false);
    }
  };

  const base = versions.find((version) => version.id === baseId);
  const target = versions.find((version) => version.id === targetId);
  const diff = useMemo(
    () => (base && target ? diffTimelineVersions(base.project.timeline, target.project.timeline) : undefined),
    [base, target],
  );
  const items = diff?.items ?? [];

  useEffect(() => {
    setSelected([]);
  }, [baseId, targetId]);

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const applySelected = () => {
    if (!target || selected.length === 0) {
      showToast({ kind: 'warning', title: t.compareTitle, message: t.selectDiffs });
      return;
    }
    onApply(target.project, selected);
    showToast({ kind: 'success', title: t.appliedDiffs });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="snapshot-version-diff-dialog"
    >
      <div className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-ink">{t.compareTitle}</div>
            <div className="mt-0.5 text-xs text-slate-500">{t.compareSubtitle}</div>
          </div>
          <button
            className="rounded-md p-2 text-slate-500 hover:bg-panel"
            type="button"
            aria-label={zhCN.common.close}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 border-b border-line bg-panel p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <VersionSelect
              label={t.compareBase}
              value={baseId}
              versions={versions}
              onChange={setBaseId}
              testId="snapshot-version-base-select"
            />
            <VersionSelect
              label={t.compareTarget}
              value={targetId}
              versions={versions.filter((version) => version.id !== 'current')}
              onChange={setTargetId}
              testId="snapshot-version-target-select"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold text-slate-600" data-testid="snapshot-version-diff-summary">
              {diff
                ? t.diffSummary(
                    diff.summary.added,
                    diff.summary.deleted,
                    diff.summary.modified,
                    diff.summary.trackChanges,
                  )
                : loading
                  ? zhCN.common.unavailable
                  : t.noSnapshots}
            </div>
            {items.length > 0 && (
              <button
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={aiLoading || !providers.some((p) => p.enabled)}
                onClick={() => void handleAiSummary()}
                data-testid="snapshot-version-ai-summary"
              >
                {aiLoading
                  ? zhCN.projectSnapshots.aiVersionDiff.analyzing
                  : zhCN.projectSnapshots.aiVersionDiff.compareAndSummarize}
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-slate-500" data-testid="snapshot-version-diff-empty">
              {loading ? zhCN.common.unavailable : targetId ? t.noDiffs : t.noSnapshots}
            </div>
          ) : (
            <div className="min-w-[760px] divide-y divide-line">
              {items.map((item) => (
                <DiffRow
                  key={item.id}
                  item={item}
                  checked={selected.includes(item.id)}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </div>
          )}
        </div>
        {showAiModal && aiSummary && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            data-testid="ai-version-diff-modal"
          >
            <div className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-md border border-line bg-white shadow-soft">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="text-base font-semibold text-ink">
                  {zhCN.projectSnapshots.aiVersionDiff.summaryTitle}
                </div>
                <button
                  className="rounded-md p-2 text-slate-500 hover:bg-panel"
                  type="button"
                  onClick={() => setShowAiModal(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
                <div data-testid="ai-version-diff-summary-text">
                  <div className="text-xs font-semibold text-slate-700 mb-1">
                    {zhCN.projectSnapshots.aiVersionDiff.summary}
                  </div>
                  <p className="text-sm text-slate-800">{aiSummary.summary}</p>
                </div>
                {aiSummary.highlights.length > 0 && (
                  <div data-testid="ai-version-diff-highlights">
                    <div className="text-xs font-semibold text-slate-700 mb-1">
                      {zhCN.projectSnapshots.aiVersionDiff.highlights}
                    </div>
                    <ul className="list-disc list-inside text-sm text-slate-700">
                      {aiSummary.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex justify-end border-t border-line p-4">
                <button
                  className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel"
                  type="button"
                  onClick={() => setShowAiModal(false)}
                >
                  {zhCN.common.close}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line p-4">
          <button
            className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel"
            type="button"
            onClick={onClose}
          >
            {zhCN.common.close}
          </button>
          <button
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            data-testid="snapshot-version-apply-selected"
            disabled={selected.length === 0}
            onClick={applySelected}
          >
            {t.applySelected}
          </button>
        </div>
      </div>
    </div>
  );
}

function VersionSelect({
  label,
  value,
  versions,
  testId,
  onChange,
}: {
  label: string;
  value: string;
  versions: LoadedVersion[];
  testId: string;
  onChange(value: string): void;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <select
        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{zhCN.projectSnapshots.noSnapshots}</option>
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            {version.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DiffRow({ item, checked, onToggle }: { item: TimelineVersionDiffItem; checked: boolean; onToggle(): void }) {
  const t = zhCN.projectSnapshots;
  return (
    <label
      className="grid grid-cols-[32px_130px_minmax(180px,1fr)_minmax(220px,2fr)] items-start gap-3 px-4 py-3 text-sm"
      data-testid="snapshot-version-diff-row"
    >
      <input
        className="mt-1 h-4 w-4 accent-brand"
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        data-testid={`snapshot-version-diff-check-${item.id}`}
      />
      <span className="rounded-md bg-panel px-2 py-1 text-xs font-semibold text-slate-700">
        {t.diffTypes[item.type]}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink">{item.label}</span>
        <span className="block truncate text-xs text-slate-500">{item.clipId ?? item.trackId}</span>
      </span>
      <span className="space-y-1 text-xs text-slate-600">
        {item.fields.map((field) => (
          <span
            key={field.field}
            className="block truncate"
            title={`${field.field}: ${formatValue(field.before)} -> ${formatValue(field.after)}`}
          >
            <span className="font-semibold">{field.field}</span>: {formatValue(field.before)}
            {' -> '}
            {formatValue(field.after)}
          </span>
        ))}
      </span>
    </label>
  );
}

function formatValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return '-';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}
