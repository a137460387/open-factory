import { useMemo } from 'react';
import type {
  BatchEditableMediaMetadata,
  Clip,
  EffectPreset,
  MediaAsset,
  MediaFlag,
  MediaLabelColor,
  MediaRenamePreviewItem,
  Subclip,
  TitleTemplateId,
} from '@open-factory/editor-core';
import { UpdateProjectMediaCollectionsCommand } from '@open-factory/editor-core';
import { ChevronLeft } from 'lucide-react';
import { MediaBin } from '../MediaBin/MediaBin';
import { CollapsedPanelRail } from '../CollapsedPanelRail';
import { zhCN } from '../../i18n/strings';
import { useEditorStore } from '../../store/editorStore';
import { useEditorUIStore } from '../../store/editorUIStore';
import { useEditorMiscStore } from '../../store/editorMiscStore';
import { useEditorSettingsStore } from '../../store/editorSettingsStore';
import { commandManager, projectAccessor } from '../../store/commandManager';
import { getEffectivePanelState } from '../../layout/layoutSettings';
import { getReviewModeShellVisibility } from '../../review/reviewMode';
import { summarizeContentAnalysisByMedia, collectContentAnalysisTargets } from '../../lib/content-analysis-helpers';
import type { SharedLibraryResource } from '../../shared-library/sharedLibrary';

