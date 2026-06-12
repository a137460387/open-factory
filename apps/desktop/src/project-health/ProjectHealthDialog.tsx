import {
  getProjectHealthIssueCount,
  type DuplicateMediaIssue,
  type MissingMediaIssue,
  type OrphanMediaIssue,
  type ProjectHealthClipReference,
  type ProjectHealthReport,
  type ProxyMissingIssue
} from '@open-factory/editor-core';
import { CheckCircle2, Gauge, Link2, Merge, RefreshCw, Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { zhCN } from '../i18n/strings';

interface ProjectHealthDialogProps {
  report?: ProjectHealthReport;
  scanning: boolean;
  onClose(): void;
  onRescan(): void;
  onRelink(issue: MissingMediaIssue): void;
  onRemoveOrphan(issue: OrphanMediaIssue): void;
  onMergeDuplicate(issue: DuplicateMediaIssue): void;
  onQueueProxy(issue: ProxyMissingIssue): void;
}

export function ProjectHealthDialog({
  report,
  scanning,
  onClose,
  onRescan,
  onRelink,
  onRemoveOrphan,
  onMergeDuplicate,
  onQueueProxy
}: ProjectHealthDialogProps) {
  const t = zhCN.projectHealth;
  const issueCount = report ? getProjectHealthIssueCount(report) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="project-health-dialog">
      <section className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-soft" data-testid="project-health-panel">
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <div className="text-xs text-slate-500">{scanning ? t.scanning : t.total(issueCount)}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel" type="button" data-testid="project-health-rescan-button" onClick={onRescan} disabled={scanning}>
              <RefreshCw size={14} />
              {t.rescan}
            </button>
            <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel" type="button" title={zhCN.common.close} aria-label={zhCN.common.close} data-testid="project-health-close-button" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {scanning && !report ? <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.scanning}</div> : null}
          {report && issueCount === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-md border border-line bg-panel p-6 text-center text-sm font-medium text-slate-600" data-testid="project-health-empty">
              <CheckCircle2 className="mb-3 text-emerald-600" size={28} />
              {t.empty}
            </div>
          ) : null}
          {report && issueCount > 0 ? (
            <div className="space-y-4">
              <HealthSection title={t.sections.missingMedia} count={report.missingMedia.length} testId="project-health-section-missing-media">
                {report.missingMedia.map((issue) => (
                  <HealthItem key={issue.id} testId="project-health-missing-item" title={issue.name} subtitle={issue.path}>
                    <ReferenceList references={issue.references} />
                    <ActionButton testId="project-health-fix-missing-button" onClick={() => onRelink(issue)} icon={<Link2 size={14} />}>
                      {t.actions.relink}
                    </ActionButton>
                  </HealthItem>
                ))}
              </HealthSection>
              <HealthSection title={t.sections.orphanMedia} count={report.orphanMedia.length} testId="project-health-section-orphan-media">
                {report.orphanMedia.map((issue) => (
                  <HealthItem key={issue.id} testId="project-health-orphan-item" title={issue.name} subtitle={issue.path}>
                    <ActionButton testId="project-health-fix-orphan-button" onClick={() => onRemoveOrphan(issue)} icon={<Trash2 size={14} />}>
                      {t.actions.removeOrphan}
                    </ActionButton>
                  </HealthItem>
                ))}
              </HealthSection>
              <HealthSection title={t.sections.duplicateMedia} count={report.duplicateMedia.length} testId="project-health-section-duplicate-media">
                {report.duplicateMedia.map((issue) => (
                  <HealthItem key={issue.id} testId="project-health-duplicate-item" title={t.detail.duplicateGroup(issue.assets.length, issue.size)} subtitle={issue.assets.map((asset) => asset.path).join(' / ')}>
                    <div className="space-y-1 text-xs text-slate-500">
                      {issue.assets.map((asset) => (
                        <div className="truncate" key={asset.assetId} title={asset.path}>
                          {asset.name} · {asset.path}
                        </div>
                      ))}
                    </div>
                    <ActionButton testId="project-health-fix-duplicate-button" onClick={() => onMergeDuplicate(issue)} icon={<Merge size={14} />}>
                      {t.actions.mergeDuplicate}
                    </ActionButton>
                  </HealthItem>
                ))}
              </HealthSection>
              <HealthSection title={t.sections.proxyMissing} count={report.proxyMissing.length} testId="project-health-section-proxy-missing">
                {report.proxyMissing.map((issue) => (
                  <HealthItem key={issue.id} testId="project-health-proxy-item" title={issue.name} subtitle={`${issue.path} · ${t.detail.proxyResolution(issue.width, issue.height)}`}>
                    <ActionButton testId="project-health-fix-proxy-button" onClick={() => onQueueProxy(issue)} icon={<Gauge size={14} />}>
                      {t.actions.enqueueProxy}
                    </ActionButton>
                  </HealthItem>
                ))}
              </HealthSection>
              <HealthSection title={t.sections.missingFonts} count={report.missingFonts.length} testId="project-health-section-missing-fonts">
                {report.missingFonts.map((issue) => (
                  <HealthItem key={issue.id} testId="project-health-font-item" title={t.detail.missingFont(issue.fontFamily)} subtitle={formatReference(issue.clip)} />
                ))}
              </HealthSection>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function HealthSection({ title, count, testId, children }: { title: string; count: number; testId: string; children: ReactNode }) {
  if (count === 0) {
    return null;
  }
  return (
    <section className="space-y-2" data-testid={testId} data-count={count}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span className="rounded bg-panel px-2 py-0.5 text-[11px] font-semibold text-slate-600">{zhCN.projectHealth.sectionCount(count)}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function HealthItem({ title, subtitle, testId, children }: { title: string; subtitle: string; testId: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-white p-3" data-testid={testId}>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-ink" title={title}>{title}</div>
        <div className="truncate text-xs text-slate-500" title={subtitle}>{subtitle}</div>
      </div>
      {children ? <div className="mt-2 space-y-2">{children}</div> : null}
    </div>
  );
}

function ActionButton({ testId, onClick, icon, children }: { testId: string; onClick(): void; icon: ReactNode; children: ReactNode }) {
  return (
    <button className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-white" type="button" data-testid={testId} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

function ReferenceList({ references }: { references: ProjectHealthClipReference[] }) {
  if (references.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {references.map((reference) => (
        <span key={`${reference.sequenceId}-${reference.clipId}`} className="rounded bg-panel px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {formatReference(reference)}
        </span>
      ))}
    </div>
  );
}

function formatReference(reference: ProjectHealthClipReference): string {
  return zhCN.projectHealth.detail.clipRef(reference.clipName, reference.trackName);
}
