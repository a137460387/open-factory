import {
  buildProjectReleaseRecord,
  buildReleaseComparisonRequest,
  buildSemver,
  diffReleaseSnapshots,
  incrementSemverPatch,
  runReleaseChecklist,
  type Project,
  type ReleaseChecklistItemResult,
  type ReleaseChecklistOptions,
  type ReleaseVersionDiff,
  type TimelineVersionDiffItem,
} from '@open-factory/editor-core';
import { RefreshCw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BUILTIN_EXPORT_PRESETS } from '../export/export-presets';
import { useExportQueueStore } from '../export/export-queue-store';
import { zhCN } from '../i18n/strings';
import { readProjectSnapshot, saveProjectSnapshot } from '../lib/projectSnapshots';
import { showToast } from '../lib/toast';
import { listProjectReleaseRecords, saveProjectReleaseRecord, type ProjectReleaseEntry } from './projectReleases';

interface ReleaseWorkflowDialogProps {
  project: Project;
  projectPath?: string;
  lastExportPath?: string;
  onReleaseCreated(version: string): void;
  onApplyDiff(sourceProject: Project, itemIds: string[]): void;
  onClose(): void;
}

interface ReleaseCompareState {
  diff: ReleaseVersionDiff;
  targetProject: Project;
}

export function ReleaseWorkflowDialog({
  project,
  projectPath,
  lastExportPath,
  onReleaseCreated,
  onApplyDiff,
  onClose,
}: ReleaseWorkflowDialogProps) {
  const t = zhCN.releaseWorkflow;
  const defaultVersion = useMemo(
    () => splitVersion(incrementSemverPatch(project.releaseVersion)),
    [project.releaseVersion],
  );
  const [version, setVersion] = useState(defaultVersion);
  const [assignee, setAssignee] = useState('');
  const [changelog, setChangelog] = useState('');
  const [outputPath, setOutputPath] = useState(lastExportPath ?? '');
  const [exportPresetId, setExportPresetId] = useState(BUILTIN_EXPORT_PRESETS[0]?.id ?? '');
  const [checklistOptions, setChecklistOptions] = useState<ReleaseChecklistOptions>({
    qualityGate: true,
    mediaRelink: true,
    subtitleProof: true,
    exportPreset: true,
  });
  const [records, setRecords] = useState<ProjectReleaseEntry[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [baseRecordPath, setBaseRecordPath] = useState('');
  const [targetRecordPath, setTargetRecordPath] = useState('');
  const [compareState, setCompareState] = useState<ReleaseCompareState>();
  const [selectedDiffs, setSelectedDiffs] = useState<string[]>([]);
  const latestQualityAssurance = useExportQueueStore(
    (state) => state.history.find((entry) => entry.report?.qualityAssurance)?.report?.qualityAssurance,
  );
  const selectedPreset = useMemo(
    () => BUILTIN_EXPORT_PRESETS.find((preset) => preset.id === exportPresetId),
    [exportPresetId],
  );
  const targetVersion = buildSemver(version.major, version.minor, version.patch);
  const checklist = useMemo(
    () =>
      runReleaseChecklist(project, checklistOptions, {
        qualityAssurance: latestQualityAssurance,
        exportPresetId: selectedPreset?.id,
        exportPresetName: selectedPreset?.name,
      }),
    [checklistOptions, latestQualityAssurance, project, selectedPreset],
  );

  useEffect(() => {
    setVersion(defaultVersion);
  }, [defaultVersion.major, defaultVersion.minor, defaultVersion.patch, project.id]);

  useEffect(() => {
    if (lastExportPath && !outputPath) {
      setOutputPath(lastExportPath);
    }
  }, [lastExportPath, outputPath]);

  useEffect(() => {
    void refreshRecords();
  }, [project.id]);

  async function refreshRecords() {
    setLoadingRecords(true);
    try {
      const nextRecords = await listProjectReleaseRecords(project.id);
      setRecords(nextRecords);
      setBaseRecordPath((current) => current || nextRecords[1]?.path || nextRecords[0]?.path || '');
      setTargetRecordPath((current) => current || nextRecords[0]?.path || '');
    } catch (error) {
      showToast({ kind: 'error', title: t.loadFailed, message: error instanceof Error ? error.message : t.loadFailed });
    } finally {
      setLoadingRecords(false);
    }
  }

  async function publishRelease() {
    if (!outputPath.trim()) {
      showToast({ kind: 'warning', title: t.publishBlocked, message: t.outputPathRequired });
      return;
    }
    if (!checklist.canRelease) {
      showToast({ kind: 'warning', title: t.publishBlocked, message: t.blockingSummary(checklist.blockingCount) });
      return;
    }
    setPublishing(true);
    try {
      const projectForRelease = { ...project, releaseVersion: targetVersion };
      const snapshot = await saveProjectSnapshot(projectForRelease, t.snapshotName(targetVersion), projectPath);
      const record = buildProjectReleaseRecord({
        project: projectForRelease,
        version: targetVersion,
        checklist,
        exportPath: outputPath.trim(),
        assignee,
        changelog,
        snapshotPath: snapshot.path,
        exportPresetId: selectedPreset?.id,
        exportPresetName: selectedPreset?.name,
      });
      const saved = await saveProjectReleaseRecord(record);
      onReleaseCreated(targetVersion);
      showToast({ kind: 'success', title: t.published, message: t.publishedMessage(targetVersion) });
      setRecords((current) =>
        [saved, ...current.filter((item) => item.path !== saved.path)].sort((left, right) =>
          right.releasedAt.localeCompare(left.releasedAt),
        ),
      );
      setTargetRecordPath(saved.path);
      setChangelog('');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.publishFailed,
        message: error instanceof Error ? error.message : t.publishFailed,
      });
    } finally {
      setPublishing(false);
    }
  }

  async function compareReleases() {
    const base = records.find((record) => record.path === baseRecordPath);
    const target = records.find((record) => record.path === targetRecordPath);
    if (!base || !target || base.path === target.path) {
      showToast({ kind: 'warning', title: t.compareTitle, message: t.compareSelectionRequired });
      return;
    }
    try {
      buildReleaseComparisonRequest(base, target);
      const [baseProject, targetProject] = await Promise.all([
        readProjectSnapshot({ path: base.snapshotPath }, projectPath),
        readProjectSnapshot({ path: target.snapshotPath }, projectPath),
      ]);
      setCompareState({ diff: diffReleaseSnapshots(base, target, baseProject, targetProject), targetProject });
      setSelectedDiffs([]);
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.compareFailed,
        message: error instanceof Error ? error.message : t.compareFailed,
      });
    }
  }

  const toggleDiff = (id: string) => {
    setSelectedDiffs((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const applySelectedDiffs = () => {
    if (!compareState || selectedDiffs.length === 0) {
      showToast({ kind: 'warning', title: t.compareTitle, message: zhCN.projectSnapshots.selectDiffs });
      return;
    }
    onApplyDiff(compareState.targetProject, selectedDiffs);
    showToast({ kind: 'success', title: zhCN.projectSnapshots.appliedDiffs });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="release-workflow-dialog"
    >
      <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-ink">{t.title}</div>
            <div className="mt-0.5 text-xs text-slate-500">{t.subtitle}</div>
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

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-px overflow-hidden bg-line">
          <div className="min-h-0 overflow-y-auto bg-white p-4">
            <section className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <NumberField
                  label={t.major}
                  value={version.major}
                  testId="release-version-major"
                  onChange={(major) => setVersion((current) => ({ ...current, major }))}
                />
                <NumberField
                  label={t.minor}
                  value={version.minor}
                  testId="release-version-minor"
                  onChange={(minor) => setVersion((current) => ({ ...current, minor }))}
                />
                <NumberField
                  label={t.patch}
                  value={version.patch}
                  testId="release-version-patch"
                  onChange={(patch) => setVersion((current) => ({ ...current, patch }))}
                />
              </div>
              <div className="text-xs font-semibold text-slate-600" data-testid="release-target-version">
                {t.targetVersion(targetVersion)}
              </div>
            </section>

            <section className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="block text-xs font-medium text-slate-600">
                {t.exportPreset}
                <select
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  value={exportPresetId}
                  data-testid="release-export-preset-select"
                  onChange={(event) => setExportPresetId(event.target.value)}
                >
                  <option value="">{zhCN.common.none}</option>
                  {BUILTIN_EXPORT_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t.exportPath}
                <input
                  className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
                  value={outputPath}
                  data-testid="release-export-path-input"
                  onChange={(event) => setOutputPath(event.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {t.assignee}
                <input
                  className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
                  value={assignee}
                  data-testid="release-assignee-input"
                  onChange={(event) => setAssignee(event.target.value)}
                />
              </label>
            </section>

            <section className="mt-5">
              <div className="mb-2 text-xs font-semibold uppercase text-slate-500">{t.checklist}</div>
              <div className="grid gap-2 md:grid-cols-2">
                {(['qualityGate', 'mediaRelink', 'subtitleProof', 'exportPreset'] as const).map((id) => (
                  <label
                    key={id}
                    className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm text-slate-700"
                  >
                    <input
                      className="h-4 w-4 accent-brand"
                      type="checkbox"
                      checked={checklistOptions[id]}
                      data-testid={`release-check-toggle-${id}`}
                      onChange={(event) =>
                        setChecklistOptions((current) => ({ ...current, [id]: event.target.checked }))
                      }
                    />
                    <span>{t.checks[id]}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 space-y-2" data-testid="release-checklist-results">
                {checklist.items.map((item) => (
                  <ChecklistRow key={item.id} item={item} />
                ))}
              </div>
            </section>

            <section className="mt-5">
              <label className="block text-xs font-medium text-slate-600">
                {t.changelog}
                <textarea
                  className="mt-1 min-h-28 w-full resize-y rounded-md border border-line px-3 py-2 text-sm text-ink"
                  value={changelog}
                  data-testid="release-changelog-input"
                  onChange={(event) => setChangelog(event.target.value)}
                />
              </label>
            </section>
          </div>

          <aside className="min-h-0 overflow-y-auto bg-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-ink">{t.history}</div>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
                type="button"
                title={t.refresh}
                aria-label={t.refresh}
                data-testid="release-refresh-button"
                onClick={() => void refreshRecords()}
              >
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="space-y-2" data-testid="release-history-list">
              {records.length === 0 ? (
                <div className="text-sm text-slate-500">
                  {loadingRecords ? zhCN.common.unavailable : t.emptyHistory}
                </div>
              ) : (
                records.map((record) => <ReleaseHistoryRow key={record.path} record={record} />)
              )}
            </div>

            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-2 text-sm font-semibold text-ink">{t.compareTitle}</div>
              <div className="space-y-2">
                <ReleaseSelect
                  label={t.compareBase}
                  value={baseRecordPath}
                  records={records}
                  testId="release-compare-base-select"
                  onChange={setBaseRecordPath}
                />
                <ReleaseSelect
                  label={t.compareTarget}
                  value={targetRecordPath}
                  records={records}
                  testId="release-compare-target-select"
                  onChange={setTargetRecordPath}
                />
                <button
                  className="w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  data-testid="release-compare-button"
                  disabled={records.length < 2}
                  onClick={() => void compareReleases()}
                >
                  {t.compare}
                </button>
              </div>
              {compareState ? (
                <div className="mt-3 space-y-2" data-testid="release-diff-panel">
                  <div className="text-xs font-semibold text-slate-600" data-testid="release-diff-summary">
                    {zhCN.projectSnapshots.diffSummary(
                      compareState.diff.diff.summary.added,
                      compareState.diff.diff.summary.deleted,
                      compareState.diff.diff.summary.modified,
                      compareState.diff.diff.summary.trackChanges,
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-line bg-white">
                    {compareState.diff.diff.items.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500">{zhCN.projectSnapshots.noDiffs}</div>
                    ) : (
                      compareState.diff.diff.items.map((item) => (
                        <DiffRow
                          key={item.id}
                          item={item}
                          checked={selectedDiffs.includes(item.id)}
                          onToggle={() => toggleDiff(item.id)}
                        />
                      ))
                    )}
                  </div>
                  <button
                    className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    data-testid="release-apply-diff-button"
                    disabled={selectedDiffs.length === 0}
                    onClick={applySelectedDiffs}
                  >
                    {zhCN.projectSnapshots.applySelected}
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        </div>

        <div className="flex items-center justify-between border-t border-line p-4">
          <div className="text-xs text-slate-500" data-testid="release-current-version">
            {t.currentVersion(project.releaseVersion)}
          </div>
          <div className="flex gap-2">
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
              data-testid="release-publish-button"
              disabled={publishing}
              onClick={() => void publishRelease()}
            >
              {publishing ? t.publishing : t.publish}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChecklistRow({ item }: { item: ReleaseChecklistItemResult }) {
  const t = zhCN.releaseWorkflow;
  return (
    <div
      className="rounded-md border border-line bg-white p-2 text-xs"
      data-testid={`release-check-result-${item.id}`}
      data-status={item.status}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-700">{t.checks[item.id]}</span>
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${statusClass(item.status)}`}>
          {t.status[item.status]}
        </span>
      </div>
      <div className="mt-1 text-slate-500">{item.message}</div>
      {item.details.length > 0 ? <div className="mt-1 truncate text-slate-500">{item.details.join(' · ')}</div> : null}
    </div>
  );
}

function ReleaseHistoryRow({ record }: { record: ProjectReleaseEntry }) {
  return (
    <div className="rounded-md border border-line bg-white p-3 text-xs" data-testid="release-history-row">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">{record.version}</span>
        <span className="text-slate-500">{formatReleaseTime(record.releasedAt)}</span>
      </div>
      <div className="mt-1 truncate text-slate-500" title={record.exportPath}>
        {record.exportPath}
      </div>
      {record.changelog ? (
        <div
          className="mt-2 whitespace-pre-wrap rounded-md bg-panel p-2 text-slate-600"
          data-testid="release-history-changelog"
        >
          {record.changelog}
        </div>
      ) : null}
    </div>
  );
}

function ReleaseSelect({
  label,
  value,
  records,
  testId,
  onChange,
}: {
  label: string;
  value: string;
  records: ProjectReleaseEntry[];
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
        <option value="">{zhCN.releaseWorkflow.noReleaseSelected}</option>
        {records.map((record) => (
          <option key={record.path} value={record.path}>
            {record.version}
          </option>
        ))}
      </select>
    </label>
  );
}

function DiffRow({ item, checked, onToggle }: { item: TimelineVersionDiffItem; checked: boolean; onToggle(): void }) {
  return (
    <label
      className="flex items-start gap-2 border-b border-line px-3 py-2 text-xs last:border-b-0"
      data-testid="release-diff-row"
    >
      <input
        className="mt-0.5 h-4 w-4 accent-brand"
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        data-testid={`release-diff-check-${item.id}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-slate-700">{item.label}</span>
        <span className="block truncate text-slate-500">{zhCN.projectSnapshots.diffTypes[item.type]}</span>
      </span>
    </label>
  );
}

function NumberField({
  label,
  value,
  testId,
  onChange,
}: {
  label: string;
  value: number;
  testId: string;
  onChange(value: number): void;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
        type="number"
        min={0}
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function splitVersion(value: string): { major: number; minor: number; patch: number } {
  const [major, minor, patch] = value.split('.').map((part) => Number(part));
  return {
    major: Number.isFinite(major) ? major : 0,
    minor: Number.isFinite(minor) ? minor : 1,
    patch: Number.isFinite(patch) ? patch : 0,
  };
}

function statusClass(status: ReleaseChecklistItemResult['status']): string {
  if (status === 'blocking') {
    return 'border-rose-300 bg-rose-50 text-rose-800';
  }
  if (status === 'skipped') {
    return 'border-slate-300 bg-slate-50 text-slate-600';
  }
  return 'border-emerald-300 bg-emerald-50 text-emerald-800';
}

function formatReleaseTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { hour12: false });
}
