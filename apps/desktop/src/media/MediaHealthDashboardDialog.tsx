import type { MediaHealthDashboard, MediaHealthRepairTask } from '@open-factory/editor-core';
import { AlertTriangle, Archive, CalendarDays, Database, Gauge, Link2, RefreshCw, Wrench, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { zhCN } from '../i18n/strings';

interface MediaHealthDashboardDialogProps {
  dashboard?: MediaHealthDashboard;
  scanning: boolean;
  autoShowEnabled: boolean;
  onAutoShowEnabledChange(enabled: boolean): void;
  onClose(): void;
  onRescan(): void;
  onRepair(): void;
  onOpenRelinkPanel(): void;
}

export function MediaHealthDashboardDialog({
  dashboard,
  scanning,
  autoShowEnabled,
  onAutoShowEnabledChange,
  onClose,
  onRescan,
  onRepair,
  onOpenRelinkPanel,
}: MediaHealthDashboardDialogProps) {
  const t = zhCN.mediaHealthDashboard;
  const repairTaskCount = dashboard?.repairTasks.reduce((total, task) => total + task.count, 0) ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="media-health-dashboard-dialog"
    >
      <section
        className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-soft"
        data-testid="media-health-dashboard-panel"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <div className="text-xs text-slate-500">
              {scanning ? t.scanning : dashboard ? t.summary(dashboard.issueCount) : t.waiting}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-slate-700">
              <input
                className="accent-brand"
                type="checkbox"
                checked={autoShowEnabled}
                data-testid="media-health-auto-show-checkbox"
                onChange={(event) => onAutoShowEnabledChange(event.target.checked)}
              />
              {t.autoShow}
            </label>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:opacity-50"
              type="button"
              data-testid="media-health-repair-button"
              onClick={onRepair}
              disabled={scanning || repairTaskCount === 0}
            >
              <Wrench size={14} />
              {t.repair}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:opacity-50"
              type="button"
              data-testid="media-health-rescan-button"
              onClick={onRescan}
              disabled={scanning}
            >
              <RefreshCw size={14} />
              {t.rescan}
            </button>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel"
              type="button"
              title={zhCN.common.close}
              aria-label={zhCN.common.close}
              data-testid="media-health-close-button"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {scanning && !dashboard ? (
            <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.scanning}</div>
          ) : null}
          {dashboard ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <MetricCard
                  testId="media-health-card-proxy-coverage"
                  title={t.cards.proxyCoverage}
                  icon={<Gauge size={18} />}
                  tone="teal"
                >
                  <div className="flex items-center gap-4">
                    <ProxyRing dashboard={dashboard} />
                    <div>
                      <div
                        className="text-2xl font-semibold tabular-nums text-ink"
                        data-testid="media-health-proxy-coverage-value"
                      >
                        {t.proxyCoverageValue(dashboard.proxyCoverage.ready, dashboard.proxyCoverage.total)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t.proxyCoveragePercent(dashboard.proxyCoverage.progress.percent)}
                      </div>
                    </div>
                  </div>
                </MetricCard>
                <MetricCard
                  testId="media-health-card-missing-media"
                  title={t.cards.missingMedia}
                  icon={<AlertTriangle size={18} />}
                  tone="red"
                >
                  <CountWithAction
                    count={dashboard.missingMedia.count}
                    testId="media-health-missing-count"
                    actionTestId="media-health-missing-card-action"
                    actionLabel={t.openRelink}
                    actionDisabled={dashboard.missingMedia.count === 0}
                    onAction={onOpenRelinkPanel}
                  />
                </MetricCard>
                <MetricCard
                  testId="media-health-card-expired-proxy"
                  title={t.cards.expiredProxy}
                  icon={<RefreshCw size={18} />}
                  tone="orange"
                >
                  <CountValue count={dashboard.expiredProxies.count} testId="media-health-expired-proxy-count" />
                </MetricCard>
                <MetricCard
                  testId="media-health-card-unused-media"
                  title={t.cards.unusedMedia}
                  icon={<Archive size={18} />}
                  tone="slate"
                >
                  <CountValue count={dashboard.unusedMedia.count} testId="media-health-unused-media-count" />
                </MetricCard>
                <MetricCard
                  testId="media-health-card-storage"
                  title={t.cards.storage}
                  icon={<Database size={18} />}
                  tone="blue"
                >
                  <StorageBar dashboard={dashboard} />
                </MetricCard>
                <MetricCard
                  testId="media-health-card-recent-imports"
                  title={t.cards.recentImports}
                  icon={<CalendarDays size={18} />}
                  tone="violet"
                >
                  <RecentImportChart dashboard={dashboard} />
                </MetricCard>
              </div>
              <section
                className="rounded-md border border-line bg-panel p-3"
                data-testid="media-health-repair-task-list"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{t.repairTasks}</h3>
                  <span className="text-xs text-slate-500">{t.repairTaskCount(repairTaskCount)}</span>
                </div>
                {dashboard.repairTasks.length > 0 ? (
                  <div className="mt-2 grid gap-1 text-xs text-slate-600">
                    {dashboard.repairTasks.map((task) => (
                      <div key={task.type} data-testid="media-health-repair-task" data-task-type={task.type}>
                        {t.repairTaskLabels[task.type](task.count)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-500">{t.noRepairTasks}</div>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  testId,
  title,
  icon,
  tone,
  children,
}: {
  testId: string;
  title: string;
  icon: ReactNode;
  tone: 'teal' | 'red' | 'orange' | 'slate' | 'blue' | 'violet';
  children: ReactNode;
}) {
  const toneClass = {
    teal: 'text-teal-700 bg-teal-50',
    red: 'text-red-700 bg-red-50',
    orange: 'text-orange-700 bg-orange-50',
    slate: 'text-slate-700 bg-slate-100',
    blue: 'text-blue-700 bg-blue-50',
    violet: 'text-violet-700 bg-violet-50',
  }[tone];
  return (
    <section className="min-h-[148px] rounded-md border border-line bg-white p-3" data-testid={testId}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${toneClass}`}>{icon}</span>
        <h3 className="min-w-0 truncate text-sm font-semibold text-ink">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ProxyRing({ dashboard }: { dashboard: MediaHealthDashboard }) {
  const progress = dashboard.proxyCoverage.progress;
  return (
    <svg
      className="h-20 w-20 shrink-0"
      viewBox="0 0 44 44"
      role="img"
      aria-label={zhCN.mediaHealthDashboard.cards.proxyCoverage}
    >
      <circle cx="22" cy="22" r="16" fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle
        cx="22"
        cy="22"
        r="16"
        fill="none"
        stroke="#0f766e"
        strokeWidth="6"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={progress.dashArray}
        transform="rotate(-90 22 22)"
        data-testid="media-health-proxy-ring"
      />
      <text x="22" y="25" textAnchor="middle" className="fill-slate-700 text-[9px] font-semibold">
        {progress.percent}%
      </text>
    </svg>
  );
}

function CountWithAction({
  count,
  testId,
  actionTestId,
  actionLabel,
  actionDisabled,
  onAction,
}: {
  count: number;
  testId: string;
  actionTestId: string;
  actionLabel: string;
  actionDisabled: boolean;
  onAction(): void;
}) {
  return (
    <div>
      <CountValue count={count} testId={testId} />
      <button
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50"
        type="button"
        data-testid={actionTestId}
        disabled={actionDisabled}
        onClick={onAction}
      >
        <Link2 size={14} />
        {actionLabel}
      </button>
    </div>
  );
}

function CountValue({ count, testId }: { count: number; testId: string }) {
  return (
    <div className="text-3xl font-semibold tabular-nums text-ink" data-testid={testId}>
      {count}
    </div>
  );
}

function StorageBar({ dashboard }: { dashboard: MediaHealthDashboard }) {
  const t = zhCN.mediaHealthDashboard;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" data-testid="media-health-storage-bar">
        {dashboard.storage.segments.map((segment) => (
          <div
            key={segment.kind}
            className={storageSegmentClass(segment.kind)}
            style={{ width: `${Math.max(2, Math.round(segment.ratio * 100))}%` }}
            title={t.storageKinds[segment.kind]}
          />
        ))}
      </div>
      <div className="mt-3 grid gap-1 text-xs text-slate-600">
        {dashboard.storage.segments.map((segment) => (
          <div key={segment.kind} className="flex items-center justify-between gap-2">
            <span>{t.storageKinds[segment.kind]}</span>
            <span className="font-medium tabular-nums">{formatBytes(segment.bytes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentImportChart({ dashboard }: { dashboard: MediaHealthDashboard }) {
  const points = dashboard.recentImports.points;
  const max = Math.max(1, ...points.map((point) => point.count));
  const coordinates = points.map((point, index) => `${index * 20},${40 - (point.count / max) * 34}`).join(' ');
  return (
    <div>
      <svg
        className="h-16 w-full"
        viewBox="0 0 120 44"
        preserveAspectRatio="none"
        data-testid="media-health-recent-import-chart"
      >
        <polyline fill="none" stroke="#7c3aed" strokeWidth="2" points={coordinates} />
        {points.map((point, index) => (
          <circle key={point.day} cx={index * 20} cy={40 - (point.count / max) * 34} r="2" fill="#7c3aed" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between gap-1 text-[10px] text-slate-500">
        {points.map((point) => (
          <span
            key={point.day}
            className="tabular-nums"
            data-testid="media-health-recent-import-point"
            data-count={point.count}
          >
            {point.day.slice(5)}
          </span>
        ))}
      </div>
    </div>
  );
}

function storageSegmentClass(kind: MediaHealthDashboard['storage']['segments'][number]['kind']): string {
  if (kind === 'media') {
    return 'bg-blue-500';
  }
  if (kind === 'proxy') {
    return 'bg-teal-500';
  }
  return 'bg-slate-400';
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
