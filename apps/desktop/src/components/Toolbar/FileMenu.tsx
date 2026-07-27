import { FileDown } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { MenuDropdown, MenuItem, MenuSeparator } from './MenuDropdown';

export function FileMenu({
  open,
  onToggle,
  canExport,
  isExporting,
  sharePackageBusy,
  onNewFromTemplate,
  onSaveTimelineTemplate,
  onNewFromTimelineTemplate,
  onCreateMediaReport,
  onCreateClipReport,
  onGenerateVideoSummary,
  onConformMedia,
  onArchiveProject,
  onOpenReleaseWorkflow,
  onCreateSharePackage,
  onExportProfessionalNle,
  onOpenProjectHealth,
  onImportBookmarks,
  onExportBookmarks,
}: {
  open: boolean;
  onToggle(): void;
  canExport: boolean;
  isExporting: boolean;
  sharePackageBusy?: boolean;
  onNewFromTemplate(): void;
  onSaveTimelineTemplate(): void;
  onNewFromTimelineTemplate(): void;
  onCreateMediaReport(): void;
  onCreateClipReport(): void;
  onGenerateVideoSummary(): void;
  onConformMedia(): void;
  onArchiveProject(): void;
  onOpenReleaseWorkflow(): void;
  onCreateSharePackage(): void;
  onExportProfessionalNle(): void;
  onOpenProjectHealth(): void;
  onImportBookmarks(): void;
  onExportBookmarks(): void;
}) {
  const t = zhCN.toolbar;
  const close = () => onToggle();
  return (
    <MenuDropdown label={t.fileMenu} open={open} onToggle={onToggle} testId="toolbar-file-menu-button">
      <MenuItem label={t.newFromTemplate} testId="toolbar-file-new-template-menu-item" onClick={() => { close(); onNewFromTemplate(); }} />
      <MenuItem label={t.saveTimelineTemplate} testId="toolbar-file-save-timeline-template-menu-item" onClick={() => { close(); onSaveTimelineTemplate(); }} />
      <MenuItem label={t.newFromTimelineTemplate} testId="toolbar-file-new-timeline-template-menu-item" onClick={() => { close(); onNewFromTimelineTemplate(); }} />
      <MenuItem label={t.mediaReport} testId="toolbar-file-media-report-menu-item" onClick={() => { close(); onCreateMediaReport(); }} />
      <MenuItem label={t.clipReport} testId="toolbar-file-clip-report-menu-item" onClick={() => { close(); onCreateClipReport(); }} />
      <MenuItem label={t.videoSummary} testId="toolbar-file-video-summary-menu-item" onClick={() => { close(); onGenerateVideoSummary(); }} />
      <MenuItem label={t.conformMedia} testId="toolbar-file-conform-media-menu-item" onClick={() => { close(); onConformMedia(); }} />
      <MenuItem label={t.archiveProject} testId="toolbar-file-archive-project-menu-item" onClick={() => { close(); onArchiveProject(); }} />
      <MenuItem label={t.releaseVersion} testId="toolbar-file-release-version-menu-item" onClick={() => { close(); onOpenReleaseWorkflow(); }} />
      <MenuItem label={t.createSharePackage} testId="toolbar-file-share-package-menu-item" disabled={!canExport || isExporting || sharePackageBusy} onClick={() => { close(); onCreateSharePackage(); }} />
      <MenuItem label={t.exportProfessionalNle} testId="toolbar-file-professional-nle-export-menu-item" disabled={!canExport} icon={<FileDown size={14} />} onClick={() => { close(); onExportProfessionalNle(); }} />
      <MenuItem label={t.projectHealthCheck} testId="toolbar-file-project-health-menu-item" onClick={() => { close(); onOpenProjectHealth(); }} />
      <MenuSeparator />
      <MenuItem label={t.importBookmarks} testId="toolbar-file-import-bookmarks-menu-item" onClick={() => { close(); onImportBookmarks(); }} />
      <MenuItem label={t.exportBookmarks} testId="toolbar-file-export-bookmarks-menu-item" onClick={() => { close(); onExportBookmarks(); }} />
    </MenuDropdown>
  );
}