export interface ShellLeftPanelCallbacks {
  onImport: () => void;
  onImportPaths: (paths: string[]) => void;
  onBatchTranscode: (paths: string[]) => void;
  onBatchGenerateCovers: () => void;
  onGenerateThumbnails: (assetIds: string[]) => void;
  onExportGif: (asset: MediaAsset) => void;
  onAnalyzeSpectrum: (asset: MediaAsset) => void;
  onScanDuplicates: () => void;
  onAddToTimeline: (assetId: string) => void;
  onAddVersion: (assetId: string) => void;
  onCompareVersions: (assetId: string) => void;
  onAddAdjustmentLayer: () => void;
  onRelink: (assetId: string) => void;
  onRelinkAll: () => void;
  onGenerateProxy: (assetId: string) => void;
  onConvertToCfr: (assetId: string) => void;
  onSetLabel: (assetId: string, labelColor?: MediaLabelColor) => void;
  onSetRating: (assetId: string, rating: number) => void;
  onSetFlag: (assetId: string, flag?: MediaFlag) => void;
  onBatchUpdateMetadata: (assetIds: string[], metadata: BatchEditableMediaMetadata) => void;
  onBatchRenameMedia: (assetIds: string[], preview: MediaRenamePreviewItem[], renameFiles: boolean) => void;
  onAddTitleTemplate: (templateId: TitleTemplateId) => void;
  onCreateFolder: (parentId?: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onSetFolderCollapsed: (folderId: string, collapsed: boolean) => void;
  onMoveMediaToFolder: (assetIds: string[], folderId?: string | null) => void;
  onApplyEffectPreset: (preset: EffectPreset) => void;
  onToggleFavorite: (assetId: string) => void;
  onRevealInTimeline: (assetId: string) => void;
  onPinToSession: (assetId: string) => void;
  onAddSubclip: (subclip: Subclip) => void;
  onUpdateSubclip: (subclipId: string, patch: Partial<Subclip>) => void;
  onDeleteSubclip: (subclipId: string) => void;
  onAddSubclipToTimeline: (assetId: string, subclip: Subclip) => void;
}

export function ShellLeftPanel({ callbacks }: { callbacks: ShellLeftPanelCallbacks }) {
  const project = useEditorStore((s) => s.project);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const layoutSettings = useEditorUIStore((s) => s.layoutSettings);
  const viewportSize = useEditorUIStore((s) => s.viewportSize);
  const reviewMode = useEditorUIStore((s) => s.reviewMode);
  const persistLayoutPatch = useEditorUIStore((s) => s.persistLayoutPatch);

  const favoriteIds = useEditorMiscStore((s) => s.favoriteIds);
  const pinnedIds = useEditorMiscStore((s) => s.pinnedIds);
  const recentMediaIds = useEditorMiscStore((s) => s.recentMediaIds);
  const sharedLibraryResources = useEditorSettingsStore((s) => s.sharedLibraryResources);

  const effectivePanels = useMemo(() => getEffectivePanelState(layoutSettings, viewportSize.width), [layoutSettings, viewportSize.width]);
  const reviewVisibility = useMemo(() => getReviewModeShellVisibility(reviewMode), [reviewMode]);
  const contentAnalysisTargets = useMemo(() => collectContentAnalysisTargets(project), [project]);
  const mediaContentAnalysis = useMemo(() => summarizeContentAnalysisByMedia(contentAnalysisTargets), [contentAnalysisTargets]);

  if (!reviewVisibility.showLeftPanel) return null;

  if (effectivePanels.leftPanelCollapsed) {
    return (
      <CollapsedPanelRail
        side="left"
        label={zhCN.layout.mediaPanelCollapsed}
        title={zhCN.layout.expandMediaPanel}
        testId="left-panel-expand-button"
        onClick={() => persistLayoutPatch({ leftPanelCollapsed: false, panels: { ...layoutSettings.panels, mediaLibrary: true } })}
      />
    );
  }

  return (
    <section className="relative h-full min-h-0 min-w-0 overflow-hidden" data-testid="left-panel" data-collapsed="false">
      <button
        className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white/95 text-slate-600 shadow-sm hover:bg-panel"
        type="button"
        title={zhCN.layout.collapseMediaPanel}
        aria-label={zhCN.layout.collapseMediaPanel}
        data-testid="left-panel-collapse-button"
        onClick={() => persistLayoutPatch({ leftPanelCollapsed: true, panels: { ...layoutSettings.panels, mediaLibrary: false } })}
      >
        <ChevronLeft size={16} />
      </button>
      <MediaBin
        media={project.media}
        mediaFolders={project.mediaFolders}
        mediaMetadata={project.mediaMetadata}
        mediaContentAnalysis={mediaContentAnalysis}
        sharedLibraryResources={sharedLibraryResources}
        selectedClipId={selectedClipId}
        projectFrameRate={project.settings.fps}
        onImport={callbacks.onImport}
        onImportPaths={callbacks.onImportPaths}
        onBatchTranscode={callbacks.onBatchTranscode}
        onBatchGenerateCovers={callbacks.onBatchGenerateCovers}
        onGenerateThumbnails={callbacks.onGenerateThumbnails}
        onExportGif={callbacks.onExportGif}
        onAnalyzeSpectrum={callbacks.onAnalyzeSpectrum}
        onScanDuplicates={callbacks.onScanDuplicates}
        onAddToTimeline={callbacks.onAddToTimeline}
        onAddVersion={callbacks.onAddVersion}
        onCompareVersions={callbacks.onCompareVersions}
        onAddAdjustmentLayer={callbacks.onAddAdjustmentLayer}
        onRelink={callbacks.onRelink}
        onRelinkAll={callbacks.onRelinkAll}
        onGenerateProxy={callbacks.onGenerateProxy}
        onConvertToCfr={callbacks.onConvertToCfr}
        onSetLabel={callbacks.onSetLabel}
        onSetRating={callbacks.onSetRating}
        onSetFlag={callbacks.onSetFlag}
        onBatchUpdateMetadata={callbacks.onBatchUpdateMetadata}
        onBatchRenameMedia={callbacks.onBatchRenameMedia}
        onAddTitleTemplate={callbacks.onAddTitleTemplate}
        onCreateFolder={callbacks.onCreateFolder}
        onRenameFolder={callbacks.onRenameFolder}
        onDeleteFolder={callbacks.onDeleteFolder}
        onSetFolderCollapsed={callbacks.onSetFolderCollapsed}
        onMoveMediaToFolder={callbacks.onMoveMediaToFolder}
        onApplyEffectPreset={callbacks.onApplyEffectPreset}
        favoriteIds={favoriteIds}
        onToggleFavorite={callbacks.onToggleFavorite}
        onRevealInTimeline={callbacks.onRevealInTimeline}
        pinnedIds={pinnedIds}
        onPinToSession={callbacks.onPinToSession}
        recentMediaIds={recentMediaIds}
        subclips={project.subclips}
        onAddSubclip={callbacks.onAddSubclip}
        onUpdateSubclip={callbacks.onUpdateSubclip}
        onDeleteSubclip={callbacks.onDeleteSubclip}
        onAddSubclipToTimeline={callbacks.onAddSubclipToTimeline}
        mediaCollections={project.mediaCollections ?? []}
        onUpdateMediaCollections={(cols) => commandManager.execute(new UpdateProjectMediaCollectionsCommand(projectAccessor, cols))}
      />
    </section>
  );
}
